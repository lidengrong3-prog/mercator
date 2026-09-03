const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'acceptance_scenarios.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data', 'market_scope.json'), 'utf8'));
const scopeSource = fs.readFileSync(path.join(root, 'assets', 'js', 'market-scope.js'), 'utf8');
const reportSource = fs.readFileSync(path.join(root, 'assets', 'js', 'report-engine.js'), 'utf8');

function createEnvironment() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  const window = dom.window;
  const sandbox = { window, document: window.document, console, Date, Intl, isFinite, Number, String, Math, Object, Array, RegExp };
  vm.runInNewContext(scopeSource, sandbox);
  const api = window.JAY_MARKET_SCOPE_API;
  assert.ok(api, 'market scope API should load');
  assert.equal(api.hydrateCatalog({ ...manifest, marketPlatforms: manifest.market_platforms }), true);
  vm.runInNewContext(reportSource, sandbox);
  const engine = window.JAY_REPORT_ENGINE;
  assert.ok(engine, 'report engine should load');
  return { window, api, engine };
}

function records(domain) {
  return (fixture.records[domain] || []).map((item) => ({ ...item }));
}

function setScope(api, markets, platforms, categories) {
  assert.equal(api.setActiveMarkets(markets), true);
  assert.equal(api.setActivePlatforms(platforms), true);
  assert.equal(api.setActiveCategories(categories), true);
  return api.getActiveContext();
}

test('US acceptance scope exposes four configured platforms and requested categories', () => {
  const { api, engine } = createEnvironment();
  const context = setScope(api, ['US'], ['amazon', 'tiktok-shop'], ['pet-supplies', 'beauty', 'electronics', 'home']);
  assert.deepEqual(Array.from(context.marketCodes), ['US']);
  assert.deepEqual(Array.from(context.platformKeys), ['amazon', 'tiktok-shop']);
  assert.deepEqual(Array.from(api.getConfiguredMarketPlatforms('US'), (item) => item.key), ['amazon', 'tiktok-shop', 'aliexpress', 'ebay']);
  assert.equal(api.normalizeCategoryCode('宠物用品'), 'pet-supplies');
  assert.equal(api.normalizeCategoryCode('家居产品'), 'home');
  const plan = engine.buildPlan(context, 'market-research', 'market-research');
  assert.ok(plan.sections.some((section) => section.id === 'platform_amazon'));
  assert.ok(plan.sections.some((section) => section.id === 'platform_tiktok-shop'));
  assert.ok(plan.sections.some((section) => section.id === 'category_pet-supplies'));
});

test('Indonesia acceptance scope exposes TikTok Shop, Shopee and Lazada only', () => {
  const { api, engine } = createEnvironment();
  const context = setScope(api, ['ID'], ['tiktok-shop', 'shopee', 'lazada'], ['apparel', 'beauty', 'electronics', 'home']);
  assert.deepEqual(Array.from(context.marketCodes), ['ID']);
  assert.deepEqual(Array.from(context.platformKeys), ['tiktok-shop', 'shopee', 'lazada']);
  assert.deepEqual(Array.from(api.getConfiguredMarketPlatforms('ID'), (item) => item.key), ['tiktok-shop', 'shopee', 'lazada']);
  assert.equal(api.normalizeMarketCode('印度尼西亚'), 'ID');
  const plan = engine.buildPlan(context, 'market-research', 'market-research');
  assert.ok(plan.sections.some((section) => section.id === 'platform_shopee'));
  assert.ok(plan.sections.some((section) => section.id === 'platform_lazada'));
  assert.equal(plan.sections.some((section) => section.id === 'platform_amazon'), false);
});

test('the same platform uses market-specific rules', () => {
  const { window, api, engine } = createEnvironment();
  const context = setScope(api, ['US', 'ID'], ['tiktok-shop'], ['beauty']);
  window.rulesJsonData = { items: records('rules') };
  const facts = engine.collectFacts(context, []);
  const rules = facts.records.rule.map((entry) => entry.record);
  assert.deepEqual(Array.from(rules, (item) => item.market_codes[0]).sort(), ['ID', 'US']);
  assert.notEqual(rules[0].summary, rules[1].summary);
});

test('the same category keeps market-specific tax and access records', () => {
  const { window, api, engine } = createEnvironment();
  const context = setScope(api, ['US', 'ID'], ['tiktok-shop'], ['beauty']);
  window.taxesJsonData = { items: records('taxes') };
  window.accessRequirementsJsonData = { items: records('access') };
  const facts = engine.collectFacts(context, []);
  assert.deepEqual(Array.from(facts.records.tax, (entry) => entry.record.value).sort(), [0.08, 0.11]);
  assert.deepEqual(Array.from(facts.records.access, (entry) => entry.record.requirement_type).sort(), ['labeling', 'registration']);
});

test('multi-market and multi-category plan creates comparison and scoped chapters', () => {
  const { api, engine } = createEnvironment();
  const context = setScope(api, ['US', 'ID'], ['tiktok-shop'], ['beauty', 'electronics']);
  const plan = engine.buildPlan(context, 'market-research', 'market-research');
  assert.ok(plan.sections.some((section) => section.id === 'market_comparison'));
  assert.ok(plan.sections.some((section) => section.id === 'market_us'));
  assert.ok(plan.sections.some((section) => section.id === 'market_id'));
  assert.ok(plan.sections.some((section) => section.id === 'category_beauty'));
  assert.ok(plan.sections.some((section) => section.id === 'category_electronics'));
});

test('policy-only scope has no product facts and prompt forbids fabricated rankings', () => {
  const { window, api, engine } = createEnvironment();
  const context = setScope(api, ['US'], ['amazon'], ['beauty']);
  window.policiesJsonData = { items: records('policies').filter((item) => item.market_codes[0] === 'US') };
  const facts = engine.collectFacts(context, []);
  assert.equal(Object.prototype.hasOwnProperty.call(facts.records, 'product'), false);
  const plan = engine.buildPlan(context, 'market-research', 'market-research');
  const competitor = plan.sections.find((section) => section.domain === 'competitor');
  const prompt = engine.buildSectionPrompt(plan, competitor, facts, { status: 'not_available' });
  assert.match(prompt.system, /禁止.*排名/);
  assert.match(prompt.system, /待补充/);
});

test('report facts exclude records without explicit provenance and third-party advisories', () => {
  const { window, api, engine } = createEnvironment();
  const context = setScope(api, ['US'], ['amazon'], ['beauty']);
  window.policiesJsonData = { items: [
    {
      id: 'legacy-policy', title: 'Legacy policy', title_zh: '旧政策', summary: 'Legacy', summary_zh: '旧政策',
      market_codes: ['US'], category_codes: ['beauty'], source_url: 'https://example.gov/legacy',
      published_at: '2026-08-30', collected_at: '2026-08-31T00:00:00.000Z',
    },
    {
      id: 'advisory-policy', title: '美国行业动态', title_zh: '美国行业动态', summary: '行业资讯', summary_zh: '行业资讯',
      market_codes: ['US'], category_codes: ['beauty'], source: '雨果网', source_url: 'https://www.cifnews.com/article/1',
      source_kind: 'traceable', source_type: 'licensed_provider', source_record_id: 'advisory-policy', verification_status: 'pending',
      published_at: '2026-08-30', collected_at: '2026-08-31T00:00:00.000Z', evidence_hash: 'a'.repeat(64),
    },
  ] };
  const facts = engine.collectFacts(context, []);
  assert.equal(facts.records.policy, undefined);
});

test('missing cost and selling price blocks deterministic profit conclusions', () => {
  const { engine } = createEnvironment();
  const result = engine.calculateFinancialModel({ logisticsCost: 10, platformFeeRate: 15 });
  assert.equal(result.status, 'incomplete');
  assert.ok(result.missing.includes('sellingPrice'));
  assert.ok(result.missing.includes('productCost'));
});

test('global policy records do not enter a market-scoped collection', () => {
  const { window, api, engine } = createEnvironment();
  const context = setScope(api, ['US'], ['amazon'], ['beauty']);
  window.policiesJsonData = { items: records('policies') };
  const facts = engine.collectFacts(context, []);
  assert.deepEqual(Array.from(facts.records.policy, (entry) => Array.from(entry.record.market_codes)), [['US']]);
  assert.equal(facts.records.policy.some((entry) => entry.record.id === 'fixture-policy-global'), false);
});

test('assembled report carries source IDs, data snapshot time and scope snapshot', () => {
  const { window, api, engine } = createEnvironment();
  const context = setScope(api, ['US', 'ID'], ['tiktok-shop'], ['beauty']);
  window.policiesJsonData = { items: records('policies') };
  window.taxesJsonData = { items: records('taxes') };
  const facts = engine.collectFacts(context, []);
  const plan = engine.buildPlan(context, 'market-research', 'market-research');
  const check = { ok: true, recordCount: Object.values(facts.records).reduce((sum, entries) => sum + entries.length, 0), missing: [] };
  const taxCitation = engine.buildSourceAppendix(facts).find((source) => source.domain === 'tax').citation;
  const report = engine.assemble(plan, [{
    id: 'tax_beauty', title: '美妆税收', domain: 'tax', text: `美国美妆记录税率为 0.08 [${taxCitation}]`,
    claims: [{ value: '0.08' }],
  }], facts, check, { status: 'not_available' });
  assert.ok(report.dataSnapshotAt);
  assert.deepEqual(Array.from(report.scopeSnapshot.marketCodes), ['US', 'ID']);
  assert.ok(report.sourceRecordIds.includes('policy-us-beauty-20260831'));
  assert.equal(report.reconciliation.ok, true);
  assert.ok(report.sourceRecordIds.includes('tax-us-beauty-20260831'));
  assert.ok(report.sourceAppendix.every((source) => source.recordId));
  assert.equal(report.citationAudit.ok, true);
  assert.ok(report.sourceAppendix.every((source) => source.dataSnapshotAt));
});
