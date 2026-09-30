import { corsHeaders, jsonResponse, originAllowed, requestId as securityRequestId } from '../_shared/security.ts';

type Row = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function serviceHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
}

async function rpc(url: string, headers: Record<string, string>, name: string, body: Row): Promise<unknown> {
  const response = await fetch(url + '/rest/v1/rpc/' + name, {
    method: 'POST', headers, body: JSON.stringify(body),
  });
  const responseText = await response.text();
  let value: unknown = null;
  if (responseText) { try { value = JSON.parse(responseText); } catch { value = responseText; } }
  if (!response.ok) throw new Error(name.toUpperCase() + '_' + response.status);
  return value;
}

async function restRows(url: string, headers: Record<string, string>, table: string, query: string): Promise<Row[]> {
  const response = await fetch(url + '/rest/v1/' + table + '?' + query, { headers });
  if (!response.ok) throw new Error('DATA_DELETION_READ_' + table + '_' + response.status);
  const value = await response.json();
  return Array.isArray(value) ? value : [];
}

async function deleteStoragePaths(url: string, headers: Record<string, string>, bucket: string, paths: string[]): Promise<number> {
  const unique = Array.from(new Set(paths.map((item) => String(item || '').trim()).filter((item) => item && !item.includes('://'))));
  if (!unique.length) return 0;
  const response = await fetch(url + '/storage/v1/object/' + encodeURIComponent(bucket), {
    method: 'DELETE', headers, body: JSON.stringify({ prefixes: unique }),
  });
  if (!response.ok && response.status !== 404) throw new Error('DATA_DELETION_STORAGE_' + response.status);
  return unique.length;
}

async function processStorageBatch(url: string, headers: Record<string, string>, claim: Row): Promise<Row> {
  const bucket = String(claim.resource_name || 'reports');
  const batchSize = Math.max(1, Math.min(1000, Number(claim.batch_size || 250)));
  const cursor = claim.cursor && typeof claim.cursor === 'object' ? claim.cursor as Row : {};
  const listed = await rpc(url, headers, 'r09_list_storage_batch', {
    p_job_id: claim.job_id, p_lease_token: claim.lease_token, p_step_key: claim.step_key,
    p_after: String(cursor.after || ''), p_batch_size: batchSize,
  }) as Row;
  const paths = Array.isArray(listed && listed.paths) ? (listed.paths as unknown[]).map(String) : [];
  const deleted = await deleteStoragePaths(url, headers, bucket, paths);
  return {
    deleted_count: deleted,
    completed: !listed || listed.remaining !== true,
    cursor: { after: String(listed && listed.next_cursor || '') },
  };
}

async function processClaim(url: string, headers: Record<string, string>, claim: Row): Promise<Row> {
  const operation = String(claim.operation || '');
  if (operation === 'preflight') {
    const query = 'owner_id=eq.' + encodeURIComponent(String(claim.requester_id || '')) + '&select=id&limit=1';
    const owned = await restRows(url, headers, 'workspaces', query);
    if (owned.length) {
      const error = new Error('ACCOUNT_DELETE_REQUIRES_WORKSPACE_TRANSFER') as Error & { retryable?: boolean };
      error.retryable = false;
      throw error;
    }
    return { deleted_count: 0, completed: true, cursor: {} };
  }
  if (operation === 'storage_prefix' || operation === 'storage_exports') return await processStorageBatch(url, headers, claim);
  if (operation === 'table') {
    const result = await rpc(url, headers, 'r09_delete_data_batch', {
      p_job_id: claim.job_id, p_lease_token: claim.lease_token,
      p_step_key: claim.step_key, p_batch_size: claim.batch_size,
    }) as Row;
    return {
      deleted_count: Math.max(0, Number(result && result.deleted_count || 0)),
      completed: !result || result.remaining !== true,
      skipped: Boolean(result && result.skipped === true),
      cursor: {},
    };
  }
  if (operation === 'auth_user') {
    const response = await fetch(url + '/auth/v1/admin/users/' + encodeURIComponent(String(claim.requester_id || '')), {
      method: 'DELETE', headers,
    });
    if (!response.ok && response.status !== 404) throw new Error('AUTH_USER_DELETE_' + response.status);
    return { deleted_count: response.status === 404 ? 0 : 1, completed: true, cursor: {} };
  }
  const error = new Error('DELETION_STEP_OPERATION_INVALID') as Error & { retryable?: boolean };
  error.retryable = false;
  throw error;
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (origin && !originAllowed(origin)) return jsonResponse({ error: 'ORIGIN_NOT_ALLOWED' }, 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);

  const url = String(Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const workerKey = Deno.env.get('DATA_DELETION_WORKER_KEY')
    || Deno.env.get('ACCEPTANCE_HMAC_SECRET')
    || serviceKey;
  if (!url || !serviceKey || !workerKey) return jsonResponse({ error: 'DATA_DELETION_WORKER_NOT_CONFIGURED' }, 503, origin);
  const authorization = request.headers.get('Authorization') || '';
  if (authorization !== 'Bearer ' + workerKey) return jsonResponse({ error: 'SERVICE_ROLE_REQUIRED' }, 401, origin);

  const headers = serviceHeaders(serviceKey);
  const workerId = String(Deno.env.get('RELEASE_SHA') || 'local') + ':' + crypto.randomUUID();
  const requestId = securityRequestId(request);
  let payload: Row = {};
  try { payload = await request.json(); } catch { payload = {}; }
  const maxBatches = Math.max(1, Math.min(50, Number(payload.max_batches || 12)));
  const summary: Row[] = [];
  const ttl = await rpc(url, headers, 'r09_expire_async_tasks', {}) as Row;

  for (let index = 0; index < maxBatches; index += 1) {
    const claim = await rpc(url, headers, 'r09_claim_data_deletion_job', {
      p_worker_id: workerId, p_lease_seconds: 90,
    }) as Row | null;
    if (!claim || !claim.job_id || !UUID.test(String(claim.job_id))) break;
    try {
      const result = await processClaim(url, headers, claim);
      const progress = await rpc(url, headers, 'r09_record_deletion_progress', {
        p_job_id: claim.job_id, p_lease_token: claim.lease_token, p_step_key: claim.step_key,
        p_deleted_count: Math.max(0, Number(result.deleted_count || 0)),
        p_cursor: result.cursor || {}, p_completed: result.completed === true, p_skipped: result.skipped === true,
      }) as Row;
      summary.push({ job_id: claim.job_id, step: claim.step_key, status: progress && progress.status || 'queued' });
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error).slice(0, 500);
      const retryable = (error as Error & { retryable?: boolean }).retryable !== false;
      const failure = await rpc(url, headers, 'r09_record_deletion_failure', {
        p_job_id: claim.job_id, p_lease_token: claim.lease_token, p_step_key: claim.step_key,
        p_error_code: message.split(':')[0].slice(0, 120), p_error_message: message,
        p_retryable: retryable, p_failed_object: String(claim.resource_name || claim.step_key || '').slice(0, 240),
      }) as Row;
      summary.push({ job_id: claim.job_id, step: claim.step_key, status: failure && failure.status || 'failed' });
    }
  }

  return jsonResponse({ request_id: requestId, worker_id: workerId, ttl, processed: summary.length, steps: summary }, 200, origin);
});
