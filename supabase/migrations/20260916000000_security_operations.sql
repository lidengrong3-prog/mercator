-- Public-service security, recovery and data-subject operations foundation.
-- All counters are server-side and atomic so Edge Function instances share the
-- same limits. Sensitive payloads are deliberately excluded from telemetry.

BEGIN;

CREATE TABLE IF NOT EXISTS public.security_rate_limits (
  scope TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  limit_count INTEGER NOT NULL CHECK (limit_count > 0),
  last_request_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  PRIMARY KEY (scope, subject_key)
);

ALTER TABLE public.private_data_artifacts
  DROP CONSTRAINT IF EXISTS private_data_artifacts_artifact_kind_check;
ALTER TABLE public.private_data_artifacts
  ADD CONSTRAINT private_data_artifacts_artifact_kind_check CHECK (artifact_kind IN (
    'raw_response', 'collection_log', 'sync_log', 'quarantine',
    'licensed_dataset', 'internal_dataset', 'encrypted_backup', 'storage_backup'
  ));

CREATE INDEX IF NOT EXISTS idx_security_rate_limits_blocked
  ON public.security_rate_limits(blocked_until)
  WHERE blocked_until IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.security_rate_limit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  subject_hash TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  allowed BOOLEAN NOT NULL,
  limit_count INTEGER NOT NULL,
  request_count INTEGER NOT NULL,
  retry_after_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_rate_limit_events_created
  ON public.security_rate_limit_events(created_at DESC, scope, allowed);

CREATE TABLE IF NOT EXISTS public.security_alert_rules (
  code TEXT PRIMARY KEY,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  threshold NUMERIC NOT NULL CHECK (threshold >= 0),
  window_minutes INTEGER NOT NULL CHECK (window_minutes BETWEEN 1 AND 10080),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  notification_channels TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.service_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('passed', 'degraded', 'failed')),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  release_sha TEXT,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_service_health_snapshots_service_time
  ON public.service_health_snapshots(service, checked_at DESC);

CREATE TABLE IF NOT EXISTS public.backup_restore_drills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_artifact_id UUID REFERENCES public.private_data_artifacts(id) ON DELETE SET NULL,
  environment TEXT NOT NULL DEFAULT 'isolated',
  status TEXT NOT NULL CHECK (status IN ('started', 'passed', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  checks JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_restore_drills_time
  ON public.backup_restore_drills(created_at DESC, status);

CREATE TABLE IF NOT EXISTS public.data_subject_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('export', 'delete_account', 'delete_workspace')),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'processing', 'completed', 'failed', 'cancelled')),
  idempotency_key TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  result_object_path TEXT,
  error_code TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (requester_id, request_type, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_data_subject_requests_requester
  ON public.data_subject_requests(requester_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_subject_requests_workspace
  ON public.data_subject_requests(workspace_id, requested_at DESC);

ALTER TABLE public.security_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_rate_limit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_health_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_restore_drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.security_rate_limits, public.security_rate_limit_events,
  public.security_alert_rules, public.service_health_snapshots,
  public.backup_restore_drills FROM anon, authenticated;
GRANT ALL ON public.security_rate_limits, public.security_rate_limit_events TO service_role;
GRANT SELECT ON public.security_alert_rules, public.service_health_snapshots,
  public.backup_restore_drills TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.data_subject_requests TO service_role;

DROP POLICY IF EXISTS data_subject_requests_select_own ON public.data_subject_requests;
CREATE POLICY data_subject_requests_select_own ON public.data_subject_requests
  FOR SELECT TO authenticated USING (requester_id = auth.uid());
DROP POLICY IF EXISTS data_subject_requests_insert_own ON public.data_subject_requests;
CREATE POLICY data_subject_requests_insert_own ON public.data_subject_requests
  FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());
GRANT SELECT, INSERT ON public.data_subject_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.consume_security_rate_limit(
  p_scope TEXT,
  p_subject_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER DEFAULT 60,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
  v_retry INTEGER;
  v_allowed BOOLEAN;
  v_limit INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 1), 1000000));
  v_window INTEGER := GREATEST(1, LEAST(COALESCE(p_window_seconds, 60), 86400));
  v_subject TEXT := LEFT(COALESCE(NULLIF(TRIM(p_subject_key), ''), 'unknown'), 240);
BEGIN
  IF COALESCE(NULLIF(TRIM(p_scope), ''), '') = '' THEN
    RAISE EXCEPTION 'RATE_LIMIT_SCOPE_REQUIRED' USING ERRCODE = '22023';
  END IF;
  v_window_start := to_timestamp(floor(extract(epoch FROM v_now) / v_window) * v_window);
  PERFORM pg_advisory_xact_lock(hashtextextended(LEFT(p_scope, 120) || ':' || v_subject, 0));

  INSERT INTO public.security_rate_limits(scope, subject_key, window_started_at, request_count, limit_count, last_request_at)
  VALUES (LEFT(p_scope, 120), v_subject, v_window_start, 1, v_limit, v_now)
  ON CONFLICT (scope, subject_key) DO UPDATE
  SET window_started_at = CASE
        WHEN security_rate_limits.window_started_at < v_window_start
        THEN v_window_start ELSE security_rate_limits.window_started_at END,
      request_count = CASE
        WHEN security_rate_limits.window_started_at < v_window_start THEN 1
        ELSE security_rate_limits.request_count + 1 END,
      limit_count = v_limit,
      last_request_at = v_now,
      blocked_until = CASE
        WHEN security_rate_limits.window_started_at < v_window_start THEN NULL
        ELSE security_rate_limits.blocked_until END
  RETURNING request_count INTO v_count;

  v_allowed := v_count <= v_limit;
  v_retry := CASE WHEN v_allowed THEN 0 ELSE GREATEST(1, ceil(extract(epoch FROM (v_window_start + make_interval(secs => v_window) - v_now)))::INTEGER) END;
  IF NOT v_allowed THEN
    UPDATE public.security_rate_limits
       SET blocked_until = v_now + make_interval(secs => v_retry)
     WHERE scope = LEFT(p_scope, 120) AND subject_key = v_subject;
  END IF;
  INSERT INTO public.security_rate_limit_events(scope, subject_hash, user_id, allowed, limit_count, request_count, retry_after_seconds)
  VALUES (LEFT(p_scope, 120), encode(digest(v_subject, 'sha256'), 'hex'), p_user_id, v_allowed, v_limit, v_count, v_retry);
  RETURN jsonb_build_object('allowed', v_allowed, 'limit', v_limit, 'used', v_count,
    'retry_after', v_retry, 'reset_at', v_window_start + make_interval(secs => v_window));
END;
$$;

REVOKE ALL ON FUNCTION public.consume_security_rate_limit(TEXT, TEXT, INTEGER, INTEGER, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_security_rate_limit(TEXT, TEXT, INTEGER, INTEGER, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.collect_service_capacity()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_database_bytes BIGINT;
  v_storage_bytes BIGINT;
  v_storage_objects BIGINT;
BEGIN
  SELECT pg_database_size(current_database()) INTO v_database_bytes;
  SELECT COALESCE(SUM((metadata->>'size')::BIGINT), 0), COUNT(*)
    INTO v_storage_bytes, v_storage_objects
    FROM storage.objects;
  RETURN jsonb_build_object(
    'database_bytes', COALESCE(v_database_bytes, 0),
    'storage_bytes', COALESCE(v_storage_bytes, 0),
    'storage_objects', COALESCE(v_storage_objects, 0),
    'measured_at', NOW()
  );
END;
$$;
REVOKE ALL ON FUNCTION public.collect_service_capacity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.collect_service_capacity() TO service_role;

INSERT INTO public.security_alert_rules(code, severity, threshold, window_minutes, description)
VALUES
  ('api_5xx_rate', 'critical', 0.05, 15, 'API 5xx ratio exceeds 5 percent'),
  ('ai_failure_rate', 'warning', 0.10, 15, 'AI provider failure ratio exceeds 10 percent'),
  ('ai_cost_usd', 'warning', 25, 1440, 'Estimated AI cost exceeds daily threshold'),
  ('database_capacity', 'critical', 0.80, 60, 'Database storage exceeds 80 percent'),
  ('storage_capacity', 'critical', 0.80, 60, 'Storage usage exceeds 80 percent'),
  ('collection_failure_rate', 'warning', 0.20, 60, 'Data collection failure ratio exceeds 20 percent'),
  ('backup_age_hours', 'critical', 30, 60, 'Latest encrypted backup is older than 30 hours'),
  ('restore_drill_age_days', 'critical', 35, 1440, 'Latest successful restore drill is older than 35 days')
ON CONFLICT (code) DO UPDATE SET
  severity = EXCLUDED.severity, threshold = EXCLUDED.threshold,
  window_minutes = EXCLUDED.window_minutes, description = EXCLUDED.description,
  updated_at = NOW();

COMMENT ON TABLE public.security_rate_limits IS 'Atomic per-scope user/IP request windows; raw IPs are never stored.';
COMMENT ON TABLE public.data_subject_requests IS 'Audited export and deletion requests for users and workspace administrators.';
COMMENT ON TABLE public.backup_restore_drills IS 'Monthly isolated-environment restore verification records.';

COMMIT;
