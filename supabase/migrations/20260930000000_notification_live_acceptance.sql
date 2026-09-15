BEGIN;

CREATE TABLE IF NOT EXISTS public.notification_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.notification_deliveries(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.notification_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'wecom', 'feishu')),
  attempt_no INTEGER NOT NULL CHECK (attempt_no BETWEEN 1 AND 5),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'cancelled')),
  provider_message_id TEXT,
  error_code TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(delivery_id, attempt_no),
  CHECK (provider_message_id IS NULL OR length(provider_message_id) <= 240),
  CHECK (error_code IS NULL OR (length(error_code) <= 160 AND error_code !~ 'https?://'))
);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_attempts_workspace
  ON public.notification_delivery_attempts(workspace_id, channel, created_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_live_acceptance_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'collecting' CHECK (status IN ('collecting', 'passed', 'failed', 'expired')),
  approval_reference TEXT NOT NULL CHECK (length(trim(approval_reference)) >= 3),
  started_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  evidence_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at > started_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_live_acceptance_collecting
  ON public.notification_live_acceptance_runs(workspace_id) WHERE status = 'collecting';
CREATE INDEX IF NOT EXISTS idx_notification_live_acceptance_status
  ON public.notification_live_acceptance_runs(status, started_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_live_acceptance_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.notification_live_acceptance_runs(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'wecom', 'feishu', 'system')),
  scenario TEXT NOT NULL CHECK (scenario IN (
    'sent', 'failed', 'retry', 'disabled',
    'configuration', 'deduplication', 'workspace_isolation'
  )),
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  delivery_id UUID REFERENCES public.notification_deliveries(id) ON DELETE SET NULL,
  provider_message_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(run_id, channel, scenario),
  CHECK (
    (channel = 'system' AND scenario IN ('configuration', 'deduplication', 'workspace_isolation'))
    OR (channel <> 'system' AND scenario IN ('sent', 'failed', 'retry', 'disabled'))
  ),
  CHECK (jsonb_typeof(details) = 'object'),
  CHECK (pg_column_size(details) <= 16384),
  CHECK (provider_message_id IS NULL OR length(provider_message_id) <= 240)
);

ALTER TABLE public.notification_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_live_acceptance_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_live_acceptance_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_delivery_attempts_admin_select ON public.notification_delivery_attempts;
CREATE POLICY notification_delivery_attempts_admin_select ON public.notification_delivery_attempts
  FOR SELECT TO authenticated USING (public.is_platform_admin());
DROP POLICY IF EXISTS notification_live_acceptance_runs_admin_select ON public.notification_live_acceptance_runs;
CREATE POLICY notification_live_acceptance_runs_admin_select ON public.notification_live_acceptance_runs
  FOR SELECT TO authenticated USING (public.is_platform_admin());
DROP POLICY IF EXISTS notification_live_acceptance_evidence_admin_select ON public.notification_live_acceptance_evidence;
CREATE POLICY notification_live_acceptance_evidence_admin_select ON public.notification_live_acceptance_evidence
  FOR SELECT TO authenticated USING (public.is_platform_admin());

REVOKE ALL ON public.notification_delivery_attempts,
  public.notification_live_acceptance_runs,
  public.notification_live_acceptance_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.notification_delivery_attempts,
  public.notification_live_acceptance_runs,
  public.notification_live_acceptance_evidence TO authenticated;
GRANT ALL ON public.notification_delivery_attempts,
  public.notification_live_acceptance_runs,
  public.notification_live_acceptance_evidence TO service_role;

DROP TRIGGER IF EXISTS notification_live_acceptance_runs_updated_at ON public.notification_live_acceptance_runs;
CREATE TRIGGER notification_live_acceptance_runs_updated_at
  BEFORE UPDATE ON public.notification_live_acceptance_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_notification_attempt_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' AND (SELECT auth.role()) = 'service_role' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'NOTIFICATION_ATTEMPTS_ARE_IMMUTABLE' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS notification_delivery_attempts_immutable ON public.notification_delivery_attempts;
CREATE TRIGGER notification_delivery_attempts_immutable
  BEFORE UPDATE OR DELETE ON public.notification_delivery_attempts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_notification_attempt_mutation();

CREATE OR REPLACE FUNCTION public.claim_notification_deliveries_scoped(
  p_limit INTEGER DEFAULT 25,
  p_delivery_id UUID DEFAULT NULL,
  p_workspace_id UUID DEFAULT NULL,
  p_force BOOLEAN DEFAULT FALSE,
  p_acceptance_run_id UUID DEFAULT NULL
)
RETURNS SETOF public.notification_deliveries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE normalized_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;
  UPDATE public.notification_deliveries AS delivery
  SET status = 'failed', last_error = 'DELIVERY_CLAIM_TIMED_OUT',
      next_attempt_at = CASE WHEN attempt_count < 5 THEN NOW() ELSE NULL END,
      completed_at = NOW(), updated_at = NOW()
  FROM public.notification_events AS event
  WHERE delivery.event_id = event.id AND delivery.status = 'processing'
    AND delivery.updated_at < NOW() - INTERVAL '10 minutes'
    AND (p_workspace_id IS NULL OR event.workspace_id = p_workspace_id)
    AND (p_acceptance_run_id IS NULL OR event.payload->>'acceptance_run_id' = p_acceptance_run_id::TEXT);

  RETURN QUERY
  WITH candidates AS (
    SELECT delivery.id
    FROM public.notification_deliveries AS delivery
    JOIN public.notification_events AS event ON event.id = delivery.event_id
    WHERE (p_delivery_id IS NULL OR delivery.id = p_delivery_id)
      AND (p_workspace_id IS NULL OR event.workspace_id = p_workspace_id)
      AND (p_acceptance_run_id IS NULL OR event.payload->>'acceptance_run_id' = p_acceptance_run_id::TEXT)
      AND delivery.channel <> 'in_app' AND delivery.attempt_count < 5
      AND (
        (delivery.status = 'pending' AND (p_force OR delivery.next_attempt_at IS NULL OR delivery.next_attempt_at <= NOW()))
        OR (delivery.status = 'failed' AND delivery.next_attempt_at IS NOT NULL AND (p_force OR delivery.next_attempt_at <= NOW()))
      )
    ORDER BY delivery.created_at ASC
    FOR UPDATE OF delivery SKIP LOCKED
    LIMIT normalized_limit
  )
  UPDATE public.notification_deliveries AS delivery
  SET status = 'processing', attempt_count = delivery.attempt_count + 1,
      started_at = NOW(), completed_at = NULL, last_error = NULL, updated_at = NOW()
  FROM candidates WHERE delivery.id = candidates.id
  RETURNING delivery.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_notification_live_acceptance_run(
  p_workspace_id UUID, p_started_by UUID, p_approval_reference TEXT
)
RETURNS public.notification_live_acceptance_runs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result public.notification_live_acceptance_runs;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_workspace_id IS NULL OR p_started_by IS NULL OR length(trim(COALESCE(p_approval_reference, ''))) < 3 THEN
    RAISE EXCEPTION 'NOTIFICATION_ACCEPTANCE_INPUT_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = p_started_by)
    OR NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = p_workspace_id) THEN
    RAISE EXCEPTION 'NOTIFICATION_ACCEPTANCE_SCOPE_INVALID' USING ERRCODE = '42501';
  END IF;
  UPDATE public.notification_live_acceptance_runs
  SET status = 'expired', completed_at = COALESCE(completed_at, NOW())
  WHERE workspace_id = p_workspace_id AND status = 'collecting' AND expires_at <= NOW();
  SELECT * INTO result FROM public.notification_live_acceptance_runs
  WHERE workspace_id = p_workspace_id AND status = 'collecting'
  ORDER BY started_at DESC LIMIT 1;
  IF result.id IS NOT NULL THEN RETURN result; END IF;
  INSERT INTO public.notification_live_acceptance_runs(workspace_id, approval_reference, started_by)
  VALUES (p_workspace_id, left(trim(p_approval_reference), 500), p_started_by)
  RETURNING * INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_notification_live_acceptance_evidence(
  p_workspace_id UUID, p_channel TEXT, p_scenario TEXT, p_passed BOOLEAN,
  p_delivery_id UUID DEFAULT NULL, p_provider_message_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb, p_observed_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE active_run UUID; evidence_id UUID;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_workspace_id IS NULL OR p_passed IS NULL
    OR p_channel NOT IN ('email', 'wecom', 'feishu', 'system')
    OR p_scenario NOT IN ('sent', 'failed', 'retry', 'disabled', 'configuration', 'deduplication', 'workspace_isolation') THEN
    RAISE EXCEPTION 'NOTIFICATION_ACCEPTANCE_EVIDENCE_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO active_run FROM public.notification_live_acceptance_runs
  WHERE workspace_id = p_workspace_id AND status = 'collecting' AND expires_at > NOW()
  ORDER BY started_at DESC LIMIT 1 FOR UPDATE;
  IF active_run IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.notification_live_acceptance_evidence(
    run_id, channel, scenario, passed, delivery_id, provider_message_id, details, observed_at
  ) VALUES (
    active_run, p_channel, p_scenario, p_passed, p_delivery_id,
    NULLIF(left(COALESCE(p_provider_message_id, ''), 240), ''),
    COALESCE(p_details, '{}'::jsonb), COALESCE(p_observed_at, NOW())
  )
  ON CONFLICT (run_id, channel, scenario) DO UPDATE SET
    passed = EXCLUDED.passed, delivery_id = EXCLUDED.delivery_id,
    provider_message_id = EXCLUDED.provider_message_id,
    details = EXCLUDED.details, observed_at = EXCLUDED.observed_at
  RETURNING id INTO evidence_id;
  RETURN evidence_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.notification_live_acceptance_readiness(p_run_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSONB;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'run_id', run.id, 'workspace_id', run.workspace_id, 'status', run.status,
    'started_at', run.started_at, 'expires_at', run.expires_at, 'completed_at', run.completed_at,
    'checks', checks.checks,
    'ready', checks.ready AND run.status IN ('collecting', 'passed') AND run.expires_at > NOW()
  ) INTO result
  FROM public.notification_live_acceptance_runs AS run
  CROSS JOIN LATERAL (
    SELECT jsonb_object_agg(required.channel || '.' || required.scenario, COALESCE(evidence.passed, FALSE)) AS checks,
      bool_and(COALESCE(evidence.passed, FALSE)) AS ready
    FROM (VALUES
      ('email','sent'),('email','failed'),('email','retry'),('email','disabled'),
      ('wecom','sent'),('wecom','failed'),('wecom','retry'),('wecom','disabled'),
      ('feishu','sent'),('feishu','failed'),('feishu','retry'),('feishu','disabled'),
      ('system','configuration'),('system','deduplication'),('system','workspace_isolation')
    ) AS required(channel, scenario)
    LEFT JOIN public.notification_live_acceptance_evidence AS evidence
      ON evidence.run_id = run.id AND evidence.channel = required.channel
      AND evidence.scenario = required.scenario
  ) AS checks
  WHERE run.id = p_run_id;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_notification_live_acceptance_run(
  p_run_id UUID, p_completed_by UUID, p_approval_reference TEXT
)
RETURNS public.notification_live_acceptance_runs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE readiness JSONB; result public.notification_live_acceptance_runs;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = p_completed_by)
    OR length(trim(COALESCE(p_approval_reference, ''))) < 3 THEN
    RAISE EXCEPTION 'NOTIFICATION_ACCEPTANCE_APPROVAL_INVALID' USING ERRCODE = '42501';
  END IF;
  readiness := public.notification_live_acceptance_readiness(p_run_id);
  IF readiness IS NULL OR COALESCE((readiness->>'ready')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'NOTIFICATION_ACCEPTANCE_INCOMPLETE' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.notification_live_acceptance_runs
  SET status = 'passed', completed_at = NOW(), completed_by = p_completed_by,
      approval_reference = left(trim(p_approval_reference), 500), evidence_summary = readiness
  WHERE id = p_run_id AND status = 'collecting' AND expires_at > NOW()
  RETURNING * INTO result;
  IF result.id IS NULL THEN
    RAISE EXCEPTION 'NOTIFICATION_ACCEPTANCE_RUN_NOT_COLLECTING' USING ERRCODE = 'P0001';
  END IF;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_notification_attempt_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_notification_deliveries_scoped(INTEGER, UUID, UUID, BOOLEAN, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_notification_live_acceptance_run(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_notification_live_acceptance_evidence(UUID, TEXT, TEXT, BOOLEAN, UUID, TEXT, JSONB, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notification_live_acceptance_readiness(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalize_notification_live_acceptance_run(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_deliveries_scoped(INTEGER, UUID, UUID, BOOLEAN, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_notification_live_acceptance_run(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_notification_live_acceptance_evidence(UUID, TEXT, TEXT, BOOLEAN, UUID, TEXT, JSONB, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.notification_live_acceptance_readiness(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_notification_live_acceptance_run(UUID, UUID, TEXT) TO service_role;

COMMENT ON TABLE public.notification_delivery_attempts IS 'Immutable provider-attempt ledger without message body or webhook credential.';
COMMENT ON TABLE public.notification_live_acceptance_runs IS 'Fail-closed real-channel acceptance gate before public external notifications.';

COMMIT;
