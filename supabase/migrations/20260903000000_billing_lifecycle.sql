-- Stripe subscription lifecycle, plan entitlements and server-side quota guards.

BEGIN;

CREATE TABLE IF NOT EXISTS public.billing_plan_entitlements (
  plan TEXT PRIMARY KEY CHECK (plan IN ('free', 'pro', 'enterprise')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  currency TEXT NOT NULL DEFAULT 'cny',
  monthly_price_minor INTEGER CHECK (monthly_price_minor IS NULL OR monthly_price_minor >= 0),
  monthly_ai_token_limit BIGINT NOT NULL CHECK (monthly_ai_token_limit >= 0),
  ai_requests_per_minute INTEGER NOT NULL CHECK (ai_requests_per_minute > 0),
  monthly_report_limit INTEGER NOT NULL CHECK (monthly_report_limit >= 0),
  monthly_export_limit INTEGER NOT NULL CHECK (monthly_export_limit >= 0),
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.billing_plan_entitlements (
  plan, currency, monthly_price_minor, monthly_ai_token_limit,
  ai_requests_per_minute, monthly_report_limit, monthly_export_limit, features
) VALUES
  ('free', 'cny', 0, 100000, 5, 5, 10,
    '{"cloud_reports":true,"pdf_export":false,"docx_export":false,"team":false}'::jsonb),
  ('pro', 'cny', 99900, 5000000, 30, 200, 400,
    '{"cloud_reports":true,"pdf_export":true,"docx_export":true,"team":true}'::jsonb),
  ('enterprise', 'cny', NULL, 50000000, 120, 2000, 4000,
    '{"cloud_reports":true,"pdf_export":true,"docx_export":true,"team":true,"private_deployment":true}'::jsonb)
ON CONFLICT (plan) DO NOTHING;

ALTER TABLE public.billing_plan_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_plan_entitlements FROM anon, authenticated;

DROP TRIGGER IF EXISTS billing_plan_entitlements_updated_at ON public.billing_plan_entitlements;
CREATE TRIGGER billing_plan_entitlements_updated_at
  BEFORE UPDATE ON public.billing_plan_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS provider_price_id TEXT,
  ADD COLUMN IF NOT EXISTS latest_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS latest_payment_status TEXT,
  ADD COLUMN IF NOT EXISTS last_payment_error TEXT,
  ADD COLUMN IF NOT EXISTS last_payment_failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_event_type TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_provider_customer
  ON public.user_subscriptions(provider, provider_customer_id)
  WHERE provider_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_provider_subscription
  ON public.user_subscriptions(provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS event_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE public.billing_events
  DROP CONSTRAINT IF EXISTS billing_events_processing_status_check;
ALTER TABLE public.billing_events
  ADD CONSTRAINT billing_events_processing_status_check
  CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed', 'ignored'));

CREATE INDEX IF NOT EXISTS idx_billing_events_processing
  ON public.billing_events(processing_status, created_at DESC);

-- Stripe retries the same event ID. Only a new or previously failed event may
-- be claimed; concurrent deliveries see false and leave the active worker alone.
CREATE OR REPLACE FUNCTION public.claim_stripe_billing_event(
  p_event_id TEXT,
  p_event_type TEXT,
  p_event_created_at TIMESTAMPTZ,
  p_payload JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_id UUID;
BEGIN
  INSERT INTO public.billing_events (
    provider, provider_event_id, event_type, event_created_at,
    payload, processing_status, attempt_count
  ) VALUES (
    'stripe', p_event_id, p_event_type, p_event_created_at,
    COALESCE(p_payload, '{}'::jsonb), 'processing', 1
  )
  ON CONFLICT (provider, provider_event_id) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NOT NULL THEN
    RETURN TRUE;
  END IF;

  UPDATE public.billing_events
  SET processing_status = 'processing',
      attempt_count = attempt_count + 1,
      last_error = NULL,
      payload = COALESCE(p_payload, payload)
  WHERE provider = 'stripe'
    AND provider_event_id = p_event_id
    AND processing_status = 'failed';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_stripe_billing_event(TEXT, TEXT, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_billing_event(TEXT, TEXT, TIMESTAMPTZ, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.effective_billing_plan(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT plan
    FROM public.user_subscriptions
    WHERE user_id = p_user_id
      AND status IN ('active', 'trialing')
    LIMIT 1
  ), 'free');
$$;

REVOKE ALL ON FUNCTION public.effective_billing_plan(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_billing_plan(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.get_user_billing_usage(p_user_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'period_start', date_trunc('month', NOW()),
    'period_end', date_trunc('month', NOW()) + INTERVAL '1 month',
    'ai_tokens', COALESCE((
      SELECT SUM(total_tokens) FROM public.ai_request_logs
      WHERE user_id = p_user_id AND created_at >= date_trunc('month', NOW())
    ), 0),
    'reports', COALESCE((
      SELECT COUNT(*) FROM public.report_runs
      WHERE user_id = p_user_id
        AND created_at >= date_trunc('month', NOW())
        AND status IN ('running', 'completed')
    ), 0),
    'exports', COALESCE((
      SELECT COUNT(*) FROM public.report_exports
      WHERE user_id = p_user_id
        AND created_at >= date_trunc('month', NOW())
        AND status IN ('queued', 'processing', 'completed')
    ), 0)
  );
$$;

REVOKE ALL ON FUNCTION public.get_user_billing_usage(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_billing_usage(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_report_run_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  quota_limit INTEGER;
  current_usage INTEGER;
  quota_key BIGINT;
BEGIN
  quota_key := hashtextextended(NEW.user_id::text || ':report:' || date_trunc('month', NOW())::text, 0);
  PERFORM pg_advisory_xact_lock(quota_key);

  SELECT monthly_report_limit INTO quota_limit
  FROM public.billing_plan_entitlements
  WHERE plan = public.effective_billing_plan(NEW.user_id) AND active = TRUE;

  IF quota_limit IS NULL THEN
    RAISE EXCEPTION 'BILLING_ENTITLEMENTS_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO current_usage
  FROM public.report_runs
  WHERE user_id = NEW.user_id
    AND created_at >= date_trunc('month', NOW())
    AND status IN ('running', 'completed');

  IF current_usage >= quota_limit THEN
    RAISE EXCEPTION 'REPORT_QUOTA_EXCEEDED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS report_runs_enforce_plan_quota ON public.report_runs;
CREATE TRIGGER report_runs_enforce_plan_quota
  BEFORE INSERT ON public.report_runs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_report_run_quota();

CREATE OR REPLACE FUNCTION public.enforce_report_export_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  quota_limit INTEGER;
  current_usage INTEGER;
  quota_key BIGINT;
BEGIN
  quota_key := hashtextextended(NEW.user_id::text || ':export:' || date_trunc('month', NOW())::text, 0);
  PERFORM pg_advisory_xact_lock(quota_key);

  SELECT monthly_export_limit INTO quota_limit
  FROM public.billing_plan_entitlements
  WHERE plan = public.effective_billing_plan(NEW.user_id) AND active = TRUE;

  IF quota_limit IS NULL THEN
    RAISE EXCEPTION 'BILLING_ENTITLEMENTS_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO current_usage
  FROM public.report_exports
  WHERE user_id = NEW.user_id
    AND created_at >= date_trunc('month', NOW())
    AND status IN ('queued', 'processing', 'completed');

  IF current_usage >= quota_limit THEN
    RAISE EXCEPTION 'EXPORT_QUOTA_EXCEEDED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS report_exports_enforce_plan_quota ON public.report_exports;
CREATE TRIGGER report_exports_enforce_plan_quota
  BEFORE INSERT ON public.report_exports
  FOR EACH ROW EXECUTE FUNCTION public.enforce_report_export_quota();

COMMIT;
