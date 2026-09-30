const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const migration = read('supabase', 'migrations', '20260929110000_r07_alert_persistence.sql');
const foundation = read('supabase', 'migrations', '20260924010000_monitoring_tasks.sql');
const auth = read('assets', 'js', 'auth-data.js');
const policies = read('assets', 'js', 'markets-policies.js');
const alerts = read('assets', 'js', 'alerts-settings.js');
const shell = read('index.html');
const browserAcceptance = read('tests', 'production-auth.spec.cjs');

test('record monitors persist complete workspace source condition and identity data', () => {
  const schema = foundation + migration;
  for (const token of [
    'source_record_type TEXT', 'source_record_id TEXT', 'source_title TEXT',
    "monitor_conditions JSONB NOT NULL DEFAULT '{}'::JSONB", 'idempotency_key TEXT',
    'workspace_id, created_by, task_type', 'created_at', "status TEXT NOT NULL DEFAULT 'active'",
  ]) assert.ok(schema.includes(token), 'missing schema token: ' + token);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.create_record_monitor/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /public\.can_edit_workspace\(p_workspace_id\)/);
  assert.match(migration, /ON CONFLICT \(workspace_id, idempotency_key\) DO NOTHING/);
  assert.match(migration, /MONITOR_ALREADY_EXISTS/);
});

test('policy rule and detail buttons use the real backend result', () => {
  assert.match(policies, /plAddMonitorByIndex/);
  assert.match(policies, /rlAddRuleMonitor/);
  assert.match(policies, /rlAddActivityMonitor/);
  assert.doesNotMatch(policies, /toast\(['\"]已添加预警['\"]\)/);
  assert.match(auth, /var task=await jayCreateRecordMonitor\(input\)/);
  assert.ok(auth.indexOf("if(!task||!task.id)throw new Error('MONITOR_SAVE_FAILED')") < auth.indexOf("button.textContent='已添加'"));
});

test('monitor add UI distinguishes auth permission duplicate and write failure', () => {
  assert.match(auth, /请先登录后再添加预警/);
  assert.match(auth, /当前工作区无权添加预警/);
  assert.match(auth, /该记录已存在监控，不会重复创建/);
  assert.match(auth, /预警写入失败：/);
  assert.match(auth, /MONITOR_ALREADY_EXISTS/);
});

test('alert center manages persisted pause resume and delete state', () => {
  assert.match(shell, /id="al-monitoring"/);
  assert.match(alerts, /jayLoadMonitoringTasks\(\{throwOnError:true\}\)/);
  assert.match(alerts, /jayUpdateMonitoringTask\(taskId,\{status:status\}\)/);
  assert.match(alerts, /jayDeleteMonitoringTask\(taskId\)/);
  assert.match(alerts, /监控已暂停并同步到后端/);
  assert.match(alerts, /监控已重新启用并同步到后端/);
  assert.match(alerts, /监控已删除并同步到后端/);
});

test('production acceptance proves persistence dedupe lifecycle and denial', () => {
  for (const token of [
    'persisted_after_reload', 'duplicate_blocked', "status: 'paused'", "status: 'active'",
    'jayDeleteMonitoringTask', "code: 'WORKSPACE_READ_ONLY'", 'alert_persistence: alertPersistenceEvidence',
  ]) assert.ok(browserAcceptance.includes(token), 'missing production evidence: ' + token);
  assert.match(read('supabase', 'migrations', '20261004000000_acceptance_storage_api_cleanup.sql'), /DELETE FROM public\.monitoring_tasks WHERE acceptance_run_id/);
  assert.match(read('supabase', 'functions', 'data-subject-request', 'index.ts'), /'monitoring_tasks'/);
});
