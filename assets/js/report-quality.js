/* Global data-quality gate for report generation, persistence and export. */
(function (root) {
  'use strict';

  var MAX_AGE_MS = 12 * 60 * 60 * 1000;
  var BLOCKED_STATUSES = ['failed', 'stale'];
  var GLOBAL_BLOCKED_STATUSES = ['failed', 'stale', 'not_connected', 'pending'];

  function list(value) { return Array.isArray(value) ? value : []; }
  function text(value) { return value == null ? '' : String(value); }
  function finiteTime(value) {
    var parsed = new Date(value || '').getTime();
    return isFinite(parsed) ? parsed : null;
  }
  function unique(values) {
    return values.filter(function (value, index, rows) { return value && rows.indexOf(value) === index; });
  }
  function datasetSnapshot(report) {
    var datasets = report && report.datasets && typeof report.datasets === 'object' ? report.datasets : {};
    var snapshot = {};
    Object.keys(datasets).sort().forEach(function (key) {
      var row = datasets[key] || {};
      snapshot[key] = {
        label: text(row.label || key),
        status: text(row.status || 'failed'),
        updated_at: row.updated_at || null,
        records: row.records == null ? null : Number(row.records),
        scoped_records: row.scoped_records == null ? null : Number(row.scoped_records),
        formal_records: row.formal_records == null ? null : Number(row.formal_records),
        errors: list(row.errors).map(text),
        warnings: list(row.warnings).map(text)
      };
    });
    return snapshot;
  }

  function evaluate(report, options) {
    options = options || {};
    var nowMs = options.now == null ? Date.now() : Number(options.now);
    var maxAgeMs = options.maxAgeMs == null ? MAX_AGE_MS : Number(options.maxAgeMs);
    var source = report && typeof report === 'object' ? report : null;
    var generatedAt = source && source.generated_at || null;
    var generatedMs = finiteTime(generatedAt);
    var declaredStatus = text(source && source.status || 'pending').toLowerCase();
    var stale = declaredStatus === 'stale' || generatedMs == null || nowMs - generatedMs > maxAgeMs;
    var effectiveStatus = stale ? 'stale' : declaredStatus;
    var publishable = !!(source && source.publishable === true);
    var datasets = datasetSnapshot(source);
    var blockedDatasets = [];
    var unavailableDatasets = [];
    Object.keys(datasets).forEach(function (key) {
      var row = datasets[key];
      if (BLOCKED_STATUSES.indexOf(row.status) >= 0) blockedDatasets.push({ key: key, label: row.label, status: row.status, errors: row.errors, warnings: row.warnings });
      if (row.status === 'not_connected') unavailableDatasets.push({ key: key, label: row.label, status: row.status, errors: row.errors, warnings: row.warnings });
    });
    var reasons = [];
    if (!source) reasons.push({ code: 'QUALITY_REPORT_MISSING', message: '全局质量报告尚未加载' });
    if (source && generatedMs == null) reasons.push({ code: 'QUALITY_REPORT_TIMESTAMP_INVALID', message: '全局质量报告缺少有效生成时间' });
    if (stale && generatedMs != null) reasons.push({ code: 'QUALITY_REPORT_STALE', message: '全局质量报告已超过 12 小时，需要重新校验数据' });
    if (!publishable) reasons.push({ code: 'QUALITY_REPORT_NOT_PUBLISHABLE', message: '全局质量报告未通过发布校验' });
    if (GLOBAL_BLOCKED_STATUSES.indexOf(effectiveStatus) >= 0 && effectiveStatus !== 'stale') {
      reasons.push({ code: 'QUALITY_STATUS_' + effectiveStatus.toUpperCase(), message: '全局质量状态为“' + effectiveStatus + '”' });
    }
    blockedDatasets.forEach(function (row) {
      reasons.push({ code: 'QUALITY_DATASET_' + row.status.toUpperCase(), dataset: row.key, message: row.label + '数据域状态为“' + row.status + '”' });
    });
    reasons = unique(reasons.map(function (reason) { return reason.code + '|' + (reason.dataset || '') + '|' + reason.message; })).map(function (value) {
      var parts = value.split('|');
      return { code: parts[0], dataset: parts[1] || undefined, message: parts.slice(2).join('|') };
    });
    var capturedAt = new Date(isFinite(nowMs) ? nowMs : Date.now()).toISOString();
    var version = source ? text(source.schema_version || 'unknown') + '@' + text(generatedAt || 'missing') : 'missing';
    var snapshot = {
      quality_report_version: version,
      schema_version: source && source.schema_version || null,
      data_contract_version: source && source.data_contract_version || null,
      generated_at: generatedAt,
      captured_at: capturedAt,
      status: declaredStatus,
      effective_status: effectiveStatus,
      publishable: publishable,
      stale: stale,
      summary: source && source.summary && typeof source.summary === 'object' ? Object.assign({}, source.summary) : {},
      datasets: datasets
    };
    return {
      ok: reasons.length === 0,
      status: effectiveStatus,
      publishable: publishable,
      stale: stale,
      reasons: reasons,
      blockedDatasets: blockedDatasets,
      unavailableDatasets: unavailableDatasets,
      snapshot: snapshot
    };
  }

  function allowsStoredReport(content) {
    if (!content || typeof content !== 'object' || content.publishable !== true) return false;
    var gate = content.quality_gate;
    var snapshot = content.quality_snapshot || gate && gate.snapshot;
    if (!gate || gate.ok !== true || !snapshot || typeof snapshot !== 'object') return false;
    if (snapshot.publishable !== true || snapshot.stale === true) return false;
    return GLOBAL_BLOCKED_STATUSES.indexOf(text(snapshot.effective_status || snapshot.status).toLowerCase()) < 0;
  }

  function reportSections(content) {
    var model = content && content.model && typeof content.model === 'object' ? content.model : {};
    return list(content && content.sections).concat(list(model.sections)).filter(function (section, index, rows) {
      var id = section && section.id || index;
      return section && rows.findIndex(function (candidate) { return candidate && (candidate.id || rows.indexOf(candidate)) === id; }) === index;
    });
  }

  function sectionText(section) {
    return text(section && (section.text || section.body || section.content)).trim();
  }

  function factualLines(content) {
    return reportSections(content).reduce(function (lines, section) {
      return lines.concat(sectionText(section).split(/\r?\n/).filter(function (line) {
        var value = line.replace(/\[(S\d{3})\]/g, '').trim();
        if (!value || /^#{1,6}\s+/.test(value) || /^\s*\|?\s*:?-{2,}/.test(value)) return false;
        // Dates used only to identify the snapshot are metadata, not factual claims.
        if (/数据快照|数据截至|生成日期|当前日期|本快照时间/.test(value)) value = value.replace(/\d{4}[-年/]\d{1,2}(?:[-月/]\d{1,2})?(?:日)?/g, '');
        return /(?:[$￥¥€£]\s*\d|\d+(?:[,.]\d+)*(?:\s*(?:%|％|美元|美金|元|万|亿|百万|件|单|人|天|月|年|个|家|项|倍|USD|CNY))|\d+\.\d+)/i.test(value);
      }));
    }, []);
  }

  function assessContent(content, options) {
    options = options || {};
    content = content && typeof content === 'object' ? content : {};
    var sections = reportSections(content);
    var nonEmpty = sections.filter(function (section) { return sectionText(section) && !/^待补充[。！!]?$/u.test(sectionText(section)); });
    var completeness = sections.length ? Math.round(nonEmpty.length / sections.length * 100) : 0;
    var factual = factualLines(content);
    var cited = factual.filter(function (line) { return /\[S\d{3}\]/.test(line); });
    var sourceCoverage = factual.length ? Math.round(cited.length / factual.length * 100) : 100;
    var citationAudit = content.citation_quality || content.citation_audit || content.citationAudit;
    var reconciliation = content.reconciliation;
    var scopeCheck = content.scope_check || content.scopeCheck;
    var accuracy = 100;
    var accuracyReasons = [];
    if (citationAudit && citationAudit.ok === false) { accuracy -= 45; accuracyReasons.push('引用审核未通过'); }
    if (reconciliation && reconciliation.ok === false) { accuracy -= 35; accuracyReasons.push('关键数字对账未通过'); }
    if (scopeCheck && scopeCheck.ok === false) { accuracy -= 20; accuracyReasons.push('报告范围审核未通过'); }
    accuracy = Math.max(0, accuracy);
    var actionSections = sections.filter(function (section) { return /action|risk|行动|风险|recommend/i.test(text(section && (section.id || section.domain || section.title))); });
    var actionText = actionSections.map(sectionText).join('\n');
    var executability = 100;
    var executabilityReasons = [];
    if (actionSections.length) {
      var actionableLines = actionText.split(/\r?\n/).filter(function (line) { return /(?:^|\s)(?:\d+[.)、]|[-*])\s*|建议|应当|需要|负责|截止|步骤|检查|准备|提交|验证|上线|跟进|联系|复核|完成/.test(line); });
      if (!actionableLines.length) { executability = 55; executabilityReasons.push('行动章节缺少可执行步骤'); }
      else if (actionableLines.length < Math.max(2, actionSections.length)) { executability = 75; executabilityReasons.push('行动步骤较少，建议人工补充负责人或时间'); }
    }
    var overall = Math.round(accuracy * 0.4 + completeness * 0.25 + executability * 0.2 + sourceCoverage * 0.15);
    var threshold = Number(options.threshold == null ? 80 : options.threshold);
    var reasons = accuracyReasons.concat(executabilityReasons);
    if (!sections.length) reasons.push('报告缺少结构化章节');
    if (completeness < 60) reasons.push('章节完整性低于 60%');
    if (sourceCoverage < 80) reasons.push('来源覆盖率低于 80%');
    return {
      version: 'content-quality-1',
      ok: !!sections.length && accuracy >= 80 && completeness >= 60 && executability >= 60 && sourceCoverage >= 80 && overall >= threshold,
      status: overall >= threshold && reasons.length === 0 ? 'passed' : (overall >= 60 ? 'needs_review' : 'blocked'),
      overall: overall,
      threshold: threshold,
      dimensions: { accuracy: accuracy, completeness: completeness, executability: executability, sourceCoverage: sourceCoverage },
      factualLineCount: factual.length,
      citedFactualLineCount: cited.length,
      reasons: reasons,
      assessedAt: new Date().toISOString()
    };
  }

  root.JAY_REPORT_QUALITY = {
    maxAgeMs: MAX_AGE_MS,
    evaluate: evaluate,
    allowsStoredReport: allowsStoredReport,
    assessContent: assessContent
  };
}(window));
