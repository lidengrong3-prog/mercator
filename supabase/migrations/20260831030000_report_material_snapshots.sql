-- Auditable snapshots for product, shop and content report materials.
-- The full source envelope remains in snapshot_data; these columns make the
-- most common traceability filters queryable without parsing JSON.

BEGIN;

ALTER TABLE public.report_materials
  ADD COLUMN IF NOT EXISTS snapshot_type TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_data JSONB,
  ADD COLUMN IF NOT EXISTS snapshot_source TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS snapshot_market TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_platform TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_category TEXT;

CREATE INDEX IF NOT EXISTS idx_report_materials_snapshot_scope
  ON public.report_materials(user_id, snapshot_market, snapshot_platform, snapshot_at DESC);

COMMIT;
