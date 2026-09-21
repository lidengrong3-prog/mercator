-- Live multi-provider acceptance evidence must be attributable without ever
-- persisting prompts, responses, or provider secrets.
BEGIN;

ALTER TABLE public.ai_provider_attempt_logs
  ADD COLUMN IF NOT EXISTS acceptance_run_id TEXT,
  ADD COLUMN IF NOT EXISTS config_fingerprint TEXT;
CREATE INDEX IF NOT EXISTS idx_ai_provider_attempt_logs_acceptance_run
  ON public.ai_provider_attempt_logs(acceptance_run_id, request_id, attempt_no)
  WHERE acceptance_run_id IS NOT NULL;

ALTER TABLE public.ai_request_logs
  ADD COLUMN IF NOT EXISTS provider_config_fingerprints JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Acceptance traffic is isolated from operational cost and failure rollups;
-- its compact result is retained in production_acceptance_runs.result_summary.
CREATE OR REPLACE FUNCTION public.record_ai_provider_attempt()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.acceptance_run_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.ai_provider_usage_daily
    (usage_date, workspace_id, provider, task_type, request_count, failure_count, total_tokens, estimated_cost_usd)
  VALUES
    (NEW.created_at::date, NEW.workspace_id, NEW.provider, NEW.task_type, 1,
     CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END, NEW.total_tokens, NEW.estimated_cost_usd)
  ON CONFLICT (usage_date, workspace_id, provider, task_type) DO UPDATE SET
    request_count = ai_provider_usage_daily.request_count + 1,
    failure_count = ai_provider_usage_daily.failure_count + EXCLUDED.failure_count,
    total_tokens = ai_provider_usage_daily.total_tokens + EXCLUDED.total_tokens,
    estimated_cost_usd = ai_provider_usage_daily.estimated_cost_usd + EXCLUDED.estimated_cost_usd,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.ai_provider_attempt_logs.config_fingerprint IS
  'SHA-256 of provider, adapter, endpoint, model and bot identity; never includes a secret.';
COMMENT ON COLUMN public.ai_provider_attempt_logs.acceptance_run_id IS
  'Links isolated live acceptance traffic for cleanup; acceptance rows are excluded from daily usage rollups.';
COMMENT ON COLUMN public.ai_request_logs.provider_config_fingerprints IS
  'Provider-to-fingerprint map for audit; values exclude API keys and prompt/response content.';

COMMIT;
