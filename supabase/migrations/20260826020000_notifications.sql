-- Notification event and delivery ledger.
-- External delivery workers may use notification_deliveries; the browser only creates in-app events.

BEGIN;

CREATE TABLE IF NOT EXISTS public.notification_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('alert', 'policy', 'rule', 'system', 'test')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 160),
  body TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 4000),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.notification_events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'webhook', 'wecom', 'feishu')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT,
  provider_message_id TEXT,
  next_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_events_user_unread
  ON public.notification_events (user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_events_workspace
  ON public.notification_events (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_queue
  ON public.notification_deliveries (status, next_attempt_at, created_at);

CREATE OR REPLACE FUNCTION public.create_in_app_notification_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_deliveries (event_id, user_id, channel, status, attempt_count, sent_at)
  VALUES (NEW.id, NEW.user_id, 'in_app', 'sent', 1, NOW())
  ON CONFLICT (event_id, channel) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notification_event_in_app_delivery ON public.notification_events;
CREATE TRIGGER notification_event_in_app_delivery
  AFTER INSERT ON public.notification_events
  FOR EACH ROW EXECUTE FUNCTION public.create_in_app_notification_delivery();

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_events_select_own ON public.notification_events;
CREATE POLICY notification_events_select_own ON public.notification_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS notification_events_insert_own ON public.notification_events;
CREATE POLICY notification_events_insert_own ON public.notification_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS notification_events_update_own ON public.notification_events;
CREATE POLICY notification_events_update_own ON public.notification_events
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS notification_deliveries_select_own ON public.notification_deliveries;
CREATE POLICY notification_deliveries_select_own ON public.notification_deliveries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON public.notification_events, public.notification_deliveries FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.notification_events TO authenticated;
GRANT SELECT ON public.notification_deliveries TO authenticated;

DROP TRIGGER IF EXISTS notification_deliveries_updated_at ON public.notification_deliveries;
CREATE TRIGGER notification_deliveries_updated_at
  BEFORE UPDATE ON public.notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMIT;
