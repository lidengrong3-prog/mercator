-- Platform rule versioning keeps market/platform history queryable without
-- replacing the current record. The JSON payload remains the source of the
-- seven optional rule dimensions (fee, commission, deposit, fulfillment,
-- prohibited, settlement and penalty).

BEGIN;

ALTER TABLE public.market_data_applicability
  ADD COLUMN IF NOT EXISTS record_version TEXT;

CREATE INDEX IF NOT EXISTS idx_market_rule_versions
  ON public.market_data_applicability(
    market_code, platform_key, record_key, effective_from, record_version
  )
  WHERE domain = 'rule';

COMMENT ON COLUMN public.market_data_applicability.record_version IS
  'Explicit platform rule version supplied by the source; NULL means the source did not provide one.';

COMMIT;
