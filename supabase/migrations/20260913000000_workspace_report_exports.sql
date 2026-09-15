-- Shared report exports belong to the report workspace. The exporting user
-- remains on each row for audit and per-account billing usage.

BEGIN;

ALTER TABLE public.report_exports
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Attach historical exports to their report workspace first. Local exports
-- without a report use the exporting account's first active workspace.
UPDATE public.report_exports AS target
SET workspace_id = report.workspace_id
FROM public.generated_reports AS report
WHERE target.workspace_id IS NULL
  AND target.report_id = report.id
  AND report.workspace_id IS NOT NULL;

UPDATE public.report_exports AS target
SET workspace_id = (
  SELECT member.workspace_id
  FROM public.workspace_members AS member
  WHERE member.user_id = target.user_id
    AND member.status = 'active'
  ORDER BY (member.role = 'owner') DESC, member.joined_at ASC
  LIMIT 1
)
WHERE target.workspace_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.report_exports WHERE workspace_id IS NULL) THEN
    RAISE EXCEPTION 'report export workspace backfill failed: exporter has no active workspace';
  END IF;
END;
$$;

ALTER TABLE public.report_exports ALTER COLUMN workspace_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_report_exports_workspace_created
  ON public.report_exports(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_exports_workspace_report
  ON public.report_exports(workspace_id, report_id, created_at DESC);

DROP POLICY IF EXISTS report_exports_select_own ON public.report_exports;
CREATE POLICY report_exports_select_workspace ON public.report_exports
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS report_exports_insert_own ON public.report_exports;
CREATE POLICY report_exports_insert_workspace ON public.report_exports
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_edit_workspace(workspace_id)
    AND (report_id IS NULL OR EXISTS (
      SELECT 1
      FROM public.generated_reports
      WHERE generated_reports.id = report_exports.report_id
        AND generated_reports.workspace_id = report_exports.workspace_id
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

COMMENT ON COLUMN public.report_exports.workspace_id IS 'Workspace sharing boundary; user_id is the exporting account.';

COMMIT;
