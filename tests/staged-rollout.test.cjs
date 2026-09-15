const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('rollout migration enforces sequential stages, registration gates and 14-day stability', () => {
  const sql = read('supabase', 'migrations', '20261001000000_staged_public_rollout.sql');
  for (const table of ['production_rollout_state', 'production_readiness_runs', 'production_readiness_evidence', 'production_load_test_runs', 'rollout_ai_daily_usage']) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
  }
  assert.match(sql, /state\.stage = 'internal' AND p_target_stage = 'invite_beta'/);
  assert.match(sql, /state\.stage = 'invite_beta' AND p_target_stage = 'public_beta'/);
  assert.match(sql, /state\.stage = 'public_beta' AND p_target_stage = 'general'/);
  assert.match(sql, /NOW\(\) - INTERVAL '14 days'/);
  assert.match(sql, /incident_priority IN \('P0','P1'\)/);
  assert.match(sql, /REGISTRATION_INTERNAL_ONLY/);
  assert.match(sql, /REGISTRATION_INVITE_REQUIRED/);
  assert.match(sql, /REGISTRATION_CAP_REACHED/);
  assert.match(sql, /INVITE_BETA_REGISTRATION_LIMIT_INVALID/);
  assert.match(sql, /'billing_ready','notification_ready','support_ready','oncall_ready'/);
  assert.match(sql, /ROLLOUT_BILLING_ACCEPTANCE_REQUIRED/);
  assert.match(sql, /ROLLOUT_NOTIFICATION_ACCEPTANCE_REQUIRED/);
});

test('public beta AI limit is atomic, releases expiry and is wired before provider calls', () => {
  const sql = read('supabase', 'migrations', '20261001000000_staged_public_rollout.sql');
  const edge = read('supabase', 'functions', 'ai-proxy', 'index.ts');
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /released_tokens BIGINT := 0/);
  assert.match(sql, /reserved_tokens = GREATEST\(0, reserved_tokens - released_tokens\)/);
  assert.match(sql, /existing\.status = 'reserved'/);
  assert.match(edge, /rpc\/reserve_rollout_ai_daily_quota/);
  assert.match(edge, /AI_DAILY_LIMIT_REACHED/);
  assert.match(edge, /rpc\/finalize_rollout_ai_daily_quota/);
  assert.ok(edge.indexOf('reserve_rollout_ai_daily_quota') < edge.indexOf('async function invokeProvider'));
});

test('load tool has fixed profiles and a separate 1000-user approval gate', () => {
  const load = read('scripts', 'production_load_acceptance.mjs');
  const workflow = read('.github', 'workflows', 'production-readiness.yml');
  assert.match(load, /\[100, 500, 1000\]\.includes\(virtualUsers\)/);
  assert.match(load, /1000-user test requires --confirm-production-window/);
  assert.match(load, /p50_ms:/);
  assert.match(load, /p95_ms:/);
  assert.match(load, /p99_ms:/);
  assert.match(load, /search_p95_ms:/);
  assert.doesNotMatch(load, /ai-proxy/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /confirm_production_window/);
});

test('upload gate rejects oversized, active and disguised files before Storage upload', () => {
  const edge = read('supabase', 'functions', 'security-gate', 'index.ts');
  const browser = read('assets', 'js', 'resource-center.js');
  assert.match(edge, /UPLOAD_TOO_LARGE/);
  assert.match(edge, /UPLOAD_FILE_TYPE_BLOCKED/);
  assert.match(edge, /UPLOAD_MIME_MISMATCH/);
  assert.match(edge, /UPLOAD_ACTIVE_CONTENT_BLOCKED/);
  assert.match(edge, /UPLOAD_SIGNATURE_MISMATCH/);
  assert.match(browser, /await validateUpload\(file,'resource'\)/);
  assert.match(browser, /await validateUpload\(file,'course_video'\)/);
  assert.match(browser, /await validateUpload\(file,'course_material'\)/);
});

test('admin console exposes notification evidence, load results and rollout stage', () => {
  const edge = read('supabase', 'functions', 'admin-summary', 'index.ts');
  const page = read('index.html');
  const settings = read('assets', 'js', 'alerts-settings.js');
  assert.match(edge, /notification_live_acceptance:/);
  assert.match(edge, /production_rollout:/);
  assert.match(edge, /unexplained_p0_p1/);
  assert.match(page, /id="admin-production-rollout"/);
  assert.match(page, /id="admin-notification-acceptance"/);
  assert.match(settings, /function adminRenderNotificationAcceptance/);
  assert.match(settings, /function adminRenderRollout/);
});
