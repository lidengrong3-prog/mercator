-- Formal reports are immutable client-side and can only be written by the
-- report-save Edge Function after recomputing scope, coverage and citations.

BEGIN;

ALTER TABLE public.generated_reports
  ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS server_validation_version TEXT,
  ADD COLUMN IF NOT EXISTS server_validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS server_validation JSONB;

ALTER TABLE public.generated_reports
  DROP CONSTRAINT IF EXISTS generated_reports_publication_status_check;
ALTER TABLE public.generated_reports
  ADD CONSTRAINT generated_reports_publication_status_check
  CHECK (publication_status IN ('draft', 'formal', 'revoked'));

CREATE INDEX IF NOT EXISTS idx_generated_reports_publication_status
  ON public.generated_reports(user_id, publication_status, server_validated_at DESC);

ALTER TABLE public.report_materials
  DROP CONSTRAINT IF EXISTS report_materials_material_type_check;
ALTER TABLE public.report_materials
  ADD CONSTRAINT report_materials_material_type_check
  CHECK (material_type IN ('country', 'platform', 'product', 'policy', 'rule', 'alert', 'macro', 'shop', 'content', 'custom'));

UPDATE public.report_materials
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
  'source_kind', 'uploaded',
  'source_type', 'user_upload',
  'verification_status', 'uploaded',
  'verification_notes', '账号素材快照；不自动等同于官方核验来源'
)
WHERE COALESCE(metadata->>'verification_status', '') <> 'uploaded'
   OR COALESCE(metadata->>'source_kind', '') <> 'uploaded';

UPDATE public.report_materials
SET material_type = 'content'
WHERE material_type = 'custom' AND snapshot_type = 'content';

DROP POLICY IF EXISTS reports_insert_own ON public.generated_reports;
DROP POLICY IF EXISTS reports_update_own ON public.generated_reports;
DROP POLICY IF EXISTS generated_reports_insert_own ON public.generated_reports;
DROP POLICY IF EXISTS generated_reports_update_own ON public.generated_reports;
DROP POLICY IF EXISTS generated_reports_insert_draft_own ON public.generated_reports;
DROP POLICY IF EXISTS generated_reports_update_draft_own ON public.generated_reports;

-- Authenticated browser clients may keep non-formal drafts. A formal row is
-- created with the service role by report-save and cannot be changed back
-- into an editable draft to bypass server validation.
CREATE POLICY generated_reports_insert_draft_own ON public.generated_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND publication_status = 'draft'
    AND save_status <> 'saved'
    AND server_validation_version IS NULL
    AND server_validated_at IS NULL
    AND server_validation IS NULL
    AND COALESCE(content->'publishable', 'false'::jsonb) <> 'true'::jsonb
  );

CREATE POLICY generated_reports_update_draft_own ON public.generated_reports
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND publication_status = 'draft'
    AND save_status <> 'saved'
    AND server_validation_version IS NULL
    AND server_validated_at IS NULL
    AND server_validation IS NULL
    AND COALESCE(content->'publishable', 'false'::jsonb) <> 'true'::jsonb
  )
  WITH CHECK (
    auth.uid() = user_id
    AND publication_status = 'draft'
    AND save_status <> 'saved'
    AND server_validation_version IS NULL
    AND server_validated_at IS NULL
    AND server_validation IS NULL
    AND COALESCE(content->'publishable', 'false'::jsonb) <> 'true'::jsonb
  );

COMMENT ON COLUMN public.generated_reports.publication_status IS
  'draft is client-writable; formal requires report-save server validation; revoked is retained for audit.';
COMMENT ON COLUMN public.generated_reports.server_validation IS
  'Fail-closed report validation result recorded by the report-save Edge Function.';

COMMIT;
