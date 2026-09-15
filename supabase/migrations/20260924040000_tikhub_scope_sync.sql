-- Keep the database coverage ledger aligned with the active launch-market
-- catalog. The catalog, rather than a US-specific constant, decides which
-- TikTok Shop market scopes exist; only configured relations are executable.

BEGIN;

-- Ensure every newly configured TikTok Shop market receives a separate
-- content ledger without copying authorization or enabling collection.
INSERT INTO public.tikhub_pilot_configs(
  pilot_key, market_code, platform_key, keywords, cadence_per_day, pilot_days,
  api_key_secret_name, cookie_endpoint_policy, authorization_status, status,
  enabled, market_codes, platform_keys, scope_status, notes
)
SELECT 'tiktok-shop-' || lower(market.code) || '-content-pilot',
       market.code, 'tiktok-shop', base.keywords, base.cadence_per_day,
       base.pilot_days, base.api_key_secret_name, base.cookie_endpoint_policy,
       'pending', 'draft', FALSE, ARRAY[market.code]::TEXT[], ARRAY['tiktok-shop']::TEXT[],
       CASE WHEN relation.status = 'active' AND relation.data_status = 'configured'
            THEN 'configured' ELSE 'schema_only' END,
       '内容快照试点配置由上线市场目录生成；需单独完成授权。'
  FROM public.market_catalog AS market
  LEFT JOIN public.market_platforms AS relation
    ON relation.market_code = market.code AND relation.platform_key = 'tiktok-shop'
  CROSS JOIN LATERAL (
    SELECT config.keywords, config.cadence_per_day, config.pilot_days,
           config.api_key_secret_name, config.cookie_endpoint_policy
      FROM public.tikhub_pilot_configs config
     WHERE config.pilot_key = 'tiktok-shop-us-pilot'
     LIMIT 1
  ) AS base
 WHERE market.status = 'active'
   AND market.platform_keys @> ARRAY['tiktok-shop']::TEXT[]
ON CONFLICT (pilot_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_tikhub_scope_status()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_count INTEGER := 0;
BEGIN
  UPDATE public.data_source_registry AS registry
     SET market_codes = COALESCE((
       SELECT array_agg(market.code ORDER BY market.code)
         FROM public.market_catalog AS market
        WHERE market.status = 'active'
          AND market.platform_keys @> ARRAY['tiktok-shop']::TEXT[]
     ), '{}'),
         updated_at = NOW()
   WHERE registry.source_key = 'tikhub';

  INSERT INTO public.tikhub_pilot_scope_status(
    market_code, platform_key, market_status, data_status, scope_status,
    executable, pilot_key, reason
  )
  SELECT market.code, 'tiktok-shop', market.status,
         CASE WHEN relation.status = 'active' AND relation.data_status = 'configured'
              THEN 'configured' ELSE 'schema_only' END,
         CASE WHEN relation.status = 'active' AND relation.data_status = 'configured'
              THEN 'configured' ELSE 'schema_only' END,
         (relation.status = 'active' AND relation.data_status = 'configured'),
         CASE WHEN EXISTS (
           SELECT 1 FROM public.tikhub_pilot_configs config
            WHERE config.pilot_key = 'tiktok-shop-' || lower(market.code) || '-pilot'
         ) THEN 'tiktok-shop-' || lower(market.code) || '-pilot' ELSE NULL END,
         CASE WHEN relation.status = 'active' AND relation.data_status = 'configured'
              THEN NULL ELSE 'market/platform adapter is not configured' END
    FROM public.market_catalog AS market
    LEFT JOIN public.market_platforms AS relation
      ON relation.market_code = market.code
     AND relation.platform_key = 'tiktok-shop'
   WHERE market.status = 'active'
     AND market.platform_keys @> ARRAY['tiktok-shop']::TEXT[]
  ON CONFLICT (market_code, platform_key) DO UPDATE SET
    market_status = EXCLUDED.market_status,
    data_status = EXCLUDED.data_status,
    scope_status = EXCLUDED.scope_status,
    executable = EXCLUDED.executable,
    pilot_key = EXCLUDED.pilot_key,
    reason = EXCLUDED.reason,
    updated_at = NOW();

  GET DIAGNOSTICS changed_count = ROW_COUNT;
  RETURN changed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_tikhub_scope_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_tikhub_scope_status() TO service_role;
SELECT public.sync_tikhub_scope_status();

COMMENT ON FUNCTION public.sync_tikhub_scope_status() IS
  'Refreshes TikHub market coverage from active market_catalog and market_platforms; schema-only scopes never enqueue provider calls.';

COMMIT;
