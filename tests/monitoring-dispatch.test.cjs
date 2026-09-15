const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260924020000_monitoring_dispatch.sql'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'scripts', 'collection_worker.py'), 'utf8');

test('monitoring intents are atomically dispatched into scoped worker tasks', () => {
  for (const fragment of [
    'dispatch_due_monitoring_tasks', 'FOR UPDATE SKIP LOCKED', "collector_key := 'tikhub_monitor'",
    "market.data_status = 'configured'", "relation.data_status = 'configured'",
    'last_collection_task_key', 'next_run_at', 'record_monitoring_task_result',
    'GRANT EXECUTE ON FUNCTION public.dispatch_due_monitoring_tasks',
  ]) assert.match(migration, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(worker, /"tikhub_monitor":\s*"collect_tikhub_pilot\.py"/);
  assert.match(worker, /record_monitoring_task_result/);
  assert.match(worker, /dispatch_due_monitoring_tasks/);
});

test('monitoring tasks cannot carry provider keys or arbitrary commands', () => {
  assert.doesNotMatch(migration, /api[_-]?key/i);
  assert.doesNotMatch(worker, /parameters.*api-key|--api-key/);
  assert.doesNotMatch(migration, /\bcommand\b|\bshell\b/i);
});

test('monitoring budgets use canonical underscored fields and target-specific request counts', () => {
  assert.match(migration, /'request_count', CASE WHEN item\.task_type = 'keyword' THEN 4 ELSE 2 END/);
  assert.match(migration, /'estimated_cost_usd'/);
  assert.match(worker, /parameters\.get\("request_count", parameters\.get\("request-count"\)\)/);
});
