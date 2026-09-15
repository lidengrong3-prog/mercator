-- Workspace-scoped plans, seats and atomic monthly usage.
-- Personal subscriptions remain as a legacy compatibility source only. New
-- authorization and quota checks resolve through the active workspace.

BEGIN;

ALTER TABLE public.billing_plan_entitlements
  ADD COLUMN IF NOT EXISTS seat_limit INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.billing_plan_entitlements
  DROP CONSTRAINT IF EXISTS billing_plan_entitlements_seat_limit_check;
ALTER TABLE public.billing_plan_entitlements
  ADD CONSTRAINT billing_plan_entitlements_seat_limit_check CHECK (seat_limit > 0);

UPDATE public.billing_plan_entitlements
SET seat_limit = CASE plan
  WHEN 'pro' THEN 5
  WHEN 'enterprise' THEN 50
  ELSE 1
END
WHERE seat_limit IS NULL OR seat_limit = 1;

CREATE TABLE IF NOT EXISTS public.workspace_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired')),
  provider TEXT NOT NULL DEFAULT 'internal' CHECK (provider IN ('internal', 'stripe', 'manual')),
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  provider_price_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  latest_invoice_id TEXT,
  latest_payment_status TEXT,
  last_payment_error TEXT,
  last_payment_failed_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  refund_status TEXT,
  refunded_amount_minor BIGINT CHECK (refunded_amount_minor IS NULL OR refunded_amount_minor >= 0),
  refund_currency TEXT,
  entitlement_revoked_at TIMESTAMPTZ,
  entitlement_revoke_reason TEXT,
  provider_updated_at TIMESTAMPTZ,
  last_event_type TEXT,
  seat_limit INTEGER NOT NULL DEFAULT 1 CHECK (seat_limit > 0),
  monthly_ai_token_limit_override BIGINT CHECK (monthly_ai_token_limit_override IS NULL OR monthly_ai_token_limit_override >= 0),
  ai_requests_per_minute_override INTEGER CHECK (ai_requests_per_minute_override IS NULL OR ai_requests_per_minute_override > 0),
  monthly_report_limit_override INTEGER CHECK (monthly_report_limit_override IS NULL OR monthly_report_limit_override >= 0),
  monthly_export_limit_override INTEGER CHECK (monthly_export_limit_override IS NULL OR monthly_export_limit_override >= 0),
  manual_reason TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_subscriptions_provider_customer
  ON public.workspace_subscriptions(provider, provider_customer_id)
  WHERE provider_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_subscriptions_provider_subscription
  ON public.workspace_subscriptions(provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_subscriptions_plan_status
  ON public.workspace_subscriptions(plan, status);

-- Promote a legacy personal subscription only when the owner has one
-- workspace. Multiple workspaces always start independently on free so a paid
-- workspace cannot leak its entitlement into another team.
INSERT INTO public.workspace_subscriptions (
  workspace_id, plan, status, provider, provider_customer_id,
  provider_subscription_id, current_period_start, current_period_end,
  cancel_at_period_end, created_by, seat_limit
)
SELECT workspace.id,
  CASE WHEN workspace_count.total = 1 THEN COALESCE(subscription.plan, 'free') ELSE 'free' END,
  CASE WHEN workspace_count.total = 1 THEN COALESCE(subscription.status, 'active') ELSE 'active' END,
  CASE WHEN workspace_count.total = 1 THEN COALESCE(subscription.provider, 'internal') ELSE 'internal' END,
  CASE WHEN workspace_count.total = 1 THEN subscription.provider_customer_id ELSE NULL END,
  CASE WHEN workspace_count.total = 1 THEN subscription.provider_subscription_id ELSE NULL END,
  CASE WHEN workspace_count.total = 1 THEN subscription.current_period_start ELSE NULL END,
  CASE WHEN workspace_count.total = 1 THEN subscription.current_period_end ELSE NULL END,
  CASE WHEN workspace_count.total = 1 THEN COALESCE(subscription.cancel_at_period_end, FALSE) ELSE FALSE END,
  workspace.owner_id,
  CASE
    WHEN workspace_count.total = 1 AND subscription.plan = 'pro' THEN 5
    WHEN workspace_count.total = 1 AND subscription.plan = 'enterprise' THEN 50
    ELSE 1
  END
FROM public.workspaces AS workspace
JOIN (
  SELECT owner_id, COUNT(*)::INTEGER AS total
  FROM public.workspaces
  GROUP BY owner_id
) AS workspace_count ON workspace_count.owner_id = workspace.owner_id
LEFT JOIN public.user_subscriptions AS subscription ON subscription.user_id = workspace.owner_id
ON CONFLICT (workspace_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_workspace_subscription()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.workspace_subscriptions (workspace_id, plan, status, provider, seat_limit, created_by)
  VALUES (NEW.id, 'free', 'active', 'internal', CASE WHEN NEW.acceptance_run_id IS NOT NULL THEN 10 ELSE 1 END, NEW.owner_id)
  ON CONFLICT (workspace_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS ensure_workspace_subscription ON public.workspaces;
CREATE TRIGGER ensure_workspace_subscription AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.ensure_workspace_subscription();

CREATE TABLE IF NOT EXISTS public.workspace_usage_monthly (
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  ai_tokens_used BIGINT NOT NULL DEFAULT 0 CHECK (ai_tokens_used >= 0),
  ai_tokens_reserved BIGINT NOT NULL DEFAULT 0 CHECK (ai_tokens_reserved >= 0),
  reports_used INTEGER NOT NULL DEFAULT 0 CHECK (reports_used >= 0),
  exports_used INTEGER NOT NULL DEFAULT 0 CHECK (exports_used >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, period_start)
);
CREATE INDEX IF NOT EXISTS idx_workspace_usage_monthly_period
  ON public.workspace_usage_monthly(period_start, workspace_id);

-- A request log is written after the provider call, so counting logs alone is
-- racy for concurrent requests from one member. This short-lived window table
-- is the authoritative per-member limiter; failed provider calls still count
-- as attempts for the current minute.
CREATE TABLE IF NOT EXISTS public.workspace_member_usage_minute (
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  ai_requests_used INTEGER NOT NULL DEFAULT 0 CHECK (ai_requests_used >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id, window_start)
);
CREATE INDEX IF NOT EXISTS idx_workspace_member_usage_minute_expiry
  ON public.workspace_member_usage_minute(window_start);
ALTER TABLE public.workspace_member_usage_minute ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_member_usage_minute FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_member_usage_minute TO service_role;
DROP TRIGGER IF EXISTS workspace_member_usage_minute_updated_at ON public.workspace_member_usage_minute;
CREATE TRIGGER workspace_member_usage_minute_updated_at BEFORE UPDATE ON public.workspace_member_usage_minute
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_billing_events_workspace_created
  ON public.billing_events(workspace_id, created_at DESC);

ALTER TABLE public.workspace_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_usage_monthly ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_subscriptions_select_member ON public.workspace_subscriptions;
CREATE POLICY workspace_subscriptions_select_member ON public.workspace_subscriptions
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS workspace_usage_monthly_select_member ON public.workspace_usage_monthly;
CREATE POLICY workspace_usage_monthly_select_member ON public.workspace_usage_monthly
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
REVOKE ALL ON public.workspace_subscriptions, public.workspace_usage_monthly FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.workspace_subscriptions, public.workspace_usage_monthly FROM authenticated;
GRANT SELECT ON public.workspace_subscriptions, public.workspace_usage_monthly TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_subscriptions, public.workspace_usage_monthly TO service_role;
DROP TRIGGER IF EXISTS workspace_subscriptions_updated_at ON public.workspace_subscriptions;
CREATE TRIGGER workspace_subscriptions_updated_at BEFORE UPDATE ON public.workspace_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS workspace_usage_monthly_updated_at ON public.workspace_usage_monthly;
CREATE TRIGGER workspace_usage_monthly_updated_at BEFORE UPDATE ON public.workspace_usage_monthly
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Rows created before this migration are assigned to the same workspace as
-- their report, then to the owner's first active workspace.
ALTER TABLE public.report_runs
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.ai_request_logs
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.ai_token_reservations
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

UPDATE public.report_runs AS target
SET workspace_id = report.workspace_id
FROM public.generated_reports AS report
WHERE target.workspace_id IS NULL AND target.report_id = report.id AND report.workspace_id IS NOT NULL;
UPDATE public.report_runs AS target
SET workspace_id = (
  SELECT member.workspace_id FROM public.workspace_members AS member
  WHERE member.user_id = target.user_id AND member.status = 'active'
  ORDER BY (member.role = 'owner') DESC, member.joined_at ASC LIMIT 1
)
WHERE target.workspace_id IS NULL;
UPDATE public.ai_request_logs AS target
SET workspace_id = run.workspace_id
FROM public.report_runs AS run
WHERE target.workspace_id IS NULL AND target.report_run_id = run.id AND run.workspace_id IS NOT NULL;
UPDATE public.ai_request_logs AS target
SET workspace_id = report.workspace_id
FROM public.generated_reports AS report
WHERE target.workspace_id IS NULL AND target.report_id = report.id AND report.workspace_id IS NOT NULL;
UPDATE public.ai_request_logs AS target
SET workspace_id = (
  SELECT member.workspace_id FROM public.workspace_members AS member
  WHERE member.user_id = target.user_id AND member.status = 'active'
  ORDER BY (member.role = 'owner') DESC, member.joined_at ASC LIMIT 1
)
WHERE target.workspace_id IS NULL;
UPDATE public.ai_token_reservations AS target
SET workspace_id = (
  SELECT log.workspace_id FROM public.ai_request_logs AS log
  WHERE log.user_id = target.user_id AND log.request_id = target.request_id
  ORDER BY log.created_at DESC LIMIT 1
)
WHERE target.workspace_id IS NULL;
UPDATE public.ai_token_reservations AS target
SET workspace_id = (
  SELECT member.workspace_id FROM public.workspace_members AS member
  WHERE member.user_id = target.user_id AND member.status = 'active'
  ORDER BY (member.role = 'owner') DESC, member.joined_at ASC LIMIT 1
)
WHERE target.workspace_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.report_runs WHERE workspace_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.ai_request_logs WHERE workspace_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.ai_token_reservations WHERE workspace_id IS NULL) THEN
    RAISE EXCEPTION 'workspace billing backfill failed: legacy row has no active workspace';
  END IF;
END;
$$;

ALTER TABLE public.report_runs ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.ai_request_logs ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.ai_token_reservations ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_report_runs_workspace_created ON public.report_runs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_workspace_created ON public.ai_request_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_token_reservations_workspace_active
  ON public.ai_token_reservations(workspace_id, period_start, expires_at) WHERE status = 'reserved';
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_token_reservations_workspace_request
  ON public.ai_token_reservations(workspace_id, request_id);

-- The preceding entitlement migration created account-scoped uniqueness. It
-- must not remain as a second arbiter once a member can use more than one
-- workspace; the workspace key is the authoritative idempotency boundary.
ALTER TABLE public.ai_token_reservations
  DROP CONSTRAINT IF EXISTS ai_token_reservations_user_id_request_id_key;

DROP INDEX IF EXISTS public.idx_report_exports_idempotency;
DROP INDEX IF EXISTS public.idx_report_exports_user_idempotency_complete;
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_exports_workspace_idempotency
  ON public.report_exports(workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.report_runs DROP CONSTRAINT IF EXISTS report_runs_user_id_idempotency_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_runs_workspace_idempotency
  ON public.report_runs(workspace_id, idempotency_key);

-- Reconcile the current period once, then all subsequent writes go through
-- the atomic RPCs/triggers below.
INSERT INTO public.workspace_usage_monthly (workspace_id, period_start, ai_tokens_used, ai_tokens_reserved, reports_used, exports_used)
SELECT workspace.id, date_trunc('month', NOW()),
  COALESCE((SELECT SUM(log.total_tokens) FROM public.ai_request_logs log
    WHERE log.workspace_id = workspace.id AND log.created_at >= date_trunc('month', NOW())
      AND log.status = 'completed'), 0),
  COALESCE((SELECT SUM(reservation.reserved_tokens) FROM public.ai_token_reservations reservation
    WHERE reservation.workspace_id = workspace.id AND reservation.period_start = date_trunc('month', NOW())
      AND reservation.status = 'reserved' AND reservation.expires_at > NOW()), 0),
  COALESCE((SELECT COUNT(*) FROM public.report_runs run
    WHERE run.workspace_id = workspace.id AND run.created_at >= date_trunc('month', NOW())
      AND run.status IN ('running', 'completed')), 0),
  COALESCE((SELECT COUNT(*) FROM public.report_exports export
    WHERE export.workspace_id = workspace.id AND export.created_at >= date_trunc('month', NOW())
      AND export.status IN ('queued', 'processing', 'completed')), 0)
FROM public.workspaces AS workspace
ON CONFLICT (workspace_id, period_start) DO UPDATE SET
  ai_tokens_used = EXCLUDED.ai_tokens_used,
  ai_tokens_reserved = EXCLUDED.ai_tokens_reserved,
  reports_used = EXCLUDED.reports_used,
  exports_used = EXCLUDED.exports_used;

CREATE OR REPLACE FUNCTION public.workspace_effective_entitlement(p_workspace_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  subscription public.workspace_subscriptions%ROWTYPE;
  entitlement public.billing_plan_entitlements%ROWTYPE;
  subscription_was_downgraded BOOLEAN := FALSE;
  effective_seat_limit INTEGER;
  result JSONB;
BEGIN
  IF p_workspace_id IS NULL OR NOT public.is_workspace_member(p_workspace_id, p_user_id) THEN
    RAISE EXCEPTION 'WORKSPACE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO subscription FROM public.workspace_subscriptions WHERE workspace_id = p_workspace_id;
  IF subscription.id IS NULL THEN
    RAISE EXCEPTION 'BILLING_ENTITLEMENTS_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;
  IF subscription.status NOT IN ('active', 'trialing')
    OR subscription.entitlement_revoked_at IS NOT NULL
    OR (subscription.provider = 'stripe' AND subscription.current_period_end IS NOT NULL AND subscription.current_period_end <= NOW()) THEN
    subscription_was_downgraded := subscription.plan <> 'free';
    subscription.plan := 'free';
  END IF;
  SELECT * INTO entitlement FROM public.billing_plan_entitlements
  WHERE plan = subscription.plan AND active = TRUE;
  IF entitlement.plan IS NULL THEN
    RAISE EXCEPTION 'BILLING_ENTITLEMENTS_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;
  -- A lapsed paid subscription must also lose its paid seats. Manual seat
  -- overrides are honored only while the subscription is active/trialing.
  effective_seat_limit := CASE
    WHEN subscription_was_downgraded THEN entitlement.seat_limit
    ELSE GREATEST(1, COALESCE(subscription.seat_limit, entitlement.seat_limit))
  END;
  result := jsonb_build_object(
    'workspace_id', p_workspace_id,
    'plan', entitlement.plan,
    'currency', entitlement.currency,
    'monthly_price_minor', entitlement.monthly_price_minor,
    'seat_limit', effective_seat_limit,
    'monthly_ai_token_limit', CASE WHEN subscription_was_downgraded THEN entitlement.monthly_ai_token_limit ELSE COALESCE(subscription.monthly_ai_token_limit_override, entitlement.monthly_ai_token_limit) END,
    'ai_requests_per_minute', CASE WHEN subscription_was_downgraded THEN entitlement.ai_requests_per_minute ELSE COALESCE(subscription.ai_requests_per_minute_override, entitlement.ai_requests_per_minute) END,
    'monthly_report_limit', CASE WHEN subscription_was_downgraded THEN entitlement.monthly_report_limit ELSE COALESCE(subscription.monthly_report_limit_override, entitlement.monthly_report_limit) END,
    'monthly_export_limit', CASE WHEN subscription_was_downgraded THEN entitlement.monthly_export_limit ELSE COALESCE(subscription.monthly_export_limit_override, entitlement.monthly_export_limit) END,
    'features', entitlement.features,
    'provider', subscription.provider
  );
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.workspace_effective_entitlement(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_effective_entitlement(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.effective_billing_plan(p_workspace_id UUID, p_user_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT workspace_effective_entitlement(p_workspace_id, p_user_id)->>'plan';
$$;
REVOKE ALL ON FUNCTION public.effective_billing_plan(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_billing_plan(UUID, UUID) TO service_role;

-- Legacy callers are resolved to the user's first active workspace. They no
-- longer read profiles.tier or a different member's personal subscription.
CREATE OR REPLACE FUNCTION public.effective_billing_plan(p_user_id UUID)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE workspace_id UUID;
BEGIN
  SELECT member.workspace_id INTO workspace_id FROM public.workspace_members member
  WHERE member.user_id = p_user_id AND member.status = 'active'
  ORDER BY (member.role = 'owner') DESC, member.joined_at ASC LIMIT 1;
  IF workspace_id IS NOT NULL THEN RETURN public.effective_billing_plan(workspace_id, p_user_id); END IF;
  RETURN COALESCE((SELECT plan FROM public.user_subscriptions WHERE user_id = p_user_id AND status IN ('active', 'trialing') LIMIT 1), 'free');
END;
$$;
REVOKE ALL ON FUNCTION public.effective_billing_plan(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_billing_plan(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.get_workspace_billing_usage(p_workspace_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  month_start TIMESTAMPTZ := date_trunc('month', NOW());
  usage_row public.workspace_usage_monthly%ROWTYPE;
  entitlement JSONB;
  active_seats INTEGER;
  pending_seats INTEGER;
  member_usage JSONB;
BEGIN
  entitlement := public.workspace_effective_entitlement(p_workspace_id, p_user_id);
  SELECT * INTO usage_row FROM public.workspace_usage_monthly
  WHERE workspace_id = p_workspace_id AND period_start = month_start;
  SELECT COUNT(*)::INTEGER INTO active_seats FROM public.workspace_members
  WHERE workspace_id = p_workspace_id AND status = 'active';
  SELECT COUNT(*)::INTEGER INTO pending_seats
  FROM public.workspace_invites invite
  WHERE invite.workspace_id = p_workspace_id
    AND invite.status = 'pending'
    AND invite.expires_at > NOW()
    AND NOT EXISTS (
      SELECT 1
      FROM public.profiles profile
      JOIN public.workspace_members member
        ON member.workspace_id = invite.workspace_id
       AND member.user_id = profile.id
       AND member.status = 'active'
      WHERE lower(profile.email) = lower(invite.email)
    );
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'user_id', totals.user_id,
      'ai_tokens', totals.ai_tokens,
      'reports', totals.reports,
      'exports', totals.exports
    ) ORDER BY totals.ai_tokens DESC, totals.user_id
  ), '[]'::jsonb) INTO member_usage
  FROM (
    SELECT source.user_id,
      SUM(source.ai_tokens)::BIGINT AS ai_tokens,
      SUM(source.reports)::BIGINT AS reports,
      SUM(source.exports)::BIGINT AS exports
    FROM (
      SELECT log.user_id, SUM(log.total_tokens)::BIGINT AS ai_tokens, 0::BIGINT AS reports, 0::BIGINT AS exports
      FROM public.ai_request_logs log
      WHERE log.workspace_id = p_workspace_id AND log.created_at >= month_start AND log.status = 'completed'
      GROUP BY log.user_id
      UNION ALL
      SELECT run.user_id, 0::BIGINT, COUNT(*)::BIGINT, 0::BIGINT
      FROM public.report_runs run
      WHERE run.workspace_id = p_workspace_id AND run.created_at >= month_start AND run.status IN ('running', 'completed')
      GROUP BY run.user_id
      UNION ALL
      SELECT export.user_id, 0::BIGINT, 0::BIGINT, COUNT(*)::BIGINT
      FROM public.report_exports export
      WHERE export.workspace_id = p_workspace_id AND export.created_at >= month_start AND export.status IN ('queued', 'processing', 'completed')
      GROUP BY export.user_id
    ) AS source
    GROUP BY source.user_id
  ) AS totals;
  RETURN entitlement || jsonb_build_object(
    'period_start', month_start,
    'period_end', month_start + INTERVAL '1 month',
    'ai_tokens', COALESCE(usage_row.ai_tokens_used, 0),
    'ai_tokens_reserved', COALESCE(usage_row.ai_tokens_reserved, 0),
    'reports', COALESCE(usage_row.reports_used, 0),
    'exports', COALESCE(usage_row.exports_used, 0),
    'active_seats', active_seats,
    'pending_seats', pending_seats,
    'seats_in_use', active_seats + pending_seats,
    'seat_limit', (entitlement->>'seat_limit')::INTEGER,
    'member_usage', member_usage
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_workspace_billing_usage(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace_billing_usage(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.workspace_seat_available(
  p_workspace_id UUID,
  p_requested_count INTEGER DEFAULT 1,
  p_exclude_email TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  subscription public.workspace_subscriptions%ROWTYPE;
  seat_limit INTEGER;
  active_count INTEGER;
  pending_count INTEGER;
BEGIN
  -- Authorization is enforced by assert_workspace_seat_available; this
  -- lower-level helper is also called from BEFORE triggers before a new member
  -- row exists, so it must not require that incoming member to be active yet.
  IF p_requested_count IS NULL OR p_requested_count < 0 THEN
    RETURN FALSE;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace_id::text || ':seat', 0));
  SELECT * INTO subscription FROM public.workspace_subscriptions
  WHERE workspace_id = p_workspace_id;
  IF subscription.id IS NULL THEN RETURN FALSE; END IF;
  IF subscription.status NOT IN ('active', 'trialing')
    OR subscription.entitlement_revoked_at IS NOT NULL
    OR (subscription.provider = 'stripe' AND subscription.current_period_end IS NOT NULL AND subscription.current_period_end <= NOW()) THEN
    SELECT entitlement.seat_limit INTO seat_limit
    FROM public.billing_plan_entitlements entitlement
    WHERE entitlement.plan = 'free' AND entitlement.active = TRUE;
  ELSE
    seat_limit := subscription.seat_limit;
  END IF;
  IF seat_limit IS NULL THEN RETURN FALSE; END IF;
  SELECT COUNT(*)::INTEGER INTO active_count FROM public.workspace_members
  WHERE workspace_id = p_workspace_id AND status = 'active';
  SELECT COUNT(*)::INTEGER INTO pending_count
  FROM public.workspace_invites invite
  WHERE invite.workspace_id = p_workspace_id AND invite.status = 'pending' AND invite.expires_at > NOW()
    AND (p_exclude_email IS NULL OR lower(invite.email) <> lower(p_exclude_email))
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles profile
      JOIN public.workspace_members member ON member.workspace_id = invite.workspace_id AND member.user_id = profile.id AND member.status = 'active'
      WHERE lower(profile.email) = lower(invite.email)
    );
  RETURN active_count + pending_count + p_requested_count <= seat_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.workspace_seat_available(UUID, INTEGER, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_seat_available(UUID, INTEGER, TEXT, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_workspace_seat_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  workspace_id UUID := COALESCE(NEW.workspace_id, OLD.workspace_id);
  email TEXT := NULL;
BEGIN
  IF TG_TABLE_NAME = 'workspace_invites' AND NEW.status = 'pending' THEN
    email := NEW.email;
    IF NOT public.workspace_seat_available(workspace_id, 1, email, NEW.invited_by) THEN
      RAISE EXCEPTION 'WORKSPACE_SEAT_LIMIT_REACHED' USING ERRCODE = 'P0001';
    END IF;
  ELSIF TG_TABLE_NAME = 'workspace_members' AND NEW.status = 'active'
    AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    SELECT profile.email INTO email FROM public.profiles profile WHERE profile.id = NEW.user_id;
    -- The incoming member is not active yet, so authorize the check with the
    -- workspace owner while excluding this member's matching pending invite.
    IF NOT public.workspace_seat_available(workspace_id, 1, email,
      (SELECT owner_id FROM public.workspaces WHERE id = workspace_id)) THEN
      RAISE EXCEPTION 'WORKSPACE_SEAT_LIMIT_REACHED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS workspace_invites_seat_limit ON public.workspace_invites;
CREATE TRIGGER workspace_invites_seat_limit BEFORE INSERT OR UPDATE OF workspace_id, status, expires_at ON public.workspace_invites
  FOR EACH ROW EXECUTE FUNCTION public.guard_workspace_seat_limit();
DROP TRIGGER IF EXISTS workspace_members_seat_limit ON public.workspace_members;
CREATE TRIGGER workspace_members_seat_limit BEFORE INSERT OR UPDATE OF workspace_id, user_id, status ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_workspace_seat_limit();

-- The invite endpoint calls the same check explicitly so it can return a
-- stable client error before attempting to send email.
CREATE OR REPLACE FUNCTION public.assert_workspace_seat_available(
  p_workspace_id UUID, p_email TEXT DEFAULT NULL, p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_workspace_member(p_workspace_id, p_user_id) THEN
    RAISE EXCEPTION 'WORKSPACE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF NOT public.workspace_seat_available(p_workspace_id, 1, p_email, p_user_id) THEN
    RAISE EXCEPTION 'WORKSPACE_SEAT_LIMIT_REACHED' USING ERRCODE = 'P0001';
  END IF;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_workspace_seat_available(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_workspace_seat_available(UUID, TEXT, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_workspace_ai_token_quota(
  p_workspace_id UUID, p_user_id UUID, p_request_id TEXT, p_requested_tokens BIGINT,
  p_limit_override BIGINT DEFAULT NULL, p_acceptance_run_id TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  month_start TIMESTAMPTZ := date_trunc('month', NOW());
  month_end TIMESTAMPTZ := date_trunc('month', NOW()) + INTERVAL '1 month';
  entitlement JSONB;
  quota_limit BIGINT;
  usage_row public.workspace_usage_monthly%ROWTYPE;
  previous public.ai_token_reservations%ROWTYPE;
  rate_row public.workspace_member_usage_minute%ROWTYPE;
  expired_reserved BIGINT;
  quota_key BIGINT;
  rate_key BIGINT;
  v_window_start TIMESTAMPTZ := date_trunc('minute', NOW());
  rate_limit INTEGER;
BEGIN
  IF p_workspace_id IS NULL OR p_user_id IS NULL OR length(trim(p_request_id)) < 8 OR p_requested_tokens <= 0
    OR (p_limit_override IS NOT NULL AND p_limit_override < 0)
    OR NOT public.is_workspace_member(p_workspace_id, p_user_id) THEN
    RAISE EXCEPTION 'WORKSPACE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  quota_key := hashtextextended(p_workspace_id::text || ':ai:' || month_start::text, 0);
  PERFORM pg_advisory_xact_lock(quota_key);
  INSERT INTO public.workspace_usage_monthly (workspace_id, period_start)
  VALUES (p_workspace_id, month_start) ON CONFLICT DO NOTHING;
  SELECT * INTO usage_row FROM public.workspace_usage_monthly WHERE workspace_id = p_workspace_id AND period_start = month_start FOR UPDATE;
  SELECT COALESCE(SUM(reserved_tokens), 0) INTO expired_reserved FROM public.ai_token_reservations
  WHERE workspace_id = p_workspace_id AND period_start = month_start AND status = 'reserved' AND expires_at <= NOW();
  IF expired_reserved > 0 THEN
    UPDATE public.ai_token_reservations SET status = 'released', expires_at = NOW()
    WHERE workspace_id = p_workspace_id AND period_start = month_start AND status = 'reserved' AND expires_at <= NOW();
    UPDATE public.workspace_usage_monthly SET ai_tokens_reserved = GREATEST(0, ai_tokens_reserved - expired_reserved)
    WHERE workspace_id = p_workspace_id AND period_start = month_start;
    SELECT * INTO usage_row FROM public.workspace_usage_monthly WHERE workspace_id = p_workspace_id AND period_start = month_start FOR UPDATE;
  END IF;
  SELECT * INTO previous FROM public.ai_token_reservations WHERE workspace_id = p_workspace_id AND request_id = p_request_id FOR UPDATE;
  IF previous.status = 'completed' THEN RETURN jsonb_build_object('allowed', FALSE, 'error', 'AI_REQUEST_ALREADY_COMPLETED'); END IF;
  IF previous.status = 'reserved' AND previous.expires_at > NOW() THEN RETURN jsonb_build_object('allowed', FALSE, 'error', 'AI_REQUEST_IN_PROGRESS'); END IF;
  entitlement := public.workspace_effective_entitlement(p_workspace_id, p_user_id);
  quota_limit := (entitlement->>'monthly_ai_token_limit')::BIGINT;
  rate_limit := GREATEST(1, (entitlement->>'ai_requests_per_minute')::INTEGER);
  rate_key := hashtextextended(p_workspace_id::text || ':' || p_user_id::text || ':ai-minute:' || v_window_start::text, 0);
  PERFORM pg_advisory_xact_lock(rate_key);
  -- Prune only this member's old windows while holding its limiter lock.
  DELETE FROM public.workspace_member_usage_minute AS minute_usage
  WHERE minute_usage.workspace_id = p_workspace_id AND minute_usage.user_id = p_user_id
    AND minute_usage.window_start < v_window_start - INTERVAL '2 hours';
  INSERT INTO public.workspace_member_usage_minute (workspace_id, user_id, window_start)
  VALUES (p_workspace_id, p_user_id, v_window_start) ON CONFLICT DO NOTHING;
  SELECT * INTO rate_row FROM public.workspace_member_usage_minute
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id AND window_start = v_window_start
  FOR UPDATE;
  IF rate_row.ai_requests_used >= rate_limit THEN
    RETURN jsonb_build_object('allowed', FALSE, 'error', 'AI_RATE_LIMITED', 'limit', rate_limit,
      'used_requests', rate_row.ai_requests_used, 'retry_after', 60 - EXTRACT(SECOND FROM NOW())::INTEGER);
  END IF;
  IF p_limit_override IS NOT NULL AND p_limit_override > 0 THEN quota_limit := LEAST(quota_limit, p_limit_override); END IF;
  IF quota_limit = 0 OR usage_row.ai_tokens_used + usage_row.ai_tokens_reserved + p_requested_tokens > quota_limit THEN
    RETURN jsonb_build_object('allowed', FALSE, 'error', 'AI_QUOTA_EXCEEDED', 'limit', quota_limit,
      'used_tokens', usage_row.ai_tokens_used, 'reserved_tokens', usage_row.ai_tokens_reserved,
      'remaining_tokens', GREATEST(0, quota_limit - usage_row.ai_tokens_used - usage_row.ai_tokens_reserved), 'reset_at', month_end);
  END IF;
  INSERT INTO public.ai_token_reservations (workspace_id, user_id, request_id, period_start, reserved_tokens, status, expires_at, acceptance_run_id)
  VALUES (p_workspace_id, p_user_id, p_request_id, month_start, p_requested_tokens, 'reserved', NOW() + INTERVAL '10 minutes', NULLIF(left(trim(p_acceptance_run_id), 160), ''))
  ON CONFLICT (workspace_id, request_id) DO UPDATE SET period_start = EXCLUDED.period_start, reserved_tokens = EXCLUDED.reserved_tokens, actual_tokens = NULL, status = 'reserved', expires_at = EXCLUDED.expires_at, acceptance_run_id = EXCLUDED.acceptance_run_id;
  UPDATE public.workspace_member_usage_minute SET ai_requests_used = ai_requests_used + 1
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id AND window_start = v_window_start;
  UPDATE public.workspace_usage_monthly SET ai_tokens_reserved = ai_tokens_reserved + p_requested_tokens
  WHERE workspace_id = p_workspace_id AND period_start = month_start;
  RETURN jsonb_build_object('allowed', TRUE, 'limit', quota_limit, 'used_tokens', usage_row.ai_tokens_used,
    'reserved_tokens', usage_row.ai_tokens_reserved + p_requested_tokens,
    'remaining_tokens', GREATEST(0, quota_limit - usage_row.ai_tokens_used - usage_row.ai_tokens_reserved - p_requested_tokens), 'reset_at', month_end);
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_workspace_ai_token_quota(UUID, UUID, TEXT, BIGINT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_workspace_ai_token_quota(UUID, UUID, TEXT, BIGINT, BIGINT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_workspace_ai_token_reservation(
  p_workspace_id UUID, p_user_id UUID, p_request_id TEXT, p_status TEXT, p_actual_tokens BIGINT DEFAULT 0
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE reservation public.ai_token_reservations%ROWTYPE; month_start TIMESTAMPTZ;
BEGIN
  IF p_status NOT IN ('completed', 'released') OR p_actual_tokens < 0 THEN RAISE EXCEPTION 'INVALID_AI_QUOTA_FINALIZATION' USING ERRCODE = '22023'; END IF;
  SELECT * INTO reservation FROM public.ai_token_reservations
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id AND request_id = p_request_id AND status = 'reserved' FOR UPDATE;
  IF reservation.id IS NULL THEN RETURN FALSE; END IF;
  month_start := reservation.period_start;
  UPDATE public.ai_token_reservations SET status = p_status, actual_tokens = CASE WHEN p_status = 'completed' THEN p_actual_tokens ELSE 0 END, expires_at = NOW() WHERE id = reservation.id;
  INSERT INTO public.workspace_usage_monthly (workspace_id, period_start) VALUES (p_workspace_id, month_start) ON CONFLICT DO NOTHING;
  UPDATE public.workspace_usage_monthly
  SET ai_tokens_reserved = GREATEST(0, ai_tokens_reserved - reservation.reserved_tokens),
      ai_tokens_used = ai_tokens_used + CASE WHEN p_status = 'completed' THEN p_actual_tokens ELSE 0 END
  WHERE workspace_id = p_workspace_id AND period_start = month_start;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_workspace_ai_token_reservation(UUID, UUID, TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_workspace_ai_token_reservation(UUID, UUID, TEXT, TEXT, BIGINT) TO service_role;

-- Keep existing personal RPCs working for old clients while routing them to
-- the user's first workspace.
CREATE OR REPLACE FUNCTION public.reserve_ai_token_quota(p_user_id UUID, p_request_id TEXT, p_requested_tokens BIGINT, p_limit_override BIGINT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE workspace_id UUID;
BEGIN
  SELECT member.workspace_id INTO workspace_id FROM public.workspace_members member WHERE member.user_id = p_user_id AND member.status = 'active' ORDER BY (member.role = 'owner') DESC, member.joined_at ASC LIMIT 1;
  IF workspace_id IS NULL THEN RAISE EXCEPTION 'WORKSPACE_NOT_FOUND' USING ERRCODE = '42501'; END IF;
  RETURN public.reserve_workspace_ai_token_quota(workspace_id, p_user_id, p_request_id, p_requested_tokens, p_limit_override, NULL);
END;
$$;

-- Acceptance runs may create a temporary workspace that is not the owner's
-- oldest workspace. Keep the historical five-argument overload bound to that
-- run so its reservation is cleaned with the correct workspace.
CREATE OR REPLACE FUNCTION public.reserve_ai_token_quota(
  p_user_id UUID, p_request_id TEXT, p_requested_tokens BIGINT, p_limit_override BIGINT, p_acceptance_run_id TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE workspace_id UUID; result JSONB;
BEGIN
  SELECT workspace.id INTO workspace_id FROM public.workspaces workspace
  WHERE workspace.acceptance_run_id = NULLIF(trim(p_acceptance_run_id), '') AND workspace.owner_id = p_user_id
  ORDER BY workspace.created_at DESC LIMIT 1;
  IF workspace_id IS NULL THEN
    SELECT member.workspace_id INTO workspace_id FROM public.workspace_members member WHERE member.user_id = p_user_id AND member.status = 'active' ORDER BY (member.role = 'owner') DESC, member.joined_at ASC LIMIT 1;
  END IF;
  IF workspace_id IS NULL THEN RAISE EXCEPTION 'WORKSPACE_NOT_FOUND' USING ERRCODE = '42501'; END IF;
  result := public.reserve_workspace_ai_token_quota(workspace_id, p_user_id, p_request_id, p_requested_tokens, p_limit_override, p_acceptance_run_id);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_ai_token_quota(UUID, TEXT, BIGINT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_token_quota(UUID, TEXT, BIGINT, BIGINT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_ai_token_reservation(p_user_id UUID, p_request_id TEXT, p_status TEXT, p_actual_tokens BIGINT DEFAULT 0)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE workspace_id UUID;
BEGIN
  SELECT reservation.workspace_id INTO workspace_id FROM public.ai_token_reservations reservation WHERE reservation.user_id = p_user_id AND reservation.request_id = p_request_id LIMIT 1;
  IF workspace_id IS NULL THEN RETURN FALSE; END IF;
  RETURN public.finalize_workspace_ai_token_reservation(workspace_id, p_user_id, p_request_id, p_status, p_actual_tokens);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_billing_usage(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE workspace_id UUID;
BEGIN
  SELECT member.workspace_id INTO workspace_id FROM public.workspace_members member WHERE member.user_id = p_user_id AND member.status = 'active' ORDER BY (member.role = 'owner') DESC, member.joined_at ASC LIMIT 1;
  IF workspace_id IS NULL THEN RETURN jsonb_build_object('period_start', date_trunc('month', NOW()), 'period_end', date_trunc('month', NOW()) + INTERVAL '1 month', 'ai_tokens', 0, 'ai_tokens_reserved', 0, 'reports', 0, 'exports', 0); END IF;
  RETURN public.get_workspace_billing_usage(workspace_id, p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_report_run_quota()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE month_start TIMESTAMPTZ := date_trunc('month', COALESCE(NEW.created_at, NOW())); entitlement JSONB; usage_row public.workspace_usage_monthly%ROWTYPE; quota_key BIGINT;
BEGIN
  quota_key := hashtextextended(NEW.workspace_id::text || ':report:' || month_start::text, 0); PERFORM pg_advisory_xact_lock(quota_key);
  -- Recheck after the workspace lock. A concurrent idempotent insert may have
  -- committed while this transaction was waiting; counting it again would
  -- overstate usage when the unique conflict is resolved with DO NOTHING.
  IF EXISTS (SELECT 1 FROM public.report_runs WHERE workspace_id = NEW.workspace_id AND idempotency_key = NEW.idempotency_key) THEN RETURN NEW; END IF;
  INSERT INTO public.workspace_usage_monthly (workspace_id, period_start) VALUES (NEW.workspace_id, month_start) ON CONFLICT DO NOTHING;
  SELECT * INTO usage_row FROM public.workspace_usage_monthly WHERE workspace_id = NEW.workspace_id AND period_start = month_start FOR UPDATE;
  entitlement := public.workspace_effective_entitlement(NEW.workspace_id, NEW.user_id);
  IF usage_row.reports_used >= (entitlement->>'monthly_report_limit')::INTEGER THEN RAISE EXCEPTION 'REPORT_QUOTA_EXCEEDED' USING ERRCODE = 'P0001'; END IF;
  IF NEW.status IN ('running', 'completed') THEN UPDATE public.workspace_usage_monthly SET reports_used = reports_used + 1 WHERE workspace_id = NEW.workspace_id AND period_start = month_start; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_report_export_quota()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE month_start TIMESTAMPTZ := date_trunc('month', COALESCE(NEW.created_at, NOW())); entitlement JSONB; usage_row public.workspace_usage_monthly%ROWTYPE; quota_key BIGINT; features JSONB;
BEGIN
  quota_key := hashtextextended(NEW.workspace_id::text || ':export:' || month_start::text, 0); PERFORM pg_advisory_xact_lock(quota_key);
  IF NEW.idempotency_key IS NOT NULL AND EXISTS (SELECT 1 FROM public.report_exports WHERE workspace_id = NEW.workspace_id AND idempotency_key = NEW.idempotency_key) THEN RETURN NEW; END IF;
  INSERT INTO public.workspace_usage_monthly (workspace_id, period_start) VALUES (NEW.workspace_id, month_start) ON CONFLICT DO NOTHING;
  SELECT * INTO usage_row FROM public.workspace_usage_monthly WHERE workspace_id = NEW.workspace_id AND period_start = month_start FOR UPDATE;
  entitlement := public.workspace_effective_entitlement(NEW.workspace_id, NEW.user_id); features := entitlement->'features';
  IF NEW.format = 'pdf' AND COALESCE((features->>'pdf_export')::BOOLEAN, FALSE) IS NOT TRUE THEN RAISE EXCEPTION 'EXPORT_FEATURE_NOT_AVAILABLE' USING ERRCODE = 'P0001'; END IF;
  IF NEW.format = 'docx' AND COALESCE((features->>'docx_export')::BOOLEAN, FALSE) IS NOT TRUE THEN RAISE EXCEPTION 'EXPORT_FEATURE_NOT_AVAILABLE' USING ERRCODE = 'P0001'; END IF;
  IF usage_row.exports_used >= (entitlement->>'monthly_export_limit')::INTEGER THEN RAISE EXCEPTION 'EXPORT_QUOTA_EXCEEDED' USING ERRCODE = 'P0001'; END IF;
  IF NEW.status IN ('queued', 'processing', 'completed') THEN UPDATE public.workspace_usage_monthly SET exports_used = exports_used + 1 WHERE workspace_id = NEW.workspace_id AND period_start = month_start; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_report_run_status_quota()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  month_start TIMESTAMPTZ := date_trunc('month', COALESCE(NEW.created_at, NOW()));
  old_counted BOOLEAN := OLD.status IN ('running', 'completed');
  new_counted BOOLEAN := NEW.status IN ('running', 'completed');
  entitlement JSONB;
  usage_row public.workspace_usage_monthly%ROWTYPE;
  quota_key BIGINT;
BEGIN
  IF old_counted = new_counted THEN RETURN NEW; END IF;
  quota_key := hashtextextended(NEW.workspace_id::text || ':report:' || month_start::text, 0);
  PERFORM pg_advisory_xact_lock(quota_key);
  INSERT INTO public.workspace_usage_monthly (workspace_id, period_start)
  VALUES (NEW.workspace_id, month_start) ON CONFLICT DO NOTHING;
  SELECT * INTO usage_row FROM public.workspace_usage_monthly
  WHERE workspace_id = NEW.workspace_id AND period_start = month_start FOR UPDATE;
  IF new_counted THEN
    entitlement := public.workspace_effective_entitlement(NEW.workspace_id, NEW.user_id);
    IF usage_row.reports_used >= (entitlement->>'monthly_report_limit')::INTEGER THEN
      RAISE EXCEPTION 'REPORT_QUOTA_EXCEEDED' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.workspace_usage_monthly SET reports_used = reports_used + 1
    WHERE workspace_id = NEW.workspace_id AND period_start = month_start;
  ELSE
    UPDATE public.workspace_usage_monthly SET reports_used = GREATEST(0, reports_used - 1)
    WHERE workspace_id = NEW.workspace_id AND period_start = month_start;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_report_export_status_quota()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  month_start TIMESTAMPTZ := date_trunc('month', COALESCE(NEW.created_at, NOW()));
  old_counted BOOLEAN := OLD.status IN ('queued', 'processing', 'completed');
  new_counted BOOLEAN := NEW.status IN ('queued', 'processing', 'completed');
  entitlement JSONB;
  usage_row public.workspace_usage_monthly%ROWTYPE;
  quota_key BIGINT;
BEGIN
  IF old_counted = new_counted THEN RETURN NEW; END IF;
  quota_key := hashtextextended(NEW.workspace_id::text || ':export:' || month_start::text, 0);
  PERFORM pg_advisory_xact_lock(quota_key);
  INSERT INTO public.workspace_usage_monthly (workspace_id, period_start)
  VALUES (NEW.workspace_id, month_start) ON CONFLICT DO NOTHING;
  SELECT * INTO usage_row FROM public.workspace_usage_monthly
  WHERE workspace_id = NEW.workspace_id AND period_start = month_start FOR UPDATE;
  IF new_counted THEN
    entitlement := public.workspace_effective_entitlement(NEW.workspace_id, NEW.user_id);
    IF usage_row.exports_used >= (entitlement->>'monthly_export_limit')::INTEGER THEN
      RAISE EXCEPTION 'EXPORT_QUOTA_EXCEEDED' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.workspace_usage_monthly SET exports_used = exports_used + 1
    WHERE workspace_id = NEW.workspace_id AND period_start = month_start;
  ELSE
    UPDATE public.workspace_usage_monthly SET exports_used = GREATEST(0, exports_used - 1)
    WHERE workspace_id = NEW.workspace_id AND period_start = month_start;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS report_runs_enforce_plan_quota ON public.report_runs;
CREATE TRIGGER report_runs_enforce_plan_quota BEFORE INSERT ON public.report_runs FOR EACH ROW EXECUTE FUNCTION public.enforce_report_run_quota();
DROP TRIGGER IF EXISTS report_runs_enforce_status_quota ON public.report_runs;
CREATE TRIGGER report_runs_enforce_status_quota BEFORE UPDATE OF status ON public.report_runs FOR EACH ROW EXECUTE FUNCTION public.enforce_report_run_status_quota();
DROP TRIGGER IF EXISTS report_exports_enforce_plan_quota ON public.report_exports;
CREATE TRIGGER report_exports_enforce_plan_quota BEFORE INSERT ON public.report_exports FOR EACH ROW EXECUTE FUNCTION public.enforce_report_export_quota();
DROP TRIGGER IF EXISTS report_exports_enforce_status_quota ON public.report_exports;
CREATE TRIGGER report_exports_enforce_status_quota BEFORE UPDATE OF status ON public.report_exports FOR EACH ROW EXECUTE FUNCTION public.enforce_report_export_status_quota();

-- Report runs and AI logs are shared operational data; the creator remains
-- immutable for audit, while active members can read the workspace ledger.
DROP POLICY IF EXISTS report_runs_select_own ON public.report_runs;
DROP POLICY IF EXISTS report_runs_insert_own ON public.report_runs;
DROP POLICY IF EXISTS report_runs_update_own ON public.report_runs;
CREATE POLICY report_runs_select_workspace ON public.report_runs FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY report_runs_insert_workspace ON public.report_runs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.can_edit_workspace(workspace_id));
CREATE POLICY report_runs_update_workspace ON public.report_runs FOR UPDATE TO authenticated USING (public.can_edit_workspace(workspace_id)) WITH CHECK (public.can_edit_workspace(workspace_id));
DROP POLICY IF EXISTS ai_request_logs_select_own ON public.ai_request_logs;
CREATE POLICY ai_request_logs_select_workspace ON public.ai_request_logs FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
GRANT SELECT, INSERT, UPDATE ON public.report_runs TO authenticated;
GRANT SELECT ON public.ai_request_logs TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_report_run_workspace_identity()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    RAISE EXCEPTION 'workspace_id and creator cannot be changed';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
    AND COALESCE(NULLIF(current_setting('request.jwt.claims', TRUE), '')::jsonb ->> 'role', '') <> 'service_role'
    AND auth.uid() IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'REPORT_RUN_CREATOR_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = NEW.workspace_id AND user_id = NEW.user_id AND status = 'active') THEN
    RAISE EXCEPTION 'WORKSPACE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF NEW.report_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.generated_reports WHERE id = NEW.report_id AND workspace_id = NEW.workspace_id) THEN
    RAISE EXCEPTION 'REPORT_WORKSPACE_MISMATCH' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS report_runs_owner_link ON public.report_runs;
CREATE TRIGGER report_runs_owner_link BEFORE INSERT OR UPDATE OF user_id, workspace_id, report_id ON public.report_runs FOR EACH ROW EXECUTE FUNCTION public.guard_report_run_workspace_identity();

-- Manual internal-test plan changes are service-role-only and always produce
-- an audit record with the actor, reason and resulting entitlement.
CREATE OR REPLACE FUNCTION public.configure_workspace_manual_subscription(
  p_workspace_id UUID, p_plan TEXT, p_seat_limit INTEGER, p_actor_id UUID, p_reason TEXT, p_overrides JSONB DEFAULT '{}'::jsonb
)
RETURNS public.workspace_subscriptions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result public.workspace_subscriptions; old_row public.workspace_subscriptions;
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claims', TRUE), '')::jsonb ->> 'role', '') <> 'service_role' THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_plan NOT IN ('free', 'pro', 'enterprise') OR p_seat_limit IS NULL OR p_seat_limit < 1
    OR p_actor_id IS NULL OR length(trim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'INVALID_MANUAL_SUBSCRIPTION' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO old_row FROM public.workspace_subscriptions WHERE workspace_id = p_workspace_id FOR UPDATE;
  INSERT INTO public.workspace_subscriptions (
    workspace_id, plan, status, provider, seat_limit, monthly_ai_token_limit_override,
    ai_requests_per_minute_override, monthly_report_limit_override, monthly_export_limit_override,
    manual_reason, created_by, provider_updated_at
  ) VALUES (
    p_workspace_id, p_plan, 'active', 'manual', p_seat_limit,
    NULLIF((p_overrides->>'monthly_ai_token_limit')::BIGINT, 0),
    NULLIF((p_overrides->>'ai_requests_per_minute')::INTEGER, 0),
    NULLIF((p_overrides->>'monthly_report_limit')::INTEGER, 0),
    NULLIF((p_overrides->>'monthly_export_limit')::INTEGER, 0),
    left(trim(p_reason), 1000), p_actor_id, NOW()
  ) ON CONFLICT (workspace_id) DO UPDATE SET plan = EXCLUDED.plan, status = EXCLUDED.status, provider = EXCLUDED.provider,
    seat_limit = EXCLUDED.seat_limit, monthly_ai_token_limit_override = EXCLUDED.monthly_ai_token_limit_override,
    ai_requests_per_minute_override = EXCLUDED.ai_requests_per_minute_override, monthly_report_limit_override = EXCLUDED.monthly_report_limit_override,
    monthly_export_limit_override = EXCLUDED.monthly_export_limit_override, manual_reason = EXCLUDED.manual_reason, created_by = EXCLUDED.created_by,
    provider_updated_at = NOW(), entitlement_revoked_at = NULL, entitlement_revoke_reason = NULL
  RETURNING * INTO result;
  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
  VALUES (p_actor_id, 'workspace_subscription.manual_configured', 'workspace_subscription', result.id::TEXT,
    jsonb_build_object('workspace_id', p_workspace_id, 'plan', p_plan, 'seat_limit', p_seat_limit, 'reason', left(trim(p_reason), 1000), 'previous_plan', old_row.plan));
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.configure_workspace_manual_subscription(UUID, TEXT, INTEGER, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.configure_workspace_manual_subscription(UUID, TEXT, INTEGER, UUID, TEXT, JSONB) TO service_role;

COMMENT ON TABLE public.workspace_subscriptions IS 'One subscription per workspace; member roles are separate authorization.';
COMMENT ON TABLE public.workspace_usage_monthly IS 'Atomic workspace-level monthly quota counters.';
COMMENT ON TABLE public.workspace_member_usage_minute IS 'Atomic per-member AI request windows within a workspace.';
COMMENT ON COLUMN public.workspace_subscriptions.seat_limit IS 'Maximum active members plus pending invitations.';
COMMENT ON COLUMN public.ai_request_logs.workspace_id IS 'Workspace entitlement and audit boundary.';
COMMENT ON COLUMN public.ai_token_reservations.workspace_id IS 'Workspace-level atomic token reservation boundary.';

COMMIT;
