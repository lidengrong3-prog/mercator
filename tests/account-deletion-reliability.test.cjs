const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const migration = read('supabase/migrations/20260930130000_r09_account_deletion_jobs.sql');
const workspaceCascadeFix = read('supabase/migrations/20260930180000_r09_workspace_owner_cascade_fix.sql');
const requestFunction = read('supabase/functions/data-subject-request/index.ts');
const worker = read('supabase/functions/data-deletion-worker/index.ts');
const aiProxy = read('supabase/functions/ai-proxy/index.ts');
const frontend = read('assets/js/product-enhancements.js');
const authData = read('assets/js/auth-data.js');
const workflow = read('.github/workflows/async-reliability.yml');
const deploymentWorkflow = read('.github/workflows/deploy-production.yml');

test('deletion requests enqueue durable leased jobs and return 202', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.data_deletion_jobs/);
  assert.match(migration, /lease_expires_at TIMESTAMPTZ/);
  assert.match(migration, /FOR UPDATE SKIP LOCKED/);
  assert.match(migration, /r09_enqueue_data_deletion_job/);
  assert.match(requestFunction, /r09_enqueue_data_deletion_job/);
  assert.match(requestFunction, /triggerWorker\(url, serviceKey\)/);
  assert.match(requestFunction, /}, 202, origin\)/);
  assert.doesNotMatch(requestFunction, /async function deleteAccount/);
  assert.doesNotMatch(requestFunction, /async function deleteWorkspace/);
});

test('large deletions use bounded batches, cursors and auth-last ordering', () => {
  assert.match(migration, /batch_size INTEGER NOT NULL DEFAULT 250/);
  assert.match(migration, /SELECT ctid FROM %s WHERE %I = \$1 LIMIT \$2/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.r09_list_storage_batch/);
  assert.match(migration, /storage\.objects/);
  assert.match(worker, /p_after: String\(cursor\.after \|\| ''\)/);
  const profileStep = migration.indexOf("'db_profiles'");
  const authStep = migration.lastIndexOf("'auth_user', 'auth_user'");
  assert.ok(profileStep > 0 && authStep > profileStep, 'Auth deletion must be the final account step');
  assert.match(workspaceCascadeFix, /job.job_type = 'delete_workspace'[\s\S]*step.step_key = 'db_workspace_members'/);
  assert.match(workspaceCascadeFix, /workspace_members_removed_by_workspace_cascade/);
});

test('expired leases recover and terminal failures cannot remain processing', () => {
  assert.match(migration, /DELETION_WORKER_LEASE_EXPIRED/);
  assert.match(migration, /status = CASE WHEN attempt_count >= max_attempts OR expires_at <= NOW\(\) THEN 'failed' ELSE 'retry_wait' END/);
  assert.match(migration, /r09_record_deletion_failure/);
  assert.match(worker, /p_retryable: retryable/);
  assert.match(workflow, /cron: '\*\/5 \* \* \* \*'/);
  assert.match(workflow, /data-deletion-worker/);
  assert.match(deploymentWorkflow, /Edge Function deploy failed after \$attempt attempts/);
  assert.match(worker, /DATA_DELETION_WORKER_KEY/);
  assert.match(worker, /ACCEPTANCE_HMAC_SECRET/);
  assert.match(deploymentWorkflow, /DATA_DELETION_WORKER_KEY=\$SUPABASE_SERVICE_KEY/);
});

test('browser acceptance reruns recover the original backend acceptance id', () => {
  assert.match(deploymentWorkflow, /artifact_run_id=.*production-acceptance-result\.json/);
  assert.match(deploymentWorkflow, /echo "ACCEPTANCE_RUN_ID=\$artifact_run_id" >> "\$GITHUB_ENV"/);
});

test('Coze and report async work have TTL failure and retry contracts', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.ai_async_tasks/);
  assert.match(migration, /REPORT_TASK_TTL_EXPIRED/);
  assert.match(migration, /AI_TASK_TTL_EXPIRED/);
  assert.match(migration, /finalize_workspace_ai_token_reservation/);
  assert.match(aiProxy, /startAiAsyncTask/);
  assert.match(aiProxy, /finishAiAsyncTask\('failed', lastErrorCode\)/);
  assert.match(aiProxy, /finishAiAsyncTask\('completed'\)/);
  assert.match(authData, /retry_of:previous\.id/);
  assert.match(migration, /expires_at SET DEFAULT \(NOW\(\) \+ INTERVAL '30 minutes'\)/);
});

test('frontend never treats enqueue as completed and reuses idempotency state', () => {
  assert.match(frontend, /删除任务后台处理中/);
  assert.match(frontend, /localStorage\.getItem\(key\)/);
  assert.match(frontend, /idempotency_key:idem/);
  assert.doesNotMatch(frontend, /账号删除已完成，请退出登录/);
});
