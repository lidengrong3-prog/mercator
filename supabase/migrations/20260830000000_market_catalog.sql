-- Extensible market/platform catalog used by every report data domain.
-- This migration stores relationships and applicability only. Tax rates,
-- certifications and policy conclusions must come from verified records.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.market_catalog (
  code TEXT PRIMARY KEY CHECK (code = upper(code) AND char_length(code) BETWEEN 2 AND 12),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  label TEXT,
  flag TEXT,
  region_code TEXT,
  region_name TEXT,
  jurisdiction_codes TEXT[] NOT NULL DEFAULT '{}',
  platform_keys TEXT[] NOT NULL DEFAULT '{}',
  category_keys TEXT[] NOT NULL DEFAULT '{}',
  aliases TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
  data_status TEXT NOT NULL DEFAULT 'configured' CHECK (data_status IN ('configured', 'verified', 'partial', 'schema_only')),
  effective_from DATE,
  effective_to DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.platform_catalog (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'marketplace',
  aliases TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.market_platforms (
  market_code TEXT NOT NULL REFERENCES public.market_catalog(code) ON DELETE CASCADE,
  platform_key TEXT NOT NULL REFERENCES public.platform_catalog(key) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
  data_status TEXT NOT NULL DEFAULT 'unknown' CHECK (data_status IN ('verified', 'configured', 'partial', 'unknown')),
  label TEXT,
  effective_from DATE,
  effective_to DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (market_code, platform_key)
);

CREATE TABLE IF NOT EXISTS public.jurisdiction_catalog (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('country', 'region', 'customs_union', 'tax_area', 'platform_area')),
  parent_code TEXT REFERENCES public.jurisdiction_catalog(code) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.category_profiles (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  required_fields TEXT[] NOT NULL DEFAULT '{}',
  report_modules TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
  data_status TEXT NOT NULL DEFAULT 'schema_only' CHECK (data_status IN ('verified', 'configured', 'partial', 'schema_only')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.report_template_catalog (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  name TEXT NOT NULL,
  market_codes TEXT[] NOT NULL DEFAULT '{}',
  platform_keys TEXT[] NOT NULL DEFAULT '{}',
  category_codes TEXT[] NOT NULL DEFAULT '{}',
  required_domains TEXT[] NOT NULL DEFAULT '{}',
  modules TEXT[] NOT NULL DEFAULT '{}',
  schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
  data_status TEXT NOT NULL DEFAULT 'schema_only' CHECK (data_status IN ('verified', 'configured', 'partial', 'schema_only')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (code, version)
);

CREATE TABLE IF NOT EXISTS public.market_data_applicability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL CHECK (domain IN ('policy', 'tax', 'access', 'logistics', 'payment', 'rule', 'alert', 'market', 'platform', 'category')),
  record_key TEXT NOT NULL,
  market_code TEXT REFERENCES public.market_catalog(code) ON DELETE CASCADE,
  platform_key TEXT REFERENCES public.platform_catalog(key) ON DELETE CASCADE,
  category_code TEXT REFERENCES public.category_profiles(code) ON DELETE SET NULL,
  jurisdiction_code TEXT REFERENCES public.jurisdiction_catalog(code) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft', 'expired')),
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('verified', 'pending', 'rejected', 'uploaded')),
  source_kind TEXT CHECK (source_kind IN ('official', 'traceable', 'uploaded', 'derived', 'demo')),
  source_url TEXT,
  source_type TEXT,
  effective_from DATE,
  effective_to DATE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (domain, record_key, market_code, platform_key, category_code, jurisdiction_code)
);

ALTER TABLE public.market_catalog ADD COLUMN IF NOT EXISTS flag TEXT;
ALTER TABLE public.market_catalog ADD COLUMN IF NOT EXISTS platform_keys TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.market_catalog ADD COLUMN IF NOT EXISTS category_keys TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.market_data_applicability ADD COLUMN IF NOT EXISTS source_kind TEXT;

CREATE INDEX IF NOT EXISTS idx_market_catalog_status ON public.market_catalog(status, code);
CREATE INDEX IF NOT EXISTS idx_platform_catalog_status ON public.platform_catalog(status, key);
CREATE INDEX IF NOT EXISTS idx_market_platforms_platform ON public.market_platforms(platform_key, market_code, status);
CREATE INDEX IF NOT EXISTS idx_report_template_catalog_scope ON public.report_template_catalog(status, code, version);
CREATE INDEX IF NOT EXISTS idx_market_data_scope ON public.market_data_applicability(domain, market_code, platform_key, category_code, status);
CREATE INDEX IF NOT EXISTS idx_market_data_verification ON public.market_data_applicability(verification_status, effective_from, effective_to);
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_data_applicability_scope
  ON public.market_data_applicability(
    domain, record_key, coalesce(market_code::text, ''), coalesce(platform_key, ''),
    coalesce(category_code, ''), coalesce(jurisdiction_code, '')
  );

ALTER TABLE public.market_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jurisdiction_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_template_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data_applicability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS market_catalog_public_read ON public.market_catalog;
CREATE POLICY market_catalog_public_read ON public.market_catalog FOR SELECT TO anon, authenticated USING (status = 'active');
DROP POLICY IF EXISTS platform_catalog_public_read ON public.platform_catalog;
CREATE POLICY platform_catalog_public_read ON public.platform_catalog FOR SELECT TO anon, authenticated USING (status = 'active');
DROP POLICY IF EXISTS market_platforms_public_read ON public.market_platforms;
CREATE POLICY market_platforms_public_read ON public.market_platforms FOR SELECT TO anon, authenticated USING (status = 'active');
DROP POLICY IF EXISTS jurisdiction_catalog_public_read ON public.jurisdiction_catalog;
CREATE POLICY jurisdiction_catalog_public_read ON public.jurisdiction_catalog FOR SELECT TO anon, authenticated USING (status = 'active');
DROP POLICY IF EXISTS category_profiles_public_read ON public.category_profiles;
CREATE POLICY category_profiles_public_read ON public.category_profiles FOR SELECT TO anon, authenticated USING (status = 'active');
DROP POLICY IF EXISTS report_template_catalog_public_read ON public.report_template_catalog;
CREATE POLICY report_template_catalog_public_read ON public.report_template_catalog FOR SELECT TO anon, authenticated USING (status = 'active');
DROP POLICY IF EXISTS market_data_applicability_public_read ON public.market_data_applicability;
CREATE POLICY market_data_applicability_public_read ON public.market_data_applicability
  FOR SELECT TO anon, authenticated USING (status = 'active' AND verification_status IN ('verified', 'uploaded'));

GRANT SELECT ON public.market_catalog, public.platform_catalog, public.market_platforms,
  public.jurisdiction_catalog, public.category_profiles, public.report_template_catalog,
  public.market_data_applicability TO anon, authenticated;

-- Seed only the metadata needed to boot the current workspace. These rows do
-- not claim market facts, tax rates, policy conclusions or platform metrics.
INSERT INTO public.market_catalog
  (code, key, name, label, flag, region_code, region_name, jurisdiction_codes,
   platform_keys, category_keys, status, data_status, metadata)
VALUES
  ('US', 'us', '美国', '美国市场', '🇺🇸', 'NA', '北美', ARRAY['US'],
   ARRAY['amazon', 'tiktok-shop', 'aliexpress', 'ebay'],
   ARRAY['generic', 'electronics', 'beauty', 'apparel', 'pet-food'], 'active', 'configured',
   '{"data_sources":{"macro":{"local_path":"data/us_market/macro_indicators.json","source_kind":"official","source_type":"official_feed","commerce_profile":{"indicator_map":{"ecommerce_sales":"ECOMSA","ecommerce_penetration":"ECOMPCTSA","retail_sales":"RSAFS","disposable_income":"DSPIC96","consumer_confidence":"UMCSENT","consumer_spending":"PCEC96","inflation":"CPIAUCSL","exchange_rate":"DEXCHUS"},"category_indicator_map":{"apparel":["MRTSSM448USS"],"electronics":["MRTSSM443USS"],"beauty":[],"pet-food":[],"generic":[]},"background_codes":["GDP","UNRATE","INDPRO","BOPGSTB"]}}}}'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.platform_catalog (key, name, kind, aliases, status, metadata)
VALUES
  ('amazon', 'Amazon', 'marketplace', ARRAY['amazon', 'amazon.com'], 'active', '{}'::jsonb),
  ('tiktok-shop', 'TikTok Shop', 'social-commerce', ARRAY['tiktok shop', 'tiktokshop'], 'active', '{}'::jsonb),
  ('aliexpress', 'AliExpress', 'marketplace', ARRAY['aliexpress', '速卖通'], 'active', '{}'::jsonb),
  ('ebay', 'eBay', 'marketplace', ARRAY['ebay'], 'active', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.market_platforms (market_code, platform_key, status, data_status, label)
VALUES
  ('US', 'amazon', 'active', 'configured', '美国站'),
  ('US', 'tiktok-shop', 'active', 'configured', '美国站'),
  ('US', 'aliexpress', 'active', 'configured', '美国站'),
  ('US', 'ebay', 'active', 'configured', '美国站')
ON CONFLICT (market_code, platform_key) DO NOTHING;

INSERT INTO public.jurisdiction_catalog (code, name, type, parent_code, status)
VALUES ('US', '美国联邦辖区', 'country', NULL, 'active')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.category_profiles (code, name, aliases, required_fields, report_modules, status, data_status)
VALUES
  ('generic', '通用品类', ARRAY['generic', '通用'], ARRAY['category', 'market', 'platform'], ARRAY['category_overview', 'price_band', 'competition', 'risk'], 'active', 'schema_only'),
  ('electronics', '电子产品', ARRAY['electronics', '电子', '3c'], ARRAY['category', 'market', 'platform', 'productCost', 'sellingPrice', 'certifications'], ARRAY['category_overview', 'price_band', 'unit_economics', 'access_requirements', 'logistics', 'risk'], 'active', 'schema_only'),
  ('beauty', '美妆个护', ARRAY['beauty', 'cosmetics', '美妆', '个护'], ARRAY['category', 'market', 'platform', 'ingredients', 'claims', 'sellingPrice'], ARRAY['category_overview', 'consumer_profile', 'access_requirements', 'price_band', 'risk'], 'active', 'schema_only'),
  ('apparel', '服装', ARRAY['apparel', 'fashion', '服装', '服饰'], ARRAY['category', 'market', 'platform', 'material', 'sizeSystem', 'sellingPrice'], ARRAY['category_overview', 'consumer_profile', 'seasonality', 'price_band', 'risk'], 'active', 'schema_only'),
  ('pet-food', '宠物食品', ARRAY['pet-food', 'pet food', '宠物食品', '宠物粮'], ARRAY['category', 'market', 'platform', 'ingredients', 'shelfLife', 'certifications'], ARRAY['category_overview', 'consumer_profile', 'access_requirements', 'unit_economics', 'risk'], 'active', 'schema_only')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.report_template_catalog
  (id, code, version, name, market_codes, platform_keys, category_codes, required_domains, modules, data_status)
VALUES
  ('market-research-v1', 'market-research', 1, '市场调研报告', ARRAY['US'], ARRAY['amazon', 'tiktok-shop', 'aliexpress', 'ebay'], ARRAY['generic'], ARRAY['market', 'policy', 'platform', 'rule', 'alert'], ARRAY['executive_summary', 'market_environment', 'competitor_research', 'consumer_needs', 'platform_research', 'product_fit', 'risk_recommendations'], 'schema_only'),
  ('electronics-market-v1', 'electronics-market', 1, '电子产品市场调研报告', ARRAY['US'], ARRAY['amazon', 'tiktok-shop', 'aliexpress', 'ebay'], ARRAY['electronics'], ARRAY['market', 'policy', 'tax', 'access', 'logistics', 'platform', 'rule'], ARRAY['executive_summary', 'market_environment', 'consumer_needs', 'platform_research', 'unit_economics', 'access_requirements', 'logistics', 'risk_recommendations'], 'schema_only'),
  ('beauty-market-v1', 'beauty-market', 1, '美妆个护市场调研报告', ARRAY['US'], ARRAY['amazon', 'tiktok-shop', 'aliexpress', 'ebay'], ARRAY['beauty'], ARRAY['market', 'policy', 'tax', 'access', 'platform', 'rule'], ARRAY['executive_summary', 'market_environment', 'consumer_profile', 'platform_research', 'access_requirements', 'price_band', 'risk_recommendations'], 'schema_only'),
  ('apparel-market-v1', 'apparel-market', 1, '服装市场调研报告', ARRAY['US'], ARRAY['amazon', 'tiktok-shop', 'aliexpress', 'ebay'], ARRAY['apparel'], ARRAY['market', 'policy', 'access', 'platform', 'rule'], ARRAY['executive_summary', 'market_environment', 'consumer_profile', 'seasonality', 'platform_research', 'price_band', 'risk_recommendations'], 'schema_only'),
  ('pet-food-market-v1', 'pet-food-market', 1, '宠物食品市场调研报告', ARRAY['US'], ARRAY['amazon', 'tiktok-shop', 'aliexpress', 'ebay'], ARRAY['pet-food'], ARRAY['market', 'policy', 'tax', 'access', 'logistics', 'platform', 'rule'], ARRAY['executive_summary', 'market_environment', 'consumer_profile', 'platform_research', 'access_requirements', 'unit_economics', 'logistics', 'risk_recommendations'], 'schema_only')
ON CONFLICT (id) DO NOTHING;

COMMIT;
