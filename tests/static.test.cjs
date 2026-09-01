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
  assert.ok(document.querySelector('#data #dq-raw-records'));
  assert.ok(document.querySelector('#data #dq-scoped-records'));

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
    'assets/styles/market-scope.css',
  ];
  const expectedModules = [
    'assets/js/market-scope.js',
    'assets/js/catalog.js',
    'assets/js/report-engine.js',
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

test('market scope is centralized before data modules load', () => {
  const scope = fs.readFileSync(path.join(root, 'assets/js/market-scope.js'), 'utf8');
  assert.match(scope, /code:\s*'US'/);
  assert.match(scope, /name:\s*'美国'/);
  assert.match(scope, /name:\s*'Amazon'/);
  assert.match(scope, /name:\s*'TikTok Shop'/);
  assert.match(scope, /name:\s*'AliExpress'/);
  assert.match(scope, /name:\s*'eBay'/);
  assert.match(scope, /version:\s*CONFIG_VERSION/);
  assert.match(scope, /marketPlatforms:/);
  assert.match(scope, /dataDomains:/);
  assert.match(scope, /categoryProfiles:/);
  assert.match(scope, /function normalizeMarketCode/);
  assert.match(scope, /function normalizePlatformKey/);
  assert.match(scope, /function getApplicableRecords/);
  assert.match(scope, /getActiveMarketNames/);
  assert.match(scope, /SCOPE_STORAGE_KEY/);
  assert.match(scope, /getConfiguredMarketPlatforms/);
  assert.match(scope, /normalizeDataRecord/);
  assert.match(scope, /getReportTemplates/);
  assert.match(scope, /global\.JAY_MARKET_SCOPE/);
});

test('platform rules consume the configured market scope', () => {
  assert.match(browserSource, /当前展示已配置平台规则/);
  assert.match(browserSource, /platform-scope-empty/);
  assert.match(browserSource, /getActiveMarkets\(\)/);
  assert.match(browserSource, /getActivePlatformNames\(\)/);
  assert.match(browserSource, /allowedMarkets\.indexOf\(market\)>=0/);
  assert.match(browserSource, /function rlMarketLabel/);
  assert.match(browserSource, /rlRuleFieldDefinitions/);
  assert.match(browserSource, /rule_version/);
  assert.match(browserSource, /function rlRuleVersionHistoryHtml/);
  const ruleData = JSON.parse(fs.readFileSync(path.join(root, 'data', 'rules.json'), 'utf8'));
  assert.deepEqual(ruleData.versioning, {
    identity_field: 'rule_key',
    version_field: 'rule_version',
    effective_from_field: 'effective_date',
    effective_to_field: 'effective_to',
    history_field: 'version_history',
  });
  const versionMigration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260831000000_platform_rule_versions.sql'), 'utf8');
  assert.match(versionMigration, /record_version/);
});

test('rules and formal pages do not seed retired global AI insights', () => {
  const alertsSource = fs.readFileSync(path.join(root, 'assets/js/alerts-settings.js'), 'utf8');
  assert.equal(alertsSource.includes('const aiInsights'), false);
  assert.equal(alertsSource.includes('function renderAIInsight'), false);
  assert.equal(browserSource.includes('ovTrendData'), false);
  assert.equal(browserSource.includes('ovOppData'), false);
  assert.equal(browserSource.includes('pfAiDiagnosis'), false);
  assert.equal(browserSource.includes('enrichPolicySummary'), false);
  assert.equal(browserSource.includes('enrichRuleSummary'), false);
  assert.equal(browserSource.includes('cn2InjectExtras'), false);
  assert.equal(browserSource.includes('爆款A'), false);
  assert.equal(browserSource.includes('JAY观海 AI 自动生成'), false);
  assert.match(browserSource, /if\(name==='rules'\)[\s\S]*renderRulesPage\(\)/);
});

test('policy dynamics consume only verified records from the configured market scope', () => {
  assert.match(browserSource, /function plGetJsonItems\(\)[\s\S]*return plGetVerifiedPolicies/);
  assert.match(browserSource, /plConfiguredMarketCodes\(\)/);
  assert.match(browserSource, /function plRenderDataInfo/);
  assert.match(browserSource, /jayFetchMarketData\('taxes', '\.\/data\/taxes\.json'\)/);
  assert.match(browserSource, /jayFetchMarketData\('access_requirements', '\.\/data\/access_requirements\.json'\)/);
  assert.equal(document.querySelectorAll('#policies .pl-domain-tab').length, 3);
  assert.match(browserSource, /const plAiTabs=\['最新市场政策','市场准入与认证','关税与税务','合规风险'\]/);
  assert.match(browserSource, /function plAssessEvidence\(p\)/);
  assert.match(browserSource, /specificRecordUrl=validUrl/);
  assert.match(browserSource, /var officialHost=/);
  assert.match(browserSource, /var traceableVerified=/);
  assert.match(browserSource, /function plAssessEvidenceForSet\(p, items\)/);
  assert.match(browserSource, /function plAssessPolicyRelevance\(p\)/);
  assert.match(browserSource, /var plIndustryOnlyKeywords/);
  assert.match(browserSource, /var plBusinessCrossBorderContextKeywords/);
  assert.match(browserSource, /plComplianceKeywords\.test\(text\) && plProductOrTradeContextKeywords\.test\(text\)/);
  assert.match(browserSource, /class="pl-relevance-tag"/);
  assert.match(browserSource, /var score=verified\?\(officialVerified\?100:85\):null/);
  assert.match(browserSource, /function plHasChineseDisplay/);
  assert.match(browserSource, /function plGetVerifiedDomainRecords/);
  assert.match(browserSource, /function plIsIndustryAdvisory\(item\)/);
  assert.match(browserSource, /sourceClass==='industry_advisory'/);
  assert.match(browserSource, /行业资讯 · 可追溯参考/);
  assert.match(browserSource, /可追溯参考 · 非官方核验/);
  assert.match(browserSource, /if\(plIsIndustryAdvisory\(p\)\) return false/);
  assert.match(browserSource, /var plCrossBorderOnly = true/);
  assert.match(browserSource, /function plIsCrossBorderPolicy\(p\)/);
  assert.match(browserSource, /function plGetVerifiedUsPolicies\(crossBorderOnly\)/);
  assert.match(browserSource, /plAssessEvidenceForSet\(p, (?:items|allScopedItems)\)\.flag!=='pass'/);
  assert.match(html, /<select id="pl-f-scope"[\s\S]*跨境经营相关/);
  assert.match(html, /data-domain="tax"/);
  assert.match(html, /data-domain="access"/);
  const translationScript = fs.readFileSync(path.join(root, 'scripts', 'translate_regulatory_data.py'), 'utf8');
  assert.match(translationScript, /source_hash/);
  assert.match(translationScript, /title_zh/);
  const regulatoryMigration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260831010000_regulatory_domains.sql'), 'utf8');
  assert.match(regulatoryMigration, /idx_market_tax_type/);
  assert.match(regulatoryMigration, /idx_market_access_requirement/);
  const industryMigration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260831020000_industry_advisory.sql'), 'utf8');
  assert.match(industryMigration, /source_class/);
  assert.match(industryMigration, /traceable-feed/);
  const provenanceSchema = JSON.parse(fs.readFileSync(path.join(root, 'data', 'provenance_schema.json'), 'utf8'));
  assert.deepEqual(provenanceSchema.fields.source_class.enum, ['industry_advisory']);
  assert.match(provenanceSchema.industry_advisory_rule.join('\n'), /formal policy statistics/);
  assert.equal(browserSource.includes('示意性数据'), false);
  assert.equal(browserSource.includes('固定核验时间'), false);
  assert.match(browserSource, /if\(name==='policies'\)[\s\S]*jayConfiguredMarketCode\(\)/);
});

test('dynamic alerts share the configured scope and expose complete time and domain filters', () => {
  const alertSource = fs.readFileSync(path.join(root, 'assets/js/alerts-settings.js'), 'utf8');
  assert.match(alertSource, /plGetVerifiedPolicies\(true\)/);
  assert.match(alertSource, /typeof rlGetJsonItems === 'function' \? rlGetJsonItems\(\) : \[\]/);
  assert.match(alertSource, /\['tax','access'\]/);
  assert.match(alertSource, /changeType/);
  assert.match(alertSource, /function alCalendarDayDiff\(value,nowValue\)/);
  assert.match(alertSource, /function alMatchesTimeFilter\(value,timeFilter,nowValue\)/);
  assert.match(alertSource, /timeFilter==='custom'/);
  assert.match(alertSource, /item\.market_code/);
  assert.match(alertSource, /type:domain/);
  assert.match(alertSource, /var scopedDynamic = all\.filter\(function\(a\)\{return a\.dynamic;\}\)/);
  assert.match(alertSource, /badge\.textContent=resultCount/);
  assert.match(alertSource, /navBadge\.textContent=unread/);
  assert.match(alertSource, /function titleKey\(value\)/);
  assert.equal(alertSource.includes("new Date('2026-07-15')"), false);
  assert.equal(alertSource.includes('from countryFullData'), false);
});

test('cross-page navigation shares one market and platform filter context', () => {
  const platformCards = [...document.querySelectorAll('#platforms .platform-card[data-platform]')];
  assert.deepEqual(platformCards.map((card) => card.dataset.platform), [
    'Amazon', 'AliExpress', 'TikTok Shop', 'eBay',
  ]);
  assert.ok(document.querySelector('#ov-metrics'));
  assert.match(browserSource, /function renderOverviewMetrics\(\)/);
  assert.match(browserSource, /policyFilter:\s*\{\s*domain:'policy',\s*region:\s*jayConfiguredMarketCode\(\)/);
  assert.match(browserSource, /ruleFilter:\s*\{\s*platform:\s*'all',\s*market:\s*jayConfiguredMarketCode\(\)/);
  assert.match(browserSource, /function jayOpenPolicyFilter\(filters\)/);
  assert.match(browserSource, /function jayOpenRulesFilter\(filters\)/);
  assert.match(browserSource, /function installCrossPageSwitch\(\)/);
  assert.match(browserSource, /wrapped\.__jayCrossPageSwitch=true/);
  assert.match(browserSource, /data-destination=\"policies\"/);
  assert.match(browserSource, /data-destination=\"rules\"/);
  assert.match(browserSource, /data-destination=\"tax\"/);
  assert.match(browserSource, /data-destination=\"access\"/);
  assert.match(browserSource, /data-destination=\"report\"/);
  assert.match(browserSource, /function plClearFilters\(\)[\s\S]*jayPolicyContext\(filter\)/);
});

test('reports, watchlist, and tools expose only the configured US scope', () => {
  const reportsSource = fs.readFileSync(path.join(root, 'assets/js/reports-decisions.js'), 'utf8');
  const authSource = fs.readFileSync(path.join(root, 'assets/js/auth-data.js'), 'utf8');
  const retiredLabels = /东南亚|北美|欧洲|中东|拉美|日韩|印尼|越南|泰国|巴西/;

  for (const pageId of ['report', 'watchlist', 'tools']) {
    assert.doesNotMatch(document.querySelector(`#${pageId}`).textContent, retiredLabels);
  }
  assert.deepEqual([...document.querySelectorAll('#rp-q-market option')].map((option) => [option.value, option.textContent]), [['US', '当前市场']]);
  assert.deepEqual([...document.querySelectorAll('#sc-market option')].map((option) => [option.value, option.textContent]), [['US', '当前市场']]);
  assert.deepEqual([...document.querySelectorAll('#wl-group-sel option')].map((option) => [option.value, option.textContent]), [['us-market', '当前市场（当前范围）']]);
  assert.match(document.querySelector('#rp-v2-topic').placeholder, /当前市场/);

  assert.match(reportsSource, /function jayConfiguredScopeInstruction\(\)/);
  assert.match(reportsSource, /【范围强制】/);
  assert.match(reportsSource, /items\.filter\(wlIsConfiguredScopeRow\)/);
  assert.match(reportsSource, /function wlIsConfiguredScopeRow\(row\)/);
  assert.match(reportsSource, /getMarketScoreBasis/);
  assert.match(reportsSource, /暂无已验证评分数据/);
  assert.doesNotMatch(reportsSource, /\|\|14/);
  assert.doesNotMatch(reportsSource, /'market-research':'全球市场调研报告'/);
  assert.match(authSource, /content\.market \|\| ''/);
  assert.match(authSource, /market_codes/);
  assert.match(authSource, /platform_keys/);
  assert.match(authSource, /category_codes/);
  assert.match(authSource, /scope_version/);
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

test('market catalog foundation is relational, versionable, and read-only to the browser', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data', 'market_scope.json'), 'utf8'));
  assert.deepEqual(manifest.default_market_codes, ['US']);
  assert.equal(manifest.markets[0].platform_keys.length, 4);
  assert.equal(manifest.markets[0].data_sources.macro.local_path, 'data/us_market/macro_indicators.json');
  assert.equal(manifest.markets[0].data_sources.macro.source_kind, 'official');
  assert.equal(manifest.markets[0].data_sources.macro.commerce_profile.indicator_map.ecommerce_sales, 'ECOMSA');
  assert.equal(manifest.markets[0].data_sources.macro.commerce_profile.indicator_map.ecommerce_penetration, 'ECOMPCTSA');
  assert.deepEqual(manifest.markets[0].data_sources.macro.commerce_profile.background_codes, ['GDP', 'UNRATE', 'INDPRO', 'BOPGSTB']);
  assert.ok(manifest.report_templates.some((template) => template.category_codes.includes('electronics')));
  const migration = fs.readFileSync(
    path.join(root, 'supabase', 'migrations', '20260830000000_market_catalog.sql'),
    'utf8',
  );
  const provenanceMigration = fs.readFileSync(
    path.join(root, 'supabase', 'migrations', '20260830010000_data_provenance.sql'),
    'utf8',
  );
  for (const table of [
    'market_catalog',
    'platform_catalog',
    'market_platforms',
    'jurisdiction_catalog',
    'category_profiles',
    'market_data_applicability',
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
  }
  assert.match(migration, /REFERENCES public\.market_catalog/);
  assert.match(migration, /REFERENCES public\.platform_catalog/);
  assert.match(migration, /verification_status/);
  assert.match(migration, /effective_from/);
  assert.match(provenanceMigration, /raw_data_records/);
  assert.match(provenanceMigration, /retrieved_at TIMESTAMPTZ/);
  assert.match(provenanceMigration, /market_data_applicability ADD COLUMN IF NOT EXISTS retrieved_at/);
  assert.match(provenanceMigration, /REVOKE ALL ON public\.raw_data_records FROM anon, authenticated/);
  assert.match(migration, /idx_market_data_applicability_scope/);
  assert.match(migration, /verification_status IN \('verified', 'uploaded'\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.report_template_catalog/);
  assert.match(migration, /source_kind TEXT/);
  assert.match(migration, /market_code::text/);
  assert.match(migration, /GRANT SELECT ON public\.market_catalog/);
  assert.match(browserSource, /data\/market_scope\.json/);
  assert.match(browserSource, /function jayCatalogPayload\(raw\)/);
  assert.match(browserSource, /function loadCountryCommerceData\(\)/);
  assert.ok(document.querySelector('#country-profile-selector'));
  assert.ok(document.querySelector('#country-commerce-content'));
  assert.ok(document.querySelector('#country-commerce-category'));
  assert.equal(document.querySelector('.country-linked-actions'), null);
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

test('report output lifecycle separates save state, snapshots and export formats', () => {
  const lifecycle = fs.readFileSync(
    path.join(root, 'supabase', 'migrations', '20260901000000_report_output_lifecycle.sql'),
    'utf8',
  );
  const docx = fs.readFileSync(
    path.join(root, 'supabase', 'functions', 'report-docx', 'index.ts'),
    'utf8',
  );
  assert.match(lifecycle, /save_status/);
  assert.match(lifecycle, /template_version/);
  assert.match(lifecycle, /data_snapshot_at/);
  assert.match(lifecycle, /material_snapshot_ids/);
  assert.match(lifecycle, /source_record_ids/);
  assert.match(lifecycle, /format IN \('pdf', 'docx', 'md'\)/);
  assert.match(lifecycle, /report_exports_insert_own/);
  assert.match(browserSource, /报告已保存/);
  assert.match(browserSource, /云端保存失败/);
  assert.match(browserSource, /jayGenerateReportDocx/);
  assert.match(browserSource, /rpV2RenderExportHistory/);
  assert.match(browserSource, /rpBuildDocxBlob/);
  assert.match(browserSource, /report\.dbId/);
  assert.match(docx, /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/);
  assert.match(docx, /format: 'docx'/);
  assert.match(docx, /REPORT_STORAGE_UPLOAD_FAILED/);
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
  assert.match(syncScript, /def build_catalog_rows\(\)/);
  assert.match(syncScript, /report_template_catalog/);
  assert.match(syncScript, /def build_raw_record_rows\(/);
  assert.match(syncScript, /def build_applicability_rows\(/);
  assert.match(syncScript, /def _scope_catalog\(/);
  assert.match(syncScript, /on_conflict/);

  const report = JSON.parse(fs.readFileSync(path.join(root, 'data', 'quality_report.json'), 'utf8'));
  assert.equal(report.schema_version, 1);
  assert.equal(report.publishable, ['healthy', 'degraded'].includes(report.status));
  assert.ok(report.datasets.policies);
  assert.ok(report.datasets.macro);
  assert.ok(['healthy', 'degraded', 'stale', 'failed'].includes(report.status));
  assert.ok(['healthy', 'degraded', 'stale', 'failed'].includes(report.datasets.cpsc.status));
  assert.ok(report.summary.raw_records > report.summary.scoped_records);
  assert.equal(report.summary.raw_records, Object.values(report.datasets).reduce((sum, item) => sum + item.raw_records, 0));
  assert.equal(report.summary.scoped_records, Object.values(report.datasets).reduce((sum, item) => sum + item.scoped_records, 0));
  assert.equal(report.datasets.countries.scoped_records, 1);
  assert.equal(report.datasets.platforms.scoped_records, 4);
  for (const dataset of Object.values(report.datasets)) {
    assert.equal(dataset.records, dataset.raw_records);
    assert.ok(dataset.scoped_records <= dataset.raw_records);
  }

  const cpscScript = fs.readFileSync(path.join(root, 'scripts', 'collect_cpsc.py'), 'utf8');
  assert.match(cpscScript, /saferproducts\.gov\/RestWebServices\/Recall/);
  assert.equal(cpscScript.includes('cpsc.gov/cpscrecall/reportapi"'), false);
});

test('category and shop pages do not ship retired static rankings or insights', () => {
  assert.equal(document.querySelector('.legacy-overview .data-boards'), null);
  assert.equal(browserSource.includes('var shAiBenchmark'), false);
  assert.equal(browserSource.includes('var shAiRisk'), false);
  assert.equal(browserSource.includes('Medicube Official — 美区TikTok美妆标杆'), false);
  assert.match(browserSource, /const products=\[\];/);
  assert.match(browserSource, /const shops=\[\];/);
  assert.match(browserSource, /演示模式不会填充示例数据/);
});

test('formal pages do not retain retired mock render paths', () => {
  assert.equal(document.querySelector('#alerts .alert-card'), null);
  assert.equal(document.querySelector('#alerts .alert-level-section'), null);
  assert.equal(document.querySelector('.legacy-overview'), null);
  assert.equal(document.querySelector('#countries .chart-placeholder'), null);
  assert.equal(document.querySelectorAll('#countries .alert-sidebar .alert-item').length, 0);
  assert.equal(document.querySelectorAll('#platforms .platform-card[data-platform]').length, 4);
  assert.match(html, /平台经营指标未接入可信数据源/);
  assert.match(html, /暂无已接入资源/);
  assert.equal(html.includes('部分经营模块含演示样本'), false);
  assert.ok(document.querySelector('#alerts #al-summary'));
  assert.ok(document.querySelector('#alerts #al-search-input'));
  assert.ok(document.querySelector('#alerts #al-filter-type'));
  assert.ok(document.querySelector('#alerts #al-filter-level'));
  assert.ok(document.querySelector('#alerts #al-filter-time'));
  assert.ok(document.querySelector('#alerts #al-custom-range'));
  assert.ok(document.querySelector('#alerts #al-date-start'));
  assert.ok(document.querySelector('#alerts #al-date-end'));
  assert.ok(document.querySelector('#alerts #al-tabs'));
  assert.ok(document.querySelector('#alerts #al-list'));
  assert.ok(document.querySelector('#alerts #al-pagination'));
  assert.match(browserSource, /function renderAlerts\(\)\{[\s\S]*var filtered=getFilteredAlerts\(\);/);
  assert.doesNotMatch(browserSource, /function renderAlerts\(\)\{\s*return;/);
  assert.doesNotMatch(browserSource, /function renderPlatforms\(\)\{[\s\S]*renderPfStats\(\)/);
  assert.equal(browserSource.includes('renderPlatforms();'), false);
  assert.doesNotMatch(browserSource, /function cn2Render\(/);
  const countryLoader = browserSource.slice(browserSource.indexOf('async function loadCountryData()'), browserSource.indexOf('// Remove old renderCountry default call'));
  assert.equal(countryLoader.includes('cn2Render('), false);
  assert.equal(browserSource.includes('count:\'66 平台\''), false);
  assert.equal(browserSource.includes('count:\'40 国\''), false);
  assert.equal(browserSource.includes('var mockResults='), false);
  assert.equal(browserSource.includes('全球平台增长总结'), false);
  assert.equal(browserSource.includes('function openAlertSettings()'), false);
  assert.equal(browserSource.includes('function alBatchWatch()'), false);
  const generatorSource = fs.readFileSync(path.join(root, 'scripts', 'generate_alerts.py'), 'utf8');
  assert.equal(generatorSource.includes('def generate_from_us_market()'), false);
  assert.match(generatorSource, /source_record_id/);
  const alertRows = JSON.parse(fs.readFileSync(path.join(root, 'data', 'alerts.json'), 'utf8'));
  assert.equal(alertRows.some((row) => Array.isArray(row) && /^(a\d+|usm-)/i.test(String(row[0] || ''))), false);
  assert.equal(alertRows.every((row) => /[\u3400-\u9fff]/.test(String(row[3])) && /[\u3400-\u9fff]/.test(String(row[6]))), true);
  assert.equal(html.includes('<option value="all">全部市场</option>'), false);
  const catalogSource = fs.readFileSync(path.join(root, 'assets/js/catalog.js'), 'utf8');
  const countrySource = fs.readFileSync(path.join(root, 'assets/js/products-shops.js'), 'utf8');
  const policySource = fs.readFileSync(path.join(root, 'assets/js/markets-policies.js'), 'utf8');
  const reportsSource = fs.readFileSync(path.join(root, 'assets/js/reports-decisions.js'), 'utf8');
  assert.match(catalogSource, /let platformsData=\[\];/);
  assert.match(catalogSource, /let pfExtData=\{\};/);
  assert.match(catalogSource, /const policyData=\[\];/);
  assert.match(catalogSource, /const rulesData=\[\];/);
  assert.match(catalogSource, /const contentData=\[\];/);
  assert.match(countrySource, /let countryFullData=\{\};/);
  assert.equal(policySource.includes('defaultPoliciesData'), false);
  assert.equal(policySource.includes('defaultRulesData'), false);
  assert.equal(policySource.includes('p-fallback-'), false);
  assert.equal(policySource.includes('r-fallback-'), false);
  assert.equal(policySource.includes('using built-in fallback'), false);
  assert.equal(policySource.includes('AI 合规深度解读'), false);
  assert.equal(reportsSource.includes('DS_DOMAINS'), false);
  assert.equal(reportsSource.includes('dsRender'), false);
  const watchlistLoader = reportsSource.slice(reportsSource.indexOf('async function loadWatchlistFromDb()'), reportsSource.indexOf('const alertMessages=[]'));
  assert.equal(watchlistLoader.includes('Math.random'), false);
  assert.match(watchlistLoader, /trend:\s*\[\]/);
});

test('production hardening isolates user data and records idempotent operations', () => {
  const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260901010000_production_hardening.sql'), 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.report_runs/);
  assert.match(migration, /UNIQUE \(user_id, idempotency_key\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.ai_request_logs/);
  assert.match(migration, /public\.report_runs ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /public\.ai_request_logs ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /report_runs_select_own[\s\S]*auth\.uid\(\) = user_id/);
  assert.match(migration, /ai_request_logs_select_own[\s\S]*auth\.uid\(\) = user_id/);
  assert.match(migration, /idx_report_exports_idempotency/);
  assert.match(migration, /product_catalog_import/);
  assert.match(migration, /REPORT_RUN_OWNER_MISMATCH/);
  assert.match(migration, /request_id IS NULL[\s\S]*idempotency_key IS NULL/);
  assert.equal(/\b(prompt|response_body|messages)\s+(TEXT|JSONB)/i.test(migration), false);

  const authSource = fs.readFileSync(path.join(root, 'assets', 'js', 'auth-data.js'), 'utf8');
  const productSource = fs.readFileSync(path.join(root, 'assets', 'js', 'products-shops.js'), 'utf8');
  const reportSource = fs.readFileSync(path.join(root, 'assets', 'js', 'reports-decisions.js'), 'utf8');
  assert.match(authSource, /function jayStartReportRun/);
  assert.match(authSource, /function jayFinishReportRun/);
  assert.match(authSource, /function jayExportIdempotencyKey/);
  assert.match(authSource, /AI_QUOTA_EXCEEDED/);
  assert.match(authSource, /REQUEST_TIMEOUT/);
  assert.match(productSource, /jay_product_catalog_import_v2_/);
  assert.match(productSource, /jaySaveWorkspaceAsset\('product_catalog_import'/);
  assert.match(productSource, /function prResetImportedDataForAuthChange/);
  assert.match(productSource, /function prPurgeImportedDataForUser/);
  assert.doesNotMatch(productSource, /setItem\('jay_product_catalog_import_v1'/);
  assert.match(reportSource, /var rpExportBusy/);
  assert.match(reportSource, /function rpV2GenerationIdentity/);
  assert.match(reportSource, /reportRunId/);
});

test('production release deploys database and functions before the frontend', () => {
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'deploy-production.yml'), 'utf8');
  const migrationsAt = workflow.indexOf('Apply database migrations before functions');
  const functionsAt = workflow.indexOf('Deploy JWT-protected Edge Functions');
  const acceptanceAt = workflow.indexOf('Run two-account production report acceptance');
  const frontendAt = workflow.indexOf('Assemble static site after backend acceptance');
  assert.ok(migrationsAt > 0);
  assert.ok(functionsAt > migrationsAt);
  assert.ok(acceptanceAt > functionsAt);
  assert.ok(frontendAt > acceptanceAt);
  assert.match(workflow, /needs: deploy-backend/);
  assert.match(workflow, /needs: authenticated-acceptance/);
  assert.match(workflow, /PROD_TEST_USER_A_EMAIL/);
  assert.match(workflow, /PROD_TEST_USER_B_EMAIL/);

  const acceptance = fs.readFileSync(path.join(root, 'scripts', 'production_acceptance.py'), 'utf8');
  assert.match(acceptance, /account B can read account A report/);
  assert.match(acceptance, /account B can sign account A/);
  assert.match(acceptance, /saved report did not recover after re-login/);
  assert.match(acceptance, /report-export/);
  assert.match(acceptance, /report-docx/);

  const config = fs.readFileSync(path.join(root, 'supabase', 'config.toml'), 'utf8');
  assert.match(config, /\[functions\.report-docx\][\s\S]*verify_jwt = true/);
});
