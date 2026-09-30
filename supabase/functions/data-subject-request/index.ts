import {
  enforceRateLimit,
  jsonResponse,
  originAllowed,
  rateLimitResponse,
  requestId as securityRequestId,
  corsHeaders,
} from '../_shared/security.ts';

type Row = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXPORT_TABLES = [
  'profiles', 'query_history', 'watchlist_items', 'reports', 'feedback',
  'monitored_shops', 'monitoring_tasks', 'user_watchlist', 'user_activity', 'generated_reports',
  'user_preferences', 'report_materials', 'user_feedback', 'saved_workspace_items',
  'sales_leads', 'workspace_members', 'workspace_invites', 'ai_request_logs',
  'report_runs', 'report_exports',
];

function uuid(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return UUID.test(normalized) ? normalized : null;
}

function serviceHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
}

async function authenticatedUser(request: Request, url: string, anonKey: string): Promise<Row | null> {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const response = await fetch(url + '/auth/v1/user', { headers: { apikey: anonKey, Authorization: authorization } });
  return response.ok ? await response.json() : null;
}

async function rows(url: string, headers: Record<string, string>, table: string, query: string): Promise<Row[]> {
  const response = await fetch(url + '/rest/v1/' + table + '?' + query, { headers });
  if (!response.ok) throw new Error('DATA_EXPORT_READ_' + table + '_' + response.status);
  const value = await response.json();
  return Array.isArray(value) ? value : [];
}

async function rpc(url: string, headers: Record<string, string>, name: string, body: Row): Promise<Row | null> {
  const response = await fetch(url + '/rest/v1/rpc/' + name, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(name.toUpperCase() + '_' + response.status);
  const value = await response.json();
  return value && typeof value === 'object' ? value as Row : null;
}

async function markRequest(url: string, headers: Record<string, string>, id: string, values: Row): Promise<void> {
  await fetch(url + '/rest/v1/data_subject_requests?id=eq.' + encodeURIComponent(id), {
    method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(values),
  });
}

async function createRequest(url: string, headers: Record<string, string>, values: Row): Promise<Row> {
  const response = await fetch(url + '/rest/v1/data_subject_requests?on_conflict=requester_id,request_type,idempotency_key', {
    method: 'POST', headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify(values),
  });
  if (!response.ok) throw new Error('DATA_SUBJECT_REQUEST_CREATE_' + response.status);
  const inserted = await response.json();
  if (Array.isArray(inserted) && inserted[0]) return inserted[0];
  const query = 'requester_id=eq.' + encodeURIComponent(String(values.requester_id || ''))
    + '&request_type=eq.' + encodeURIComponent(String(values.request_type || ''))
    + '&idempotency_key=eq.' + encodeURIComponent(String(values.idempotency_key || '')) + '&limit=1';
  const existing = await rows(url, headers, 'data_subject_requests', query);
  return existing[0] || {};
}

async function exportUserData(url: string, headers: Record<string, string>, userId: string, workspaceId: string | null): Promise<Row> {
  const data: Row = {};
  for (const table of EXPORT_TABLES) {
    const column = table === 'workspace_invites' ? 'invited_by' : 'user_id';
    try { data[table] = await rows(url, headers, table, column + '=eq.' + encodeURIComponent(userId) + '&limit=5000'); }
    catch { data[table] = []; }
  }
  if (workspaceId && UUID.test(workspaceId)) {
    data.workspace = await rows(url, headers, 'workspaces', 'id=eq.' + encodeURIComponent(workspaceId) + '&limit=1').catch(() => []);
    data.workspace_members = await rows(url, headers, 'workspace_members', 'workspace_id=eq.' + encodeURIComponent(workspaceId) + '&limit=5000').catch(() => []);
    data.workspace_invites = await rows(url, headers, 'workspace_invites', 'workspace_id=eq.' + encodeURIComponent(workspaceId) + '&limit=5000').catch(() => []);
  }
  return { schema_version: '2026-09-30', exported_at: new Date().toISOString(), user_id: userId, workspace_id: workspaceId, data };
}

function triggerWorker(url: string, serviceKey: string): void {
  const task = fetch(url + '/functions/v1/data-deletion-worker', {
    method: 'POST', headers: serviceHeaders(serviceKey), body: JSON.stringify({ max_batches: 12 }),
  }).catch((error) => console.error('data deletion worker dispatch failed', error));
  const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void } }).EdgeRuntime;
  if (edgeRuntime && edgeRuntime.waitUntil) edgeRuntime.waitUntil(task);
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (!originAllowed(origin)) return jsonResponse({ error: 'ORIGIN_NOT_ALLOWED' }, 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (!['POST', 'GET'].includes(request.method)) return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);

  const url = String(Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !anonKey || !serviceKey) return jsonResponse({ error: 'DATA_SUBJECT_SERVICE_NOT_CONFIGURED' }, 503, origin);
  const user = await authenticatedUser(request, url, anonKey);
  if (!user || !user.id) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401, origin);
  const requestIdValue = securityRequestId(request);
  try {
    const rate = await enforceRateLimit({ supabaseUrl: url, serviceKey, request, scope: 'data_subject', userId: String(user.id) });
    if (!rate.allowed) return rateLimitResponse(rate, requestIdValue, origin);
  } catch (error) {
    console.error('data subject rate limiter unavailable', error);
    return jsonResponse({ error: 'RATE_LIMIT_UNAVAILABLE', request_id: requestIdValue }, 503, origin);
  }

  const headers = serviceHeaders(serviceKey);
  if (request.method === 'GET') {
    const queryParams = new URL(request.url).searchParams;
    const id = uuid(queryParams.get('request_id'));
    const filter = id
      ? 'id=eq.' + encodeURIComponent(id) + '&requester_id=eq.' + encodeURIComponent(String(user.id))
      : 'requester_id=eq.' + encodeURIComponent(String(user.id));
    const found = await rows(url, headers, 'data_subject_requests',
      filter + '&select=id,request_type,status,idempotency_key,requested_at,completed_at,error_code,error_message,result_object_path,metadata&order=requested_at.desc&limit=20');
    const requestIds = found.map((item) => uuid(item.id)).filter(Boolean) as string[];
    const jobs = requestIds.length
      ? await rows(url, headers, 'data_deletion_jobs', 'request_id=in.(' + requestIds.join(',') + ')&select=*&order=created_at.desc')
      : [];
    const jobIds = jobs.map((item) => uuid(item.id)).filter(Boolean) as string[];
    const steps = jobIds.length
      ? await rows(url, headers, 'data_deletion_job_steps', 'job_id=in.(' + jobIds.join(',') + ')&select=job_id,sequence_no,step_key,status,attempt_count,deleted_count,last_error_code,updated_at&order=sequence_no.asc')
      : [];
    return jsonResponse({ request_id: requestIdValue, requests: found, jobs, steps }, 200, origin);
  }

  let payload: Row = {};
  try { payload = await request.json(); } catch { return jsonResponse({ error: 'INVALID_JSON', request_id: requestIdValue }, 400, origin); }
  const requestType = String(payload.request_type || payload.action || '').toLowerCase();
  if (!['export', 'delete_account', 'delete_workspace'].includes(requestType)) return jsonResponse({ error: 'DATA_SUBJECT_REQUEST_TYPE_REQUIRED', request_id: requestIdValue }, 400, origin);
  const workspaceId = uuid(payload.workspace_id);
  const idempotencyKey = String(payload.idempotency_key || requestIdValue).trim().slice(0, 160);
  if (idempotencyKey.length < 8) return jsonResponse({ error: 'IDEMPOTENCY_KEY_REQUIRED', request_id: requestIdValue }, 400, origin);
  if (requestType === 'delete_workspace' && !workspaceId) return jsonResponse({ error: 'WORKSPACE_REQUIRED', request_id: requestIdValue }, 400, origin);
  if (workspaceId) {
    const membership = await rows(url, headers, 'workspace_members',
      'workspace_id=eq.' + encodeURIComponent(workspaceId) + '&user_id=eq.' + encodeURIComponent(String(user.id)) + '&status=eq.active&select=role&limit=1');
    if (!membership.length) return jsonResponse({ error: 'WORKSPACE_FORBIDDEN', request_id: requestIdValue }, 403, origin);
    if (requestType === 'delete_workspace' && !['owner', 'admin'].includes(String(membership[0].role))) return jsonResponse({ error: 'WORKSPACE_ADMIN_REQUIRED', request_id: requestIdValue }, 403, origin);
  }

  let entry: Row;
  try {
    entry = await createRequest(url, headers, {
      requester_id: user.id, workspace_id: workspaceId, request_type: requestType,
      idempotency_key: idempotencyKey, status: requestType === 'export' ? 'processing' : 'requested',
      metadata: { request_id: requestIdValue },
    });
  } catch {
    return jsonResponse({ error: 'DATA_SUBJECT_REQUEST_CREATE_FAILED', request_id: requestIdValue }, 502, origin);
  }
  const entryId = uuid(entry.id);
  if (!entryId) return jsonResponse({ error: 'DATA_SUBJECT_REQUEST_CREATE_FAILED', request_id: requestIdValue }, 502, origin);

  if (requestType !== 'export') {
    try {
      const job = await rpc(url, headers, 'r09_enqueue_data_deletion_job', {
        p_request_id: entryId, p_requester_id: user.id, p_workspace_id: workspaceId,
        p_job_type: requestType, p_idempotency_key: idempotencyKey,
      });
      const effectiveRequestId = uuid(job && job.request_id) || entryId;
      if (effectiveRequestId !== entryId) {
        await markRequest(url, headers, entryId, {
          status: 'cancelled', completed_at: new Date().toISOString(),
          error_code: 'DUPLICATE_DELETION_REQUEST',
          metadata: { request_id: requestIdValue, duplicate_of: effectiveRequestId, job_id: job && job.id || null },
        });
      }
      triggerWorker(url, serviceKey);
      return jsonResponse({
        request_id: requestIdValue,
        request: { ...entry, status: String(job && job.status || 'processing'), id: effectiveRequestId },
        job_id: job && job.id || null, status: job && job.status || 'processing',
        idempotency_key: idempotencyKey, duplicate: Boolean(job && job.duplicate === true),
      }, 202, origin);
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error).slice(0, 240);
      await markRequest(url, headers, entryId, { status: 'failed', completed_at: new Date().toISOString(), error_code: 'DELETION_JOB_ENQUEUE_FAILED', error_message: message });
      return jsonResponse({ error: 'DELETION_JOB_ENQUEUE_FAILED', request_id: requestIdValue }, 502, origin);
    }
  }

  try {
    const exportData = await exportUserData(url, headers, String(user.id), workspaceId);
    const recordCount = (Object.values(exportData.data as Row) as unknown[]).reduce((sum: number, value: unknown) => sum + (Array.isArray(value) ? value.length : 0), 0);
    await markRequest(url, headers, entryId, { status: 'completed', completed_at: new Date().toISOString(), metadata: { request_id: requestIdValue, record_count: recordCount } });
    return new Response(JSON.stringify({ request: { ...entry, status: 'completed', completed_at: new Date().toISOString() }, export: exportData }), {
      status: 200,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="jay-guanhai-data-export.json"', 'X-Request-Id': requestIdValue },
    });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).slice(0, 240);
    await markRequest(url, headers, entryId, { status: 'failed', completed_at: new Date().toISOString(), error_code: 'DATA_EXPORT_FAILED', error_message: message });
    return jsonResponse({ error: 'DATA_EXPORT_FAILED', request_id: requestIdValue }, 502, origin);
  }
});
