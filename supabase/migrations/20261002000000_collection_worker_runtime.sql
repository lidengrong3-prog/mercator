-- Runtime presence and fail-safe cutover support for the long-lived collector.
-- A scheduled fallback may treat the queue Worker as primary only while at
-- least one instance has a recent ready/busy heartbeat.

CREATE TABLE IF NOT EXISTS public.collection_worker_instances (
  worker_id TEXT PRIMARY KEY,
  deployment_id TEXT,
  release_id TEXT,
  status TEXT NOT NULL DEFAULT 'starting'
    CHECK (status IN ('starting', 'ready', 'busy', 'draining', 'stopped', 'error')),
  current_task_id UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (char_length(worker_id) BETWEEN 1 AND 160),
  CHECK (deployment_id IS NULL OR char_length(deployment_id) <= 160),
  CHECK (release_id IS NULL OR char_length(release_id) <= 160),
  CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_collection_worker_instances_presence
  ON public.collection_worker_instances(last_seen_at DESC, status);

CREATE OR REPLACE FUNCTION public.heartbeat_collection_worker(
  p_worker_id TEXT,
  p_status TEXT DEFAULT 'ready',
  p_deployment_id TEXT DEFAULT NULL,
  p_release_id TEXT DEFAULT NULL,
  p_current_task_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_worker_id TEXT := LEFT(NULLIF(TRIM(p_worker_id), ''), 160);
  clean_status TEXT := LOWER(COALESCE(NULLIF(TRIM(p_status), ''), 'ready'));
  clean_metadata JSONB := COALESCE(p_metadata, '{}'::jsonb);
  acknowledged_at TIMESTAMPTZ := NOW();
BEGIN
  IF clean_worker_id IS NULL THEN
    RAISE EXCEPTION 'WORKER_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF clean_status NOT IN ('starting', 'ready', 'busy', 'draining', 'stopped', 'error') THEN
    RAISE EXCEPTION 'WORKER_STATUS_INVALID' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(clean_metadata) <> 'object' OR octet_length(clean_metadata::TEXT) > 4096 THEN
    RAISE EXCEPTION 'WORKER_METADATA_INVALID' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.collection_worker_instances(
    worker_id, deployment_id, release_id, status, current_task_id,
    started_at, last_seen_at, metadata, updated_at
  )
  VALUES (
    clean_worker_id, LEFT(NULLIF(TRIM(p_deployment_id), ''), 160),
    LEFT(NULLIF(TRIM(p_release_id), ''), 160), clean_status,
    p_current_task_id, acknowledged_at, acknowledged_at, clean_metadata, acknowledged_at
  )
  ON CONFLICT (worker_id) DO UPDATE SET
    deployment_id = COALESCE(EXCLUDED.deployment_id, collection_worker_instances.deployment_id),
    release_id = COALESCE(EXCLUDED.release_id, collection_worker_instances.release_id),
    status = EXCLUDED.status,
    current_task_id = EXCLUDED.current_task_id,
    last_seen_at = acknowledged_at,
    metadata = EXCLUDED.metadata,
    updated_at = acknowledged_at;

  RETURN jsonb_build_object(
    'worker_id', clean_worker_id,
    'status', clean_status,
    'acknowledged_at', acknowledged_at
  );
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
    'active_workers', (
      SELECT COUNT(*) FROM public.collection_worker_instances
       WHERE status IN ('starting', 'ready', 'busy')
         AND last_seen_at >= NOW() - INTERVAL '2 minutes'
    ),
    'stale_workers', (
      SELECT COUNT(*) FROM public.collection_worker_instances
       WHERE status NOT IN ('stopped')
         AND last_seen_at < NOW() - INTERVAL '2 minutes'
    ),
    'last_worker_heartbeat', (
      SELECT MAX(last_seen_at) FROM public.collection_worker_instances
    ),
    'workers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'worker_id', worker_id,
        'deployment_id', deployment_id,
        'release_id', release_id,
        'status', status,
        'current_task_id', current_task_id,
        'last_seen_at', last_seen_at
      ) ORDER BY last_seen_at DESC)
      FROM (
        SELECT worker_id, deployment_id, release_id, status, current_task_id, last_seen_at
          FROM public.collection_worker_instances
         ORDER BY last_seen_at DESC
         LIMIT 20
      ) recent_workers
    ), '[]'::jsonb),
    'tikhub_daily', COALESCE((SELECT jsonb_build_object(
      'request_count', request_count,
      'estimated_cost_usd', estimated_cost_usd,
      'blocked_requests', blocked_requests
    ) FROM public.collection_usage_daily
      WHERE source_key = 'tikhub'
        AND usage_date = (NOW() AT TIME ZONE 'UTC')::DATE), '{}'::jsonb)
  );
$$;

ALTER TABLE public.collection_worker_instances ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.collection_worker_instances FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.collection_worker_instances TO service_role;

REVOKE ALL ON FUNCTION public.heartbeat_collection_worker(TEXT, TEXT, TEXT, TEXT, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_collection_worker_health()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_collection_worker(TEXT, TEXT, TEXT, TEXT, UUID, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_collection_worker_health()
  TO service_role;

COMMENT ON TABLE public.collection_worker_instances IS
  'Service-only runtime presence used to prove a replacement Worker is alive before scheduled collection cuts over.';
COMMENT ON FUNCTION public.heartbeat_collection_worker(TEXT, TEXT, TEXT, TEXT, UUID, JSONB) IS
  'Registers an idle or busy Worker heartbeat; stale instances never suppress the legacy scheduled fallback.';
