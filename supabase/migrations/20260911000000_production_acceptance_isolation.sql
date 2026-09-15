-- Isolate production acceptance data from normal user workspaces.
-- The run ledger intentionally stores only identifiers, status and compact
-- operational summaries; report bodies and AI prompts never belong here.

BEGIN;

CREATE TABLE IF NOT EXISTS public.production_acceptance_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  acceptance_run_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'passed', 'failed', 'timed_out', 'cleaning', 'cleaned', 'cleanup_failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  cleanup_started_at TIMESTAMPTZ,
  cleanup_finished_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  release_sha TEXT,
  api_workspace_id UUID,
  browser_workspace_id UUID,
  api_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  browser_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  result_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  cleanup_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_acceptance_runs_expiry
  ON public.production_acceptance_runs(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_production_acceptance_runs_owners
  ON public.production_acceptance_runs(api_owner_id, browser_owner_id, started_at DESC);

ALTER TABLE public.production_acceptance_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.production_acceptance_runs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_acceptance_runs TO service_role;

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS acceptance_run_id TEXT;
ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS acceptance_run_id TEXT;
ALTER TABLE public.workspace_invites
  ADD COLUMN IF NOT EXISTS acceptance_run_id TEXT;
ALTER TABLE public.report_materials
  ADD COLUMN IF NOT EXISTS acceptance_run_id TEXT;
ALTER TABLE public.saved_workspace_items
  ADD COLUMN IF NOT EXISTS acceptance_run_id TEXT;
ALTER TABLE public.generated_reports
  ADD COLUMN IF NOT EXISTS acceptance_run_id TEXT;
ALTER TABLE public.report_runs
  ADD COLUMN IF NOT EXISTS acceptance_run_id TEXT;
ALTER TABLE public.report_exports
  ADD COLUMN IF NOT EXISTS acceptance_run_id TEXT;
ALTER TABLE public.ai_request_logs
  ADD COLUMN IF NOT EXISTS acceptance_run_id TEXT;
ALTER TABLE public.ai_token_reservations
  ADD COLUMN IF NOT EXISTS acceptance_run_id TEXT;
ALTER TABLE public.monitored_shops
  ADD COLUMN IF NOT EXISTS acceptance_run_id TEXT;
ALTER TABLE public.user_activity
  ADD COLUMN IF NOT EXISTS acceptance_run_id TEXT;

CREATE INDEX IF NOT EXISTS idx_workspaces_acceptance_run ON public.workspaces(acceptance_run_id) WHERE acceptance_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_members_acceptance_run ON public.workspace_members(acceptance_run_id) WHERE acceptance_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_invites_acceptance_run ON public.workspace_invites(acceptance_run_id) WHERE acceptance_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_report_materials_acceptance_run ON public.report_materials(acceptance_run_id) WHERE acceptance_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_saved_workspace_items_acceptance_run ON public.saved_workspace_items(acceptance_run_id) WHERE acceptance_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_generated_reports_acceptance_run ON public.generated_reports(acceptance_run_id) WHERE acceptance_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_report_runs_acceptance_run ON public.report_runs(acceptance_run_id) WHERE acceptance_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_report_exports_acceptance_run ON public.report_exports(acceptance_run_id) WHERE acceptance_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_acceptance_run ON public.ai_request_logs(acceptance_run_id) WHERE acceptance_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_token_reservations_acceptance_run ON public.ai_token_reservations(acceptance_run_id) WHERE acceptance_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_monitored_shops_acceptance_run ON public.monitored_shops(acceptance_run_id) WHERE acceptance_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_activity_acceptance_run ON public.user_activity(acceptance_run_id) WHERE acceptance_run_id IS NOT NULL;

-- Keep the existing four-argument quota contract for normal callers and add
-- an atomic five-argument variant for acceptance runs. The wrapper updates the
-- reservation in the same transaction, so a function crash cannot leave an
-- unlabelled acceptance reservation between INSERT and a later PATCH.
CREATE OR REPLACE FUNCTION public.reserve_ai_token_quota(
  p_user_id UUID,
  p_request_id TEXT,
  p_requested_tokens BIGINT,
  p_limit_override BIGINT,
  p_acceptance_run_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reservation_result JSONB;
BEGIN
  reservation_result := public.reserve_ai_token_quota(p_user_id, p_request_id, p_requested_tokens, p_limit_override);
  IF reservation_result ->> 'allowed' = 'true' AND NULLIF(trim(p_acceptance_run_id), '') IS NOT NULL THEN
    UPDATE public.ai_token_reservations
    SET acceptance_run_id = left(trim(p_acceptance_run_id), 160)
    WHERE user_id = p_user_id AND request_id = p_request_id;
  END IF;
  RETURN reservation_result;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_token_quota(UUID, TEXT, BIGINT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_token_quota(UUID, TEXT, BIGINT, BIGINT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.assert_production_acceptance_service_role()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claims', TRUE), '')::jsonb ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'production acceptance RPC requires service role' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Service-owned cleanup may delete a temporary workspace and its protected
-- owner membership. Normal authenticated callers keep the original guard.
CREATE OR REPLACE FUNCTION public.guard_workspace_member_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  workspace_owner UUID;
  target_user UUID;
  target_role TEXT;
  target_status TEXT;
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claims', TRUE), '')::jsonb ->> 'role', '') = 'service_role' THEN
    -- Only the temporary acceptance workspaces may bypass the owner guard.
    -- Keep the original protection for service-role writes to normal teams.
    IF EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE id = COALESCE(NEW.workspace_id, OLD.workspace_id)
        AND acceptance_run_id IS NOT NULL
    ) THEN
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END IF;
  END IF;
  SELECT owner_id INTO workspace_owner FROM public.workspaces WHERE id = COALESCE(NEW.workspace_id, OLD.workspace_id);
  target_user := COALESCE(NEW.user_id, OLD.user_id);
  target_role := CASE WHEN TG_OP = 'DELETE' THEN OLD.role ELSE NEW.role END;
  target_status := CASE WHEN TG_OP = 'DELETE' THEN OLD.status ELSE NEW.status END;
  IF target_user = workspace_owner THEN
    IF TG_OP = 'DELETE' OR target_role <> 'owner' OR target_status <> 'active' THEN
      RAISE EXCEPTION 'workspace owner membership cannot be removed or downgraded';
    END IF;
  ELSIF target_role = 'owner' THEN
    RAISE EXCEPTION 'workspace ownership transfer is not enabled';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Carry the run marker onto the collaborator membership created by invite
-- acceptance. The workspace is temporary as well, but the marker makes the
-- row independently auditable and lets cleanup find it before cascade.
CREATE OR REPLACE FUNCTION public.accept_workspace_invite(p_invite_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_row public.workspace_invites%ROWTYPE;
  current_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  current_email := lower(COALESCE(auth.jwt() ->> 'email', ''));

  SELECT * INTO invite_row
  FROM public.workspace_invites
  WHERE id = p_invite_id
  FOR UPDATE;

  IF invite_row.id IS NULL OR invite_row.status <> 'pending' THEN
    RAISE EXCEPTION 'invite is no longer available';
  END IF;
  IF invite_row.expires_at <= NOW() THEN
    UPDATE public.workspace_invites SET status = 'expired' WHERE id = p_invite_id;
    RAISE EXCEPTION 'invite has expired';
  END IF;
  IF current_email = '' OR lower(invite_row.email) <> current_email THEN
    RAISE EXCEPTION 'invite email does not match the signed-in user';
  END IF;

  INSERT INTO public.workspace_members AS member (workspace_id, user_id, role, status, invited_by, acceptance_run_id)
  VALUES (invite_row.workspace_id, auth.uid(), invite_row.role, 'active', invite_row.invited_by, invite_row.acceptance_run_id)
  ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, status = 'active', invited_by = EXCLUDED.invited_by,
        acceptance_run_id = COALESCE(EXCLUDED.acceptance_run_id, member.acceptance_run_id), updated_at = NOW();

  UPDATE public.workspace_invites
  SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
  WHERE id = p_invite_id;

  RETURN invite_row.workspace_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_production_acceptance_run(p_acceptance_run_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
  DECLARE
  run_row public.production_acceptance_runs%ROWTYPE;
  removed JSONB := '{}'::jsonb;
  object_count INTEGER := 0;
  table_count INTEGER := 0;
  workspace_ids UUID[] := '{}'::uuid[];
BEGIN
  PERFORM public.assert_production_acceptance_service_role();
  IF NULLIF(trim(p_acceptance_run_id), '') IS NULL THEN
    RAISE EXCEPTION 'acceptance_run_id is required';
  END IF;
  SELECT * INTO run_row FROM public.production_acceptance_runs
    WHERE acceptance_run_id = trim(p_acceptance_run_id) FOR UPDATE;
  IF run_row.id IS NULL THEN
    RETURN jsonb_build_object('acceptance_run_id', p_acceptance_run_id, 'status', 'not_found');
  END IF;
  IF run_row.status = 'cleaned' THEN
    RETURN jsonb_build_object(
      'acceptance_run_id', trim(p_acceptance_run_id),
      'status', 'cleaned',
      'removed', COALESCE(run_row.cleanup_summary, '{}'::jsonb),
      'duplicate', TRUE
    );
  END IF;
  SELECT COALESCE(array_agg(workspace.id), '{}'::uuid[]) INTO workspace_ids
  FROM public.workspaces AS workspace
  WHERE workspace.acceptance_run_id = p_acceptance_run_id
    AND workspace.owner_id IN (run_row.api_owner_id, run_row.browser_owner_id);

  UPDATE public.production_acceptance_runs
  SET status = 'cleaning', cleanup_started_at = NOW(), updated_at = NOW(),
      error_summary = CASE WHEN run_row.status = 'running'
        THEN COALESCE(error_summary, '{}'::jsonb) || jsonb_build_object('terminal_status', 'timed_out')
        ELSE error_summary END
  WHERE id = run_row.id;

  BEGIN
    -- Export rows retain file_path after report deletion, so remove objects
    -- before deleting the rows that carry those paths.
    DELETE FROM storage.objects AS object
    WHERE object.bucket_id = 'reports'
      AND (
        object.name IN (
          SELECT file_path FROM public.report_exports
          WHERE acceptance_run_id = p_acceptance_run_id
            AND user_id IN (run_row.api_owner_id, run_row.browser_owner_id)
            AND file_path IS NOT NULL
        )
        OR (
          split_part(object.name, '/', 1) IN (run_row.api_owner_id::text, run_row.browser_owner_id::text)
          AND position('/acceptance/' || p_acceptance_run_id || '/' IN object.name) > 0
        )
      );
    GET DIAGNOSTICS object_count = ROW_COUNT;

    DELETE FROM public.report_exports
    WHERE acceptance_run_id = p_acceptance_run_id
      AND user_id IN (run_row.api_owner_id, run_row.browser_owner_id);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('report_exports', table_count, 'storage_objects', object_count);
    DELETE FROM public.generated_reports WHERE acceptance_run_id = p_acceptance_run_id AND workspace_id = ANY(workspace_ids);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('generated_reports', table_count);
    DELETE FROM public.report_runs WHERE acceptance_run_id = p_acceptance_run_id AND user_id IN (run_row.api_owner_id, run_row.browser_owner_id);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('report_runs', table_count);
    DELETE FROM public.report_materials WHERE acceptance_run_id = p_acceptance_run_id AND workspace_id = ANY(workspace_ids);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('report_materials', table_count);
    DELETE FROM public.saved_workspace_items WHERE acceptance_run_id = p_acceptance_run_id AND workspace_id = ANY(workspace_ids);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('saved_workspace_items', table_count);
    DELETE FROM public.user_watchlist WHERE acceptance_run_id = p_acceptance_run_id AND workspace_id = ANY(workspace_ids);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('user_watchlist', table_count);
    DELETE FROM public.monitored_shops WHERE acceptance_run_id = p_acceptance_run_id AND user_id IN (run_row.api_owner_id, run_row.browser_owner_id);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('monitored_shops', table_count);
    DELETE FROM public.ai_request_logs WHERE acceptance_run_id = p_acceptance_run_id AND user_id IN (run_row.api_owner_id, run_row.browser_owner_id);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('ai_request_logs', table_count);
    DELETE FROM public.ai_token_reservations WHERE acceptance_run_id = p_acceptance_run_id AND user_id IN (run_row.api_owner_id, run_row.browser_owner_id);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('ai_token_reservations', table_count);
    DELETE FROM public.user_activity WHERE acceptance_run_id = p_acceptance_run_id AND user_id IN (run_row.api_owner_id, run_row.browser_owner_id);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('user_activity', table_count);
    DELETE FROM public.workspace_invites WHERE acceptance_run_id = p_acceptance_run_id AND workspace_id = ANY(workspace_ids);
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('workspace_invites', table_count);
    -- Owner memberships are protected by a trigger. Deleting the temporary
    -- workspace below cascades them safely after all business rows are gone.
    DELETE FROM public.workspaces WHERE id = ANY(workspace_ids) AND acceptance_run_id = p_acceptance_run_id;
    GET DIAGNOSTICS table_count = ROW_COUNT;
    removed := removed || jsonb_build_object('workspaces', table_count);

    UPDATE public.production_acceptance_runs
    SET status = 'cleaned', cleanup_finished_at = NOW(), updated_at = NOW(), cleanup_summary = removed
    WHERE id = run_row.id;
    RETURN jsonb_build_object('acceptance_run_id', p_acceptance_run_id, 'status', 'cleaned', 'removed', removed);
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.production_acceptance_runs
    SET status = 'cleanup_failed', cleanup_finished_at = NOW(), updated_at = NOW(),
        error_summary = jsonb_build_object('code', SQLSTATE, 'message', left(SQLERRM, 500)),
        cleanup_summary = removed
    WHERE id = run_row.id;
    RETURN jsonb_build_object('acceptance_run_id', p_acceptance_run_id, 'status', 'cleanup_failed', 'error_code', SQLSTATE);
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_production_acceptance_runs(p_retention INTERVAL DEFAULT INTERVAL '7 days')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  cleaned INTEGER := 0;
  failed INTEGER := 0;
  result JSONB;
BEGIN
  PERFORM public.assert_production_acceptance_service_role();
  FOR item IN
    SELECT acceptance_run_id FROM public.production_acceptance_runs
    WHERE status <> 'cleaned'
      AND (
        expires_at <= NOW()
        OR (status = 'running' AND started_at <= NOW() - INTERVAL '1 hour')
        OR (status = 'cleaning' AND cleanup_started_at <= NOW() - INTERVAL '1 hour')
        OR status = 'cleanup_failed'
        OR (status IN ('passed', 'failed', 'timed_out') AND finished_at <= NOW() - p_retention)
      )
    ORDER BY started_at
  LOOP
    result := public.cleanup_production_acceptance_run(item.acceptance_run_id);
    IF result ->> 'status' = 'cleaned' THEN cleaned := cleaned + 1; ELSE failed := failed + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('cleaned_runs', cleaned, 'failed_runs', failed);
END;
$$;

CREATE OR REPLACE FUNCTION public.start_production_acceptance_run(
  p_acceptance_run_id TEXT,
  p_api_owner_id UUID,
  p_browser_owner_id UUID,
  p_release_sha TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  run_row public.production_acceptance_runs%ROWTYPE;
  cleanup_result JSONB;
  api_workspace UUID;
  browser_workspace UUID;
  stale_run RECORD;
BEGIN
  PERFORM public.assert_production_acceptance_service_role();
  IF NULLIF(trim(p_acceptance_run_id), '') IS NULL OR p_api_owner_id IS NULL OR p_browser_owner_id IS NULL THEN
    RAISE EXCEPTION 'acceptance run and owner IDs are required';
  END IF;
  -- A new run for the dedicated accounts is also the recovery point for an
  -- interrupted prior run. This is intentionally owner-scoped so it cannot
  -- touch customer workspaces or another team's acceptance data.
  FOR stale_run IN
    SELECT acceptance_run_id
    FROM public.production_acceptance_runs
    WHERE acceptance_run_id <> trim(p_acceptance_run_id)
      AND status IN ('running', 'cleaning', 'cleanup_failed')
      AND (api_owner_id IN (p_api_owner_id, p_browser_owner_id)
        OR browser_owner_id IN (p_api_owner_id, p_browser_owner_id))
    ORDER BY started_at
  LOOP
    cleanup_result := public.cleanup_production_acceptance_run(stale_run.acceptance_run_id);
    IF cleanup_result ->> 'status' <> 'cleaned' THEN
      RAISE EXCEPTION 'cannot clean prior acceptance run %', stale_run.acceptance_run_id;
    END IF;
  END LOOP;
  -- A rerun with the same ID first removes any partial prior state.
  SELECT * INTO run_row FROM public.production_acceptance_runs
    WHERE acceptance_run_id = trim(p_acceptance_run_id) FOR UPDATE;
  IF run_row.id IS NOT NULL THEN
    cleanup_result := public.cleanup_production_acceptance_run(trim(p_acceptance_run_id));
    IF cleanup_result ->> 'status' <> 'cleaned' THEN
      RAISE EXCEPTION 'cannot reset prior acceptance run';
    END IF;
    UPDATE public.production_acceptance_runs
    SET status = 'running', started_at = NOW(), finished_at = NULL,
        cleanup_started_at = NULL, cleanup_finished_at = NULL,
        expires_at = NOW() + INTERVAL '7 days',
        release_sha = NULLIF(trim(COALESCE(p_release_sha, '')), ''),
        api_owner_id = p_api_owner_id, browser_owner_id = p_browser_owner_id,
        result_summary = '{}'::jsonb, error_summary = '{}'::jsonb, cleanup_summary = '{}'::jsonb,
        updated_at = NOW()
    WHERE id = run_row.id
    RETURNING * INTO run_row;
  ELSE
    INSERT INTO public.production_acceptance_runs (acceptance_run_id, release_sha, api_owner_id, browser_owner_id)
    VALUES (trim(p_acceptance_run_id), NULLIF(trim(COALESCE(p_release_sha, '')), ''), p_api_owner_id, p_browser_owner_id)
    RETURNING * INTO run_row;
  END IF;

  INSERT INTO public.workspaces (name, owner_id, acceptance_run_id)
  VALUES ('JAY生产验收 A ' || left(trim(p_acceptance_run_id), 42), p_api_owner_id, trim(p_acceptance_run_id))
  RETURNING id INTO api_workspace;
  INSERT INTO public.workspace_members (workspace_id, user_id, role, status, acceptance_run_id)
  VALUES (api_workspace, p_api_owner_id, 'owner', 'active', trim(p_acceptance_run_id));

  INSERT INTO public.workspaces (name, owner_id, acceptance_run_id)
  VALUES ('JAY生产验收 B ' || left(trim(p_acceptance_run_id), 42), p_browser_owner_id, trim(p_acceptance_run_id))
  RETURNING id INTO browser_workspace;
  INSERT INTO public.workspace_members (workspace_id, user_id, role, status, acceptance_run_id)
  VALUES (browser_workspace, p_browser_owner_id, 'owner', 'active', trim(p_acceptance_run_id));

  UPDATE public.production_acceptance_runs
  SET api_workspace_id = api_workspace, browser_workspace_id = browser_workspace, updated_at = NOW()
  WHERE id = run_row.id;
  RETURN jsonb_build_object(
    'acceptance_run_id', trim(p_acceptance_run_id), 'status', 'running',
    'api_workspace_id', api_workspace, 'browser_workspace_id', browser_workspace
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_production_acceptance_run(
  p_acceptance_run_id TEXT,
  p_status TEXT,
  p_result_summary JSONB DEFAULT NULL,
  p_error_summary JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_status TEXT := lower(trim(p_status));
BEGIN
  PERFORM public.assert_production_acceptance_service_role();
  IF normalized_status NOT IN ('running', 'passed', 'failed', 'timed_out') THEN
    RAISE EXCEPTION 'invalid acceptance status';
  END IF;
  UPDATE public.production_acceptance_runs
  SET status = normalized_status, finished_at = CASE WHEN normalized_status = 'running' THEN NULL ELSE NOW() END,
      result_summary = COALESCE(p_result_summary, result_summary), error_summary = COALESCE(p_error_summary, error_summary),
      updated_at = NOW()
  WHERE acceptance_run_id = trim(p_acceptance_run_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'acceptance run not found'; END IF;
  RETURN jsonb_build_object('acceptance_run_id', trim(p_acceptance_run_id), 'status', normalized_status);
END;
$$;

REVOKE ALL ON FUNCTION public.assert_production_acceptance_service_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_production_acceptance_run(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_expired_production_acceptance_runs(INTERVAL) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_production_acceptance_run(TEXT, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_production_acceptance_run(TEXT, TEXT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_production_acceptance_run(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_production_acceptance_runs(INTERVAL) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_production_acceptance_run(TEXT, UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_production_acceptance_run(TEXT, TEXT, JSONB, JSONB) TO service_role;

DROP TRIGGER IF EXISTS production_acceptance_runs_updated_at ON public.production_acceptance_runs;
CREATE TRIGGER production_acceptance_runs_updated_at
  BEFORE UPDATE ON public.production_acceptance_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.production_acceptance_runs IS 'Service-owned production acceptance lifecycle; report bodies and prompts are intentionally excluded.';

COMMIT;
