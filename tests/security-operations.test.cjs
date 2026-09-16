const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('security migration contains atomic limits, recovery and data-subject records', () => {
  const sql = read('supabase/migrations/20260916000000_security_operations.sql');
  for (const fragment of [
    'security_rate_limits', 'consume_security_rate_limit', 'security_alert_rules',
    'service_health_snapshots', 'backup_restore_drills', 'data_subject_requests',
    'collect_service_capacity', 'GRANT EXECUTE ON FUNCTION public.consume_security_rate_limit',
  ]) assert.match(sql, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(sql, /raw IPs are never stored/i);
});

test('shared security layer covers user and IP dimensions and emits 429', () => {
  const source = read('supabase/functions/_shared/security.ts');
  assert.match(source, /security:\$\{options\.scope\}:user/);
  assert.match(source, /security:\$\{options\.scope\}:ip/);
  assert.match(source, /\}, 429,/);
  assert.match(source, /Retry-After/);
});

test('backup and restore workflows are scheduled and publish only summaries', () => {
  const backup = read('.github/workflows/encrypted-backup.yml');
  const restore = read('.github/workflows/restore-drill.yml');
  assert.match(backup, /cron:/);
  assert.match(backup, /BACKUP_ENCRYPTION_KEY/);
  assert.match(backup, /create_migration_backup\.py/);
  assert.match(backup, /install_postgresql_client\.sh SUPABASE_DB_URL/);
  assert.match(backup, /--kind storage_backup/);
  assert.match(backup, /\*-summary\.json/);
  assert.match(restore, /RESTORE_DRILL_DB_URL/);
  assert.match(restore, /restore_backup_drill\.py/);
  assert.match(restore, /install_postgresql_client\.sh RESTORE_DRILL_DB_URL/);
  assert.match(restore, /cron: '41 3 1 \* \*'/);
});

test('production configuration audit keeps launch gates closed and checks two accounts', () => {
  const workflow = read('.github/workflows/production-readiness.yml');
  const audit = read('scripts/audit_production_configuration.py');
  for (const value of [
    'BILLING_ENABLED=false', 'BILLING_LIVE_ACCEPTANCE_MODE=false',
    'NOTIFICATION_CHANNELS_ENABLED=false', 'NOTIFICATION_LIVE_ACCEPTANCE_MODE=false',
    'STRIPE_ALLOW_TEST_EVENTS=false',
  ]) assert.match(workflow, new RegExp(value));
  assert.match(workflow, /inputs\.action == 'config-audit'/);
  assert.match(audit, /ACCEPTANCE_ACCOUNTS_NOT_DISTINCT/);
  assert.match(audit, /allowed_origin_preflight/);
  assert.match(audit, /billing_disabled_runtime/);
  assert.match(audit, /notifications_disabled_runtime/);
  assert.match(audit, /runtime_failures/);
  assert.doesNotMatch(audit, /\["access_token"\].*print/);
});

test('data-subject endpoint enforces ownership and does not expose raw private tables', () => {
  const source = read('supabase/functions/data-subject-request/index.ts');
  assert.match(source, /data_subject_request/);
  assert.match(source, /ACCOUNT_DELETE_REQUIRES_WORKSPACE_TRANSFER/);
  assert.match(source, /WORKSPACE_ADMIN_REQUIRED/);
  assert.doesNotMatch(source, /private_data_artifacts/);
  assert.match(read('supabase/config.toml'), /\[functions\.data-subject-request\][\s\S]*verify_jwt = true/);
  assert.match(read('supabase/functions/security-gate/index.ts'), /\['search', 'upload'\]/);
  assert.match(read('assets/js/products-shops.js'), /jaySecurityGate\('upload'\)/);
  const historySearch = read('supabase/functions/history-search/index.ts');
  assert.match(historySearch, /enforceRateLimit/);
  assert.match(historySearch, /scope: 'search'/);
});

test('public legal copy explains AI use, third-party licensing, retention and deletion', () => {
  const html = read('index.html');
  for (const phrase of ['不会把你的提示词', '保存期限', 'TikHub', '导出自己的账号数据', '删除整个工作区数据', '安全事件']) {
    assert.match(html, new RegExp(phrase));
  }
});
