-- Report quality assessment and server-maintained observability rollups.
-- AI request rows remain the source of truth; report_runs exposes a queryable
-- per-run summary without copying prompts or report bodies into telemetry.

BEGIN;

ALTER TABLE public.generated_reports
  ADD COLUMN IF NOT EXISTS content_quality JSONB;

ALTER TABLE public.report_runs
  ADD COLUMN IF NOT EXISTS input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  ADD COLUMN IF NOT EXISTS output_tokens BIGINT NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  ADD COLUMN IF NOT EXISTS total_tokens BIGINT NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(14, 8) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  ADD COLUMN IF NOT EXISTS ai_request_count INTEGER NOT NULL DEFAULT 0 CHECK (ai_request_count >= 0),
  ADD COLUMN IF NOT EXISTS failed_request_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_request_count >= 0),
  ADD COLUMN IF NOT EXISTS search_request_count INTEGER NOT NULL DEFAULT 0 CHECK (search_request_count >= 0),
  ADD COLUMN IF NOT EXISTS save_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'draft';

ALTER TABLE public.report_runs
  DROP CONSTRAINT IF EXISTS report_runs_save_status_check;
ALTER TABLE public.report_runs
  ADD CONSTRAINT report_runs_save_status_check
  CHECK (save_status IN ('pending', 'saved', 'failed', 'blocked'));
ALTER TABLE public.report_runs
  DROP CONSTRAINT IF EXISTS report_runs_publication_status_check;
ALTER TABLE public.report_runs
  ADD CONSTRAINT report_runs_publication_status_check
  CHECK (publication_status IN ('draft', 'formal', 'revoked'));

ALTER TABLE public.ai_request_logs
  ADD COLUMN IF NOT EXISTS search_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_report_runs_observability
  ON public.report_runs(user_id, created_at DESC, status, publication_status);
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_search
  ON public.ai_request_logs(report_run_id, search_enabled, created_at ASC);

-- Keep the per-run totals authoritative and resistant to client-side edits.
CREATE OR REPLACE FUNCTION public.rollup_report_run_ai_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.report_run_id IS NULL THEN
    RETURN NEW;
  END IF;
  UPDATE public.report_runs AS run
  SET input_tokens = totals.input_tokens,
      output_tokens = totals.output_tokens,
      total_tokens = totals.total_tokens,
      estimated_cost_usd = totals.estimated_cost_usd,
      ai_request_count = totals.ai_request_count,
      failed_request_count = totals.failed_request_count,
      search_request_count = totals.search_request_count,
      model = CASE
        WHEN run.model IS NULL OR run.model IN ('', 'server-configured', 'pending') THEN totals.first_model
        ELSE run.model
      END
  FROM (
    SELECT
      COALESCE(SUM(input_tokens), 0)::BIGINT AS input_tokens,
      COALESCE(SUM(output_tokens), 0)::BIGINT AS output_tokens,
      COALESCE(SUM(total_tokens), 0)::BIGINT AS total_tokens,
      COALESCE(SUM(estimated_cost_usd), 0)::NUMERIC(14, 8) AS estimated_cost_usd,
      COUNT(*)::INTEGER AS ai_request_count,
      COUNT(*) FILTER (WHERE status = 'failed')::INTEGER AS failed_request_count,
      COUNT(*) FILTER (WHERE search_enabled = TRUE)::INTEGER AS search_request_count,
      (ARRAY_AGG(model ORDER BY created_at ASC))[1] AS first_model
    FROM public.ai_request_logs
    WHERE report_run_id = NEW.report_run_id
  ) AS totals
  WHERE run.id = NEW.report_run_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_request_logs_rollup_report_run ON public.ai_request_logs;
CREATE TRIGGER ai_request_logs_rollup_report_run
  AFTER INSERT OR UPDATE OF input_tokens, output_tokens, total_tokens,
    estimated_cost_usd, status, model, search_enabled, report_run_id
  ON public.ai_request_logs
  FOR EACH ROW EXECUTE FUNCTION public.rollup_report_run_ai_usage();

-- Backfill totals when this migration is applied to an existing project.
UPDATE public.report_runs AS run
SET input_tokens = totals.input_tokens,
    output_tokens = totals.output_tokens,
    total_tokens = totals.total_tokens,
    estimated_cost_usd = totals.estimated_cost_usd,
    ai_request_count = totals.ai_request_count,
    failed_request_count = totals.failed_request_count,
    search_request_count = totals.search_request_count,
    model = CASE
      WHEN run.model IS NULL OR run.model IN ('', 'server-configured', 'pending') THEN totals.first_model
      ELSE run.model
    END
FROM (
  SELECT report_run_id,
    COALESCE(SUM(input_tokens), 0)::BIGINT AS input_tokens,
    COALESCE(SUM(output_tokens), 0)::BIGINT AS output_tokens,
    COALESCE(SUM(total_tokens), 0)::BIGINT AS total_tokens,
    COALESCE(SUM(estimated_cost_usd), 0)::NUMERIC(14, 8) AS estimated_cost_usd,
    COUNT(*)::INTEGER AS ai_request_count,
    COUNT(*) FILTER (WHERE status = 'failed')::INTEGER AS failed_request_count,
    COUNT(*) FILTER (WHERE search_enabled = TRUE)::INTEGER AS search_request_count,
    (ARRAY_AGG(model ORDER BY created_at ASC))[1] AS first_model
  FROM public.ai_request_logs
  WHERE report_run_id IS NOT NULL
  GROUP BY report_run_id
) AS totals
WHERE run.id = totals.report_run_id;

COMMENT ON COLUMN public.generated_reports.content_quality IS
  'Server-computed accuracy, completeness, executability and source-coverage assessment.';
COMMENT ON COLUMN public.report_runs.total_tokens IS
  'Server-maintained sum of linked AI request logs; never accepted from the browser.';
COMMENT ON COLUMN public.ai_request_logs.search_enabled IS
  'Whether the request enabled provider web search or another network retrieval mode.';

COMMIT;
