-- External notification channel configuration and retry-safe delivery claims.

BEGIN;

CREATE TABLE IF NOT EXISTS public.notification_channel_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'wecom', 'feishu')),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  target_hint TEXT CHECK (target_hint IS NULL OR char_length(target_hint) <= 320),
  secret_ciphertext TEXT,
  config_version INTEGER NOT NULL DEFAULT 1 CHECK (config_version > 0),
  last_test_status TEXT CHECK (last_test_status IS NULL OR last_test_status IN ('sent', 'failed')),
  last_test_error TEXT,
  last_test_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, workspace_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_channel_configs_enabled
  ON public.notification_channel_configs (user_id, workspace_id, enabled, channel);

ALTER TABLE public.notification_deliveries
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.notification_events
  ADD COLUMN IF NOT EXISTS source_record_id TEXT
    CHECK (source_record_id IS NULL OR char_length(source_record_id) <= 240);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_events_source_dedup
  ON public.notification_events (user_id, workspace_id, event_type, source_record_id);

-- Every event is immediately visible in-app. Enabled external channels are
-- queued from server-owned configuration; browser clients cannot manufacture
-- a successful external delivery row.
CREATE OR REPLACE FUNCTION public.create_in_app_notification_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_deliveries (
    event_id, user_id, channel, status, attempt_count, sent_at, completed_at, provider
  ) VALUES (
    NEW.id, NEW.user_id, 'in_app', 'sent', 1, NOW(), NOW(), 'internal'
  ) ON CONFLICT (event_id, channel) DO NOTHING;

  -- Authenticated clients may create their own in-app events, but only the
  -- service role may fan an event out to paid external providers.
  IF COALESCE(
    NULLIF(current_setting('request.jwt.claims', TRUE), '')::jsonb ->> 'role',
    ''
  ) <> 'service_role' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notification_deliveries (
    event_id, user_id, channel, status, attempt_count, next_attempt_at, provider
  )
  SELECT NEW.id, NEW.user_id, config.channel, 'pending', 0, NOW(),
    CASE WHEN config.channel = 'email' THEN 'resend' ELSE config.channel END
  FROM public.notification_channel_configs AS config
  WHERE config.user_id = NEW.user_id
    AND config.workspace_id = NEW.workspace_id
    AND config.enabled = TRUE
    AND (
      NOT (NEW.payload ? 'channel_test')
      OR config.channel = NEW.payload ->> 'channel_test'
    )
  ON CONFLICT (event_id, channel) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Claims are atomic and use SKIP LOCKED so the browser-triggered dispatcher
-- and scheduled retry worker cannot send the same delivery concurrently.
CREATE OR REPLACE FUNCTION public.claim_notification_deliveries(
  p_limit INTEGER DEFAULT 25,
  p_delivery_id UUID DEFAULT NULL
)
RETURNS SETOF public.notification_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
BEGIN
  UPDATE public.notification_deliveries
  SET status = 'failed',
      last_error = 'DELIVERY_CLAIM_TIMED_OUT',
      next_attempt_at = CASE WHEN attempt_count < 5 THEN NOW() ELSE NULL END,
      completed_at = NOW()
  WHERE status = 'processing'
    AND updated_at < NOW() - INTERVAL '10 minutes';

  RETURN QUERY
  WITH candidates AS (
    SELECT delivery.id
    FROM public.notification_deliveries AS delivery
    WHERE (p_delivery_id IS NULL OR delivery.id = p_delivery_id)
      AND delivery.channel <> 'in_app'
      AND delivery.attempt_count < 5
      AND (
        (delivery.status = 'pending' AND (delivery.next_attempt_at IS NULL OR delivery.next_attempt_at <= NOW()))
        OR
        (delivery.status = 'failed' AND delivery.next_attempt_at IS NOT NULL AND delivery.next_attempt_at <= NOW())
      )
    ORDER BY delivery.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT normalized_limit
  )
  UPDATE public.notification_deliveries AS delivery
  SET status = 'processing',
      attempt_count = delivery.attempt_count + 1,
      started_at = NOW(),
      completed_at = NULL,
      last_error = NULL,
      updated_at = NOW()
  FROM candidates
  WHERE delivery.id = candidates.id
  RETURNING delivery.*;
END;
$$;

ALTER TABLE public.notification_channel_configs ENABLE ROW LEVEL SECURITY;

-- Source-backed alerts are inserted by the notification service. Browser
-- clients may still create in-app notices, but cannot impersonate a source.
DROP POLICY IF EXISTS notification_events_insert_own ON public.notification_events;
CREATE POLICY notification_events_insert_own ON public.notification_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND source_record_id IS NULL);

-- Channel endpoints are bearer credentials. They are managed only through
-- the Edge Function, which returns masked target hints instead of ciphertext.
REVOKE ALL ON public.notification_channel_configs FROM anon, authenticated;
GRANT ALL ON public.notification_channel_configs TO service_role;

REVOKE ALL ON FUNCTION public.claim_notification_deliveries(INTEGER, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_deliveries(INTEGER, UUID) TO service_role;

DROP TRIGGER IF EXISTS notification_channel_configs_updated_at ON public.notification_channel_configs;
CREATE TRIGGER notification_channel_configs_updated_at
  BEFORE UPDATE ON public.notification_channel_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMIT;
