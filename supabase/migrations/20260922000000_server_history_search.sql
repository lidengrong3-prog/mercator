-- Server-side search over the governed formal history projection.
-- Raw evidence remains service-only; browser and AI callers receive the same
-- allowlisted publication fields and stable source identifiers.

BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

ALTER TABLE public.formal_publications
  ADD COLUMN IF NOT EXISTS search_text TEXT GENERATED ALWAYS AS (
    lower(
      COALESCE(title, '') || ' ' ||
      COALESCE(summary, '') || ' ' ||
      COALESCE(record_key, '') || ' ' ||
      COALESCE(public_payload::TEXT, '')
    )
  ) STORED,
  ADD COLUMN IF NOT EXISTS search_document TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple'::regconfig, COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, COALESCE(summary, '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, COALESCE(record_key, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, COALESCE(public_payload::TEXT, '')), 'C')
  ) STORED,
  ADD COLUMN IF NOT EXISTS publication_year SMALLINT GENERATED ALWAYS AS (
    EXTRACT(YEAR FROM COALESCE(
      published_at AT TIME ZONE 'UTC',
      effective_from::TIMESTAMP,
      collected_at AT TIME ZONE 'UTC'
    ))::SMALLINT
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_formal_publications_search_document
  ON public.formal_publications USING GIN (search_document);
CREATE INDEX IF NOT EXISTS idx_formal_publications_search_trigram
  ON public.formal_publications USING GIN (search_text extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_formal_publications_newest_cursor
  ON public.formal_publications(collected_at DESC, publication_type, id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_formal_publications_market_cursor
  ON public.formal_publications(market_code, collected_at DESC, publication_type, id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_formal_publications_platform_cursor
  ON public.formal_publications(platform_key, collected_at DESC, publication_type, id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_formal_publications_category_cursor
  ON public.formal_publications(category_code, collected_at DESC, publication_type, id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_formal_publications_source_cursor
  ON public.formal_publications(source_key, collected_at DESC, publication_type, id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_formal_publications_year_cursor
  ON public.formal_publications(publication_year, collected_at DESC, publication_type, id)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.search_formal_publications(
  p_query TEXT DEFAULT '',
  p_type TEXT DEFAULT NULL,
  p_market_code TEXT DEFAULT NULL,
  p_platform_key TEXT DEFAULT NULL,
  p_category_code TEXT DEFAULT NULL,
  p_year INTEGER DEFAULT NULL,
  p_source_key TEXT DEFAULT NULL,
  p_verification_status TEXT DEFAULT NULL,
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_sort TEXT DEFAULT 'relevance',
  p_cursor JSONB DEFAULT NULL,
  p_snapshot_at TIMESTAMPTZ DEFAULT NOW(),
  p_limit INTEGER DEFAULT 20,
  p_record_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH parameters AS (
    SELECT
      left(trim(COALESCE(p_query, '')), 200) AS query_text,
      CASE WHEN p_type IN ('policy', 'rule', 'product', 'shop', 'content', 'country', 'platform')
        THEN p_type ELSE NULL END AS result_type,
      NULLIF(upper(trim(COALESCE(p_market_code, ''))), '') AS market_code,
      NULLIF(lower(trim(COALESCE(p_platform_key, ''))), '') AS platform_key,
      NULLIF(lower(trim(COALESCE(p_category_code, ''))), '') AS category_code,
      CASE WHEN p_year BETWEEN 1900 AND 2200 THEN p_year ELSE NULL END AS result_year,
      NULLIF(lower(trim(COALESCE(p_source_key, ''))), '') AS source_key,
      CASE WHEN p_verification_status IN ('verified', 'uploaded')
        THEN p_verification_status ELSE NULL END AS verification_status,
      p_from AS from_date,
      p_to AS to_date,
      CASE WHEN p_sort IN ('relevance', 'newest', 'oldest', 'title')
        THEN p_sort ELSE 'relevance' END AS sort_mode,
      COALESCE(p_cursor, '{}'::jsonb) AS cursor_value,
      LEAST(100, GREATEST(1, COALESCE(p_limit, 20))) AS page_limit,
      LEAST(COALESCE(p_snapshot_at, NOW()), NOW()) AS snapshot_at,
      p_record_id AS record_id
  ), base AS MATERIALIZED (
    SELECT
      publication.id AS publication_id,
      publication.raw_source_record_id,
      raw.source_record_id,
      CASE
        WHEN publication.publication_type = 'platform_rule' THEN 'rule'
        WHEN publication.publication_type = 'product_snapshot' THEN 'product'
        WHEN publication.publication_type = 'shop_snapshot' THEN 'shop'
        WHEN publication.publication_type = 'content_snapshot' THEN 'content'
        WHEN publication.publication_type = 'policy' OR publication.domain IN ('policy', 'tax', 'access') THEN 'policy'
        WHEN publication.domain = 'platform' THEN 'platform'
        WHEN publication.domain = 'market' THEN 'country'
        ELSE 'content'
      END AS result_type,
      publication.domain,
      publication.record_key,
      publication.title,
      publication.summary,
      publication.market_code,
      publication.platform_key,
      publication.category_code,
      publication.jurisdiction_code,
      publication.source_key,
      registry.name AS source_name,
      registry.source_category,
      registry.trust_level,
      raw.verification_status,
      CASE
        WHEN raw.verification_status = 'uploaded' THEN 'workspace'
        WHEN registry.trust_level = 'high' THEN 'high'
        WHEN registry.trust_level = 'medium' THEN 'medium'
        ELSE 'low'
      END AS verification_level,
      publication.source_url,
      publication.published_at,
      publication.effective_from,
      publication.effective_to,
      publication.collected_at,
      publication.publication_year,
      publication.first_seen_at,
      publication.last_seen_at,
      publication.evidence_hash,
      COALESCE(policy_version.version_number, rule_version.version_number) AS version_number,
      COALESCE(policy_version.version_label, rule_version.version_label) AS version_label,
      COALESCE(policy_version.changed_fields, rule_version.changed_fields, '{}'::TEXT[]) AS changed_fields,
      left(
        trim(COALESCE(publication.summary, '') || ' ' || COALESCE(publication.public_payload::TEXT, '')),
        1200
      ) AS content_excerpt,
      COALESCE(
        publication.published_at,
        publication.effective_from::TIMESTAMP AT TIME ZONE 'UTC',
        publication.collected_at
      ) AS sort_time,
      lower(COALESCE(publication.title, publication.record_key, '')) AS title_sort,
      round((
        CASE
          WHEN parameters.query_text = '' THEN 1.0
          ELSE ts_rank_cd(
            publication.search_document,
            websearch_to_tsquery('simple'::regconfig, parameters.query_text),
            32
          )
        END
        + CASE WHEN lower(COALESCE(publication.title, '')) = lower(parameters.query_text) THEN 4.0 ELSE 0.0 END
        + CASE WHEN publication.search_text LIKE '%' || lower(parameters.query_text) || '%' AND parameters.query_text <> '' THEN 1.0 ELSE 0.0 END
        + CASE WHEN parameters.query_text <> '' THEN extensions.similarity(publication.search_text, lower(parameters.query_text)) ELSE 0.0 END
      )::NUMERIC, 6) AS relevance
    FROM public.formal_publications AS publication
    JOIN public.raw_source_records AS raw ON raw.id = publication.raw_source_record_id
    JOIN public.data_source_registry AS registry ON registry.source_key = publication.source_key
    LEFT JOIN public.policy_versions AS policy_version ON policy_version.id = publication.policy_version_id
    LEFT JOIN public.platform_rule_versions AS rule_version ON rule_version.id = publication.platform_rule_version_id
    CROSS JOIN parameters
    WHERE publication.status = 'active'
      AND public.source_is_publishable(publication.source_key)
      AND raw.publication_status = 'eligible'
      AND raw.verification_status IN ('verified', 'uploaded')
      AND publication.created_at <= parameters.snapshot_at
      AND (parameters.record_id IS NULL OR publication.id = parameters.record_id)
      AND (parameters.market_code IS NULL OR publication.market_code = parameters.market_code)
      AND (parameters.platform_key IS NULL OR publication.platform_key = parameters.platform_key)
      AND (parameters.category_code IS NULL OR lower(COALESCE(publication.category_code, '')) = parameters.category_code)
      AND (parameters.source_key IS NULL OR lower(publication.source_key) = parameters.source_key)
      AND (parameters.verification_status IS NULL OR raw.verification_status = parameters.verification_status)
      AND (
        parameters.result_year IS NULL
        OR publication.publication_year = parameters.result_year
      )
      AND (parameters.from_date IS NULL OR COALESCE(publication.published_at::DATE, publication.effective_from, publication.collected_at::DATE) >= parameters.from_date)
      AND (parameters.to_date IS NULL OR COALESCE(publication.published_at::DATE, publication.effective_from, publication.collected_at::DATE) <= parameters.to_date)
      AND (
        parameters.query_text = ''
        OR publication.search_document @@ websearch_to_tsquery('simple'::regconfig, parameters.query_text)
        OR publication.search_text LIKE '%' || lower(parameters.query_text) || '%'
        OR publication.search_text OPERATOR(extensions.%) lower(parameters.query_text)
      )
  ), statistics AS (
    SELECT
      count(*) AS all_count,
      count(*) FILTER (WHERE result_type = 'policy') AS policy_count,
      count(*) FILTER (WHERE result_type = 'rule') AS rule_count,
      count(*) FILTER (WHERE result_type = 'product') AS product_count,
      count(*) FILTER (WHERE result_type = 'shop') AS shop_count,
      count(*) FILTER (WHERE result_type = 'content') AS content_count,
      count(*) FILTER (WHERE result_type = 'country') AS country_count,
      count(*) FILTER (WHERE result_type = 'platform') AS platform_count
    FROM base
  ), scoped AS (
    SELECT base.*
    FROM base
    CROSS JOIN parameters
    WHERE parameters.result_type IS NULL OR base.result_type = parameters.result_type
  ), after_cursor AS (
    SELECT scoped.*
    FROM scoped
    CROSS JOIN parameters
    WHERE p_cursor IS NULL
      OR CASE parameters.sort_mode
        WHEN 'newest' THEN
          scoped.sort_time < (parameters.cursor_value->>'sort_time')::TIMESTAMPTZ
          OR (scoped.sort_time = (parameters.cursor_value->>'sort_time')::TIMESTAMPTZ AND scoped.result_type > parameters.cursor_value->>'result_type')
          OR (scoped.sort_time = (parameters.cursor_value->>'sort_time')::TIMESTAMPTZ AND scoped.result_type = parameters.cursor_value->>'result_type' AND scoped.publication_id > (parameters.cursor_value->>'publication_id')::UUID)
        WHEN 'oldest' THEN
          scoped.sort_time > (parameters.cursor_value->>'sort_time')::TIMESTAMPTZ
          OR (scoped.sort_time = (parameters.cursor_value->>'sort_time')::TIMESTAMPTZ AND scoped.result_type > parameters.cursor_value->>'result_type')
          OR (scoped.sort_time = (parameters.cursor_value->>'sort_time')::TIMESTAMPTZ AND scoped.result_type = parameters.cursor_value->>'result_type' AND scoped.publication_id > (parameters.cursor_value->>'publication_id')::UUID)
        WHEN 'title' THEN
          scoped.title_sort > parameters.cursor_value->>'title_sort'
          OR (scoped.title_sort = parameters.cursor_value->>'title_sort' AND scoped.result_type > parameters.cursor_value->>'result_type')
          OR (scoped.title_sort = parameters.cursor_value->>'title_sort' AND scoped.result_type = parameters.cursor_value->>'result_type' AND scoped.publication_id > (parameters.cursor_value->>'publication_id')::UUID)
        ELSE
          scoped.relevance < (parameters.cursor_value->>'relevance')::NUMERIC
          OR (scoped.relevance = (parameters.cursor_value->>'relevance')::NUMERIC AND scoped.sort_time < (parameters.cursor_value->>'sort_time')::TIMESTAMPTZ)
          OR (scoped.relevance = (parameters.cursor_value->>'relevance')::NUMERIC AND scoped.sort_time = (parameters.cursor_value->>'sort_time')::TIMESTAMPTZ AND scoped.result_type > parameters.cursor_value->>'result_type')
          OR (scoped.relevance = (parameters.cursor_value->>'relevance')::NUMERIC AND scoped.sort_time = (parameters.cursor_value->>'sort_time')::TIMESTAMPTZ AND scoped.result_type = parameters.cursor_value->>'result_type' AND scoped.publication_id > (parameters.cursor_value->>'publication_id')::UUID)
      END
  ), ordered AS (
    SELECT after_cursor.*,
      row_number() OVER (ORDER BY
        CASE WHEN parameters.sort_mode = 'relevance' THEN after_cursor.relevance END DESC,
        CASE WHEN parameters.sort_mode IN ('relevance', 'newest') THEN after_cursor.sort_time END DESC,
        CASE WHEN parameters.sort_mode = 'oldest' THEN after_cursor.sort_time END ASC,
        CASE WHEN parameters.sort_mode = 'title' THEN after_cursor.title_sort END ASC,
        after_cursor.result_type ASC,
        after_cursor.publication_id ASC
      ) AS page_ordinal
    FROM after_cursor
    CROSS JOIN parameters
    ORDER BY
      CASE WHEN parameters.sort_mode = 'relevance' THEN after_cursor.relevance END DESC,
      CASE WHEN parameters.sort_mode IN ('relevance', 'newest') THEN after_cursor.sort_time END DESC,
      CASE WHEN parameters.sort_mode = 'oldest' THEN after_cursor.sort_time END ASC,
      CASE WHEN parameters.sort_mode = 'title' THEN after_cursor.title_sort END ASC,
      after_cursor.result_type ASC,
      after_cursor.publication_id ASC
    LIMIT (SELECT page_limit + 1 FROM parameters)
  ), visible AS (
    SELECT ordered.* FROM ordered
    WHERE ordered.page_ordinal <= (SELECT page_limit FROM parameters)
  ), last_visible AS (
    SELECT visible.* FROM visible ORDER BY page_ordinal DESC LIMIT 1
  )
  SELECT jsonb_build_object(
    'schema_version', '2026-09-22.1',
    'query_snapshot_at', (SELECT snapshot_at FROM parameters),
    'total', (SELECT count(*) FROM scoped),
    'counts', (SELECT jsonb_build_object(
      'all', all_count,
      'policy', policy_count,
      'rule', rule_count,
      'product', product_count,
      'shop', shop_count,
      'content', content_count,
      'country', country_count,
      'platform', platform_count
    ) FROM statistics),
    'facets', jsonb_build_object(
      'years', COALESCE((SELECT jsonb_agg(value ORDER BY value DESC) FROM (
        SELECT DISTINCT publication_year::INTEGER AS value FROM base
      ) AS years), '[]'::jsonb),
      'categories', COALESCE((SELECT jsonb_agg(value ORDER BY value) FROM (
        SELECT DISTINCT category_code AS value FROM base WHERE category_code IS NOT NULL AND category_code <> ''
      ) AS categories), '[]'::jsonb),
      'sources', COALESCE((SELECT jsonb_agg(jsonb_build_object('key', source_key, 'name', source_name) ORDER BY source_name) FROM (
        SELECT DISTINCT source_key, source_name FROM base
      ) AS sources), '[]'::jsonb),
      'verification_statuses', COALESCE((SELECT jsonb_agg(value ORDER BY value) FROM (
        SELECT DISTINCT verification_status AS value FROM base
      ) AS verification_statuses), '[]'::jsonb)
    ),
    'has_more', (SELECT count(*) > (SELECT page_limit FROM parameters) FROM ordered),
    'next_cursor', CASE WHEN (SELECT count(*) > (SELECT page_limit FROM parameters) FROM ordered) THEN (
      SELECT jsonb_build_object(
        'relevance', relevance,
        'sort_time', sort_time,
        'title_sort', title_sort,
        'result_type', result_type,
        'publication_id', publication_id
      ) FROM last_visible
    ) ELSE NULL END,
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', publication_id,
      'source_id', publication_id,
      'raw_source_record_id', raw_source_record_id,
      'source_record_id', source_record_id,
      'type', result_type,
      'domain', domain,
      'record_key', record_key,
      'title', title,
      'summary', summary,
      'content_excerpt', content_excerpt,
      'market_code', market_code,
      'platform_key', platform_key,
      'category_code', category_code,
      'jurisdiction_code', jurisdiction_code,
      'source_key', source_key,
      'source_name', source_name,
      'source_category', source_category,
      'trust_level', trust_level,
      'verification_status', verification_status,
      'verification_level', verification_level,
      'source_url', source_url,
      'history_url', '#search?record=' || publication_id::TEXT,
      'published_at', published_at,
      'effective_from', effective_from,
      'effective_to', effective_to,
      'collected_at', collected_at,
      'year', publication_year,
      'first_seen_at', first_seen_at,
      'last_seen_at', last_seen_at,
      'evidence_hash', evidence_hash,
      'version_number', version_number,
      'version_label', version_label,
      'changed_fields', changed_fields,
      'relevance', relevance
    ) ORDER BY page_ordinal) FROM visible), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.search_formal_publications(
  TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, DATE, DATE, TEXT,
  JSONB, TIMESTAMPTZ, INTEGER, UUID
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_formal_publications(
  TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, DATE, DATE, TEXT,
  JSONB, TIMESTAMPTZ, INTEGER, UUID
) TO service_role;

COMMENT ON FUNCTION public.search_formal_publications(
  TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, DATE, DATE, TEXT,
  JSONB, TIMESTAMPTZ, INTEGER, UUID
) IS 'Searches only governed formal publications with filter facets, a fixed snapshot and deterministic cursor pagination.';

COMMIT;
