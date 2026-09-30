const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('R08 centralizes workspace role, subscription, seat and plan decisions', () => {
  const sql = read('supabase', 'migrations', '20260930110000_r08_unified_workspace_authorization.sql');
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.resolve_workspace_authorization/);
  assert.match(sql, /WHEN request_role = 'service_role' THEN p_user_id[\s\S]*ELSE auth\.uid\(\)/);
  assert.match(sql, /membership\.role IN \('owner', 'admin', 'editor'\)/);
  assert.match(sql, /membership\.role IN \('owner', 'admin'\)/);
  assert.match(sql, /current_period_end IS NULL OR subscription\.current_period_end > NOW\(\)/);
  assert.match(sql, /entitlement_revoked_at IS NULL/);
  assert.match(sql, /COALESCE\(subscription\.refund_status, ''\) <> 'full'/);
  assert.match(sql, /WORKSPACE_SEAT_LIMIT_REACHED/);
  assert.match(sql, /SUBSCRIPTION_EXPIRED/);
  assert.match(sql, /workspace_authorization_allows/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.can_access_course[\s\S]*workspace_authorization_allows/);
});

test('R08 rewires report, export, invite and resource RLS to the shared decision', () => {
  const sql = read('supabase', 'migrations', '20260930110000_r08_unified_workspace_authorization.sql');
  for (const policy of [
    'generated_reports_select_workspace',
    'report_materials_select_workspace',
    'report_runs_select_workspace',
    'report_exports_select_workspace',
    'workspace_invites_insert_manager',
    'resource_items_select_accessible',
    'resource_versions_select_accessible',
    'resource_files_select_accessible',
  ]) assert.match(sql, new RegExp('CREATE POLICY ' + policy + '[\\s\\S]*workspace_authorization_allows'));
});

test('Edge Functions share the server authorization client', () => {
  const helper = read('supabase', 'functions', '_shared', 'workspace-authorization.ts');
  assert.match(helper, /rpc\/resolve_workspace_authorization/);
  assert.match(helper, /p_user_id: options\.userId/);
  assert.match(helper, /WORKSPACE_AUTHORIZATION_UNAVAILABLE/);
  const endpoints = {
    'report-save': 'report_write',
    'report-export': 'export',
    'report-docx': 'export',
    'workspace-invite': 'invite',
    'billing-status': 'read',
    'billing-portal': 'manage_billing',
    'billing-checkout': 'manage_billing',
    'resource-library': 'resource_read',
    'ai-proxy': 'write',
  };
  for (const [endpoint, action] of Object.entries(endpoints)) {
    const source = read('supabase', 'functions', endpoint, 'index.ts');
    assert.match(source, /resolveWorkspaceAuthorization/);
    assert.match(source, new RegExp("action: '" + action + "'"));
  }
});

test('R08 denial codes cover removal, cross-workspace access, expiry and exhausted seats', () => {
  const sql = read('supabase', 'migrations', '20260930110000_r08_unified_workspace_authorization.sql');
  assert.match(sql, /member\.workspace_id = effective_workspace_id[\s\S]*member\.user_id = effective_user_id[\s\S]*member\.status = 'active'/);
  assert.match(sql, /'code', 'WORKSPACE_FORBIDDEN'[\s\S]*'membership_active', FALSE/);
  assert.match(sql, /current_period_end IS NOT NULL AND subscription\.current_period_end <= NOW\(\) THEN 'expired'/);
  assert.match(sql, /active_seats \+ pending_seats \+ 1 <= effective_seat_limit/);
  assert.match(sql, /WHEN normalized_action = 'invite' AND NOT seat_available THEN 'WORKSPACE_SEAT_LIMIT_REACHED'/);
});

test('R08 invite acceptance uses a trusted manager seat check', () => {
  const sql = read('supabase', 'migrations', '20261018000000_r08_trusted_seat_check.sql');
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.workspace_seat_available_trusted/);
  assert.match(sql, /member\.user_id = p_manager_id[\s\S]*manager_role NOT IN \('owner', 'admin'\)/);
  assert.match(sql, /subscription\.current_period_end IS NULL OR subscription\.current_period_end > NOW\(\)/);
  assert.match(sql, /lower\(invite\.email\) <> lower\(p_exclude_email\)/);
  assert.match(sql, /active_seats \+ pending_seats \+ p_requested_count <= effective_seat_limit/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.guard_workspace_seat_limit[\s\S]*workspace_seat_available_trusted/);
  assert.doesNotMatch(sql, /guard_workspace_seat_limit[\s\S]*workspace_seat_available\(/);
});

test('production browser acceptance records the complete R08 role matrix', () => {
  const acceptance = read('tests', 'production-auth.spec.cjs');
  assert.match(acceptance, /resolve_workspace_authorization/);
  for (const role of ['owner', 'admin', 'editor', 'viewer']) assert.match(acceptance, new RegExp("role: '" + role + "'"));
  assert.match(acceptance, /crossAccountAuthorization/);
  assert.match(acceptance, /removedAuthorization/);
  assert.match(acceptance, /WORKSPACE_FORBIDDEN/);
  assert.match(acceptance, /r08_authorization: r08AuthorizationEvidence/);
});
