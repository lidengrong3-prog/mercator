import { canonicalizeFormalReportContent, canonicalReportText, validateFormalReportContent, type ReportValidationContext } from './report-validation.ts';
import type { QualityGate } from './report-quality.ts';

type Row = Record<string, unknown>;

const now = '2026-09-08T08:00:00.000Z';
const quality: QualityGate = {
  ok: true,
  status: 'healthy',
  publishable: true,
  stale: false,
  reasons: [],
  snapshot: {
    quality_report_version: '1@2026-09-08T07:30:00Z',
    generated_at: '2026-09-08T07:30:00Z',
    effective_status: 'healthy',
    publishable: true,
    stale: false,
  },
};

function assertReason(result: ReturnType<typeof validateFormalReportContent>, code: string) {
  if (!result.reasons.some((reason) => reason.code === code)) {
    throw new Error(`expected ${code}; got ${result.reasons.map((reason) => reason.code).join(',')}`);
  }
}

function context(options: { markets?: string[]; platforms?: string[]; categories?: string[]; domains?: string[]; evidence?: Row[]; materials?: Row[] } = {}): ReportValidationContext {
  const markets = options.markets || ['US'];
  const platforms = options.platforms || ['amazon'];
  const categories = options.categories || ['generic'];
  return {
    templates: [{ id: 'test-v1', code: 'test', version: 1, required_domains: options.domains || ['market', 'rule'], status: 'active' }],
    markets: markets.map((code) => ({ code, name: code === 'US' ? '美国' : '印度尼西亚', aliases: [], status: 'active' })),
    platforms: platforms.map((key) => ({ key, name: key === 'amazon' ? 'Amazon' : 'TikTok Shop', aliases: [], status: 'active' })),
    categories: categories.map((code) => ({ code, name: code, aliases: [], status: 'active' })),
    marketPlatforms: markets.flatMap((market_code) => platforms.map((platform_key) => ({ market_code, platform_key, status: 'active' }))),
    applicability: options.evidence || [],
    materials: options.materials || [],
  };
}

function content(options: { markets?: string[]; platforms?: string[]; categories?: string[]; domains?: string[]; evidence?: Row[]; appendix?: Row[] } = {}): Row {
  const markets = options.markets || ['US'];
  const platforms = options.platforms || ['amazon'];
  const categories = options.categories || ['generic'];
  const domains = options.domains || ['market', 'rule'];
  const pairs: Array<{ marketCode: string; platformKey: string | null }> = [];
  markets.forEach((marketCode) => {
    if (platforms.length) platforms.forEach((platformKey) => pairs.push({ marketCode, platformKey }));
    else pairs.push({ marketCode, platformKey: null });
  });
  const ruleDimensions = ['fee', 'commission', 'deposit', 'fulfillment', 'prohibited', 'settlement', 'penalty'];
  const requireRuleDimensions = domains.includes('platform') && domains.includes('rule');
  const cells = pairs.flatMap((pair) => categories.flatMap((categoryCode) => domains.map((domain) => {
    const matching = (options.evidence || []).filter((row) => {
      const rowDomain = String(row.domain || row.material_type || '').toLowerCase();
      if (rowDomain !== domain && !(domain === 'platform' && rowDomain === 'rule')) return false;
      if (String(row.market_code || row.snapshot_market || '').toUpperCase() !== pair.marketCode) return false;
      const rowPlatform = String(row.platform_key || row.snapshot_platform || '').toLowerCase();
      if (rowPlatform && rowPlatform !== pair.platformKey) return false;
      if (['platform', 'rule'].includes(domain) && rowPlatform !== pair.platformKey) return false;
      const rowCategory = String(row.category_code || row.snapshot_category || '').toLowerCase();
      return !rowCategory || rowCategory === categoryCode;
    });
    const sourceRecordIds = matching.map((row) => row.source_record_id || (row.metadata as Row | undefined)?.source_record_id || row.record_key || row.client_id).filter(Boolean);
    const coveredRuleDimensions = domain === 'platform' && requireRuleDimensions ? ruleDimensions.filter((dimension) => matching.some((row) => {
      const payload = row.payload && typeof row.payload === 'object' ? row.payload as Row : {};
      const values = payload.rule_dimensions && typeof payload.rule_dimensions === 'object' ? payload.rule_dimensions as Row : {};
      return String(payload.topic || row.topic || '').toLowerCase() === dimension || !!values[dimension];
    })) : [];
    const missingRuleDimensions = domain === 'platform' && requireRuleDimensions ? ruleDimensions.filter((dimension) => !coveredRuleDimensions.includes(dimension)) : [];
    return {
      id: [pair.marketCode, pair.platformKey || '*', categoryCode || '*', domain].join('|'),
      marketCode: pair.marketCode,
      platformKey: pair.platformKey,
      categoryCode,
      domain,
      covered: matching.length > 0 && missingRuleDimensions.length === 0,
      recordCount: matching.length,
      sourceRecordIds,
      ruleDimensions: coveredRuleDimensions,
      missingRuleDimensions,
    };
  })));
  const appendix = options.appendix || (options.evidence || []).map((row, index) => ({
    citation: `S${String(index + 1).padStart(3, '0')}`,
    source: `来源${index + 1}`,
    url: row.source_url || '',
    date: '2026-09-08',
    verificationStatus: row.user_id ? 'uploaded' : row.verification_status,
    recordId: row.source_record_id || row.client_id,
    evidenceHash: row.evidence_hash || '',
    chapters: ['summary'],
  }));
  const sections = [{ id: 'summary', title: '摘要', domain: 'summary', text: appendix.length ? `范围证据已接入 ${appendix.map((row) => `[${row.citation}]`).join(' ')}` : '待补充' }];
  const value: Row = {
    publishable: true,
    template_id: 'test',
    template_version: 1,
    market_codes: markets,
    platform_keys: platforms,
    category_codes: categories,
    scope_snapshot: { marketCodes: markets, platformKeys: platforms, categoryCodes: categories },
    quality_gate: quality,
    quality_snapshot: quality.snapshot,
    coverage_matrix: {
      requiredDomains: domains,
      requiredPlatformRuleDimensions: requireRuleDimensions ? ruleDimensions : [],
      dimensions: { marketCodes: markets, platformKeys: platforms, categoryCodes: categories, marketPlatformPairs: pairs },
      cells,
      missingCells: cells.filter((cell) => !cell.covered),
      totalCells: cells.length,
      coveredCells: cells.filter((cell) => cell.covered).length,
      coveragePercent: cells.length ? Math.round(cells.filter((cell) => cell.covered).length / cells.length * 100) : 0,
      ok: cells.every((cell) => cell.covered),
    },
    source_appendix: appendix,
    model: { sections, sourceAppendix: appendix },
    citation_audit: { ok: true },
    reconciliation: { ok: true },
    scope_check: { ok: true },
  };
  value.text = canonicalReportText(value);
  return value;
}

Deno.test('server validation accepts a complete server-backed coverage matrix', () => {
  const evidence = [
    { domain: 'market', market_code: 'US', source_record_id: 'market-1', source_url: 'https://example.test/market', verification_status: 'verified', evidence_hash: 'hash-market', payload: { status: 'ready' } },
    { domain: 'rule', market_code: 'US', platform_key: 'amazon', source_record_id: 'rule-1', source_url: 'https://example.test/rule', verification_status: 'verified', evidence_hash: 'hash-rule', payload: { status: 'ready' } },
  ];
  const result = validateFormalReportContent(content({ evidence }), quality, context({ evidence }), { now });
  if (!result.ok) throw new Error(result.reasons.map((reason) => reason.code).join(','));
});

Deno.test('canonical report text matches the browser source-category appendix contract', () => {
  const value: Row = {
    model: { sections: [{ id: 'summary', title: '摘要', text: '正式平台规则已核验 [S001]' }] },
    source_appendix: [{
      citation: 'S001',
      source: 'eBay',
      sourceCategory: 'platform_announcement',
      date: '2026-09-16',
      verificationStatus: 'verified',
      recordId: 'rule-ebay-1',
      dataSnapshotAt: '2026-09-16T05:17:15.000Z',
      url: 'https://www.ebay.com/help/example',
      chapters: ['summary'],
    }],
  };
  const expected = [
    '## 摘要',
    '',
    '正式平台规则已核验 [S001]',
    '',
    '## 来源与核验附录',
    '',
    '- [S001] eBay · 来源类别：平台官方公告 · 2026-09-16 · verified · 原始记录：rule-ebay-1 · 数据快照：2026-09-16T05:17:15.000Z · https://www.ebay.com/help/example · 引用章节：summary',
  ].join('\n');
  if (canonicalReportText(value) !== expected) {
    throw new Error(`canonical appendix drifted:\n${canonicalReportText(value)}`);
  }
});

Deno.test('formal save canonicalization discards client text drift', () => {
  const evidence = [
    { domain: 'market', market_code: 'US', source_record_id: 'market-1', source_url: 'https://example.test/market', verification_status: 'verified', payload: { status: 'ready' } },
  ];
  const report = content({ domains: ['market'], evidence });
  report.text = `${report.text}\n\n未经过结构化校验的附加正文`;
  const normalized = canonicalizeFormalReportContent(report);
  if (normalized.text !== canonicalReportText(report)) throw new Error('server canonical text was not applied');
  const result = validateFormalReportContent(normalized, quality, context({ domains: ['market'], evidence }), { now });
  if (!result.ok) throw new Error(result.reasons.map((reason) => reason.code).join(','));
});

Deno.test('server validation accepts a traceable subset of eligible evidence', () => {
  const selectedEvidence = [
    { domain: 'market', market_code: 'US', source_record_id: 'market-1', source_url: 'https://example.test/market-1', verification_status: 'verified', payload: { status: 'ready' } },
  ];
  const serverEvidence = selectedEvidence.concat([
    { domain: 'market', market_code: 'US', source_record_id: 'market-2', source_url: 'https://example.test/market-2', verification_status: 'verified', payload: { status: 'ready' } },
  ]);
  const report = content({ domains: ['market'], evidence: selectedEvidence });
  const result = validateFormalReportContent(report, quality, context({ domains: ['market'], evidence: serverEvidence }), { now });
  if (!result.ok) throw new Error(result.reasons.map((reason) => reason.code).join(','));
});

Deno.test('server validation rejects an unknown source in a coverage cell', () => {
  const evidence = [
    { domain: 'market', market_code: 'US', source_record_id: 'market-1', source_url: 'https://example.test/market-1', verification_status: 'verified', payload: { status: 'ready' } },
  ];
  const report = content({ domains: ['market'], evidence });
  const matrix = report.coverage_matrix as Row;
  const cells = matrix.cells as Row[];
  cells[0].sourceRecordIds = ['forged-source'];
  const result = validateFormalReportContent(report, quality, context({ domains: ['market'], evidence }), { now });
  assertReason(result, 'COVERAGE_CELL_EVIDENCE_MISMATCH');
});

Deno.test('generic category scope permits category examples and date-only context', () => {
  const evidence = [
    { domain: 'market', market_code: 'US', source_record_id: 'market-1', source_url: 'https://example.test/market-1', verification_status: 'verified', payload: { status: 'ready' } },
  ];
  const report = content({ domains: ['market'], evidence });
  const model = report.model as Row;
  const sections = model.sections as Row[];
  sections[0].text = '截至 2026 年 9 月 11 日，电子产品作为通用市场示例，暂无额外数字。 [S001]';
  report.text = canonicalReportText(report);
  const result = validateFormalReportContent(
    report,
    quality,
    context({ categories: ['generic', 'electronics'], domains: ['market'], evidence }),
    { now },
  );
  if (!result.ok) throw new Error(result.reasons.map((reason) => reason.code).join(','));
});

Deno.test('one covered market cannot hide a missing second market cell', () => {
  const evidence = [{ domain: 'market', market_code: 'US', source_record_id: 'market-us', source_url: 'https://example.test/us', verification_status: 'verified', payload: {} }];
  const result = validateFormalReportContent(
    content({ markets: ['US', 'ID'], domains: ['market'], evidence }),
    quality,
    context({ markets: ['US', 'ID'], domains: ['market'], evidence }),
    { now },
  );
  assertReason(result, 'COVERAGE_EVIDENCE_MISSING');
  if (!result.coverage.missing_cell_ids.includes('ID|amazon|generic|market')) throw new Error('missing Indonesia cell was not reported');
});

Deno.test('one platform rule cannot cover another selected platform', () => {
  const evidence = [{ domain: 'rule', market_code: 'US', platform_key: 'amazon', source_record_id: 'rule-amazon', source_url: 'https://example.test/amazon', verification_status: 'verified', payload: {} }];
  const result = validateFormalReportContent(
    content({ platforms: ['amazon', 'tiktok-shop'], domains: ['rule'], evidence }),
    quality,
    context({ platforms: ['amazon', 'tiktok-shop'], domains: ['rule'], evidence }),
    { now },
  );
  assertReason(result, 'COVERAGE_EVIDENCE_MISSING');
  if (!result.coverage.missing_cell_ids.includes('US|tiktok-shop|generic|rule')) throw new Error('missing TikTok Shop rule cell was not reported');
});

Deno.test('formal output requires all seven platform rule dimensions', () => {
  const dimensions = ['fee', 'commission', 'deposit', 'fulfillment', 'prohibited', 'settlement', 'penalty'];
  const evidence = dimensions.slice(0, 6).map((dimension) => ({
    domain: 'rule', market_code: 'US', platform_key: 'amazon', source_record_id: `amazon-${dimension}`,
    source_url: `https://example.test/amazon/${dimension}`, verification_status: 'verified',
    payload: { topic: dimension, rule_dimensions: { [dimension]: `${dimension}-value` } },
  }));
  const partial = validateFormalReportContent(
    content({ domains: ['platform', 'rule'], evidence }),
    quality,
    context({ domains: ['platform', 'rule'], evidence }),
    { now },
  );
  assertReason(partial, 'QUALITY_PLATFORM_RULE_COVERAGE_MISSING');
  evidence.push({
    domain: 'rule', market_code: 'US', platform_key: 'amazon', source_record_id: 'amazon-penalty',
    source_url: 'https://example.test/amazon/penalty', verification_status: 'verified',
    payload: { topic: 'penalty', rule_dimensions: { penalty: 'penalty-value' } },
  });
  const complete = validateFormalReportContent(
    content({ domains: ['platform', 'rule'], evidence }),
    quality,
    context({ domains: ['platform', 'rule'], evidence }),
    { now },
  );
  if (!complete.ok) throw new Error(complete.reasons.map((reason) => reason.code).join(','));
});

Deno.test('uploaded product evidence remains category-specific', () => {
  const material = { id: '00000000-0000-4000-8000-000000000001', user_id: 'user-1', client_id: 'product-beauty', material_type: 'product', snapshot_type: 'product', snapshot_data: { title: '美妆商品' }, snapshot_market: 'US', snapshot_platform: 'amazon', snapshot_category: 'beauty', metadata: { source_record_id: 'product-beauty' } };
  const report = content({ categories: ['beauty', 'electronics'], domains: ['product'], evidence: [material] });
  const result = validateFormalReportContent(
    report,
    quality,
    context({ categories: ['beauty', 'electronics'], domains: ['product'], materials: [material] }),
    { now },
  );
  assertReason(result, 'COVERAGE_EVIDENCE_MISSING');
  if (!result.coverage.missing_cell_ids.includes('US|amazon|electronics|product')) throw new Error('missing electronics product cell was not reported');
});

Deno.test('forged matrix, quality version, citation and exported text fail closed', () => {
  const evidence = [{ domain: 'market', market_code: 'US', source_record_id: 'market-1', source_url: 'https://example.test/us', verification_status: 'verified', evidence_hash: 'hash-market', payload: {} }];
  const report = content({ domains: ['market'], evidence });
  report.quality_snapshot = { ...(report.quality_snapshot as Row), quality_report_version: 'forged' };
  (report.coverage_matrix as Row).cells = [];
  (report.source_appendix as Row[])[0].url = 'http://unsafe.test/source';
  (report.source_appendix as Row[])[0].evidenceHash = 'forged-hash';
  report.text = `${report.text}\n\n未经过结构化校验的附加正文`;
  const result = validateFormalReportContent(report, quality, context({ domains: ['market'], evidence }), { now });
  ['QUALITY_VERSION_MISMATCH', 'COVERAGE_CELLS_MISMATCH', 'CITATION_SOURCE_URL_INVALID', 'CITATION_EVIDENCE_HASH_MISMATCH', 'REPORT_TEXT_MISMATCH'].forEach((code) => assertReason(result, code));
});
