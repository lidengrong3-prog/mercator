export type QualityGate = {
  ok: boolean;
  status: string;
  publishable: boolean;
  stale: boolean;
  reasons: string[];
  snapshot: Record<string, unknown> | null;
};

export type ContentQualityAssessment = {
  version: string;
  ok: boolean;
  status: 'passed' | 'needs_review' | 'blocked';
  overall: number;
  threshold: number;
  dimensions: { accuracy: number; completeness: number; executability: number; sourceCoverage: number };
  factualLineCount: number;
  citedFactualLineCount: number;
  reasons: string[];
  assessedAt: string;
};

type Row = Record<string, unknown>;

const MAX_AGE_MS = 12 * 60 * 60 * 1000;
const BLOCKED_STATUSES = new Set(['failed', 'stale', 'not_connected', 'pending']);
const PLATFORM_RULE_DIMENSIONS = ['fee', 'commission', 'deposit', 'fulfillment', 'prohibited', 'settlement', 'penalty'];

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function evaluateQualityReport(value: unknown, nowMs = Date.now()): QualityGate {
  const report = object(value);
  if (!report) return { ok: false, status: 'failed', publishable: false, stale: true, reasons: ['QUALITY_REPORT_MISSING'], snapshot: null };
  const generatedAt = typeof report.generated_at === 'string' ? report.generated_at : '';
  const generatedMs = Date.parse(generatedAt);
  const declaredStatus = String(report.status || 'pending').toLowerCase();
  const stale = declaredStatus === 'stale' || !Number.isFinite(generatedMs) || nowMs - generatedMs > MAX_AGE_MS;
  const status = stale ? 'stale' : declaredStatus;
  const publishable = report.publishable === true;
  const reasons: string[] = [];
  if (!Number.isFinite(generatedMs)) reasons.push('QUALITY_REPORT_TIMESTAMP_INVALID');
  if (stale && Number.isFinite(generatedMs)) reasons.push('QUALITY_REPORT_STALE');
  if (!publishable) reasons.push('QUALITY_REPORT_NOT_PUBLISHABLE');
  if (BLOCKED_STATUSES.has(status) && status !== 'stale') reasons.push(`QUALITY_STATUS_${status.toUpperCase()}`);
  const datasets = object(report.datasets) || {};
  Object.entries(datasets).forEach(([key, raw]) => {
    const dataset = object(raw);
    const datasetStatus = String(dataset?.status || '').toLowerCase();
    if (datasetStatus === 'failed' || datasetStatus === 'stale') reasons.push(`QUALITY_DATASET_${datasetStatus.toUpperCase()}:${key}`);
  });
  return {
    ok: reasons.length === 0,
    status,
    publishable,
    stale,
    reasons: Array.from(new Set(reasons)),
    snapshot: {
      quality_report_version: `${String(report.schema_version || 'unknown')}@${generatedAt || 'missing'}`,
      schema_version: report.schema_version || null,
      data_contract_version: report.data_contract_version || null,
      generated_at: generatedAt || null,
      status: declaredStatus,
      effective_status: status,
      publishable,
      stale,
    },
  };
}

export function reportContentAllowsFormalOutput(value: unknown): boolean {
  const content = object(value);
  if (!content || content.publishable !== true) return false;
  const gate = object(content.quality_gate);
  const snapshot = object(content.quality_snapshot) || object(gate?.snapshot);
  if (!gate || gate.ok !== true || !snapshot) return false;
  const status = String(snapshot.effective_status || snapshot.status || '').toLowerCase();
  if (snapshot.publishable !== true || snapshot.stale === true || BLOCKED_STATUSES.has(status)) return false;
  const model = object(content.model) || {};
  const matrix = object(content.coverage_matrix) || object(model.coverageMatrix);
  if (!matrix || matrix.ok !== true || array(matrix.missingCells).length || !array(matrix.cells).length) return false;
  if (Number(matrix.totalCells) !== array(matrix.cells).length || Number(matrix.coveredCells) !== array(matrix.cells).length) return false;
  const requiredDomains = array(matrix.requiredDomains).map((domain) => String(domain).toLowerCase());
  const requirePlatformDimensions = requiredDomains.includes('platform') && requiredDomains.includes('rule');
  const requiredDimensions = new Set(array(matrix.requiredPlatformRuleDimensions).map((dimension) => String(dimension).toLowerCase()));
  if (requirePlatformDimensions && (requiredDimensions.size !== PLATFORM_RULE_DIMENSIONS.length || !PLATFORM_RULE_DIMENSIONS.every((dimension) => requiredDimensions.has(dimension)))) return false;
  if (!requirePlatformDimensions) return true;
  const platformCells = array(matrix.cells).map(object).filter((cell): cell is Row => !!cell && cell.domain === 'platform');
  if (!platformCells.length) return false;
  return platformCells.every((cell) => (
    cell.covered === true && array(cell.missingRuleDimensions).length === 0 && (() => {
      const covered = new Set(array(cell.ruleDimensions).map((dimension) => String(dimension).toLowerCase()));
      return covered.size === PLATFORM_RULE_DIMENSIONS.length && PLATFORM_RULE_DIMENSIONS.every((dimension) => covered.has(dimension));
    })()
  ));
}

function reportSections(value: Row): Row[] {
  const model = object(value.model) || {};
  const sections = [...array(value.sections), ...array(model.sections)].map(object).filter((item): item is Row => !!item);
  const seen = new Set<string>();
  return sections.filter((section, index) => {
    const key = String(section.id || `index:${index}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sectionText(section: Row): string {
  return String(section.text || section.body || section.content || '').trim();
}

function assessFactualLines(value: Row): string[] {
  const lines: string[] = [];
  reportSections(value).forEach((section) => {
    sectionText(section).split(/\r?\n/).forEach((line) => {
      let clean = line.replace(/\[S\d{3}\]/g, '').trim();
      if (!clean || /^#{1,6}\s+/.test(clean) || /^\s*\|?\s*:?-{2,}/.test(clean)) return;
      if (/数据快照|数据截至|生成日期|当前日期|本快照时间/.test(clean)) clean = clean.replace(/\d{4}[-年/]\d{1,2}(?:[-月/]\d{1,2})?(?:日)?/g, '');
      if (/(?:[$￥¥€£]\s*\d|\d+(?:[,.]\d+)*(?:\s*(?:%|％|美元|美金|元|万|亿|百万|件|单|人|天|月|年|个|家|项|倍|USD|CNY))|\d+\.\d+)/i.test(clean)) lines.push(line);
    });
  });
  return lines;
}

export function assessReportContent(value: unknown, options: { threshold?: number; now?: string } = {}): ContentQualityAssessment {
  const content = object(value) || {};
  const sections = reportSections(content);
  const nonEmpty = sections.filter((section) => {
    const text = sectionText(section);
    return text.length > 0 && !/^待补充[。！!]?$/.test(text);
  });
  const completeness = sections.length ? Math.round(nonEmpty.length / sections.length * 100) : 0;
  const factualLines = assessFactualLines(content);
  const citedFactualLineCount = factualLines.filter((line) => /\[S\d{3}\]/.test(line)).length;
  const sourceCoverage = factualLines.length ? Math.round(citedFactualLineCount / factualLines.length * 100) : 100;
  const citationAudit = object(content.citation_quality) || object(content.citation_audit) || object(content.citationAudit);
  const reconciliation = object(content.reconciliation);
  const scopeCheck = object(content.scope_check) || object(content.scopeCheck);
  let accuracy = 100;
  const reasons: string[] = [];
  if (citationAudit && citationAudit.ok === false) { accuracy -= 45; reasons.push('引用审核未通过'); }
  if (reconciliation && reconciliation.ok === false) { accuracy -= 35; reasons.push('关键数字对账未通过'); }
  if (scopeCheck && scopeCheck.ok === false) { accuracy -= 20; reasons.push('报告范围审核未通过'); }
  accuracy = Math.max(0, accuracy);
  const actionSections = sections.filter((section) => /action|risk|行动|风险|recommend/i.test(String(section.id || section.domain || section.title || '')));
  const actionText = actionSections.map(sectionText).join('\n');
  let executability = 100;
  if (actionSections.length) {
    const actionableLines = actionText.split(/\r?\n/).filter((line) => /(?:^|\s)(?:\d+[.)、]|[-*])\s*|建议|应当|需要|负责|截止|步骤|检查|准备|提交|验证|上线|跟进|联系|复核|完成/.test(line));
    if (!actionableLines.length) { executability = 55; reasons.push('行动章节缺少可执行步骤'); }
    else if (actionableLines.length < Math.max(2, actionSections.length)) { executability = 75; reasons.push('行动步骤较少，建议人工补充负责人或时间'); }
  }
  const threshold = Number(options.threshold == null ? 80 : options.threshold);
  const overall = Math.round(accuracy * 0.4 + completeness * 0.25 + executability * 0.2 + sourceCoverage * 0.15);
  if (completeness < 60) reasons.push('章节完整性低于 60%');
  if (sourceCoverage < 80) reasons.push('来源覆盖率低于 80%');
  if (!sections.length) reasons.push('报告缺少结构化章节');
  const ok = !!sections.length && accuracy >= 80 && completeness >= 60 && executability >= 60 && sourceCoverage >= 80 && overall >= threshold;
  return {
    version: 'content-quality-1',
    ok,
    status: ok ? 'passed' : (overall >= 60 ? 'needs_review' : 'blocked'),
    overall,
    threshold,
    dimensions: { accuracy, completeness, executability, sourceCoverage },
    factualLineCount: factualLines.length,
    citedFactualLineCount,
    reasons: Array.from(new Set(reasons)),
    assessedAt: options.now || new Date().toISOString(),
  };
}

export async function fetchCurrentQualityGate(
  supabaseUrl: string,
  headers: Record<string, string>,
): Promise<QualityGate> {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/market_data?key=eq.quality_report&select=data&limit=1`, { headers });
    if (!response.ok) return { ok: false, status: 'failed', publishable: false, stale: true, reasons: ['QUALITY_REPORT_FETCH_FAILED'], snapshot: null };
    const rows = await response.json();
    return evaluateQualityReport(rows?.[0]?.data);
  } catch {
    return { ok: false, status: 'failed', publishable: false, stale: true, reasons: ['QUALITY_REPORT_FETCH_FAILED'], snapshot: null };
  }
}
