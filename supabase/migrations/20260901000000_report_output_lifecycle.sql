-- Report output lifecycle, immutable input snapshots and export history.
-- This migration extends the existing generated_reports/report_exports tables
-- without changing the legacy columns used by older clients.

BEGIN;

ALTER TABLE public.generated_reports
  ADD COLUMN IF NOT EXISTS generation_status TEXT NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS save_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS template_version TEXT,
  ADD COLUMN IF NOT EXISTS data_version TEXT,
  ADD COLUMN IF NOT EXISTS quality_report_version TEXT,
  ADD COLUMN IF NOT EXISTS data_snapshot_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS material_snapshot_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_record_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scope_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.generated_reports
  DROP CONSTRAINT IF EXISTS generated_reports_generation_status_check;
ALTER TABLE public.generated_reports
  ADD CONSTRAINT generated_reports_generation_status_check
  CHECK (generation_status IN ('generating', 'completed', 'failed'));

ALTER TABLE public.generated_reports
  DROP CONSTRAINT IF EXISTS generated_reports_save_status_check;
ALTER TABLE public.generated_reports
  ADD CONSTRAINT generated_reports_save_status_check
  CHECK (save_status IN ('pending', 'saving', 'saved', 'failed'));

UPDATE public.generated_reports
SET save_status = 'saved', saved_at = COALESCE(updated_at, created_at)
WHERE save_status = 'pending' AND status = 'completed';

ALTER TABLE public.report_exports
  DROP CONSTRAINT IF EXISTS report_exports_format_check;
ALTER TABLE public.report_exports
  ADD CONSTRAINT report_exports_format_check
  CHECK (format IN ('pdf', 'docx', 'md'));

ALTER TABLE public.report_exports
  ADD COLUMN IF NOT EXISTS parent_export_id UUID REFERENCES public.report_exports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attempt INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_generated_reports_save_status
  ON public.generated_reports(user_id, save_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_exports_history
  ON public.report_exports(user_id, report_id, format, created_at DESC);

-- Local Markdown export events are also part of the history. The user_id must
-- match the authenticated user; clients never receive permission to update a
-- completed/failed record directly.
DROP POLICY IF EXISTS report_exports_insert_own ON public.report_exports;
CREATE POLICY report_exports_insert_own ON public.report_exports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
GRANT INSERT ON public.report_exports TO authenticated;

COMMIT;
