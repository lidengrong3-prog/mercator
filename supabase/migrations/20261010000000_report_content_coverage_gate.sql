-- Require regulatory and platform evidence for every active report template.
-- Formal publication still depends on the per-scope evidence matrix below.

BEGIN;

UPDATE public.report_template_catalog
   SET required_domains = ARRAY(
     SELECT DISTINCT domain
       FROM unnest(
         COALESCE(required_domains, '{}'::TEXT[])
         || ARRAY['tax', 'access', 'platform', 'rule']::TEXT[]
       ) AS domain
      WHERE domain <> ''
      ORDER BY domain
   ),
       updated_at = NOW()
 WHERE status = 'active';

COMMENT ON COLUMN public.report_template_catalog.required_domains IS
  'Formal report coverage domains. Active templates require tax, access, platform and rule evidence; missing cells produce drafts only.';

COMMIT;
