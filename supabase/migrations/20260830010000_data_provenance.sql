-- Data provenance foundation.
-- raw_data_records preserves the fetched evidence envelope; the existing
-- market_data_applicability table remains the normalized, scope-filtered
-- publishable projection.

BEGIN;

CREATE TABLE IF NOT EXISTS public.data_source_registry (
  source_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('official', 'traceable', 'uploaded', 'derived', 'demo')),
  source_type TEXT NOT NULL CHECK (source_type IN ('government', 'regulator', 'platform', 'official_feed', 'industry_association', 'licensed_provider', 'user_upload', 'derived', 'demo', 'unknown')),
  base_url TEXT,
  market_codes TEXT[] NOT NULL DEFAULT '{}',
  platform_keys TEXT[] NOT NULL DEFAULT '{}',
  verification_policy TEXT NOT NULL DEFAULT 'manual_review' CHECK (verification_policy IN ('automatic', 'manual_review', 'upload_review', 'blocked')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.raw_data_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL REFERENCES public.data_source_registry(source_key) ON DELETE RESTRICT,
  domain TEXT NOT NULL CHECK (domain IN ('policy', 'tax', 'access', 'logistics', 'payment', 'rule', 'alert', 'market', 'platform', 'category')),
  source_record_id TEXT NOT NULL,
  normalized_record_key TEXT,
  market_codes TEXT[] NOT NULL DEFAULT '{}',
  platform_keys TEXT[] NOT NULL DEFAULT '{}',
  category_codes TEXT[] NOT NULL DEFAULT '{}',
  jurisdiction_codes TEXT[] NOT NULL DEFAULT '{}',
  source_kind TEXT NOT NULL CHECK (source_kind IN ('official', 'traceable', 'uploaded', 'derived', 'demo')),
  source_type TEXT NOT NULL CHECK (source_type IN ('government', 'regulator', 'platform', 'official_feed', 'industry_association', 'licensed_provider', 'user_upload', 'derived', 'demo', 'unknown')),
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('verified', 'uploaded', 'pending', 'rejected')),
  source_url TEXT,
  collected_at TIMESTAMPTZ,
  retrieved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  effective_from DATE,
  effective_to DATE,
  verified_at TIMESTAMPTZ,
  verification_notes TEXT,
  evidence_hash TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'rejected', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_key, source_record_id, evidence_hash)
);

ALTER TABLE public.market_data_applicability ADD COLUMN IF NOT EXISTS source_key TEXT;
ALTER TABLE public.market_data_applicability ADD COLUMN IF NOT EXISTS source_record_id TEXT;
ALTER TABLE public.market_data_applicability ADD COLUMN IF NOT EXISTS raw_record_id UUID REFERENCES public.raw_data_records(id) ON DELETE SET NULL;
ALTER TABLE public.market_data_applicability ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;
ALTER TABLE public.market_data_applicability ADD COLUMN IF NOT EXISTS retrieved_at TIMESTAMPTZ;
ALTER TABLE public.market_data_applicability ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE public.market_data_applicability ADD COLUMN IF NOT EXISTS effective_to DATE;
ALTER TABLE public.market_data_applicability ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.market_data_applicability ADD COLUMN IF NOT EXISTS verification_notes TEXT;
ALTER TABLE public.market_data_applicability ADD COLUMN IF NOT EXISTS evidence_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_data_source_registry_scope
  ON public.data_source_registry(status, source_kind, source_type);
CREATE INDEX IF NOT EXISTS idx_raw_data_records_scope
  ON public.raw_data_records(domain, verification_status, status);
CREATE INDEX IF NOT EXISTS idx_raw_data_records_market
  ON public.raw_data_records USING GIN(market_codes);
CREATE INDEX IF NOT EXISTS idx_raw_data_records_evidence
  ON public.raw_data_records(source_key, source_record_id, evidence_hash);
CREATE INDEX IF NOT EXISTS idx_market_data_raw_record
  ON public.market_data_applicability(raw_record_id, source_key, source_record_id);

ALTER TABLE public.data_source_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_data_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_source_registry_public_read ON public.data_source_registry;
CREATE POLICY data_source_registry_public_read ON public.data_source_registry
  FOR SELECT TO anon, authenticated USING (status = 'active');

-- Raw payloads are retained for audit and reprocessing.  They are deliberately
-- not exposed to the anonymous browser; the normalized table is the only
-- public projection and already gates verified/uploaded records.
REVOKE ALL ON public.raw_data_records FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.data_source_registry FROM anon, authenticated;
GRANT SELECT ON public.data_source_registry TO anon, authenticated;

INSERT INTO public.data_source_registry
  (source_key, name, source_kind, source_type, base_url, verification_policy, status)
VALUES
  ('federal-register', 'US Federal Register', 'official', 'government', 'https://www.federalregister.gov/', 'automatic', 'active'),
  ('ustr', 'US Trade Representative', 'official', 'government', 'https://ustr.gov/', 'automatic', 'active'),
  ('cpsc', 'US Consumer Product Safety Commission', 'official', 'regulator', 'https://www.cpsc.gov/', 'automatic', 'active'),
  ('platform-official', 'Platform official announcements', 'traceable', 'platform', NULL, 'manual_review', 'active'),
  ('user-upload', '人工上传数据', 'uploaded', 'user_upload', NULL, 'upload_review', 'active')
ON CONFLICT (source_key) DO NOTHING;

COMMIT;
