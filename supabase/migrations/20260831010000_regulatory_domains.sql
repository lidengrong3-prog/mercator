-- Independent tax/access domains and auditable Chinese display metadata.

BEGIN;

ALTER TABLE public.market_data_applicability
  ADD COLUMN IF NOT EXISTS change_type TEXT,
  ADD COLUMN IF NOT EXISTS change_summary TEXT,
  ADD COLUMN IF NOT EXISTS locale TEXT,
  ADD COLUMN IF NOT EXISTS translation_status TEXT;

ALTER TABLE public.market_data_applicability
  DROP CONSTRAINT IF EXISTS market_data_applicability_change_type_check;
ALTER TABLE public.market_data_applicability
  ADD CONSTRAINT market_data_applicability_change_type_check CHECK (
    change_type IS NULL OR change_type IN (
      'created', 'updated', 'rate_change', 'requirement_change', 'suspended', 'expired'
    )
  );

ALTER TABLE public.market_data_applicability
  DROP CONSTRAINT IF EXISTS market_data_applicability_translation_status_check;
ALTER TABLE public.market_data_applicability
  ADD CONSTRAINT market_data_applicability_translation_status_check CHECK (
    translation_status IS NULL OR translation_status IN ('source_zh', 'translated', 'reviewed', 'pending', 'rejected')
  );

CREATE INDEX IF NOT EXISTS idx_market_tax_type
  ON public.market_data_applicability(market_code, (payload->>'tax_type'), effective_from)
  WHERE domain = 'tax';

CREATE INDEX IF NOT EXISTS idx_market_access_requirement
  ON public.market_data_applicability(market_code, (payload->>'requirement_type'), effective_from)
  WHERE domain = 'access';

CREATE INDEX IF NOT EXISTS idx_regulatory_change_events
  ON public.market_data_applicability(domain, market_code, change_type, effective_from)
  WHERE domain IN ('policy', 'tax', 'access') AND change_type IS NOT NULL;

COMMENT ON COLUMN public.market_data_applicability.locale IS
  'Display locale for normalized regulatory content; source language remains in payload.';
COMMENT ON COLUMN public.market_data_applicability.translation_status IS
  'Chinese display translation state bound to payload.translation.source_hash.';

COMMIT;
