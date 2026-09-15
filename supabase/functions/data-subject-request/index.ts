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
const ACCOUNT_TABLES = [
  'profiles', 'query_history', 'watchlist_items', 'reports', 'feedback',
  'monitored_shops', 'user_watchlist', 'user_activity', 'generated_reports',
  'user_preferences', 'report_materials', 'user_feedback', 'saved_workspace_items',
  'sales_leads', 'workspace_members', 'workspace_invites', 'ai_request_logs',
  'report_runs', 'report_exports',
];

function uuid(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return UUID.test(normalized) ? normalized : null;
}

function serviceHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function authenticatedUser(request: Request, url: string, anonKey: string): Promise<Row | null> {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authorization } });
  return response.ok ? await response.json() : null;
}

async function rows(url: string, headers: Record<string, string>, table: string, query: string): Promise<Row[]> {
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, { headers });
  if (!response.ok) throw new Error(`DATA_EXPORT_READ_${table}_${response.status}`);
  const value = await response.json();
  return Array.isArray(value) ? value : [];
}

async function removeRows(url: string, headers: Record<string, string>, table: string, query: string): Promise<void> {
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, { method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' } });
  if (!response.ok && response.status !== 404) throw new Error(`DATA_DELETE_${table}_${response.status}`);
}

async function storageDelete(url: string, headers: Record<string, string>, userId: string): Promise<number> {
  const listResponse = await fetch(`${url}/storage/v1/object/list/reports`, {
    method: 'POST', headers, body: JSON.stringify({ prefix: `${userId}/`, limit: 1000, offset: 0 }),
  });
  if (!listResponse.ok) return 0;
  const listed = await listResponse.json();
  const paths = (Array.isArray(listed) ? listed : []).map((item: Row) => `${userId}/${String(item.name || '')}`).filter((path: string) => !path.endsWith('/'));
  if (!paths.length) return 0;
  const response = await fetch(`${url}/storage/v1/object/reports`, {
    method: 'DELETE', headers, body: JSON.stringify({ prefixes: paths }),
  });
  return response.ok ? paths.length : 0;
}

async function storageDeletePaths(url: string, headers: Record<string, string>, paths: string[]): Promise<number> {
  const unique = Array.from(new Set(paths.map((path) => String(path || '').trim()).filter((path) => path && !path.includes('://'))));
  if (!unique.length) return 0;
  const response = await fetch(`${url}/storage/v1/object/reports`, { method: 'DELETE', headers, body: JSON.stringify({ prefixes: unique }) });
  return response.ok ? unique.length : 0;
}

async function markRequest(url: string, headers: Record<string, string>, id: string, values: Row): Promise<void> {
  await fetch(`${url}/rest/v1/data_subject_requests?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(values),
  });
}

async function createRequest(url: string, headers: Record<string, string>, values: Row): Promise<Row> {
  const response = await fetch(`${url}/rest/v1/data_subject_requests?on_conflict=requester_id,request_type,idempotency_key`, {
    method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(values),
  });
  if (!response.ok) throw new Error(`DATA_SUBJECT_REQUEST_CREATE_${response.status}`);
  const value = await response.json();
  return value?.[0] || {};
}

async function exportUserData(url: string, headers: Record<string, string>, userId: string, workspaceId: string | null): Promise<Row> {
  const data: Row = {};
  for (const table of ACCOUNT_TABLES) {
    const column = table === 'workspace_invites' ? 'invited_by' : 'user_id';
    try {
      data[table] = await rows(url, headers, table, `${column}=eq.${encodeURIComponent(userId)}&limit=5000`);
    } catch {
      data[table] = [];
    }
  }
  if (workspaceId && UUID.test(workspaceId)) {
    data.workspace = await rows(url, headers, 'workspaces', `id=eq.${encodeURIComponent(workspaceId)}&limit=1`).catch(() => []);
    data.workspace_members = await rows(url, headers, 'workspace_members', `workspace_id=eq.${encodeURIComponent(workspaceId)}&limit=5000`).catch(() => []);
    data.workspace_invites = await rows(url, headers, 'workspace_invites', `workspace_id=eq.${encodeURIComponent(workspaceId)}&limit=5000`).catch(() => []);
  }
  return { schema_version: '2026-09-16', exported_at: new Date().toISOString(), user_id: userId, workspace_id: workspaceId, data };
}

async function deleteAccount(url: string, headers: Record<string, string>, userId: string): Promise<Row> {
  const owned = await rows(url, headers, 'workspaces', `owner_id=eq.${encodeURIComponent(userId)}&limit=100`).catch(() => []);
  if (owned.length) throw new Error('ACCOUNT_DELETE_REQUIRES_WORKSPACE_TRANSFER');
  let deletedTables = 0;
  for (const table of ACCOUNT_TABLES) {
    const ownerColumn = table === 'workspace_invites' ? 'invited_by' : 'user_id';
    await removeRows(url, headers, table, `${ownerColumn}=eq.${encodeURIComponent(userId)}`);
    deletedTables += 1;
  }
  const deletedObjects = await storageDelete(url, headers, userId);
  const authResponse = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE', headers });
  if (!authResponse.ok && authResponse.status !== 404) throw new Error(`AUTH_USER_DELETE_${authResponse.status}`);
  return { deleted_tables: deletedTables, deleted_storage_objects: deletedObjects };
}

async function deleteWorkspace(url: string, headers: Record<string, string>, workspaceId: string): Promise<Row> {
  const exports = await rows(url, headers, 'report_exports', `workspace_id=eq.${encodeURIComponent(workspaceId)}&select=file_path&limit=5000`).catch(() => []);
  const deletedObjects = await storageDeletePaths(url, headers, exports.map((row) => String(row.file_path || '')));
  const response = await fetch(`${url}/rest/v1/workspaces?id=eq.${encodeURIComponent(workspaceId)}`, { method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' } });
  if (!response.ok) throw new Error(`WORKSPACE_DELETE_${response.status}`);
  return { workspace_id: workspaceId, deleted: true, deleted_storage_objects: deletedObjects };
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
  if (!user?.id) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401, origin);
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
    const query = new URL(request.url).searchParams;
    const id = uuid(query.get('request_id'));
    const filter = id ? `id=eq.${encodeURIComponent(id)}` : `requester_id=eq.${encodeURIComponent(String(user.id))}`;
    const found = await rows(url, headers, 'data_subject_requests', `${filter}&select=id,request_type,status,requested_at,completed_at,error_code,result_object_path&order=requested_at.desc&limit=20`);
    return jsonResponse({ request_id: requestIdValue, requests: found }, 200, origin);
  }

  let payload: Row = {};
  try { payload = await request.json(); } catch { return jsonResponse({ error: 'INVALID_JSON', request_id: requestIdValue }, 400, origin); }
  const requestType = String(payload.request_type || payload.action || '').toLowerCase();
  if (!['export', 'delete_account', 'delete_workspace'].includes(requestType)) return jsonResponse({ error: 'DATA_SUBJECT_REQUEST_TYPE_REQUIRED', request_id: requestIdValue }, 400, origin);
  const workspaceId = uuid(payload.workspace_id);
  const idempotencyKey = String(payload.idempotency_key || requestIdValue).slice(0, 160);
  if (requestType === 'delete_workspace' && !workspaceId) return jsonResponse({ error: 'WORKSPACE_REQUIRED', request_id: requestIdValue }, 400, origin);
  if (workspaceId) {
    const membership = await rows(url, headers, 'workspace_members', `workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(String(user.id))}&status=eq.active&select=role&limit=1`);
    if (!membership.length) return jsonResponse({ error: 'WORKSPACE_FORBIDDEN', request_id: requestIdValue }, 403, origin);
    if (requestType === 'delete_workspace' && !['owner', 'admin'].includes(String(membership[0].role))) return jsonResponse({ error: 'WORKSPACE_ADMIN_REQUIRED', request_id: requestIdValue }, 403, origin);
  }

  let entry: Row;
  try {
    entry = await createRequest(url, headers, { requester_id: user.id, workspace_id: workspaceId, request_type: requestType, idempotency_key: idempotencyKey, status: 'processing', metadata: { request_id: requestIdValue } });
  } catch (error) {
    return jsonResponse({ error: 'DATA_SUBJECT_REQUEST_CREATE_FAILED', request_id: requestIdValue }, 502, origin);
  }
  const entryId = uuid(entry.id);
  if (!entryId) return jsonResponse({ error: 'DATA_SUBJECT_REQUEST_CREATE_FAILED', request_id: requestIdValue }, 502, origin);

  try {
    if (requestType === 'export') {
      const exportData = await exportUserData(url, headers, String(user.id), workspaceId);
      const recordCount = (Object.values(exportData.data as Row) as unknown[]).reduce((sum: number, value: unknown) => sum + (Array.isArray(value) ? value.length : 0), 0);
      await markRequest(url, headers, entryId, { status: 'completed', completed_at: new Date().toISOString(), metadata: { request_id: requestIdValue, record_count: recordCount } });
      return new Response(JSON.stringify({ request: { ...entry, status: 'completed', completed_at: new Date().toISOString() }, export: exportData }), { status: 200, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="jay-guanhai-data-export.json"', 'X-Request-Id': requestIdValue } });
    }
    const result = requestType === 'delete_account'
      ? await deleteAccount(url, headers, String(user.id))
      : await deleteWorkspace(url, headers, workspaceId as string);
    await markRequest(url, headers, entryId, { status: 'completed', completed_at: new Date().toISOString(), metadata: { request_id: requestIdValue, result } });
    return jsonResponse({ request: { ...entry, status: 'completed' }, result, request_id: requestIdValue }, 200, origin);
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).slice(0, 240);
    await markRequest(url, headers, entryId, { status: 'failed', completed_at: new Date().toISOString(), error_code: message.split('_').slice(0, 4).join('_'), error_message: message });
    return jsonResponse({ error: message, request_id: requestIdValue, request: { ...entry, status: 'failed' } }, 409, origin);
  }
});
