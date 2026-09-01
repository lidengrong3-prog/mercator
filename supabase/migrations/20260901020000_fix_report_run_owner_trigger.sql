BEGIN;

-- Repair the shared trigger function for databases that already applied the
-- production-hardening migration. NEW only has columns from the table that
-- fired the trigger, so optional links must be read without direct field
-- access.
CREATE OR REPLACE FUNCTION public.enforce_report_run_owner_links()
RETURNS TRIGGER AS $$
DECLARE
  linked_run_id UUID;
  linked_report_id UUID;
BEGIN
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

COMMIT;
