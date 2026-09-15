const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('notification acceptance migration requires all provider and isolation evidence', () => {
  const sql = read('supabase', 'migrations', '20260930000000_notification_live_acceptance.sql');
  for (const table of ['notification_delivery_attempts', 'notification_live_acceptance_runs', 'notification_live_acceptance_evidence']) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
  }
  for (const channel of ['email', 'wecom', 'feishu']) {
    for (const scenario of ['sent', 'failed', 'retry', 'disabled']) {
      assert.match(sql, new RegExp(`'${channel}','${scenario}'`));
    }
  }
  assert.match(sql, /'system','configuration'/);
  assert.match(sql, /'system','deduplication'/);
  assert.match(sql, /'system','workspace_isolation'/);
  assert.match(sql, /p_acceptance_run_id UUID DEFAULT NULL/);
  assert.match(sql, /event\.payload->>'acceptance_run_id' = p_acceptance_run_id::TEXT/);
  assert.match(sql, /FOR UPDATE OF delivery SKIP LOCKED/);
  assert.match(sql, /NOTIFICATION_ATTEMPTS_ARE_IMMUTABLE/);
});
test('dispatcher keeps public and acceptance delivery modes mutually exclusive and scoped', () => {
  const edge = read('supabase', 'functions', 'notification-dispatch', 'index.ts');
  assert.match(edge, /NOTIFICATION_LIVE_ACCEPTANCE_MODE/);
  assert.match(edge, /NOTIFICATION_ACCEPTANCE_WORKSPACE_ID/);
  assert.match(edge, /NOTIFICATION_ACCEPTANCE_RUN_ID/);
  assert.match(edge, /NOTIFICATION_MODES_CONFLICT/);
  assert.match(edge, /workspaceDeliveryEnabled\(context\.event\.workspace_id, acceptanceRunId\)/);
  assert.match(edge, /rpc\/claim_notification_deliveries_scoped/);
  assert.match(edge, /p_acceptance_run_id: acceptanceRunId \|\| null/);
  assert.match(edge, /notification_delivery_attempts\?on_conflict=delivery_id,attempt_no/);
  assert.match(edge, /controlled_invalid_target: true/);
  assert.match(edge, /NOTIFICATION_CHANNEL_MUST_BE_DISABLED/);
  assert.doesNotMatch(edge, /body:\s*context\.event\.body[\s\S]*notification_delivery_attempts/);
});

test('deployment validates live evidence and independent sender before public notifications', () => {
  const deploy = read('.github', 'workflows', 'deploy-production.yml');
  const workflow = read('.github', 'workflows', 'notification-live-acceptance.yml');
  const script = read('scripts', 'notification_live_acceptance.py');
  assert.match(deploy, /Disable notification acceptance mode before public notifications/);
  assert.match(deploy, /notification_live_acceptance\.py validate --run-id/);
  assert.match(deploy, /Notification and workspace invitation senders must be independent/);
  assert.match(workflow, /options: \[start, status, probe, configuration, deduplication, isolation, finalize\]/);
  assert.match(script, /current provider\/sender\/encryption configuration differs from accepted evidence/);
  assert.match(script, /foreign workspace notification config was not denied/);
  assert.doesNotMatch(workflow, /SUPABASE_SERVICE_ROLE_KEY:\s*\$\{\{\s*secrets\./);
});
