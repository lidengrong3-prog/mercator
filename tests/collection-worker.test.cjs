const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const worker = fs.readFileSync(path.join(root, 'scripts', 'collection_worker.py'), 'utf8');
const enqueue = fs.readFileSync(path.join(root, 'scripts', 'enqueue_collection_tasks.py'), 'utf8');
const publish = fs.readFileSync(path.join(root, 'scripts', 'publish_collection.py'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260920000000_collection_worker.sql'), 'utf8');
const dataWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'data-update.yml'), 'utf8');
const healthWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'collection-health.yml'), 'utf8');
const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile.worker'), 'utf8');
const entrypoint = fs.readFileSync(path.join(root, 'deploy', 'worker-entrypoint.sh'), 'utf8');
const runtimeMigration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20261002000000_collection_worker_runtime.sql'), 'utf8');

test('worker has queue lifecycle, lease renewal, retry, budget and allowlist contracts', () => {
  for (const fragment of [
    'claim_collection_task', 'renew_collection_task_lease', 'complete_collection_task',
    'fail_collection_task', 'reserve_collection_budget', 'record_collection_source_outcome',
    'collection:{task_id}:{attempt_number}', 'COLLECTOR_SCRIPTS', 'subprocess.run',
    'backoff_base_seconds', 'blocks_publication_on_failure', 'collection_task_attempts',
    'successful_attempt', 'recovered_after_restart', 'publish_formal',
  ]) assert.match(worker, new RegExp(fragment.replace(/[{}]/g, '\\$&')));
  assert.match(worker, /不会执行数据库中任意的 shell 命令/);
});

test('scheduled cutover preserves the legacy collector until a Worker is healthy', () => {
  assert.match(enqueue, /TASK_SPECS/);
  assert.match(enqueue, /depends_on_task_keys/);
  assert.match(enqueue, /collection_tasks/);
  assert.match(dataWorkflow, /schedule:/);
  assert.match(dataWorkflow, /workflow_dispatch:/);
  assert.match(dataWorkflow, /enqueue_collection_tasks\.py/);
  assert.match(dataWorkflow, /COLLECTION_WORKER_CUTOVER/);
  assert.match(dataWorkflow, /active_workers/);
  assert.match(dataWorkflow, /legacy-update-data:/);
  assert.match(dataWorkflow, /needs\.route\.outputs\.mode == 'legacy'/);
  assert.match(healthWorkflow, /collection_worker\.py --health-check/);
  assert.match(healthWorkflow, /upload-artifact@v4/);
  assert.match(publish, /validate_data\.py/);
  assert.match(publish, /sync_to_supabase\.py/);
  assert.match(publish, /translate_regulatory_data\.py/);
  assert.match(publish, /REGULATORY_TRANSLATION_PROVIDER/);
  assert.match(publish, /\("--provider", "argos"\)/);
  assert.match(publish, /generate_alerts\.py/);
});

test('production Worker image restores private state and advertises runtime presence', () => {
  assert.match(dockerfile, /playwright install --with-deps chromium/);
  assert.match(dockerfile, /VOLUME \["\/app\/data"\]/);
  assert.match(entrypoint, /bootstrap_worker_data\.py --required/);
  assert.match(worker, /heartbeat_collection_worker/);
  assert.match(worker, /worker_heartbeat_failed/);
  assert.match(runtimeMigration, /CREATE TABLE IF NOT EXISTS public\.collection_worker_instances/);
  assert.match(runtimeMigration, /'active_workers'/);
  assert.match(runtimeMigration, /INTERVAL '2 minutes'/);
  assert.match(runtimeMigration, /REVOKE ALL ON public\.collection_worker_instances FROM PUBLIC, anon, authenticated/);
});

test('worker migration includes per-source limits, leases, budgets and service-only grants', () => {
  for (const fragment of [
    'max_concurrency', 'timeout_seconds', 'backoff_max_seconds', 'circuit_window_seconds',
    'daily_request_limit', 'daily_cost_limit_usd', 'lease_expires_at', 'depends_on_task_keys', 'FOR UPDATE SKIP LOCKED',
    "'tikhub'", 'last_failure_at', 'GRANT EXECUTE ON FUNCTION public.claim_collection_task',
  ]) assert.match(migration, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
