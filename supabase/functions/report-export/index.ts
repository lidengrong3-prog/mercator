const defaultOrigins = [
  'https://lidengrong3-prog.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

function allowedOrigins(): string[] {
  const configured = Deno.env.get('ALLOWED_ORIGINS');
  return configured ? configured.split(',').map((v) => v.trim()).filter(Boolean) : defaultOrigins;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && allowedOrigins().includes(origin) ? origin : allowedOrigins()[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function jsonResponse(body: Record<string, unknown>, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8' },
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
  const lines = wrapText(`${title}\n\n${text}`, 42);
  const pageLines = 38;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += pageLines) pages.push(lines.slice(i, i + pageLines));
  if (!pages.length) pages.push(['']);

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
    const commands = ['BT', '/F1 13 Tf', '50 790 Td'];
    page.forEach((line, index) => {
      if (index > 0) commands.push('0 -19 Td');
      commands.push(`<${pdfHex(line)}> Tj`);
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
  const title = String(payload.title || 'JAY观海市场决策报告').trim().slice(0, 160);
  const text = String(payload.text || '').trim();
  if (!text) return jsonResponse({ error: 'REPORT_CONTENT_REQUIRED' }, 400, origin);
  if (text.length > 80_000) return jsonResponse({ error: 'REPORT_TOO_LARGE' }, 413, origin);

  const reportId = typeof payload.report_id === 'string' && /^[0-9a-f-]{36}$/i.test(payload.report_id) ? payload.report_id : null;
  const jobsUrl = `${supabaseUrl}/rest/v1/report_exports`;
  const serviceHeaders = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' };
  const jobCreate = await fetch(jobsUrl, {
    method: 'POST',
    headers: { ...serviceHeaders, Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: user.id, report_id: reportId, format: 'pdf', status: 'queued' }),
  });
  if (!jobCreate.ok) return jsonResponse({ error: 'REPORT_EXPORT_RECORD_FAILED' }, 502, origin);
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
  await updateJob({ status: 'processing' });

  const path = `${user.id}/${crypto.randomUUID()}.pdf`;
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const upload = await fetch(`${supabaseUrl}/storage/v1/object/reports/${encodedPath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/pdf', 'x-upsert': 'false' },
    body: buildPdf(title, text),
  });
  if (!upload.ok) {
    await updateJob({ status: 'failed', error_message: 'REPORT_STORAGE_UPLOAD_FAILED' });
    return jsonResponse({ error: 'REPORT_STORAGE_UPLOAD_FAILED', id: jobId }, 502, origin);
  }

  const signed = await fetch(`${supabaseUrl}/storage/v1/object/sign/reports/${encodedPath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  if (!signed.ok) {
    await updateJob({ status: 'failed', file_path: path, error_message: 'REPORT_SIGNED_URL_FAILED' });
    return jsonResponse({ error: 'REPORT_SIGNED_URL_FAILED', id: jobId }, 502, origin);
  }
  const signedBody = await signed.json();
  const rawUrl = signedBody.signedURL || signedBody.signedUrl;
  if (!rawUrl) {
    await updateJob({ status: 'failed', file_path: path, error_message: 'REPORT_SIGNED_URL_MISSING' });
    return jsonResponse({ error: 'REPORT_SIGNED_URL_MISSING', id: jobId }, 502, origin);
  }
  const fileUrl = rawUrl && String(rawUrl).startsWith('http') ? rawUrl : `${supabaseUrl}/storage/v1${rawUrl || ''}`;

  await updateJob({ status: 'completed', file_path: path, file_url: null, error_message: null });
  return jsonResponse({ id: jobId || null, status: 'completed', file_url: fileUrl, expires_in: 3600 }, 200, origin);
});
