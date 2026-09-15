-- Keep raw, licensed and operational data private while preserving a
-- traceable public projection.

BEGIN;

INSERT INTO public.data_source_registry
  (source_key, name, source_kind, source_type, base_url, verification_policy, status)
VALUES
  ('federal-register', 'US Federal Register', 'official', 'government', 'https://www.federalregister.gov/', 'automatic', 'active'),
  ('ustr', 'US Trade Representative', 'official', 'government', 'https://ustr.gov/', 'automatic', 'active'),
  ('cpsc', 'US Consumer Product Safety Commission', 'official', 'regulator', 'https://www.cpsc.gov/', 'automatic', 'active'),
  ('platform-official', 'Platform official announcements', 'traceable', 'platform', NULL, 'manual_review', 'active'),
  ('traceable-feed', 'Traceable third-party feed', 'traceable', 'licensed_provider', NULL, 'manual_review', 'active'),
  ('user-upload', '人工上传数据', 'uploaded', 'user_upload', NULL, 'upload_review', 'active'),
  ('derived', 'Derived internal records', 'derived', 'derived', NULL, 'blocked', 'active'),
  ('demo', 'Demonstration records', 'demo', 'demo', NULL, 'blocked', 'inactive'),
  ('tikhub', 'TikHub API', 'traceable', 'licensed_provider', 'https://tikhub.io/', 'manual_review', 'active'),
  ('fred', 'Federal Reserve Economic Data', 'official', 'official_feed', 'https://fred.stlouisfed.org/', 'automatic', 'active'),
  ('bls', 'US Bureau of Labor Statistics', 'official', 'government', 'https://www.bls.gov/', 'automatic', 'active'),
  ('official-source', 'Other verified official sources', 'official', 'government', NULL, 'automatic', 'active'),
  ('internal-system', 'JAY观海内部运行数据', 'derived', 'derived', NULL, 'blocked', 'active')
ON CONFLICT (source_key) DO UPDATE SET
  name = EXCLUDED.name,
  source_kind = EXCLUDED.source_kind,
  source_type = EXCLUDED.source_type,
  base_url = EXCLUDED.base_url,
  verification_policy = EXCLUDED.verification_policy,
  status = EXCLUDED.status,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.data_source_access_policies (
  source_key TEXT PRIMARY KEY REFERENCES public.data_source_registry(source_key) ON DELETE CASCADE,
  license_class TEXT NOT NULL CHECK (license_class IN (
    'official_public', 'open', 'commercial', 'user_owned', 'internal', 'restricted'
  )),
  access_class TEXT NOT NULL CHECK (access_class IN (
    'public_summary', 'workspace_private', 'service_private', 'blocked'
  )),
  redistribution_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  retention_days INTEGER NOT NULL CHECK (retention_days BETWEEN 1 AND 3650),
  authorization_secret_name TEXT,
  provider_terms_url TEXT,
  permitted_uses TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.raw_data_records
  ADD COLUMN IF NOT EXISTS license_class TEXT NOT NULL DEFAULT 'restricted',
  ADD COLUMN IF NOT EXISTS access_class TEXT NOT NULL DEFAULT 'service_private',
  ADD COLUMN IF NOT EXISTS redistribution_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS retention_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT,
  ADD COLUMN IF NOT EXISTS storage_object_path TEXT;

ALTER TABLE public.raw_data_records
  DROP CONSTRAINT IF EXISTS raw_data_records_license_class_check;
ALTER TABLE public.raw_data_records
  ADD CONSTRAINT raw_data_records_license_class_check CHECK (license_class IN (
    'official_public', 'open', 'commercial', 'user_owned', 'internal', 'restricted'
  ));
ALTER TABLE public.raw_data_records
  DROP CONSTRAINT IF EXISTS raw_data_records_access_class_check;
ALTER TABLE public.raw_data_records
  ADD CONSTRAINT raw_data_records_access_class_check CHECK (access_class IN (
    'public_summary', 'workspace_private', 'service_private', 'blocked'
  ));

CREATE TABLE IF NOT EXISTS public.private_data_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT NOT NULL,
  source_key TEXT REFERENCES public.data_source_registry(source_key) ON DELETE RESTRICT,
  artifact_kind TEXT NOT NULL CHECK (artifact_kind IN (
    'raw_response', 'collection_log', 'sync_log', 'quarantine',
    'licensed_dataset', 'internal_dataset', 'encrypted_backup'
  )),
  original_name TEXT NOT NULL,
  bucket_id TEXT NOT NULL DEFAULT 'private-raw-data',
  object_path TEXT NOT NULL,
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retention_until TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bucket_id, object_path)
);

CREATE TABLE IF NOT EXISTS public.private_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'partial')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_private_data_artifacts_retention
  ON public.private_data_artifacts(retention_until, source_key, artifact_kind);
CREATE INDEX IF NOT EXISTS idx_raw_data_records_retention
  ON public.raw_data_records(retention_until, source_key);
CREATE INDEX IF NOT EXISTS idx_private_sync_runs_completed
  ON public.private_sync_runs(completed_at DESC);

ALTER TABLE public.data_source_access_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_data_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_sync_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.data_source_access_policies FROM anon, authenticated;
REVOKE ALL ON public.private_data_artifacts FROM anon, authenticated;
REVOKE ALL ON public.private_sync_runs FROM anon, authenticated;
GRANT ALL ON public.data_source_access_policies TO service_role;
GRANT ALL ON public.private_data_artifacts TO service_role;
GRANT ALL ON public.private_sync_runs TO service_role;

INSERT INTO public.data_source_access_policies
  (source_key, license_class, access_class, redistribution_allowed, retention_days,
   authorization_secret_name, provider_terms_url, permitted_uses, notes)
VALUES
  ('federal-register', 'official_public', 'public_summary', TRUE, 730, NULL,
   'https://www.federalregister.gov/policy', ARRAY['audit', 'analysis', 'public_summary'], NULL),
  ('ustr', 'official_public', 'public_summary', TRUE, 730, NULL,
   'https://ustr.gov/about-us/policy-offices/press-office/website-policies', ARRAY['audit', 'analysis', 'public_summary'], NULL),
  ('cpsc', 'official_public', 'public_summary', TRUE, 730, NULL,
   'https://www.cpsc.gov/About-CPSC/Policies-Statements-and-Directives', ARRAY['audit', 'analysis', 'public_summary'], NULL),
  ('fred', 'official_public', 'public_summary', TRUE, 730, 'FRED_API_KEY',
   'https://fred.stlouisfed.org/legal/', ARRAY['audit', 'analysis', 'public_summary'], NULL),
  ('bls', 'official_public', 'public_summary', TRUE, 730, NULL,
   'https://www.bls.gov/bls/linksite.htm', ARRAY['audit', 'analysis', 'public_summary'], NULL),
  ('platform-official', 'official_public', 'public_summary', TRUE, 365, NULL, NULL,
   ARRAY['audit', 'analysis', 'public_summary'], '发布前仍需逐条核验平台转载限制。'),
  ('official-source', 'official_public', 'public_summary', TRUE, 730, NULL, NULL,
   ARRAY['audit', 'analysis', 'public_summary'], '仅用于已完成来源核验的政府或监管机构记录。'),
  ('traceable-feed', 'restricted', 'service_private', FALSE, 180, NULL, NULL,
   ARRAY['audit', 'analysis'], '第三方行业资讯只保留在私有证据层。'),
  ('user-upload', 'user_owned', 'workspace_private', FALSE, 365, NULL, NULL,
   ARRAY['workspace_analysis'], '仅所属工作区可使用。'),
  ('derived', 'internal', 'service_private', FALSE, 365, NULL, NULL,
   ARRAY['analysis'], NULL),
  ('demo', 'restricted', 'blocked', FALSE, 30, NULL, NULL, '{}', '禁止进入生产公开投影。'),
  ('tikhub', 'commercial', 'service_private', FALSE, 30, 'TIKHUB_API_KEY',
   'https://tikhub.io/zh/terms', ARRAY['internal_search', 'workspace_analysis'],
   'API Key 只能存在于部署 Secrets；原始响应禁止再分发。'),
  ('internal-system', 'internal', 'service_private', FALSE, 90, NULL, NULL,
   ARRAY['operations', 'audit', 'recovery'], NULL)
ON CONFLICT (source_key) DO UPDATE SET
  license_class = EXCLUDED.license_class,
  access_class = EXCLUDED.access_class,
  redistribution_allowed = EXCLUDED.redistribution_allowed,
  retention_days = EXCLUDED.retention_days,
  authorization_secret_name = EXCLUDED.authorization_secret_name,
  provider_terms_url = EXCLUDED.provider_terms_url,
  permitted_uses = EXCLUDED.permitted_uses,
  notes = EXCLUDED.notes,
  updated_at = NOW();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'private-raw-data',
  'private-raw-data',
  FALSE,
  209715200,
  ARRAY['application/json', 'application/x-ndjson', 'text/plain', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.link_market_data_raw_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source_key IS NOT NULL
     AND NEW.source_record_id IS NOT NULL
     AND NEW.evidence_hash IS NOT NULL THEN
    SELECT raw.id
      INTO NEW.raw_record_id
      FROM public.raw_data_records AS raw
     WHERE raw.source_key = NEW.source_key
       AND raw.source_record_id = NEW.source_record_id
       AND raw.evidence_hash = NEW.evidence_hash
     ORDER BY raw.created_at DESC
     LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_market_data_raw_record ON public.market_data_applicability;
CREATE TRIGGER trg_link_market_data_raw_record
  BEFORE INSERT OR UPDATE OF source_key, source_record_id, evidence_hash
  ON public.market_data_applicability
  FOR EACH ROW EXECUTE FUNCTION public.link_market_data_raw_record();

UPDATE public.market_data_applicability AS formal
   SET raw_record_id = raw.id
  FROM public.raw_data_records AS raw
 WHERE formal.raw_record_id IS NULL
   AND formal.source_key = raw.source_key
   AND formal.source_record_id = raw.source_record_id
   AND formal.evidence_hash = raw.evidence_hash;

COMMENT ON TABLE public.data_source_access_policies IS
  'Service-only authorization, license, redistribution and retention policy for each source.';
COMMENT ON TABLE public.private_data_artifacts IS
  'Service-only index of raw, quarantined, licensed and operational objects in private Storage.';
COMMENT ON COLUMN public.market_data_applicability.raw_record_id IS
  'Trace from an allowed public formal record to its service-only raw evidence record.';

COMMIT;
