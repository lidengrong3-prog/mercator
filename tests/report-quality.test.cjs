const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'report-quality.js'), 'utf8');
const window = {};
vm.runInNewContext(source, { window, Date, isFinite, Number, String, Object, Array });
const quality = window.JAY_REPORT_QUALITY;
const now = Date.parse('2026-09-08T08:00:00Z');

function completeCoverage() {
  return {
    requiredDomains: ['market'],
    requiredPlatformRuleDimensions: [],
    cells: [{ id: 'US|*|generic|market', domain: 'market', covered: true }],
    missingCells: [], totalCells: 1, coveredCells: 1, coveragePercent: 100, ok: true,
  };
}

function report(overrides = {}) {
  return {
    schema_version: 1,
    data_contract_version: '3.0',
    generated_at: '2026-09-08T07:30:00Z',
    status: 'degraded',
    publishable: true,
    summary: { errors: 0, warnings: 2 },
    datasets: {
      policies: { label: '政策动态', status: 'degraded', formal_records: 10, errors: [], warnings: ['部分记录待核验'] },
      taxes: { label: '税收与关税', status: 'not_connected', formal_records: 0, errors: [], warnings: ['尚未接入'] },
    },
    ...overrides,
  };
}

test('fresh publishable degraded quality passes while unavailable domains remain visible', () => {
  const gate = quality.evaluate(report(), { now });
  assert.equal(gate.ok, true);
  assert.equal(gate.status, 'degraded');
  assert.deepEqual(Array.from(gate.unavailableDatasets, (item) => item.key), ['taxes']);
  assert.equal(gate.snapshot.datasets.taxes.status, 'not_connected');
});

test('stale or explicitly non-publishable quality creates a blocking snapshot', () => {
  const stale = quality.evaluate(report({ generated_at: '2026-09-07T00:00:00Z' }), { now });
  assert.equal(stale.ok, false);
  assert.equal(stale.stale, true);
  assert.ok(stale.reasons.some((item) => item.code === 'QUALITY_REPORT_STALE'));

  const failed = quality.evaluate(report({ publishable: false }), { now });
  assert.equal(failed.ok, false);
  assert.ok(failed.reasons.some((item) => item.code === 'QUALITY_REPORT_NOT_PUBLISHABLE'));
});

test('formal output requires a successful embedded quality gate and snapshot', () => {
  const gate = quality.evaluate(report(), { now });
  assert.equal(quality.allowsStoredReport({ publishable: true, quality_gate: gate, quality_snapshot: gate.snapshot, coverage_matrix: completeCoverage() }), true);
  assert.equal(quality.allowsStoredReport({ publishable: true }), false);
  assert.equal(quality.allowsStoredReport({ publishable: true, quality_gate: gate, quality_snapshot: gate.snapshot }), false);
  assert.equal(quality.allowsStoredReport({ publishable: false, quality_gate: gate, quality_snapshot: gate.snapshot }), false);
  const blocked = quality.evaluate(report({ status: 'failed', publishable: false }), { now });
  assert.equal(quality.allowsStoredReport({ publishable: true, quality_gate: blocked, quality_snapshot: blocked.snapshot, coverage_matrix: completeCoverage() }), false);
});

test('formal output rejects incomplete platform rule dimensions even when global quality is degraded but publishable', () => {
  const gate = quality.evaluate(report(), { now });
  const dimensions = ['fee', 'commission', 'deposit', 'fulfillment', 'prohibited', 'settlement', 'penalty'];
  const matrix = completeCoverage();
  matrix.requiredDomains = ['tax', 'access', 'platform', 'rule'];
  matrix.requiredPlatformRuleDimensions = dimensions;
  matrix.cells = [{ id: 'US|amazon|generic|platform', domain: 'platform', covered: false, ruleDimensions: dimensions.slice(0, 6), missingRuleDimensions: ['penalty'] }];
  matrix.missingCells = [matrix.cells[0]];
  matrix.coveredCells = 0;
  matrix.ok = false;
  assert.equal(quality.allowsStoredReport({ publishable: true, quality_gate: gate, quality_snapshot: gate.snapshot, coverage_matrix: matrix }), false);
  matrix.cells[0] = { ...matrix.cells[0], covered: true, ruleDimensions: dimensions, missingRuleDimensions: [] };
  matrix.missingCells = [];
  matrix.coveredCells = 1;
  matrix.ok = true;
  assert.equal(quality.allowsStoredReport({ publishable: true, quality_gate: gate, quality_snapshot: gate.snapshot, coverage_matrix: matrix }), true);
});

test('content quality reports four dimensions and passes traceable structured content', () => {
  const assessment = quality.assessContent({
    model: {
      sections: [
        { id: 'summary', title: '摘要', text: '美国市场规模为 100 万美元 [S001]' },
        { id: 'actions', title: '行动清单', text: '1. 核验准入要求 [S001]\n2. 完成上架准备 [S001]' },
      ],
    },
    source_appendix: [{ citation: 'S001', source: '官方来源', url: 'https://example.test/source' }],
    citation_audit: { ok: true },
    reconciliation: { ok: true },
    scope_check: { ok: true },
  }, { now: '2026-09-08T08:00:00.000Z' });

  assert.equal(assessment.ok, true);
  assert.equal(assessment.status, 'passed');
  assert.deepEqual(Object.keys(assessment.dimensions).sort(), ['accuracy', 'completeness', 'executability', 'sourceCoverage'].sort());
  assert.equal(assessment.dimensions.sourceCoverage, 100);
  assert.equal(assessment.dimensions.completeness, 100);
});

test('content quality blocks uncited facts and missing report chapters', () => {
  const assessment = quality.assessContent({ model: { sections: [{ id: 'summary', title: '摘要', text: '市场规模为 100 万美元' }] } }, { now: '2026-09-08T08:00:00.000Z' });
  assert.equal(assessment.ok, false);
  assert.equal(assessment.status, 'needs_review');
  assert.equal(assessment.dimensions.sourceCoverage, 0);
  assert.ok(assessment.reasons.includes('来源覆盖率低于 80%'));

  const empty = quality.assessContent({ model: { sections: [] } }, { now: '2026-09-08T08:00:00.000Z' });
  assert.equal(empty.ok, false);
  assert.ok(empty.reasons.includes('报告缺少结构化章节'));
});
