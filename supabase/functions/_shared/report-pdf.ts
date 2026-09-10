import { inlineText, parseReportDocument, safeHttpsUrl, type ReportBlock, type ReportChart, type ReportInline } from './report-document.ts';

type PdfLink = { x: number; y: number; width: number; height: number; url: string };
type PdfPage = { commands: string[]; links: PdfLink[] };

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;
const FOOTER_HEIGHT = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const COLORS = [
  [0.14, 0.45, 0.65], [0.18, 0.52, 0.35], [0.85, 0.47, 0.02], [0.72, 0.2, 0.5],
  [0.42, 0.27, 0.76], [0.06, 0.46, 0.43], [0.76, 0.25, 0.05], [0.28, 0.35, 0.44],
];

function n(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function pdfHex(value: string): string {
  let result = '';
  for (let index = 0; index < value.length; index += 1) result += value.charCodeAt(index).toString(16).padStart(4, '0');
  return result;
}

function pdfLiteral(value: string): string {
  return String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[\r\n]/g, '');
}

function textWidth(value: string, size: number): number {
  let units = 0;
  for (const char of String(value || '')) units += char.codePointAt(0)! <= 0x7f ? (/[A-ZMW@#%]/.test(char) ? .72 : .54) : 1;
  return units * size;
}

function fitText(value: string, maxWidth: number, size: number): string {
  const source = String(value || '');
  if (textWidth(source, size) <= maxWidth) return source;
  let result = '';
  for (const char of source) {
    if (textWidth(`${result}${char}...`, size) > maxWidth) break;
    result += char;
  }
  return result ? `${result}...` : '';
}

function wrapText(value: string, maxWidth: number, size: number): string[] {
  const source = String(value || '');
  if (!source) return [''];
  const tokens = source.match(/\[S\d{3,6}\]|https:\/\/[^\s<>()]+|[A-Za-z0-9_.,%+/:;()\-]+\s*|\s+|./gi) || [];
  const lines: string[] = [];
  let line = '';
  tokens.forEach((token) => {
    if (textWidth(line + token, size) <= maxWidth || !line) {
      line += token;
      return;
    }
    lines.push(line.trimEnd());
    if (textWidth(token, size) <= maxWidth) { line = token.trimStart(); return; }
    line = '';
    for (const char of token) {
      if (textWidth(line + char, size) > maxWidth && line) { lines.push(line); line = ''; }
      line += char;
    }
  });
  if (line || !lines.length) lines.push(line.trimEnd());
  return lines;
}

function rgb(color: number[]): string {
  return `${n(color[0])} ${n(color[1])} ${n(color[2])}`;
}

class PdfLayout {
  pages: PdfPage[] = [];
  page!: PdfPage;
  y = PAGE_HEIGHT - MARGIN;
  citations: Record<string, { url: string | null }>;

  constructor(citations: Record<string, { url: string | null }>) {
    this.citations = citations;
    this.newPage();
  }

  newPage() {
    this.page = { commands: [], links: [] };
    this.pages.push(this.page);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  ensure(height: number) {
    if (this.y - height < FOOTER_HEIGHT + 18) this.newPage();
  }

  text(text: string, x: number, y: number, size: number, color = [0.11, 0.17, 0.23]) {
    this.page.commands.push(`BT /F1 ${n(size)} Tf ${rgb(color)} rg ${n(x)} ${n(y)} Td <${pdfHex(text)}> Tj ET`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color = [.82, .87, .91], width = 1) {
    this.page.commands.push(`q ${rgb(color)} RG ${n(width)} w ${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S Q`);
  }

  rect(x: number, y: number, width: number, height: number, fill?: number[], stroke?: number[]) {
    const commands = ['q'];
    if (fill) commands.push(`${rgb(fill)} rg`);
    if (stroke) commands.push(`${rgb(stroke)} RG 0.7 w`);
    commands.push(`${n(x)} ${n(y)} ${n(width)} ${n(height)} re ${fill && stroke ? 'B' : fill ? 'f' : 'S'} Q`);
    this.page.commands.push(commands.join(' '));
  }

  linkedText(text: string, x: number, y: number, size: number, color?: number[]) {
    this.text(text, x, y, size, color);
    const pattern = /\[S\d{3,6}\]|https:\/\/[^\s<>()]+/gi;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
      const token = match[0];
      const id = /^\[S/i.test(token) ? token.slice(1, -1).toUpperCase() : '';
      const url = id ? this.citations[id]?.url : safeHttpsUrl(token);
      if (!url) continue;
      this.page.links.push({ x: x + textWidth(text.slice(0, match.index), size), y: y - 2, width: textWidth(token, size), height: size + 4, url });
    }
  }

  paragraph(inlines: ReportInline[], options: { size?: number; indent?: number; prefix?: string; color?: number[]; after?: number } = {}) {
    const size = options.size || 11;
    const indent = options.indent || 0;
    const prefix = options.prefix || '';
    const lines = wrapText(prefix + inlineText(inlines), CONTENT_WIDTH - indent, size);
    const lineHeight = size * 1.55;
    lines.forEach((line) => {
      this.ensure(lineHeight);
      this.linkedText(line, MARGIN + indent, this.y - size, size, options.color);
      this.y -= lineHeight;
    });
    this.y -= options.after == null ? 5 : options.after;
  }

  heading(block: Extract<ReportBlock, { type: 'heading' }>) {
    const size = block.level === 1 ? 19 : block.level === 2 ? 15 : 13;
    const before = block.level === 1 ? 18 : 12;
    const lines = wrapText(inlineText(block.inlines), CONTENT_WIDTH, size);
    this.ensure(before + lines.length * size * 1.45 + 8);
    this.y -= before;
    lines.forEach((line) => { this.linkedText(line, MARGIN, this.y - size, size, [.06, .19, .28]); this.y -= size * 1.4; });
    if (block.level <= 2) this.line(MARGIN, this.y + 3, PAGE_WIDTH - MARGIN, this.y + 3, [.68, .78, .85], block.level === 1 ? 1.2 : .7);
    this.y -= 7;
  }

  table(rows: ReportInline[][][]) {
    const columnCount = Math.max(...rows.map((row) => row.length));
    if (!columnCount) return;
    const columnWidth = CONTENT_WIDTH / columnCount;
    const size = columnCount > 7 ? 6.8 : columnCount > 5 ? 7.5 : 8.5;
    const header = rows[0];
    const drawRow = (row: ReportInline[][], headerRow: boolean) => {
      const cellLines = Array.from({ length: columnCount }, (_, index) => wrapText(inlineText(row[index] || []), columnWidth - 8, size));
      const rowHeight = Math.max(20, Math.max(...cellLines.map((lines) => lines.length)) * (size + 3) + 8);
      this.ensure(rowHeight + 2);
      const bottom = this.y - rowHeight;
      if (headerRow) this.rect(MARGIN, bottom, CONTENT_WIDTH, rowHeight, [.91, .95, .97]);
      for (let column = 0; column <= columnCount; column += 1) this.line(MARGIN + column * columnWidth, bottom, MARGIN + column * columnWidth, this.y, [.67, .74, .79], .6);
      this.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, this.y, [.67, .74, .79], .6);
      this.line(MARGIN, bottom, PAGE_WIDTH - MARGIN, bottom, [.67, .74, .79], .6);
      cellLines.forEach((lines, column) => lines.forEach((line, lineIndex) => this.linkedText(line, MARGIN + column * columnWidth + 4, this.y - 6 - size - lineIndex * (size + 3), size, headerRow ? [.06, .19, .28] : [.15, .2, .25])));
      this.y = bottom;
      return rowHeight;
    };
    rows.forEach((row, index) => {
      const wasPage = this.pages.length;
      const estimated = Math.max(20, Math.max(...Array.from({ length: columnCount }, (_, cell) => wrapText(inlineText(row[cell] || []), columnWidth - 8, size).length)) * (size + 3) + 8);
      this.ensure(estimated + 2);
      if (this.pages.length !== wasPage && index > 0) drawRow(header, true);
      drawRow(row, index === 0);
    });
    this.y -= 12;
  }

  chart(chart: ReportChart) {
    const height = chart.type === 'hbar' ? Math.min(320, Math.max(210, chart.labels.length * 26 + 80)) : 260;
    this.ensure(height + 26);
    this.linkedText(chart.title, MARGIN, this.y - 13, 13, [.06, .19, .28]);
    const top = this.y - 26;
    const bottom = top - height + 34;
    const left = MARGIN + (chart.type === 'hbar' ? 86 : 42);
    const right = PAGE_WIDTH - MARGIN - 10;
    const plotTop = top - 8;
    const plotBottom = bottom + 38;
    const plotWidth = right - left;
    const plotHeight = plotTop - plotBottom;
    const series = chart.series.length ? chart.series : [{ name: '', values: chart.values }];
    if (chart.type === 'pie') {
      const total = chart.values.reduce((sum, value) => sum + value, 0);
      const cx = MARGIN + 145; const cy = (plotTop + plotBottom) / 2; const radius = Math.min(76, plotHeight / 2 - 4);
      let angle = -Math.PI / 2;
      chart.values.forEach((value, index) => {
        const fraction = value / total; const next = angle + fraction * Math.PI * 2; const steps = Math.max(2, Math.ceil(fraction * 36));
        const path = [`${n(cx)} ${n(cy)} m`, `${n(cx + radius * Math.cos(angle))} ${n(cy + radius * Math.sin(angle))} l`];
        for (let step = 1; step <= steps; step += 1) { const point = angle + (next - angle) * step / steps; path.push(`${n(cx + radius * Math.cos(point))} ${n(cy + radius * Math.sin(point))} l`); }
        path.push('h f');
        this.page.commands.push(`q ${rgb(COLORS[index % COLORS.length])} rg ${path.join(' ')} Q`);
        const legendY = plotTop - 18 - index * 18;
        this.rect(MARGIN + 290, legendY, 9, 9, COLORS[index % COLORS.length]);
        this.text(`${chart.labels[index].slice(0, 15)} ${Math.round(fraction * 100)}%`, MARGIN + 305, legendY, 8.5, [.2, .25, .3]);
        angle = next;
      });
    } else if (chart.type === 'hbar') {
      const max = Math.max(1, ...chart.values.map((value) => Math.max(0, value))); const rowHeight = plotHeight / chart.labels.length;
      chart.labels.forEach((label, index) => {
        const y = plotTop - (index + .72) * rowHeight; const barHeight = Math.max(5, rowHeight * .46); const width = Math.max(0, chart.values[index]) / max * plotWidth;
        this.text(label.slice(0, 12), MARGIN, y + 1, 8, [.2, .25, .3]);
        this.rect(left, y, plotWidth, barHeight, [.92, .95, .97]); this.rect(left, y, width, barHeight, COLORS[0]);
        this.text(String(chart.values[index]), Math.min(right - 26, left + width + 4), y + 1, 7.5, [.2, .25, .3]);
      });
    } else {
      const all = series.flatMap((item) => item.values); const min = Math.min(0, ...all); const max = Math.max(1, ...all); const span = max - min || 1;
      for (let grid = 0; grid <= 4; grid += 1) { const y = plotBottom + plotHeight * grid / 4; this.line(left, y, right, y, [.87, .91, .94], .5); this.text(String(Number((min + span * grid / 4).toPrecision(3))), MARGIN, y - 3, 7, [.4, .46, .52]); }
      if (chart.type === 'line') {
        const step = chart.labels.length > 1 ? plotWidth / (chart.labels.length - 1) : plotWidth / 2;
        series.forEach((item, seriesIndex) => {
          const points = item.values.map((value, index) => [left + (chart.labels.length > 1 ? index * step : step), plotBottom + (value - min) / span * plotHeight]);
          if (points.length) this.page.commands.push(`q ${rgb(COLORS[seriesIndex % COLORS.length])} RG 1.8 w ${points.map((point, index) => `${n(point[0])} ${n(point[1])} ${index ? 'l' : 'm'}`).join(' ')} S Q`);
          points.forEach((point) => this.rect(point[0] - 2, point[1] - 2, 4, 4, COLORS[seriesIndex % COLORS.length]));
        });
      } else {
        const groupWidth = plotWidth / chart.labels.length; const barWidth = Math.min(34, groupWidth * .75 / series.length); const zero = plotBottom + (0 - min) / span * plotHeight;
        series.forEach((item, seriesIndex) => item.values.forEach((value, index) => {
          const y = plotBottom + (value - min) / span * plotHeight; const x = left + index * groupWidth + (groupWidth - barWidth * series.length) / 2 + seriesIndex * barWidth;
          this.rect(x, Math.min(zero, y), Math.max(2, barWidth - 1.5), Math.max(1, Math.abs(y - zero)), COLORS[seriesIndex % COLORS.length]);
        }));
      }
      chart.labels.forEach((label, index) => { const x = left + (chart.type === 'line' ? (chart.labels.length > 1 ? index * plotWidth / (chart.labels.length - 1) : plotWidth / 2) : (index + .5) * plotWidth / chart.labels.length); const fitted = fitText(label, Math.max(34, plotWidth / chart.labels.length - 6), 7); this.text(fitted, x - textWidth(fitted, 7) / 2, bottom + 20, 7, [.3, .36, .42]); });
      if (series.length > 1) series.forEach((item, index) => { const x = MARGIN + index * 95; this.rect(x, bottom + 4, 8, 8, COLORS[index % COLORS.length]); this.text(item.name.slice(0, 9), x + 12, bottom + 4, 7.5, [.2, .25, .3]); });
    }
    const caption = [chart.source ? `来源：${chart.source}` : '', chart.note].filter(Boolean).join(' · ');
    if (caption) this.linkedText(wrapText(caption, CONTENT_WIDTH, 8)[0], MARGIN, bottom - 8, 8, [.38, .44, .5]);
    this.y = bottom - 24;
  }
}

function renderBlock(layout: PdfLayout, block: ReportBlock) {
  if (block.type === 'heading') layout.heading(block);
  else if (block.type === 'paragraph') layout.paragraph(block.inlines);
  else if (block.type === 'list') block.items.forEach((item, index) => layout.paragraph(item, { indent: 12, prefix: block.ordered ? `${index + 1}. ` : '• ', after: 1 }));
  else if (block.type === 'table') layout.table(block.rows);
  else if (block.type === 'chart') layout.chart(block.chart);
  else layout.paragraph([{ text: block.text }], { size: 8.5, color: [.45, .24, .18] });
}

function encodePdf(pages: PdfPage[]): Uint8Array {
  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [4 0 R] >>';
  objects[4] = '<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> /DW 1000 /W [0 127 500] >>';
  const pageIds: number[] = [];
  let nextId = 5;
  pages.forEach((page) => {
    const content = page.commands.join('\n');
    const contentId = nextId++;
    objects[contentId] = `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`;
    const annotationIds = page.links.map((link) => {
      const id = nextId++;
      objects[id] = `<< /Type /Annot /Subtype /Link /Rect [${n(link.x)} ${n(link.y)} ${n(link.x + link.width)} ${n(link.y + link.height)}] /Border [0 0 0] /A << /S /URI /URI (${pdfLiteral(link.url)}) >> >>`;
      return id;
    });
    const pageId = nextId++;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R${annotationIds.length ? ` /Annots [${annotationIds.map((id) => `${id} 0 R`).join(' ')}]` : ''} >>`;
    pageIds.push(pageId);
  });
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let output = '%PDF-1.7\n%JAYG\n';
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = new TextEncoder().encode(output).length;
    output += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = new TextEncoder().encode(output).length;
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) output += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(output);
}

export function buildReportPdf(title: string, text: string, content: unknown = {}): Uint8Array {
  const document = parseReportDocument(title, text, content);
  const layout = new PdfLayout(document.citations);
  const titleLines = wrapText(document.title, CONTENT_WIDTH, 21);
  titleLines.forEach((line) => { layout.ensure(32); layout.linkedText(line, MARGIN, layout.y - 21, 21, [.04, .16, .24]); layout.y -= 31; });
  layout.line(MARGIN, layout.y, PAGE_WIDTH - MARGIN, layout.y, [.14, .45, .65], 2);
  layout.y -= 22;
  document.blocks.forEach((block) => renderBlock(layout, block));
  layout.pages.forEach((page, index) => {
    const label = `第 ${index + 1} 页 / 共 ${layout.pages.length} 页`;
    page.commands.push(`BT /F1 8 Tf 0.4 0.45 0.5 rg ${n((PAGE_WIDTH - textWidth(label, 8)) / 2)} 22 Td <${pdfHex(label)}> Tj ET`);
  });
  return encodePdf(layout.pages);
}
