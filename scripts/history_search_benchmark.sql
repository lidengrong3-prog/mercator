-- Run after applying 20260922000000_server_history_search.sql in an isolated
-- database. The transaction always rolls back the 100,000 generated records.
-- psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f scripts/history_search_benchmark.sql

\set ON_ERROR_STOP on
\timing on

BEGIN;

CREATE TEMP TABLE history_search_benchmark_ids (
  id UUID PRIMARY KEY,
  ordinal INTEGER NOT NULL
) ON COMMIT DROP;

WITH generated AS (
  SELECT
    public.history_uuid('history-search-benchmark', value::TEXT) AS id,
    value AS ordinal,
    encode(digest('history-search-benchmark-' || value::TEXT, 'sha256'), 'hex') AS evidence_hash
  FROM generate_series(1, 100000) AS value
), inserted AS (
  INSERT INTO public.raw_source_records (
    id, run_id, source_key, domain, source_record_id, normalized_record_key,
    source_url, source_kind, source_type, source_category,
    verification_status, publication_status, market_codes, platform_keys,
    category_codes, collected_at, retrieved_at, published_at, first_seen_at,
    last_seen_at, evidence_hash, payload, allowed_display_fields,
    license_class, access_class, redistribution_allowed, status
  )
  SELECT
    id, 'history-search-benchmark', 'federal-register', 'policy',
    'benchmark-' || ordinal, 'benchmark-' || ordinal,
    'https://example.com/history-search-benchmark/' || ordinal,
    'official', 'government', 'official_policy', 'verified', 'eligible',
    ARRAY['US'], ARRAY['amazon'], ARRAY[CASE WHEN ordinal % 2 = 0 THEN 'home' ELSE 'beauty' END],
    TIMESTAMPTZ '2026-01-01 00:00:00+00' - (ordinal % 3650) * INTERVAL '1 day',
    TIMESTAMPTZ '2026-01-01 00:00:00+00' - (ordinal % 3650) * INTERVAL '1 day',
    TIMESTAMPTZ '2026-01-01 00:00:00+00' - (ordinal % 3650) * INTERVAL '1 day',
    TIMESTAMPTZ '2026-01-01 00:00:00+00' - (ordinal % 3650) * INTERVAL '1 day',
    TIMESTAMPTZ '2026-01-01 00:00:00+00' - (ordinal % 3650) * INTERVAL '1 day',
    evidence_hash,
    jsonb_build_object('title', 'Benchmark policy ' || ordinal, 'summary', 'tariff compliance benchmark record ' || ordinal),
    ARRAY['title', 'summary', 'source_url', 'published_at'],
    'official_public', 'public_summary', TRUE, 'active'
  FROM generated
  RETURNING id, substring(source_record_id FROM '[0-9]+$')::INTEGER AS ordinal
)
INSERT INTO history_search_benchmark_ids SELECT id, ordinal FROM inserted;

INSERT INTO public.formal_publications (
  id, source_key, raw_source_record_id, publication_type, domain, record_key,
  market_code, platform_key, category_code, status, title, summary, source_url,
  published_at, collected_at, first_seen_at, last_seen_at, evidence_hash,
  public_payload
)
SELECT
  public.history_uuid('history-search-benchmark-publication', ids.ordinal::TEXT),
  'federal-register', raw.id, 'policy', 'policy', raw.source_record_id,
  'US', 'amazon', CASE WHEN ids.ordinal % 2 = 0 THEN 'home' ELSE 'beauty' END,
  'active', 'Benchmark policy ' || ids.ordinal,
  'tariff compliance benchmark record ' || ids.ordinal, raw.source_url,
  raw.published_at, raw.collected_at, raw.first_seen_at, raw.last_seen_at,
  raw.evidence_hash,
  jsonb_build_object('title', 'Benchmark policy ' || ids.ordinal, 'summary', 'tariff compliance benchmark record ' || ids.ordinal)
FROM history_search_benchmark_ids AS ids
JOIN public.raw_source_records AS raw ON raw.id = ids.id;

ANALYZE public.formal_publications;

EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT public.search_formal_publications(
  p_query => 'Benchmark policy 99999', p_type => 'policy',
  p_market_code => 'US', p_platform_key => 'amazon', p_category_code => NULL,
  p_year => NULL, p_source_key => 'federal-register',
  p_verification_status => 'verified', p_from => NULL, p_to => NULL,
  p_sort => 'relevance', p_cursor => NULL, p_snapshot_at => NOW(),
  p_limit => 20, p_record_id => NULL
);

DO $$
DECLARE
  first_page JSONB;
  second_page JSONB;
  combined_count INTEGER;
BEGIN
  first_page := public.search_formal_publications(
    p_query => 'tariff compliance', p_type => 'policy', p_market_code => 'US',
    p_source_key => 'federal-register', p_sort => 'newest', p_limit => 20
  );
  second_page := public.search_formal_publications(
    p_query => 'tariff compliance', p_type => 'policy', p_market_code => 'US',
    p_source_key => 'federal-register', p_sort => 'newest',
    p_cursor => first_page->'next_cursor',
    p_snapshot_at => (first_page->>'query_snapshot_at')::TIMESTAMPTZ,
    p_limit => 20
  );
  SELECT count(DISTINCT item->>'id')
    INTO combined_count
    FROM jsonb_array_elements((first_page->'items') || (second_page->'items')) AS item;
  IF combined_count <> 40 THEN
    RAISE EXCEPTION 'history search pagination produced duplicate or missing rows: % distinct rows', combined_count;
  END IF;
END;
$$;

ROLLBACK;
