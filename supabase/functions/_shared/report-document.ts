export type ReportInline = {
  text: string;
  bold?: boolean;
  url?: string;
  citation?: string;
};

export type ReportCitation = {
  id: string;
  url: string | null;
  source: string;
};

export type ReportChartSeries = {
  name: string;
  values: number[];
};

export type ReportChart = {
  type: 'bar' | 'hbar' | 'line' | 'pie';
  title: string;
  labels: string[];
  values: number[];
  series: ReportChartSeries[];
  source: string;
  note: string;
};

export type ReportBlock =
  | { type: 'heading'; level: 1 | 2 | 3; inlines: ReportInline[] }
  | { type: 'paragraph'; inlines: ReportInline[] }
  | { type: 'list'; ordered: boolean; items: ReportInline[][] }
  | { type: 'table'; rows: ReportInline[][][] }
  | { type: 'chart'; chart: ReportChart }
  | { type: 'code'; text: string };

export type ReportDocument = {
  title: string;
  blocks: ReportBlock[];
  citations: Record<string, ReportCitation>;
};

type Row = Record<string, unknown>;

function object(value: unknown): Row | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function limitedText(value: unknown, limit: number): string {
  return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, limit);
}

export function safeHttpsUrl(value: unknown): string | null {
  const raw = limitedText(value, 2048);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function citationId(value: unknown): string | null {
  const match = limitedText(value, 32).toUpperCase().match(/S\d{3,6}/);
  return match ? match[0] : null;
}

export function extractReportCitations(content: unknown): Record<string, ReportCitation> {
  const row = object(content) || {};
  const model = object(row.model) || {};
  const candidates = array(row.source_appendix || row.sourceAppendix || model.sourceAppendix || model.source_appendix);
  const citations: Record<string, ReportCitation> = {};
  candidates.forEach((candidate) => {
    const source = object(candidate);
    if (!source) return;
    const id = citationId(source.citation || source.citation_id || source.id);
    if (!id || citations[id]) return;
    citations[id] = {
      id,
      url: safeHttpsUrl(source.originalUrl || source.original_url || source.url || source.source_url || source.sourceUrl),
      source: limitedText(source.source || source.source_name || source.name || '未命名来源', 240),
    };
  });
  return citations;
}

function trimUrlToken(value: string): { value: string; suffix: string } {
  let url = value;
  let suffix = '';
  while (url && /[，。；：、,.!?;:]$/.test(url)) {
    suffix = url.slice(-1) + suffix;
    url = url.slice(0, -1);
  }
  return { value: url, suffix };
}

export function parseReportInlines(value: string, citations: Record<string, ReportCitation>): ReportInline[] {
  const source = String(value || '').replace(/`([^`]+)`/g, '$1');
  const token = /(\[S\d{3,6}\]|\*\*|https:\/\/[^\s<>()]+)/gi;
  const runs: ReportInline[] = [];
  let bold = false;
  let index = 0;
  let match: RegExpExecArray | null;
  const push = (text: string, attributes: Partial<ReportInline> = {}) => {
    if (!text) return;
    const previous = runs[runs.length - 1];
    if (previous && previous.bold === attributes.bold && previous.url === attributes.url && previous.citation === attributes.citation) previous.text += text;
    else runs.push({ text, ...(attributes.bold ? { bold: true } : {}), ...(attributes.url ? { url: attributes.url } : {}), ...(attributes.citation ? { citation: attributes.citation } : {}) });
  };
  while ((match = token.exec(source))) {
    push(source.slice(index, match.index), { bold });
    const value = match[0];
    if (value === '**') bold = !bold;
    else if (/^\[S\d{3,6}\]$/i.test(value)) {
      const id = value.slice(1, -1).toUpperCase();
      push(`[${id}]`, { bold, citation: id, url: citations[id]?.url || undefined });
    } else {
      const parts = trimUrlToken(value);
      const url = safeHttpsUrl(parts.value);
      push(parts.value, { bold, url: url || undefined });
      push(parts.suffix, { bold });
    }
    index = token.lastIndex;
  }
  push(source.slice(index), { bold });
  return runs.length ? runs : [{ text: '' }];
}

function splitMarkdownRow(value: string): string[] {
  const source = value.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let cell = '';
  let escaped = false;
  for (const char of source) {
    if (escaped) { cell += char; escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (char === '|') { cells.push(cell.trim()); cell = ''; continue; }
    cell += char;
  }
  cells.push(cell.trim());
  return cells.slice(0, 16);
}

function isTableSeparator(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell.replace(/\s/g, '')));
}

function finiteValues(value: unknown, expected: number): number[] | null {
  if (!Array.isArray(value) || value.length !== expected) return null;
  const values = value.map(Number);
  return values.every((item) => Number.isFinite(item) && Math.abs(item) <= 1e15) ? values : null;
}

export function parseReportChart(value: string): ReportChart | null {
  let raw: Row;
  try {
    raw = object(JSON.parse(value)) || {};
  } catch {
    return null;
  }
  const type = limitedText(raw.type || 'bar', 12).toLowerCase();
  if (!['bar', 'hbar', 'line', 'pie'].includes(type)) return null;
  const labels = array(raw.labels).map((item) => limitedText(item, 48));
  if (!labels.length || labels.length > 24 || labels.some((label) => !label)) return null;
  const values = finiteValues(raw.values, labels.length) || [];
  const series: ReportChartSeries[] = [];
  if (Array.isArray(raw.series)) {
    if (!raw.series.length || raw.series.length > 8) return null;
    for (const entry of raw.series) {
      const item = object(entry);
      const seriesValues = item ? finiteValues(item.values, labels.length) : null;
      if (!item || !seriesValues) return null;
      series.push({ name: limitedText(item.name || `序列${series.length + 1}`, 48), values: seriesValues });
    }
  }
  if (!values.length && !series.length) return null;
  if (type === 'hbar' && (!values.length || series.length)) return null;
  if (type === 'pie' && (series.length || values.some((item) => item < 0) || values.reduce((sum, item) => sum + item, 0) <= 0)) return null;
  return {
    type: type as ReportChart['type'],
    title: limitedText(raw.title || '图表', 120),
    labels,
    values,
    series,
    source: limitedText(raw.source, 500),
    note: limitedText(raw.note, 500),
  };
}

export function parseReportDocument(title: string, text: string, content: unknown = {}): ReportDocument {
  const citations = extractReportCitations(content);
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const blocks: ReportBlock[] = [];
  let index = 0;
  const paragraph: string[] = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: 'paragraph', inlines: parseReportInlines(paragraph.join(' ').trim(), citations) });
    paragraph.length = 0;
  };
  while (index < lines.length) {
    const line = lines[index];
    const value = line.trim();
    if (!value) { flushParagraph(); index += 1; continue; }
    if (/^```chart\s*$/i.test(value)) {
      flushParagraph();
      const chartLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index].trim())) { chartLines.push(lines[index]); index += 1; }
      if (index < lines.length) index += 1;
      const rawChart = chartLines.join('\n').trim();
      const chart = parseReportChart(rawChart);
      blocks.push(chart ? { type: 'chart', chart } : { type: 'code', text: `图表数据格式无效\n${rawChart}`.trim() });
      continue;
    }
    const heading = value.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ type: 'heading', level: Math.min(3, heading[1].length) as 1 | 2 | 3, inlines: parseReportInlines(heading[2], citations) });
      index += 1;
      continue;
    }
    if (/^\|.*\|$/.test(value)) {
      flushParagraph();
      const rawRows: string[][] = [];
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) { rawRows.push(splitMarkdownRow(lines[index])); index += 1; }
      const rows = rawRows.filter((row) => !isTableSeparator(row)).slice(0, 200).map((row) => row.map((cell) => parseReportInlines(cell, citations)));
      if (rows.length) blocks.push({ type: 'table', rows });
      continue;
    }
    const listMatch = value.match(/^([-*+]\s+|\d+[.)]\s+)(.+)$/);
    if (listMatch) {
      flushParagraph();
      const ordered = /^\d/.test(listMatch[1]);
      const items: ReportInline[][] = [];
      while (index < lines.length) {
        const current = lines[index].trim().match(/^([-*+]\s+|\d+[.)]\s+)(.+)$/);
        if (!current || /^\d/.test(current[1]) !== ordered) break;
        items.push(parseReportInlines(current[2], citations));
        index += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    paragraph.push(value.replace(/^>\s?/, ''));
    index += 1;
  }
  flushParagraph();
  return { title: limitedText(title || 'JAY观海市场决策报告', 160), blocks, citations };
}

export function inlineText(inlines: ReportInline[]): string {
  return inlines.map((run) => run.text).join('');
}

function svgXml(value: string): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function shortLabel(value: string): string {
  return value.length > 12 ? `${value.slice(0, 11)}...` : value;
}

export function reportChartSvg(chart: ReportChart): { svg: string; width: number; height: number } {
  const width = 720;
  const height = chart.type === 'hbar' ? Math.max(320, chart.labels.length * 36 + 120) : 380;
  const colors = ['#2474a6', '#2f855a', '#d97706', '#b83280', '#6b46c1', '#0f766e', '#c2410c', '#475569'];
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`, '<rect width="100%" height="100%" fill="#ffffff"/>', `<text x="36" y="32" font-family="Microsoft YaHei,Noto Sans CJK SC,sans-serif" font-size="18" font-weight="700" fill="#172b3a">${svgXml(chart.title)}</text>`];
  const series = chart.series.length ? chart.series : [{ name: '', values: chart.values }];
  if (chart.type === 'pie') {
    const total = chart.values.reduce((sum, value) => sum + value, 0);
    const cx = 230; const cy = 195; const radius = 112;
    let angle = -Math.PI / 2;
    chart.values.forEach((value, index) => {
      const fraction = value / total;
      const next = angle + fraction * Math.PI * 2;
      if (fraction >= 0.999999) parts.push(`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${colors[index % colors.length]}"/>`);
      else if (fraction > 0) {
        const x1 = cx + radius * Math.cos(angle); const y1 = cy + radius * Math.sin(angle);
        const x2 = cx + radius * Math.cos(next); const y2 = cy + radius * Math.sin(next);
        parts.push(`<path d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${fraction > 0.5 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${colors[index % colors.length]}"/>`);
      }
      const middle = angle + fraction * Math.PI;
      parts.push(`<text x="${(cx + radius * .62 * Math.cos(middle)).toFixed(1)}" y="${(cy + radius * .62 * Math.sin(middle) + 4).toFixed(1)}" text-anchor="middle" font-family="Microsoft YaHei,Noto Sans CJK SC,sans-serif" font-size="12" fill="#ffffff">${Math.round(fraction * 100)}%</text>`);
      const legendY = 90 + index * 29;
      parts.push(`<rect x="410" y="${legendY - 11}" width="13" height="13" fill="${colors[index % colors.length]}"/><text x="432" y="${legendY}" font-family="Microsoft YaHei,Noto Sans CJK SC,sans-serif" font-size="12" fill="#334155">${svgXml(shortLabel(chart.labels[index]))} · ${Math.round(fraction * 100)}%</text>`);
      angle = next;
    });
  } else if (chart.type === 'hbar') {
    const left = 150; const right = 70; const top = 60; const bottom = 62; const plotWidth = width - left - right; const rowHeight = (height - top - bottom) / chart.labels.length;
    const all = series.flatMap((item) => item.values); const max = Math.max(1, ...all.map((item) => Math.max(0, item)));
    chart.labels.forEach((label, index) => {
      const y = top + index * rowHeight + rowHeight * .25; const barHeight = Math.max(10, rowHeight * .5);
      const value = chart.values[index] || 0; const barWidth = Math.max(0, value) / max * plotWidth;
      parts.push(`<text x="${left - 10}" y="${(y + barHeight * .72).toFixed(1)}" text-anchor="end" font-family="Microsoft YaHei,Noto Sans CJK SC,sans-serif" font-size="12" fill="#334155">${svgXml(shortLabel(label))}</text><rect x="${left}" y="${y.toFixed(1)}" width="${plotWidth}" height="${barHeight.toFixed(1)}" fill="#edf2f7"/><rect x="${left}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" fill="${colors[0]}"/><text x="${Math.min(width - 42, left + barWidth + 7).toFixed(1)}" y="${(y + barHeight * .72).toFixed(1)}" font-family="Microsoft YaHei,Noto Sans CJK SC,sans-serif" font-size="11" fill="#334155">${svgXml(String(value))}</text>`);
    });
  } else {
    const left = 58; const right = 24; const top = 58; const bottom = 76; const plotWidth = width - left - right; const plotHeight = height - top - bottom;
    const all = series.flatMap((item) => item.values); const min = Math.min(0, ...all); const max = Math.max(1, ...all); const span = max - min || 1;
    for (let grid = 0; grid <= 4; grid += 1) {
      const y = top + plotHeight - plotHeight * grid / 4; const value = min + span * grid / 4;
      parts.push(`<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="#dfe7ee" stroke-width="1"/><text x="${left - 8}" y="${y + 4}" text-anchor="end" font-family="Microsoft YaHei,Noto Sans CJK SC,sans-serif" font-size="10" fill="#64748b">${svgXml(Number(value.toPrecision(4)).toString())}</text>`);
    }
    if (chart.type === 'line') {
      const step = chart.labels.length > 1 ? plotWidth / (chart.labels.length - 1) : plotWidth / 2;
      series.forEach((item, seriesIndex) => {
        const points = item.values.map((value, index) => `${(left + (chart.labels.length > 1 ? index * step : step)).toFixed(1)},${(top + plotHeight - (value - min) / span * plotHeight).toFixed(1)}`).join(' ');
        parts.push(`<polyline points="${points}" fill="none" stroke="${colors[seriesIndex % colors.length]}" stroke-width="3"/>`);
        item.values.forEach((value, index) => parts.push(`<circle cx="${(left + (chart.labels.length > 1 ? index * step : step)).toFixed(1)}" cy="${(top + plotHeight - (value - min) / span * plotHeight).toFixed(1)}" r="4" fill="${colors[seriesIndex % colors.length]}"/>`));
      });
    } else {
      const groupWidth = plotWidth / chart.labels.length; const barWidth = Math.min(48, groupWidth * .72 / series.length);
      series.forEach((item, seriesIndex) => item.values.forEach((value, index) => {
        const zeroY = top + plotHeight - (0 - min) / span * plotHeight; const valueY = top + plotHeight - (value - min) / span * plotHeight;
        const x = left + index * groupWidth + (groupWidth - barWidth * series.length) / 2 + seriesIndex * barWidth;
        parts.push(`<rect x="${x.toFixed(1)}" y="${Math.min(zeroY, valueY).toFixed(1)}" width="${Math.max(2, barWidth - 2).toFixed(1)}" height="${Math.max(1, Math.abs(zeroY - valueY)).toFixed(1)}" fill="${colors[seriesIndex % colors.length]}"/>`);
      }));
    }
    chart.labels.forEach((label, index) => {
      const x = left + (chart.type === 'line' ? (chart.labels.length > 1 ? index * plotWidth / (chart.labels.length - 1) : plotWidth / 2) : (index + .5) * plotWidth / chart.labels.length);
      parts.push(`<text x="${x.toFixed(1)}" y="${height - 50}" text-anchor="middle" font-family="Microsoft YaHei,Noto Sans CJK SC,sans-serif" font-size="10" fill="#475569">${svgXml(shortLabel(label))}</text>`);
    });
    if (series.length > 1) series.forEach((item, index) => parts.push(`<rect x="${60 + index * 125}" y="${height - 25}" width="12" height="12" fill="${colors[index % colors.length]}"/><text x="${78 + index * 125}" y="${height - 15}" font-family="Microsoft YaHei,Noto Sans CJK SC,sans-serif" font-size="11" fill="#334155">${svgXml(shortLabel(item.name))}</text>`));
  }
  const caption = [chart.source ? `来源：${chart.source}` : '', chart.note].filter(Boolean).join(' · ');
  if (caption) parts.push(`<text x="36" y="${height - 8}" font-family="Microsoft YaHei,Noto Sans CJK SC,sans-serif" font-size="10" fill="#64748b">${svgXml(caption.slice(0, 110))}</text>`);
  parts.push('</svg>');
  return { svg: parts.join(''), width, height };
}
