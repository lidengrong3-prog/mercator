const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260919000000_history_backfill.sql'), 'utf8');
const script = fs.readFileSync(path.join(root, 'scripts', 'backfill_history.py'), 'utf8');
const cpsc = fs.readFileSync(path.join(root, 'scripts', 'collect_cpsc.py'), 'utf8');

test('backfill migration persists resumable jobs, batches, checkpoints and coverage', () => {
  for (const table of ['history_backfill_jobs', 'history_backfill_batches', 'history_backfill_checkpoints', 'history_source_coverage']) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\b`));
  }
  assert.match(migration, /UNIQUE \(job_id, batch_key\)/);
  assert.match(migration, /UNIQUE \(job_id, checkpoint_key\)/);
  assert.match(migration, /missing_ranges JSONB/);
  assert.match(migration, /history_backfill_job_progress/);
  assert.match(migration, /history_source_coverage_overview/);
  assert.match(migration, /REVOKE ALL ON public\.history_backfill_jobs/);
});

test('backfill script has source windows, pagination, independent batches and dry-run', () => {
  for (const fragment of [
    'build_windows', 'filter[publication_date][gte]', 'next_page_url',
    'RecallDateStart', 'RecallDateEnd', 'history_backfill_batches',
    'history_backfill_checkpoints', 'dry_run', 'merge_missing_ranges',
  ]) {
    assert.match(script, new RegExp(fragment.replace(/[\[\]]/g, '\\$&')));
  }
  assert.match(cpsc, /def fetch_cpsc_recalls\(days=120, start_date=None, end_date=None, page=1, per_page=None\)/);
  assert.match(cpsc, /revision_history/);
});
