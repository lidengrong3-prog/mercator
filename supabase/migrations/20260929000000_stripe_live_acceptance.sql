BEGIN;

CREATE TABLE IF NOT EXISTS public.stripe_live_acceptance_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'collecting' CHECK (status IN ('collecting', 'passed', 'failed', 'expired')),
  approval_reference TEXT NOT NULL CHECK (length(trim(approval_reference)) >= 3),
  started_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 days'),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  evidence_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at > started_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_live_acceptance_collecting_workspace
  ON public.stripe_live_acceptance_runs(workspace_id) WHERE status = 'collecting';
CREATE INDEX IF NOT EXISTS idx_stripe_live_acceptance_runs_status
  ON public.stripe_live_acceptance_runs(status, started_at DESC);

CREATE TABLE IF NOT EXISTS public.stripe_live_acceptance_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.stripe_live_acceptance_runs(id) ON DELETE CASCADE,
  scenario TEXT NOT NULL CHECK (scenario IN (
    'purchase', 'renewal', 'payment_failed', 'payment_recovered',
    'cancel_period_end', 'cancel_immediate', 'refund_partial', 'refund_full',
    'webhook_replay', 'state_consistency'
  )),
  evidence_mode TEXT NOT NULL DEFAULT 'live' CHECK (evidence_mode = 'live'),
  provider_event_id TEXT,
  event_type TEXT,
  provider_object_id TEXT,
  evidence_key TEXT GENERATED ALWAYS AS (
    scenario || ':' || COALESCE(provider_event_id, '') || ':' || COALESCE(provider_object_id, '')
  ) STORED,
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (provider_event_id IS NULL OR provider_event_id ~ '^evt_'),
  CHECK (jsonb_typeof(details) = 'object'),
  CHECK (pg_column_size(details) <= 16384)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_live_acceptance_evidence_identity
  ON public.stripe_live_acceptance_evidence(run_id, evidence_key);
CREATE INDEX IF NOT EXISTS idx_stripe_live_acceptance_evidence_run
  ON public.stripe_live_acceptance_evidence(run_id, scenario, passed, observed_at DESC);

ALTER TABLE public.stripe_live_acceptance_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_live_acceptance_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stripe_live_acceptance_runs_admin_select ON public.stripe_live_acceptance_runs;
CREATE POLICY stripe_live_acceptance_runs_admin_select ON public.stripe_live_acceptance_runs
  FOR SELECT TO authenticated USING (public.is_platform_admin());
DROP POLICY IF EXISTS stripe_live_acceptance_evidence_admin_select ON public.stripe_live_acceptance_evidence;
CREATE POLICY stripe_live_acceptance_evidence_admin_select ON public.stripe_live_acceptance_evidence
  FOR SELECT TO authenticated USING (public.is_platform_admin());

REVOKE ALL ON public.stripe_live_acceptance_runs, public.stripe_live_acceptance_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.stripe_live_acceptance_runs, public.stripe_live_acceptance_evidence TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_live_acceptance_runs, public.stripe_live_acceptance_evidence TO service_role;

DROP TRIGGER IF EXISTS stripe_live_acceptance_runs_updated_at ON public.stripe_live_acceptance_runs;
CREATE TRIGGER stripe_live_acceptance_runs_updated_at
  BEFORE UPDATE ON public.stripe_live_acceptance_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.start_stripe_live_acceptance_run(
  p_workspace_id UUID,
  p_started_by UUID,
  p_approval_reference TEXT
)
RETURNS public.stripe_live_acceptance_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result public.stripe_live_acceptance_runs;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_workspace_id IS NULL OR p_started_by IS NULL OR length(trim(COALESCE(p_approval_reference, ''))) < 3 THEN
    RAISE EXCEPTION 'LIVE_ACCEPTANCE_INPUT_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = p_started_by)
    OR NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = p_workspace_id) THEN
    RAISE EXCEPTION 'LIVE_ACCEPTANCE_SCOPE_INVALID' USING ERRCODE = '42501';
  END IF;

  UPDATE public.stripe_live_acceptance_runs
  SET status = 'expired', completed_at = COALESCE(completed_at, NOW())
  WHERE workspace_id = p_workspace_id AND status = 'collecting' AND expires_at <= NOW();

  SELECT * INTO result FROM public.stripe_live_acceptance_runs
  WHERE workspace_id = p_workspace_id AND status = 'collecting'
  ORDER BY started_at DESC LIMIT 1;
  IF result.id IS NOT NULL THEN RETURN result; END IF;

  INSERT INTO public.stripe_live_acceptance_runs(workspace_id, approval_reference, started_by)
  VALUES (p_workspace_id, left(trim(p_approval_reference), 500), p_started_by)
  RETURNING * INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_stripe_live_billing_evidence(
  p_workspace_id UUID,
  p_scenario TEXT,
  p_provider_event_id TEXT,
  p_event_type TEXT,
  p_provider_object_id TEXT,
  p_observed_at TIMESTAMPTZ,
  p_passed BOOLEAN,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE active_run UUID; evidence_id UUID;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_scenario NOT IN (
    'purchase', 'renewal', 'payment_failed', 'payment_recovered',
    'cancel_period_end', 'cancel_immediate', 'refund_partial', 'refund_full',
    'webhook_replay', 'state_consistency'
  ) OR p_workspace_id IS NULL OR p_passed IS NULL THEN
    RAISE EXCEPTION 'LIVE_ACCEPTANCE_EVIDENCE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_scenario <> 'state_consistency' AND COALESCE(p_provider_event_id, '') !~ '^evt_' THEN
    RAISE EXCEPTION 'LIVE_ACCEPTANCE_EVENT_REQUIRED' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO active_run FROM public.stripe_live_acceptance_runs
  WHERE workspace_id = p_workspace_id AND status = 'collecting'
  ORDER BY started_at DESC LIMIT 1 FOR UPDATE;
  IF active_run IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.stripe_live_acceptance_evidence(
    run_id, scenario, evidence_mode, provider_event_id, event_type,
    provider_object_id, passed, details, observed_at
  ) VALUES (
    active_run, p_scenario, 'live', NULLIF(p_provider_event_id, ''), NULLIF(left(p_event_type, 120), ''),
    NULLIF(left(p_provider_object_id, 255), ''), p_passed, COALESCE(p_details, '{}'::jsonb), COALESCE(p_observed_at, NOW())
  )
  ON CONFLICT (run_id, evidence_key)
  DO UPDATE SET passed = EXCLUDED.passed, details = EXCLUDED.details,
    event_type = EXCLUDED.event_type, observed_at = EXCLUDED.observed_at
  RETURNING id INTO evidence_id;
  RETURN evidence_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_stripe_webhook_replay_evidence(p_provider_event_id TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE billing_event public.billing_events; result UUID;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO billing_event FROM public.billing_events
  WHERE provider = 'stripe' AND provider_event_id = p_provider_event_id
    AND processing_status = 'processed' AND workspace_id IS NOT NULL
  LIMIT 1;
  IF billing_event.id IS NULL THEN RETURN NULL; END IF;
  SELECT public.record_stripe_live_billing_evidence(
    billing_event.workspace_id, 'webhook_replay', billing_event.provider_event_id,
    billing_event.event_type, billing_event.provider_event_id, NOW(), TRUE,
    jsonb_build_object('deduplicated', TRUE, 'attempt_count', billing_event.attempt_count)
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.stripe_live_billing_readiness(p_run_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'run_id', run.id,
    'workspace_id', run.workspace_id,
    'status', run.status,
    'started_at', run.started_at,
    'expires_at', run.expires_at,
    'completed_at', run.completed_at,
    'scenarios', checks.scenarios,
    'ready', checks.ready AND run.status IN ('collecting', 'passed') AND run.expires_at > NOW()
  ) INTO result
  FROM public.stripe_live_acceptance_runs run
  CROSS JOIN LATERAL (
    SELECT jsonb_object_agg(required.scenario, COALESCE(evidence.passed, FALSE)) AS scenarios,
      bool_and(COALESCE(evidence.passed, FALSE)) AS ready
    FROM unnest(ARRAY[
      'purchase', 'renewal', 'payment_failed', 'payment_recovered',
      'cancel_period_end', 'cancel_immediate', 'refund_partial', 'refund_full',
      'webhook_replay', 'state_consistency'
    ]) AS required(scenario)
    LEFT JOIN LATERAL (
      SELECT bool_or(item.passed AND item.evidence_mode = 'live') AS passed
      FROM public.stripe_live_acceptance_evidence item
      WHERE item.run_id = run.id AND item.scenario = required.scenario
    ) evidence ON TRUE
  ) checks
  WHERE run.id = p_run_id;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_stripe_live_acceptance_run(
  p_run_id UUID,
  p_completed_by UUID,
  p_approval_reference TEXT
)
RETURNS public.stripe_live_acceptance_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE readiness JSONB; result public.stripe_live_acceptance_runs;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = p_completed_by)
    OR length(trim(COALESCE(p_approval_reference, ''))) < 3 THEN
    RAISE EXCEPTION 'LIVE_ACCEPTANCE_APPROVAL_INVALID' USING ERRCODE = '42501';
  END IF;
  readiness := public.stripe_live_billing_readiness(p_run_id);
  IF readiness IS NULL OR COALESCE((readiness->>'ready')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'LIVE_ACCEPTANCE_INCOMPLETE' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.stripe_live_acceptance_runs SET status = 'passed', completed_at = NOW(),
    completed_by = p_completed_by, approval_reference = left(trim(p_approval_reference), 500),
    evidence_summary = readiness
  WHERE id = p_run_id AND status = 'collecting'
  RETURNING * INTO result;
  IF result.id IS NULL THEN RAISE EXCEPTION 'LIVE_ACCEPTANCE_RUN_NOT_COLLECTING' USING ERRCODE = 'P0001'; END IF;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.start_stripe_live_acceptance_run(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_stripe_live_billing_evidence(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_stripe_webhook_replay_evidence(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stripe_live_billing_readiness(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalize_stripe_live_acceptance_run(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_stripe_live_acceptance_run(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_stripe_live_billing_evidence(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_stripe_webhook_replay_evidence(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.stripe_live_billing_readiness(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_stripe_live_acceptance_run(UUID, UUID, TEXT) TO service_role;

COMMENT ON TABLE public.stripe_live_acceptance_runs IS 'Audited Stripe live-mode release gate. No payment method or customer PII is stored.';
COMMENT ON TABLE public.stripe_live_acceptance_evidence IS 'Minimal live event evidence for billing release scenarios; raw Stripe payloads are excluded.';

COMMIT;
