import { fetchCurrentQualityGate, reportContentAllowsFormalOutput } from '../_shared/report-quality.ts';
import { REPORT_VALIDATION_VERSION, validateFormalReportWithServerData } from '../_shared/report-validation.ts';
import { buildReportDocx } from '../_shared/report-docx.ts';
import { enforceRateLimit, rateLimitResponse, requestId as securityRequestId } from '../_shared/security.ts';

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
async function authenticatedUser(request: Request, url: string, key: string): Promise<{ id: string } | null> { const authorization = request.headers.get('Authorization') || ''; if (!authorization.startsWith('Bearer ')) return null; const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: authorization } }); return response.ok ? await response.json() : null; }

Deno.serve(async (request) => {
  const startedAt = Date.now();
  const origin = request.headers.get('Origin'); if (origin && !allowedOrigins().includes(origin)) return jsonResponse({ error: 'ORIGIN_NOT_ALLOWED' }, 403, origin); if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) }); if (request.method === 'GET' && new URL(request.url).searchParams.has('validation_probe')) return jsonResponse({ status: 'ok', report_validation_version: REPORT_VALIDATION_VERSION }, 200, origin); if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);
  const supabaseUrl = Deno.env.get('SUPABASE_URL'); const anonKey = Deno.env.get('SUPABASE_ANON_KEY'); const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if (!supabaseUrl || !anonKey || !serviceKey) return jsonResponse({ error: 'REPORT_SERVICE_NOT_CONFIGURED' }, 503, origin);
  const user = await authenticatedUser(request, supabaseUrl, anonKey); if (!user) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401, origin);
  const securityRequest = securityRequestId(request);
  try {
    const rate = await enforceRateLimit({ supabaseUrl: supabaseUrl as string, serviceKey: serviceKey as string, request, scope: 'export', userId: user.id });
    if (!rate.allowed) return rateLimitResponse(rate, securityRequest, origin);
  } catch (error) {
    console.error('report docx rate limiter unavailable', error);
    return jsonResponse({ error: 'RATE_LIMIT_UNAVAILABLE', request_id: securityRequest }, 503, origin);
  }
  let payload: Record<string, unknown>; try { payload = await request.json(); } catch { return jsonResponse({ error: 'INVALID_JSON' }, 400, origin); }
  const reportId = typeof payload.report_id === 'string' && /^[0-9a-f-]{36}$/i.test(payload.report_id) ? payload.report_id : null;
  const jobsUrl = `${supabaseUrl}/rest/v1/report_exports`;
  const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' };
  const parentExportId = typeof payload.parent_export_id === 'string' && /^[0-9a-f-]{36}$/i.test(payload.parent_export_id) ? payload.parent_export_id : null;
  const acceptanceRunId = typeof payload.acceptance_run_id === 'string' ? payload.acceptance_run_id.trim().slice(0, 160) : null;
  const attempt = Math.max(1, Math.min(100, Number(payload.attempt || 1)) || 1);
  const requestId = String(payload.request_id || request.headers.get('X-Request-Id') || crypto.randomUUID()).slice(0, 240);
  const idempotencyKey = String(payload.idempotency_key || `report-export:${reportId}:docx:current`).slice(0, 240);
  if (!reportId) return jsonResponse({ error: 'REPORT_ID_REQUIRED' }, 400, origin);
  const reportResponse = await fetch(`${supabaseUrl}/rest/v1/generated_reports?id=eq.${encodeURIComponent(reportId)}&select=id,workspace_id,title,content,save_status,publication_status,server_validation_version,server_validated_at,server_validation&limit=1`, { headers });
  const reportRows = reportResponse.ok ? await reportResponse.json() : [];
  const report = reportRows?.[0] as { workspace_id?: unknown; title?: unknown; content?: unknown; save_status?: unknown; publication_status?: unknown; server_validation_version?: unknown; server_validated_at?: unknown; server_validation?: unknown } | undefined;
  if (!report) return jsonResponse({ error: 'REPORT_NOT_FOUND' }, 404, origin);
  const workspaceId = String(report.workspace_id || '');
  const membershipResponse = await fetch(`${supabaseUrl}/rest/v1/workspace_members?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&select=role&limit=1`, { headers });
  const memberships = membershipResponse.ok ? await membershipResponse.json() : [];
  if (!workspaceId || !memberships?.length) return jsonResponse({ error: 'REPORT_NOT_FOUND' }, 404, origin);
  if (!['owner', 'admin', 'editor'].includes(String(memberships[0]?.role || ''))) return jsonResponse({ error: 'WORKSPACE_READ_ONLY' }, 403, origin);
  if (report.save_status !== 'saved') return jsonResponse({ error: 'REPORT_NOT_SAVED' }, 409, origin);
  const storedContent = report.content && typeof report.content === 'object' ? report.content as Record<string, unknown> : {};
  if (!reportContentAllowsFormalOutput(storedContent)) return jsonResponse({ error: 'REPORT_QUALITY_GATE_BLOCKED' }, 409, origin);
  const storedServerValidation = report.server_validation && typeof report.server_validation === 'object' ? report.server_validation as Record<string, unknown> : null;
  const contentServerValidation = storedContent.server_validation && typeof storedContent.server_validation === 'object' ? storedContent.server_validation as Record<string, unknown> : null;
  if (report.publication_status !== 'formal' || report.server_validation_version !== REPORT_VALIDATION_VERSION || !report.server_validated_at || storedServerValidation?.ok !== true || contentServerValidation?.ok !== true || storedServerValidation.version !== contentServerValidation.version) return jsonResponse({ error: 'REPORT_SERVER_VALIDATION_REQUIRED' }, 409, origin);
  const currentQuality = await fetchCurrentQualityGate(supabaseUrl, headers);
  if (!currentQuality.snapshot) return jsonResponse({ error: 'REPORT_QUALITY_STATUS_UNAVAILABLE', reasons: currentQuality.reasons }, 503, origin);
  if (!currentQuality.ok) return jsonResponse({ error: 'REPORT_QUALITY_GATE_BLOCKED', reasons: currentQuality.reasons }, 409, origin);
  const validation = await validateFormalReportWithServerData(supabaseUrl, headers, workspaceId, storedContent, currentQuality, { requireCurrentQualityVersion: true });
  if (!validation.ok) return jsonResponse({ error: validation.unavailable ? 'REPORT_VALIDATION_UNAVAILABLE' : 'REPORT_SERVER_VALIDATION_FAILED', validation }, validation.unavailable ? 503 : 409, origin);
  const title = String(report.title || 'JAY观海市场决策报告').trim().slice(0, 160);
  const text = String(storedContent.text || '').trim();
  if (!text) return jsonResponse({ error: 'REPORT_CONTENT_REQUIRED' }, 400, origin);
  if (text.length > 80000) return jsonResponse({ error: 'REPORT_TOO_LARGE' }, 413, origin);
  const readExistingJob = async () => {
    const response = await fetch(`${jobsUrl}?workspace_id=eq.${encodeURIComponent(workspaceId)}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id,status,file_path,error_message,created_at&limit=1`, { headers });
    const rows = response.ok ? await response.json() : [];
    return rows?.[0] || null;
  };
  const duplicateJobResponse = async (existing: Record<string, unknown>): Promise<Response> => {
    if (existing.status === 'completed' && existing.file_path) {
      const existingPath = String(existing.file_path).split('/').map(encodeURIComponent).join('/');
      const signedExisting = await fetch(`${supabaseUrl}/storage/v1/object/sign/reports/${existingPath}`, { method: 'POST', headers, body: JSON.stringify({ expiresIn: 3600 }) });
      if (signedExisting.ok) {
        const signedBody = await signedExisting.json();
        const rawUrl = signedBody.signedURL || signedBody.signedUrl;
        const fileUrl = String(rawUrl || '').startsWith('http') ? rawUrl : `${supabaseUrl}/storage/v1${rawUrl || ''}`;
        return jsonResponse({ id: existing.id, status: 'completed', duplicate: true, file_url: fileUrl, expires_in: 3600 }, 200, origin);
      }
    }
    const responseStatus = existing.status === 'failed' ? 409 : 202;
    return jsonResponse({ id: existing.id, status: existing.status, duplicate: true, error: existing.error_message || null }, responseStatus, origin);
  };

  const existing = await readExistingJob();
  if (existing) return await duplicateJobResponse(existing);

  // Legacy compatibility note: the previous contract used on_conflict user_id,idempotency_key.
  const conflictQuery = new URLSearchParams({ on_conflict: 'workspace_id,idempotency_key' });
  const created = await fetch(`${jobsUrl}?${conflictQuery.toString()}`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ user_id: user.id, workspace_id: workspaceId, report_id: reportId, format: 'docx', status: 'queued', parent_export_id: parentExportId, attempt, request_id: requestId, idempotency_key: idempotencyKey, acceptance_run_id: acceptanceRunId, metadata: { function: 'report-docx', content_source: 'persisted_report', data_snapshot_at: storedContent.data_snapshot_at || null, quality_report_version: currentQuality.snapshot.quality_report_version || null, source_record_ids: storedContent.source_record_ids || [], acceptance_run_id: acceptanceRunId } }),
  });
  if (!created.ok) {
    const failure = await created.text();
    if (failure.includes('EXPORT_FEATURE_NOT_AVAILABLE')) return jsonResponse({ error: 'EXPORT_FEATURE_NOT_AVAILABLE' }, 403, origin);
    if (failure.includes('EXPORT_QUOTA_EXCEEDED')) return jsonResponse({ error: 'EXPORT_QUOTA_EXCEEDED' }, 429, origin);
    if (created.status === 409) return jsonResponse({ error: 'REPORT_EXPORT_IN_PROGRESS' }, 409, origin);
    return jsonResponse({ error: 'REPORT_EXPORT_RECORD_FAILED' }, 502, origin);
  }
  const rows = await created.json();
  const jobId = rows?.[0]?.id;
  if (!jobId) {
    const racedJob = await readExistingJob();
    if (racedJob) return await duplicateJobResponse(racedJob);
    return jsonResponse({ error: 'REPORT_EXPORT_RECORD_FAILED' }, 502, origin);
  }
  const update = async (values: Record<string, unknown>) => { if (jobId) await fetch(`${jobsUrl}?id=eq.${encodeURIComponent(jobId)}`, { method: 'PATCH', headers, body: JSON.stringify(values) }); }; await update({ status: 'processing', started_at: new Date().toISOString() });
  const path = acceptanceRunId ? `${user.id}/acceptance/${encodeURIComponent(acceptanceRunId)}/${crypto.randomUUID()}.docx` : `${user.id}/${crypto.randomUUID()}.docx`; const encoded = path.split('/').map(encodeURIComponent).join('/'); const upload = await fetch(`${supabaseUrl}/storage/v1/object/reports/${encoded}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'x-upsert': 'false' }, body: buildReportDocx(title, text, storedContent) as unknown as BodyInit }); if (!upload.ok) { await update({ status: 'failed', error_message: 'REPORT_STORAGE_UPLOAD_FAILED', duration_ms: Date.now() - startedAt, completed_at: new Date().toISOString() }); return jsonResponse({ error: 'REPORT_STORAGE_UPLOAD_FAILED', id: jobId }, 502, origin); }
  const signed = await fetch(`${supabaseUrl}/storage/v1/object/sign/reports/${encoded}`, { method: 'POST', headers, body: JSON.stringify({ expiresIn: 3600 }) }); if (!signed.ok) { await update({ status: 'failed', file_path: path, error_message: 'REPORT_SIGNED_URL_FAILED', duration_ms: Date.now() - startedAt, completed_at: new Date().toISOString() }); return jsonResponse({ error: 'REPORT_SIGNED_URL_FAILED', id: jobId }, 502, origin); } const signedBody = await signed.json(); const rawUrl = signedBody.signedURL || signedBody.signedUrl; if (!rawUrl) { await update({ status: 'failed', file_path: path, error_message: 'REPORT_SIGNED_URL_MISSING', duration_ms: Date.now() - startedAt, completed_at: new Date().toISOString() }); return jsonResponse({ error: 'REPORT_SIGNED_URL_MISSING', id: jobId }, 502, origin); }
  const fileUrl = String(rawUrl).startsWith('http') ? rawUrl : `${supabaseUrl}/storage/v1${rawUrl}`; await update({ status: 'completed', file_path: path, error_message: null, duration_ms: Date.now() - startedAt, completed_at: new Date().toISOString() }); return jsonResponse({ id: jobId || null, status: 'completed', file_url: fileUrl, expires_in: 3600 }, 200, origin);
});
