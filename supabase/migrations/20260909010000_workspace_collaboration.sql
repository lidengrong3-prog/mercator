-- Make collaborative business data belong to a workspace instead of only to
-- the account that created it. The creator remains on each row for audit.

BEGIN;

CREATE OR REPLACE FUNCTION public.can_edit_workspace(
  p_workspace_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.workspace_role(p_workspace_id, p_user_id) IN ('owner', 'admin', 'editor');
$$;

ALTER TABLE public.generated_reports
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.report_materials
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.user_watchlist
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.saved_workspace_items
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Existing rows remain in the creator's first workspace. Joining another team
-- never moves a user's historical private data into that team's workspace.
UPDATE public.generated_reports AS target
SET workspace_id = (
  SELECT member.workspace_id
  FROM public.workspace_members AS member
  WHERE member.user_id = target.user_id AND member.status = 'active'
  ORDER BY (member.role = 'owner') DESC, member.joined_at ASC
  LIMIT 1
)
WHERE target.workspace_id IS NULL;

UPDATE public.report_materials AS target
SET workspace_id = (
  SELECT member.workspace_id
  FROM public.workspace_members AS member
  WHERE member.user_id = target.user_id AND member.status = 'active'
  ORDER BY (member.role = 'owner') DESC, member.joined_at ASC
  LIMIT 1
)
WHERE target.workspace_id IS NULL;

UPDATE public.user_watchlist AS target
SET workspace_id = (
  SELECT member.workspace_id
  FROM public.workspace_members AS member
  WHERE member.user_id = target.user_id AND member.status = 'active'
  ORDER BY (member.role = 'owner') DESC, member.joined_at ASC
  LIMIT 1
)
WHERE target.workspace_id IS NULL;

UPDATE public.saved_workspace_items AS target
SET workspace_id = (
  SELECT member.workspace_id
  FROM public.workspace_members AS member
  WHERE member.user_id = target.user_id AND member.status = 'active'
  ORDER BY (member.role = 'owner') DESC, member.joined_at ASC
  LIMIT 1
)
WHERE target.workspace_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.generated_reports WHERE workspace_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.report_materials WHERE workspace_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.user_watchlist WHERE workspace_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.saved_workspace_items WHERE workspace_id IS NULL)
  THEN
    RAISE EXCEPTION 'workspace collaboration backfill failed: user row has no active workspace';
  END IF;
END;
$$;

ALTER TABLE public.generated_reports ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.report_materials ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.user_watchlist ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.saved_workspace_items ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE public.workspace_invites
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_provider TEXT,
  ADD COLUMN IF NOT EXISTS delivery_message_id TEXT,
  ADD COLUMN IF NOT EXISTS delivery_error TEXT,
  ADD COLUMN IF NOT EXISTS delivery_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_delivery_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

ALTER TABLE public.workspace_invites
  DROP CONSTRAINT IF EXISTS workspace_invites_delivery_status_check;
ALTER TABLE public.workspace_invites
  ADD CONSTRAINT workspace_invites_delivery_status_check
  CHECK (delivery_status IN ('pending', 'sending', 'sent', 'failed'));
ALTER TABLE public.workspace_invites
  DROP CONSTRAINT IF EXISTS workspace_invites_delivery_attempts_check;
ALTER TABLE public.workspace_invites
  ADD CONSTRAINT workspace_invites_delivery_attempts_check
  CHECK (delivery_attempts >= 0 AND delivery_attempts <= 100);

ALTER TABLE public.user_watchlist
  DROP CONSTRAINT IF EXISTS user_watchlist_user_id_item_type_item_id_key;
ALTER TABLE public.report_materials
  DROP CONSTRAINT IF EXISTS report_materials_user_id_client_id_key;
ALTER TABLE public.saved_workspace_items
  DROP CONSTRAINT IF EXISTS saved_workspace_items_user_id_item_type_client_id_key;
DROP INDEX IF EXISTS public.idx_generated_reports_user_client;

CREATE UNIQUE INDEX IF NOT EXISTS idx_generated_reports_workspace_client
  ON public.generated_reports(workspace_id, client_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_materials_workspace_client
  ON public.report_materials(workspace_id, client_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_watchlist_workspace_item
  ON public.user_watchlist(workspace_id, item_type, item_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_workspace_items_workspace_type
  ON public.saved_workspace_items(workspace_id, item_type, client_id);

CREATE INDEX IF NOT EXISTS idx_generated_reports_workspace_created
  ON public.generated_reports(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_materials_workspace_created
  ON public.report_materials(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_watchlist_workspace_created
  ON public.user_watchlist(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_workspace_items_workspace_updated
  ON public.saved_workspace_items(workspace_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.guard_workspace_business_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
  ) THEN
    RAISE EXCEPTION 'workspace_id and creator cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_generated_reports_workspace_identity ON public.generated_reports;
CREATE TRIGGER guard_generated_reports_workspace_identity
  BEFORE UPDATE ON public.generated_reports
  FOR EACH ROW EXECUTE FUNCTION public.guard_workspace_business_identity();
DROP TRIGGER IF EXISTS guard_report_materials_workspace_identity ON public.report_materials;
CREATE TRIGGER guard_report_materials_workspace_identity
  BEFORE UPDATE ON public.report_materials
  FOR EACH ROW EXECUTE FUNCTION public.guard_workspace_business_identity();
DROP TRIGGER IF EXISTS guard_user_watchlist_workspace_identity ON public.user_watchlist;
CREATE TRIGGER guard_user_watchlist_workspace_identity
  BEFORE UPDATE ON public.user_watchlist
  FOR EACH ROW EXECUTE FUNCTION public.guard_workspace_business_identity();
DROP TRIGGER IF EXISTS guard_saved_workspace_items_workspace_identity ON public.saved_workspace_items;
CREATE TRIGGER guard_saved_workspace_items_workspace_identity
  BEFORE UPDATE ON public.saved_workspace_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_workspace_business_identity();

-- Replace account-only policies with workspace membership and role policies.
DROP POLICY IF EXISTS generated_reports_select_own ON public.generated_reports;
DROP POLICY IF EXISTS generated_reports_insert_draft_own ON public.generated_reports;
DROP POLICY IF EXISTS generated_reports_update_draft_own ON public.generated_reports;
DROP POLICY IF EXISTS generated_reports_delete_own ON public.generated_reports;
CREATE POLICY generated_reports_select_workspace ON public.generated_reports
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY generated_reports_insert_workspace_draft ON public.generated_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_edit_workspace(workspace_id)
    AND publication_status = 'draft'
    AND save_status <> 'saved'
    AND server_validation_version IS NULL
    AND server_validated_at IS NULL
    AND server_validation IS NULL
    AND COALESCE(content->'publishable', 'false'::jsonb) <> 'true'::jsonb
  );
CREATE POLICY generated_reports_update_workspace_draft ON public.generated_reports
  FOR UPDATE TO authenticated
  USING (
    public.can_edit_workspace(workspace_id)
    AND publication_status = 'draft'
    AND save_status <> 'saved'
    AND server_validation_version IS NULL
    AND server_validated_at IS NULL
    AND server_validation IS NULL
    AND COALESCE(content->'publishable', 'false'::jsonb) <> 'true'::jsonb
  )
  WITH CHECK (
    public.can_edit_workspace(workspace_id)
    AND publication_status = 'draft'
    AND save_status <> 'saved'
    AND server_validation_version IS NULL
    AND server_validated_at IS NULL
    AND server_validation IS NULL
    AND COALESCE(content->'publishable', 'false'::jsonb) <> 'true'::jsonb
  );
CREATE POLICY generated_reports_delete_workspace ON public.generated_reports
  FOR DELETE TO authenticated
  USING (public.can_edit_workspace(workspace_id));

DROP POLICY IF EXISTS report_materials_select_own ON public.report_materials;
DROP POLICY IF EXISTS report_materials_insert_own ON public.report_materials;
DROP POLICY IF EXISTS report_materials_update_own ON public.report_materials;
DROP POLICY IF EXISTS report_materials_delete_own ON public.report_materials;
CREATE POLICY report_materials_select_workspace ON public.report_materials
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY report_materials_insert_workspace ON public.report_materials
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_edit_workspace(workspace_id));
CREATE POLICY report_materials_update_workspace ON public.report_materials
  FOR UPDATE TO authenticated
  USING (public.can_edit_workspace(workspace_id))
  WITH CHECK (public.can_edit_workspace(workspace_id));
CREATE POLICY report_materials_delete_workspace ON public.report_materials
  FOR DELETE TO authenticated USING (public.can_edit_workspace(workspace_id));

DROP POLICY IF EXISTS user_watchlist_select_own ON public.user_watchlist;
DROP POLICY IF EXISTS user_watchlist_insert_own ON public.user_watchlist;
DROP POLICY IF EXISTS user_watchlist_update_own ON public.user_watchlist;
DROP POLICY IF EXISTS user_watchlist_delete_own ON public.user_watchlist;
CREATE POLICY user_watchlist_select_workspace ON public.user_watchlist
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY user_watchlist_insert_workspace ON public.user_watchlist
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_edit_workspace(workspace_id));
CREATE POLICY user_watchlist_update_workspace ON public.user_watchlist
  FOR UPDATE TO authenticated
  USING (public.can_edit_workspace(workspace_id))
  WITH CHECK (public.can_edit_workspace(workspace_id));
CREATE POLICY user_watchlist_delete_workspace ON public.user_watchlist
  FOR DELETE TO authenticated USING (public.can_edit_workspace(workspace_id));

DROP POLICY IF EXISTS saved_workspace_items_select_own ON public.saved_workspace_items;
DROP POLICY IF EXISTS saved_workspace_items_insert_own ON public.saved_workspace_items;
DROP POLICY IF EXISTS saved_workspace_items_update_own ON public.saved_workspace_items;
DROP POLICY IF EXISTS saved_workspace_items_delete_own ON public.saved_workspace_items;
CREATE POLICY saved_workspace_items_select_workspace ON public.saved_workspace_items
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY saved_workspace_items_insert_workspace ON public.saved_workspace_items
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_edit_workspace(workspace_id));
CREATE POLICY saved_workspace_items_update_workspace ON public.saved_workspace_items
  FOR UPDATE TO authenticated
  USING (public.can_edit_workspace(workspace_id))
  WITH CHECK (public.can_edit_workspace(workspace_id));
CREATE POLICY saved_workspace_items_delete_workspace ON public.saved_workspace_items
  FOR DELETE TO authenticated USING (public.can_edit_workspace(workspace_id));

REVOKE ALL ON FUNCTION public.can_edit_workspace(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_workspace(UUID, UUID) TO authenticated;

COMMENT ON COLUMN public.generated_reports.workspace_id IS 'Workspace sharing boundary; user_id is the creating account.';
COMMENT ON COLUMN public.report_materials.workspace_id IS 'Workspace sharing boundary; user_id is the creating account.';
COMMENT ON COLUMN public.user_watchlist.workspace_id IS 'Workspace sharing boundary; user_id is the creating account.';
COMMENT ON COLUMN public.saved_workspace_items.workspace_id IS 'Workspace sharing boundary; user_id is the creating account.';
COMMENT ON COLUMN public.workspace_invites.delivery_status IS 'Transactional invitation email delivery state, separate from invite acceptance status.';

COMMIT;
