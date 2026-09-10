import { parseReportDocument, parseReportInlines, reportChartSvg, type ReportBlock, type ReportChart, type ReportCitation, type ReportInline } from './report-document.ts';

type BinaryFile = string | Uint8Array;
type Relationship = { id: string; type: string; target: string; external?: boolean };

function xml(value: string): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  parts.forEach((part) => { output.set(part, offset); offset += part.length; });
  return output;
}

function u16(value: number): number[] {
  return [value & 255, (value >>> 8) & 255];
}

function u32(value: number): number[] {
  return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255];
}

function crc32(bytes: Uint8Array): number {
  let table = (crc32 as unknown as { table?: number[] }).table;
  if (!table) {
    table = [];
    for (let value = 0; value < 256; value += 1) {
      let checksum = value;
      for (let bit = 0; bit < 8; bit += 1) checksum = (checksum & 1) ? (0xedb88320 ^ (checksum >>> 1)) : (checksum >>> 1);
      table[value] = checksum >>> 0;
    }
    (crc32 as unknown as { table: number[] }).table = table;
  }
  let checksum = 0xffffffff;
  for (const byte of bytes) checksum = table[(checksum ^ byte) & 255] ^ (checksum >>> 8);
  return (checksum ^ 0xffffffff) >>> 0;
}

function zip(files: Record<string, BinaryFile>): Uint8Array {
  const encoder = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  Object.entries(files).forEach(([name, value]) => {
    const nameBytes = encoder.encode(name);
    const data = typeof value === 'string' ? encoder.encode(value) : value;
    const checksum = crc32(data);
    const header = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(checksum), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0)]);
    const part = concat([header, nameBytes, data]);
    local.push(part);
    const centralHeader = new Uint8Array([0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(checksum), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]);
    central.push(concat([centralHeader, nameBytes]));
    offset += part.length;
  });
  const directory = concat(central);
  const end = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(local.length), ...u16(local.length), ...u32(directory.length), ...u32(offset), ...u16(0)]);
  return concat([...local, directory, end]);
}

class DocxDocumentBuilder {
  relationships: Relationship[] = [
    { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles', target: 'styles.xml' },
    { id: 'rId2', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer', target: 'footer1.xml' },
  ];
  media: Record<string, BinaryFile> = {};
  citationMap: Record<string, ReportCitation>;
  hyperlinkIds = new Map<string, string>();
  drawingId = 1;

  constructor(citations: Record<string, ReportCitation>) {
    this.citationMap = citations;
  }

  relationship(type: string, target: string, external = false): string {
    const id = `rId${this.relationships.length + 1}`;
    this.relationships.push({ id, type, target, ...(external ? { external: true } : {}) });
    return id;
  }

  hyperlink(url: string): string {
    const existing = this.hyperlinkIds.get(url);
    if (existing) return existing;
    const id = this.relationship('http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink', url, true);
    this.hyperlinkIds.set(url, id);
    return id;
  }

  runs(inlines: ReportInline[]): string {
    return inlines.map((inline) => {
      const properties = [inline.bold ? '<w:b/>' : '', inline.url ? '<w:rStyle w:val="Hyperlink"/>' : ''].join('');
      const run = `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ''}<w:t xml:space="preserve">${xml(inline.text)}</w:t></w:r>`;
      return inline.url ? `<w:hyperlink r:id="${this.hyperlink(inline.url)}" w:history="1">${run}</w:hyperlink>` : run;
    }).join('');
  }

  paragraph(inlines: ReportInline[], options: { style?: string; prefix?: string; keepNext?: boolean; spacingAfter?: number } = {}): string {
    const properties = [options.style ? `<w:pStyle w:val="${options.style}"/>` : '', options.keepNext ? '<w:keepNext/>' : '', options.spacingAfter != null ? `<w:spacing w:after="${options.spacingAfter}"/>` : ''].join('');
    const prefix = options.prefix ? `<w:r><w:t xml:space="preserve">${xml(options.prefix)}</w:t></w:r>` : '';
    return `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ''}${prefix}${this.runs(inlines)}</w:p>`;
  }

  table(rows: ReportInline[][][], compact = false): string {
    if (!rows.length) return '';
    const columnCount = Math.max(...rows.map((row) => row.length));
    const width = Math.floor(9972 / Math.max(1, columnCount));
    const grid = Array.from({ length: columnCount }, () => `<w:gridCol w:w="${width}"/>`).join('');
    const body = rows.map((row, rowIndex) => `<w:tr>${Array.from({ length: columnCount }, (_, columnIndex) => {
      const inlines = row[columnIndex] || [{ text: '' }];
      const shade = rowIndex === 0 ? '<w:shd w:fill="E9F1F6"/>' : '';
      return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shade}</w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${this.runs(inlines)}</w:p></w:tc>`;
    }).join('')}</w:tr>`).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="AABBC7"/><w:left w:val="single" w:sz="4" w:color="AABBC7"/><w:bottom w:val="single" w:sz="4" w:color="AABBC7"/><w:right w:val="single" w:sz="4" w:color="AABBC7"/><w:insideH w:val="single" w:sz="4" w:color="C7D2DA"/><w:insideV w:val="single" w:sz="4" w:color="C7D2DA"/></w:tblBorders>${compact ? '<w:tblCellMar><w:top w:w="50" w:type="dxa"/><w:left w:w="70" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar>' : ''}</w:tblPr><w:tblGrid>${grid}</w:tblGrid>${body}</w:tbl>`;
  }

  chart(chart: ReportChart): string {
    const rendered = reportChartSvg(chart);
    const index = this.drawingId++;
    const filename = `chart-${index}.svg`;
    this.media[`word/media/${filename}`] = rendered.svg;
    const relationshipId = this.relationship('http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', `media/${filename}`);
    const width = 5486400;
    const height = Math.round(width * rendered.height / rendered.width);
    const drawing = `<w:p><w:pPr><w:keepNext/><w:spacing w:after="80"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${width}" cy="${height}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${index}" name="${xml(chart.title)}" descr="JAY观海报告图表"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${xml(filename)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    const series = chart.series.length ? chart.series : [{ name: '数值', values: chart.values }];
    const dataRows: ReportInline[][][] = [[[{ text: '项目', bold: true }], ...series.map((item) => [{ text: item.name || '数值', bold: true }])]];
    chart.labels.forEach((label, labelIndex) => dataRows.push([[{ text: label }], ...series.map((item) => [{ text: String(item.values[labelIndex]) }])]));
    const caption = [chart.source ? `来源：${chart.source}` : '', chart.note].filter(Boolean).join(' · ');
    return drawing + this.table(dataRows, true) + (caption ? this.paragraph(parseReportInlines(caption, this.citationMap), { style: 'Caption', spacingAfter: 120 }) : '');
  }

  block(block: ReportBlock): string {
    if (block.type === 'heading') return this.paragraph(block.inlines, { style: `Heading${block.level}`, keepNext: true, spacingAfter: 100 });
    if (block.type === 'paragraph') return this.paragraph(block.inlines, { spacingAfter: 120 });
    if (block.type === 'list') return block.items.map((item, index) => this.paragraph(item, { prefix: block.ordered ? `${index + 1}. ` : '• ', spacingAfter: 40 })).join('');
    if (block.type === 'table') return this.table(block.rows) + '<w:p><w:pPr><w:spacing w:after="100"/></w:pPr></w:p>';
    if (block.type === 'chart') return this.chart(block.chart);
    return this.paragraph([{ text: block.text }], { style: 'Code', spacingAfter: 100 });
  }

  relationshipXml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${this.relationships.map((relationship) => `<Relationship Id="${relationship.id}" Type="${relationship.type}" Target="${xml(relationship.target)}"${relationship.external ? ' TargetMode="External"' : ''}/>`).join('')}</Relationships>`;
  }
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Microsoft YaHei" w:hAnsi="Microsoft YaHei" w:eastAsia="Microsoft YaHei" w:cs="Microsoft YaHei"/><w:lang w:val="zh-CN" w:eastAsia="zh-CN"/><w:sz w:val="21"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:line="320" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="240"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:color w:val="143B52"/><w:sz w:val="38"/><w:szCs w:val="38"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="300" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="143B52"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="205B7A"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="180" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:color w:val="2D607B"/><w:sz w:val="23"/><w:szCs w:val="23"/></w:rPr></w:style>
  <w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:basedOn w:val="DefaultParagraphFont"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="Caption"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="60" w:after="120"/></w:pPr><w:rPr><w:color w:val="60717C"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:shd w:fill="F4F6F7"/><w:ind w:left="180" w:right="180"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:eastAsia="Microsoft YaHei"/><w:sz w:val="18"/><w:color w:val="7A3528"/></w:rPr></w:style>
</w:styles>`;

const FOOTER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:color w:val="667985"/><w:sz w:val="18"/></w:rPr><w:t>第 </w:t></w:r><w:fldSimple w:instr=" PAGE "><w:r><w:rPr><w:color w:val="667985"/><w:sz w:val="18"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple><w:r><w:rPr><w:color w:val="667985"/><w:sz w:val="18"/></w:rPr><w:t> 页 / 共 </w:t></w:r><w:fldSimple w:instr=" NUMPAGES "><w:r><w:rPr><w:color w:val="667985"/><w:sz w:val="18"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple><w:r><w:rPr><w:color w:val="667985"/><w:sz w:val="18"/></w:rPr><w:t> 页</w:t></w:r></w:p></w:ftr>`;

export function buildReportDocx(title: string, text: string, content: unknown = {}): Uint8Array {
  const document = parseReportDocument(title, text, content);
  const builder = new DocxDocumentBuilder(document.citations);
  const body = builder.paragraph([{ text: document.title }], { style: 'Title' }) + document.blocks.map((block) => builder.block(block)).join('');
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1276" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="svg" ContentType="image/svg+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`;
  return zip({
    '[Content_Types].xml': contentTypes,
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/_rels/document.xml.rels': builder.relationshipXml(),
    'word/styles.xml': STYLES,
    'word/footer1.xml': FOOTER,
    'word/document.xml': documentXml,
    ...builder.media,
  });
}
