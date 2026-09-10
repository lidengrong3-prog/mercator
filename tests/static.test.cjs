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

test('legacy US category PDFs are not regenerated or included in GitHub Pages', () => {
  const dataWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'data-update.yml'), 'utf8');
  const deployWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'deploy-production.yml'), 'utf8');
  const collector = fs.readFileSync(path.join(root, 'scripts', 'collect_us_market.py'), 'utf8');
  const categoryIndex = JSON.parse(fs.readFileSync(path.join(root, 'data', 'us_market', 'index.json'), 'utf8'));
  const legacyReportDir = path.join(root, 'reports', 'us_market');
  const legacyPdfs = fs.existsSync(legacyReportDir)
    ? fs.readdirSync(legacyReportDir).filter((name) => name.endsWith('_report.pdf'))
    : [];

  assert.deepEqual(legacyPdfs, []);
  assert.equal(fs.existsSync(path.join(root, 'scripts', 'gen_us_market_report.py')), false);
  assert.doesNotMatch(dataWorkflow, /gen_us_market_report|reports\//);
  assert.doesNotMatch(deployWorkflow, /cp\s+-R\s+reports|_site\/reports/);
  assert.doesNotMatch(collector, /reports\/us_market|_report\.pdf/);
  assert.ok(categoryIndex.categories.every((category) => !Object.hasOwn(category, 'report')));
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
    'assets/js/report-quality.js',
    'assets/js/report-engine.js',
    'assets/js/products-shops.js',
    'assets/js/markets-policies.js',
    'assets/js/content-overview.js',
    'assets/js/reports-decisions.js',
    'assets/js/auth-data.js',
    'assets/js/alerts-settings.js',
    'assets/js/unified-search.js',
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

test('unified search page exposes seven sourced result domains and restorable filters', () => {
  const searchSource = fs.readFileSync(path.join(root, 'assets', 'js', 'unified-search.js'), 'utf8');
  assert.ok(document.querySelector('#search.page'));
  assert.ok(document.querySelector('#unified-search-form'));
  assert.ok(document.querySelector('#unified-search-market'));
  assert.ok(document.querySelector('#unified-search-platform'));
  assert.ok(document.querySelector('#unified-search-time'));
  assert.ok(document.querySelector('#unified-search-sort'));
  assert.ok(document.querySelector('#unified-search-types'));
  assert.ok(document.querySelector('#unified-search-results'));
  assert.deepEqual(
    ['country', 'platform', 'policy', 'rule', 'product', 'shop', 'content'].every((type) => (
      new RegExp(`\\b${type}\\b`).test(searchSource)
    )),
    true,
  );
  assert.match(searchSource, /TERM_GROUPS/);
  assert.match(searchSource, /meiguo/);
  assert.match(searchSource, /yamaxun/);
  assert.match(searchSource, /sumaitong/);
  assert.match(searchSource, /function scoreRecord/);
  assert.match(searchSource, /URLSearchParams/);
  assert.match(searchSource, /#search/);
  assert.match(searchSource, /setActiveMarket/);
  assert.match(searchSource, /setActivePlatforms/);
  assert.match(searchSource, /系统不会使用演示数据补充结果/);
  assert.match(browserSource, /search:'统一搜索'/);
  assert.match(browserSource, /raw\.split\('\?'\)\[0\]/);
  assert.doesNotMatch(searchSource, /\.innerHTML\s*=/);
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

test('structured report scope is not overridden by source URL text', () => {
  const reportsSource = fs.readFileSync(path.join(root, 'assets/js/reports-decisions.js'), 'utf8');
  const reportFilter = reportsSource.slice(
    reportsSource.indexOf('function rpReportInConfiguredScope'),
    reportsSource.indexOf('function rpAddCurrentToPool'),
  );
  assert.match(reportFilter, /if\(reportMarkets\)[\s\S]*return values\.some/);
  assert.match(reportFilter, /return !jayScopeHasRetiredText/);
  assert.ok(reportFilter.indexOf('return values.some') < reportFilter.indexOf('return !jayScopeHasRetiredText'));
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

test('market platform status migration accepts configured schema-only relationships', () => {
  const migration = fs.readFileSync(
    path.join(root, 'supabase', 'migrations', '20260903010000_market_platform_data_status.sql'),
    'utf8',
  );
  assert.match(migration, /DROP CONSTRAINT IF EXISTS market_platforms_data_status_check/);
  assert.match(migration, /data_status IN \('verified', 'configured', 'partial', 'unknown', 'schema_only'\)/);
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
  assert.match(browserSource, /邀请邮件已发送/);
});

test('notification events queue configured external delivery without exposing channel secrets', () => {
  const baseMigration = fs.readFileSync(
    path.join(root, 'supabase', 'migrations', '20260826020000_notifications.sql'),
    'utf8',
  );
  const channelMigration = fs.readFileSync(
    path.join(root, 'supabase', 'migrations', '20260908000000_notification_channels.sql'),
    'utf8',
  );
  assert.match(baseMigration, /CREATE TABLE IF NOT EXISTS public\.notification_events/);
  assert.match(baseMigration, /CREATE TABLE IF NOT EXISTS public\.notification_deliveries/);
  assert.match(baseMigration, /notification_deliveries_queue/);
  assert.match(baseMigration, /REVOKE ALL ON public\.notification_events, public\.notification_deliveries FROM anon/);
  assert.match(channelMigration, /notification_channel_configs/);
  assert.match(channelMigration, /claim_notification_deliveries/);
  assert.match(channelMigration, /FOR UPDATE SKIP LOCKED/);
  assert.match(browserSource, /jayCreateNotification/);
  assert.match(browserSource, /jayConfigureNotificationChannel/);
  assert.doesNotMatch(browserSource, /外部渠道尚未发送/);
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
  assert.match(edge, /select=id,workspace_id,title,content,save_status/);
  assert.match(edge, /report\.save_status !== 'saved'/);
  assert.match(edge, /content_source: 'persisted_report'/);
  assert.match(browserSource, /正在生成服务端 PDF/);
  assert.match(browserSource, /本地临时导出/);
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
  assert.match(browserSource, /报告已保存到云端/);
  assert.match(browserSource, /云端保存失败/);
  assert.match(browserSource, /jayGenerateReportDocx/);
  assert.match(browserSource, /rpV2RenderExportHistory/);
  assert.match(browserSource, /rpBuildDocxBlob/);
  assert.match(browserSource, /report\.dbId/);
  assert.match(docx, /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/);
  assert.match(docx, /format: 'docx'/);
  assert.match(docx, /REPORT_STORAGE_UPLOAD_FAILED/);
  assert.match(docx, /select=id,workspace_id,title,content,save_status/);
  assert.match(docx, /report\.save_status !== 'saved'/);
  assert.match(docx, /content_source: 'persisted_report'/);
  assert.match(browserSource, /data-report-citation/);
  assert.match(browserSource, /原始记录 ID/);
  assert.match(browserSource, /数据快照/);
  assert.match(browserSource, /打开 HTTPS 原始来源/);
  assert.match(browserSource, /正文引用核验未通过/);
  assert.doesNotMatch(browserSource, /jayCreateReportExportEvent\(report\.dbId,'pdf','completed'/);
  assert.doesNotMatch(browserSource, /jayCreateReportExportEvent\(report\.dbId,'docx','completed'/);
  assert.doesNotMatch(browserSource, /window\.jayExportReport/);
  assert.equal(document.querySelector('#export'), null);
  assert.equal(document.querySelector('#export-modal-overlay'), null);
});

test('global quality gate blocks formal report persistence and server exports', () => {
  const qualityIndex = localScriptSources.indexOf('assets/js/report-quality.js');
  const engineIndex = localScriptSources.indexOf('assets/js/report-engine.js');
  assert.ok(qualityIndex >= 0 && qualityIndex < engineIndex);
  assert.ok(document.querySelector('#rp-v2-quality-gate'));

  const qualitySource = fs.readFileSync(path.join(root, 'assets', 'js', 'report-quality.js'), 'utf8');
  const authSource = fs.readFileSync(path.join(root, 'assets', 'js', 'auth-data.js'), 'utf8');
  const decisionsSource = fs.readFileSync(path.join(root, 'assets', 'js', 'reports-decisions.js'), 'utf8');
  const shared = fs.readFileSync(path.join(root, 'supabase', 'functions', '_shared', 'report-quality.ts'), 'utf8');
  const pdf = fs.readFileSync(path.join(root, 'supabase', 'functions', 'report-export', 'index.ts'), 'utf8');
  const docx = fs.readFileSync(path.join(root, 'supabase', 'functions', 'report-docx', 'index.ts'), 'utf8');

  assert.match(qualitySource, /QUALITY_REPORT_STALE/);
  assert.match(qualitySource, /allowsStoredReport/);
  assert.match(authSource, /jayCurrentReportQualityGate/);
  assert.match(authSource, /REPORT_QUALITY_GATE_BLOCKED/);
  assert.match(authSource, /quality_gate/);
  assert.match(authSource, /quality_snapshot/);
  assert.match(decisionsSource, /未保存草稿/);
  assert.match(decisionsSource, /不能创建正式 PDF/);
  assert.match(decisionsSource, /不能创建正式 DOCX/);
  assert.match(shared, /reportContentAllowsFormalOutput/);
  assert.match(shared, /market_data\?key=eq\.quality_report/);
  for (const source of [pdf, docx]) {
    assert.match(source, /\.\.\/_shared\/report-quality\.ts/);
    assert.match(source, /REPORT_QUALITY_GATE_BLOCKED/);
    assert.match(source, /REPORT_QUALITY_STATUS_UNAVAILABLE/);
    assert.match(source, /fetchCurrentQualityGate/);
  }
});

test('content quality and observability contracts are wired end to end', () => {
  const qualitySource = fs.readFileSync(path.join(root, 'assets', 'js', 'report-quality.js'), 'utf8');
  const engineSource = fs.readFileSync(path.join(root, 'assets', 'js', 'report-engine.js'), 'utf8');
  const reportSource = fs.readFileSync(path.join(root, 'assets', 'js', 'reports-decisions.js'), 'utf8');
  const authSource = fs.readFileSync(path.join(root, 'assets', 'js', 'auth-data.js'), 'utf8');
  const adminSource = fs.readFileSync(path.join(root, 'assets', 'js', 'alerts-settings.js'), 'utf8');
  const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260908020000_observability_rollups.sql'), 'utf8');
  const validation = fs.readFileSync(path.join(root, 'supabase', 'functions', '_shared', 'report-validation.ts'), 'utf8');
  const save = fs.readFileSync(path.join(root, 'supabase', 'functions', 'report-save', 'index.ts'), 'utf8');
  const proxy = fs.readFileSync(path.join(root, 'supabase', 'functions', 'ai-proxy', 'index.ts'), 'utf8');
  const adminSummary = fs.readFileSync(path.join(root, 'supabase', 'functions', 'admin-summary', 'index.ts'), 'utf8');

  for (const dimension of ['accuracy', 'completeness', 'executability', 'sourceCoverage']) assert.match(qualitySource, new RegExp(dimension));
  assert.match(engineSource, /contentQuality\.ok/);
  assert.match(reportSource, /rpV2RenderContentQuality/);
  assert.match(authSource, /content_quality/);
  assert.match(validation, /CONTENT_QUALITY_BLOCKED/);
  assert.match(save, /content_quality: validation\.content_quality/);
  for (const field of ['input_tokens', 'output_tokens', 'total_tokens', 'estimated_cost_usd', 'ai_request_count', 'failed_request_count', 'search_request_count', 'save_status', 'publication_status']) {
    assert.match(migration, new RegExp(field));
  }
  assert.match(migration, /rollup_report_run_ai_usage/);
  assert.match(proxy, /search_enabled: Boolean/);
  assert.match(adminSummary, /ai_search_requests/);
  assert.match(adminSource, /admin-ai-input-tokens/);
  assert.match(adminSource, /admin-ai-output-tokens/);
  assert.match(adminSource, /admin-ai-searches/);
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
  const billingShared = fs.readFileSync(
    path.join(root, 'supabase', 'functions', '_shared', 'billing.ts'),
    'utf8',
  );
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.user_subscriptions/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.billing_events/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.admin_audit_log/);
  assert.match(migration, /sync_profile_tier_from_subscription/);
  assert.match(billingShared, /STRIPE_SECRET_KEY/);
  assert.match(billingShared, /BILLING_ENABLED/);
  assert.match(edge, /BILLING_NOT_CONFIGURED/);
  assert.match(browserSource, /未启用时不会创建订单、扣款或修改会员等级/);
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

test('scheduled data update can access and validates production translation secrets', () => {
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'data-update.yml'), 'utf8');
  assert.match(workflow, /update-data:[\s\S]*environment: production/);
  assert.match(workflow, /REGULATORY_TRANSLATION_API_KEY:.*secrets\.REGULATORY_TRANSLATION_API_KEY \|\| secrets\.DEEPSEEK_API_KEY/);
  assert.match(workflow, /REGULATORY_TRANSLATION_MODEL:.*secrets\.REGULATORY_TRANSLATION_MODEL \|\| secrets\.DEEPSEEK_MODEL/);
  const preflightAt = workflow.indexOf('name: Validate regulatory translation configuration');
  const collectorAt = workflow.indexOf('name: Run configured market data collector');
  assert.ok(preflightAt > 0);
  assert.ok(collectorAt > preflightAt);
  assert.match(workflow.slice(preflightAt, collectorAt), /translate_regulatory_data\.py --check-config/);
});

test('scheduled collection is scoped and core source failures are published to the quality gate', () => {
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'data-update.yml'), 'utf8');
  assert.match(workflow, /data\/collection_run\.json/);

  const collector = fs.readFileSync(path.join(root, 'scripts', 'collect_data.py'), 'utf8');
  assert.match(collector, /def build_query_url\(/);
  assert.match(collector, /urlencode\(existing \+ additions, doseq=True\)/);
  assert.match(collector, /def configured_collection_scope\(/);
  assert.match(collector, /data_status.*configured/);
  assert.match(collector, /write_collection_report\(\)/);
  assert.equal(collector.includes('def collect_platform_updates('), false);
  assert.equal(collector.includes('def collect_country_updates('), false);
  assert.equal(collector.includes('def collect_eu_trade('), false);
  assert.equal(collector.includes('def collect_mofcom('), false);
  assert.equal(collector.includes('COUNTRY_CONFIG ='), false);

  const validator = fs.readFileSync(path.join(root, 'scripts', 'validate_data.py'), 'utf8');
  assert.match(validator, /def validate_collection_run\(/);
  assert.match(validator, /核心来源采集失败/);
  assert.match(validator, /validate_collection_run\(now\)/);
  assert.match(validator, /missing_pipeline_sources/);
  assert.match(validator, /collection_run = \{/);
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
  assert.match(syncScript, /collection run metadata is missing/);
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
  assert.ok(['healthy', 'degraded', 'not_connected', 'stale', 'failed'].includes(report.status));
  assert.ok(['healthy', 'degraded', 'not_connected', 'stale', 'failed'].includes(report.datasets.cpsc.status));
  assert.ok(report.summary.raw_records > report.summary.scoped_records);
  assert.equal(report.summary.raw_records, Object.values(report.datasets).reduce((sum, item) => sum + item.raw_records, 0));
  assert.equal(report.summary.scoped_records, Object.values(report.datasets).reduce((sum, item) => sum + item.scoped_records, 0));
  assert.equal(report.datasets.countries.scoped_records, 1);
  assert.equal(report.datasets.platforms.scoped_records, 4);
  assert.equal(report.datasets.taxes.status, 'not_connected');
  assert.equal(report.datasets.access_requirements.status, 'not_connected');
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
  assert.match(countryLoader, /typeof jayFetchMarketData!==['"]function['"]/);
  assert.match(countryLoader, /setTimeout\(loadCountryData,0\)/);
  assert.equal(browserSource.includes('count:\'66 平台\''), false);
  assert.equal(browserSource.includes('count:\'40 国\''), false);
  assert.equal(browserSource.includes('var mockResults='), false);
  assert.equal(browserSource.includes('全球平台增长总结'), false);
  assert.equal(browserSource.includes('function openAlertSettings()'), false);
  assert.equal(browserSource.includes('function alBatchWatch()'), false);
  const generatorSource = fs.readFileSync(path.join(root, 'scripts', 'generate_alerts.py'), 'utf8');
  assert.equal(generatorSource.includes('def generate_from_us_market()'), false);
  assert.match(generatorSource, /source_record_id/);
  assert.match(generatorSource, /GENERATOR_VERSION\s*=\s*["']2026\.09\.08\.1["']/);
  assert.match(generatorSource, /source_record_evidence/);
  assert.match(generatorSource, /dataset_snapshot_id/);
  assert.match(generatorSource, /matched_record_count/);
  assert.match(generatorSource, /def serialize_alert\(alert\)/);
  assert.match(generatorSource, /def normalize_existing_alert\(alert\)/);
  assert.match(generatorSource, /evidence_hash/);
  assert.match(generatorSource, /row = serialize_alert\(a\)/);
  assert.match(generatorSource, /normalized := normalize_existing_alert\(alert\)/);
  const validatorSource = fs.readFileSync(path.join(root, 'scripts', 'validate_data.py'), 'utf8');
  assert.match(validatorSource, /display date is the alert's publication\/event date/);
  assert.match(validatorSource, /invalid_aggregate_lineage_records/);
  assert.doesNotMatch(validatorSource, /"collected_at": row\[7\]/);
  const alertRows = JSON.parse(fs.readFileSync(path.join(root, 'data', 'alerts.json'), 'utf8'));
  assert.equal(alertRows.some((row) => Array.isArray(row) && /^(a\d+|usm-)/i.test(String(row[0] || ''))), false);
  assert.equal(alertRows.every((row) => /[\u3400-\u9fff]/.test(String(row[3])) && /[\u3400-\u9fff]/.test(String(row[6]))), true);
  assert.equal(html.includes('<option value="all">全部市场</option>'), false);
  const catalogSource = fs.readFileSync(path.join(root, 'assets/js/catalog.js'), 'utf8');
  const countrySource = fs.readFileSync(path.join(root, 'assets/js/products-shops.js'), 'utf8');
  const contentSource = fs.readFileSync(path.join(root, 'assets/js/content-overview.js'), 'utf8');
  const policySource = fs.readFileSync(path.join(root, 'assets/js/markets-policies.js'), 'utf8');
  const reportsSource = fs.readFileSync(path.join(root, 'assets/js/reports-decisions.js'), 'utf8');
  const searchSource = fs.readFileSync(path.join(root, 'assets/js/unified-search.js'), 'utf8');
  assert.match(catalogSource, /function jaySafeHttpsUrl\(value\)/);
  assert.match(catalogSource, /parsed\.protocol!==['"]https:/);
  assert.match(contentSource, /displayKw=escapeHtml\(kw\)/);
  assert.match(countrySource, /replaceChildren\(\)/);
  assert.match(countrySource, /textContent=String\(i\)/);
  assert.match(countrySource, /textContent=String\(t&&t\.name\|\|['"]['"]\)/);
  assert.match(searchSource, /title\.textContent = item\.record\.title/);
  assert.match(searchSource, /meta\.textContent = TYPE_META\[item\.record\.type\]\.label/);
  assert.doesNotMatch(searchSource, /\.innerHTML\s*=/);
  assert.match(policySource, /jaySafeHttpsUrl\(p\.source_url\)/);
  assert.match(policySource, /jaySafeHttpsUrl\(r\.source_url\)/);
  assert.match(policySource, /function plRenderDataLineage\(record,evidence,options\)/);
  assert.match(policySource, /plFormatLineageTime\(record\.collected_at\|\|record\.collectedAt\)/);
  assert.match(policySource, /source_record_id\|\|record\.sourceRecordId/);
  assert.match(policySource, /evidence_hash\|\|record\.evidenceHash/);
  assert.match(policySource, /plRenderDataLineage\(p,evidence/);
  assert.match(policySource, /plRenderDataLineage\(r,evidence/);
  assert.match(policySource, /plRenderDataLineage\(r,plAssessEvidence\(r\)/);
  assert.doesNotMatch(policySource, /可信度\s*[:：]\s*40%/);
  assert.doesNotMatch(policySource, /href="\$\{r\.source_url\}/);
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
  assert.match(migration, /to_jsonb\(NEW\)->>'report_run_id'/);
  assert.match(migration, /to_jsonb\(NEW\)->>'report_id'/);
  const triggerFix = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260901020000_fix_report_run_owner_trigger.sql'), 'utf8');
  assert.match(triggerFix, /CREATE OR REPLACE FUNCTION public\.enforce_report_run_owner_links/);
  assert.match(triggerFix, /to_jsonb\(NEW\)->>'report_run_id'/);
  assert.match(triggerFix, /to_jsonb\(NEW\)->>'report_id'/);
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
  const operationsWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'operations.yml'), 'utf8');
  const preflight = fs.readFileSync(path.join(root, 'scripts', 'release_preflight.py'), 'utf8');
  const releaseCheck = fs.readFileSync(path.join(root, 'scripts', 'production_release_check.py'), 'utf8');
  const healthCheck = fs.readFileSync(path.join(root, 'scripts', 'production_health_check.py'), 'utf8');
  assert.match(preflight, /production release must run from main/);
  assert.match(preflight, /worktree is dirty/);
  assert.match(preflight, /ALLOWED_ORIGINS must contain only the production origin/);
  assert.match(preflight, /INSERT INTO storage\.buckets/);
  assert.match(releaseCheck, /release manifest unavailable/);
  assert.match(releaseCheck, /frontend release/);
  assert.match(releaseCheck, /backend acceptance result does not match/);
  assert.match(releaseCheck, /JAY_SUPABASE_URL/);
  assert.match(releaseCheck, /assets\/js\/catalog\.js/);
  assert.match(releaseCheck, /Edge Function/);
  assert.match(releaseCheck, /X-JAY-Release/);
  assert.match(releaseCheck, /storage_bucket/);
  const migrationsAt = workflow.indexOf('Apply database migrations before functions');
  const dataSyncAt = workflow.indexOf('Sync validated market data and provenance');
  const functionsAt = workflow.indexOf('Deploy JWT-protected Edge Functions');
  const acceptanceAt = workflow.indexOf('Run two-account production report acceptance');
  const frontendAt = workflow.indexOf('Assemble static site after backend acceptance');
  assert.ok(migrationsAt > 0);
  assert.ok(dataSyncAt > migrationsAt);
  assert.ok(functionsAt > dataSyncAt);
  assert.ok(acceptanceAt > functionsAt);
  assert.ok(frontendAt > acceptanceAt);
  assert.match(workflow, /needs: deploy-backend/);
  assert.match(workflow, /needs: authenticated-acceptance/);
  assert.match(workflow, /PROD_TEST_USER_A_EMAIL/);
  assert.match(workflow, /PROD_TEST_USER_B_EMAIL/);
  assert.match(workflow, /Verify release ref, worktree and migration ordering/);
  assert.match(workflow, /Validate formal production origin/);
  assert.match(workflow, /Verify remote migration head/);
  assert.match(workflow, /python scripts\/sync_to_supabase\.py/);
  assert.match(workflow, /Upload browser acceptance diagnostics/);
  assert.match(workflow, /browser-acceptance-diagnostics-/);
  assert.match(workflow, /SUPABASE_SERVICE_KEY/);
  assert.doesNotMatch(workflow, /SUPABASE_SERVICE_KEY:\s*\$\{\{\s*secrets\.SUPABASE_SERVICE_KEY/);
  assert.doesNotMatch(operationsWorkflow, /SUPABASE_SERVICE_KEY:\s*\$\{\{\s*secrets\.SUPABASE_SERVICE_KEY/);
  assert.match(workflow, /SUPABASE_URL: \$\{\{ format\('https:\/\/\{0\}\.supabase\.co', secrets\.SUPABASE_PROJECT_ID\) \}\}/);
  assert.match(workflow, /migration list --linked/);
  assert.match(workflow, /RELEASE_SHA/);
  assert.match(workflow, /RELEASE_MIGRATION_HEAD/);
  assert.match(workflow, /Write release manifest/);
  assert.match(workflow, /release\.json/);
  assert.match(workflow, /production-acceptance-result-\$\{\{ github\.run_id \}\}/);
  assert.match(workflow, /production_release_check\.py/);
  assert.match(releaseCheck, /market_catalog/);
  assert.match(releaseCheck, /market_data_applicability/);
  assert.doesNotMatch(workflow, /rest\/v1\/market_data\?select=id&limit=1/);
  assert.match(operationsWorkflow, /code-health:/);
  assert.match(operationsWorkflow, /data-quality:/);
  assert.match(operationsWorkflow, /validate_data\.py --report operations-data-quality-result\.json/);
  assert.match(operationsWorkflow, /availability-monitor:/);
  assert.match(operationsWorkflow, /if: \$\{\{ always\(\) \}\}/);
  assert.match(operationsWorkflow, /python scripts\/production_health_check\.py/);
  assert.match(operationsWorkflow, /production-health-result\.json/);
  const availabilityJob = operationsWorkflow.slice(operationsWorkflow.indexOf('  availability-monitor:'), operationsWorkflow.indexOf('  encrypted-backup:'));
  assert.doesNotMatch(availabilityJob, /\n\s+needs:/);
  assert.doesNotMatch(healthCheck, /probe_data_quality/);
  assert.match(healthCheck, /"frontend": probe_frontend/);
  assert.match(healthCheck, /"database": probe_database/);
  assert.match(healthCheck, /"storage": probe_storage/);
  assert.match(healthCheck, /"edge_functions": probe_edge_functions/);
  assert.match(healthCheck, /Keep every remaining availability probe running/);

  const acceptance = fs.readFileSync(path.join(root, 'scripts', 'production_acceptance.py'), 'utf8');
  assert.match(acceptance, /account B can read account A report/);
  assert.match(acceptance, /account A can read account B report/);
  assert.match(acceptance, /account B can sign account A/);
  assert.match(acceptance, /account A can sign account B/);
  assert.match(acceptance, /saved report did not recover after re-login/);
  assert.match(acceptance, /report-export/);
  assert.match(acceptance, /report-docx/);
  assert.match(acceptance, /report-save/);
  assert.match(acceptance, /direct formal report write was not rejected/);
  assert.match(acceptance, /storage_bucket/);
  assert.match(acceptance, /PRODUCTION_ACCEPTANCE_OUTPUT/);
  assert.match(acceptance, /acceptance_run_id/);
  assert.match(acceptance, /reusable_export_key/);
  assert.match(acceptance, /idempotency_key.*not\.is\.null/);
  assert.match(acceptance, /acceptance_fault_headers/);
  assert.match(acceptance, /AI_PROVIDER_TIMEOUT/);
  assert.match(acceptance, /AI_QUOTA_EXCEEDED/);
  assert.match(acceptance, /AI_RATE_LIMITED/);
  assert.match(acceptance, /ThreadPoolExecutor/);
  assert.match(acceptance, /duplicate_generation/);
  assert.match(acceptance, /duplicate_exports/);

  const pdfExportFunction = fs.readFileSync(path.join(root, 'supabase', 'functions', 'report-export', 'index.ts'), 'utf8');
  const docxExportFunction = fs.readFileSync(path.join(root, 'supabase', 'functions', 'report-docx', 'index.ts'), 'utf8');
  assert.match(pdfExportFunction, /EXPORT_QUOTA_EXCEEDED[\s\S]*429/);
  assert.match(docxExportFunction, /EXPORT_QUOTA_EXCEEDED[\s\S]*429/);
  assert.match(pdfExportFunction, /resolution=ignore-duplicates,return=representation/);
  assert.match(docxExportFunction, /resolution=ignore-duplicates,return=representation/);
  assert.match(pdfExportFunction, /on_conflict.*user_id,idempotency_key/);
  assert.match(docxExportFunction, /on_conflict.*user_id,idempotency_key/);

  const aiProxyFunction = fs.readFileSync(path.join(root, 'supabase', 'functions', 'ai-proxy', 'index.ts'), 'utf8');
  assert.match(aiProxyFunction, /verifyProductionAcceptanceFault/);
  assert.match(aiProxyFunction, /acceptanceScenario === 'provider_timeout'/);
  assert.match(aiProxyFunction, /acceptanceScenario === 'quota'/);
  assert.match(aiProxyFunction, /acceptanceScenario === 'rate_limit'/);

  const browserAcceptance = fs.readFileSync(path.join(root, 'tests', 'production-auth.spec.cjs'), 'utf8');
  assert.match(browserAcceptance, /RUN_PRODUCTION_ACCEPTANCE/);
  assert.match(browserAcceptance, /saved_workspace_items/);
  assert.match(browserAcceptance, /生产浏览器验收/);
  assert.match(browserAcceptance, /rpV2Questionnaire/);
  assert.match(browserAcceptance, /rpV2Export\([^)]*pdf[^)]*\)/);
  assert.match(browserAcceptance, /rpV2Export\([^)]*docx[^)]*\)/);
  assert.match(browserAcceptance, /report_exports/);
  assert.match(browserAcceptance, /internetdisconnected/);
  assert.match(browserAcceptance, /recovered_with_production_response/);
  const browserJobAt = workflow.indexOf('browser-authenticated-acceptance:');
  const browserRunAt = workflow.indexOf('Run real browser exception and account-isolation acceptance');
  const smokeAt = workflow.indexOf('production-smoke:');
  assert.ok(browserJobAt > frontendAt);
  assert.ok(browserRunAt > browserJobAt);
  assert.ok(smokeAt > browserJobAt);
  assert.match(workflow, /needs: browser-authenticated-acceptance/);
  assert.match(workflow, /BROWSER_ACCEPTANCE_RESULT_FILE/);
  assert.match(workflow, /production-browser-acceptance-result-/);

  const config = fs.readFileSync(path.join(root, 'supabase', 'config.toml'), 'utf8');
  assert.match(config, /\[functions\.report-docx\][\s\S]*verify_jwt = true/);
  assert.match(config, /\[functions\.report-save\][\s\S]*verify_jwt = true/);
  assert.match(config, /\[functions\.billing-status\][\s\S]*verify_jwt = true/);
  assert.match(config, /\[functions\.billing-portal\][\s\S]*verify_jwt = true/);
  assert.match(config, /\[functions\.billing-webhook\][\s\S]*verify_jwt = false/);
  for (const functionName of ['ai-proxy', 'report-save', 'report-export', 'report-docx', 'admin-summary']) {
    const functionSource = fs.readFileSync(path.join(root, 'supabase', 'functions', functionName, 'index.ts'), 'utf8');
    assert.match(functionSource, /X-JAY-Release/);
    assert.match(functionSource, /RELEASE_SHA/);
  }
  const billingShared = fs.readFileSync(path.join(root, 'supabase', 'functions', '_shared', 'billing.ts'), 'utf8');
  assert.match(billingShared, /X-JAY-Release/);
  assert.match(billingShared, /RELEASE_SHA/);
  for (const functionName of ['billing-checkout', 'billing-status', 'billing-portal', 'billing-webhook']) {
    const functionSource = fs.readFileSync(path.join(root, 'supabase', 'functions', functionName, 'index.ts'), 'utf8');
    assert.match(functionSource, /\.\.\/_shared\/billing\.ts/);
  }
});

test('formal report publication is server validated and client writes stay draft-only', () => {
  const validation = fs.readFileSync(path.join(root, 'supabase', 'functions', '_shared', 'report-validation.ts'), 'utf8');
  const save = fs.readFileSync(path.join(root, 'supabase', 'functions', 'report-save', 'index.ts'), 'utf8');
  const pdf = fs.readFileSync(path.join(root, 'supabase', 'functions', 'report-export', 'index.ts'), 'utf8');
  const docx = fs.readFileSync(path.join(root, 'supabase', 'functions', 'report-docx', 'index.ts'), 'utf8');
  const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260908010000_report_server_validation.sql'), 'utf8');
  const authData = fs.readFileSync(path.join(root, 'assets', 'js', 'auth-data.js'), 'utf8');
  assert.match(validation, /validateFormalReportWithServerData/);
  assert.match(validation, /COVERAGE_EVIDENCE_MISSING/);
  assert.match(validation, /REPORT_TEXT_MISMATCH/);
  assert.match(save, /REPORT_VALIDATION_VERSION/);
  assert.match(save, /publication_status:\s*'formal'/);
  assert.match(pdf, /validateFormalReportWithServerData/);
  assert.match(docx, /validateFormalReportWithServerData/);
  assert.match(migration, /generated_reports_insert_draft_own/);
  assert.match(migration, /COALESCE\(content->'publishable'/);
  assert.match(authData, /jayFunctionRequest\('report-save'/);
  assert.doesNotMatch(authData.match(/async function jayPersistGeneratedReport[\s\S]*?\n\}/)?.[0] || '', /jayDbUpsert\('generated_reports'/);
});

test('report generation retries a chapter that fails inline citation validation', () => {
  assert.match(browserSource, /auditCitations\(\[\{id:section\.id,text:output\}\]/);
  assert.match(browserSource, /citation-retry/);
  assert.match(browserSource, /表格增加“来源”列/);
  assert.match(browserSource, /repairSectionCitations\(retryOutput/);
});
