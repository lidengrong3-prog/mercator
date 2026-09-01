const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'report-engine.js'), 'utf8');
const window = {};
vm.runInNewContext(source, { window, Date, Intl, console, isFinite, Number, String, Math, Object, Array, RegExp });
const engine = window.JAY_REPORT_ENGINE;

test('report engine calculates financial output and sensitivity deterministically', () => {
  const result = engine.calculateFinancialModel({
    sellingPrice: 100, productCost: 20, logisticsCost: 10,
    platformFeeRate: 15, taxRate: 5, adCost: 5,
    monthlyUnits: 10, initialInvestment: 300,
  });
  assert.equal(result.status, 'complete');
  assert.equal(result.totalCost, 55);
  assert.equal(result.unitProfit, 45);
  assert.equal(result.margin, 45);
  assert.equal(result.sensitivity.length, 3);
});

test('report engine blocks incomplete financial inputs', () => {
  const result = engine.calculateFinancialModel({ sellingPrice: 100, productCost: 20 });
  assert.equal(result.status, 'incomplete');
  assert.deepEqual(Array.from(result.missing), ['logisticsCost', 'platformFeeRate']);
});

test('multi-market plan creates per-market, platform, and category chapters', () => {
  window.JAY_MARKET_SCOPE_API = {
    getMarket: (code) => ({ US: { code: 'US', name: '美国' }, DE: { code: 'DE', name: '德国' } }[code]),
    getPlatform: (key) => ({ key, name: key === 'amazon' ? 'Amazon' : key }),
    getCategoryProfile: (code) => ({ code, name: '电子产品' }),
    normalizeMarketCode: (value) => String(value).toUpperCase(),
    normalizePlatformKey: (value) => String(value).toLowerCase(),
    normalizeCategoryCode: (value) => String(value).toLowerCase(),
  };
  const plan = engine.buildPlan({ marketCodes: ['US', 'DE'], platformKeys: ['amazon'], categoryCodes: ['electronics'] }, 'market-research', 'market-research');
  assert.ok(plan.sections.some((section) => section.id === 'market_us'));
  assert.ok(plan.sections.some((section) => section.id === 'market_de'));
  assert.ok(plan.sections.some((section) => section.id === 'platform_amazon'));
  assert.ok(plan.sections.some((section) => section.id === 'category_electronics'));
  assert.ok(plan.sections.some((section) => section.id === 'market_comparison'));
});

test('single-market and multi-category plans stay inside the selected scope', () => {
  const plan = engine.buildPlan({ marketCodes: ['US'], platformKeys: ['amazon'], categoryCodes: ['electronics', 'home'] }, 'market-research', 'market-research');
  assert.equal(plan.sections.some((section) => section.id === 'market_comparison'), false);
  assert.equal(plan.sections.some((section) => section.id === 'market_de'), false);
  assert.ok(plan.sections.some((section) => section.id === 'category_electronics'));
  assert.ok(plan.sections.some((section) => section.id === 'category_home'));
  assert.equal(plan.sections.filter((section) => section.platformKey).length, 1);
});

test('report data check blocks a scope with missing required evidence', () => {
  const plan = engine.buildPlan({ marketCodes: ['US'], platformKeys: ['amazon'], categoryCodes: ['electronics'] }, 'market-research', 'market-research');
  const result = engine.checkData(plan, { scope: plan.scope, records: {} });
  assert.equal(result.ok, false);
  assert.ok(result.missing.length > 0);
  assert.ok(result.missing.every((item) => item.reason === '当前范围没有已核验记录'));
});

test('scope check rejects unselected market and platform names', () => {
  const result = engine.checkScope('美国市场、Amazon、Shopee全球排名', { marketNames: ['美国'], platformNames: ['Amazon'] });
  assert.equal(result.ok, false);
  assert.deepEqual(Array.from(result.violations), ['全球', 'shopee']);
});
