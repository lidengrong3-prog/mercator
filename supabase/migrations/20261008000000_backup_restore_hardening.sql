-- Allow trusted recovery automation to register completed backups and drills.

BEGIN;

GRANT SELECT, INSERT ON public.backup_runs TO service_role;
GRANT SELECT, INSERT ON public.backup_restore_drills TO service_role;

COMMENT ON TABLE public.backup_restore_drills IS
  'Auditable isolated restore results. Payloads and database credentials are never stored.';

COMMIT;
