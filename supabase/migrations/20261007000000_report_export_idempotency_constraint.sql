-- PostgREST can infer ON CONFLICT (workspace_id, idempotency_key) only from a
-- full unique index/constraint. NULL idempotency keys remain non-conflicting
-- under PostgreSQL's default NULL semantics, so the predicate is unnecessary.

BEGIN;

DROP INDEX IF EXISTS public.idx_report_exports_workspace_idempotency;
CREATE UNIQUE INDEX idx_report_exports_workspace_idempotency
  ON public.report_exports(workspace_id, idempotency_key);

COMMIT;
