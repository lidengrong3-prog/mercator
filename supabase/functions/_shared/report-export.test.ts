import { parseReportDocument, parseReportChart } from './report-document.ts';
import { buildReportPdf } from './report-pdf.ts';
import { buildReportDocx } from './report-docx.ts';

const reportText = [
  '## 执行摘要',
  '',
  '美国市场样本为 120 条 [S001]，未核验来源仅作参考 [S002]。',
  '',
  '| 指标 | 数值 | 来源 |',
  '| --- | ---: | --- |',
  '| 样本 | 120 | [S001] |',
  '',
  '```chart',
  JSON.stringify({ type: 'bar', title: '渠道样本', labels: ['Amazon', 'TikTok Shop'], values: [72, 48], source: '[S001]', note: '截至数据快照日期' }),
  '```',
  '',
  '- 保持来源可追溯 [S001]',
].join('\n');

const content = {
  source_appendix: [
    { citation: 'S001', source: '官方样本', url: 'https://example.test/source?id=1' },
    { citation: 'S002', source: '不安全样本', url: 'http://unsafe.test/source' },
  ],
};

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function pdfHex(value: string): string {
  let result = '';
  for (let index = 0; index < value.length; index += 1) result += value.charCodeAt(index).toString(16).padStart(4, '0');
  return result;
}

function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function zipEntries(bytes: Uint8Array): Record<string, Uint8Array> {
  const entries: Record<string, Uint8Array> = {};
  const decoder = new TextDecoder();
  let offset = 0;
  while (offset + 30 <= bytes.length && u32(bytes, offset) === 0x04034b50) {
    const method = u16(bytes, offset + 8);
    const size = u32(bytes, offset + 18);
    const nameLength = u16(bytes, offset + 26);
    const extraLength = u16(bytes, offset + 28);
    expect(method === 0, 'test reader only supports stored ZIP entries');
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    entries[name] = bytes.slice(dataStart, dataStart + size);
    offset = dataStart + size;
  }
  return entries;
}

Deno.test('shared report parser preserves headings, tables, charts and safe citation links', () => {
  const document = parseReportDocument('美国市场报告', reportText, content);
  expect(document.blocks.some((block) => block.type === 'heading' && block.level === 2), 'heading hierarchy was not parsed');
  const table = document.blocks.find((block) => block.type === 'table');
  expect(table?.type === 'table' && table.rows.length === 2 && table.rows[0].length === 3, 'markdown table structure was not preserved');
  const chart = document.blocks.find((block) => block.type === 'chart');
  expect(chart?.type === 'chart' && chart.chart.labels.length === 2 && chart.chart.values[0] === 72, 'chart fence was not parsed');
  expect(document.citations.S001.url?.startsWith('https://example.test/'), 'HTTPS citation was not retained');
  expect(document.citations.S002.url === null, 'non-HTTPS citation must not become a link');
});

Deno.test('chart parser rejects executable or malformed chart payloads', () => {
  expect(parseReportChart('{"type":"bar","labels":["A"],"values":[1]}')?.type === 'bar', 'valid chart was rejected');
  expect(parseReportChart('{"type":"script","labels":["A"],"values":[1]}') === null, 'unknown chart type was accepted');
  expect(parseReportChart('{"type":"bar","labels":["A"],"values":["not-a-number"]}') === null, 'non-numeric chart value was accepted');
  expect(parseReportChart('{"type":"pie","labels":["A"],"values":[-1]}') === null, 'negative pie value was accepted');
});

Deno.test('PDF export draws charts and tables, links citations and writes page numbers', () => {
  const bytes = buildReportPdf('美国市场报告', reportText, content);
  const pdf = new TextDecoder().decode(bytes);
  expect(pdf.startsWith('%PDF-1.7'), 'PDF header is invalid');
  expect(!pdf.includes('[图表]'), 'legacy chart placeholder leaked into PDF');
  expect(pdf.includes('/Subtype /Link'), 'PDF citation link annotation is missing');
  expect(pdf.includes('/URI (https://example.test/source?id=1)'), 'safe citation target is missing');
  expect(!pdf.includes('http://unsafe.test/source'), 'non-HTTPS citation target leaked into PDF');
  expect(pdf.includes(' re f') && pdf.includes(' l S'), 'PDF did not draw chart/table vector content');
  expect(pdf.includes(pdfHex('第 1 页 / 共 1 页')), 'PDF page number is missing');
});

Deno.test('PDF export numbers every page in a multi-page report', () => {
  const longText = Array.from({ length: 180 }, (_, index) => `第 ${index + 1} 条核验结论来自当前数据快照 [S001]。`).join('\n\n');
  const pdf = new TextDecoder().decode(buildReportPdf('多页报告', longText, content));
  const pageCount = Number(pdf.match(/\/Type \/Pages \/Kids \[[^\]]+\] \/Count (\d+)/)?.[1] || 0);
  expect(pageCount > 1, 'long report did not create multiple pages');
  expect(pdf.includes(pdfHex(`第 1 页 / 共 ${pageCount} 页`)), 'first page number is missing');
  expect(pdf.includes(pdfHex(`第 ${pageCount} 页 / 共 ${pageCount} 页`)), 'last page number is missing');
});

Deno.test('DOCX export is editable OOXML with chart, data table, links, Chinese styles and footer', () => {
  const entries = zipEntries(buildReportDocx('美国市场报告', reportText, content));
  ['[Content_Types].xml', 'word/document.xml', 'word/styles.xml', 'word/footer1.xml', 'word/_rels/document.xml.rels', 'word/media/chart-1.svg'].forEach((name) => expect(entries[name], `DOCX entry missing: ${name}`));
  const decode = (name: string) => new TextDecoder().decode(entries[name]);
  const documentXml = decode('word/document.xml');
  const styles = decode('word/styles.xml');
  const footer = decode('word/footer1.xml');
  const relationships = decode('word/_rels/document.xml.rels');
  const chart = decode('word/media/chart-1.svg');
  expect(documentXml.includes('w:pStyle w:val="Heading2"'), 'DOCX heading hierarchy is missing');
  expect((documentXml.match(/<w:tbl>/g) || []).length >= 2, 'report table and editable chart data table are required');
  expect(documentXml.includes('<w:drawing>') && chart.includes('<svg'), 'DOCX chart drawing is missing');
  expect(documentXml.includes('<w:hyperlink'), 'DOCX citation hyperlink is missing');
  expect(relationships.includes('TargetMode="External"') && relationships.includes('https://example.test/source?id=1'), 'DOCX HTTPS relationship is missing');
  expect(!relationships.includes('http://unsafe.test/source'), 'non-HTTPS DOCX relationship was created');
  expect(styles.includes('Microsoft YaHei'), 'DOCX Chinese font style is missing');
  expect(footer.includes(' PAGE ') && footer.includes(' NUMPAGES '), 'DOCX page number fields are missing');
  expect(!documentXml.includes('[图表]'), 'legacy chart placeholder leaked into DOCX');
});
