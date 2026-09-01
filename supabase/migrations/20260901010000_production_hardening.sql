-- Production hardening for account isolation, idempotency and observability.

BEGIN;

-- Parsed category/product uploads are stored as an authenticated workspace
-- asset. The existing RLS policies on saved_workspace_items keep each payload
-- bound to its owner while still allowing refresh and re-login recovery.
ALTER TABLE public.saved_workspace_items
  DROP CONSTRAINT IF EXISTS saved_workspace_items_item_type_check;
ALTER TABLE public.saved_workspace_items
  ADD CONSTRAINT saved_workspace_items_item_type_check
  CHECK (item_type IN (
    'comparison_schemes', 'product_filter_templates', 'shop_filter_templates',
    'content_filter_templates', 'report_templates', 'shop_groups',
    'content_collections', 'report_draft', 'product_catalog_import'
  ));

CREATE TABLE IF NOT EXISTS public.report_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  report_id UUID REFERENCES public.generated_reports(id) ON DELETE SET NULL,
  client_report_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'market-research',
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  market_codes TEXT[] NOT NULL DEFAULT '{}',
  platform_keys TEXT[] NOT NULL DEFAULT '{}',
  category_codes TEXT[] NOT NULL DEFAULT '{}',
  data_version TEXT,
  model TEXT,
  section_count INTEGER NOT NULL DEFAULT 0 CHECK (section_count >= 0),
  duration_ms BIGINT CHECK (duration_ms IS NULL OR duration_ms >= 0),
  failed_section TEXT,
  error_code TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_report_runs_user_created
  ON public.report_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_runs_report
  ON public.report_runs(report_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_runs_status
  ON public.report_runs(status, started_at DESC);

ALTER TABLE public.generated_reports
  ADD COLUMN IF NOT EXISTS report_run_id UUID REFERENCES public.report_runs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_generated_reports_run
  ON public.generated_reports(report_run_id);

ALTER TABLE public.report_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS report_runs_select_own ON public.report_runs;
DROP POLICY IF EXISTS report_runs_insert_own ON public.report_runs;
DROP POLICY IF EXISTS report_runs_update_own ON public.report_runs;
CREATE POLICY report_runs_select_own ON public.report_runs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY report_runs_insert_own ON public.report_runs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY report_runs_update_own ON public.report_runs
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON public.report_runs FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.report_runs TO authenticated;

DROP TRIGGER IF EXISTS report_runs_updated_at ON public.report_runs;
CREATE TRIGGER report_runs_updated_at
  BEFORE UPDATE ON public.report_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_report_run_owner_links()
RETURNS TRIGGER AS $$
DECLARE
  linked_run_id UUID;
  linked_report_id UUID;
BEGIN
  -- A trigger record only exposes columns from its own table. Read the
  -- optional link through JSON so this shared function is valid for both
  -- generated_reports and report_runs.
  IF TG_TABLE_NAME = 'generated_reports' THEN
    linked_run_id := NULLIF(to_jsonb(NEW)->>'report_run_id', '')::UUID;
    IF linked_run_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.report_runs
      WHERE id = linked_run_id AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'REPORT_RUN_OWNER_MISMATCH' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'report_runs' THEN
    linked_report_id := NULLIF(to_jsonb(NEW)->>'report_id', '')::UUID;
    IF linked_report_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.generated_reports
      WHERE id = linked_report_id AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'REPORT_OWNER_MISMATCH' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generated_reports_owner_link ON public.generated_reports;
CREATE TRIGGER generated_reports_owner_link
  BEFORE INSERT OR UPDATE OF user_id, report_run_id ON public.generated_reports
  FOR EACH ROW EXECUTE FUNCTION public.enforce_report_run_owner_links();
DROP TRIGGER IF EXISTS report_runs_owner_link ON public.report_runs;
CREATE TRIGGER report_runs_owner_link
  BEFORE INSERT OR UPDATE OF user_id, report_id ON public.report_runs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_report_run_owner_links();

-- AI prompts and response bodies are intentionally not stored. This ledger
-- keeps only operational metadata required for failure, performance and cost
-- analysis.
CREATE TABLE IF NOT EXISTS public.ai_request_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  report_run_id UUID REFERENCES public.report_runs(id) ON DELETE SET NULL,
  report_id UUID REFERENCES public.generated_reports(id) ON DELETE SET NULL,
  request_id TEXT NOT NULL,
  operation TEXT NOT NULL DEFAULT 'analysis',
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  total_tokens INTEGER NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  estimated_cost_usd NUMERIC(14, 8) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  duration_ms BIGINT NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  http_status INTEGER,
  error_code TEXT,
  data_version TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_request_logs_user_created
  ON public.ai_request_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_report_run
  ON public.ai_request_logs(report_run_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_status
  ON public.ai_request_logs(status, created_at DESC);

ALTER TABLE public.ai_request_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_request_logs_select_own ON public.ai_request_logs;
CREATE POLICY ai_request_logs_select_own ON public.ai_request_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE ALL ON public.ai_request_logs FROM anon, authenticated;
GRANT SELECT ON public.ai_request_logs TO authenticated;

ALTER TABLE public.report_exports
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS duration_ms BIGINT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_exports_idempotency
  ON public.report_exports(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_report_exports_status_created
  ON public.report_exports(status, created_at DESC);

ALTER TABLE public.report_exports
  DROP CONSTRAINT IF EXISTS report_exports_duration_check;
ALTER TABLE public.report_exports
  ADD CONSTRAINT report_exports_duration_check
  CHECK (duration_ms IS NULL OR duration_ms >= 0);

-- Authenticated clients may record local downloads, but only Edge Functions
-- (service role) can create queued jobs, request IDs, idempotency keys or
-- server performance metadata.
DROP POLICY IF EXISTS report_exports_insert_own ON public.report_exports;
CREATE POLICY report_exports_insert_own ON public.report_exports
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (report_id IS NULL OR EXISTS (
      SELECT 1 FROM public.generated_reports
      WHERE generated_reports.id = report_exports.report_id
        AND generated_reports.user_id = auth.uid()
    ))
    AND request_id IS NULL
    AND idempotency_key IS NULL
    AND duration_ms IS NULL
    AND metadata = '{}'::jsonb
    AND (
      status = 'failed'
      OR (
        status = 'completed'
        AND (
          format = 'md'
          OR (format = 'pdf' AND file_path LIKE 'local-print://%')
          OR (format = 'docx' AND file_path LIKE 'JAY观海_Report_%')
        )
      )
    )
  );

COMMIT;
