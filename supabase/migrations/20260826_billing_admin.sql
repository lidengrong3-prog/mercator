-- Subscription, billing event and admin audit foundation.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired')),
  provider TEXT NOT NULL DEFAULT 'internal' CHECK (provider IN ('internal', 'stripe', 'manual')),
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.billing_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'manual', 'internal')),
  event_type TEXT NOT NULL,
  provider_event_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'support' CHECK (role IN ('owner', 'admin', 'support', 'analyst')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'monitoring', 'resolved')),
  title TEXT NOT NULL,
  detail TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.backup_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  backup_type TEXT NOT NULL CHECK (backup_type IN ('managed', 'logical', 'storage')),
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  location TEXT,
  checksum TEXT,
  size_bytes BIGINT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_status ON public.user_subscriptions (plan, status);
CREATE INDEX IF NOT EXISTS idx_billing_events_user_created ON public.billing_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON public.admin_audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_incidents_status ON public.system_incidents (status, severity, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_runs_created ON public.backup_runs (created_at DESC);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_subscriptions_select_own ON public.user_subscriptions;
CREATE POLICY user_subscriptions_select_own ON public.user_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Audit rows are written by trusted server functions only; no browser INSERT policy.
REVOKE ALL ON public.user_subscriptions, public.billing_events, public.admin_audit_log,
  public.platform_admins, public.system_incidents, public.backup_runs FROM anon, authenticated;
GRANT SELECT ON public.user_subscriptions TO authenticated;

INSERT INTO public.user_subscriptions (user_id, plan, status, provider)
SELECT id, COALESCE(tier, 'free'), 'active', 'internal'
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_profile_tier_from_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET tier = CASE WHEN NEW.status IN ('active', 'trialing') THEN NEW.plan ELSE 'free' END
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_tier_from_subscription ON public.user_subscriptions;
CREATE TRIGGER sync_profile_tier_from_subscription
  AFTER INSERT OR UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_tier_from_subscription();

DROP TRIGGER IF EXISTS user_subscriptions_updated_at ON public.user_subscriptions;
CREATE TRIGGER user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS system_incidents_updated_at ON public.system_incidents;
CREATE TRIGGER system_incidents_updated_at
  BEFORE UPDATE ON public.system_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMIT;
