BEGIN;

ALTER TABLE public.system_incidents
  ADD COLUMN IF NOT EXISTS incident_priority TEXT NOT NULL DEFAULT 'P2'
    CHECK (incident_priority IN ('P0', 'P1', 'P2', 'P3')),
  ADD COLUMN IF NOT EXISTS explained BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS explanation_reference TEXT;

UPDATE public.system_incidents
SET incident_priority = CASE WHEN severity = 'critical' THEN 'P1' WHEN severity = 'warning' THEN 'P2' ELSE 'P3' END
WHERE incident_priority = 'P2' AND severity <> 'warning';

CREATE TABLE IF NOT EXISTS public.production_rollout_state (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  stage TEXT NOT NULL DEFAULT 'internal'
    CHECK (stage IN ('internal', 'invite_beta', 'public_beta', 'general')),
  stage_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registration_limit INTEGER CHECK (registration_limit IS NULL OR registration_limit >= 0),
  daily_ai_token_limit BIGINT NOT NULL DEFAULT 50000 CHECK (daily_ai_token_limit >= 0),
  invite_only BOOLEAN NOT NULL DEFAULT TRUE,
  active_acceptance_run_id UUID,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approval_reference TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.production_rollout_state(singleton, stage, registration_limit, daily_ai_token_limit, invite_only)
VALUES (TRUE, 'internal', 30, 50000, TRUE)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.production_registration_allowlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL CHECK (position('@' IN email) > 1),
  minimum_stage TEXT NOT NULL DEFAULT 'internal'
    CHECK (minimum_stage IN ('internal', 'invite_beta')),
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_production_registration_allowlist_email
  ON public.production_registration_allowlist(lower(email));

CREATE TABLE IF NOT EXISTS public.production_readiness_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_stage TEXT NOT NULL CHECK (source_stage IN ('internal', 'invite_beta', 'public_beta')),
  target_stage TEXT NOT NULL CHECK (target_stage IN ('invite_beta', 'public_beta', 'general')),
  status TEXT NOT NULL DEFAULT 'collecting' CHECK (status IN ('collecting', 'passed', 'failed', 'expired')),
  approval_reference TEXT NOT NULL CHECK (length(trim(approval_reference)) >= 3),
  started_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '45 days'),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  evidence_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at > started_at),
  CHECK (
    (source_stage = 'internal' AND target_stage = 'invite_beta')
    OR (source_stage = 'invite_beta' AND target_stage = 'public_beta')
    OR (source_stage = 'public_beta' AND target_stage = 'general')
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_production_readiness_collecting_target
  ON public.production_readiness_runs(target_stage) WHERE status = 'collecting';

CREATE TABLE IF NOT EXISTS public.production_readiness_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.production_readiness_runs(id) ON DELETE CASCADE,
  test_key TEXT NOT NULL CHECK (test_key IN (
    'read_100', 'read_500', 'read_1000',
    'ai_queue_limit', 'report_queue_limit', 'export_queue_limit',
    'large_upload', 'malicious_file', 'long_prompt', 'duplicate_submit',
    'database_connections', 'query_latency', 'storage_traffic', 'monthly_cost',
    'browser_compatibility', 'mobile', 'weak_network',
    'account_delete', 'workspace_delete', 'backup_restore',
    'data_isolation', 'report_citations', 'third_party_labels',
    'stability_14d', 'error_budget', 'ai_cost_budget',
    'collection_cost_budget', 'database_capacity_budget',
    'billing_ready', 'notification_ready', 'support_ready', 'oncall_ready'
  )),
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_source TEXT NOT NULL CHECK (evidence_source IN ('automated', 'operator')),
  artifact_digest TEXT,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(run_id, test_key),
  CHECK (jsonb_typeof(metrics) = 'object'),
  CHECK (pg_column_size(metrics) <= 32768),
  CHECK (artifact_digest IS NULL OR artifact_digest ~ '^[a-f0-9]{64}$'),
  CHECK (evidence_source <> 'automated' OR artifact_digest IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.production_load_test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  readiness_run_id UUID REFERENCES public.production_readiness_runs(id) ON DELETE SET NULL,
  profile TEXT NOT NULL CHECK (profile IN ('read_100', 'read_500', 'read_1000')),
  virtual_users INTEGER NOT NULL CHECK (virtual_users IN (100, 500, 1000)),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds BETWEEN 10 AND 1800),
  total_requests BIGINT NOT NULL CHECK (total_requests >= 0),
  failed_requests BIGINT NOT NULL CHECK (failed_requests >= 0 AND failed_requests <= total_requests),
  error_rate NUMERIC(8,6) NOT NULL CHECK (error_rate BETWEEN 0 AND 1),
  p50_ms NUMERIC NOT NULL CHECK (p50_ms >= 0),
  p95_ms NUMERIC NOT NULL CHECK (p95_ms >= 0),
  p99_ms NUMERIC NOT NULL CHECK (p99_ms >= 0),
  search_p95_ms NUMERIC NOT NULL CHECK (search_p95_ms >= 0),
  thresholds JSONB NOT NULL DEFAULT '{}'::jsonb,
  passed BOOLEAN NOT NULL,
  artifact_digest TEXT NOT NULL CHECK (artifact_digest ~ '^[a-f0-9]{64}$'),
  release_sha TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rollout_ai_daily_usage (
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reserved_tokens BIGINT NOT NULL DEFAULT 0 CHECK (reserved_tokens >= 0),
  used_tokens BIGINT NOT NULL DEFAULT 0 CHECK (used_tokens >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(usage_date, user_id)
);

CREATE TABLE IF NOT EXISTS public.rollout_ai_daily_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  reserved_tokens BIGINT NOT NULL CHECK (reserved_tokens > 0),
  actual_tokens BIGINT CHECK (actual_tokens IS NULL OR actual_tokens >= 0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'completed', 'released')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, request_id)
);

ALTER TABLE public.production_rollout_state
  ADD CONSTRAINT production_rollout_active_run_fkey
  FOREIGN KEY(active_acceptance_run_id) REFERENCES public.production_readiness_runs(id) ON DELETE SET NULL;

ALTER TABLE public.production_rollout_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_registration_allowlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_readiness_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_readiness_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_load_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rollout_ai_daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rollout_ai_daily_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS production_rollout_state_admin_select ON public.production_rollout_state;
CREATE POLICY production_rollout_state_admin_select ON public.production_rollout_state
  FOR SELECT TO authenticated USING (public.is_platform_admin());
DROP POLICY IF EXISTS production_readiness_runs_admin_select ON public.production_readiness_runs;
CREATE POLICY production_readiness_runs_admin_select ON public.production_readiness_runs
  FOR SELECT TO authenticated USING (public.is_platform_admin());
DROP POLICY IF EXISTS production_readiness_evidence_admin_select ON public.production_readiness_evidence;
CREATE POLICY production_readiness_evidence_admin_select ON public.production_readiness_evidence
  FOR SELECT TO authenticated USING (public.is_platform_admin());
DROP POLICY IF EXISTS production_load_test_runs_admin_select ON public.production_load_test_runs;
CREATE POLICY production_load_test_runs_admin_select ON public.production_load_test_runs
  FOR SELECT TO authenticated USING (public.is_platform_admin());

REVOKE ALL ON public.production_rollout_state, public.production_registration_allowlist,
  public.production_readiness_runs, public.production_readiness_evidence,
  public.production_load_test_runs, public.rollout_ai_daily_usage,
  public.rollout_ai_daily_reservations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.production_rollout_state, public.production_readiness_runs,
  public.production_readiness_evidence, public.production_load_test_runs TO authenticated;
GRANT ALL ON public.production_rollout_state, public.production_registration_allowlist,
  public.production_readiness_runs, public.production_readiness_evidence,
  public.production_load_test_runs, public.rollout_ai_daily_usage,
  public.rollout_ai_daily_reservations TO service_role;

CREATE OR REPLACE FUNCTION public.public_rollout_status()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'stage', stage,
    'invite_only', invite_only,
    'registration_limit', CASE WHEN stage = 'public_beta' THEN registration_limit ELSE NULL END,
    'registration_open', stage IN ('public_beta', 'general')
  ) FROM public.production_rollout_state WHERE singleton = TRUE;
$$;

CREATE OR REPLACE FUNCTION public.start_production_readiness_run(
  p_target_stage TEXT, p_started_by UUID, p_approval_reference TEXT
)
RETURNS public.production_readiness_runs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE state public.production_rollout_state; result public.production_readiness_runs;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO state FROM public.production_rollout_state WHERE singleton = TRUE FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = p_started_by)
    OR length(trim(COALESCE(p_approval_reference, ''))) < 3 THEN
    RAISE EXCEPTION 'ROLLOUT_APPROVAL_INVALID' USING ERRCODE = '42501';
  END IF;
  IF NOT ((state.stage = 'internal' AND p_target_stage = 'invite_beta')
    OR (state.stage = 'invite_beta' AND p_target_stage = 'public_beta')
    OR (state.stage = 'public_beta' AND p_target_stage = 'general')) THEN
    RAISE EXCEPTION 'ROLLOUT_STAGE_MUST_ADVANCE_ONE_STEP' USING ERRCODE = '22023';
  END IF;
  UPDATE public.production_readiness_runs SET status = 'expired', completed_at = COALESCE(completed_at, NOW())
  WHERE target_stage = p_target_stage AND status = 'collecting' AND expires_at <= NOW();
  SELECT * INTO result FROM public.production_readiness_runs
  WHERE source_stage = state.stage AND target_stage = p_target_stage AND status = 'collecting'
  ORDER BY started_at DESC LIMIT 1;
  IF result.id IS NOT NULL THEN RETURN result; END IF;
  INSERT INTO public.production_readiness_runs(source_stage, target_stage, approval_reference, started_by)
  VALUES(state.stage, p_target_stage, left(trim(p_approval_reference), 500), p_started_by)
  RETURNING * INTO result;
  UPDATE public.production_rollout_state SET active_acceptance_run_id = result.id WHERE singleton = TRUE;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_production_readiness_evidence(
  p_run_id UUID, p_test_key TEXT, p_passed BOOLEAN, p_evidence_source TEXT,
  p_artifact_digest TEXT DEFAULT NULL, p_metrics JSONB DEFAULT '{}'::jsonb,
  p_observed_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result UUID;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.production_readiness_runs WHERE id = p_run_id AND status = 'collecting' AND expires_at > NOW()) THEN
    RAISE EXCEPTION 'ROLLOUT_RUN_NOT_COLLECTING' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.production_readiness_evidence(
    run_id, test_key, passed, evidence_source, artifact_digest, metrics, observed_at
  ) VALUES (
    p_run_id, p_test_key, p_passed, p_evidence_source, NULLIF(lower(trim(COALESCE(p_artifact_digest, ''))), ''),
    COALESCE(p_metrics, '{}'::jsonb), COALESCE(p_observed_at, NOW())
  )
  ON CONFLICT(run_id, test_key) DO UPDATE SET
    passed = EXCLUDED.passed, evidence_source = EXCLUDED.evidence_source,
    artifact_digest = EXCLUDED.artifact_digest, metrics = EXCLUDED.metrics,
    observed_at = EXCLUDED.observed_at
  RETURNING id INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.production_readiness(p_run_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSONB;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'run_id', run.id, 'source_stage', run.source_stage, 'target_stage', run.target_stage,
    'status', run.status, 'started_at', run.started_at, 'expires_at', run.expires_at,
    'checks', checks.checks,
    'ready', checks.ready AND run.status IN ('collecting', 'passed') AND run.expires_at > NOW()
  ) INTO result
  FROM public.production_readiness_runs AS run
  CROSS JOIN LATERAL (
    SELECT jsonb_object_agg(required.test_key, COALESCE(evidence.passed, FALSE)) AS checks,
      bool_and(COALESCE(evidence.passed, FALSE)) AS ready
    FROM (
      SELECT test_key FROM unnest(CASE run.target_stage
        WHEN 'invite_beta' THEN ARRAY[
          'large_upload','malicious_file','long_prompt','duplicate_submit','browser_compatibility','mobile',
          'account_delete','workspace_delete','backup_restore','data_isolation','report_citations','third_party_labels'
        ]
        WHEN 'public_beta' THEN ARRAY[
          'read_100','read_500','ai_queue_limit','report_queue_limit','export_queue_limit',
          'large_upload','malicious_file','long_prompt','duplicate_submit','database_connections','query_latency',
          'storage_traffic','monthly_cost','browser_compatibility','mobile','weak_network','account_delete',
          'workspace_delete','backup_restore','data_isolation','report_citations','third_party_labels',
          'error_budget','ai_cost_budget','collection_cost_budget','database_capacity_budget'
        ]
        ELSE ARRAY[
          'read_100','read_500','read_1000','ai_queue_limit','report_queue_limit','export_queue_limit',
          'large_upload','malicious_file','long_prompt','duplicate_submit','database_connections','query_latency',
          'storage_traffic','monthly_cost','browser_compatibility','mobile','weak_network','account_delete',
          'workspace_delete','backup_restore','data_isolation','report_citations','third_party_labels','stability_14d',
          'error_budget','ai_cost_budget','collection_cost_budget','database_capacity_budget',
          'billing_ready','notification_ready','support_ready','oncall_ready'
        ] END) AS test_key
    ) AS required
    LEFT JOIN public.production_readiness_evidence AS evidence
      ON evidence.run_id = run.id AND evidence.test_key = required.test_key
  ) AS checks
  WHERE run.id = p_run_id;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_production_readiness_run(
  p_run_id UUID, p_completed_by UUID, p_approval_reference TEXT
)
RETURNS public.production_readiness_runs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE readiness JSONB; run public.production_readiness_runs; state public.production_rollout_state; result public.production_readiness_runs;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = p_completed_by)
    OR length(trim(COALESCE(p_approval_reference, ''))) < 3 THEN
    RAISE EXCEPTION 'ROLLOUT_APPROVAL_INVALID' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO run FROM public.production_readiness_runs WHERE id = p_run_id FOR UPDATE;
  SELECT * INTO state FROM public.production_rollout_state WHERE singleton = TRUE FOR UPDATE;
  IF run.target_stage = 'general' THEN
    IF state.stage_started_at > NOW() - INTERVAL '14 days' OR EXISTS (
      SELECT 1 FROM public.system_incidents
      WHERE incident_priority IN ('P0','P1') AND started_at >= NOW() - INTERVAL '14 days'
        AND (status <> 'resolved' OR explained = FALSE)
    ) THEN
      RAISE EXCEPTION 'ROLLOUT_STABILITY_WINDOW_INCOMPLETE' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.stripe_live_acceptance_runs
      WHERE status = 'passed' AND expires_at > NOW()
    ) THEN
      RAISE EXCEPTION 'ROLLOUT_BILLING_ACCEPTANCE_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.notification_live_acceptance_runs
      WHERE status = 'passed' AND expires_at > NOW()
    ) THEN
      RAISE EXCEPTION 'ROLLOUT_NOTIFICATION_ACCEPTANCE_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  readiness := public.production_readiness(p_run_id);
  IF readiness IS NULL OR COALESCE((readiness->>'ready')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'ROLLOUT_ACCEPTANCE_INCOMPLETE' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.production_readiness_runs SET status = 'passed', completed_at = NOW(), completed_by = p_completed_by,
    approval_reference = left(trim(p_approval_reference), 500), evidence_summary = readiness
  WHERE id = p_run_id AND status = 'collecting' AND expires_at > NOW() RETURNING * INTO result;
  IF result.id IS NULL THEN RAISE EXCEPTION 'ROLLOUT_RUN_NOT_COLLECTING' USING ERRCODE = 'P0001'; END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_production_rollout(
  p_run_id UUID, p_changed_by UUID, p_approval_reference TEXT,
  p_registration_limit INTEGER DEFAULT NULL, p_daily_ai_token_limit BIGINT DEFAULT 50000
)
RETURNS public.production_rollout_state
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE run public.production_readiness_runs; state public.production_rollout_state; result public.production_rollout_state;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = p_changed_by)
    OR length(trim(COALESCE(p_approval_reference, ''))) < 3 THEN RAISE EXCEPTION 'ROLLOUT_APPROVAL_INVALID' USING ERRCODE = '42501'; END IF;
  SELECT * INTO run FROM public.production_readiness_runs WHERE id = p_run_id AND status = 'passed' AND expires_at > NOW();
  SELECT * INTO state FROM public.production_rollout_state WHERE singleton = TRUE FOR UPDATE;
  IF run.id IS NULL OR run.source_stage <> state.stage THEN RAISE EXCEPTION 'ROLLOUT_PASSED_RUN_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF run.target_stage = 'invite_beta' AND COALESCE(p_registration_limit, 0) NOT BETWEEN 10 AND 30 THEN RAISE EXCEPTION 'INVITE_BETA_REGISTRATION_LIMIT_INVALID' USING ERRCODE = '22023'; END IF;
  IF run.target_stage = 'public_beta' AND COALESCE(p_registration_limit, 0) < 1 THEN RAISE EXCEPTION 'PUBLIC_BETA_REGISTRATION_LIMIT_REQUIRED' USING ERRCODE = '22023'; END IF;
  UPDATE public.production_rollout_state SET
    stage = run.target_stage, stage_started_at = NOW(),
    registration_limit = CASE WHEN run.target_stage IN ('invite_beta','public_beta') THEN p_registration_limit ELSE NULL END,
    daily_ai_token_limit = GREATEST(0, COALESCE(p_daily_ai_token_limit, 0)),
    invite_only = run.target_stage IN ('internal','invite_beta'),
    active_acceptance_run_id = run.id, changed_by = p_changed_by,
    approval_reference = left(trim(p_approval_reference), 500), updated_at = NOW()
  WHERE singleton = TRUE RETURNING * INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_rollout_ai_daily_quota(
  p_user_id UUID, p_request_id TEXT, p_requested_tokens BIGINT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE state public.production_rollout_state; usage public.rollout_ai_daily_usage; existing public.rollout_ai_daily_reservations; quota BIGINT; released_tokens BIGINT := 0;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_user_id IS NULL OR length(trim(COALESCE(p_request_id,''))) < 8 OR p_requested_tokens <= 0 THEN RAISE EXCEPTION 'ROLLOUT_QUOTA_INPUT_INVALID' USING ERRCODE = '22023'; END IF;
  SELECT * INTO state FROM public.production_rollout_state WHERE singleton = TRUE;
  quota := CASE WHEN state.stage = 'public_beta' THEN state.daily_ai_token_limit ELSE 0 END;
  IF quota = 0 THEN RETURN jsonb_build_object('allowed', TRUE, 'enforced', FALSE); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || CURRENT_DATE::text, 41));
  WITH released AS (
    UPDATE public.rollout_ai_daily_reservations SET status = 'released', expires_at = NOW(), actual_tokens = 0
    WHERE user_id = p_user_id AND status = 'reserved' AND expires_at <= NOW()
    RETURNING reserved_tokens
  ) SELECT COALESCE(SUM(reserved_tokens), 0) INTO released_tokens FROM released;
  IF released_tokens > 0 THEN
    UPDATE public.rollout_ai_daily_usage SET reserved_tokens = GREATEST(0, reserved_tokens - released_tokens), updated_at = NOW()
    WHERE usage_date = CURRENT_DATE AND user_id = p_user_id;
  END IF;
  SELECT * INTO existing FROM public.rollout_ai_daily_reservations WHERE user_id = p_user_id AND request_id = p_request_id;
  IF existing.id IS NOT NULL THEN
    RETURN jsonb_build_object('allowed', existing.status = 'reserved', 'enforced', TRUE, 'idempotent', TRUE,
      'reservation_status', existing.status, 'limit', quota);
  END IF;
  INSERT INTO public.rollout_ai_daily_usage(usage_date,user_id) VALUES(CURRENT_DATE,p_user_id) ON CONFLICT DO NOTHING;
  SELECT * INTO usage FROM public.rollout_ai_daily_usage WHERE usage_date = CURRENT_DATE AND user_id = p_user_id FOR UPDATE;
  IF usage.used_tokens + usage.reserved_tokens + p_requested_tokens > quota THEN
    RETURN jsonb_build_object('allowed', FALSE, 'enforced', TRUE, 'limit', quota, 'used_tokens', usage.used_tokens, 'reserved_tokens', usage.reserved_tokens);
  END IF;
  INSERT INTO public.rollout_ai_daily_reservations(user_id,request_id,reserved_tokens) VALUES(p_user_id,left(trim(p_request_id),240),p_requested_tokens);
  UPDATE public.rollout_ai_daily_usage SET reserved_tokens = reserved_tokens + p_requested_tokens, updated_at = NOW()
  WHERE usage_date = CURRENT_DATE AND user_id = p_user_id;
  RETURN jsonb_build_object('allowed', TRUE, 'enforced', TRUE, 'limit', quota, 'remaining_tokens', quota - usage.used_tokens - usage.reserved_tokens - p_requested_tokens);
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_rollout_ai_daily_quota(
  p_user_id UUID, p_request_id TEXT, p_status TEXT, p_actual_tokens BIGINT DEFAULT 0
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE reservation public.rollout_ai_daily_reservations;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('completed','released') OR p_actual_tokens < 0 THEN RAISE EXCEPTION 'ROLLOUT_QUOTA_FINALIZE_INVALID' USING ERRCODE = '22023'; END IF;
  SELECT * INTO reservation FROM public.rollout_ai_daily_reservations
  WHERE user_id = p_user_id AND request_id = p_request_id AND status = 'reserved' FOR UPDATE;
  IF reservation.id IS NULL THEN RETURN FALSE; END IF;
  UPDATE public.rollout_ai_daily_reservations SET status = p_status,
    actual_tokens = CASE WHEN p_status = 'completed' THEN p_actual_tokens ELSE 0 END, expires_at = NOW()
  WHERE id = reservation.id;
  UPDATE public.rollout_ai_daily_usage SET
    reserved_tokens = GREATEST(0,reserved_tokens-reservation.reserved_tokens),
    used_tokens = used_tokens + CASE WHEN p_status = 'completed' THEN p_actual_tokens ELSE 0 END,
    updated_at = NOW()
  WHERE usage_date = reservation.usage_date AND user_id = p_user_id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE state public.production_rollout_state; permitted BOOLEAN := FALSE;
BEGIN
  SELECT * INTO state FROM public.production_rollout_state WHERE singleton = TRUE;
  SELECT EXISTS(
    SELECT 1 FROM public.production_registration_allowlist
    WHERE lower(email) = lower(NEW.email) AND (expires_at IS NULL OR expires_at > NOW())
  ) OR EXISTS(
    SELECT 1 FROM public.workspace_invites
    WHERE lower(email) = lower(NEW.email) AND status = 'pending' AND expires_at > NOW()
  ) INTO permitted;
  IF state.stage = 'internal' AND NOT permitted THEN RAISE EXCEPTION 'REGISTRATION_INTERNAL_ONLY' USING ERRCODE = 'P0001'; END IF;
  IF state.stage = 'invite_beta' AND NOT permitted THEN RAISE EXCEPTION 'REGISTRATION_INVITE_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF state.stage IN ('invite_beta','public_beta') AND state.registration_limit IS NOT NULL
    AND (SELECT COUNT(*) FROM public.profiles) >= state.registration_limit THEN
    RAISE EXCEPTION 'REGISTRATION_CAP_REACHED' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.profiles(id,email,display_name)
  VALUES(NEW.id,NEW.email,COALESCE(NEW.raw_user_meta_data->>'display_name',split_part(NEW.email,'@',1)))
  ON CONFLICT(id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS production_rollout_state_updated_at ON public.production_rollout_state;
CREATE TRIGGER production_rollout_state_updated_at BEFORE UPDATE ON public.production_rollout_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS production_readiness_runs_updated_at ON public.production_readiness_runs;
CREATE TRIGGER production_readiness_runs_updated_at BEFORE UPDATE ON public.production_readiness_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

REVOKE ALL ON FUNCTION public.public_rollout_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_rollout_status() TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.start_production_readiness_run(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_production_readiness_evidence(UUID, TEXT, BOOLEAN, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.production_readiness(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalize_production_readiness_run(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_production_rollout(UUID, UUID, TEXT, INTEGER, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_rollout_ai_daily_quota(UUID, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_rollout_ai_daily_quota(UUID, TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_production_readiness_run(TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_production_readiness_evidence(UUID, TEXT, BOOLEAN, TEXT, TEXT, JSONB, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.production_readiness(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_production_readiness_run(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.advance_production_rollout(UUID, UUID, TEXT, INTEGER, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_rollout_ai_daily_quota(UUID, TEXT, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_rollout_ai_daily_quota(UUID, TEXT, TEXT, BIGINT) TO service_role;

COMMENT ON TABLE public.production_rollout_state IS 'Single authoritative release stage and public-beta caps.';
COMMENT ON TABLE public.production_readiness_evidence IS 'Audited load, security, cost, isolation and operational evidence for one-stage advancement.';

COMMIT;
