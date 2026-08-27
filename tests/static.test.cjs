const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dom = new JSDOM(html);
const document = dom.window.document;
const localScriptSources = [...document.querySelectorAll('script[src]')]
  .map((node) => node.getAttribute('src'))
  .filter((source) => source && !/^(?:https?:)?\/\//i.test(source));
const localStyleSources = [...document.querySelectorAll('link[rel="stylesheet"][href]')]
  .map((node) => node.getAttribute('href'))
  .filter((source) => source && !/^(?:https?:)?\/\//i.test(source));
const browserSource = [html, ...localScriptSources.map((source) => (
  fs.readFileSync(path.join(root, source.split(/[?#]/)[0]), 'utf8')
))].join('\n');

test('production shell exposes the primary decision workflow', () => {
  assert.ok(document.querySelector('#loginPage #auth-email'));
  assert.ok(document.querySelector('#loginPage #auth-password'));
  assert.ok(document.querySelector('#overview .decision-workspace'));
  assert.ok(document.querySelector('#overview #ov-hero-input'));
  assert.ok(document.querySelector('#overview #ov-data-table'));
  assert.ok(document.querySelector('#shell-data-status'));
  assert.ok(document.querySelector('#data #data-quality-badge'));
  assert.ok(document.querySelector('#data #data-quality-rows'));

  const navLabels = [...document.querySelectorAll('.sidebar-nav .nav-text')]
    .map((node) => node.textContent.trim());
  for (const label of ['决策总览', '国家市场', '类目机会', '平台情报', '政策动态', 'AI 报告']) {
    assert.ok(navLabels.includes(label), `missing navigation label: ${label}`);
  }

  const ids = [...document.querySelectorAll('[id]')].map((node) => node.id);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  assert.deepEqual(duplicateIds, []);

  const navTargets = [...document.querySelectorAll('.sidebar-nav [data-page]')]
    .map((node) => node.dataset.page);
  for (const target of navTargets) {
    assert.ok(document.getElementById(target), `navigation target is missing: ${target}`);
  }
});

test('browser source contains no plaintext account store or provider secret flow', () => {
  assert.equal(browserSource.includes("localStorage.setItem('jay_accounts'"), false);
  assert.equal(browserSource.includes("localStorage.getItem('jay_accounts'"), false);
  assert.equal(browserSource.includes('https://api.deepseek.com'), false);
  assert.equal(browserSource.includes('JAY_REFRESH_DEMO     = true'), false);
  assert.equal(browserSource.includes("source = 'demo-sim'"), false);
  assert.equal(browserSource.includes('function jayDemoEvolve'), false);
  assert.match(browserSource, /functions\/v1\/ai-proxy/);
});

test('frontend assets are externalized and loaded in dependency order', () => {
  const expectedStyles = [
    'assets/styles/legacy-foundation.css',
    'assets/styles/workspaces.css',
    'assets/styles/legacy-theme.css',
    'assets/app-shell.css',
  ];
  const expectedModules = [
    'assets/js/catalog.js',
    'assets/js/products-shops.js',
    'assets/js/markets-policies.js',
    'assets/js/content-overview.js',
    'assets/js/reports-decisions.js',
    'assets/js/auth-data.js',
    'assets/js/alerts-settings.js',
    'assets/js/product-enhancements.js',
  ];
  assert.deepEqual(localStyleSources, expectedStyles);
  assert.deepEqual(localScriptSources.filter((source) => source.startsWith('assets/js/')), expectedModules);
  assert.equal(document.querySelectorAll('style').length, 0);
  assert.equal([...document.querySelectorAll('script:not([src])')].some((node) => node.textContent.trim()), false);
  for (const source of expectedStyles.concat(expectedModules)) {
    assert.equal(fs.existsSync(path.join(root, source)), true, `missing ${source}`);
  }
});

test('settings source cannot fall back to the retired fictional workspace', () => {
  assert.match(html, /<section id="settings" class="page"><\/section>/);
  for (const retiredSource of [
    'var stMembers',
    'MacBook Pro - Chrome',
    '演示账户体系',
    'st-modal-add-member',
    'st-tab-members',
    '推送日志并提示成功',
  ]) {
    assert.equal(browserSource.includes(retiredSource), false, `retired settings source remains: ${retiredSource}`);
  }
});

test('database policy is authenticated-user scoped', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase', 'monitored_shops.sql'), 'utf8');
  assert.equal(/FOR\s+ALL\s+TO\s+anon/i.test(sql), false);
  assert.match(sql, /auth\.uid\(\)\s*=\s*user_id/);
  assert.match(sql, /REVOKE ALL ON public\.monitored_shops FROM anon/);
});

test('authenticated workspace data uses the canonical Supabase layer', () => {
  const migration = fs.readFileSync(
    path.join(root, 'supabase', 'migrations', '20260825000000_unify_user_data.sql'),
    'utf8',
  );

  for (const table of [
    'user_watchlist',
    'user_activity',
    'generated_reports',
    'user_preferences',
    'report_materials',
    'user_feedback',
    'saved_workspace_items',
    'sales_leads',
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
    assert.match(migration, new RegExp(`auth\\.uid\\(\\) = user_id`));
  }
  assert.match(migration, /REVOKE ALL ON[\s\S]*FROM anon/);
  assert.equal(/DROP TABLE[\s\S]*(watchlist_items|reports)/i.test(migration), false);
  assert.match(migration, /to_regclass\('public\.watchlist_items'\)/);
  assert.match(migration, /to_regclass\('public\.reports'\)/);

  for (const helper of ['jayDbGet', 'jayDbInsert', 'jayDbUpsert', 'jayDbPatch', 'jayDbDelete']) {
    assert.match(browserSource, new RegExp(`function ${helper}\\(`));
  }
  assert.match(browserSource, /if \(!jayIsDemo[\s\S]*jayHydrateUserWorkspace\(\)/);
  for (const legacyKey of [
    'jay_report_pool',
    'jay_reports_v2',
    'jay_sub_pref',
    'jay_feedback',
    'jay_role',
    'jay_cn_view',
    'jay_cmp_schemes',
    'jay_filter_tpl',
    'jay_shop_groups',
    'jay_shop_group_shops',
    'jay_shop_tpl',
    'jay_ct_fav_folders',
    'jay_ct_fav_items',
    'jay_ct_tpl',
    'jay_rp_tpls',
    'jay_ent_leads',
    'jay_push_log',
  ]) {
    assert.equal(
      new RegExp(`localStorage\\.setItem\\(['\"]${legacyKey}['\"]`).test(browserSource),
      false,
      `${legacyKey} must not remain a primary write path`,
    );
  }
});

test('team workspace foundation is real and protected by RLS', () => {
  const migration = fs.readFileSync(
    path.join(root, 'supabase', 'migrations', '20260826010000_workspaces.sql'),
    'utf8',
  );
  for (const table of ['workspaces', 'workspace_members', 'workspace_invites']) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(migration, new RegExp(`REVOKE ALL ON public\\.[\\s\\S]*${table}`));
  }
  assert.match(migration, /role IN \('owner', 'admin', 'editor', 'viewer'\)/);
  assert.match(migration, /workspace_invites_one_pending/);
  assert.match(migration, /accept_workspace_invite/);
  assert.match(migration, /invite email does not match/);
  assert.match(migration, /workspace owner membership cannot be removed or downgraded/);
  assert.match(browserSource, /workspace_members/);
  assert.match(browserSource, /stCreateInvite/);
  assert.match(browserSource, /邀请记录已创建；邮件尚未发送/);
});

test('notification events are persisted without claiming external delivery', () => {
  const migration = fs.readFileSync(
    path.join(root, 'supabase', 'migrations', '20260826020000_notifications.sql'),
    'utf8',
  );
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.notification_events/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.notification_deliveries/);
  assert.match(migration, /notification_deliveries_queue/);
  assert.match(migration, /create_in_app_notification_delivery/);
  assert.match(migration, /REVOKE ALL ON public\.notification_events, public\.notification_deliveries FROM anon/);
  assert.match(browserSource, /jayCreateNotification/);
  assert.match(browserSource, /外部渠道尚未发送/);
});

test('report PDF export has a server-side job ledger and honest fallback', () => {
  const migration = fs.readFileSync(
    path.join(root, 'supabase', 'migrations', '20260826030000_report_exports.sql'),
    'utf8',
  );
  const edge = fs.readFileSync(
    path.join(root, 'supabase', 'functions', 'report-export', 'index.ts'),
    'utf8',
  );
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.report_exports/);
  assert.match(migration, /status IN \('queued', 'processing', 'completed', 'failed'\)/);
  assert.match(migration, /public\.report_exports ENABLE ROW LEVEL SECURITY/);
  assert.match(edge, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(edge, /REPORT_STORAGE_UPLOAD_FAILED/);
  assert.match(browserSource, /正在生成服务端 PDF/);
  assert.match(browserSource, /本地 PDF 预览/);
});

test('billing is server-controlled and never upgrades a browser tier directly', () => {
  const migration = fs.readFileSync(
    path.join(root, 'supabase', 'migrations', '20260826040000_billing_admin.sql'),
    'utf8',
  );
  const edge = fs.readFileSync(
    path.join(root, 'supabase', 'functions', 'billing-checkout', 'index.ts'),
    'utf8',
  );
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.user_subscriptions/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.billing_events/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.admin_audit_log/);
  assert.match(migration, /sync_profile_tier_from_subscription/);
  assert.match(edge, /STRIPE_SECRET_KEY/);
  assert.match(edge, /BILLING_NOT_CONFIGURED/);
  assert.match(browserSource, /不会创建订单、扣款或直接修改会员等级/);
  assert.match(browserSource, /jayCreateBillingCheckout/);
  assert.equal(browserSource.includes("jayProfile.tier = tier"), false);
});

test('legal pages explain data processing and service limitations', () => {
  assert.ok(document.querySelector('#privacy .legal-card'));
  assert.ok(document.querySelector('#terms .legal-card'));
  assert.match(html, /隐私政策/);
  assert.match(html, /服务条款/);
  assert.match(browserSource, /不构成投资、法律、税务、海关或合规意见/);
});

test('automated Supabase sync cannot silently pass', () => {
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'data-update.yml'), 'utf8');
  const syncStep = workflow.slice(workflow.indexOf('name: Sync data to Supabase'));
  assert.equal(syncStep.split('\n').slice(0, 5).join('\n').includes('continue-on-error'), false);

  const syncScript = fs.readFileSync(path.join(root, 'scripts', 'sync_to_supabase.py'), 'utf8');
  assert.match(syncScript, /return 2/);
  assert.match(syncScript, /incomplete Supabase sync/);
});

test('data publication is gated and exposes its quality report', () => {
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'data-update.yml'), 'utf8');
  const validateAt = workflow.indexOf('name: Validate data quality before publishing');
  const syncAt = workflow.indexOf('name: Sync data to Supabase');
  assert.ok(validateAt > 0);
  assert.ok(syncAt > validateAt);

  const collector = fs.readFileSync(path.join(root, 'scripts', 'collect_data.py'), 'utf8');
  const mainBody = collector.slice(collector.indexOf('def main():'), collector.indexOf("if __name__ == '__main__':"));
  assert.equal(mainBody.includes('sync_to_supabase('), false);

  const syncScript = fs.readFileSync(path.join(root, 'scripts', 'sync_to_supabase.py'), 'utf8');
  assert.match(syncScript, /refusing to publish/);
  assert.match(syncScript, /"key": "quality_report"/);
  assert.match(syncScript, /Legacy table fan-out disabled/);
  assert.match(syncScript, /SUPABASE_SYNC_LEGACY_TABLES/);

  const report = JSON.parse(fs.readFileSync(path.join(root, 'data', 'quality_report.json'), 'utf8'));
  assert.equal(report.schema_version, 1);
  assert.equal(report.publishable, true);
  assert.ok(report.datasets.policies);
  assert.ok(report.datasets.macro);
  assert.equal(report.status, 'healthy');
  assert.equal(report.datasets.cpsc.status, 'healthy');

  const cpscScript = fs.readFileSync(path.join(root, 'scripts', 'collect_cpsc.py'), 'utf8');
  assert.match(cpscScript, /saferproducts\.gov\/RestWebServices\/Recall/);
  assert.equal(cpscScript.includes('cpsc.gov/cpscrecall/reportapi"'), false);
});
