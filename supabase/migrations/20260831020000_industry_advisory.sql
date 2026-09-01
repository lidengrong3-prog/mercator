-- Third-party industry intelligence is auditable context, not official policy.
-- Keep it in the raw evidence layer with an explicit classification so
-- downstream queries can filter it without inspecting the JSON payload.

BEGIN;

ALTER TABLE public.raw_data_records
  ADD COLUMN IF NOT EXISTS source_class TEXT;

ALTER TABLE public.market_data_applicability
  ADD COLUMN IF NOT EXISTS source_class TEXT;

CREATE INDEX IF NOT EXISTS idx_raw_data_records_source_class
  ON public.raw_data_records(source_class, domain, verification_status);

INSERT INTO public.data_source_registry
  (source_key, name, source_kind, source_type, verification_policy, status, metadata)
VALUES
  ('traceable-feed', '可追溯行业资讯源', 'traceable', 'licensed_provider', 'manual_review', 'active',
   '{"providers":["雨果网","AMZ123"],"publication":"advisory_only"}'::jsonb)
ON CONFLICT (source_key) DO UPDATE SET
  name = EXCLUDED.name,
  source_kind = EXCLUDED.source_kind,
  source_type = EXCLUDED.source_type,
  verification_policy = EXCLUDED.verification_policy,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

COMMIT;
