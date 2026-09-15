-- TikHub is a traceable third-party provider.  This pilot keeps raw evidence
-- and operational measurements private until authorization and field review
-- are complete.

BEGIN;

ALTER TABLE public.data_source_registry
  ALTER COLUMN market_codes SET DEFAULT '{}',
  ALTER COLUMN platform_keys SET DEFAULT '{}';

UPDATE public.data_source_registry
   SET market_codes = ARRAY['US'],
       platform_keys = ARRAY['tiktok-shop'],
       category_codes = ARRAY[
         'beauty', 'skincare', 'makeup', 'haircare', 'womens-fashion',
         'mens-fashion', 'shoes', 'jewelry', 'home-decor', 'kitchen',
         'electronics', 'phone-accessories', 'pet-supplies', 'toys', 'fitness',
         'outdoor', 'baby-products', 'health', 'automotive', 'luggage'
       ],
       source_kind = 'traceable',
       source_type = 'licensed_provider',
       source_category = 'third_party_provider',
       update_frequency = '1-2/day',
       collection_enabled = TRUE,
       status = 'active',
       updated_at = NOW()
 WHERE source_key = 'tikhub';

UPDATE public.data_source_access_policies
   SET authorization_status = 'pending',
       commercial_use_allowed = FALSE,
       redistribution_allowed = FALSE,
       access_class = 'service_private',
       authorization_secret_name = 'TIKHUB_API_KEY',
       permitted_uses = ARRAY['internal_search', 'workspace_analysis'],
       updated_at = NOW()
 WHERE source_key = 'tikhub';

-- A single pilot task performs 80 bounded provider calls; the per-request
-- timeout remains 120 seconds while the Worker task gets a longer envelope.
UPDATE public.collection_source_policies
   SET timeout_seconds = 1800,
       updated_at = NOW()
 WHERE source_key = 'tikhub';

ALTER TABLE public.collection_tasks
  DROP CONSTRAINT IF EXISTS collection_tasks_domain_check;
ALTER TABLE public.collection_tasks
  ADD CONSTRAINT collection_tasks_domain_check CHECK (domain IN (
    'policy', 'tax', 'access', 'rule', 'alert', 'market', 'platform',
    'category', 'product', 'shop', 'content'
  ));

CREATE TABLE IF NOT EXISTS public.tikhub_pilot_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_key TEXT NOT NULL UNIQUE,
  market_code TEXT NOT NULL DEFAULT 'US' CHECK (market_code = 'US'),
  platform_key TEXT NOT NULL DEFAULT 'tiktok-shop' CHECK (platform_key = 'tiktok-shop'),
  keywords JSONB NOT NULL,
  cadence_per_day SMALLINT NOT NULL DEFAULT 1 CHECK (cadence_per_day BETWEEN 1 AND 2),
  pilot_days SMALLINT NOT NULL DEFAULT 7 CHECK (pilot_days = 7),
  start_date DATE,
  end_date DATE,
  api_key_secret_name TEXT NOT NULL DEFAULT 'TIKHUB_API_KEY',
  cookie_endpoint_policy TEXT NOT NULL DEFAULT 'blocked'
    CHECK (cookie_endpoint_policy IN ('blocked', 'explicit_opt_in')),
  authorization_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (authorization_status IN ('pending', 'confirmed', 'expired', 'revoked')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed', 'blocked')),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(keywords) = 'array' AND jsonb_array_length(keywords) = 20),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CHECK (enabled = FALSE OR status = 'active'),
  CHECK (enabled = FALSE OR authorization_status = 'confirmed')
);

CREATE TABLE IF NOT EXISTS public.tikhub_endpoint_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_key TEXT NOT NULL UNIQUE CHECK (endpoint_key IN (
    'product_search', 'product_detail', 'seller_profile', 'shop_analytics'
  )),
  endpoint_url TEXT,
  endpoint_path TEXT,
  http_method TEXT NOT NULL DEFAULT 'GET' CHECK (http_method IN ('GET', 'POST')),
  auth_mode TEXT NOT NULL DEFAULT 'bearer' CHECK (auth_mode IN ('bearer', 'api_key', 'configured')),
  requires_cookie BOOLEAN NOT NULL DEFAULT FALSE,
  production_automation_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  authorization_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (authorization_status IN ('pending', 'confirmed', 'expired', 'revoked')),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (endpoint_url IS NULL OR endpoint_url ~ '^https://'),
  CHECK (production_automation_allowed = FALSE OR authorization_status = 'confirmed'),
  CHECK (requires_cookie = FALSE OR production_automation_allowed = FALSE)
);

CREATE TABLE IF NOT EXISTS public.tikhub_pilot_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_key TEXT NOT NULL REFERENCES public.tikhub_pilot_configs(pilot_key) ON DELETE RESTRICT,
  pilot_run_id TEXT NOT NULL UNIQUE,
  run_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'succeeded', 'degraded', 'failed', 'blocked')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  keyword_count INTEGER NOT NULL DEFAULT 0 CHECK (keyword_count >= 0),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  successful_requests INTEGER NOT NULL DEFAULT 0 CHECK (successful_requests >= 0),
  failed_requests INTEGER NOT NULL DEFAULT 0 CHECK (failed_requests >= 0),
  records_collected INTEGER NOT NULL DEFAULT 0 CHECK (records_collected >= 0),
  missing_count INTEGER NOT NULL DEFAULT 0 CHECK (missing_count >= 0),
  duplicate_count INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
  estimated_cost_usd NUMERIC NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pilot_key, run_date)
);

CREATE TABLE IF NOT EXISTS public.tikhub_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_key TEXT NOT NULL REFERENCES public.tikhub_endpoint_catalog(endpoint_key) ON DELETE RESTRICT,
  source_path TEXT NOT NULL,
  target_table TEXT NOT NULL CHECK (target_table IN ('product_snapshots', 'shop_snapshots', 'content_snapshots')),
  target_field TEXT NOT NULL,
  data_type TEXT NOT NULL DEFAULT 'text',
  nullable BOOLEAN NOT NULL DEFAULT TRUE,
  commercial_authorized BOOLEAN NOT NULL DEFAULT FALSE,
  public_display_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (endpoint_key, source_path, target_table, target_field)
);

CREATE TABLE IF NOT EXISTS public.tikhub_fetch_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_run_id TEXT NOT NULL REFERENCES public.tikhub_pilot_runs(pilot_run_id) ON DELETE RESTRICT,
  endpoint_key TEXT NOT NULL REFERENCES public.tikhub_endpoint_catalog(endpoint_key) ON DELETE RESTRICT,
  keyword TEXT,
  endpoint_url TEXT NOT NULL CHECK (endpoint_url ~ '^https://'),
  request_parameters_hash TEXT NOT NULL CHECK (request_parameters_hash ~ '^[0-9a-f]{64}$'),
  requested_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  response_status INTEGER NOT NULL DEFAULT 0 CHECK (response_status BETWEEN 0 AND 599),
  success BOOLEAN NOT NULL DEFAULT FALSE,
  response_hash TEXT CHECK (response_hash IS NULL OR response_hash ~ '^[0-9a-f]{64}$'),
  raw_artifact_id UUID REFERENCES public.private_data_artifacts(id) ON DELETE SET NULL,
  item_count INTEGER NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  standard_record_count INTEGER NOT NULL DEFAULT 0 CHECK (standard_record_count >= 0),
  missing_count INTEGER NOT NULL DEFAULT 0 CHECK (missing_count >= 0),
  duplicate_count INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
  estimated_cost_usd NUMERIC NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  duration_ms BIGINT NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  error_code TEXT,
  cookie_used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pilot_run_id, endpoint_key, keyword, request_parameters_hash)
);

CREATE TABLE IF NOT EXISTS public.tikhub_pilot_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_key TEXT NOT NULL REFERENCES public.tikhub_pilot_configs(pilot_key) ON DELETE RESTRICT,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'incomplete'
    CHECK (status IN ('incomplete', 'complete', 'blocked')),
  field_mapping_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_rate NUMERIC NOT NULL DEFAULT 0 CHECK (missing_rate BETWEEN 0 AND 1),
  duplicate_rate NUMERIC NOT NULL DEFAULT 0 CHECK (duplicate_rate BETWEEN 0 AND 1),
  success_rate NUMERIC NOT NULL DEFAULT 0 CHECK (success_rate BETWEEN 0 AND 1),
  total_requests INTEGER NOT NULL DEFAULT 0 CHECK (total_requests >= 0),
  event_count INTEGER NOT NULL DEFAULT 0 CHECK (event_count >= 0),
  total_cost_usd NUMERIC NOT NULL DEFAULT 0 CHECK (total_cost_usd >= 0),
  product_trend_count INTEGER NOT NULL DEFAULT 0 CHECK (product_trend_count >= 0),
  shop_trend_count INTEGER NOT NULL DEFAULT 0 CHECK (shop_trend_count >= 0),
  coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  authorization_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pilot_key, period_from, period_to),
  CHECK (period_to >= period_from)
);

CREATE INDEX IF NOT EXISTS idx_tikhub_fetch_events_run
  ON public.tikhub_fetch_events(pilot_run_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_tikhub_fetch_events_endpoint
  ON public.tikhub_fetch_events(endpoint_key, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_tikhub_pilot_runs_date
  ON public.tikhub_pilot_runs(pilot_key, run_date DESC);
CREATE INDEX IF NOT EXISTS idx_tikhub_reports_period
  ON public.tikhub_pilot_reports(pilot_key, period_to DESC);

INSERT INTO public.tikhub_pilot_configs
  (pilot_key, market_code, platform_key, keywords, cadence_per_day, pilot_days,
   api_key_secret_name, cookie_endpoint_policy, authorization_status, status, enabled, notes)
VALUES (
  'tiktok-shop-us-pilot', 'US', 'tiktok-shop',
  '["beauty","skincare","makeup","haircare","womens-fashion","mens-fashion","shoes","jewelry","home-decor","kitchen","electronics","phone-accessories","pet-supplies","toys","fitness","outdoor","baby-products","health","automotive","luggage"]'::jsonb,
  1, 7, 'TIKHUB_API_KEY', 'blocked', 'pending', 'draft', FALSE,
  '七天试点默认配置；确认授权、接口路径和字段后才能启用。'
)
ON CONFLICT (pilot_key) DO UPDATE SET
  market_code = EXCLUDED.market_code,
  platform_key = EXCLUDED.platform_key,
  keywords = EXCLUDED.keywords,
  cadence_per_day = EXCLUDED.cadence_per_day,
  pilot_days = EXCLUDED.pilot_days,
  api_key_secret_name = EXCLUDED.api_key_secret_name,
  cookie_endpoint_policy = EXCLUDED.cookie_endpoint_policy,
  updated_at = NOW();

INSERT INTO public.tikhub_endpoint_catalog
  (endpoint_key, endpoint_url, endpoint_path, http_method, auth_mode,
   requires_cookie, production_automation_allowed, authorization_status, enabled, notes)
VALUES
  ('product_search', NULL, NULL, 'GET', 'bearer', FALSE, FALSE, 'pending', FALSE, '需根据 TikHub 控制台配置实际 HTTPS endpoint。'),
  ('product_detail', NULL, NULL, 'GET', 'bearer', FALSE, FALSE, 'pending', FALSE, '需根据 TikHub 控制台配置实际 HTTPS endpoint。'),
  ('seller_profile', NULL, NULL, 'GET', 'bearer', FALSE, FALSE, 'pending', FALSE, '需根据 TikHub 控制台配置实际 HTTPS endpoint。'),
  ('shop_analytics', NULL, NULL, 'GET', 'bearer', FALSE, FALSE, 'pending', FALSE, '需根据 TikHub 控制台配置实际 HTTPS endpoint。')
ON CONFLICT (endpoint_key) DO UPDATE SET
  updated_at = NOW();

INSERT INTO public.tikhub_field_mappings
  (endpoint_key, source_path, target_table, target_field, data_type,
   nullable, commercial_authorized, public_display_allowed, notes)
VALUES
  ('product_search', 'id|product_id|item_id', 'product_snapshots', 'platform_product_id', 'text', FALSE, FALSE, FALSE, '无稳定商品 ID 的记录只计入缺失率。'),
  ('product_search', 'title|name', 'product_snapshots', 'title', 'text', TRUE, FALSE, FALSE, NULL),
  ('product_search', 'price|selling_price|sellingPrice', 'product_snapshots', 'price', 'numeric', TRUE, FALSE, FALSE, NULL),
  ('product_search', 'currency|currency_code', 'product_snapshots', 'currency', 'text', TRUE, FALSE, FALSE, NULL),
  ('product_search', 'sales|sold|volume', 'product_snapshots', 'sales', 'numeric', TRUE, FALSE, FALSE, NULL),
  ('product_detail', 'id|product_id|item_id', 'product_snapshots', 'platform_product_id', 'text', FALSE, FALSE, FALSE, NULL),
  ('product_detail', 'title|name', 'product_snapshots', 'title', 'text', TRUE, FALSE, FALSE, NULL),
  ('product_detail', 'price|selling_price|sellingPrice', 'product_snapshots', 'price', 'numeric', TRUE, FALSE, FALSE, NULL),
  ('product_detail', 'rating|review_count|inventory', 'product_snapshots', 'metrics', 'jsonb', TRUE, FALSE, FALSE, NULL),
  ('seller_profile', 'id|shop_id|seller_id|store_id', 'shop_snapshots', 'platform_shop_id', 'text', FALSE, FALSE, FALSE, '卖家资料统一归入店铺实体。'),
  ('seller_profile', 'name|shop_name|seller_name', 'shop_snapshots', 'name', 'text', TRUE, FALSE, FALSE, NULL),
  ('seller_profile', 'followers|fans', 'shop_snapshots', 'followers', 'numeric', TRUE, FALSE, FALSE, NULL),
  ('shop_analytics', 'id|shop_id|seller_id|store_id', 'shop_snapshots', 'platform_shop_id', 'text', FALSE, FALSE, FALSE, NULL),
  ('shop_analytics', 'gmv|GMV', 'shop_snapshots', 'gmv', 'numeric', TRUE, FALSE, FALSE, NULL),
  ('shop_analytics', 'sales|sold|volume', 'shop_snapshots', 'sales', 'numeric', TRUE, FALSE, FALSE, NULL),
  ('shop_analytics', 'followers|fans', 'shop_snapshots', 'followers', 'numeric', TRUE, FALSE, FALSE, NULL),
  ('shop_analytics', 'product_count|productCount', 'shop_snapshots', 'product_count', 'numeric', TRUE, FALSE, FALSE, NULL)
ON CONFLICT (endpoint_key, source_path, target_table, target_field) DO UPDATE SET
  commercial_authorized = EXCLUDED.commercial_authorized,
  public_display_allowed = EXCLUDED.public_display_allowed,
  notes = EXCLUDED.notes;

ALTER TABLE public.tikhub_pilot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tikhub_endpoint_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tikhub_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tikhub_pilot_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tikhub_fetch_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tikhub_pilot_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tikhub_pilot_configs, public.tikhub_endpoint_catalog,
  public.tikhub_field_mappings, public.tikhub_pilot_runs,
  public.tikhub_fetch_events, public.tikhub_pilot_reports
  FROM anon, authenticated;
GRANT ALL ON public.tikhub_pilot_configs, public.tikhub_endpoint_catalog,
  public.tikhub_field_mappings, public.tikhub_pilot_runs,
  public.tikhub_fetch_events, public.tikhub_pilot_reports TO service_role;

COMMENT ON TABLE public.tikhub_pilot_configs IS 'TikHub seven-day US TikTok Shop pilot configuration; enabled only after authorization confirmation.';
COMMENT ON TABLE public.tikhub_endpoint_catalog IS 'Allowlisted TikHub endpoints. Paths are operator configuration and cookie endpoints are blocked by default.';
COMMENT ON TABLE public.tikhub_field_mappings IS 'Standard-field mapping and commercial/public authorization flags for each TikHub endpoint.';
COMMENT ON TABLE public.tikhub_fetch_events IS 'Private request ledger: hashes, status, cost and artifact references; never stores API keys or raw bodies.';
COMMENT ON TABLE public.tikhub_pilot_reports IS 'Seven-day TikHub pilot quality, coverage, duplication, success and cost report.';
COMMENT ON TABLE public.tikhub_pilot_configs IS 'All normalized TikHub evidence uses publication_status = quarantined until authorization is confirmed.';

COMMIT;
