import { assessReportContent, reportContentAllowsFormalOutput, type ContentQualityAssessment, type QualityGate } from './report-quality.ts';

export const REPORT_VALIDATION_VERSION = '2026.09.16.3';

type Row = Record<string, unknown>;

export type ReportValidationReason = {
  code: string;
  message: string;
  cell_id?: string;
  value?: string;
};

export type ReportValidationContext = {
  templates: Row[];
  markets: Row[];
  platforms: Row[];
  categories: Row[];
  marketPlatforms: Row[];
  applicability: Row[];
  materials: Row[];
};

export type ReportValidationResult = {
  ok: boolean;
  unavailable: boolean;
  version: string;
  validated_at: string;
  quality_report_version: string | null;
  reasons: ReportValidationReason[];
  scope: { market_codes: string[]; platform_keys: string[]; category_codes: string[] };
  coverage: { total_cells: number; covered_cells: number; missing_cell_ids: string[] };
  content_quality: ContentQualityAssessment;
};

function object(value: unknown): Row | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value == null || value === '' ? [] : [value];
}

function strings(value: unknown, transform: (value: string) => string = (item) => item.trim()): string[] {
  return Array.from(new Set(array(value).map((item) => transform(String(item || ''))).filter(Boolean)));
}

function sameSet(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function scopeFrom(content: Row) {
  const snapshot = object(content.scope_snapshot) || object(object(content.model)?.scopeSnapshot) || {};
  const topMarkets = strings(content.market_codes, (value) => value.trim().toUpperCase());
  const topPlatforms = strings(content.platform_keys, (value) => value.trim().toLowerCase());
  const topCategories = strings(content.category_codes, (value) => value.trim().toLowerCase());
  const snapshotMarkets = strings(snapshot.marketCodes || snapshot.market_codes, (value) => value.trim().toUpperCase());
  const snapshotPlatforms = strings(snapshot.platformKeys || snapshot.platform_keys, (value) => value.trim().toLowerCase());
  const snapshotCategories = strings(snapshot.categoryCodes || snapshot.category_codes, (value) => value.trim().toLowerCase());
  return {
    marketCodes: topMarkets.length ? topMarkets : snapshotMarkets,
    platformKeys: topPlatforms.length ? topPlatforms : snapshotPlatforms,
    categoryCodes: topCategories.length ? topCategories : snapshotCategories,
    snapshotMarkets,
    snapshotPlatforms,
    snapshotCategories,
  };
}

function recordMarkets(row: Row): string[] {
  return strings(row.market_codes || row.market_code || row.snapshot_market, (value) => value.trim().toUpperCase());
}

function recordPlatforms(row: Row): string[] {
  return strings(row.platform_keys || row.platform_key || row.snapshot_platform, (value) => value.trim().toLowerCase());
}

function recordCategories(row: Row): string[] {
  return strings(row.category_codes || row.category_code || row.snapshot_category, (value) => value.trim().toLowerCase());
}

function materialDomain(row: Row): string {
  const type = String(row.material_type || row.snapshot_type || '').toLowerCase();
  return ({ country: 'market', macro: 'market', policy: 'policy', tax: 'tax', access: 'access', platform: 'platform', rule: 'rule', product: 'product', shop: 'competitor', content: 'content' } as Record<string, string>)[type] || type;
}

function sourceRecordId(row: Row): string {
  const metadata = object(row.metadata) || {};
  return String(row.source_record_id || metadata.source_record_id || row.record_key || row.client_id || row.id || '').trim();
}

function evidenceVerificationStatus(row: Row): string {
  const metadata = object(row.metadata) || {};
  if (row.client_id && row.user_id) return 'uploaded';
  return String(row.verification_status || metadata.verification_status || '').toLowerCase();
}

function evidenceSourceUrl(row: Row): string {
  const metadata = object(row.metadata) || {};
  return String(row.source_url || row.snapshot_source || metadata.source_url || metadata.snapshot_source || '').trim();
}

function rowCoversCell(row: Row, domain: string, marketCode: string, platformKey: string | null, categoryCode: string | null): boolean {
  const rowDomain = String(row.domain || materialDomain(row)).toLowerCase();
  if (rowDomain !== domain && !(domain === 'platform' && rowDomain === 'rule') && !(domain === 'financial' && rowDomain === 'product')) return false;
  const markets = recordMarkets(row);
  const platforms = recordPlatforms(row);
  const categories = recordCategories(row);
  if (!markets.includes(marketCode)) return false;
  if (platforms.length && (!platformKey || !platforms.includes(platformKey))) return false;
  if (['platform', 'rule'].includes(domain) && platformKey && !platforms.includes(platformKey)) return false;
  if (categories.length && (!categoryCode || !categories.includes(categoryCode))) return false;
  if (['category', 'product', 'competitor', 'content', 'financial'].includes(domain) && categoryCode && !categories.includes(categoryCode)) return false;
  if (domain === 'financial') {
    const snapshot = object(row.snapshot_data) || {};
    const raw = object(snapshot.raw) || object(snapshot) || {};
    const values = { ...raw, ...snapshot };
    const required = ['sellingPrice', 'productCost', 'logisticsCost'];
    if (!required.every((key) => values[key] != null || values[key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)] != null)) return false;
    if (values.platformFee == null && values.platform_fee == null && values.platformFeeRate == null && values.platform_fee_rate == null) return false;
  }
  return true;
}

function reportSections(content: Row): Row[] {
  const model = object(content.model) || {};
  return array(model.sections).map(object).filter((value): value is Row => !!value);
}

function factualNumericTokens(line: string): string[] {
  let value = line;
  if (/数据快照(?:时间)?|数据截至|数据时间|生成日期|当前日期|本快照时间|截至\s*[（(]?\s*\d{4}/.test(value)) {
    value = value.replace(/\d{4}\s*年\s*\d{1,2}\s*月(?:\s*\d{1,2}\s*日)?/g, '').replace(/\d{4}-\d{2}-\d{2}(?:T[^\s]*)?/g, '');
  }
  return Array.from(value.matchAll(/(?:[$￥¥€£]\s*)?(\d+(?:[,.]\d+)*)(?:\s*(?:%|％|美元|美金|元|万|亿|百万|件|单|人|天|月|年|个|家|项|倍|bps|USD|CNY))|\d+\.\d+/gi))
    .map((match) => String(match[1] || '').replace(/,/g, ''))
    .filter(Boolean);
}

function citedCodes(line: string): string[] {
  return Array.from(line.matchAll(/\[(S\d{3})\]/g)).map((match) => match[1]);
}

function evidenceText(row: Row): string {
  return JSON.stringify(row.payload || row.snapshot_data || row.metadata || row);
}

function textContainsTerm(text: string, term: string): boolean {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return false;
  if (/^[a-z0-9]+$/i.test(normalized) && normalized.length <= 3) return false;
  return text.toLowerCase().includes(normalized);
}

function addReason(reasons: ReportValidationReason[], reason: ReportValidationReason) {
  if (!reasons.some((item) => item.code === reason.code && item.cell_id === reason.cell_id && item.value === reason.value)) reasons.push(reason);
}

function sourceCategoryLabel(value: unknown): string {
  const normalized = String(value || '').trim().toLowerCase();
  return ({
    official_policy: '官方政策/监管记录',
    official_statistics: '官方统计数据',
    platform_announcement: '平台官方公告',
    industry_media: '行业媒体/协会资讯',
    third_party_provider: '第三方数据服务商',
    user_upload: '工作区上传资料',
    derived: '系统派生数据',
    internal: '系统运行数据',
    demo: '演示数据',
  } as Record<string, string>)[normalized] || String(value || '');
}

function sourceAppendixLine(source: Row): string {
  const chapters = strings(source.chapters);
  const citation = String(source.citation || '');
  const name = String(source.source || '未命名来源');
  const date = String(source.date || '日期未提供');
  const verification = String(source.verificationStatus || source.verification_status || '待核验');
  const recordId = String(source.recordId || source.source_record_id || '');
  const snapshotAt = String(source.dataSnapshotAt || source.data_snapshot_at || '');
  const url = String(source.url || '');
  const sourceCategory = sourceCategoryLabel(source.sourceCategory || source.source_category);
  return `- [${citation}] ${name}`
    + (sourceCategory ? ` · 来源类别：${sourceCategory}` : '')
    + ` · ${date} · ${verification}`
    + (recordId ? ` · 原始记录：${recordId}` : '')
    + (snapshotAt ? ` · 数据快照：${snapshotAt}` : '')
    + (url ? ` · ${url}` : '')
    + (chapters.length ? ` · 引用章节：${chapters.join('、')}` : '');
}

export function canonicalReportText(value: unknown): string {
  const content = object(value) || {};
  const sections = reportSections(content);
  const appendix = array(content.source_appendix || object(content.model)?.sourceAppendix).map(object).filter((item): item is Row => !!item);
  const parts = sections.map((section) => `## ${String(section.title || '').trim()}\n\n${String(section.text || '').trim()}`);
  parts.push(`## 来源与核验附录\n\n${appendix.length ? appendix.map(sourceAppendixLine).join('\n') : '暂无可发布来源记录。'}`);
  return parts.join('\n\n');
}

export function canonicalizeFormalReportContent(value: unknown): Row {
  const content = object(value) || {};
  return { ...content, text: canonicalReportText(content) };
}

export function validateFormalReportContent(
  value: unknown,
  currentQuality: QualityGate,
  context: ReportValidationContext,
  options: { requireCurrentQualityVersion?: boolean; now?: string } = {},
): ReportValidationResult {
  const content = object(value) || {};
  const reasons: ReportValidationReason[] = [];
  const contentQuality = assessReportContent(content);
  if (!contentQuality.ok) addReason(reasons, { code: 'CONTENT_QUALITY_BLOCKED', message: '报告内容质量评审未通过' });
  const scope = scopeFrom(content);
  const currentQualityVersion = String(currentQuality.snapshot?.quality_report_version || '') || null;
  const embeddedSnapshot = object(content.quality_snapshot) || object(object(content.quality_gate)?.snapshot) || {};
  const embeddedVersion = String(embeddedSnapshot.quality_report_version || content.quality_report_version || '');
  if (!currentQuality.ok) addReason(reasons, { code: 'CURRENT_QUALITY_BLOCKED', message: '当前全局质量门禁未通过' });
  if (!reportContentAllowsFormalOutput(content)) addReason(reasons, { code: 'EMBEDDED_QUALITY_BLOCKED', message: '报告内嵌质量快照未通过' });
  if (!embeddedVersion) addReason(reasons, { code: 'QUALITY_VERSION_MISSING', message: '报告缺少质量版本' });
  if (options.requireCurrentQualityVersion !== false && currentQualityVersion && embeddedVersion !== currentQualityVersion) {
    addReason(reasons, { code: 'QUALITY_VERSION_MISMATCH', message: '报告质量版本与当前正式数据版本不一致' });
  }
  if (content.publishable !== true) addReason(reasons, { code: 'REPORT_NOT_PUBLISHABLE', message: '报告未声明为可发布' });
  if (!scope.marketCodes.length) addReason(reasons, { code: 'REPORT_SCOPE_MISSING', message: '报告未选择市场' });
  if (scope.snapshotMarkets.length && !sameSet(scope.marketCodes, scope.snapshotMarkets)) addReason(reasons, { code: 'SCOPE_SNAPSHOT_MISMATCH', message: '市场范围与快照不一致' });
  if (scope.snapshotPlatforms.length && !sameSet(scope.platformKeys, scope.snapshotPlatforms)) addReason(reasons, { code: 'SCOPE_SNAPSHOT_MISMATCH', message: '平台范围与快照不一致' });
  if (scope.snapshotCategories.length && !sameSet(scope.categoryCodes, scope.snapshotCategories)) addReason(reasons, { code: 'SCOPE_SNAPSHOT_MISMATCH', message: '品类范围与快照不一致' });

  const activeMarkets = new Set(context.markets.map((row) => String(row.code || '').toUpperCase()));
  const activePlatforms = new Set(context.platforms.map((row) => String(row.key || '').toLowerCase()));
  const activeCategories = new Set(context.categories.map((row) => String(row.code || '').toLowerCase()));
  scope.marketCodes.forEach((code) => { if (!activeMarkets.has(code)) addReason(reasons, { code: 'MARKET_NOT_ACTIVE', value: code, message: `市场 ${code} 未启用` }); });
  scope.platformKeys.forEach((key) => { if (!activePlatforms.has(key)) addReason(reasons, { code: 'PLATFORM_NOT_ACTIVE', value: key, message: `平台 ${key} 未启用` }); });
  scope.categoryCodes.forEach((code) => { if (!activeCategories.has(code)) addReason(reasons, { code: 'CATEGORY_NOT_ACTIVE', value: code, message: `品类 ${code} 未启用` }); });

  const templateCode = String(content.template_id || content.template || object(content.model)?.template && object(object(content.model)?.template)?.code || '').trim();
  const templateVersion = Number(content.template_version || object(object(content.model)?.template)?.version || 0);
  const template = context.templates.find((row) => String(row.code || row.id) === templateCode && Number(row.version || 1) === templateVersion);
  if (!template) addReason(reasons, { code: 'REPORT_TEMPLATE_NOT_FOUND', message: '服务端没有匹配的报告模板版本' });
  const requiredDomains = strings(template?.required_domains, (value) => value.trim().toLowerCase());

  const matrix = object(content.coverage_matrix) || object(object(content.model)?.coverageMatrix) || {};
  const dimensions = object(matrix.dimensions) || {};
  if (!sameSet(strings(dimensions.marketCodes || dimensions.market_codes, (value) => value.trim().toUpperCase()), scope.marketCodes)
    || !sameSet(strings(dimensions.platformKeys || dimensions.platform_keys, (value) => value.trim().toLowerCase()), scope.platformKeys)
    || !sameSet(strings(dimensions.categoryCodes || dimensions.category_codes, (value) => value.trim().toLowerCase()), scope.categoryCodes)) {
    addReason(reasons, { code: 'COVERAGE_DIMENSIONS_MISMATCH', message: '覆盖矩阵维度与报告范围不一致' });
  }
  const submittedPairs = array(dimensions.marketPlatformPairs).map(object).filter((value): value is Row => !!value).map((pair) => ({
    marketCode: String(pair.marketCode || pair.market_code || '').toUpperCase(),
    platformKey: pair.platformKey || pair.platform_key ? String(pair.platformKey || pair.platform_key).toLowerCase() : null,
  })).filter((pair) => pair.marketCode);
  const relationSet = new Set(context.marketPlatforms.map((row) => `${String(row.market_code || '').toUpperCase()}|${String(row.platform_key || '').toLowerCase()}`));
  submittedPairs.forEach((pair) => {
    if (!scope.marketCodes.includes(pair.marketCode) || pair.platformKey && !scope.platformKeys.includes(pair.platformKey)) addReason(reasons, { code: 'COVERAGE_PAIR_OUT_OF_SCOPE', value: `${pair.marketCode}|${pair.platformKey || '*'}`, message: '覆盖矩阵包含范围外市场或平台' });
    if (pair.platformKey && !relationSet.has(`${pair.marketCode}|${pair.platformKey}`)) addReason(reasons, { code: 'MARKET_PLATFORM_NOT_ACTIVE', value: `${pair.marketCode}|${pair.platformKey}`, message: '市场与平台关系未启用' });
  });
  const expectedPairs: Array<{ marketCode: string; platformKey: string | null }> = [];
  scope.marketCodes.forEach((marketCode) => {
    const available = scope.platformKeys.filter((platformKey) => relationSet.has(`${marketCode}|${platformKey}`));
    if (!available.length) expectedPairs.push({ marketCode, platformKey: null });
    else available.forEach((platformKey) => expectedPairs.push({ marketCode, platformKey }));
  });
  const pairId = (pair: { marketCode: string; platformKey: string | null }) => `${pair.marketCode}|${pair.platformKey || '*'}`;
  if (!sameSet(submittedPairs.map(pairId), expectedPairs.map(pairId))) addReason(reasons, { code: 'COVERAGE_PAIRS_MISMATCH', message: '覆盖矩阵市场平台组合与服务端目录不一致' });
  scope.platformKeys.forEach((platformKey) => {
    if (!expectedPairs.some((pair) => pair.platformKey === platformKey)) addReason(reasons, { code: 'PLATFORM_NOT_AVAILABLE_IN_SCOPE', value: platformKey, message: `平台 ${platformKey} 不适用于所选市场` });
  });
  if (!sameSet(strings(matrix.requiredDomains, (value) => value.trim().toLowerCase()), requiredDomains)) addReason(reasons, { code: 'COVERAGE_REQUIRED_DOMAINS_MISMATCH', message: '覆盖矩阵必需数据域与服务端模板不一致' });

  const evidence = context.applicability.concat(context.materials);
  const categoryDimension: Array<string | null> = scope.categoryCodes.length ? scope.categoryCodes : [null];
  const expectedCells: Array<{ id: string; domain: string; marketCode: string; platformKey: string | null; categoryCode: string | null; evidence: Row[] }> = [];
  expectedPairs.forEach((pair) => categoryDimension.forEach((categoryCode) => requiredDomains.forEach((domain) => {
    const rows = evidence.filter((row) => rowCoversCell(row, domain, pair.marketCode, pair.platformKey, categoryCode));
    expectedCells.push({ id: [pair.marketCode, pair.platformKey || '*', categoryCode || '*', domain].join('|'), domain, marketCode: pair.marketCode, platformKey: pair.platformKey, categoryCode, evidence: rows });
  })));
  const submittedCells = array(matrix.cells).map(object).filter((value): value is Row => !!value);
  const submittedIds = submittedCells.map((cell) => String(cell.id || ''));
  if (new Set(submittedIds).size !== submittedIds.length) addReason(reasons, { code: 'COVERAGE_CELL_DUPLICATE', message: '覆盖矩阵包含重复范围格' });
  if (!sameSet(submittedIds, expectedCells.map((cell) => cell.id))) addReason(reasons, { code: 'COVERAGE_CELLS_MISMATCH', message: '覆盖矩阵范围格与服务端重算结果不一致' });
  expectedCells.forEach((cell) => {
    const submitted = submittedCells.find((item) => String(item.id || '') === cell.id);
    if (!submitted) addReason(reasons, { code: 'COVERAGE_CELL_MISSING', cell_id: cell.id, message: '报告覆盖矩阵缺少必需范围格' });
    else if (
      String(submitted.domain || '').toLowerCase() !== cell.domain
      || String(submitted.marketCode || submitted.market_code || '').toUpperCase() !== cell.marketCode
      || String(submitted.platformKey || submitted.platform_key || '').toLowerCase() !== String(cell.platformKey || '')
      || String(submitted.categoryCode || submitted.category_code || '').toLowerCase() !== String(cell.categoryCode || '')
    ) addReason(reasons, { code: 'COVERAGE_CELL_FIELDS_MISMATCH', cell_id: cell.id, message: '覆盖格字段与服务端范围不一致' });
    if (!cell.evidence.length) addReason(reasons, { code: 'COVERAGE_EVIDENCE_MISSING', cell_id: cell.id, message: '服务端未找到该范围格的正式证据' });
    if (submitted) {
      const serverSourceIds = strings(cell.evidence.map(sourceRecordId));
      const submittedSourceIds = strings(submitted.sourceRecordIds || submitted.source_record_ids);
      const unknownSourceIds = submittedSourceIds.filter((sourceId) => !serverSourceIds.includes(sourceId));
      if (
        submitted.covered !== true
        || !submittedSourceIds.length
        || Number(submitted.recordCount ?? submitted.record_count) !== submittedSourceIds.length
        || unknownSourceIds.length
      ) {
        addReason(reasons, { code: 'COVERAGE_CELL_EVIDENCE_MISMATCH', cell_id: cell.id, message: '覆盖格来源数量或来源编号与服务端记录不一致' });
      }
    }
  });
  if (matrix.ok !== true || Number(matrix.totalCells) !== expectedCells.length || Number(matrix.coveredCells) !== expectedCells.length || Number(matrix.coveragePercent) !== 100 || array(matrix.missingCells).length !== 0) addReason(reasons, { code: 'COVERAGE_SUMMARY_INVALID', message: '覆盖矩阵汇总未通过' });

  const appendix = array(content.source_appendix || object(content.model)?.sourceAppendix).map(object).filter((value): value is Row => !!value);
  const evidenceById = new Map<string, Row[]>();
  evidence.forEach((row) => {
    const id = sourceRecordId(row);
    if (!id) return;
    evidenceById.set(id, (evidenceById.get(id) || []).concat([row]));
  });
  const citationSources = new Map<string, Row>();
  appendix.forEach((source) => {
    const citation = String(source.citation || '');
    const recordId = String(source.recordId || source.source_record_id || '');
    if (!/^S\d{3}$/.test(citation) || citationSources.has(citation)) addReason(reasons, { code: 'CITATION_CATALOG_INVALID', value: citation, message: '来源编号无效或重复' });
    else citationSources.set(citation, source);
    const sourceRows = recordId ? evidenceById.get(recordId) || [] : [];
    if (!sourceRows.length) addReason(reasons, { code: 'CITATION_SOURCE_NOT_FOUND', value: recordId, message: '引用来源无法回溯到正式记录' });
    const verification = String(source.verificationStatus || source.verification_status || '').toLowerCase();
    if (!['verified', 'uploaded'].includes(verification)) addReason(reasons, { code: 'CITATION_SOURCE_NOT_VERIFIED', value: recordId, message: '引用来源未完成核验' });
    if (sourceRows.length && !sourceRows.some((row) => evidenceVerificationStatus(row) === verification)) addReason(reasons, { code: 'CITATION_VERIFICATION_MISMATCH', value: recordId, message: '引用核验状态与服务端来源记录不一致' });
    const url = String(source.url || source.originalUrl || '');
    if (verification !== 'uploaded' && !/^https:\/\//i.test(url)) addReason(reasons, { code: 'CITATION_SOURCE_URL_INVALID', value: recordId, message: '正式来源必须使用 HTTPS URL' });
    if (verification !== 'uploaded' && sourceRows.length && !sourceRows.some((row) => evidenceSourceUrl(row) === url)) addReason(reasons, { code: 'CITATION_SOURCE_URL_MISMATCH', value: recordId, message: '引用 URL 与服务端来源记录不一致' });
    const evidenceHash = String(source.evidenceHash || source.evidence_hash || '');
    const serverHashes = strings(sourceRows.map((row) => row.evidence_hash));
    if (serverHashes.length && (!evidenceHash || !serverHashes.includes(evidenceHash))) addReason(reasons, { code: 'CITATION_EVIDENCE_HASH_MISMATCH', value: recordId, message: '引用证据哈希与服务端来源快照不一致' });
  });
  if (!appendix.length) addReason(reasons, { code: 'CITATION_CATALOG_EMPTY', message: '报告没有可回溯来源' });

  const sections = reportSections(content);
  if (!sections.length) addReason(reasons, { code: 'REPORT_SECTIONS_MISSING', message: '报告缺少结构化章节' });
  if (String(content.text || '').trim() !== canonicalReportText(content).trim()) addReason(reasons, { code: 'REPORT_TEXT_MISMATCH', message: '报告正文与结构化章节及来源附录不一致' });
  sections.forEach((section) => String(section.text || '').split(/\r?\n/).forEach((line) => {
    const codes = citedCodes(line);
    codes.forEach((code) => { if (!citationSources.has(code)) addReason(reasons, { code: 'CITATION_UNKNOWN', value: code, message: '正文引用了不存在的来源编号' }); });
    const numbers = factualNumericTokens(line);
    if (!numbers.length) return;
    if (!codes.length) {
      addReason(reasons, { code: 'NUMERIC_CITATION_MISSING', value: line.slice(0, 180), message: '关键数字缺少行内引用' });
      return;
    }
    numbers.forEach((numberValue) => {
      const supported = codes.some((code) => {
        const source = citationSources.get(code) || {};
        const recordId = String(source.recordId || source.source_record_id || '');
        return (evidenceById.get(recordId) || []).some((row) => evidenceText(row).replace(/,/g, '').includes(numberValue));
      });
      if (!supported) addReason(reasons, { code: 'CITATION_NUMBER_NOT_TRACEABLE', value: numberValue, message: '关键数字无法回溯到所引来源记录' });
    });
  }));
  if (object(content.citation_audit)?.ok !== true || object(content.reconciliation)?.ok !== true || object(content.scope_check)?.ok !== true) addReason(reasons, { code: 'CLIENT_AUDIT_NOT_PASSED', message: '报告的引用、对账或范围审核未通过' });

  const selectedMarkets = new Set(scope.marketCodes);
  const selectedPlatforms = new Set(scope.platformKeys);
  const selectedCategories = new Set(scope.categoryCodes);
  const sectionText = sections.map((section) => String(section.text || '')).join('\n');
  context.markets.forEach((row) => {
    if (selectedMarkets.has(String(row.code || '').toUpperCase())) return;
    strings([row.name, row.label, ...array(row.aliases)]).forEach((term) => { if (textContainsTerm(sectionText, term)) addReason(reasons, { code: 'REPORT_SCOPE_TEXT_VIOLATION', value: term, message: '正文包含未选择市场' }); });
  });
  context.platforms.forEach((row) => {
    if (selectedPlatforms.has(String(row.key || '').toLowerCase())) return;
    strings([row.name, ...array(row.aliases)]).forEach((term) => { if (textContainsTerm(sectionText, term)) addReason(reasons, { code: 'REPORT_SCOPE_TEXT_VIOLATION', value: term, message: '正文包含未选择平台' }); });
  });
  if (!selectedCategories.has('generic')) {
    context.categories.forEach((row) => {
      if (selectedCategories.has(String(row.code || '').toLowerCase())) return;
      strings([row.name, ...array(row.aliases)]).forEach((term) => { if (textContainsTerm(sectionText, term)) addReason(reasons, { code: 'REPORT_SCOPE_TEXT_VIOLATION', value: term, message: '正文包含未选择品类' }); });
    });
  }

  const missingCellIds = expectedCells.filter((cell) => !cell.evidence.length).map((cell) => cell.id);
  return {
    ok: reasons.length === 0,
    unavailable: false,
    version: REPORT_VALIDATION_VERSION,
    validated_at: options.now || new Date().toISOString(),
    quality_report_version: currentQualityVersion,
    reasons,
    scope: { market_codes: scope.marketCodes, platform_keys: scope.platformKeys, category_codes: scope.categoryCodes },
    coverage: { total_cells: expectedCells.length, covered_cells: expectedCells.length - missingCellIds.length, missing_cell_ids: missingCellIds },
    content_quality: contentQuality,
  };
}

async function rows(url: string, headers: Record<string, string>): Promise<Row[]> {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`VALIDATION_DATA_FETCH_FAILED:${response.status}`);
  const value = await response.json();
  if (!Array.isArray(value)) throw new Error('VALIDATION_DATA_INVALID');
  return value;
}

export async function fetchReportValidationContext(supabaseUrl: string, headers: Record<string, string>, workspaceId: string): Promise<ReportValidationContext> {
  const base = supabaseUrl.replace(/\/$/, '') + '/rest/v1/';
  const [templates, markets, platforms, categories, marketPlatforms, applicability, materials] = await Promise.all([
    rows(base + 'report_template_catalog?select=id,code,version,required_domains,status&status=eq.active&limit=1000', headers),
    rows(base + 'market_catalog?select=code,name,label,aliases,status&status=eq.active&limit=1000', headers),
    rows(base + 'platform_catalog?select=key,name,aliases,status&status=eq.active&limit=1000', headers),
    rows(base + 'category_profiles?select=code,name,aliases,status&status=eq.active&limit=1000', headers),
    rows(base + 'market_platforms?select=market_code,platform_key,status&status=eq.active&limit=5000', headers),
    rows(base + 'market_data_applicability?select=domain,record_key,market_code,platform_key,category_code,source_record_id,source_url,source_kind,source_type,verification_status,evidence_hash,collected_at,retrieved_at,published_at,effective_from,verified_at,payload&status=eq.active&verification_status=in.(verified,uploaded)&limit=10000', headers),
    rows(base + `report_materials?select=id,user_id,workspace_id,client_id,material_type,metadata,source,selected,snapshot_type,snapshot_data,snapshot_source,snapshot_at,snapshot_market,snapshot_platform,snapshot_category&workspace_id=eq.${encodeURIComponent(workspaceId)}&selected=eq.true&limit=1000`, headers),
  ]);
  return { templates, markets, platforms, categories, marketPlatforms, applicability, materials };
}

export async function validateFormalReportWithServerData(
  supabaseUrl: string,
  headers: Record<string, string>,
  workspaceId: string,
  content: unknown,
  currentQuality: QualityGate,
  options: { requireCurrentQualityVersion?: boolean } = {},
): Promise<ReportValidationResult> {
  try {
    const context = await fetchReportValidationContext(supabaseUrl, headers, workspaceId);
    return validateFormalReportContent(content, currentQuality, context, options);
  } catch (error) {
    return {
      ok: false,
      unavailable: true,
      version: REPORT_VALIDATION_VERSION,
      validated_at: new Date().toISOString(),
      quality_report_version: String(currentQuality.snapshot?.quality_report_version || '') || null,
      reasons: [{ code: 'REPORT_VALIDATION_DATA_UNAVAILABLE', message: error instanceof Error ? error.message : '服务端校验数据不可用' }],
      scope: { market_codes: [], platform_keys: [], category_codes: [] },
      coverage: { total_cells: 0, covered_cells: 0, missing_cell_ids: [] },
      content_quality: assessReportContent(content),
    };
  }
}
