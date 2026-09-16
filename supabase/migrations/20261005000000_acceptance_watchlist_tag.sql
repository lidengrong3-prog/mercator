BEGIN;

ALTER TABLE public.user_watchlist
  ADD COLUMN IF NOT EXISTS acceptance_run_id TEXT;

CREATE INDEX IF NOT EXISTS idx_user_watchlist_acceptance_run
  ON public.user_watchlist(acceptance_run_id)
  WHERE acceptance_run_id IS NOT NULL;

COMMIT;
