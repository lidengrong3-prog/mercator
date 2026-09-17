import { evaluateQualityReport, reportContentAllowsFormalOutput } from './report-quality.ts';

function completeCoverage() {
  return {
    requiredDomains: ['market'],
    requiredPlatformRuleDimensions: [],
    cells: [{ id: 'US|*|generic|market', domain: 'market', covered: true }],
    missingCells: [], totalCells: 1, coveredCells: 1, coveragePercent: 100, ok: true,
  };
}

Deno.test('fresh quality snapshot permits formal report output', () => {
  const gate = evaluateQualityReport({
    schema_version: 1,
    generated_at: '2026-09-08T07:30:00Z',
    status: 'degraded',
    publishable: true,
    datasets: { taxes: { status: 'not_connected' } },
  }, Date.parse('2026-09-08T08:00:00Z'));
  if (!gate.ok) throw new Error(`expected gate to pass: ${gate.reasons.join(',')}`);
  if (!reportContentAllowsFormalOutput({ publishable: true, quality_gate: gate, quality_snapshot: gate.snapshot, coverage_matrix: completeCoverage() })) {
    throw new Error('expected stored report quality contract to pass');
  }
});

Deno.test('scope coverage blocks incomplete platform rules independently of a degraded global status', () => {
  const gate = evaluateQualityReport({
    schema_version: 1,
    generated_at: '2026-09-08T07:30:00Z',
    status: 'degraded',
    publishable: true,
    datasets: { taxes: { status: 'not_connected' } },
  }, Date.parse('2026-09-08T08:00:00Z'));
  const dimensions = ['fee', 'commission', 'deposit', 'fulfillment', 'prohibited', 'settlement', 'penalty'];
  const cell = { id: 'US|amazon|generic|platform', domain: 'platform', covered: false, ruleDimensions: dimensions.slice(0, 6), missingRuleDimensions: ['penalty'] };
  const coverage = { requiredDomains: ['tax', 'access', 'platform', 'rule'], requiredPlatformRuleDimensions: dimensions, cells: [cell], missingCells: [cell], totalCells: 1, coveredCells: 0, coveragePercent: 0, ok: false };
  if (reportContentAllowsFormalOutput({ publishable: true, quality_gate: gate, quality_snapshot: gate.snapshot, coverage_matrix: coverage })) throw new Error('partial platform coverage must be blocked');
  const completeCell = { ...cell, covered: true, ruleDimensions: dimensions, missingRuleDimensions: [] };
  const complete = { ...coverage, cells: [completeCell], missingCells: [], coveredCells: 1, coveragePercent: 100, ok: true };
  if (!reportContentAllowsFormalOutput({ publishable: true, quality_gate: gate, quality_snapshot: gate.snapshot, coverage_matrix: complete })) throw new Error('complete scope coverage should pass despite unrelated degraded datasets');
});
Deno.test('stale quality snapshot blocks formal report output', () => {
  const gate = evaluateQualityReport({
    schema_version: 1,
    generated_at: '2026-09-07T00:00:00Z',
    status: 'healthy',
    publishable: true,
    datasets: {},
  }, Date.parse('2026-09-08T08:00:00Z'));
  if (gate.ok || !gate.stale) throw new Error('expected stale gate to fail');
  if (reportContentAllowsFormalOutput({ publishable: true, quality_gate: gate, quality_snapshot: gate.snapshot })) {
    throw new Error('stale report must not be formally exported');
  }
});
