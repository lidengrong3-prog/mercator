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

test('report data check marks empty tax and access domains as non-deterministic', () => {
  const plan = { requiredDomains: ['market'], sections: [] };
  const result = engine.checkData(plan, { scope: { marketCodes: ['US'], platformKeys: ['amazon'] }, records: {} });
  assert.deepEqual(Array.from(result.blockedDomains), ['tax', 'access']);
  assert.ok(result.warnings.some((item) => item.domain === 'tax' && /禁止生成确定性/.test(item.reason)));
  assert.ok(result.warnings.some((item) => item.domain === 'access' && /禁止生成确定性/.test(item.reason)));
});

test('section prompts assign stable source citations and snapshot metadata', () => {
  const sourceRecord = {
    domain: 'policy', source: 'FTC', url: 'https://www.ftc.gov/example',
    recordId: 'policy-us-001', verificationStatus: 'verified', snapshotAt: '2026-09-01T00:00:00Z',
  };
  const facts = {
    scope: { marketCodes: ['US'], platformKeys: ['amazon'] },
    collectedAt: '2026-09-02T00:00:00Z',
    sources: [sourceRecord],
    records: { policy: [{ domain: 'policy', record: { id: 'policy-us-001', title: 'FTC rule', value: '8%' }, source: sourceRecord }] },
  };
  const prompt = engine.buildSectionPrompt({}, { id: 'policy', title: '政策', domain: 'policy' }, facts, null, '');
  const payload = JSON.parse(prompt.user);
  assert.equal(payload.citationCatalog[0].citation, 'S001');
  assert.equal(payload.facts[0].source.citation, 'S001');
  assert.equal(payload.facts[0].source.dataSnapshotAt, '2026-09-01T00:00:00Z');
  assert.match(prompt.system, /关键数字必须.*\[S001\]/);
  assert.match(prompt.system, /表格必须增加“来源”列/);
});

test('cross-domain section prompts stay below the production size limit and keep balanced evidence', () => {
  const records = {};
  const sources = [];
  for (const domain of ['market', 'policy', 'platform', 'rule']) {
    records[domain] = Array.from({ length: 90 }, (_, index) => {
      const sourceRecord = {
        domain,
        source: `${domain}-source`,
        url: `https://example.gov/${domain}/${index}`,
        recordId: `${domain}-${index}`,
        verificationStatus: 'verified',
        snapshotAt: '2026-09-03T00:00:00Z',
      };
      sources.push(sourceRecord);
      return {
        domain,
        record: {
          id: `${domain}-${index}`,
          title: `English ${domain} ${index}`,
          title_zh: `${domain} 中文标题 ${index}`,
          summary: 'source language '.repeat(100),
          summary_zh: `中文核验摘要 ${index} ` + '有效事实 '.repeat(100),
        },
        source: sourceRecord,
      };
    });
  }
  const prompt = engine.buildSectionPrompt({}, { id: 'executive_summary', title: '执行摘要', domain: 'summary' }, {
    scope: { marketCodes: ['US'], platformKeys: ['amazon'] },
    records,
    sources,
    collectedAt: '2026-09-03T00:00:00Z',
  }, null, '自定义要求'.repeat(1000));
  const payload = JSON.parse(prompt.user);
  assert.ok(prompt.user.length <= 24_000);
  assert.ok(payload.facts.length > 0);
  assert.deepEqual(Array.from(new Set(payload.facts.slice(0, 4).map((entry) => entry.domain))), ['market', 'policy', 'platform', 'rule']);
  assert.ok(payload.facts.every((entry) => entry.source.citation));
  assert.ok(payload.citationCatalog.length > 0);
  assert.ok(payload.custom.length <= 2_000);
  assert.equal(Object.prototype.hasOwnProperty.call(payload.facts[0].record, 'title'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(payload.facts[0].record, 'summary'), false);
});

test('citation audit rejects unknown citations and uncited key numbers', () => {
  const appendix = [{ citation: 'S001' }];
  const result = engine.auditCitations([
    { id: 'market', text: '市场增速为 12%。\n另一项为 8% [S999]' },
  ], appendix);
  assert.equal(result.ok, false);
  assert.equal(result.missingNumericCitations.length, 2);
  assert.deepEqual(Array.from(result.invalidCitations, (item) => item.citation), ['S999']);
});

test('citation audit exempts generated snapshot dates but not unsupported metrics on the same line', () => {
  const appendix = [{ citation: 'S001' }];
  const result = engine.auditCitations([
    { id: 'consumer', text: '数据快照时间为 2026年9月3日04:41:15 UTC，当前数据尚未接入。' },
    { id: 'market', text: '数据快照时间为 2026年9月3日，销售额为100万美元。' },
  ], appendix);
  assert.equal(result.ok, false);
  assert.equal(result.missingNumericCitations.length, 1);
  assert.match(result.missingNumericCitations[0].text, /100万美元/);
});

test('scope check rejects unselected market and platform names', () => {
  const result = engine.checkScope('美国市场、Amazon、Shopee全球排名', { marketNames: ['美国'], platformNames: ['Amazon'] });
  assert.equal(result.ok, false);
  assert.deepEqual(Array.from(result.violations), ['全球', 'shopee']);
});
