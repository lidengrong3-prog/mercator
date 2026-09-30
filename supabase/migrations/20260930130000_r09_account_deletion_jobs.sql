-- R09: durable account/workspace deletion jobs and bounded async-task TTLs.
-- Job metadata is operational only: no prompts, response bodies, secrets, or
-- complete user payloads are stored in these ledgers.
BEGIN;

CREATE TABLE IF NOT EXISTS public.data_deletion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES public.data_subject_requests(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL,
  workspace_id UUID,
  job_type TEXT NOT NULL CHECK (job_type IN ('delete_account', 'delete_workspace')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'retry_wait', 'completed', 'failed', 'cancelled')),
  idempotency_key TEXT NOT NULL,
  current_step TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 50 CHECK (max_attempts BETWEEN 1 AND 200),
  batch_size INTEGER NOT NULL DEFAULT 250 CHECK (batch_size BETWEEN 1 AND 1000),
  lease_token UUID,
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  deleted_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  failed_objects JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_error_code TEXT,
  last_error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (requester_id, job_type, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_deletion_jobs_active_target
  ON public.data_deletion_jobs (
    requester_id,
    job_type,
    COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::UUID)
  )
  WHERE status IN ('queued', 'processing', 'retry_wait');
CREATE INDEX IF NOT EXISTS idx_data_deletion_jobs_claim
  ON public.data_deletion_jobs(status, next_attempt_at, lease_expires_at, created_at);

CREATE TABLE IF NOT EXISTS public.data_deletion_job_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.data_deletion_jobs(id) ON DELETE CASCADE,
  sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
  step_key TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('preflight', 'storage_prefix', 'storage_exports', 'table', 'auth_user')),
  resource_name TEXT,
  filter_column TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  deleted_count BIGINT NOT NULL DEFAULT 0 CHECK (deleted_count >= 0),
  cursor JSONB NOT NULL DEFAULT '{}'::jsonb,
  failed_objects JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_error_code TEXT,
  last_error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, sequence_no),
  UNIQUE (job_id, step_key)
);
CREATE INDEX IF NOT EXISTS idx_data_deletion_job_steps_pending
  ON public.data_deletion_job_steps(job_id, status, sequence_no);

ALTER TABLE public.data_deletion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_deletion_job_steps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.data_deletion_jobs, public.data_deletion_job_steps FROM anon, authenticated;
GRANT ALL ON public.data_deletion_jobs, public.data_deletion_job_steps TO service_role;
GRANT SELECT ON public.data_deletion_jobs, public.data_deletion_job_steps TO authenticated;

DROP POLICY IF EXISTS data_deletion_jobs_select_own ON public.data_deletion_jobs;
CREATE POLICY data_deletion_jobs_select_own ON public.data_deletion_jobs
  FOR SELECT TO authenticated USING (requester_id = auth.uid());
DROP POLICY IF EXISTS data_deletion_job_steps_select_own ON public.data_deletion_job_steps;
CREATE POLICY data_deletion_job_steps_select_own ON public.data_deletion_job_steps
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.data_deletion_jobs job
    WHERE job.id = data_deletion_job_steps.job_id AND job.requester_id = auth.uid()
  ));

ALTER TABLE public.report_runs
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS retry_of UUID REFERENCES public.report_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;
UPDATE public.report_runs
SET expires_at = COALESCE(expires_at, started_at + INTERVAL '30 minutes'),
    last_heartbeat_at = COALESCE(last_heartbeat_at, started_at)
WHERE expires_at IS NULL OR last_heartbeat_at IS NULL;
ALTER TABLE public.report_runs ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '30 minutes');
ALTER TABLE public.report_runs ALTER COLUMN expires_at SET NOT NULL;
ALTER TABLE public.report_runs ALTER COLUMN last_heartbeat_at SET DEFAULT NOW();
ALTER TABLE public.report_runs ALTER COLUMN last_heartbeat_at SET NOT NULL;
ALTER TABLE public.report_runs
  DROP CONSTRAINT IF EXISTS report_runs_attempt_count_check,
  DROP CONSTRAINT IF EXISTS report_runs_max_attempts_check;
ALTER TABLE public.report_runs
  ADD CONSTRAINT report_runs_attempt_count_check CHECK (attempt_count BETWEEN 1 AND 100),
  ADD CONSTRAINT report_runs_max_attempts_check CHECK (max_attempts BETWEEN 1 AND 100);
CREATE INDEX IF NOT EXISTS idx_report_runs_ttl
  ON public.report_runs(status, expires_at) WHERE status = 'running';

CREATE TABLE IF NOT EXISTS public.ai_async_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  requested_provider TEXT,
  final_provider TEXT,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed', 'cancelled')),
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count BETWEEN 1 AND 100),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 100),
  retry_of UUID REFERENCES public.ai_async_tasks(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 minutes'),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_code TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, request_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_async_tasks_ttl
  ON public.ai_async_tasks(status, expires_at) WHERE status = 'processing';
ALTER TABLE public.ai_async_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_async_tasks FROM anon, authenticated;
GRANT ALL ON public.ai_async_tasks TO service_role;
GRANT SELECT ON public.ai_async_tasks TO authenticated;
DROP POLICY IF EXISTS ai_async_tasks_select_workspace ON public.ai_async_tasks;
CREATE POLICY ai_async_tasks_select_workspace ON public.ai_async_tasks
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));

CREATE OR REPLACE FUNCTION public.r09_enqueue_data_deletion_job(
  p_request_id UUID, p_requester_id UUID, p_workspace_id UUID,
  p_job_type TEXT, p_idempotency_key TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing_job public.data_deletion_jobs%ROWTYPE; created_job public.data_deletion_jobs%ROWTYPE;
BEGIN
  IF p_request_id IS NULL OR p_requester_id IS NULL
    OR p_job_type NOT IN ('delete_account', 'delete_workspace')
    OR COALESCE(length(trim(p_idempotency_key)), 0) < 8 THEN
    RAISE EXCEPTION 'DELETION_JOB_ARGUMENT_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_job_type = 'delete_workspace' AND p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'WORKSPACE_REQUIRED' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_requester_id::TEXT || ':' || p_job_type || ':' || COALESCE(p_workspace_id::TEXT, 'account'), 0));
  SELECT * INTO existing_job FROM public.data_deletion_jobs
  WHERE requester_id = p_requester_id AND job_type = p_job_type
    AND workspace_id IS NOT DISTINCT FROM p_workspace_id
    AND status IN ('queued', 'processing', 'retry_wait')
  ORDER BY created_at ASC LIMIT 1;
  IF FOUND THEN RETURN to_jsonb(existing_job) || jsonb_build_object('duplicate', TRUE); END IF;
  SELECT * INTO existing_job FROM public.data_deletion_jobs WHERE request_id = p_request_id;
  IF FOUND THEN RETURN to_jsonb(existing_job) || jsonb_build_object('duplicate', TRUE); END IF;
  INSERT INTO public.data_deletion_jobs
    (request_id, requester_id, workspace_id, job_type, idempotency_key)
  VALUES (p_request_id, p_requester_id, p_workspace_id, p_job_type, left(trim(p_idempotency_key), 160))
  RETURNING * INTO created_job;
  IF p_job_type = 'delete_account' THEN
    INSERT INTO public.data_deletion_job_steps
      (job_id, sequence_no, step_key, operation, resource_name, filter_column)
    VALUES
      (created_job.id, 10, 'preflight_owned_workspaces', 'preflight', 'workspaces', 'owner_id'),
      (created_job.id, 20, 'storage_user_files', 'storage_prefix', 'reports', NULL),
      (created_job.id, 30, 'db_sales_leads', 'table', 'sales_leads', 'user_id'),
      (created_job.id, 40, 'db_saved_workspace_items', 'table', 'saved_workspace_items', 'user_id'),
      (created_job.id, 50, 'db_user_feedback', 'table', 'user_feedback', 'user_id'),
      (created_job.id, 60, 'db_report_materials', 'table', 'report_materials', 'user_id'),
      (created_job.id, 70, 'db_report_exports', 'table', 'report_exports', 'user_id'),
      (created_job.id, 80, 'db_ai_provider_attempt_logs', 'table', 'ai_provider_attempt_logs', 'user_id'),
      (created_job.id, 90, 'db_ai_request_logs', 'table', 'ai_request_logs', 'user_id'),
      (created_job.id, 100, 'db_report_runs', 'table', 'report_runs', 'user_id'),
      (created_job.id, 110, 'db_generated_reports', 'table', 'generated_reports', 'user_id'),
      (created_job.id, 120, 'db_user_activity', 'table', 'user_activity', 'user_id'),
      (created_job.id, 130, 'db_user_watchlist', 'table', 'user_watchlist', 'user_id'),
      (created_job.id, 140, 'db_monitoring_tasks', 'table', 'monitoring_tasks', 'user_id'),
      (created_job.id, 150, 'db_monitored_shops', 'table', 'monitored_shops', 'user_id'),
      (created_job.id, 160, 'db_feedback', 'table', 'feedback', 'user_id'),
      (created_job.id, 170, 'db_reports', 'table', 'reports', 'user_id'),
      (created_job.id, 180, 'db_watchlist_items', 'table', 'watchlist_items', 'user_id'),
      (created_job.id, 190, 'db_query_history', 'table', 'query_history', 'user_id'),
      (created_job.id, 200, 'db_workspace_invites', 'table', 'workspace_invites', 'invited_by'),
      (created_job.id, 210, 'db_workspace_members', 'table', 'workspace_members', 'user_id'),
      (created_job.id, 220, 'db_user_preferences', 'table', 'user_preferences', 'user_id'),
      (created_job.id, 230, 'db_profiles', 'table', 'profiles', 'id'),
      (created_job.id, 240, 'auth_user', 'auth_user', 'auth.users', 'id');
  ELSE
    INSERT INTO public.data_deletion_job_steps
      (job_id, sequence_no, step_key, operation, resource_name, filter_column)
    VALUES
      (created_job.id, 10, 'storage_workspace_exports', 'storage_exports', 'reports', NULL),
      (created_job.id, 20, 'db_ai_provider_attempt_logs', 'table', 'ai_provider_attempt_logs', 'workspace_id'),
      (created_job.id, 30, 'db_ai_request_logs', 'table', 'ai_request_logs', 'workspace_id'),
      (created_job.id, 40, 'db_report_exports', 'table', 'report_exports', 'workspace_id'),
      (created_job.id, 50, 'db_report_materials', 'table', 'report_materials', 'workspace_id'),
      (created_job.id, 60, 'db_report_runs', 'table', 'report_runs', 'workspace_id'),
      (created_job.id, 70, 'db_generated_reports', 'table', 'generated_reports', 'workspace_id'),
      (created_job.id, 80, 'db_saved_workspace_items', 'table', 'saved_workspace_items', 'workspace_id'),
      (created_job.id, 90, 'db_user_watchlist', 'table', 'user_watchlist', 'workspace_id'),
      (created_job.id, 100, 'db_monitoring_tasks', 'table', 'monitoring_tasks', 'workspace_id'),
      (created_job.id, 110, 'db_monitored_shops', 'table', 'monitored_shops', 'workspace_id'),
      (created_job.id, 120, 'db_sales_leads', 'table', 'sales_leads', 'workspace_id'),
      (created_job.id, 130, 'db_workspace_invites', 'table', 'workspace_invites', 'workspace_id'),
      (created_job.id, 140, 'db_workspace_members', 'table', 'workspace_members', 'workspace_id'),
      (created_job.id, 150, 'db_workspace_usage_monthly', 'table', 'workspace_usage_monthly', 'workspace_id'),
      (created_job.id, 160, 'db_workspaces', 'table', 'workspaces', 'id');
  END IF;
  UPDATE public.data_subject_requests SET status = 'processing',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('job_id', created_job.id),
    error_code = NULL, error_message = NULL WHERE id = p_request_id;
  RETURN to_jsonb(created_job) || jsonb_build_object('duplicate', FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.r09_claim_data_deletion_job(p_worker_id TEXT, p_lease_seconds INTEGER DEFAULT 90)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  claimed_job public.data_deletion_jobs%ROWTYPE;
  claimed_step public.data_deletion_job_steps%ROWTYPE;
  token UUID := gen_random_uuid();
  lease_seconds INTEGER := GREATEST(30, LEAST(COALESCE(p_lease_seconds, 90), 300));
BEGIN
  UPDATE public.data_deletion_job_steps step SET status = 'pending', updated_at = NOW()
  FROM public.data_deletion_jobs job
  WHERE step.job_id = job.id AND step.status = 'processing'
    AND job.status = 'processing' AND job.lease_expires_at <= NOW();
  UPDATE public.data_deletion_jobs
  SET status = CASE WHEN attempt_count >= max_attempts OR expires_at <= NOW() THEN 'failed' ELSE 'retry_wait' END,
      next_attempt_at = NOW(), lease_token = NULL, lease_owner = NULL, lease_expires_at = NULL,
      last_error_code = 'DELETION_WORKER_LEASE_EXPIRED',
      last_error_message = 'Worker lease expired before the step was acknowledged',
      completed_at = CASE WHEN attempt_count >= max_attempts OR expires_at <= NOW() THEN NOW() ELSE completed_at END,
      updated_at = NOW()
  WHERE status = 'processing' AND lease_expires_at <= NOW();
  UPDATE public.data_subject_requests request
  SET status = 'failed', completed_at = NOW(), error_code = job.last_error_code, error_message = job.last_error_message
  FROM public.data_deletion_jobs job
  WHERE request.id = job.request_id AND job.status = 'failed' AND request.status = 'processing';
  SELECT * INTO claimed_job FROM public.data_deletion_jobs
  WHERE status IN ('queued', 'retry_wait') AND next_attempt_at <= NOW()
    AND expires_at > NOW() AND attempt_count < max_attempts
  ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO claimed_step FROM public.data_deletion_job_steps
  WHERE job_id = claimed_job.id AND status IN ('pending', 'processing')
  ORDER BY sequence_no ASC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    UPDATE public.data_deletion_jobs SET status = 'completed', completed_at = NOW(), updated_at = NOW(), lease_token = NULL
    WHERE id = claimed_job.id;
    UPDATE public.data_subject_requests SET status = 'completed', completed_at = NOW() WHERE id = claimed_job.request_id;
    RETURN NULL;
  END IF;
  UPDATE public.data_deletion_jobs
  SET status = 'processing', current_step = claimed_step.step_key, attempt_count = attempt_count + 1,
      started_at = COALESCE(started_at, NOW()), lease_token = token,
      lease_owner = left(COALESCE(p_worker_id, 'worker'), 160),
      lease_expires_at = NOW() + make_interval(secs => lease_seconds), updated_at = NOW()
  WHERE id = claimed_job.id RETURNING * INTO claimed_job;
  UPDATE public.data_deletion_job_steps
  SET status = 'processing', attempt_count = attempt_count + 1,
      started_at = COALESCE(started_at, NOW()), updated_at = NOW()
  WHERE id = claimed_step.id RETURNING * INTO claimed_step;
  RETURN jsonb_build_object(
    'job_id', claimed_job.id, 'request_id', claimed_job.request_id,
    'requester_id', claimed_job.requester_id, 'workspace_id', claimed_job.workspace_id,
    'job_type', claimed_job.job_type, 'batch_size', claimed_job.batch_size,
    'lease_token', token, 'step_key', claimed_step.step_key,
    'operation', claimed_step.operation, 'resource_name', claimed_step.resource_name,
    'filter_column', claimed_step.filter_column, 'cursor', claimed_step.cursor,
    'step_attempt_count', claimed_step.attempt_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.r09_delete_data_batch(
  p_job_id UUID, p_lease_token UUID, p_step_key TEXT, p_batch_size INTEGER DEFAULT 250)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  job public.data_deletion_jobs%ROWTYPE; step public.data_deletion_job_steps%ROWTYPE;
  target UUID; deleted_count BIGINT := 0; remaining BOOLEAN := FALSE; relation_name TEXT;
BEGIN
  SELECT * INTO job FROM public.data_deletion_jobs
  WHERE id = p_job_id AND status = 'processing' AND lease_token = p_lease_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DELETION_JOB_LEASE_LOST' USING ERRCODE = '40001'; END IF;
  SELECT * INTO step FROM public.data_deletion_job_steps
  WHERE job_id = p_job_id AND step_key = p_step_key AND operation = 'table' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DELETION_STEP_INVALID' USING ERRCODE = '22023'; END IF;
  target := CASE WHEN job.job_type = 'delete_account' THEN job.requester_id ELSE job.workspace_id END;
  relation_name := 'public.' || quote_ident(step.resource_name);
  IF to_regclass(relation_name) IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass(relation_name)
      AND attname = step.filter_column AND NOT attisdropped) THEN
    RETURN jsonb_build_object('deleted_count', 0, 'remaining', FALSE, 'skipped', TRUE);
  END IF;
  EXECUTE format(
    'WITH doomed AS (SELECT ctid FROM %s WHERE %I = $1 LIMIT $2), deleted AS (DELETE FROM %s WHERE ctid IN (SELECT ctid FROM doomed) RETURNING 1) SELECT count(*) FROM deleted',
    relation_name, step.filter_column, relation_name)
  INTO deleted_count USING target, GREATEST(1, LEAST(COALESCE(p_batch_size, 250), 1000));
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE %I = $1)', relation_name, step.filter_column)
    INTO remaining USING target;
  RETURN jsonb_build_object('deleted_count', deleted_count, 'remaining', remaining, 'skipped', FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.r09_list_storage_batch(
  p_job_id UUID, p_lease_token UUID, p_step_key TEXT,
  p_after TEXT DEFAULT '', p_batch_size INTEGER DEFAULT 250)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage AS $$
DECLARE
  job public.data_deletion_jobs%ROWTYPE;
  step public.data_deletion_job_steps%ROWTYPE;
  paths JSONB := '[]'::jsonb;
  next_cursor TEXT := '';
  remaining BOOLEAN := FALSE;
  normalized_after TEXT := COALESCE(p_after, '');
  normalized_limit INTEGER := GREATEST(1, LEAST(COALESCE(p_batch_size, 250), 1000));
BEGIN
  SELECT * INTO job FROM public.data_deletion_jobs
  WHERE id = p_job_id AND status = 'processing' AND lease_token = p_lease_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DELETION_JOB_LEASE_LOST' USING ERRCODE = '40001'; END IF;
  SELECT * INTO step FROM public.data_deletion_job_steps
  WHERE job_id = p_job_id AND step_key = p_step_key
    AND operation IN ('storage_prefix', 'storage_exports') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DELETION_STORAGE_STEP_INVALID' USING ERRCODE = '22023'; END IF;

  IF job.job_type = 'delete_account' THEN
    SELECT COALESCE(jsonb_agg(item.name ORDER BY item.name), '[]'::jsonb), COALESCE(max(item.name), '')
    INTO paths, next_cursor
    FROM (
      SELECT object.name FROM storage.objects object
      WHERE object.bucket_id = step.resource_name
        AND object.name LIKE job.requester_id::TEXT || '/%'
        AND object.name > normalized_after
      ORDER BY object.name ASC LIMIT normalized_limit
    ) item;
    IF next_cursor <> '' THEN
      SELECT EXISTS (SELECT 1 FROM storage.objects object
        WHERE object.bucket_id = step.resource_name
          AND object.name LIKE job.requester_id::TEXT || '/%'
          AND object.name > next_cursor) INTO remaining;
    END IF;
  ELSE
    SELECT COALESCE(jsonb_agg(item.name ORDER BY item.name), '[]'::jsonb), COALESCE(max(item.name), '')
    INTO paths, next_cursor
    FROM (
      SELECT object.name FROM storage.objects object
      WHERE object.bucket_id = step.resource_name
        AND object.name > normalized_after
        AND EXISTS (
          SELECT 1 FROM public.report_exports export
          WHERE export.workspace_id = job.workspace_id AND export.file_path = object.name
        )
      ORDER BY object.name ASC LIMIT normalized_limit
    ) item;
    IF next_cursor <> '' THEN
      SELECT EXISTS (SELECT 1 FROM storage.objects object
        WHERE object.bucket_id = step.resource_name AND object.name > next_cursor
          AND EXISTS (SELECT 1 FROM public.report_exports export
            WHERE export.workspace_id = job.workspace_id AND export.file_path = object.name)) INTO remaining;
    END IF;
  END IF;
  RETURN jsonb_build_object('paths', paths, 'next_cursor', next_cursor, 'remaining', remaining);
END;
$$;

CREATE OR REPLACE FUNCTION public.r09_record_deletion_progress(
  p_job_id UUID, p_lease_token UUID, p_step_key TEXT,
  p_deleted_count BIGINT DEFAULT 0, p_cursor JSONB DEFAULT '{}'::jsonb,
  p_completed BOOLEAN DEFAULT FALSE, p_skipped BOOLEAN DEFAULT FALSE)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE job public.data_deletion_jobs%ROWTYPE; next_step TEXT; total BIGINT;
BEGIN
  SELECT * INTO job FROM public.data_deletion_jobs
  WHERE id = p_job_id AND status = 'processing' AND lease_token = p_lease_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DELETION_JOB_LEASE_LOST' USING ERRCODE = '40001'; END IF;
  UPDATE public.data_deletion_job_steps
  SET deleted_count = deleted_count + GREATEST(0, COALESCE(p_deleted_count, 0)),
      cursor = COALESCE(p_cursor, '{}'::jsonb),
      status = CASE WHEN p_completed THEN CASE WHEN p_skipped THEN 'skipped' ELSE 'completed' END ELSE 'pending' END,
      completed_at = CASE WHEN p_completed THEN NOW() ELSE NULL END,
      last_error_code = NULL, last_error_message = NULL, updated_at = NOW()
  WHERE job_id = p_job_id AND step_key = p_step_key;
  SELECT deleted_count INTO total FROM public.data_deletion_job_steps WHERE job_id = p_job_id AND step_key = p_step_key;
  UPDATE public.data_deletion_jobs
  SET deleted_counts = jsonb_set(COALESCE(deleted_counts, '{}'::jsonb), ARRAY[p_step_key], to_jsonb(COALESCE(total, 0)), TRUE),
      last_error_code = NULL, last_error_message = NULL, updated_at = NOW()
  WHERE id = p_job_id;
  IF NOT p_completed THEN
    UPDATE public.data_deletion_jobs SET status = 'queued', current_step = NULL, next_attempt_at = NOW(),
      lease_token = NULL, lease_owner = NULL, lease_expires_at = NULL, updated_at = NOW() WHERE id = p_job_id;
    RETURN jsonb_build_object('status', 'queued', 'step_completed', FALSE);
  END IF;
  SELECT step_key INTO next_step FROM public.data_deletion_job_steps
  WHERE job_id = p_job_id AND status = 'pending' ORDER BY sequence_no ASC LIMIT 1;
  IF next_step IS NOT NULL THEN
    UPDATE public.data_deletion_jobs SET status = 'queued', current_step = NULL, next_attempt_at = NOW(),
      lease_token = NULL, lease_owner = NULL, lease_expires_at = NULL, updated_at = NOW() WHERE id = p_job_id;
    RETURN jsonb_build_object('status', 'queued', 'step_completed', TRUE, 'next_step', next_step);
  END IF;
  UPDATE public.data_deletion_jobs SET status = 'completed', current_step = NULL, completed_at = NOW(),
    lease_token = NULL, lease_owner = NULL, lease_expires_at = NULL, updated_at = NOW()
  WHERE id = p_job_id RETURNING * INTO job;
  UPDATE public.data_subject_requests SET status = 'completed', completed_at = NOW(), error_code = NULL, error_message = NULL,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'job_id', job.id, 'deleted_counts', job.deleted_counts, 'completed_at', job.completed_at)
  WHERE id = job.request_id;
  RETURN jsonb_build_object('status', 'completed', 'step_completed', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.r09_record_deletion_failure(
  p_job_id UUID, p_lease_token UUID, p_step_key TEXT, p_error_code TEXT,
  p_error_message TEXT, p_retryable BOOLEAN DEFAULT TRUE, p_failed_object TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE job public.data_deletion_jobs%ROWTYPE; will_retry BOOLEAN; failure JSONB;
BEGIN
  SELECT * INTO job FROM public.data_deletion_jobs
  WHERE id = p_job_id AND status = 'processing' AND lease_token = p_lease_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DELETION_JOB_LEASE_LOST' USING ERRCODE = '40001'; END IF;
  will_retry := COALESCE(p_retryable, TRUE) AND job.attempt_count < job.max_attempts AND job.expires_at > NOW();
  failure := jsonb_build_object('step', left(COALESCE(p_step_key, ''), 120),
    'code', left(COALESCE(p_error_code, 'DELETION_STEP_FAILED'), 120),
    'object', CASE WHEN p_failed_object IS NULL THEN NULL ELSE left(p_failed_object, 240) END, 'at', NOW());
  UPDATE public.data_deletion_job_steps
  SET status = CASE WHEN will_retry THEN 'pending' ELSE 'failed' END,
      last_error_code = left(COALESCE(p_error_code, 'DELETION_STEP_FAILED'), 120),
      last_error_message = left(COALESCE(p_error_message, ''), 500),
      failed_objects = CASE WHEN jsonb_array_length(failed_objects) < 50 THEN failed_objects || jsonb_build_array(failure) ELSE failed_objects END,
      completed_at = CASE WHEN will_retry THEN NULL ELSE NOW() END, updated_at = NOW()
  WHERE job_id = p_job_id AND step_key = p_step_key;
  UPDATE public.data_deletion_jobs
  SET status = CASE WHEN will_retry THEN 'retry_wait' ELSE 'failed' END,
      next_attempt_at = CASE WHEN will_retry THEN NOW() + make_interval(secs => LEAST(300, 5 * GREATEST(1, attempt_count))) ELSE next_attempt_at END,
      failed_objects = CASE WHEN jsonb_array_length(failed_objects) < 50 THEN failed_objects || jsonb_build_array(failure) ELSE failed_objects END,
      last_error_code = left(COALESCE(p_error_code, 'DELETION_STEP_FAILED'), 120),
      last_error_message = left(COALESCE(p_error_message, ''), 500),
      completed_at = CASE WHEN will_retry THEN NULL ELSE NOW() END,
      lease_token = NULL, lease_owner = NULL, lease_expires_at = NULL, updated_at = NOW()
  WHERE id = p_job_id RETURNING * INTO job;
  IF NOT will_retry THEN
    UPDATE public.data_subject_requests SET status = 'failed', completed_at = NOW(), error_code = job.last_error_code,
      error_message = job.last_error_message,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('job_id', job.id, 'failed_step', p_step_key)
    WHERE id = job.request_id;
  END IF;
  RETURN jsonb_build_object('status', job.status, 'retryable', will_retry, 'next_attempt_at', job.next_attempt_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.r09_expire_async_tasks()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE report_count INTEGER := 0; ai_count INTEGER := 0; task RECORD;
BEGIN
  WITH expired AS (
    UPDATE public.report_runs SET status = 'failed', completed_at = NOW(),
      error_code = 'REPORT_TASK_TTL_EXPIRED',
      error_message = 'Report task exceeded its server-side TTL and can be retried',
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('ttl_expired_at', NOW()), updated_at = NOW()
    WHERE status = 'running' AND expires_at <= NOW() RETURNING 1)
  SELECT count(*) INTO report_count FROM expired;
  FOR task IN SELECT id, workspace_id, user_id, request_id FROM public.ai_async_tasks
    WHERE status = 'processing' AND expires_at <= NOW() FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.finalize_workspace_ai_token_reservation(task.workspace_id, task.user_id, task.request_id, 'released', 0);
    UPDATE public.ai_async_tasks SET status = 'failed', completed_at = NOW(), error_code = 'AI_TASK_TTL_EXPIRED',
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('ttl_expired_at', NOW()), updated_at = NOW()
    WHERE id = task.id AND status = 'processing';
    IF FOUND THEN ai_count := ai_count + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('expired_report_runs', report_count, 'expired_ai_tasks', ai_count);
END;
$$;

REVOKE ALL ON FUNCTION public.r09_enqueue_data_deletion_job(UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.r09_claim_data_deletion_job(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.r09_delete_data_batch(UUID, UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.r09_list_storage_batch(UUID, UUID, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.r09_record_deletion_progress(UUID, UUID, TEXT, BIGINT, JSONB, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.r09_record_deletion_failure(UUID, UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.r09_expire_async_tasks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.r09_enqueue_data_deletion_job(UUID, UUID, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.r09_claim_data_deletion_job(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.r09_delete_data_batch(UUID, UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.r09_list_storage_batch(UUID, UUID, TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.r09_record_deletion_progress(UUID, UUID, TEXT, BIGINT, JSONB, BOOLEAN, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.r09_record_deletion_failure(UUID, UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.r09_expire_async_tasks() TO service_role;

COMMENT ON TABLE public.data_deletion_jobs IS 'Recoverable, leased and audited account/workspace deletion jobs.';
COMMENT ON TABLE public.data_deletion_job_steps IS 'Idempotent deletion steps with batch cursors, counts and sanitized failures.';
COMMENT ON TABLE public.ai_async_tasks IS 'TTL ledger for asynchronous provider work; excludes prompts and response bodies.';
COMMIT;
