-- User-owned monitoring intents for keywords, products and shops. Collection
-- Workers consume these rows to enqueue scoped provider tasks; the target
-- entity/snapshot tables remain immutable and are never overwritten.

BEGIN;

CREATE TABLE IF NOT EXISTS public.monitoring_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  task_type TEXT NOT NULL CHECK (task_type IN ('keyword', 'product', 'shop')),
  market_code TEXT NOT NULL,
  platform_key TEXT NOT NULL,
  category_code TEXT,
  keyword TEXT,
  target_entity_id UUID,
  target_external_id TEXT,
  cadence_per_day SMALLINT NOT NULL DEFAULT 1 CHECK (cadence_per_day BETWEEN 1 AND 4),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'failed', 'expired', 'blocked')),
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_status TEXT,
  last_error TEXT,
  missing_fields TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((task_type = 'keyword' AND keyword IS NOT NULL AND target_entity_id IS NULL)
      OR (task_type IN ('product', 'shop') AND (target_entity_id IS NOT NULL OR target_external_id IS NOT NULL))),
  CHECK (keyword IS NULL OR length(keyword) BETWEEN 1 AND 120)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_monitoring_tasks_identity
  ON public.monitoring_tasks(
    workspace_id, task_type, market_code, platform_key,
    COALESCE(keyword, ''), COALESCE(target_entity_id::TEXT, ''), COALESCE(target_external_id, '')
  );
CREATE INDEX IF NOT EXISTS idx_monitoring_tasks_due
  ON public.monitoring_tasks(status, next_run_at)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_monitoring_tasks_workspace
  ON public.monitoring_tasks(workspace_id, created_at DESC);

ALTER TABLE public.monitoring_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.monitoring_tasks FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_tasks TO authenticated;
GRANT ALL ON public.monitoring_tasks TO service_role;

DROP POLICY IF EXISTS monitoring_tasks_workspace_read ON public.monitoring_tasks;
CREATE POLICY monitoring_tasks_workspace_read ON public.monitoring_tasks
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS monitoring_tasks_workspace_write ON public.monitoring_tasks;
CREATE POLICY monitoring_tasks_workspace_write ON public.monitoring_tasks
  FOR ALL TO authenticated USING (public.can_edit_workspace(workspace_id))
  WITH CHECK (public.can_edit_workspace(workspace_id) AND created_by = auth.uid());

COMMENT ON TABLE public.monitoring_tasks IS
  'Workspace-owned keyword/product/shop monitoring intents; execution is separately rate-limited and source-governed.';

COMMIT;
