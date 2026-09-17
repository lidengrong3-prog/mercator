-- Keep one current bootstrap snapshot for every required Worker state file.
-- The preceding scope migration retired replaceable artifacts before the
-- collector could upload their in-scope replacements, leaving a new Worker
-- unable to start. Recovery is limited to the newest allowlisted snapshot.

BEGIN;

WITH bootstrap_candidates AS (
  SELECT
    artifact.id,
    CASE artifact.metadata->>'repository_relative_path'
      WHEN 'data/countries.json' THEN 'data/countries.json'
      WHEN 'data/private_repository_source/countries.json' THEN 'data/countries.json'
      WHEN 'data/platforms.json' THEN 'data/platforms.json'
      WHEN 'data/private_repository_source/platforms.json' THEN 'data/platforms.json'
      WHEN 'data/policies.json' THEN 'data/policies.json'
      WHEN 'data/private_repository_source/policies.json' THEN 'data/policies.json'
      WHEN 'data/rules.json' THEN 'data/rules.json'
      WHEN 'data/private_repository_source/rules.json' THEN 'data/rules.json'
      WHEN 'data/us_market/macro_indicators.json' THEN 'data/us_market/macro_indicators.json'
      WHEN 'data/private_repository_source/us_market/macro_indicators.json' THEN 'data/us_market/macro_indicators.json'
    END AS bootstrap_path,
    ROW_NUMBER() OVER (
      PARTITION BY CASE artifact.metadata->>'repository_relative_path'
        WHEN 'data/countries.json' THEN 'data/countries.json'
        WHEN 'data/private_repository_source/countries.json' THEN 'data/countries.json'
        WHEN 'data/platforms.json' THEN 'data/platforms.json'
        WHEN 'data/private_repository_source/platforms.json' THEN 'data/platforms.json'
        WHEN 'data/policies.json' THEN 'data/policies.json'
        WHEN 'data/private_repository_source/policies.json' THEN 'data/policies.json'
        WHEN 'data/rules.json' THEN 'data/rules.json'
        WHEN 'data/private_repository_source/rules.json' THEN 'data/rules.json'
        WHEN 'data/us_market/macro_indicators.json' THEN 'data/us_market/macro_indicators.json'
        WHEN 'data/private_repository_source/us_market/macro_indicators.json' THEN 'data/us_market/macro_indicators.json'
      END
      ORDER BY artifact.captured_at DESC, artifact.created_at DESC, artifact.id DESC
    ) AS bootstrap_rank
  FROM public.private_data_artifacts AS artifact
  WHERE artifact.metadata->>'repository_relative_path' IN (
    'data/countries.json',
    'data/private_repository_source/countries.json',
    'data/platforms.json',
    'data/private_repository_source/platforms.json',
    'data/policies.json',
    'data/private_repository_source/policies.json',
    'data/rules.json',
    'data/private_repository_source/rules.json',
    'data/us_market/macro_indicators.json',
    'data/private_repository_source/us_market/macro_indicators.json'
  )
), latest_bootstrap_artifacts AS (
  SELECT id
  FROM bootstrap_candidates
  WHERE bootstrap_path IS NOT NULL
    AND bootstrap_rank = 1
)
UPDATE public.private_data_artifacts AS artifact
   SET retention_until = GREATEST(
         artifact.retention_until,
         NOW() + INTERVAL '180 days'
       ),
       metadata = artifact.metadata || jsonb_build_object(
         'retention_recovery', '20261011000000',
         'retention_recovery_reason', 'worker_bootstrap_deadlock'
       )
  FROM latest_bootstrap_artifacts AS recovery
 WHERE artifact.id = recovery.id;

COMMENT ON TABLE public.private_data_artifacts IS
  'Service-only private artifacts. The newest allowlisted Worker bootstrap snapshot must remain restorable until a replacement is registered.';

COMMIT;
