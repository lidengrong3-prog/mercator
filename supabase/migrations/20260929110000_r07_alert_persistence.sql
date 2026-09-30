-- R07: persist policy, platform-rule and activity monitors as real
-- workspace-owned records. The RPC derives the authenticated user, enforces
-- workspace edit permission and rejects duplicate idempotency keys atomically.

BEGIN;

ALTER TABLE public.monitoring_tasks
  ADD COLUMN IF NOT EXISTS source_record_type TEXT,
  ADD COLUMN IF NOT EXISTS source_record_id TEXT,
  ADD COLUMN IF NOT EXISTS source_title TEXT,
  ADD COLUMN IF NOT EXISTS monitor_conditions JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS acceptance_run_id TEXT;

ALTER TABLE public.monitoring_tasks
  DROP CONSTRAINT IF EXISTS monitoring_tasks_task_type_check;
ALTER TABLE public.monitoring_tasks
  ADD CONSTRAINT monitoring_tasks_task_type_check
  CHECK (task_type IN ('keyword', 'product', 'shop', 'policy', 'rule', 'activity'));

ALTER TABLE public.monitoring_tasks
  DROP CONSTRAINT IF EXISTS monitoring_tasks_check;
ALTER TABLE public.monitoring_tasks
  ADD CONSTRAINT monitoring_tasks_target_check CHECK (
    (task_type = 'keyword' AND keyword IS NOT NULL AND target_entity_id IS NULL)
    OR (task_type IN ('product', 'shop') AND (target_entity_id IS NOT NULL OR target_external_id IS NOT NULL))
    OR (task_type IN ('policy', 'rule', 'activity')
      AND source_record_type = task_type
      AND NULLIF(trim(source_record_id), '') IS NOT NULL)
  );

UPDATE public.monitoring_tasks
SET idempotency_key = 'legacy:' || id::TEXT
WHERE idempotency_key IS NULL OR trim(idempotency_key) = '';

ALTER TABLE public.monitoring_tasks
  ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_monitoring_tasks_idempotency
  ON public.monitoring_tasks(workspace_id, idempotency_key);
DROP INDEX IF EXISTS public.idx_monitoring_tasks_identity;
CREATE UNIQUE INDEX idx_monitoring_tasks_identity
  ON public.monitoring_tasks(
    workspace_id, task_type, market_code, platform_key,
    COALESCE(keyword, ''), COALESCE(target_entity_id::TEXT, ''), COALESCE(target_external_id, '')
  )
  WHERE task_type IN ('keyword', 'product', 'shop');
CREATE INDEX IF NOT EXISTS idx_monitoring_tasks_source_record
  ON public.monitoring_tasks(workspace_id, source_record_type, source_record_id)
  WHERE source_record_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_monitoring_tasks_acceptance_run
  ON public.monitoring_tasks(acceptance_run_id)
  WHERE acceptance_run_id IS NOT NULL;

DROP TRIGGER IF EXISTS monitoring_tasks_updated_at ON public.monitoring_tasks;
CREATE TRIGGER monitoring_tasks_updated_at
  BEFORE UPDATE ON public.monitoring_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.create_record_monitor(
  p_workspace_id UUID,
  p_source_record_type TEXT,
  p_source_record_id TEXT,
  p_source_title TEXT,
  p_market_code TEXT,
  p_platform_key TEXT,
  p_category_code TEXT DEFAULT NULL,
  p_monitor_conditions JSONB DEFAULT '{}'::JSONB,
  p_acceptance_run_id TEXT DEFAULT NULL
)
RETURNS public.monitoring_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_type TEXT := lower(trim(COALESCE(p_source_record_type, '')));
  normalized_record_id TEXT := left(trim(COALESCE(p_source_record_id, '')), 500);
  normalized_market TEXT := upper(left(trim(COALESCE(p_market_code, '')), 40));
  normalized_platform TEXT := lower(left(trim(COALESCE(p_platform_key, '')), 120));
  normalized_conditions JSONB := COALESCE(p_monitor_conditions, '{}'::JSONB);
  monitor_key TEXT;
  result public.monitoring_tasks%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;
  IF p_workspace_id IS NULL OR NOT public.can_edit_workspace(p_workspace_id) THEN
    RAISE EXCEPTION 'WORKSPACE_READ_ONLY' USING ERRCODE = '42501';
  END IF;
  IF normalized_type NOT IN ('policy', 'rule', 'activity') THEN
    RAISE EXCEPTION 'MONITOR_SOURCE_TYPE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF normalized_record_id = '' OR normalized_market = '' OR normalized_platform = '' THEN
    RAISE EXCEPTION 'MONITOR_SOURCE_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(normalized_conditions) <> 'object' THEN
    RAISE EXCEPTION 'MONITOR_CONDITIONS_INVALID' USING ERRCODE = '22023';
  END IF;

  monitor_key := 'record:' || md5(concat_ws('|',
    normalized_type, normalized_record_id, normalized_market,
    normalized_platform, normalized_conditions::TEXT
  ));

  INSERT INTO public.monitoring_tasks (
    workspace_id, created_by, task_type, market_code, platform_key,
    category_code, target_external_id, status, next_run_at,
    source_record_type, source_record_id, source_title, monitor_conditions,
    idempotency_key, acceptance_run_id
  ) VALUES (
    p_workspace_id, auth.uid(), normalized_type, normalized_market, normalized_platform,
    NULLIF(left(trim(COALESCE(p_category_code, '')), 120), ''), normalized_record_id,
    'active', 'infinity'::TIMESTAMPTZ, normalized_type, normalized_record_id,
    left(trim(COALESCE(p_source_title, '')), 500), normalized_conditions, monitor_key,
    NULLIF(left(trim(COALESCE(p_acceptance_run_id, '')), 160), '')
  )
  ON CONFLICT (workspace_id, idempotency_key) DO NOTHING
  RETURNING * INTO result;

  IF result.id IS NULL THEN
    RAISE EXCEPTION 'MONITOR_ALREADY_EXISTS' USING ERRCODE = 'P0001';
  END IF;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_record_monitor(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_record_monitor(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) TO authenticated;

COMMENT ON COLUMN public.monitoring_tasks.idempotency_key IS
  'Server-derived identity for one workspace/source/condition monitor; duplicate requests are rejected.';
COMMENT ON COLUMN public.monitoring_tasks.monitor_conditions IS
  'Non-sensitive structured conditions such as source update, effective-date or status changes.';
COMMENT ON FUNCTION public.create_record_monitor(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) IS
  'Creates one authenticated workspace record monitor and rejects duplicate idempotency keys atomically.';

COMMIT;
