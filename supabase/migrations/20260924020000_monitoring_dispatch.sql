-- Turn workspace monitoring intents into scoped Worker tasks.
-- The function is service-role only and advances next_run_at in the same
-- transaction as the queue insert, so a Worker restart cannot duplicate a
-- due monitoring run.

BEGIN;

ALTER TABLE public.monitoring_tasks
  ADD COLUMN IF NOT EXISTS last_enqueued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_collection_task_key TEXT,
  ADD COLUMN IF NOT EXISTS last_collected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0);

-- A monitor run has the same evidence/event ledger as the seven-day pilot,
-- but several independent monitor targets may run on the same UTC date.
ALTER TABLE public.tikhub_pilot_runs
  ADD COLUMN IF NOT EXISTS monitoring_task_id UUID REFERENCES public.monitoring_tasks(id) ON DELETE SET NULL;
ALTER TABLE public.tikhub_pilot_runs
DROP CONSTRAINT IF EXISTS tikhub_pilot_runs_pilot_key_run_date_key;
DROP INDEX IF EXISTS idx_tikhub_pilot_runs_identity;
-- PostgreSQL 15's NULLS NOT DISTINCT makes the nullable monitor ID part of
-- the real unique key, which PostgREST can target with on_conflict.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tikhub_pilot_runs_identity
  ON public.tikhub_pilot_runs(pilot_key, run_date, monitoring_task_id) NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS idx_monitoring_tasks_dispatch
  ON public.monitoring_tasks(status, next_run_at)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.dispatch_due_monitoring_tasks(p_limit INTEGER DEFAULT 100)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item public.monitoring_tasks%ROWTYPE;
  task_key TEXT;
  inserted_count INTEGER := 0;
  blocked_count INTEGER := 0;
  task_keys TEXT[] := '{}';
  collector_key TEXT;
  task_domain TEXT;
  task_parameters JSONB;
  interval_seconds INTEGER;
BEGIN
  FOR item IN
    SELECT *
      FROM public.monitoring_tasks
     WHERE status = 'active'
       AND next_run_at <= NOW()
     ORDER BY next_run_at, created_at
     FOR UPDATE SKIP LOCKED
     LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500))
  LOOP
    -- TikHub is currently the only provider adapter for product/shop
    -- monitoring. A schema-only market is visible to the user but must not
    -- become a provider request until its adapter and authorization exist.
    IF item.platform_key <> 'tiktok-shop'
       OR NOT EXISTS (
         SELECT 1
           FROM public.market_catalog market
           JOIN public.market_platforms relation
             ON relation.market_code = market.code
            AND relation.platform_key = item.platform_key
          WHERE market.code = upper(item.market_code)
            AND market.status = 'active'
            AND market.data_status = 'configured'
            AND relation.status = 'active'
            AND relation.data_status = 'configured'
       ) THEN
      UPDATE public.monitoring_tasks
         SET status = 'blocked', last_status = 'blocked',
             last_error = '当前市场或平台尚未配置可用采集适配器', updated_at = NOW()
       WHERE id = item.id;
      blocked_count := blocked_count + 1;
      CONTINUE;
    END IF;

    collector_key := 'tikhub_monitor';
    task_domain := CASE WHEN item.task_type = 'shop' THEN 'shop' ELSE 'product' END;
    task_key := 'monitoring:' || item.id::TEXT || ':' ||
      to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
    task_parameters := jsonb_build_object(
      'monitoring-task-id', item.id::TEXT,
      'monitoring-type', item.task_type,
      'market-code', upper(item.market_code),
      'platform', lower(item.platform_key),
      'category-code', item.category_code,
      'keyword', item.keyword,
      'target-external-id', item.target_external_id,
      'target-entity-id', item.target_entity_id,
      'request_count', CASE WHEN item.task_type = 'keyword' THEN 4 ELSE 2 END,
      'estimated_cost_usd', CASE WHEN item.task_type = 'keyword' THEN 0.2 ELSE 0.1 END
    );

    INSERT INTO public.collection_tasks(
      task_key, source_key, collector_key, domain, market_codes,
      platform_keys, parameters, priority, run_after
    ) VALUES (
      task_key, 'tikhub', collector_key, task_domain,
      ARRAY[upper(item.market_code)], ARRAY[lower(item.platform_key)],
      task_parameters, 650, NOW()
    ) ON CONFLICT (task_key) DO NOTHING;

    interval_seconds := GREATEST(900, CEIL(86400.0 / GREATEST(item.cadence_per_day, 1))::INTEGER);
    UPDATE public.monitoring_tasks
       SET next_run_at = NOW() + make_interval(secs => interval_seconds),
           last_enqueued_at = NOW(), last_collection_task_key = task_key,
           last_status = 'queued', last_error = NULL, updated_at = NOW()
     WHERE id = item.id;
    inserted_count := inserted_count + 1;
    task_keys := array_append(task_keys, task_key);
  END LOOP;

  RETURN jsonb_build_object(
    'enqueued', inserted_count,
    'blocked', blocked_count,
    'task_keys', to_jsonb(task_keys)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_monitoring_task_result(
  p_monitoring_task_id UUID,
  p_status TEXT,
  p_error TEXT DEFAULT NULL,
  p_collected_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS public.monitoring_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result_row public.monitoring_tasks%ROWTYPE;
  normalized_status TEXT := CASE WHEN p_status = 'succeeded' THEN 'succeeded' ELSE 'failed' END;
BEGIN
  UPDATE public.monitoring_tasks
     SET last_status = normalized_status,
         last_error = CASE WHEN normalized_status = 'failed' THEN LEFT(NULLIF(TRIM(p_error), ''), 2000) ELSE NULL END,
         last_collected_at = CASE WHEN normalized_status = 'succeeded' THEN COALESCE(p_collected_at, NOW()) ELSE last_collected_at END,
         failure_count = CASE WHEN normalized_status = 'failed' THEN failure_count + 1 ELSE 0 END,
         status = CASE WHEN normalized_status = 'failed' AND failure_count + 1 >= 3 THEN 'failed' ELSE status END,
         updated_at = NOW()
   WHERE id = p_monitoring_task_id
  RETURNING * INTO result_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'MONITORING_TASK_NOT_FOUND' USING ERRCODE = '22023'; END IF;
  RETURN result_row;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_due_monitoring_tasks(INTEGER) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.record_monitoring_task_result(UUID, TEXT, TEXT, TIMESTAMPTZ) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_due_monitoring_tasks(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_monitoring_task_result(UUID, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.dispatch_due_monitoring_tasks(INTEGER) IS
  'Atomically schedules due workspace monitoring intents as scoped collection tasks.';
COMMENT ON FUNCTION public.record_monitoring_task_result(UUID, TEXT, TEXT, TIMESTAMPTZ) IS
  'Records Worker truth for a monitoring intent without exposing service credentials.';

COMMIT;
