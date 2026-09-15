const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('workspace billing migration owns plans, seats and atomic monthly counters', () => {
  const migration = read('supabase', 'migrations', '20260914000000_workspace_billing.sql');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.workspace_subscriptions/);
  assert.match(migration, /workspace_id UUID REFERENCES public\.workspaces/);
  assert.match(migration, /seat_limit INTEGER/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.workspace_usage_monthly/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.workspace_member_usage_minute/);
  assert.match(migration, /PRIMARY KEY \(workspace_id, period_start\)/);
  assert.match(migration, /workspace_effective_entitlement/);
  assert.match(migration, /effective_billing_plan\(p_workspace_id UUID/);
  assert.match(migration, /get_workspace_billing_usage/);
  assert.match(migration, /reserve_workspace_ai_token_quota/);
  assert.match(migration, /finalize_workspace_ai_token_reservation/);
  assert.match(migration, /pg_advisory_xact_lock\(quota_key\)/);
  assert.match(migration, /DROP CONSTRAINT IF EXISTS ai_token_reservations_user_id_request_id_key/);
  assert.match(migration, /DROP INDEX IF EXISTS public\.idx_report_exports_user_idempotency_complete/);
  assert.match(migration, /reports_used = reports_used \+ 1/);
  assert.match(migration, /exports_used = exports_used \+ 1/);
  assert.match(migration, /enforce_report_run_status_quota/);
  assert.match(migration, /enforce_report_export_status_quota/);
  assert.match(migration, /REPORT_RUN_CREATOR_REQUIRED/);
});

test('workspace billing keeps workspaces isolated and protects membership seats', () => {
  const migration = read('supabase', 'migrations', '20260914000000_workspace_billing.sql');
  assert.match(migration, /Multiple workspaces always start independently on free/);
  assert.match(migration, /workspace_seat_available/);
  assert.match(migration, /WORKSPACE_SEAT_LIMIT_REACHED/);
  assert.match(migration, /workspace_invites_seat_limit/);
  assert.match(migration, /workspace_members_seat_limit/);
  assert.match(migration, /pending_seats/);
  assert.match(migration, /seats_in_use/);
  assert.match(migration, /'member_usage', member_usage/);
  assert.match(migration, /subscription_was_downgraded/);
  assert.match(migration, /configure_workspace_manual_subscription/);
  assert.match(migration, /workspace_subscription\.manual_configured/);
  assert.match(migration, /admin_audit_log/);
});

test('AI and billing functions pass workspace identity and shared usage RPCs', () => {
  const aiProxy = read('supabase', 'functions', 'ai-proxy', 'index.ts');
  const status = read('supabase', 'functions', 'billing-status', 'index.ts');
  const checkout = read('supabase', 'functions', 'billing-checkout', 'index.ts');
  const portal = read('supabase', 'functions', 'billing-portal', 'index.ts');
  const webhook = read('supabase', 'functions', 'billing-webhook', 'index.ts');
  const adminSummary = read('supabase', 'functions', 'admin-summary', 'index.ts');
  assert.match(aiProxy, /payload\.workspace_id/);
  assert.match(aiProxy, /workspace_effective_entitlement/);
  assert.match(aiProxy, /reserve_workspace_ai_token_quota/);
  assert.match(aiProxy, /finalize_workspace_ai_token_reservation/);
  assert.match(aiProxy, /reservationError === 'AI_RATE_LIMITED'/);
  assert.match(aiProxy, /workspace_id: workspaceId/);
  assert.match(status, /workspace_subscriptions/);
  assert.match(status, /get_workspace_billing_usage/);
  assert.match(status, /workspace_id: workspaceId/);
  assert.match(checkout, /WORKSPACE_BILLING_ADMIN_REQUIRED/);
  assert.match(checkout, /metadata\[workspace_id\]/);
  assert.match(portal, /workspace_subscriptions/);
  assert.match(webhook, /resolvedWorkspaceId/);
  assert.match(webhook, /workspace_subscriptions/);
  assert.match(webhook, /targetTable = resolvedWorkspaceId/);
  assert.match(webhook, /const subscriptionLookupFilters/);
  assert.doesNotMatch(webhook, /\$\{filters\}/);
  assert.match(adminSummary, /count\('workspace_subscriptions'/);
});

test('frontend billing state follows the active workspace and sends workspace ids', () => {
  const auth = read('assets', 'js', 'auth-data.js');
  const reports = read('assets', 'js', 'reports-decisions.js');
  assert.match(auth, /workspace_subscriptions/);
  assert.match(auth, /workspace_id: jayActiveWorkspaceId\(\)/);
  assert.match(auth, /get_workspace_billing_usage|billing-status/);
  assert.match(auth, /workspace_id: jayRequireActiveWorkspace\(\)/);
  assert.match(auth, /selected workspace never inherits the user's legacy subscription/);
  assert.match(auth, /workspaceId \? \(\(jayBillingStatusCache/);
  assert.match(reports, /workspace_id: opts\.workspaceId/);
  assert.match(reports, /当前工作区本月用量/);
  assert.match(reports, /待接受邀请/);
  const settings = read('assets', 'js', 'alerts-settings.js');
  assert.match(settings, /usage\.member_usage/);
});
