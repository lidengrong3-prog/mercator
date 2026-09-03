-- Keep market/platform relationship status aligned with the scope manifest.
-- schema_only means the relationship is configured but factual rule data has
-- not yet been verified for that market/platform pair.

BEGIN;

ALTER TABLE public.market_platforms
  DROP CONSTRAINT IF EXISTS market_platforms_data_status_check;

ALTER TABLE public.market_platforms
  ADD CONSTRAINT market_platforms_data_status_check CHECK (
    data_status IN ('verified', 'configured', 'partial', 'unknown', 'schema_only')
  );

COMMIT;
