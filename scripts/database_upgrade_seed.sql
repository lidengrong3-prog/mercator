\set ON_ERROR_STOP on

INSERT INTO public.market_data(key, data, meta)
VALUES (
  'migration-rehearsal-existing-row',
  '{"value":"preserve-me"}'::jsonb,
  '{"source":"isolated-upgrade-rehearsal"}'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET data = EXCLUDED.data, meta = EXCLUDED.meta;

UPDATE public.production_rollout_state
SET approval_reference = 'migration-rehearsal-existing-row'
WHERE singleton = TRUE;

