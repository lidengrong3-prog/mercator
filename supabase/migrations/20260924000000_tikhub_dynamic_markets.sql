-- TikHub pilot scope follows the launch-market catalog instead of a US-only
-- assumption.  A scope can be visible in coverage while remaining disabled
-- until its market/platform adapter and commercial authorization are ready.

BEGIN;

UPDATE public.data_source_registry
   SET market_codes = ARRAY['US', 'ID'],
       platform_keys = ARRAY['tiktok-shop'],
       updated_at = NOW()
 WHERE source_key = 'tikhub';

ALTER TABLE public.tikhub_pilot_configs
  DROP CONSTRAINT IF EXISTS tikhub_pilot_configs_market_code_check,
  DROP CONSTRAINT IF EXISTS tikhub_pilot_configs_platform_key_check;

ALTER TABLE public.tikhub_pilot_configs
  ADD COLUMN IF NOT EXISTS market_codes TEXT[] NOT NULL DEFAULT ARRAY['US']::TEXT[],
  ADD COLUMN IF NOT EXISTS platform_keys TEXT[] NOT NULL DEFAULT ARRAY['tiktok-shop']::TEXT[],
  ADD COLUMN IF NOT EXISTS scope_status TEXT NOT NULL DEFAULT 'configured';

UPDATE public.tikhub_pilot_configs
   SET market_codes = ARRAY[market_code],
       platform_keys = ARRAY[platform_key],
       scope_status = CASE
         WHEN market_code = 'US' AND platform_key = 'tiktok-shop' THEN 'configured'
         ELSE 'schema_only'
       END,
       updated_at = NOW();

ALTER TABLE public.tikhub_pilot_configs
  ADD CONSTRAINT tikhub_pilot_configs_scope_arrays_check
    CHECK (cardinality(market_codes) > 0 AND cardinality(platform_keys) > 0),
  ADD CONSTRAINT tikhub_pilot_configs_scope_status_check
    CHECK (scope_status IN ('configured', 'schema_only', 'blocked', 'retired'));

-- The ID launch market is registered for coverage and can be enabled after a
-- TikHub-compatible adapter and authorization are confirmed.  It must never
-- cause a provider request while it remains schema_only.
INSERT INTO public.tikhub_pilot_configs
  (pilot_key, market_code, platform_key, market_codes, platform_keys, keywords,
   cadence_per_day, pilot_days, api_key_secret_name, cookie_endpoint_policy,
   authorization_status, status, enabled, scope_status, notes)
VALUES (
  'tiktok-shop-id-pilot', 'ID', 'tiktok-shop', ARRAY['ID']::TEXT[], ARRAY['tiktok-shop']::TEXT[],
  '["beauty","skincare","makeup","haircare","womens-fashion","mens-fashion","shoes","jewelry","home-decor","kitchen","electronics","phone-accessories","pet-supplies","toys","fitness","outdoor","baby-products","health","automotive","luggage"]'::jsonb,
  1, 7, 'TIKHUB_API_KEY', 'blocked', 'pending', 'blocked', FALSE, 'schema_only',
  '印度尼西亚为已上线市场，但当前 market_scope.json 为 schema_only；完成适配和授权后再启用。'
)
ON CONFLICT (pilot_key) DO UPDATE SET
  market_code = EXCLUDED.market_code,
  platform_key = EXCLUDED.platform_key,
  market_codes = EXCLUDED.market_codes,
  platform_keys = EXCLUDED.platform_keys,
  scope_status = EXCLUDED.scope_status,
  enabled = EXCLUDED.enabled,
  status = EXCLUDED.status,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.tikhub_pilot_scope_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_code TEXT NOT NULL,
  platform_key TEXT NOT NULL,
  market_status TEXT NOT NULL DEFAULT 'active',
  data_status TEXT NOT NULL DEFAULT 'schema_only',
  scope_status TEXT NOT NULL DEFAULT 'schema_only'
    CHECK (scope_status IN ('configured', 'schema_only', 'blocked', 'retired')),
  executable BOOLEAN NOT NULL DEFAULT FALSE,
  pilot_key TEXT REFERENCES public.tikhub_pilot_configs(pilot_key) ON DELETE SET NULL,
  reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (market_code, platform_key)
);

INSERT INTO public.tikhub_pilot_scope_status
  (market_code, platform_key, market_status, data_status, scope_status, executable, pilot_key, reason)
VALUES
  ('US', 'tiktok-shop', 'active', 'configured', 'configured', TRUE,
   'tiktok-shop-us-pilot', NULL),
  ('ID', 'tiktok-shop', 'active', 'schema_only', 'schema_only', FALSE,
   'tiktok-shop-id-pilot', 'market/platform adapter is not configured')
ON CONFLICT (market_code, platform_key) DO UPDATE SET
  data_status = EXCLUDED.data_status,
  scope_status = EXCLUDED.scope_status,
  executable = EXCLUDED.executable,
  pilot_key = EXCLUDED.pilot_key,
  reason = EXCLUDED.reason,
  updated_at = NOW();

CREATE INDEX IF NOT EXISTS idx_tikhub_scope_status_execution
  ON public.tikhub_pilot_scope_status(executable, market_code, platform_key);

ALTER TABLE public.tikhub_pilot_scope_status ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tikhub_pilot_scope_status FROM anon, authenticated;
GRANT ALL ON public.tikhub_pilot_scope_status TO service_role;

COMMENT ON TABLE public.tikhub_pilot_scope_status IS
  'Launch-market coverage ledger for TikHub. schema_only and blocked scopes never trigger provider calls.';

COMMIT;
