BEGIN;

-- Every AI request is attributable to the UI feature that initiated it.
-- Existing rows are retained and classified from their operation name.
ALTER TABLE public.ai_request_logs
  ADD COLUMN IF NOT EXISTS entry_point TEXT NOT NULL DEFAULT 'other';

UPDATE public.ai_request_logs
SET entry_point = CASE
  WHEN operation LIKE 'overview%' THEN 'overview.decision'
  WHEN operation LIKE 'report%' THEN 'report.generation'
  WHEN operation LIKE 'alerts%' THEN 'alerts.diagnosis'
  WHEN operation LIKE 'intelligence%' THEN 'intelligence.refresh'
  ELSE 'other'
END
WHERE entry_point IS NULL OR entry_point = 'other';

ALTER TABLE public.ai_request_logs
  DROP CONSTRAINT IF EXISTS ai_request_logs_entry_point_check;
ALTER TABLE public.ai_request_logs
  ADD CONSTRAINT ai_request_logs_entry_point_check
  CHECK (entry_point ~ '^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)?$');

CREATE INDEX IF NOT EXISTS idx_ai_request_logs_entry_point
  ON public.ai_request_logs(user_id, entry_point, created_at DESC);

COMMENT ON COLUMN public.ai_request_logs.entry_point IS
  'Stable UI feature identifier, for example overview.decision or report.generation';

COMMIT;
