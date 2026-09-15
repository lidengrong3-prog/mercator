-- Permanent, append-only intelligence history.
-- Compatibility projections remain in market_data_applicability/market_data;
-- deleting either projection never cascades into evidence or version history.

BEGIN;

CREATE OR REPLACE FUNCTION public.history_uuid(p_namespace TEXT, p_value TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT (
    substr(v, 1, 8) || '-' || substr(v, 9, 4) || '-' ||
    substr(v, 13, 4) || '-' || substr(v, 17, 4) || '-' || substr(v, 21, 12)
  )::UUID
  FROM (SELECT md5(p_namespace || ':' || p_value) AS v) AS digest;
$$;

CREATE TABLE IF NOT EXISTS public.source_fetch_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT NOT NULL,
  source_key TEXT NOT NULL REFERENCES public.data_source_registry(source_key) ON DELETE RESTRICT,
  collector_key TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT 'supporting',
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'degraded', 'failed', 'skipped')),
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  duration_ms BIGINT NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  successful_requests INTEGER NOT NULL DEFAULT 0 CHECK (successful_requests >= 0),
  failed_requests INTEGER NOT NULL DEFAULT 0 CHECK (failed_requests >= 0),
  records_collected INTEGER NOT NULL DEFAULT 0 CHECK (records_collected >= 0),
  records_in_scope INTEGER NOT NULL DEFAULT 0 CHECK (records_in_scope >= 0),
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, collector_key)
);

CREATE TABLE IF NOT EXISTS public.raw_source_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_fetch_run_id UUID REFERENCES public.source_fetch_runs(id) ON DELETE SET NULL,
  run_id TEXT,
  source_key TEXT NOT NULL REFERENCES public.data_source_registry(source_key) ON DELETE RESTRICT,
  domain TEXT NOT NULL CHECK (domain IN (
    'policy', 'tax', 'access', 'logistics', 'payment', 'rule', 'alert',
    'market', 'platform', 'category', 'product', 'shop', 'content'
  )),
  source_record_id TEXT NOT NULL,
  normalized_record_key TEXT,
  source_url TEXT,
  source_kind TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_category TEXT,
  source_class TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('verified', 'uploaded', 'pending', 'rejected')),
  publication_status TEXT NOT NULL DEFAULT 'quarantined'
    CHECK (publication_status IN ('eligible', 'quarantined', 'blocked')),
  quarantine_reason TEXT,
  market_codes TEXT[] NOT NULL DEFAULT '{}',
  platform_keys TEXT[] NOT NULL DEFAULT '{}',
  category_codes TEXT[] NOT NULL DEFAULT '{}',
  jurisdiction_codes TEXT[] NOT NULL DEFAULT '{}',
  collected_at TIMESTAMPTZ NOT NULL,
  retrieved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  effective_from DATE,
  effective_to DATE,
  verified_at TIMESTAMPTZ,
  verification_notes TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  evidence_hash TEXT NOT NULL CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  allowed_display_fields TEXT[] NOT NULL DEFAULT '{}',
  allowed_export_fields TEXT[] NOT NULL DEFAULT '{}',
  license_class TEXT NOT NULL DEFAULT 'restricted',
  access_class TEXT NOT NULL DEFAULT 'service_private',
  redistribution_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  retention_until TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'rejected', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_key, source_record_id, evidence_hash),
  CHECK (last_seen_at >= first_seen_at)
);

CREATE TABLE IF NOT EXISTS public.policy_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL REFERENCES public.data_source_registry(source_key) ON DELETE RESTRICT,
  policy_document_id TEXT NOT NULL,
  domain TEXT NOT NULL CHECK (domain IN ('policy', 'tax', 'access')),
  authority_document_number TEXT,
  title TEXT NOT NULL,
  source_url TEXT,
  market_codes TEXT[] NOT NULL DEFAULT '{}',
  jurisdiction_codes TEXT[] NOT NULL DEFAULT '{}',
  category_codes TEXT[] NOT NULL DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_key, policy_document_id, domain),
  CHECK (last_seen_at >= first_seen_at)
);

CREATE TABLE IF NOT EXISTS public.policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_document_id UUID NOT NULL REFERENCES public.policy_documents(id) ON DELETE RESTRICT,
  raw_source_record_id UUID NOT NULL REFERENCES public.raw_source_records(id) ON DELETE RESTRICT,
  previous_version_id UUID REFERENCES public.policy_versions(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL DEFAULT 1 CHECK (version_number > 0),
  version_label TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  published_at TIMESTAMPTZ,
  effective_from DATE,
  effective_to DATE,
  collected_at TIMESTAMPTZ NOT NULL,
  evidence_hash TEXT NOT NULL CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  changed_fields TEXT[] NOT NULL DEFAULT '{}',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (policy_document_id, evidence_hash),
  UNIQUE (policy_document_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.platform_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL REFERENCES public.data_source_registry(source_key) ON DELETE RESTRICT,
  platform_rule_id TEXT NOT NULL,
  title TEXT NOT NULL,
  source_url TEXT,
  market_code TEXT,
  platform_key TEXT,
  category_code TEXT,
  jurisdiction_code TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_key, platform_rule_id, market_code, platform_key, category_code, jurisdiction_code),
  CHECK (last_seen_at >= first_seen_at)
);

CREATE TABLE IF NOT EXISTS public.platform_rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_rule_id UUID NOT NULL REFERENCES public.platform_rules(id) ON DELETE RESTRICT,
  raw_source_record_id UUID NOT NULL REFERENCES public.raw_source_records(id) ON DELETE RESTRICT,
  previous_version_id UUID REFERENCES public.platform_rule_versions(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL DEFAULT 1 CHECK (version_number > 0),
  version_label TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  rule_dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  effective_from DATE,
  effective_to DATE,
  collected_at TIMESTAMPTZ NOT NULL,
  evidence_hash TEXT NOT NULL CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  changed_fields TEXT[] NOT NULL DEFAULT '{}',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (platform_rule_id, evidence_hash),
  UNIQUE (platform_rule_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.product_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL REFERENCES public.data_source_registry(source_key) ON DELETE RESTRICT,
  platform_key TEXT NOT NULL,
  platform_product_id TEXT NOT NULL,
  market_code TEXT NOT NULL DEFAULT '',
  category_code TEXT,
  title TEXT,
  source_url TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_key, platform_key, platform_product_id, market_code),
  CHECK (last_seen_at >= first_seen_at)
);

CREATE TABLE IF NOT EXISTS public.product_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_entity_id UUID NOT NULL REFERENCES public.product_entities(id) ON DELETE RESTRICT,
  raw_source_record_id UUID NOT NULL REFERENCES public.raw_source_records(id) ON DELETE RESTRICT,
  collected_at TIMESTAMPTZ NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  price NUMERIC,
  currency TEXT,
  sales NUMERIC,
  rating NUMERIC,
  review_count BIGINT,
  inventory BIGINT,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_hash TEXT NOT NULL CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_entity_id, collected_at, evidence_hash),
  CHECK (last_seen_at >= first_seen_at)
);

CREATE TABLE IF NOT EXISTS public.shop_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL REFERENCES public.data_source_registry(source_key) ON DELETE RESTRICT,
  platform_key TEXT NOT NULL,
  platform_shop_id TEXT NOT NULL,
  market_code TEXT NOT NULL DEFAULT '',
  category_code TEXT,
  name TEXT,
  source_url TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_key, platform_key, platform_shop_id, market_code),
  CHECK (last_seen_at >= first_seen_at)
);

CREATE TABLE IF NOT EXISTS public.shop_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_entity_id UUID NOT NULL REFERENCES public.shop_entities(id) ON DELETE RESTRICT,
  raw_source_record_id UUID NOT NULL REFERENCES public.raw_source_records(id) ON DELETE RESTRICT,
  collected_at TIMESTAMPTZ NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  gmv NUMERIC,
  followers BIGINT,
  product_count BIGINT,
  sales NUMERIC,
  rating NUMERIC,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_hash TEXT NOT NULL CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_entity_id, collected_at, evidence_hash),
  CHECK (last_seen_at >= first_seen_at)
);

CREATE TABLE IF NOT EXISTS public.content_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL REFERENCES public.data_source_registry(source_key) ON DELETE RESTRICT,
  platform_key TEXT NOT NULL,
  platform_content_id TEXT NOT NULL,
  market_code TEXT NOT NULL DEFAULT '',
  category_code TEXT,
  title TEXT,
  source_url TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_key, platform_key, platform_content_id, market_code),
  CHECK (last_seen_at >= first_seen_at)
);

CREATE TABLE IF NOT EXISTS public.content_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_entity_id UUID NOT NULL REFERENCES public.content_entities(id) ON DELETE RESTRICT,
  raw_source_record_id UUID NOT NULL REFERENCES public.raw_source_records(id) ON DELETE RESTRICT,
  collected_at TIMESTAMPTZ NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  views BIGINT,
  likes BIGINT,
  comments BIGINT,
  shares BIGINT,
  conversions NUMERIC,
  engagement_rate NUMERIC,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_hash TEXT NOT NULL CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (content_entity_id, collected_at, evidence_hash),
  CHECK (last_seen_at >= first_seen_at)
);

CREATE TABLE IF NOT EXISTS public.formal_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL REFERENCES public.data_source_registry(source_key) ON DELETE RESTRICT,
  raw_source_record_id UUID NOT NULL REFERENCES public.raw_source_records(id) ON DELETE RESTRICT,
  policy_version_id UUID REFERENCES public.policy_versions(id) ON DELETE RESTRICT,
  platform_rule_version_id UUID REFERENCES public.platform_rule_versions(id) ON DELETE RESTRICT,
  product_snapshot_id UUID REFERENCES public.product_snapshots(id) ON DELETE RESTRICT,
  shop_snapshot_id UUID REFERENCES public.shop_snapshots(id) ON DELETE RESTRICT,
  content_snapshot_id UUID REFERENCES public.content_snapshots(id) ON DELETE RESTRICT,
  publication_type TEXT NOT NULL CHECK (publication_type IN (
    'policy', 'platform_rule', 'product_snapshot', 'shop_snapshot',
    'content_snapshot', 'market_record'
  )),
  domain TEXT NOT NULL,
  record_key TEXT NOT NULL,
  market_code TEXT,
  platform_key TEXT,
  category_code TEXT,
  jurisdiction_code TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'superseded')),
  title TEXT,
  summary TEXT,
  source_url TEXT,
  published_at TIMESTAMPTZ,
  effective_from DATE,
  effective_to DATE,
  collected_at TIMESTAMPTZ NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  evidence_hash TEXT NOT NULL CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  public_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (last_seen_at >= first_seen_at)
);

ALTER TABLE public.market_data_applicability
  ADD COLUMN IF NOT EXISTS formal_publication_id UUID
  REFERENCES public.formal_publications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_source_fetch_runs_timeline
  ON public.source_fetch_runs(source_key, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_source_records_timeline
  ON public.raw_source_records(source_key, source_record_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_policy_documents_scope
  ON public.policy_documents(domain, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_policy_versions_timeline
  ON public.policy_versions(policy_document_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_rules_scope
  ON public.platform_rules(platform_key, market_code, category_code, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_rule_versions_timeline
  ON public.platform_rule_versions(platform_rule_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_snapshots_trend
  ON public.product_snapshots(product_entity_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_snapshots_trend
  ON public.shop_snapshots(shop_entity_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_snapshots_trend
  ON public.content_snapshots(content_entity_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_formal_publications_scope
  ON public.formal_publications(domain, market_code, platform_key, category_code, collected_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_formal_publications_identity
  ON public.formal_publications(
    raw_source_record_id, record_key,
    COALESCE(market_code, ''), COALESCE(platform_key, ''),
    COALESCE(category_code, ''), COALESCE(jurisdiction_code, '')
  );
CREATE INDEX IF NOT EXISTS idx_market_data_formal_publication
  ON public.market_data_applicability(formal_publication_id);

CREATE OR REPLACE FUNCTION public.jsonb_changed_keys(
  p_previous JSONB,
  p_current JSONB,
  p_tracked_keys TEXT[] DEFAULT NULL
)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  WITH keys AS (
    SELECT unnest(p_tracked_keys) AS key
     WHERE cardinality(COALESCE(p_tracked_keys, '{}')) > 0
    UNION
    SELECT jsonb_object_keys(COALESCE(p_previous, '{}'::jsonb))
     WHERE cardinality(COALESCE(p_tracked_keys, '{}')) = 0
    UNION
    SELECT jsonb_object_keys(COALESCE(p_current, '{}'::jsonb))
     WHERE cardinality(COALESCE(p_tracked_keys, '{}')) = 0
  )
  SELECT COALESCE(array_agg(key ORDER BY key) FILTER (
    WHERE COALESCE(p_previous, '{}'::jsonb) -> key
       IS DISTINCT FROM COALESCE(p_current, '{}'::jsonb) -> key
  ), '{}')
  FROM keys;
$$;

CREATE OR REPLACE FUNCTION public.allowlisted_jsonb(p_payload JSONB, p_fields TEXT[])
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT COALESCE(jsonb_object_agg(item.key, item.value), '{}'::jsonb)
    FROM jsonb_each(p_payload) AS item
   WHERE item.key = ANY(COALESCE(p_fields, '{}'));
$$;

CREATE OR REPLACE FUNCTION public.prepare_policy_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE prior public.policy_versions%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.policy_document_id::TEXT));
  SELECT * INTO prior
    FROM public.policy_versions
   WHERE policy_document_id = NEW.policy_document_id
   ORDER BY version_number DESC
   LIMIT 1;
  IF FOUND THEN
    NEW.previous_version_id = prior.id;
    NEW.version_number = prior.version_number + 1;
    NEW.changed_fields = public.jsonb_changed_keys(prior.content, NEW.content, NULL);
  ELSE
    NEW.previous_version_id = NULL;
    NEW.version_number = 1;
    NEW.changed_fields = '{}';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_platform_rule_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE prior public.platform_rule_versions%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.platform_rule_id::TEXT));
  SELECT * INTO prior
    FROM public.platform_rule_versions
   WHERE platform_rule_id = NEW.platform_rule_id
   ORDER BY version_number DESC
   LIMIT 1;
  IF FOUND THEN
    NEW.previous_version_id = prior.id;
    NEW.version_number = prior.version_number + 1;
    NEW.changed_fields = public.jsonb_changed_keys(
      prior.rule_dimensions,
      NEW.rule_dimensions,
      ARRAY['fee','commission','deposit','fulfillment','prohibited','settlement','penalty']
    );
  ELSE
    NEW.previous_version_id = NULL;
    NEW.version_number = 1;
    NEW.changed_fields = '{}';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prepare_policy_version ON public.policy_versions;
CREATE TRIGGER trg_prepare_policy_version
  BEFORE INSERT ON public.policy_versions
  FOR EACH ROW EXECUTE FUNCTION public.prepare_policy_version();
DROP TRIGGER IF EXISTS trg_prepare_platform_rule_version ON public.platform_rule_versions;
CREATE TRIGGER trg_prepare_platform_rule_version
  BEFORE INSERT ON public.platform_rule_versions
  FOR EACH ROW EXECUTE FUNCTION public.prepare_platform_rule_version();

CREATE OR REPLACE FUNCTION public.reject_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; write a new evidence/version/snapshot row', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_source_fetch_runs_append_only ON public.source_fetch_runs;
CREATE TRIGGER trg_source_fetch_runs_append_only
  BEFORE UPDATE OR DELETE ON public.source_fetch_runs
  FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation();
DROP TRIGGER IF EXISTS trg_raw_source_records_append_only ON public.raw_source_records;
CREATE TRIGGER trg_raw_source_records_append_only
  BEFORE UPDATE OR DELETE ON public.raw_source_records
  FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation();
DROP TRIGGER IF EXISTS trg_policy_versions_append_only ON public.policy_versions;
CREATE TRIGGER trg_policy_versions_append_only
  BEFORE UPDATE OR DELETE ON public.policy_versions
  FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation();
DROP TRIGGER IF EXISTS trg_platform_rule_versions_append_only ON public.platform_rule_versions;
CREATE TRIGGER trg_platform_rule_versions_append_only
  BEFORE UPDATE OR DELETE ON public.platform_rule_versions
  FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation();
DROP TRIGGER IF EXISTS trg_product_snapshots_append_only ON public.product_snapshots;
CREATE TRIGGER trg_product_snapshots_append_only
  BEFORE UPDATE OR DELETE ON public.product_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation();
DROP TRIGGER IF EXISTS trg_shop_snapshots_append_only ON public.shop_snapshots;
CREATE TRIGGER trg_shop_snapshots_append_only
  BEFORE UPDATE OR DELETE ON public.shop_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation();
DROP TRIGGER IF EXISTS trg_content_snapshots_append_only ON public.content_snapshots;
CREATE TRIGGER trg_content_snapshots_append_only
  BEFORE UPDATE OR DELETE ON public.content_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation();

CREATE OR REPLACE FUNCTION public.guard_formal_publication()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE raw_record public.raw_source_records%ROWTYPE;
BEGIN
  IF NOT public.source_is_publishable(NEW.source_key) THEN
    RAISE EXCEPTION 'source % is not authorized for formal publication', NEW.source_key
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO raw_record
    FROM public.raw_source_records
   WHERE id = NEW.raw_source_record_id;
  IF NOT FOUND
     OR raw_record.source_key <> NEW.source_key
     OR raw_record.publication_status <> 'eligible'
     OR raw_record.verification_status NOT IN ('verified', 'uploaded') THEN
    RAISE EXCEPTION 'formal publication requires matching eligible verified evidence'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_formal_publication ON public.formal_publications;
CREATE TRIGGER trg_guard_formal_publication
  BEFORE INSERT OR UPDATE OF source_key, raw_source_record_id, status
  ON public.formal_publications
  FOR EACH ROW EXECUTE FUNCTION public.guard_formal_publication();

ALTER TABLE public.source_fetch_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_source_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formal_publications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.source_fetch_runs, public.raw_source_records,
  public.policy_documents, public.policy_versions, public.platform_rules,
  public.platform_rule_versions, public.product_entities, public.product_snapshots,
  public.shop_entities, public.shop_snapshots, public.content_entities,
  public.content_snapshots FROM anon, authenticated;
GRANT ALL ON public.source_fetch_runs, public.raw_source_records,
  public.policy_documents, public.policy_versions, public.platform_rules,
  public.platform_rule_versions, public.product_entities, public.product_snapshots,
  public.shop_entities, public.shop_snapshots, public.content_entities,
  public.content_snapshots, public.formal_publications TO service_role;

CREATE POLICY formal_publications_public_read ON public.formal_publications
  FOR SELECT TO anon, authenticated USING (
    status = 'active' AND public.source_is_publishable(source_key)
  );
GRANT SELECT ON public.formal_publications TO anon, authenticated;

-- Move existing evidence into the canonical history without changing or
-- deleting the compatibility rows.
INSERT INTO public.raw_source_records (
  id, source_key, domain, source_record_id, normalized_record_key, source_url,
  source_kind, source_type, source_category, source_class, verification_status,
  publication_status, quarantine_reason, market_codes, platform_keys, category_codes,
  jurisdiction_codes, collected_at, retrieved_at, published_at, effective_from,
  effective_to, verified_at, verification_notes, first_seen_at, last_seen_at, evidence_hash, payload,
  allowed_display_fields, allowed_export_fields, license_class, access_class,
  redistribution_allowed, retention_until, status, created_at
)
SELECT public.history_uuid('raw-source-record', raw.source_key || '|' || raw.source_record_id || '|' || lower(raw.evidence_hash)),
       raw.source_key, raw.domain, raw.source_record_id, raw.normalized_record_key,
       raw.source_url, raw.source_kind, raw.source_type, raw.source_category, raw.source_class,
       raw.verification_status, raw.publication_status, raw.quarantine_reason, raw.market_codes,
       raw.platform_keys, raw.category_codes, raw.jurisdiction_codes,
       COALESCE(raw.collected_at, raw.retrieved_at, raw.created_at), raw.retrieved_at,
       raw.published_at, raw.effective_from, raw.effective_to, raw.verified_at,
       raw.verification_notes,
       COALESCE(raw.collected_at, raw.retrieved_at, raw.created_at),
       COALESCE(raw.updated_at, raw.collected_at, raw.retrieved_at, raw.created_at),
       lower(raw.evidence_hash), raw.payload, raw.allowed_display_fields,
       raw.allowed_export_fields, raw.license_class, raw.access_class,
       raw.redistribution_allowed, raw.retention_until, raw.status, raw.created_at
  FROM public.raw_data_records AS raw
 WHERE raw.evidence_hash ~ '^[0-9A-Fa-f]{64}$'
ON CONFLICT (source_key, source_record_id, evidence_hash) DO NOTHING;

INSERT INTO public.policy_documents (
  id, source_key, policy_document_id, domain, authority_document_number, title,
  source_url, market_codes, jurisdiction_codes, category_codes,
  first_seen_at, last_seen_at
)
SELECT public.history_uuid('policy-document', raw.source_key || '|' || raw.domain || '|' || raw.source_record_id),
       raw.source_key, raw.source_record_id, raw.domain,
       NULLIF(COALESCE(raw.payload->>'document_number', raw.payload->>'documentNumber'), ''),
       COALESCE(MAX(NULLIF(raw.payload->>'title', '')), raw.source_record_id), MAX(raw.source_url),
       raw.market_codes, raw.jurisdiction_codes, raw.category_codes,
       MIN(raw.collected_at), MAX(raw.last_seen_at)
  FROM public.raw_source_records AS raw
 WHERE raw.domain IN ('policy', 'tax', 'access')
 GROUP BY raw.source_key, raw.domain, raw.source_record_id,
          raw.payload->>'document_number', raw.payload->>'documentNumber',
          raw.market_codes, raw.jurisdiction_codes, raw.category_codes
ON CONFLICT (source_key, policy_document_id, domain) DO NOTHING;

INSERT INTO public.policy_versions (
  id, policy_document_id, raw_source_record_id, version_label, title, summary,
  published_at, effective_from, effective_to, collected_at, evidence_hash, content
)
SELECT public.history_uuid('policy-version', document.id::TEXT || '|' || raw.evidence_hash),
       document.id, raw.id,
       NULLIF(COALESCE(raw.payload->>'version', raw.payload->>'version_label'), ''),
       COALESCE(NULLIF(raw.payload->>'title', ''), raw.source_record_id),
       COALESCE(raw.payload->>'summary', raw.payload->>'detail'), raw.published_at,
       raw.effective_from, raw.effective_to, raw.collected_at, raw.evidence_hash, raw.payload
  FROM public.raw_source_records AS raw
  JOIN public.policy_documents AS document
    ON document.source_key = raw.source_key
   AND document.domain = raw.domain
   AND document.policy_document_id = raw.source_record_id
 WHERE raw.domain IN ('policy', 'tax', 'access')
 ORDER BY document.id, raw.collected_at, raw.created_at
ON CONFLICT (policy_document_id, evidence_hash) DO NOTHING;

INSERT INTO public.platform_rules (
  id, source_key, platform_rule_id, title, source_url, market_code,
  platform_key, category_code, jurisdiction_code, first_seen_at, last_seen_at
)
SELECT public.history_uuid(
         'platform-rule',
         raw.source_key || '|' || COALESCE(raw.payload->>'rule_key', raw.source_record_id)
           || '|' || COALESCE(formal.market_code, '') || '|' || COALESCE(formal.platform_key, '')
           || '|' || COALESCE(formal.category_code, '') || '|' || COALESCE(formal.jurisdiction_code, '')
       ),
       raw.source_key,
       COALESCE(NULLIF(raw.payload->>'rule_key', ''), raw.source_record_id),
       COALESCE(MAX(NULLIF(raw.payload->>'title', '')), raw.source_record_id),
       MAX(raw.source_url), formal.market_code, formal.platform_key,
       formal.category_code, formal.jurisdiction_code,
       MIN(raw.collected_at), MAX(raw.last_seen_at)
  FROM public.market_data_applicability AS formal
  JOIN public.raw_source_records AS raw
    ON raw.source_key = formal.source_key
   AND raw.source_record_id = formal.source_record_id
   AND raw.evidence_hash = formal.evidence_hash
 WHERE formal.domain = 'rule'
 GROUP BY raw.source_key, raw.payload->>'rule_key', raw.source_record_id,
          formal.market_code, formal.platform_key, formal.category_code,
          formal.jurisdiction_code
ON CONFLICT (source_key, platform_rule_id, market_code, platform_key, category_code, jurisdiction_code) DO NOTHING;

INSERT INTO public.platform_rule_versions (
  id, platform_rule_id, raw_source_record_id, version_label, title, summary,
  rule_dimensions, published_at, effective_from, effective_to, collected_at,
  evidence_hash, content
)
SELECT public.history_uuid('platform-rule-version', rule.id::TEXT || '|' || raw.evidence_hash),
       rule.id, raw.id,
       NULLIF(COALESCE(raw.payload->>'rule_version', raw.payload->>'version'), ''),
       COALESCE(NULLIF(raw.payload->>'title', ''), raw.source_record_id),
       COALESCE(raw.payload->>'summary', raw.payload->>'detail'),
       jsonb_strip_nulls(jsonb_build_object(
         'fee', COALESCE(raw.payload->'fee', raw.payload->'fee_desc', raw.payload->'feeDesc'),
         'commission', COALESCE(raw.payload->'commission', raw.payload->'commission_rate', raw.payload->'commissionRate'),
         'deposit', COALESCE(raw.payload->'deposit', raw.payload->'security_deposit', raw.payload->'securityDeposit'),
         'fulfillment', COALESCE(raw.payload->'fulfillment', raw.payload->'fulfillment_mode', raw.payload->'fulfillmentMode'),
         'prohibited', COALESCE(raw.payload->'prohibited', raw.payload->'prohibited_items', raw.payload->'prohibitedItems'),
         'settlement', COALESCE(raw.payload->'settlement', raw.payload->'settlement_cycle', raw.payload->'settlementCycle'),
         'penalty', COALESCE(raw.payload->'penalty', raw.payload->'penalty_rules', raw.payload->'penaltyRules')
       )),
       raw.published_at, raw.effective_from, raw.effective_to, raw.collected_at,
       raw.evidence_hash, raw.payload
  FROM public.market_data_applicability AS formal
  JOIN public.raw_source_records AS raw
    ON raw.source_key = formal.source_key
   AND raw.source_record_id = formal.source_record_id
   AND raw.evidence_hash = formal.evidence_hash
  JOIN public.platform_rules AS rule
    ON rule.source_key = raw.source_key
   AND rule.platform_rule_id = COALESCE(NULLIF(raw.payload->>'rule_key', ''), raw.source_record_id)
   AND rule.market_code IS NOT DISTINCT FROM formal.market_code
   AND rule.platform_key IS NOT DISTINCT FROM formal.platform_key
   AND rule.category_code IS NOT DISTINCT FROM formal.category_code
   AND rule.jurisdiction_code IS NOT DISTINCT FROM formal.jurisdiction_code
 WHERE formal.domain = 'rule'
 ORDER BY rule.id, raw.collected_at, raw.created_at
ON CONFLICT (platform_rule_id, evidence_hash) DO NOTHING;

INSERT INTO public.formal_publications (
  id, source_key, raw_source_record_id, policy_version_id,
  platform_rule_version_id, publication_type, domain, record_key,
  market_code, platform_key, category_code, jurisdiction_code, status,
  title, summary, source_url, published_at, effective_from, effective_to,
  collected_at, first_seen_at, last_seen_at, evidence_hash, public_payload
)
SELECT public.history_uuid(
         'formal-publication',
         raw.id::TEXT || '|' || formal.record_key || '|' || COALESCE(formal.market_code, '')
           || '|' || COALESCE(formal.platform_key, '') || '|' || COALESCE(formal.category_code, '')
           || '|' || COALESCE(formal.jurisdiction_code, '')
       ),
       raw.source_key, raw.id,
       policy_version.id,
       rule_version.id,
       CASE WHEN formal.domain IN ('policy', 'tax', 'access') THEN 'policy'
            WHEN formal.domain = 'rule' THEN 'platform_rule'
            ELSE 'market_record' END,
       formal.domain, formal.record_key, formal.market_code, formal.platform_key,
       formal.category_code, formal.jurisdiction_code, 'active',
       COALESCE(NULLIF(raw.payload->>'title', ''), formal.record_key),
       COALESCE(raw.payload->>'summary', raw.payload->>'detail'), raw.source_url,
       raw.published_at, raw.effective_from, raw.effective_to, raw.collected_at,
       raw.collected_at, raw.last_seen_at, raw.evidence_hash,
       public.allowlisted_jsonb(raw.payload, raw.allowed_display_fields)
  FROM public.market_data_applicability AS formal
  JOIN public.raw_source_records AS raw
    ON raw.source_key = formal.source_key
   AND raw.source_record_id = formal.source_record_id
   AND raw.evidence_hash = formal.evidence_hash
  LEFT JOIN public.policy_documents AS document
    ON document.source_key = raw.source_key
   AND document.domain = raw.domain
   AND document.policy_document_id = raw.source_record_id
  LEFT JOIN public.policy_versions AS policy_version
    ON policy_version.policy_document_id = document.id
   AND policy_version.evidence_hash = raw.evidence_hash
  LEFT JOIN public.platform_rules AS rule
    ON rule.source_key = raw.source_key
   AND rule.platform_rule_id = COALESCE(NULLIF(raw.payload->>'rule_key', ''), raw.source_record_id)
   AND rule.market_code IS NOT DISTINCT FROM formal.market_code
   AND rule.platform_key IS NOT DISTINCT FROM formal.platform_key
   AND rule.category_code IS NOT DISTINCT FROM formal.category_code
   AND rule.jurisdiction_code IS NOT DISTINCT FROM formal.jurisdiction_code
  LEFT JOIN public.platform_rule_versions AS rule_version
    ON rule_version.platform_rule_id = rule.id
   AND rule_version.evidence_hash = raw.evidence_hash
 WHERE formal.source_key IS NOT NULL
   AND public.source_is_publishable(formal.source_key)
   AND raw.publication_status = 'eligible'
   AND raw.verification_status IN ('verified', 'uploaded')
ON CONFLICT (id) DO NOTHING;

UPDATE public.market_data_applicability AS formal
   SET formal_publication_id = publication.id
  FROM public.formal_publications AS publication
  JOIN public.raw_source_records AS raw ON raw.id = publication.raw_source_record_id
 WHERE formal.formal_publication_id IS NULL
   AND formal.source_key = raw.source_key
   AND formal.source_record_id = raw.source_record_id
   AND formal.evidence_hash = raw.evidence_hash
   AND formal.record_key = publication.record_key
   AND formal.market_code IS NOT DISTINCT FROM publication.market_code
   AND formal.platform_key IS NOT DISTINCT FROM publication.platform_key
   AND formal.category_code IS NOT DISTINCT FROM publication.category_code
   AND formal.jurisdiction_code IS NOT DISTINCT FROM publication.jurisdiction_code;

CREATE OR REPLACE FUNCTION public.guard_history_raw_source()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE registry_row RECORD;
DECLARE policy_row RECORD;
BEGIN
  PERFORM public.assert_collectable_source(NEW.source_key);
  SELECT source_category INTO registry_row
    FROM public.data_source_registry WHERE source_key = NEW.source_key;
  SELECT allowed_display_fields, allowed_export_fields
    INTO policy_row
    FROM public.data_source_access_policies WHERE source_key = NEW.source_key;
  NEW.source_category = COALESCE(NEW.source_category, registry_row.source_category);
  NEW.allowed_display_fields = COALESCE(policy_row.allowed_display_fields, NEW.allowed_display_fields, '{}');
  NEW.allowed_export_fields = COALESCE(policy_row.allowed_export_fields, NEW.allowed_export_fields, '{}');
  IF NOT public.source_is_publishable(NEW.source_key) THEN
    NEW.publication_status = 'quarantined';
  ELSE
    NEW.publication_status = COALESCE(NULLIF(NEW.publication_status, 'quarantined'), 'eligible');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_history_raw_source ON public.raw_source_records;
CREATE TRIGGER trg_guard_history_raw_source
  BEFORE INSERT ON public.raw_source_records
  FOR EACH ROW EXECUTE FUNCTION public.guard_history_raw_source();

-- Query surfaces for timelines and trends remain service-only; public clients
-- consume the field-allowlisted formal_publications projection.
CREATE VIEW public.platform_rule_change_history AS
SELECT rule.id AS rule_id, rule.source_key, rule.platform_rule_id,
       rule.market_code, rule.platform_key, rule.category_code,
       version.id AS version_id, version.version_number, version.version_label,
       version.previous_version_id, version.changed_fields, version.rule_dimensions,
       version.effective_from, version.effective_to, version.published_at,
       version.collected_at
  FROM public.platform_rules AS rule
  JOIN public.platform_rule_versions AS version ON version.platform_rule_id = rule.id;

CREATE VIEW public.policy_document_version_history AS
SELECT document.id AS policy_document_id, document.source_key,
       document.policy_document_id AS source_record_id, document.domain,
       version.id AS version_id, version.version_number,
       version.version_label, version.previous_version_id,
       version.changed_fields, version.effective_from, version.effective_to,
       version.published_at, version.collected_at
  FROM public.policy_documents AS document
  JOIN public.policy_versions AS version ON version.policy_document_id = document.id;

CREATE VIEW public.product_price_trends AS
SELECT entity.id AS product_entity_id, entity.platform_key,
       entity.platform_product_id, entity.market_code, snapshot.collected_at,
       snapshot.price, snapshot.currency, snapshot.sales, snapshot.inventory
  FROM public.product_entities AS entity
  JOIN public.product_snapshots AS snapshot ON snapshot.product_entity_id = entity.id;

CREATE VIEW public.shop_metric_trends AS
SELECT entity.id AS shop_entity_id, entity.platform_key, entity.platform_shop_id,
       entity.market_code, snapshot.collected_at, snapshot.gmv, snapshot.followers,
       snapshot.product_count, snapshot.sales, snapshot.rating
  FROM public.shop_entities AS entity
  JOIN public.shop_snapshots AS snapshot ON snapshot.shop_entity_id = entity.id;

CREATE VIEW public.content_metric_trends AS
SELECT entity.id AS content_entity_id, entity.platform_key,
       entity.platform_content_id, entity.market_code, snapshot.collected_at,
       snapshot.views, snapshot.likes, snapshot.comments, snapshot.shares,
       snapshot.conversions, snapshot.engagement_rate
  FROM public.content_entities AS entity
  JOIN public.content_snapshots AS snapshot ON snapshot.content_entity_id = entity.id;

REVOKE ALL ON public.platform_rule_change_history, public.product_price_trends,
  public.shop_metric_trends, public.content_metric_trends,
  public.policy_document_version_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.platform_rule_change_history, public.product_price_trends,
  public.shop_metric_trends, public.content_metric_trends,
  public.policy_document_version_history TO service_role;

COMMENT ON TABLE public.raw_source_records IS
  'Canonical immutable evidence. Repeated fetches deduplicate by source stable ID plus evidence hash.';
COMMENT ON TABLE public.formal_publications IS
  'Rebuildable, field-allowlisted projection for browser and AI use; history never cascades from it.';
COMMENT ON VIEW public.platform_rule_change_history IS
  'All old and new platform rule versions with normalized changed fields.';

COMMIT;
