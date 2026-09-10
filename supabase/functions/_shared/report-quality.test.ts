import { evaluateQualityReport, reportContentAllowsFormalOutput } from './report-quality.ts';

Deno.test('fresh quality snapshot permits formal report output', () => {
  const gate = evaluateQualityReport({
    schema_version: 1,
    generated_at: '2026-09-08T07:30:00Z',
    status: 'degraded',
    publishable: true,
    datasets: { taxes: { status: 'not_connected' } },
  }, Date.parse('2026-09-08T08:00:00Z'));
  if (!gate.ok) throw new Error(`expected gate to pass: ${gate.reasons.join(',')}`);
  if (!reportContentAllowsFormalOutput({ publishable: true, quality_gate: gate, quality_snapshot: gate.snapshot })) {
    throw new Error('expected stored report quality contract to pass');
  }
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
