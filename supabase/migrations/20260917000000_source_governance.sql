-- Source registration, authorization and publication governance.
-- The registry is public metadata; access policies and raw evidence remain
-- service-only.  A source may be collected into quarantine before its license
-- is confirmed, but it can never enter the formal public projection then.

BEGIN;

ALTER TABLE public.data_source_registry
  ADD COLUMN IF NOT EXISTS subject_name TEXT,
  ADD COLUMN IF NOT EXISTS authority_level TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS trust_level TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS source_category TEXT NOT NULL DEFAULT 'derived',
  ADD COLUMN IF NOT EXISTS category_codes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS update_frequency TEXT NOT NULL DEFAULT 'on_demand',
  ADD COLUMN IF NOT EXISTS collection_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

ALTER TABLE public.data_source_registry
  DROP CONSTRAINT IF EXISTS data_source_registry_status_check;
ALTER TABLE public.data_source_registry
  ADD CONSTRAINT data_source_registry_status_check CHECK (
    status IN ('active', 'inactive', 'draft', 'expired', 'suspended')
  );
ALTER TABLE public.data_source_registry
  DROP CONSTRAINT IF EXISTS data_source_registry_source_category_check;
ALTER TABLE public.data_source_registry
  ADD CONSTRAINT data_source_registry_source_category_check CHECK (
    source_category IN (
      'official_policy', 'official_statistics', 'platform_announcement',
      'industry_media', 'third_party_provider', 'user_upload', 'derived',
      'internal', 'demo'
    )
  );
ALTER TABLE public.data_source_registry
  DROP CONSTRAINT IF EXISTS data_source_registry_trust_level_check;
ALTER TABLE public.data_source_registry
  ADD CONSTRAINT data_source_registry_trust_level_check CHECK (
    trust_level IN ('high', 'medium', 'low', 'unknown')
  );

ALTER TABLE public.data_source_access_policies
  ADD COLUMN IF NOT EXISTS authorization_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS authorization_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS authorization_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS commercial_use_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS api_pricing JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rate_limit_requests INTEGER,
  ADD COLUMN IF NOT EXISTS rate_limit_window_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS allowed_display_fields TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allowed_storage_fields TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allowed_export_fields TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS requires_attribution BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS attribution_text TEXT,
  ADD COLUMN IF NOT EXISTS reviewer TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.data_source_access_policies
  DROP CONSTRAINT IF EXISTS data_source_access_policies_authorization_status_check;
ALTER TABLE public.data_source_access_policies
  ADD CONSTRAINT data_source_access_policies_authorization_status_check CHECK (
    authorization_status IN ('confirmed', 'pending', 'expired', 'revoked', 'not_required')
  );
ALTER TABLE public.data_source_access_policies
  DROP CONSTRAINT IF EXISTS data_source_access_policies_rate_limit_check;
ALTER TABLE public.data_source_access_policies
  ADD CONSTRAINT data_source_access_policies_rate_limit_check CHECK (
    (rate_limit_requests IS NULL OR rate_limit_requests > 0)
    AND (rate_limit_window_seconds IS NULL OR rate_limit_window_seconds > 0)
  );

ALTER TABLE public.raw_data_records
  ADD COLUMN IF NOT EXISTS source_category TEXT,
  ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'quarantined',
  ADD COLUMN IF NOT EXISTS quarantine_reason TEXT,
  ADD COLUMN IF NOT EXISTS allowed_display_fields TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allowed_export_fields TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.raw_data_records
  DROP CONSTRAINT IF EXISTS raw_data_records_publication_status_check;
ALTER TABLE public.raw_data_records
  ADD CONSTRAINT raw_data_records_publication_status_check CHECK (
    publication_status IN ('eligible', 'quarantined', 'blocked')
  );

ALTER TABLE public.market_data_applicability
  ADD COLUMN IF NOT EXISTS source_category TEXT;

-- Existing rows are classified conservatively.  The update also prevents a
-- legacy row without a provenance key from remaining publicly visible.
UPDATE public.data_source_registry
   SET source_category = CASE
     WHEN source_type IN ('government', 'regulator') THEN 'official_policy'
     WHEN source_type = 'official_feed' THEN 'official_statistics'
     WHEN source_type = 'platform' THEN 'platform_announcement'
     WHEN source_type = 'licensed_provider' THEN 'third_party_provider'
     WHEN source_type = 'user_upload' THEN 'user_upload'
     WHEN source_type = 'demo' THEN 'demo'
     WHEN source_type = 'derived' AND source_kind = 'derived' THEN 'derived'
     ELSE COALESCE(source_category, 'derived')
   END,
   subject_name = COALESCE(subject_name, name),
   updated_at = NOW();

UPDATE public.market_data_applicability
   SET status = 'inactive'
 WHERE source_key IS NULL;

CREATE INDEX IF NOT EXISTS idx_data_source_registry_governance
  ON public.data_source_registry(status, collection_enabled, source_category, next_review_at);
CREATE INDEX IF NOT EXISTS idx_data_source_access_authorization
  ON public.data_source_access_policies(authorization_status, authorization_expires_at);
CREATE INDEX IF NOT EXISTS idx_raw_data_publication_status
  ON public.raw_data_records(publication_status, source_key);
CREATE INDEX IF NOT EXISTS idx_market_data_source_category
  ON public.market_data_applicability(source_key, source_category, verification_status);

-- Keep the seeded registry explicit and reviewable.  Values such as price and
-- rate limits are policy metadata, not provider secrets.
INSERT INTO public.data_source_registry
  (source_key, name, subject_name, source_kind, source_type, source_category,
   base_url, authority_level, trust_level, market_codes, platform_keys,
   verification_policy, update_frequency, collection_enabled, status)
VALUES
  ('federal-register', 'US Federal Register', 'United States Federal Register', 'official', 'government', 'official_policy', 'https://www.federalregister.gov/', 'federal', 'high', ARRAY['US'], '{}', 'automatic', '4h', TRUE, 'active'),
  ('ustr', 'US Trade Representative', 'Office of the United States Trade Representative', 'official', 'government', 'official_policy', 'https://ustr.gov/', 'federal', 'high', ARRAY['US'], '{}', 'automatic', '4h', TRUE, 'active'),
  ('cpsc', 'US Consumer Product Safety Commission', 'US Consumer Product Safety Commission', 'official', 'regulator', 'official_policy', 'https://www.cpsc.gov/', 'federal', 'high', ARRAY['US'], '{}', 'automatic', '4h', TRUE, 'active'),
  ('fred', 'Federal Reserve Economic Data', 'Federal Reserve Bank of St. Louis', 'official', 'official_feed', 'official_statistics', 'https://fred.stlouisfed.org/', 'federal', 'high', ARRAY['US'], '{}', 'automatic', '1d', TRUE, 'active'),
  ('bls', 'US Bureau of Labor Statistics', 'US Bureau of Labor Statistics', 'official', 'government', 'official_statistics', 'https://www.bls.gov/', 'federal', 'high', ARRAY['US'], '{}', 'automatic', '1d', TRUE, 'active'),
  ('macro-official', 'FRED / BLS macro indicators', 'US official statistical feeds', 'official', 'official_feed', 'official_statistics', NULL, 'federal', 'high', ARRAY['US'], '{}', 'automatic', '1d', TRUE, 'active'),
  ('platform-official', 'Platform official announcements', 'Marketplace and social-commerce operators', 'traceable', 'platform', 'platform_announcement', NULL, 'platform', 'high', '{}', ARRAY['amazon', 'tiktok-shop'], 'manual_review', '4h', TRUE, 'active'),
  ('official-source', 'Other verified official sources', 'Verified government or regulator source', 'official', 'government', 'official_policy', NULL, 'government', 'medium', '{}', '{}', 'automatic', 'weekly', TRUE, 'active'),
  ('traceable-feed', 'Traceable industry media feed', 'Industry media and associations', 'traceable', 'industry_association', 'industry_media', NULL, 'industry', 'medium', '{}', '{}', 'manual_review', 'daily', TRUE, 'active'),
  ('tikhub', 'TikHub API', 'TikHub third-party data service', 'traceable', 'licensed_provider', 'third_party_provider', 'https://tikhub.io/', 'commercial_provider', 'medium', '{}', '{}', 'manual_review', 'on_demand', TRUE, 'active'),
  ('user-upload', '人工上传数据', 'Workspace member', 'uploaded', 'user_upload', 'user_upload', NULL, 'workspace', 'medium', '{}', '{}', 'upload_review', 'on_demand', TRUE, 'active'),
  ('derived', '由正式记录派生的数据', 'JAY观海 data pipeline', 'derived', 'derived', 'derived', NULL, 'internal', 'medium', '{}', '{}', 'automatic', 'per_run', TRUE, 'active'),
  ('demo', '演示数据（不可发布）', 'Development fixture', 'demo', 'demo', 'demo', NULL, 'internal', 'low', '{}', '{}', 'blocked', 'never', FALSE, 'inactive'),
  ('internal-system', 'JAY观海内部运行数据', 'JAY观海 service', 'derived', 'derived', 'internal', NULL, 'internal', 'high', '{}', '{}', 'blocked', 'per_run', TRUE, 'active')
ON CONFLICT (source_key) DO UPDATE SET
  name = EXCLUDED.name,
  subject_name = EXCLUDED.subject_name,
  source_kind = EXCLUDED.source_kind,
  source_type = EXCLUDED.source_type,
  source_category = EXCLUDED.source_category,
  base_url = EXCLUDED.base_url,
  authority_level = EXCLUDED.authority_level,
  trust_level = EXCLUDED.trust_level,
  market_codes = EXCLUDED.market_codes,
  platform_keys = EXCLUDED.platform_keys,
  verification_policy = EXCLUDED.verification_policy,
  update_frequency = EXCLUDED.update_frequency,
  collection_enabled = EXCLUDED.collection_enabled,
  status = EXCLUDED.status,
  updated_at = NOW();

INSERT INTO public.data_source_access_policies
  (source_key, license_class, access_class, redistribution_allowed, retention_days,
   authorization_status, commercial_use_allowed, api_pricing, rate_limit_requests,
   rate_limit_window_seconds, allowed_display_fields, allowed_storage_fields,
   allowed_export_fields, requires_attribution, authorization_secret_name,
   provider_terms_url, permitted_uses, notes)
SELECT source_key, 'official_public', 'public_summary', TRUE, 730,
       'not_required', TRUE,
       '{"model":"public","currency":"USD","amount":0}'::jsonb,
       CASE WHEN source_key = 'platform-official' THEN 120 ELSE NULL END,
       CASE WHEN source_key = 'platform-official' THEN 60 ELSE NULL END,
       ARRAY['title','summary','source','source_url','published_at','effective_from'],
       ARRAY['title','summary','source','source_url','published_at','effective_from','payload','evidence_hash','collected_at','retrieved_at'],
       ARRAY['title','summary','source','source_url','published_at','effective_from'],
       FALSE, NULL, NULL, ARRAY['audit','analysis','public_summary'], NULL
  FROM public.data_source_registry
 WHERE source_key IN ('federal-register','ustr','cpsc','fred','bls','macro-official','platform-official','official-source')
ON CONFLICT (source_key) DO UPDATE SET
  authorization_status = EXCLUDED.authorization_status,
  commercial_use_allowed = EXCLUDED.commercial_use_allowed,
  api_pricing = EXCLUDED.api_pricing,
  rate_limit_requests = EXCLUDED.rate_limit_requests,
  rate_limit_window_seconds = EXCLUDED.rate_limit_window_seconds,
  allowed_display_fields = EXCLUDED.allowed_display_fields,
  allowed_storage_fields = EXCLUDED.allowed_storage_fields,
  allowed_export_fields = EXCLUDED.allowed_export_fields,
  permitted_uses = EXCLUDED.permitted_uses,
  updated_at = NOW();

INSERT INTO public.data_source_access_policies
  (source_key, license_class, access_class, redistribution_allowed, retention_days,
   authorization_status, commercial_use_allowed, api_pricing, rate_limit_requests,
   rate_limit_window_seconds, allowed_display_fields, allowed_storage_fields,
   allowed_export_fields, requires_attribution, authorization_secret_name,
   provider_terms_url, permitted_uses, notes)
VALUES
  ('traceable-feed', 'restricted', 'service_private', FALSE, 180, 'pending', FALSE, '{}'::jsonb, NULL, NULL,
   ARRAY['title','summary','source','source_url','published_at'], ARRAY['title','summary','source','source_url','published_at','payload','evidence_hash','collected_at'], '{}', TRUE, NULL, NULL, ARRAY['audit','analysis'], '第三方行业资讯只能作为隔离区参考。'),
  ('tikhub', 'commercial', 'service_private', FALSE, 30, 'pending', FALSE, '{"model":"provider_plan","currency":"USD"}'::jsonb, 60, 60,
   ARRAY['id','title','summary','metrics_summary'], ARRAY['id','title','payload','source_url','collected_at','evidence_hash'], '{}', FALSE, 'TIKHUB_API_KEY', 'https://tikhub.io/zh/terms', ARRAY['internal_search','workspace_analysis'], 'API Key 只允许存在于部署 Secrets。'),
  ('user-upload', 'user_owned', 'workspace_private', FALSE, 365, 'confirmed', FALSE, '{}'::jsonb, NULL, NULL,
   ARRAY['title','summary','source','source_url','published_at'], ARRAY['title','summary','source','source_url','published_at','payload','evidence_hash','collected_at'], ARRAY['title','summary','source','source_url','published_at'], FALSE, NULL, NULL, ARRAY['workspace_analysis'], NULL),
  ('derived', 'internal', 'service_private', FALSE, 365, 'not_required', FALSE, '{}'::jsonb, NULL, NULL, '{}', ARRAY['payload','evidence_hash','collected_at'], '{}', FALSE, NULL, NULL, ARRAY['analysis'], NULL),
  ('demo', 'restricted', 'blocked', FALSE, 30, 'revoked', FALSE, '{}'::jsonb, NULL, NULL, '{}', '{}', '{}', FALSE, NULL, NULL, '{}', '禁止进入生产公开投影。'),
  ('internal-system', 'internal', 'service_private', FALSE, 90, 'not_required', FALSE, '{}'::jsonb, NULL, NULL, '{}', ARRAY['payload','evidence_hash','collected_at'], '{}', FALSE, NULL, NULL, ARRAY['operations','audit','recovery'], NULL)
ON CONFLICT (source_key) DO UPDATE SET
  authorization_status = EXCLUDED.authorization_status,
  commercial_use_allowed = EXCLUDED.commercial_use_allowed,
  api_pricing = EXCLUDED.api_pricing,
  rate_limit_requests = EXCLUDED.rate_limit_requests,
  rate_limit_window_seconds = EXCLUDED.rate_limit_window_seconds,
  allowed_display_fields = EXCLUDED.allowed_display_fields,
  allowed_storage_fields = EXCLUDED.allowed_storage_fields,
  allowed_export_fields = EXCLUDED.allowed_export_fields,
  requires_attribution = EXCLUDED.requires_attribution,
  authorization_secret_name = EXCLUDED.authorization_secret_name,
  provider_terms_url = EXCLUDED.provider_terms_url,
  permitted_uses = EXCLUDED.permitted_uses,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- Expiry is evaluated on every call and can also be materialized by the
-- scheduled operations job.  An overdue review is treated as expired.
CREATE OR REPLACE FUNCTION public.refresh_source_registry_status()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE changed_count INTEGER;
BEGIN
  UPDATE public.data_source_registry AS registry
     SET status = 'expired', collection_enabled = FALSE,
         deactivated_at = COALESCE(registry.deactivated_at, NOW()),
         deactivation_reason = COALESCE(registry.deactivation_reason, 'source review or authorization expired'),
         updated_at = NOW()
   WHERE registry.status = 'active'
     AND (
       (registry.next_review_at IS NOT NULL AND registry.next_review_at <= NOW())
       OR EXISTS (
         SELECT 1
           FROM public.data_source_access_policies AS policy
          WHERE policy.source_key = registry.source_key
            AND policy.authorization_expires_at IS NOT NULL
            AND policy.authorization_expires_at <= NOW()
       )
     );
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  UPDATE public.data_source_access_policies
     SET authorization_status = 'expired', updated_at = NOW()
   WHERE authorization_expires_at IS NOT NULL
     AND authorization_expires_at <= NOW()
     AND authorization_status NOT IN ('expired', 'revoked');
  RETURN changed_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.source_is_collectable(p_source_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.data_source_registry AS registry
      JOIN public.data_source_access_policies AS policy USING (source_key)
     WHERE registry.source_key = p_source_key
       AND registry.status = 'active'
       AND registry.collection_enabled = TRUE
       AND (registry.deactivated_at IS NULL OR registry.deactivated_at > NOW())
       AND (registry.next_review_at IS NULL OR registry.next_review_at > NOW())
       AND COALESCE(policy.authorization_status, 'pending') NOT IN ('expired', 'revoked')
       AND (policy.authorization_expires_at IS NULL OR policy.authorization_expires_at > NOW())
  );
$$;

CREATE OR REPLACE FUNCTION public.source_is_publishable(p_source_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.source_is_collectable(p_source_key)
     AND EXISTS (
       SELECT 1
         FROM public.data_source_registry AS registry
         JOIN public.data_source_access_policies AS policy USING (source_key)
        WHERE registry.source_key = p_source_key
          AND registry.source_category IN ('official_policy', 'official_statistics', 'platform_announcement')
          AND policy.authorization_status IN ('confirmed', 'not_required')
          AND policy.commercial_use_allowed = TRUE
          AND policy.redistribution_allowed = TRUE
          AND 'public_summary' = ANY(policy.permitted_uses)
          AND cardinality(policy.allowed_display_fields) > 0
     );
$$;

DROP POLICY IF EXISTS market_data_applicability_public_read ON public.market_data_applicability;
CREATE POLICY market_data_applicability_public_read ON public.market_data_applicability
  FOR SELECT TO anon, authenticated USING (
    status = 'active'
    AND verification_status IN ('verified', 'uploaded')
    AND source_key IS NOT NULL
    AND public.source_is_publishable(source_key)
  );

CREATE OR REPLACE FUNCTION public.assert_collectable_source(p_source_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.source_is_collectable(p_source_key) THEN
    RAISE EXCEPTION 'source % is inactive, expired, revoked or not registered', p_source_key
      USING ERRCODE = 'P0001';
  END IF;
  RETURN p_source_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_raw_source_governance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE source_row RECORD;
DECLARE policy_row RECORD;
BEGIN
  PERFORM public.assert_collectable_source(NEW.source_key);
  SELECT source_category INTO source_row
    FROM public.data_source_registry WHERE source_key = NEW.source_key;
  SELECT allowed_display_fields, allowed_export_fields
    INTO policy_row
    FROM public.data_source_access_policies WHERE source_key = NEW.source_key;
  NEW.source_category = source_row.source_category;
  NEW.allowed_display_fields = COALESCE(policy_row.allowed_display_fields, '{}');
  NEW.allowed_export_fields = COALESCE(policy_row.allowed_export_fields, '{}');
  IF public.source_is_publishable(NEW.source_key) THEN
    NEW.publication_status = COALESCE(NULLIF(NEW.publication_status, 'quarantined'), 'eligible');
  ELSE
    NEW.publication_status = 'quarantined';
    NEW.quarantine_reason = COALESCE(NEW.quarantine_reason, 'source authorization or redistribution permission is not confirmed');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_raw_source_governance ON public.raw_data_records;
CREATE TRIGGER trg_guard_raw_source_governance
  BEFORE INSERT OR UPDATE OF source_key, publication_status
  ON public.raw_data_records
  FOR EACH ROW EXECUTE FUNCTION public.guard_raw_source_governance();

UPDATE public.raw_data_records AS raw
   SET source_category = registry.source_category,
       publication_status = CASE
         WHEN public.source_is_publishable(raw.source_key) THEN 'eligible'
         ELSE 'quarantined'
       END,
       quarantine_reason = CASE
         WHEN public.source_is_publishable(raw.source_key) THEN NULL
         ELSE COALESCE(raw.quarantine_reason, 'source authorization or redistribution permission is not confirmed')
       END,
       allowed_display_fields = policy.allowed_display_fields,
       allowed_export_fields = policy.allowed_export_fields,
       updated_at = NOW()
  FROM public.data_source_registry AS registry
  JOIN public.data_source_access_policies AS policy USING (source_key)
 WHERE raw.source_key = registry.source_key
   AND public.source_is_collectable(raw.source_key);

CREATE OR REPLACE FUNCTION public.guard_formal_source_governance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE category TEXT;
BEGIN
  IF NEW.source_key IS NULL OR NOT public.source_is_publishable(NEW.source_key) THEN
    RAISE EXCEPTION 'source % is not authorized for the formal public projection', COALESCE(NEW.source_key, '<missing>')
      USING ERRCODE = 'P0001';
  END IF;
  SELECT source_category INTO category
    FROM public.data_source_registry WHERE source_key = NEW.source_key;
  NEW.source_category = category;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_formal_source_governance ON public.market_data_applicability;
CREATE TRIGGER trg_guard_formal_source_governance
  BEFORE INSERT OR UPDATE OF source_key, verification_status, status
  ON public.market_data_applicability
  FOR EACH ROW EXECUTE FUNCTION public.guard_formal_source_governance();

-- Preserve the source category on existing formal rows that already have a
-- governed key; rows without a key were made inactive above.
UPDATE public.market_data_applicability AS formal
   SET source_category = registry.source_category
  FROM public.data_source_registry AS registry
 WHERE formal.source_key = registry.source_key
   AND formal.source_category IS NULL;

COMMENT ON TABLE public.data_source_registry IS
  'Source registration ledger: owner, authority, trust, scope and collection lifecycle.';
COMMENT ON TABLE public.data_source_access_policies IS
  'Service-only authorization, pricing, rate limits, field allowlists and retention policy.';
COMMENT ON FUNCTION public.source_is_collectable(TEXT) IS
  'True only while a source is active, enabled and not past review or authorization expiry.';
COMMENT ON FUNCTION public.source_is_publishable(TEXT) IS
  'True only for confirmed, redistributable sources allowed in public summaries.';

REVOKE ALL ON FUNCTION public.refresh_source_registry_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_collectable_source(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_source_registry_status() TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_collectable_source(TEXT) TO service_role;

COMMIT;
