-- Production exception acceptance requires export idempotency to hold under
-- truly concurrent requests. A full unique index lets PostgREST use
-- ON CONFLICT (user_id, idempotency_key); PostgreSQL still permits multiple
-- legacy NULL keys.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_exports_user_idempotency_complete
  ON public.report_exports(user_id, idempotency_key);

COMMIT;
