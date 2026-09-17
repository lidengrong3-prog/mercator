const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('production acceptance has a service-owned run ledger and compensating cleanup', () => {
  const migration = read('supabase', 'migrations', '20260911000000_production_acceptance_isolation.sql');
  const storageCleanup = read('supabase', 'migrations', '20261004000000_acceptance_storage_api_cleanup.sql');
  const watchlistTag = read('supabase', 'migrations', '20261005000000_acceptance_watchlist_tag.sql');
  const ownerCleanupGuard = read('supabase', 'migrations', '20261006000000_acceptance_owner_cleanup_guard.sql');
  for (const table of [
    'production_acceptance_runs', 'workspaces', 'workspace_members', 'workspace_invites',
    'report_materials', 'saved_workspace_items', 'generated_reports', 'report_runs',
    'report_exports', 'ai_request_logs', 'ai_token_reservations', 'monitored_shops',
    'user_activity',
  ]) {
    assert.match(migration, new RegExp(`${table}[\\s\\S]*acceptance_run_id`));
  }
  assert.match(migration, /cleanup_production_acceptance_run/);
  assert.match(migration, /cleanup_expired_production_acceptance_runs/);
  assert.match(migration, /storage\.objects/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.cleanup_production_acceptance_run/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.cleanup_production_acceptance_run/);
  assert.match(migration, /status IN \('running', 'passed', 'failed', 'timed_out', 'cleaning', 'cleaned', 'cleanup_failed'\)/);
  assert.match(migration, /INSERT INTO public\.workspace_members AS member[\s\S]*invite_row\.acceptance_run_id/);
  assert.match(migration, /A new run for the dedicated accounts is also the recovery point/);
  assert.match(migration, /DELETE FROM public\.user_activity WHERE acceptance_run_id/);
  assert.match(migration, /IF run_row\.status = 'cleaned'[\s\S]*'duplicate', TRUE/);
  assert.doesNotMatch(storageCleanup, /DELETE FROM storage\.objects/);
  assert.match(storageCleanup, /storage_paths_delegated/);
  assert.match(storageCleanup, /status <> 'cleaned'/);
  assert.match(watchlistTag, /ALTER TABLE public\.user_watchlist[\s\S]*acceptance_run_id TEXT/);
  assert.match(watchlistTag, /idx_user_watchlist_acceptance_run/);
  assert.match(ownerCleanupGuard, /service_role_request/);
  assert.match(ownerCleanupGuard, /OLD\.acceptance_run_id IS NOT NULL/);
  assert.match(ownerCleanupGuard, /workspace ownership transfer is not enabled/);
});

test('API and browser acceptance share the workflow run ID and always clean browser data', () => {
  const workflow = read('.github', 'workflows', 'deploy-production.yml');
  const python = read('scripts', 'production_acceptance.py');
  const releaseCheck = read('scripts', 'production_release_check.py');
  const cleanup = read('scripts', 'cleanup_production_acceptance.py');
  const browser = read('tests', 'production-auth.spec.cjs');
  const authData = read('assets', 'js', 'auth-data.js');
  assert.match(workflow, /ACCEPTANCE_RUN_ID: \$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/g);
  assert.match(workflow, /DEFER_ACCEPTANCE_CLEANUP: '1'/);
  assert.match(workflow, /browser-authenticated-acceptance-cleanup:[\s\S]*if: \$\{\{ always\(\) \}\}/);
  assert.match(
    workflow,
    /production-smoke:[\s\S]*if: \$\{\{ always\(\) && needs\['browser-authenticated-acceptance'\]\.result == 'success' && needs\['browser-authenticated-acceptance-cleanup'\]\.result == 'success' \}\}/,
  );
  assert.match(workflow, /cleanup_production_acceptance\.py --run-id/);
  assert.equal((workflow.match(/python scripts\/cleanup_production_acceptance\.py --run-id "\$ACCEPTANCE_RUN_ID"/g) || []).length, 2);
  assert.match(python, /os\.environ\.get\("ACCEPTANCE_RUN_ID"/);
  assert.match(python, /start_production_acceptance_run/);
  assert.match(python, /storage\/v1\/object\/reports/);
  assert.match(python, /recover_prior_acceptance_runs/);
  assert.match(python, /"workspace_id": workspace_a/);
  assert.match(python, /workspace_id,idempotency_key/);
  assert.match(python, /fault_body = \{[\s\S]*"workspace_id": workspace_a/);
  assert.match(python, /atexit\.register\(_finalize_acceptance_run\)/);
  assert.match(python, /QUALITY_PLATFORM_RULE_COVERAGE_MISSING/);
  assert.match(python, /"report_content_gate": report_gate/);
  assert.match(python, /REPORT_NOT_SAVED/);
  assert.match(cleanup, /storage\/v1\/object\/reports/);
  assert.match(cleanup, /status.*not_found/);
  assert.match(browser, /process\.env\.ACCEPTANCE_RUN_ID/);
  assert.match(browser, /addInitScript[\s\S]*__JAY_ACCEPTANCE_RUN_ID/);
  assert.match(browser, /from\('market_data_applicability'\)[\s\S]*\.eq\('domain', 'rule'\)/);
  assert.match(browser, /setActivePlatforms\(\[platformKey\]\)/);
  assert.doesNotMatch(browser, /setActivePlatforms\(\['amazon'\]\)/);
  assert.match(browser, /browser_formal_requests/);
  assert.match(browser, /QUALITY_PLATFORM_RULE_COVERAGE_MISSING/);
  assert.match(releaseCheck, /validate_report_content_gate/);
  assert.match(releaseCheck, /validate_browser_report_content_gate/);
  assert.match(authData, /user_activity: true/);
});
