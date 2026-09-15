-- Independent collection worker queue, leases, source budgets and circuits.
-- GitHub Actions should enqueue/inspect work; a long-lived worker executes it.

BEGIN;

CREATE TABLE IF NOT EXISTS public.collection_source_policies (
  source_key TEXT PRIMARY KEY REFERENCES public.data_source_registry(source_key) ON DELETE RESTRICT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  max_concurrency INTEGER NOT NULL DEFAULT 1 CHECK (max_concurrency > 0),
  timeout_seconds INTEGER NOT NULL DEFAULT 300 CHECK (timeout_seconds BETWEEN 10 AND 86400),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 20),
  backoff_base_seconds INTEGER NOT NULL DEFAULT 60 CHECK (backoff_base_seconds BETWEEN 1 AND 86400),
  backoff_max_seconds INTEGER NOT NULL DEFAULT 3600 CHECK (backoff_max_seconds >= backoff_base_seconds),
  circuit_failure_threshold INTEGER NOT NULL DEFAULT 3 CHECK (circuit_failure_threshold BETWEEN 1 AND 100),
  circuit_window_seconds INTEGER NOT NULL DEFAULT 900 CHECK (circuit_window_seconds BETWEEN 60 AND 604800),
  circuit_cooldown_seconds INTEGER NOT NULL DEFAULT 1800 CHECK (circuit_cooldown_seconds BETWEEN 60 AND 604800),
  circuit_state TEXT NOT NULL DEFAULT 'closed' CHECK (circuit_state IN ('closed', 'open', 'half_open')),
  circuit_opened_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  daily_request_limit INTEGER CHECK (daily_request_limit IS NULL OR daily_request_limit > 0),
  daily_cost_limit_usd NUMERIC CHECK (daily_cost_limit_usd IS NULL OR daily_cost_limit_usd >= 0),
  blocks_publication_on_failure BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.collection_source_policies
  ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.collection_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key TEXT NOT NULL UNIQUE,
  source_key TEXT NOT NULL REFERENCES public.data_source_registry(source_key) ON DELETE RESTRICT,
  collector_key TEXT NOT NULL,
  domain TEXT NOT NULL CHECK (domain IN ('policy', 'tax', 'access', 'rule', 'alert', 'market', 'platform')),
  market_codes TEXT[] NOT NULL DEFAULT '{}',
  platform_keys TEXT[] NOT NULL DEFAULT '{}',
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  depends_on_task_keys TEXT[] NOT NULL DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 100 CHECK (priority BETWEEN 0 AND 100000),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'leased', 'retry_wait', 'succeeded', 'dead_letter', 'cancelled')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 20),
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  last_started_at TIMESTAMPTZ,
  last_finished_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error TEXT,
  result_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (lease_expires_at IS NULL OR lease_owner IS NOT NULL),
  CHECK (status <> 'leased' OR lease_owner IS NOT NULL)
);

ALTER TABLE public.collection_tasks
  ADD COLUMN IF NOT EXISTS depends_on_task_keys TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.collection_task_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.collection_tasks(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  worker_id TEXT NOT NULL,
  request_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed', 'budget_blocked', 'source_blocked', 'timed_out')),
  exit_code INTEGER,
  error_code TEXT,
  error_message TEXT,
  estimated_cost_usd NUMERIC NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (task_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS public.collection_usage_daily (
  usage_date DATE NOT NULL,
  source_key TEXT NOT NULL REFERENCES public.data_source_registry(source_key) ON DELETE RESTRICT,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  blocked_requests INTEGER NOT NULL DEFAULT 0 CHECK (blocked_requests >= 0),
  estimated_cost_usd NUMERIC NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  last_request_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usage_date, source_key)
);

CREATE TABLE IF NOT EXISTS public.collection_usage_reservations (
  request_id TEXT PRIMARY KEY,
  usage_date DATE NOT NULL,
  source_key TEXT NOT NULL REFERENCES public.data_source_registry(source_key) ON DELETE RESTRICT,
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count > 0),
  estimated_cost_usd NUMERIC NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  allowed BOOLEAN NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.collection_budget_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_date DATE NOT NULL,
  source_key TEXT NOT NULL REFERENCES public.data_source_registry(source_key) ON DELETE RESTRICT,
  code TEXT NOT NULL CHECK (code IN ('daily_request_limit', 'daily_cost_limit')),
  limit_value NUMERIC NOT NULL CHECK (limit_value >= 0),
  observed_value NUMERIC NOT NULL CHECK (observed_value >= 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE (usage_date, source_key, code)
);

CREATE INDEX IF NOT EXISTS idx_collection_tasks_claim
  ON public.collection_tasks(status, run_after, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_collection_tasks_source_active
  ON public.collection_tasks(source_key, status, lease_expires_at);
CREATE INDEX IF NOT EXISTS idx_collection_task_attempts_task
  ON public.collection_task_attempts(task_id, attempt_number DESC);
CREATE INDEX IF NOT EXISTS idx_collection_usage_daily_source
  ON public.collection_usage_daily(source_key, usage_date DESC);
CREATE INDEX IF NOT EXISTS idx_collection_budget_alerts_open
  ON public.collection_budget_alerts(status, created_at DESC);

CREATE OR REPLACE FUNCTION public.prepare_collection_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE policy_max INTEGER;
BEGIN
  SELECT max_attempts INTO policy_max
    FROM public.collection_source_policies
   WHERE source_key = NEW.source_key;
  IF policy_max IS NOT NULL AND NEW.max_attempts = 3 THEN
    NEW.max_attempts := policy_max;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS collection_tasks_prepare ON public.collection_tasks;
CREATE TRIGGER collection_tasks_prepare
  BEFORE INSERT ON public.collection_tasks
  FOR EACH ROW EXECUTE FUNCTION public.prepare_collection_task();

CREATE OR REPLACE FUNCTION public.claim_collection_task(
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 900
)
RETURNS SETOF public.collection_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE lease_seconds INTEGER := GREATEST(30, LEAST(COALESCE(p_lease_seconds, 900), 86400));
BEGIN
  IF NULLIF(TRIM(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'WORKER_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;
  -- Serializing claims makes the per-source concurrency count correct even
  -- when multiple worker processes start at the same time.
  PERFORM pg_advisory_xact_lock(hashtextextended('collection-task-claim', 0));

  UPDATE public.collection_tasks
     SET status = 'queued', lease_owner = NULL, lease_expires_at = NULL,
         last_heartbeat_at = NULL, run_after = NOW(), updated_at = NOW()
   WHERE status = 'leased' AND lease_expires_at IS NOT NULL AND lease_expires_at <= NOW();

  RETURN QUERY
  WITH candidate AS (
    SELECT task.id
      FROM public.collection_tasks AS task
      JOIN public.collection_source_policies AS policy USING (source_key)
     WHERE task.status IN ('queued', 'retry_wait')
       AND task.run_after <= NOW()
       AND policy.enabled = TRUE
       AND NOT EXISTS (
         SELECT 1
           FROM unnest(task.depends_on_task_keys) AS dependency_key
           LEFT JOIN public.collection_tasks AS dependency
             ON dependency.task_key = dependency_key
          WHERE dependency.id IS NULL OR dependency.status <> 'succeeded'
       )
       AND (
         policy.circuit_state <> 'open'
         OR policy.circuit_opened_at IS NULL
         OR policy.circuit_opened_at + make_interval(secs => policy.circuit_cooldown_seconds) <= NOW()
       )
       AND (
         SELECT COUNT(*)
           FROM public.collection_tasks AS active
          WHERE active.source_key = task.source_key
            AND active.status = 'leased'
            AND active.lease_expires_at > NOW()
       ) < policy.max_concurrency
     ORDER BY task.priority DESC, task.run_after, task.created_at
     FOR UPDATE SKIP LOCKED
     LIMIT 1
  )
  UPDATE public.collection_tasks AS task
     SET status = 'leased', lease_owner = LEFT(TRIM(p_worker_id), 160),
         lease_expires_at = NOW() + make_interval(secs => lease_seconds),
         last_heartbeat_at = NOW(), last_started_at = NOW(),
         attempt_count = task.attempt_count + 1, updated_at = NOW()
    FROM candidate
   WHERE task.id = candidate.id
  RETURNING task.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.renew_collection_task_lease(
  p_task_id UUID,
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 900
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.collection_tasks
     SET lease_expires_at = NOW() + make_interval(secs => GREATEST(30, LEAST(COALESCE(p_lease_seconds, 900), 86400))),
         last_heartbeat_at = NOW(), updated_at = NOW()
   WHERE id = p_task_id AND status = 'leased' AND lease_owner = LEFT(TRIM(p_worker_id), 160)
     AND lease_expires_at > NOW()
  RETURNING TRUE;
$$;

CREATE OR REPLACE FUNCTION public.complete_collection_task(
  p_task_id UUID,
  p_worker_id TEXT,
  p_result_summary JSONB DEFAULT '{}'::jsonb
)
RETURNS public.collection_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result_row public.collection_tasks;
BEGIN
  UPDATE public.collection_tasks
     SET status = 'succeeded', lease_owner = NULL, lease_expires_at = NULL,
         last_heartbeat_at = NULL, last_finished_at = NOW(),
         result_summary = COALESCE(p_result_summary, '{}'::jsonb),
         last_error_code = NULL, last_error = NULL, updated_at = NOW()
   WHERE id = p_task_id AND status = 'leased' AND lease_owner = LEFT(TRIM(p_worker_id), 160)
  RETURNING * INTO result_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK_LEASE_NOT_OWNED' USING ERRCODE = '42501'; END IF;
  RETURN result_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_collection_task(
  p_task_id UUID,
  p_worker_id TEXT,
  p_error_code TEXT,
  p_error_message TEXT,
  p_backoff_seconds INTEGER DEFAULT 60,
  p_retryable BOOLEAN DEFAULT TRUE
)
RETURNS public.collection_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result_row public.collection_tasks;
BEGIN
  UPDATE public.collection_tasks
     SET status = CASE WHEN p_retryable AND attempt_count < max_attempts THEN 'retry_wait' ELSE 'dead_letter' END,
         lease_owner = NULL, lease_expires_at = NULL, last_heartbeat_at = NULL,
         last_finished_at = NOW(), next_attempt_at = CASE
           WHEN p_retryable AND attempt_count < max_attempts
           THEN NOW() + make_interval(secs => GREATEST(1, LEAST(COALESCE(p_backoff_seconds, 60), 604800)))
           ELSE NULL END,
         run_after = CASE
           WHEN p_retryable AND attempt_count < max_attempts
           THEN NOW() + make_interval(secs => GREATEST(1, LEAST(COALESCE(p_backoff_seconds, 60), 604800)))
           ELSE NOW() END,
         last_error_code = LEFT(NULLIF(TRIM(p_error_code), ''), 120),
         last_error = LEFT(NULLIF(TRIM(p_error_message), ''), 2000), updated_at = NOW()
   WHERE id = p_task_id AND status = 'leased' AND lease_owner = LEFT(TRIM(p_worker_id), 160)
  RETURNING * INTO result_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK_LEASE_NOT_OWNED' USING ERRCODE = '42501'; END IF;
  RETURN result_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_collection_source_outcome(
  p_source_key TEXT,
  p_success BOOLEAN,
  p_error_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  policy public.collection_source_policies%ROWTYPE;
  failures INTEGER;
BEGIN
  SELECT * INTO policy FROM public.collection_source_policies
   WHERE source_key = p_source_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOURCE_POLICY_NOT_FOUND' USING ERRCODE = '22023'; END IF;
  IF p_success THEN
    UPDATE public.collection_source_policies
       SET circuit_state = 'closed', circuit_opened_at = NULL,
           last_failure_at = NULL, consecutive_failures = 0, updated_at = NOW()
     WHERE source_key = p_source_key;
  ELSE
    failures := CASE
      WHEN policy.last_failure_at IS NULL
        OR policy.last_failure_at + make_interval(secs => policy.circuit_window_seconds) <= NOW()
      THEN 1 ELSE policy.consecutive_failures + 1 END;
    UPDATE public.collection_source_policies
       SET consecutive_failures = failures,
           last_failure_at = NOW(),
           circuit_state = CASE WHEN failures >= circuit_failure_threshold THEN 'open' ELSE circuit_state END,
           circuit_opened_at = CASE WHEN failures >= circuit_failure_threshold THEN NOW() ELSE circuit_opened_at END,
           updated_at = NOW()
     WHERE source_key = p_source_key;
  END IF;
  SELECT * INTO policy FROM public.collection_source_policies WHERE source_key = p_source_key;
  RETURN jsonb_build_object('source_key', policy.source_key, 'success', p_success,
    'circuit_state', policy.circuit_state, 'consecutive_failures', policy.consecutive_failures,
    'blocks_publication_on_failure', policy.blocks_publication_on_failure,
    'error_code', p_error_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_collection_budget(
  p_source_key TEXT,
  p_request_id TEXT,
  p_request_count INTEGER DEFAULT 1,
  p_estimated_cost_usd NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  policy public.collection_source_policies%ROWTYPE;
  usage_row public.collection_usage_daily%ROWTYPE;
  existing public.collection_usage_reservations%ROWTYPE;
  today DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  requests INTEGER := GREATEST(1, LEAST(COALESCE(p_request_count, 1), 1000000));
  cost NUMERIC := GREATEST(0, COALESCE(p_estimated_cost_usd, 0));
  request_allowed BOOLEAN;
  reason TEXT;
  alert_id UUID;
BEGIN
  IF NULLIF(TRIM(p_source_key), '') IS NULL OR NULLIF(TRIM(p_request_id), '') IS NULL THEN
    RAISE EXCEPTION 'SOURCE_AND_REQUEST_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('collection-budget:' || LEFT(TRIM(p_request_id), 240), 0));
  SELECT * INTO existing FROM public.collection_usage_reservations WHERE request_id = LEFT(TRIM(p_request_id), 240);
  IF FOUND THEN
    RETURN jsonb_build_object('allowed', existing.allowed, 'reason', existing.reason,
      'request_id', existing.request_id, 'idempotent', TRUE);
  END IF;
  SELECT * INTO policy FROM public.collection_source_policies WHERE source_key = p_source_key FOR UPDATE;
  IF NOT FOUND OR NOT policy.enabled THEN
    reason := 'SOURCE_DISABLED'; request_allowed := FALSE;
  ELSE
    INSERT INTO public.collection_usage_daily(usage_date, source_key)
    VALUES (today, p_source_key) ON CONFLICT (usage_date, source_key) DO NOTHING;
    SELECT * INTO usage_row FROM public.collection_usage_daily
     WHERE usage_date = today AND source_key = p_source_key FOR UPDATE;
    request_allowed := (policy.daily_request_limit IS NULL OR usage_row.request_count + requests <= policy.daily_request_limit)
      AND (policy.daily_cost_limit_usd IS NULL OR usage_row.estimated_cost_usd + cost <= policy.daily_cost_limit_usd);
    IF NOT request_allowed THEN
      reason := CASE WHEN policy.daily_request_limit IS NOT NULL AND usage_row.request_count + requests > policy.daily_request_limit
                     THEN 'DAILY_REQUEST_LIMIT' ELSE 'DAILY_COST_LIMIT' END;
      UPDATE public.collection_usage_daily SET blocked_requests = blocked_requests + 1, updated_at = NOW()
       WHERE usage_date = today AND source_key = p_source_key;
      INSERT INTO public.collection_budget_alerts(usage_date, source_key, code, limit_value, observed_value)
      VALUES (today, p_source_key,
        CASE WHEN reason = 'DAILY_REQUEST_LIMIT' THEN 'daily_request_limit' ELSE 'daily_cost_limit' END,
        CASE WHEN reason = 'DAILY_REQUEST_LIMIT' THEN policy.daily_request_limit ELSE policy.daily_cost_limit_usd END,
        CASE WHEN reason = 'DAILY_REQUEST_LIMIT' THEN usage_row.request_count + requests ELSE usage_row.estimated_cost_usd + cost END)
      ON CONFLICT (usage_date, source_key, code) DO NOTHING
      RETURNING id INTO alert_id;
      IF alert_id IS NOT NULL THEN
        INSERT INTO public.system_incidents(service, severity, status, title, detail)
        VALUES ('collection-worker', 'warning', 'open', 'Collection budget exceeded',
          jsonb_build_object('source_key', p_source_key, 'reason', reason, 'usage_date', today)::TEXT);
      END IF;
    ELSE
      UPDATE public.collection_usage_daily
         SET request_count = request_count + requests,
             estimated_cost_usd = estimated_cost_usd + cost,
             last_request_at = NOW(), updated_at = NOW()
       WHERE usage_date = today AND source_key = p_source_key;
    END IF;
  END IF;
  INSERT INTO public.collection_usage_reservations(request_id, usage_date, source_key, request_count, estimated_cost_usd, allowed, reason)
  VALUES (LEFT(TRIM(p_request_id), 240), today, p_source_key, requests, cost, request_allowed, reason);
  RETURN jsonb_build_object('allowed', request_allowed, 'reason', reason, 'request_id', LEFT(TRIM(p_request_id), 240), 'idempotent', FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_collection_worker_health()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'checked_at', NOW(),
    'queued', (SELECT COUNT(*) FROM public.collection_tasks WHERE status IN ('queued', 'retry_wait')),
    'leased', (SELECT COUNT(*) FROM public.collection_tasks WHERE status = 'leased' AND lease_expires_at > NOW()),
    'dead_letter', (SELECT COUNT(*) FROM public.collection_tasks WHERE status = 'dead_letter'),
    'open_circuits', COALESCE((SELECT jsonb_agg(source_key) FROM public.collection_source_policies WHERE circuit_state = 'open'), '[]'::jsonb),
    'sources', (SELECT COUNT(*) FROM public.collection_source_policies WHERE enabled),
    'tikhub_daily', COALESCE((SELECT jsonb_build_object('request_count', request_count, 'estimated_cost_usd', estimated_cost_usd, 'blocked_requests', blocked_requests)
      FROM public.collection_usage_daily WHERE source_key = 'tikhub' AND usage_date = (NOW() AT TIME ZONE 'UTC')::DATE), '{}'::jsonb)
  );
$$;

-- Seed conservative defaults. TikHub is explicitly capped and all other
-- sources remain uncapped by cost until an operator sets a provider price.
INSERT INTO public.collection_source_policies
  (source_key, max_concurrency, timeout_seconds, max_attempts, backoff_base_seconds,
   backoff_max_seconds, circuit_failure_threshold, circuit_window_seconds,
   circuit_cooldown_seconds, daily_request_limit, daily_cost_limit_usd,
   blocks_publication_on_failure, metadata)
VALUES
  ('federal-register', 1, 180, 4, 30, 1800, 3, 900, 1800, NULL, NULL, TRUE, '{"default_estimated_cost_usd":0}'::jsonb),
  ('cpsc', 1, 180, 4, 30, 1800, 3, 900, 1800, NULL, NULL, TRUE, '{"default_estimated_cost_usd":0}'::jsonb),
  ('platform-official', 2, 300, 4, 60, 3600, 3, 900, 1800, NULL, NULL, TRUE, '{"default_estimated_cost_usd":0}'::jsonb),
  ('tikhub', 1, 120, 3, 120, 3600, 3, 900, 3600, 1000, 25, FALSE, '{"default_estimated_cost_usd":0.05}'::jsonb),
  ('macro-official', 1, 180, 3, 60, 1800, 3, 900, 1800, NULL, NULL, FALSE, '{"default_estimated_cost_usd":0}'::jsonb),
  ('internal-system', 1, 900, 2, 60, 3600, 2, 900, 1800, NULL, NULL, TRUE, '{"default_estimated_cost_usd":0}'::jsonb)
ON CONFLICT (source_key) DO UPDATE SET
  max_concurrency = EXCLUDED.max_concurrency,
  timeout_seconds = EXCLUDED.timeout_seconds,
  max_attempts = EXCLUDED.max_attempts,
  backoff_base_seconds = EXCLUDED.backoff_base_seconds,
  backoff_max_seconds = EXCLUDED.backoff_max_seconds,
  circuit_failure_threshold = EXCLUDED.circuit_failure_threshold,
  circuit_window_seconds = EXCLUDED.circuit_window_seconds,
  circuit_cooldown_seconds = EXCLUDED.circuit_cooldown_seconds,
  daily_request_limit = EXCLUDED.daily_request_limit,
  daily_cost_limit_usd = EXCLUDED.daily_cost_limit_usd,
  blocks_publication_on_failure = EXCLUDED.blocks_publication_on_failure,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

ALTER TABLE public.collection_source_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_task_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_usage_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_budget_alerts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.collection_source_policies, public.collection_tasks,
  public.collection_task_attempts, public.collection_usage_daily,
  public.collection_usage_reservations, public.collection_budget_alerts
  FROM anon, authenticated;
GRANT ALL ON public.collection_source_policies, public.collection_tasks,
  public.collection_task_attempts, public.collection_usage_daily,
  public.collection_usage_reservations, public.collection_budget_alerts TO service_role;

REVOKE ALL ON FUNCTION public.claim_collection_task(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.renew_collection_task_lease(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_collection_task(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_collection_task(UUID, TEXT, TEXT, TEXT, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_collection_source_outcome(TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_collection_budget(TEXT, TEXT, INTEGER, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_collection_worker_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_collection_task(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.renew_collection_task_lease(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_collection_task(UUID, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_collection_task(UUID, TEXT, TEXT, TEXT, INTEGER, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_collection_source_outcome(TEXT, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_collection_budget(TEXT, TEXT, INTEGER, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_collection_worker_health() TO service_role;

COMMENT ON TABLE public.collection_tasks IS '服务端采集任务队列；依赖任务未成功时不会领取，租约过期会被下一次 claim 自动回收。';
COMMENT ON TABLE public.collection_source_policies IS '按来源配置并发、超时、退避、熔断和每日请求/费用预算。';
COMMENT ON TABLE public.collection_usage_reservations IS '预算预留幂等账本；Worker 重启不会重复计费。';
COMMENT ON FUNCTION public.claim_collection_task(TEXT, INTEGER) IS '使用行锁和 SKIP LOCKED 原子领取一个可执行任务。';
COMMENT ON FUNCTION public.reserve_collection_budget(TEXT, TEXT, INTEGER, NUMERIC) IS '按 UTC 自然日原子限制来源请求和估算费用。';

COMMIT;
