-- Enforce the configured market/platform/category catalog at publication time.
-- Immutable raw_source_records remain available for audit, while current
-- projections and replaceable private artifacts are retired.

BEGIN;

UPDATE public.data_source_registry
   SET category_codes = ARRAY[
         'generic', 'electronics', 'beauty', 'apparel', 'home',
         'pet-food', 'pet-supplies'
       ],
       updated_at = NOW()
 WHERE source_key = 'tikhub';

UPDATE public.market_catalog
   SET platform_keys = ARRAY['amazon', 'tiktok-shop', 'aliexpress', 'ebay'],
       category_keys = ARRAY[
         'generic', 'electronics', 'beauty', 'apparel', 'home',
         'pet-food', 'pet-supplies'
       ],
       updated_at = NOW()
 WHERE code = 'US';

UPDATE public.market_platforms
   SET status = 'inactive',
       data_status = 'unknown',
       effective_to = COALESCE(effective_to, CURRENT_DATE),
       updated_at = NOW()
 WHERE market_code = 'US'
   AND lower(platform_key) NOT IN ('amazon', 'tiktok-shop', 'aliexpress', 'ebay');

UPDATE public.platform_catalog
   SET status = 'inactive', updated_at = NOW()
 WHERE lower(key) IN ('walmart', 'etsy', 'shopify', 'temu', 'shein', 'temu-shein');

UPDATE public.category_profiles
   SET status = 'inactive', updated_at = NOW()
 WHERE lower(code) NOT IN (
   'generic', 'electronics', 'beauty', 'apparel', 'home',
   'pet-food', 'pet-supplies'
 );

UPDATE public.report_template_catalog
   SET status = 'inactive', updated_at = NOW()
 WHERE EXISTS (
   SELECT 1
     FROM unnest(COALESCE(category_codes, '{}'::TEXT[])) AS value
    WHERE lower(value) NOT IN (
      'generic', 'electronics', 'beauty', 'apparel', 'home',
      'pet-food', 'pet-supplies'
    )
 );

UPDATE public.raw_data_records
   SET status = 'inactive',
       quarantine_reason = concat_ws(
         ' ', NULLIF(quarantine_reason, ''),
         'Record is outside the configured market platform/category catalog.'
       ),
       updated_at = NOW()
 WHERE EXISTS (
         SELECT 1
           FROM unnest(COALESCE(platform_keys, '{}'::TEXT[])) AS value
          WHERE lower(value) NOT IN ('amazon', 'tiktok-shop', 'aliexpress', 'ebay')
       )
    OR EXISTS (
         SELECT 1
           FROM unnest(COALESCE(category_codes, '{}'::TEXT[])) AS value
          WHERE lower(value) NOT IN (
            'generic', 'electronics', 'beauty', 'apparel', 'home',
            'pet-food', 'pet-supplies'
          )
       );

UPDATE public.formal_publications
   SET status = 'withdrawn'
 WHERE status = 'active'
   AND (
     (platform_key IS NOT NULL AND lower(platform_key) NOT IN (
       'amazon', 'tiktok-shop', 'aliexpress', 'ebay'
     ))
     OR
     (category_code IS NOT NULL AND lower(category_code) NOT IN (
       'generic', 'electronics', 'beauty', 'apparel', 'home',
       'pet-food', 'pet-supplies'
     ))
   );

DELETE FROM public.market_data_applicability
 WHERE (platform_key IS NOT NULL AND lower(platform_key) NOT IN (
         'amazon', 'tiktok-shop', 'aliexpress', 'ebay'
       ))
    OR (category_code IS NOT NULL AND lower(category_code) NOT IN (
         'generic', 'electronics', 'beauty', 'apparel', 'home',
         'pet-food', 'pet-supplies'
       ));

-- The normal retention purge removes these objects through the Storage API.
-- A subsequent collection run uploads clean replacements under new hashes.
UPDATE public.private_data_artifacts
   SET retention_until = LEAST(retention_until, NOW())
 WHERE metadata->>'repository_relative_path' LIKE 'data/us_market/%.json'
    OR metadata->>'repository_relative_path' LIKE 'data/private_repository_source/%'
    OR metadata->>'repository_relative_path' IN (
         'data/countries.json', 'data/platforms.json', 'data/policies.json',
         'data/rules.json', 'data/alerts_detailed.json',
         'data/countries_new.json', 'data/policies_baseline.json',
         'data/rules_baseline.json', 'data/_cfd_part1.json',
         'data/_ext_part1.json', 'data/_new_cfd_js.txt', 'data/_new_ext_js.txt'
       )
    OR metadata->>'repository_relative_path' LIKE 'data/quarantine_%';

CREATE OR REPLACE FUNCTION public.guard_configured_raw_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM unnest(COALESCE(NEW.platform_keys, '{}'::TEXT[])) AS value
     WHERE lower(value) NOT IN ('amazon', 'tiktok-shop', 'aliexpress', 'ebay')
  ) THEN
    RAISE EXCEPTION 'raw record contains a platform outside the configured catalog'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM unnest(COALESCE(NEW.category_codes, '{}'::TEXT[])) AS value
     WHERE lower(value) NOT IN (
       'generic', 'electronics', 'beauty', 'apparel', 'home',
       'pet-food', 'pet-supplies'
     )
  ) THEN
    RAISE EXCEPTION 'raw record contains a category outside the configured catalog'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_configured_raw_scope_legacy
  ON public.raw_data_records;
CREATE TRIGGER trg_guard_configured_raw_scope_legacy
  BEFORE INSERT OR UPDATE OF platform_keys, category_codes, status
  ON public.raw_data_records
  FOR EACH ROW EXECUTE FUNCTION public.guard_configured_raw_scope();

DROP TRIGGER IF EXISTS trg_guard_configured_raw_scope_history
  ON public.raw_source_records;
CREATE TRIGGER trg_guard_configured_raw_scope_history
  BEFORE INSERT OR UPDATE OF platform_keys, category_codes, status
  ON public.raw_source_records
  FOR EACH ROW EXECUTE FUNCTION public.guard_configured_raw_scope();

CREATE OR REPLACE FUNCTION public.guard_configured_market_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'active' OR NEW.market_code IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.platform_key IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.market_platforms AS relation
     WHERE relation.market_code = NEW.market_code
       AND relation.platform_key = NEW.platform_key
       AND relation.status = 'active'
       AND relation.data_status IN ('configured', 'verified')
  ) THEN
    RAISE EXCEPTION 'platform % is not configured for market %', NEW.platform_key, NEW.market_code
      USING ERRCODE = '23514';
  END IF;

  IF NEW.category_code IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.market_catalog AS market
      JOIN public.category_profiles AS category
        ON category.code = NEW.category_code AND category.status = 'active'
     WHERE market.code = NEW.market_code
       AND market.status = 'active'
       AND market.data_status IN ('configured', 'verified')
       AND market.category_keys @> ARRAY[NEW.category_code]::TEXT[]
  ) THEN
    RAISE EXCEPTION 'category % is not configured for market %', NEW.category_code, NEW.market_code
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_configured_scope_applicability
  ON public.market_data_applicability;
CREATE TRIGGER trg_guard_configured_scope_applicability
  BEFORE INSERT OR UPDATE OF market_code, platform_key, category_code, status
  ON public.market_data_applicability
  FOR EACH ROW EXECUTE FUNCTION public.guard_configured_market_scope();

DROP TRIGGER IF EXISTS trg_guard_configured_scope_publication
  ON public.formal_publications;
CREATE TRIGGER trg_guard_configured_scope_publication
  BEFORE INSERT OR UPDATE OF market_code, platform_key, category_code, status
  ON public.formal_publications
  FOR EACH ROW EXECUTE FUNCTION public.guard_configured_market_scope();

COMMIT;
