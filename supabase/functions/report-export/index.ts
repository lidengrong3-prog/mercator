const defaultOrigins = [
  'https://lidengrong3-prog.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:4174',
  'http://127.0.0.1:4174',
];

function allowedOrigins(): string[] {
  const configured = Deno.env.get('ALLOWED_ORIGINS');
  return configured ? configured.split(',').map((v) => v.trim()).filter(Boolean) : defaultOrigins;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && allowedOrigins().includes(origin) ? origin : allowedOrigins()[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-request-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function jsonResponse(body: Record<string, unknown>, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8', 'X-JAY-Release': Deno.env.get('RELEASE_SHA') || 'unversioned' },
  });
}

function pdfHex(value: string): string {
  let result = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    result += code.toString(16).padStart(4, '0');
  }
  return result;
}

function wrapText(value: string, width = 42): string[] {
  const lines: string[] = [];
  String(value || '').replace(/\r/g, '').split('\n').forEach((source) => {
    if (!source) { lines.push(''); return; }
    let current = '';
    for (const char of source) {
      current += char;
      if (current.length >= width) { lines.push(current); current = ''; }
    }
    if (current) lines.push(current);
  });
  return lines.length ? lines : [''];
}

function buildPdf(title: string, text: string): Uint8Array {
  const sourceLines = `${title}\n\n${text}`.replace(/\r/g, '').split('\n');
  const lines: Array<{ text: string; size: number }> = [];
  let chartMode = false;
  sourceLines.forEach((source) => {
    const value = source.trim();
    if (value === '```chart') { chartMode = true; lines.push({ text: '[图表]', size: 11 }); return; }
    if (chartMode) { if (value === '```') chartMode = false; return; }
    const size = value === title ? 20 : (/^##\s+/.test(value) ? 16 : (/^###\s+/.test(value) ? 14 : (/^\|/.test(value) ? 10 : 12)));
    const clean = value.replace(/^#{1,3}\s+/, '');
    wrapText(clean, size <= 10 ? 52 : 42).forEach((line) => lines.push({ text: line, size }));
  });
  const pageLines = 38;
  const pages: Array<Array<{ text: string; size: number }>> = [];
  for (let i = 0; i < lines.length; i += pageLines) pages.push(lines.slice(i, i + pageLines));
  if (!pages.length) pages.push([{ text: '', size: 12 }]);

  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [4 0 R] >>';
  objects[4] = '<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> /DW 1000 >>';
  const kids: number[] = [];
  let nextObject = 5;
  pages.forEach((page) => {
    const contentNumber = nextObject;
    const pageNumber = nextObject + 1;
    nextObject += 2;
    const commands = ['BT', '50 790 Td'];
    page.forEach((line, index) => {
      if (index > 0) commands.push('0 -19 Td');
      commands.push(`/F1 ${line.size} Tf`);
      commands.push(`<${pdfHex(line.text)}> Tj`);
    });
    commands.push('ET');
    const stream = commands.join('\n');
    objects[contentNumber] = `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`;
    objects[pageNumber] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNumber} 0 R >>`;
    kids.push(pageNumber);
  });
  objects[2] = `<< /Type /Pages /Kids [${kids.map((n) => `${n} 0 R`).join(' ')}] /Count ${kids.length} >>`;

  let output = '%PDF-1.4\n%JAYG\n';
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    if (index === 0 || !object) return;
    offsets[index] = new TextEncoder().encode(output).length;
    output += `${index} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = new TextEncoder().encode(output).length;
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i += 1) output += `${String(offsets[i] || 0).padStart(10, '0')} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new TextEncoder().encode(output);
}

async function authenticatedUser(request: Request, supabaseUrl: string, anonKey: string): Promise<{ id: string; email?: string } | null> {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  if (!response.ok) return null;
  return await response.json();
}

Deno.serve(async (request) => {
  const startedAt = Date.now();
  const origin = request.headers.get('Origin');
  if (origin && !allowedOrigins().includes(origin)) return jsonResponse({ error: 'ORIGIN_NOT_ALLOWED' }, 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return jsonResponse({ error: 'REPORT_SERVICE_NOT_CONFIGURED' }, 503, origin);
  const user = await authenticatedUser(request, supabaseUrl, anonKey);
  if (!user) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401, origin);

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return jsonResponse({ error: 'INVALID_JSON' }, 400, origin); }

  const serviceHeaders = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' };
  const reportId = typeof payload.report_id === 'string' && /^[0-9a-f-]{36}$/i.test(payload.report_id) ? payload.report_id : null;
  if (!reportId) return jsonResponse({ error: 'REPORT_ID_REQUIRED' }, 400, origin);
  const reportResponse = await fetch(`${supabaseUrl}/rest/v1/generated_reports?id=eq.${encodeURIComponent(reportId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,title,content,save_status&limit=1`, { headers: serviceHeaders });
  const reportRows = reportResponse.ok ? await reportResponse.json() : [];
  const report = reportRows?.[0] as { title?: unknown; content?: unknown; save_status?: unknown } | undefined;
  if (!report) return jsonResponse({ error: 'REPORT_NOT_FOUND' }, 404, origin);
  if (report.save_status !== 'saved') return jsonResponse({ error: 'REPORT_NOT_SAVED' }, 409, origin);
  const storedContent = report.content && typeof report.content === 'object' ? report.content as Record<string, unknown> : {};
  const title = String(report.title || 'JAY观海市场决策报告').trim().slice(0, 160);
  const text = String(storedContent.text || '').trim();
  if (!text) return jsonResponse({ error: 'REPORT_CONTENT_REQUIRED' }, 400, origin);
  if (text.length > 80_000) return jsonResponse({ error: 'REPORT_TOO_LARGE' }, 413, origin);
  const jobsUrl = `${supabaseUrl}/rest/v1/report_exports`;
  const parentExportId = typeof payload.parent_export_id === 'string' && /^[0-9a-f-]{36}$/i.test(payload.parent_export_id) ? payload.parent_export_id : null;
  const attempt = Math.max(1, Math.min(100, Number(payload.attempt || 1)) || 1);
  const requestId = String(payload.request_id || request.headers.get('X-Request-Id') || crypto.randomUUID()).slice(0, 240);
  const idempotencyKey = String(payload.idempotency_key || `report-export:${reportId}:pdf:current`).slice(0, 240);
  const existingResponse = await fetch(`${jobsUrl}?user_id=eq.${encodeURIComponent(user.id)}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id,status,file_path,error_message,created_at&limit=1`, { headers: serviceHeaders });
  const existingRows = existingResponse.ok ? await existingResponse.json() : [];
  const existing = existingRows?.[0];
  if (existing && existing.status !== 'failed') {
    if (existing.status === 'completed' && existing.file_path) {
      const existingPath = String(existing.file_path).split('/').map(encodeURIComponent).join('/');
      const signedExisting = await fetch(`${supabaseUrl}/storage/v1/object/sign/reports/${existingPath}`, { method: 'POST', headers: serviceHeaders, body: JSON.stringify({ expiresIn: 3600 }) });
      if (signedExisting.ok) {
        const signedBody = await signedExisting.json();
        const rawUrl = signedBody.signedURL || signedBody.signedUrl;
        const fileUrl = rawUrl && String(rawUrl).startsWith('http') ? rawUrl : `${supabaseUrl}/storage/v1${rawUrl || ''}`;
        return jsonResponse({ id: existing.id, status: 'completed', duplicate: true, file_url: fileUrl, expires_in: 3600 }, 200, origin);
      }
    }
    return jsonResponse({ id: existing.id, status: existing.status, duplicate: true }, 202, origin);
  }
  const jobCreate = await fetch(jobsUrl, {
    method: 'POST',
    headers: { ...serviceHeaders, Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: user.id, report_id: reportId, format: 'pdf', status: 'queued', parent_export_id: parentExportId, attempt, request_id: requestId, idempotency_key: idempotencyKey, metadata: { function: 'report-export', content_source: 'persisted_report', data_snapshot_at: storedContent.data_snapshot_at || null, source_record_ids: storedContent.source_record_ids || [] } }),
  });
  if (!jobCreate.ok) {
    if (jobCreate.status === 409) return jsonResponse({ error: 'REPORT_EXPORT_IN_PROGRESS' }, 409, origin);
    return jsonResponse({ error: 'REPORT_EXPORT_RECORD_FAILED' }, 502, origin);
  }
  const jobRows = await jobCreate.json();
  const jobId = jobRows?.[0]?.id;
  const updateJob = async (values: Record<string, unknown>) => {
    if (!jobId) return;
    await fetch(`${jobsUrl}?id=eq.${encodeURIComponent(jobId)}`, {
      method: 'PATCH',
      headers: serviceHeaders,
      body: JSON.stringify(values),
    });
  };
  await updateJob({ status: 'processing', started_at: new Date().toISOString() });

  const path = `${user.id}/${crypto.randomUUID()}.pdf`;
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const upload = await fetch(`${supabaseUrl}/storage/v1/object/reports/${encodedPath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/pdf', 'x-upsert': 'false' },
    body: buildPdf(title, text),
  });
  if (!upload.ok) {
    await updateJob({ status: 'failed', error_message: 'REPORT_STORAGE_UPLOAD_FAILED', duration_ms: Date.now() - startedAt, completed_at: new Date().toISOString() });
    return jsonResponse({ error: 'REPORT_STORAGE_UPLOAD_FAILED', id: jobId }, 502, origin);
  }

  const signed = await fetch(`${supabaseUrl}/storage/v1/object/sign/reports/${encodedPath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  if (!signed.ok) {
    await updateJob({ status: 'failed', file_path: path, error_message: 'REPORT_SIGNED_URL_FAILED', duration_ms: Date.now() - startedAt, completed_at: new Date().toISOString() });
    return jsonResponse({ error: 'REPORT_SIGNED_URL_FAILED', id: jobId }, 502, origin);
  }
  const signedBody = await signed.json();
  const rawUrl = signedBody.signedURL || signedBody.signedUrl;
  if (!rawUrl) {
    await updateJob({ status: 'failed', file_path: path, error_message: 'REPORT_SIGNED_URL_MISSING', duration_ms: Date.now() - startedAt, completed_at: new Date().toISOString() });
    return jsonResponse({ error: 'REPORT_SIGNED_URL_MISSING', id: jobId }, 502, origin);
  }
  const fileUrl = rawUrl && String(rawUrl).startsWith('http') ? rawUrl : `${supabaseUrl}/storage/v1${rawUrl || ''}`;

  await updateJob({ status: 'completed', file_path: path, file_url: null, error_message: null, duration_ms: Date.now() - startedAt, completed_at: new Date().toISOString() });
  return jsonResponse({ id: jobId || null, status: 'completed', file_url: fileUrl, expires_in: 3600 }, 200, origin);
});
