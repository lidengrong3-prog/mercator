-- Billing entitlement expiry, refund handling and atomic AI token reservations.

BEGIN;

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS refund_status TEXT,
  ADD COLUMN IF NOT EXISTS refunded_amount_minor BIGINT,
  ADD COLUMN IF NOT EXISTS refund_currency TEXT,
  ADD COLUMN IF NOT EXISTS entitlement_revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS entitlement_revoke_reason TEXT;

ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_refund_status_check;
ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_refund_status_check
  CHECK (refund_status IS NULL OR refund_status IN ('pending', 'requires_action', 'succeeded', 'failed', 'cancelled', 'partial', 'full'));

ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_refunded_amount_check;
ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_refunded_amount_check
  CHECK (refunded_amount_minor IS NULL OR refunded_amount_minor >= 0);

ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

UPDATE public.billing_events
SET processing_started_at = COALESCE(processing_started_at, created_at)
WHERE processing_status = 'processing' AND processing_started_at IS NULL;

-- Stripe may retry after the worker updated the subscription but failed while
-- finalizing the event ledger. A stale processing claim is therefore safely
-- reclaimable; subscription writes remain protected by provider_updated_at.
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
    payload, processing_status, processing_started_at, attempt_count
  ) VALUES (
    'stripe', p_event_id, p_event_type, p_event_created_at,
    COALESCE(p_payload, '{}'::jsonb), 'processing', NOW(), 1
  )
  ON CONFLICT (provider, provider_event_id) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NOT NULL THEN
    RETURN TRUE;
  END IF;

  UPDATE public.billing_events
  SET processing_status = 'processing',
      processing_started_at = NOW(),
      attempt_count = attempt_count + 1,
      last_error = NULL,
      payload = COALESCE(p_payload, payload)
  WHERE provider = 'stripe'
    AND provider_event_id = p_event_id
    AND (
      processing_status = 'failed'
      OR (
        processing_status = 'processing'
        AND processing_started_at < NOW() - INTERVAL '5 minutes'
      )
    );
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
      AND entitlement_revoked_at IS NULL
      AND (
        provider <> 'stripe'
        OR current_period_end IS NULL
        OR current_period_end > NOW()
      )
    LIMIT 1
  ), 'free');
$$;

REVOKE ALL ON FUNCTION public.effective_billing_plan(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_billing_plan(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_profile_tier_from_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET tier = CASE
    WHEN NEW.status IN ('active', 'trialing')
      AND NEW.entitlement_revoked_at IS NULL
      AND (NEW.provider <> 'stripe' OR NEW.current_period_end IS NULL OR NEW.current_period_end > NOW())
    THEN NEW.plan
    ELSE 'free'
  END
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

UPDATE public.profiles AS profile
SET tier = public.effective_billing_plan(profile.id)
WHERE EXISTS (
  SELECT 1 FROM public.user_subscriptions AS subscription
  WHERE subscription.user_id = profile.id
);

CREATE TABLE IF NOT EXISTS public.ai_token_reservations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  request_id TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  reserved_tokens BIGINT NOT NULL CHECK (reserved_tokens > 0),
  actual_tokens BIGINT CHECK (actual_tokens IS NULL OR actual_tokens >= 0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'completed', 'released')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_token_reservations_active
  ON public.ai_token_reservations(user_id, period_start, expires_at)
  WHERE status = 'reserved';

ALTER TABLE public.ai_token_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_token_reservations FROM anon, authenticated;

DROP TRIGGER IF EXISTS ai_token_reservations_updated_at ON public.ai_token_reservations;
CREATE TRIGGER ai_token_reservations_updated_at
  BEFORE UPDATE ON public.ai_token_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.reserve_ai_token_quota(
  p_user_id UUID,
  p_request_id TEXT,
  p_requested_tokens BIGINT,
  p_limit_override BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  month_start TIMESTAMPTZ := date_trunc('month', NOW());
  month_end TIMESTAMPTZ := date_trunc('month', NOW()) + INTERVAL '1 month';
  quota_limit BIGINT;
  used_tokens BIGINT;
  reserved_tokens_total BIGINT;
  previous_status TEXT;
  previous_expires_at TIMESTAMPTZ;
  quota_key BIGINT;
BEGIN
  IF p_user_id IS NULL OR COALESCE(length(trim(p_request_id)), 0) < 8
    OR p_requested_tokens <= 0 OR COALESCE(p_limit_override, 0) < 0 THEN
    RAISE EXCEPTION 'INVALID_AI_QUOTA_RESERVATION' USING ERRCODE = '22023';
  END IF;

  quota_key := hashtextextended(p_user_id::text || ':ai:' || month_start::text, 0);
  PERFORM pg_advisory_xact_lock(quota_key);

  UPDATE public.ai_token_reservations
  SET status = 'released'
  WHERE user_id = p_user_id
    AND status = 'reserved'
    AND expires_at <= NOW();

  SELECT status, expires_at INTO previous_status, previous_expires_at
  FROM public.ai_token_reservations
  WHERE user_id = p_user_id AND request_id = p_request_id;

  IF previous_status = 'completed' THEN
    RETURN jsonb_build_object('allowed', FALSE, 'error', 'AI_REQUEST_ALREADY_COMPLETED');
  END IF;
  IF previous_status = 'reserved' AND previous_expires_at > NOW() THEN
    RETURN jsonb_build_object('allowed', FALSE, 'error', 'AI_REQUEST_IN_PROGRESS');
  END IF;

  SELECT monthly_ai_token_limit INTO quota_limit
  FROM public.billing_plan_entitlements
  WHERE plan = public.effective_billing_plan(p_user_id) AND active = TRUE;

  IF quota_limit IS NULL THEN
    RAISE EXCEPTION 'BILLING_ENTITLEMENTS_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;

  IF p_limit_override IS NOT NULL AND p_limit_override > 0 THEN
    quota_limit := LEAST(quota_limit, p_limit_override);
  END IF;

  SELECT
    COALESCE((
      SELECT SUM(log.total_tokens)
      FROM public.ai_request_logs AS log
      WHERE log.user_id = p_user_id
        AND log.created_at >= month_start
        AND NOT EXISTS (
          SELECT 1 FROM public.ai_token_reservations AS reservation
          WHERE reservation.user_id = log.user_id
            AND reservation.request_id = log.request_id
            AND reservation.status = 'completed'
        )
    ), 0)
    + COALESCE((
      SELECT SUM(actual_tokens)
      FROM public.ai_token_reservations
      WHERE user_id = p_user_id
        AND period_start = month_start
        AND status = 'completed'
    ), 0)
  INTO used_tokens;

  SELECT COALESCE(SUM(reserved_tokens), 0) INTO reserved_tokens_total
  FROM public.ai_token_reservations
  WHERE user_id = p_user_id
    AND period_start = month_start
    AND status = 'reserved'
    AND expires_at > NOW();

  IF quota_limit = 0 OR used_tokens + reserved_tokens_total + p_requested_tokens > quota_limit THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'error', 'AI_QUOTA_EXCEEDED',
      'limit', quota_limit,
      'used_tokens', used_tokens,
      'reserved_tokens', reserved_tokens_total,
      'remaining_tokens', GREATEST(0, quota_limit - used_tokens - reserved_tokens_total),
      'reset_at', month_end
    );
  END IF;

  INSERT INTO public.ai_token_reservations (
    user_id, request_id, period_start, reserved_tokens, actual_tokens,
    status, expires_at
  ) VALUES (
    p_user_id, p_request_id, month_start, p_requested_tokens, NULL,
    'reserved', NOW() + INTERVAL '10 minutes'
  )
  ON CONFLICT (user_id, request_id) DO UPDATE
  SET period_start = EXCLUDED.period_start,
      reserved_tokens = EXCLUDED.reserved_tokens,
      actual_tokens = NULL,
      status = 'reserved',
      expires_at = EXCLUDED.expires_at;

  RETURN jsonb_build_object(
    'allowed', TRUE,
    'limit', quota_limit,
    'used_tokens', used_tokens,
    'reserved_tokens', reserved_tokens_total + p_requested_tokens,
    'remaining_tokens', GREATEST(0, quota_limit - used_tokens - reserved_tokens_total - p_requested_tokens),
    'reset_at', month_end
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_token_quota(UUID, TEXT, BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_token_quota(UUID, TEXT, BIGINT, BIGINT) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_ai_token_reservation(
  p_user_id UUID,
  p_request_id TEXT,
  p_status TEXT,
  p_actual_tokens BIGINT DEFAULT 0
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('completed', 'released') OR p_actual_tokens < 0 THEN
    RAISE EXCEPTION 'INVALID_AI_QUOTA_FINALIZATION' USING ERRCODE = '22023';
  END IF;

  UPDATE public.ai_token_reservations
  SET status = p_status,
      actual_tokens = CASE WHEN p_status = 'completed' THEN p_actual_tokens ELSE 0 END,
      expires_at = NOW()
  WHERE user_id = p_user_id
    AND request_id = p_request_id
    AND status = 'reserved';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_ai_token_reservation(UUID, TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_ai_token_reservation(UUID, TEXT, TEXT, BIGINT) TO service_role;

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
      SELECT SUM(log.total_tokens)
      FROM public.ai_request_logs AS log
      WHERE log.user_id = p_user_id
        AND log.created_at >= date_trunc('month', NOW())
        AND NOT EXISTS (
          SELECT 1 FROM public.ai_token_reservations AS reservation
          WHERE reservation.user_id = log.user_id
            AND reservation.request_id = log.request_id
            AND reservation.status = 'completed'
        )
    ), 0)+COALESCE((
      SELECT SUM(actual_tokens)
      FROM public.ai_token_reservations
      WHERE user_id = p_user_id
        AND period_start = date_trunc('month', NOW())
        AND status = 'completed'
    ), 0),
    'ai_tokens_reserved', COALESCE((
      SELECT SUM(reserved_tokens) FROM public.ai_token_reservations
      WHERE user_id = p_user_id
        AND period_start = date_trunc('month', NOW())
        AND status = 'reserved'
        AND expires_at > NOW()
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
  IF EXISTS (
    SELECT 1 FROM public.report_runs
    WHERE user_id = NEW.user_id AND idempotency_key = NEW.idempotency_key
  ) THEN
    RETURN NEW;
  END IF;

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
  plan_features JSONB;
BEGIN
  IF NEW.idempotency_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.report_exports
    WHERE user_id = NEW.user_id AND idempotency_key = NEW.idempotency_key
  ) THEN
    RETURN NEW;
  END IF;

  quota_key := hashtextextended(NEW.user_id::text || ':export:' || date_trunc('month', NOW())::text, 0);
  PERFORM pg_advisory_xact_lock(quota_key);

  SELECT monthly_export_limit, features INTO quota_limit, plan_features
  FROM public.billing_plan_entitlements
  WHERE plan = public.effective_billing_plan(NEW.user_id) AND active = TRUE;

  IF quota_limit IS NULL OR plan_features IS NULL THEN
    RAISE EXCEPTION 'BILLING_ENTITLEMENTS_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.format = 'pdf' AND COALESCE((plan_features->>'pdf_export')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'EXPORT_FEATURE_NOT_AVAILABLE' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.format = 'docx' AND COALESCE((plan_features->>'docx_export')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'EXPORT_FEATURE_NOT_AVAILABLE' USING ERRCODE = 'P0001';
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

COMMIT;
