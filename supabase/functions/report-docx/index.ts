// JWT-protected DOCX export. The document is a real OOXML package rather
// than a Markdown file with a .docx extension, so Word can open and edit it.
const defaultOrigins = [
  'https://lidengrong3-prog.github.io', 'http://localhost:8000',
  'http://127.0.0.1:8000', 'http://localhost:4173', 'http://127.0.0.1:4173',
  'http://localhost:4174', 'http://127.0.0.1:4174',
];
function allowedOrigins(): string[] { const configured = Deno.env.get('ALLOWED_ORIGINS'); return configured ? configured.split(',').map((v) => v.trim()).filter(Boolean) : defaultOrigins; }
function corsHeaders(origin: string | null): Record<string, string> { const allowed = origin && allowedOrigins().includes(origin) ? origin : allowedOrigins()[0]; return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-request-id', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' }; }
function jsonResponse(body: Record<string, unknown>, status: number, origin: string | null): Response { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8', 'X-JAY-Release': Deno.env.get('RELEASE_SHA') || 'unversioned' } }); }
function xml(value: string): string { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
function documentXml(title: string, text: string): string {
  const lines = text.replace(/\r/g, '').split('\n');
  let body = `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>${xml(title)}</w:t></w:r></w:p>`;
  let table: string[][] = [];
  const flush = () => { if (!table.length) return; body += '<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>'; table.forEach((cells) => { body += `<w:tr>${cells.map((cell) => `<w:tc><w:p><w:r><w:t>${xml(cell.trim())}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`; }); body += '</w:tbl>'; table = []; };
  lines.forEach((line) => {
    const value = line.trim();
    if (/^\|.*\|$/.test(value)) { const cells = value.replace(/^\||\|$/g, '').split('|'); if (!cells.every((cell) => /^\s*:?-{2,}:?\s*$/.test(cell))) table.push(cells); return; }
    flush();
    if (!value) { body += '<w:p/>'; return; }
    const heading = value.match(/^(#{1,3})\s+(.+)$/);
    if (heading) { body += `<w:p><w:pPr><w:pStyle w:val="Heading${Math.min(3, heading[1].length)}"/></w:pPr><w:r><w:t>${xml(heading[2])}</w:t></w:r></w:p>`; return; }
    body += `<w:p><w:r><w:t xml:space="preserve">${xml(value.replace(/^[-*]\s+/, ''))}</w:t></w:r></w:p>`;
  });
  flush();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;
}
function concat(parts: Uint8Array[]): Uint8Array { const size = parts.reduce((n, p) => n + p.length, 0); const out = new Uint8Array(size); let offset = 0; parts.forEach((p) => { out.set(p, offset); offset += p.length; }); return out; }
function u16(value: number): number[] { return [value & 255, (value >>> 8) & 255]; }
function u32(value: number): number[] { return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]; }
function crc32(bytes: Uint8Array): number { let table = (crc32 as unknown as { table?: number[] }).table; if (!table) { table = []; for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); table[n] = c >>> 0; } (crc32 as unknown as { table: number[] }).table = table; } let crc = 0xffffffff; for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
function docxBytes(title: string, text: string): Uint8Array {
  const files: Record<string, string> = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/_rels/document.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'word/styles.xml': '<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Microsoft YaHei" w:hAnsi="Microsoft YaHei" w:eastAsia="Microsoft YaHei"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="Heading 3"/><w:rPr><w:b/><w:sz w:val="22"/></w:style></w:styles>',
    'word/document.xml': documentXml(title, text),
  };
  const local: Uint8Array[] = []; const central: Uint8Array[] = []; let offset = 0; const encoder = new TextEncoder();
  Object.entries(files).forEach(([name, value]) => { const nameBytes = encoder.encode(name); const data = encoder.encode(value); const crc = crc32(data); const header = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0)]); const part = concat([header, nameBytes, data]); local.push(part); const centralHeader = new Uint8Array([0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]); central.push(concat([centralHeader, nameBytes])); offset += part.length; });
  const centralBytes = concat(central); const end = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(local.length), ...u16(local.length), ...u32(centralBytes.length), ...u32(offset), ...u16(0)]); return concat([...local, centralBytes, end]);
}
async function authenticatedUser(request: Request, url: string, key: string): Promise<{ id: string } | null> { const authorization = request.headers.get('Authorization') || ''; if (!authorization.startsWith('Bearer ')) return null; const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: authorization } }); return response.ok ? await response.json() : null; }

Deno.serve(async (request) => {
  const startedAt = Date.now();
  const origin = request.headers.get('Origin'); if (origin && !allowedOrigins().includes(origin)) return jsonResponse({ error: 'ORIGIN_NOT_ALLOWED' }, 403, origin); if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) }); if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);
  const supabaseUrl = Deno.env.get('SUPABASE_URL'); const anonKey = Deno.env.get('SUPABASE_ANON_KEY'); const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if (!supabaseUrl || !anonKey || !serviceKey) return jsonResponse({ error: 'REPORT_SERVICE_NOT_CONFIGURED' }, 503, origin);
  const user = await authenticatedUser(request, supabaseUrl, anonKey); if (!user) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401, origin);
  let payload: Record<string, unknown>; try { payload = await request.json(); } catch { return jsonResponse({ error: 'INVALID_JSON' }, 400, origin); }
  const reportId = typeof payload.report_id === 'string' && /^[0-9a-f-]{36}$/i.test(payload.report_id) ? payload.report_id : null;
  const jobsUrl = `${supabaseUrl}/rest/v1/report_exports`;
  const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' };
  const parentExportId = typeof payload.parent_export_id === 'string' && /^[0-9a-f-]{36}$/i.test(payload.parent_export_id) ? payload.parent_export_id : null;
  const attempt = Math.max(1, Math.min(100, Number(payload.attempt || 1)) || 1);
  const requestId = String(payload.request_id || request.headers.get('X-Request-Id') || crypto.randomUUID()).slice(0, 240);
  const idempotencyKey = String(payload.idempotency_key || `report-export:${reportId}:docx:current`).slice(0, 240);
  if (!reportId) return jsonResponse({ error: 'REPORT_ID_REQUIRED' }, 400, origin);
  const reportResponse = await fetch(`${supabaseUrl}/rest/v1/generated_reports?id=eq.${encodeURIComponent(reportId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,title,content,save_status&limit=1`, { headers });
  const reportRows = reportResponse.ok ? await reportResponse.json() : [];
  const report = reportRows?.[0] as { title?: unknown; content?: unknown; save_status?: unknown } | undefined;
  if (!report) return jsonResponse({ error: 'REPORT_NOT_FOUND' }, 404, origin);
  if (report.save_status !== 'saved') return jsonResponse({ error: 'REPORT_NOT_SAVED' }, 409, origin);
  const storedContent = report.content && typeof report.content === 'object' ? report.content as Record<string, unknown> : {};
  const title = String(report.title || 'JAY观海市场决策报告').trim().slice(0, 160);
  const text = String(storedContent.text || '').trim();
  if (!text) return jsonResponse({ error: 'REPORT_CONTENT_REQUIRED' }, 400, origin);
  if (text.length > 80000) return jsonResponse({ error: 'REPORT_TOO_LARGE' }, 413, origin);
  const existingResponse = await fetch(`${jobsUrl}?user_id=eq.${encodeURIComponent(user.id)}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id,status,file_path,error_message,created_at&limit=1`, { headers }); const existingRows = existingResponse.ok ? await existingResponse.json() : []; const existing = existingRows?.[0];
  if (existing && existing.status !== 'failed') { if (existing.status === 'completed' && existing.file_path) { const existingPath = String(existing.file_path).split('/').map(encodeURIComponent).join('/'); const signedExisting = await fetch(`${supabaseUrl}/storage/v1/object/sign/reports/${existingPath}`, { method: 'POST', headers, body: JSON.stringify({ expiresIn: 3600 }) }); if (signedExisting.ok) { const signedBody = await signedExisting.json(); const rawUrl = signedBody.signedURL || signedBody.signedUrl; const fileUrl = String(rawUrl || '').startsWith('http') ? rawUrl : `${supabaseUrl}/storage/v1${rawUrl || ''}`; return jsonResponse({ id: existing.id, status: 'completed', duplicate: true, file_url: fileUrl, expires_in: 3600 }, 200, origin); } } return jsonResponse({ id: existing.id, status: existing.status, duplicate: true }, 202, origin); }
  const created = await fetch(jobsUrl, { method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify({ user_id: user.id, report_id: reportId, format: 'docx', status: 'queued', parent_export_id: parentExportId, attempt, request_id: requestId, idempotency_key: idempotencyKey, metadata: { function: 'report-docx', content_source: 'persisted_report', data_snapshot_at: storedContent.data_snapshot_at || null, source_record_ids: storedContent.source_record_ids || [] } }) }); if (!created.ok) { const failure = await created.text(); if (failure.includes('EXPORT_QUOTA_EXCEEDED')) return jsonResponse({ error: 'EXPORT_QUOTA_EXCEEDED' }, 429, origin); if (created.status === 409) return jsonResponse({ error: 'REPORT_EXPORT_IN_PROGRESS' }, 409, origin); return jsonResponse({ error: 'REPORT_EXPORT_RECORD_FAILED' }, 502, origin); } const rows = await created.json(); const jobId = rows?.[0]?.id;
  const update = async (values: Record<string, unknown>) => { if (jobId) await fetch(`${jobsUrl}?id=eq.${encodeURIComponent(jobId)}`, { method: 'PATCH', headers, body: JSON.stringify(values) }); }; await update({ status: 'processing', started_at: new Date().toISOString() });
  const path = `${user.id}/${crypto.randomUUID()}.docx`; const encoded = path.split('/').map(encodeURIComponent).join('/'); const upload = await fetch(`${supabaseUrl}/storage/v1/object/reports/${encoded}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'x-upsert': 'false' }, body: docxBytes(title, text) }); if (!upload.ok) { await update({ status: 'failed', error_message: 'REPORT_STORAGE_UPLOAD_FAILED', duration_ms: Date.now() - startedAt, completed_at: new Date().toISOString() }); return jsonResponse({ error: 'REPORT_STORAGE_UPLOAD_FAILED', id: jobId }, 502, origin); }
  const signed = await fetch(`${supabaseUrl}/storage/v1/object/sign/reports/${encoded}`, { method: 'POST', headers, body: JSON.stringify({ expiresIn: 3600 }) }); if (!signed.ok) { await update({ status: 'failed', file_path: path, error_message: 'REPORT_SIGNED_URL_FAILED', duration_ms: Date.now() - startedAt, completed_at: new Date().toISOString() }); return jsonResponse({ error: 'REPORT_SIGNED_URL_FAILED', id: jobId }, 502, origin); } const signedBody = await signed.json(); const rawUrl = signedBody.signedURL || signedBody.signedUrl; if (!rawUrl) { await update({ status: 'failed', file_path: path, error_message: 'REPORT_SIGNED_URL_MISSING', duration_ms: Date.now() - startedAt, completed_at: new Date().toISOString() }); return jsonResponse({ error: 'REPORT_SIGNED_URL_MISSING', id: jobId }, 502, origin); }
  const fileUrl = String(rawUrl).startsWith('http') ? rawUrl : `${supabaseUrl}/storage/v1${rawUrl}`; await update({ status: 'completed', file_path: path, error_message: null, duration_ms: Date.now() - startedAt, completed_at: new Date().toISOString() }); return jsonResponse({ id: jobId || null, status: 'completed', file_url: fileUrl, expires_in: 3600 }, 200, origin);
});
