-- Historical backfill orchestration.
-- Jobs and batches are mutable operational state; source evidence and version
-- rows remain append-only in 20260918000000_permanent_history.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS public.history_backfill_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key TEXT NOT NULL UNIQUE,
  source_key TEXT NOT NULL REFERENCES public.data_source_registry(source_key) ON DELETE RESTRICT,
  domain TEXT NOT NULL CHECK (domain IN ('policy', 'tax', 'access', 'rule', 'alert', 'market', 'platform')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'paused', 'completed', 'partial', 'failed', 'cancelled')),
  requested_from DATE NOT NULL,
  requested_to DATE NOT NULL,
  covered_from DATE,
  covered_to DATE,
  cursor JSONB NOT NULL DEFAULT '{}'::jsonb,
  page INTEGER NOT NULL DEFAULT 1 CHECK (page > 0),
  batch_size INTEGER NOT NULL DEFAULT 100 CHECK (batch_size > 0),
  total_batches INTEGER NOT NULL DEFAULT 0 CHECK (total_batches >= 0),
  completed_batches INTEGER NOT NULL DEFAULT 0 CHECK (completed_batches >= 0),
  failed_batches INTEGER NOT NULL DEFAULT 0 CHECK (failed_batches >= 0),
  missing_ranges JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (requested_to >= requested_from),
  CHECK (covered_to IS NULL OR covered_from IS NULL OR covered_to >= covered_from)
);

CREATE TABLE IF NOT EXISTS public.history_backfill_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.history_backfill_jobs(id) ON DELETE CASCADE,
  batch_key TEXT NOT NULL,
  source_key TEXT NOT NULL REFERENCES public.data_source_registry(source_key) ON DELETE RESTRICT,
  domain TEXT NOT NULL CHECK (domain IN ('policy', 'tax', 'access', 'rule', 'alert', 'market', 'platform')),
  window_from DATE NOT NULL,
  window_to DATE NOT NULL,
  cursor_before JSONB NOT NULL DEFAULT '{}'::jsonb,
  cursor_after JSONB NOT NULL DEFAULT '{}'::jsonb,
  page_number INTEGER NOT NULL DEFAULT 1 CHECK (page_number > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'skipped')),
  records_seen INTEGER NOT NULL DEFAULT 0 CHECK (records_seen >= 0),
  records_accepted INTEGER NOT NULL DEFAULT 0 CHECK (records_accepted >= 0),
  records_rejected INTEGER NOT NULL DEFAULT 0 CHECK (records_rejected >= 0),
  records_published INTEGER NOT NULL DEFAULT 0 CHECK (records_published >= 0),
  validation_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, batch_key),
  CHECK (window_to >= window_from)
);

CREATE TABLE IF NOT EXISTS public.history_backfill_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.history_backfill_jobs(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.history_backfill_batches(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL REFERENCES public.data_source_registry(source_key) ON DELETE RESTRICT,
  checkpoint_key TEXT NOT NULL,
  cursor JSONB NOT NULL DEFAULT '{}'::jsonb,
  page INTEGER NOT NULL DEFAULT 1 CHECK (page > 0),
  last_record_id TEXT,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  estimated_cost NUMERIC NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
  checkpoint_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (job_id, checkpoint_key)
);

CREATE TABLE IF NOT EXISTS public.history_source_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL REFERENCES public.data_source_registry(source_key) ON DELETE RESTRICT,
  domain TEXT NOT NULL CHECK (domain IN ('policy', 'tax', 'access', 'rule', 'alert', 'market', 'platform')),
  market_code TEXT,
  platform_key TEXT,
  covered_from DATE,
  covered_to DATE,
  last_successful_batch_at TIMESTAMPTZ,
  records_count BIGINT NOT NULL DEFAULT 0 CHECK (records_count >= 0),
  source_cursor JSONB NOT NULL DEFAULT '{}'::jsonb,
  coverage_status TEXT NOT NULL DEFAULT 'partial'
    CHECK (coverage_status IN ('complete', 'partial', 'missing', 'unknown', 'stale')),
  missing_ranges JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (covered_to IS NULL OR covered_from IS NULL OR covered_to >= covered_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_history_source_coverage_identity
  ON public.history_source_coverage(
    source_key, domain, COALESCE(market_code, ''), COALESCE(platform_key, '')
  );
CREATE INDEX IF NOT EXISTS idx_history_backfill_jobs_status
  ON public.history_backfill_jobs(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_backfill_batches_timeline
  ON public.history_backfill_batches(job_id, window_from, window_to, page_number);
CREATE INDEX IF NOT EXISTS idx_history_backfill_checkpoints_source
  ON public.history_backfill_checkpoints(source_key, checkpoint_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_source_coverage_lookup
  ON public.history_source_coverage(source_key, domain, covered_from, covered_to);

CREATE OR REPLACE VIEW public.history_backfill_job_progress AS
SELECT
  job.id,
  job.job_key,
  job.source_key,
  job.domain,
  job.status,
  job.requested_from,
  job.requested_to,
  job.covered_from,
  job.covered_to,
  job.total_batches,
  job.completed_batches,
  job.failed_batches,
  CASE WHEN job.total_batches = 0 THEN 0
       ELSE ROUND((job.completed_batches::NUMERIC / job.total_batches::NUMERIC) * 100, 2)
  END AS completion_percent,
  job.missing_ranges,
  job.last_error,
  job.started_at,
  job.completed_at,
  job.updated_at
FROM public.history_backfill_jobs AS job;

CREATE OR REPLACE VIEW public.history_source_coverage_overview AS
SELECT
  coverage.source_key,
  coverage.domain,
  coverage.market_code,
  coverage.platform_key,
  coverage.covered_from,
  coverage.covered_to,
  coverage.coverage_status,
  coverage.records_count,
  coverage.last_successful_batch_at,
  coverage.missing_ranges,
  coverage.source_cursor,
  coverage.updated_at
FROM public.history_source_coverage AS coverage;

ALTER TABLE public.history_backfill_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history_backfill_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history_backfill_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history_source_coverage ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.history_backfill_jobs, public.history_backfill_batches,
  public.history_backfill_checkpoints, public.history_source_coverage
  FROM anon, authenticated;
GRANT ALL ON public.history_backfill_jobs, public.history_backfill_batches,
  public.history_backfill_checkpoints, public.history_source_coverage TO service_role;
GRANT SELECT ON public.history_backfill_job_progress,
  public.history_source_coverage_overview TO service_role;

COMMENT ON TABLE public.history_backfill_jobs IS
  '可恢复的历史回填任务；requested/covered/missing 区间用于审计覆盖范围。';
COMMENT ON TABLE public.history_backfill_batches IS
  '每个时间窗口和分页游标独立验收、发布和失败，不会回滚其它批次。';
COMMENT ON TABLE public.history_backfill_checkpoints IS
  '回填断点；保存游标和页码，恢复时避免重复请求和重复计费。';
COMMENT ON TABLE public.history_source_coverage IS
  '来源历史覆盖台账，供管理后台按来源查看覆盖范围与缺失区间。';

COMMIT;
