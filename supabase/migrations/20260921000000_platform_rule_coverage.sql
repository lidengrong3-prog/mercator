-- Keep production source governance and platform rule coverage aligned with
-- the four configured US marketplace collectors.  Coverage is derived from
-- eligible, verified rule evidence; a catalog relationship alone never means
-- that a platform is connected.

BEGIN;

UPDATE public.data_source_registry
   SET platform_keys = ARRAY['amazon', 'tiktok-shop', 'aliexpress', 'ebay'],
       updated_at = NOW()
 WHERE source_key = 'platform-official';

CREATE OR REPLACE VIEW public.platform_rule_coverage AS
WITH configured_platforms AS (
  SELECT relation.market_code, relation.platform_key
    FROM public.market_platforms AS relation
   WHERE relation.status = 'active'
     AND relation.data_status IN ('configured', 'verified', 'partial')
), formal_rules AS (
  SELECT rule.market_code,
         rule.platform_key,
         rule.id AS platform_rule_id,
         raw.verified_at,
         COALESCE(version.rule_dimensions, '{}'::jsonb) AS rule_dimensions,
         version.content ->> 'topic' AS rule_topic
    FROM public.platform_rules AS rule
    JOIN public.platform_rule_versions AS version
      ON version.platform_rule_id = rule.id
    JOIN public.raw_source_records AS raw
      ON raw.id = version.raw_source_record_id
   WHERE raw.status = 'active'
     AND raw.publication_status = 'eligible'
     AND raw.verification_status = 'verified'
     AND raw.source_url ~ '^https://[^/]+/.+'
     AND raw.verified_at IS NOT NULL
), coverage AS (
  SELECT configured.market_code,
         configured.platform_key,
         COUNT(DISTINCT formal.platform_rule_id)::INTEGER AS rule_count,
         MAX(formal.verified_at) AS last_verified_at,
         ARRAY_REMOVE(ARRAY[
           CASE WHEN BOOL_OR(formal.rule_dimensions ? 'fee' OR formal.rule_topic = 'fee') THEN 'fee' END,
           CASE WHEN BOOL_OR(formal.rule_dimensions ? 'commission' OR formal.rule_topic = 'commission') THEN 'commission' END,
           CASE WHEN BOOL_OR(formal.rule_dimensions ? 'deposit' OR formal.rule_topic = 'deposit') THEN 'deposit' END,
           CASE WHEN BOOL_OR(formal.rule_dimensions ? 'fulfillment' OR formal.rule_topic = 'fulfillment') THEN 'fulfillment' END,
           CASE WHEN BOOL_OR(formal.rule_dimensions ? 'prohibited' OR formal.rule_topic = 'prohibited') THEN 'prohibited' END,
           CASE WHEN BOOL_OR(formal.rule_dimensions ? 'settlement' OR formal.rule_topic = 'settlement') THEN 'settlement' END,
           CASE WHEN BOOL_OR(formal.rule_dimensions ? 'penalty' OR formal.rule_topic = 'penalty') THEN 'penalty' END
         ], NULL) AS covered_topics
    FROM configured_platforms AS configured
    LEFT JOIN formal_rules AS formal
      ON formal.market_code = configured.market_code
     AND formal.platform_key = configured.platform_key
   GROUP BY configured.market_code, configured.platform_key
)
SELECT market_code,
       platform_key,
       CASE
         WHEN rule_count = 0 THEN 'not_connected'
         WHEN cardinality(covered_topics) < 7
           OR last_verified_at < NOW() - INTERVAL '45 days' THEN 'partial'
         ELSE 'connected'
       END AS status,
       rule_count,
       covered_topics,
       ARRAY(
         SELECT topic
           FROM unnest(ARRAY['fee','commission','deposit','fulfillment','prohibited','settlement','penalty']) AS topic
          WHERE NOT (topic = ANY(covered_topics))
       ) AS missing_topics,
       last_verified_at
  FROM coverage;

COMMENT ON VIEW public.platform_rule_coverage IS
  'Per-market platform rule status calculated only from eligible, verified HTTPS evidence and seven required rule topics.';

REVOKE ALL ON public.platform_rule_coverage FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.platform_rule_coverage TO service_role;

COMMIT;
