-- Add a formal report template for official macro statistics. This template
-- intentionally has no platform scope and does not relax the coverage rules
-- for market-research or category report templates.

BEGIN;

INSERT INTO public.report_template_catalog
  (id, code, version, name, market_codes, platform_keys, category_codes,
   required_domains, modules, status, data_status, updated_at)
VALUES
  ('macro-indicator-v1', 'macro-indicator', 1, '官方宏观指标报告',
   ARRAY['US'], '{}'::TEXT[], ARRAY['generic'], ARRAY['market'],
   ARRAY['indicator_summary', 'source_evidence'], 'active', 'verified', NOW())
ON CONFLICT (id) DO UPDATE
  SET code = EXCLUDED.code,
      version = EXCLUDED.version,
      name = EXCLUDED.name,
      market_codes = EXCLUDED.market_codes,
      platform_keys = EXCLUDED.platform_keys,
      category_codes = EXCLUDED.category_codes,
      required_domains = EXCLUDED.required_domains,
      modules = EXCLUDED.modules,
      status = EXCLUDED.status,
      data_status = EXCLUDED.data_status,
      updated_at = NOW();

COMMENT ON COLUMN public.report_template_catalog.required_domains IS
  'Formal report coverage domains declared per template. Market/category reports retain full regulatory and platform coverage; official macro indicator reports require traceable market statistics only.';

COMMIT;
