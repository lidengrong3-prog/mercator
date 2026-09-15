import {
  historySearchRpcPayload,
  normalizeHistorySearchPayload,
} from '../_shared/history-search-contract.mjs';
import {
  corsHeaders,
  enforceRateLimit,
  jsonResponse,
  originAllowed,
  rateLimitResponse,
  requestId,
} from '../_shared/security.ts';

async function fetchWithin(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (request) => {
  const startedAt = Date.now();
  const origin = request.headers.get('Origin');
  if (!originAllowed(origin)) return jsonResponse({ error: 'ORIGIN_NOT_ALLOWED' }, 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);

  const requestIdValue = requestId(request);
  const supabaseUrl = String(Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ error: 'SEARCH_SERVICE_NOT_CONFIGURED', request_id: requestIdValue }, 503, origin);
  }

  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    return jsonResponse({ error: 'AUTH_REQUIRED', request_id: requestIdValue }, 401, origin);
  }
  let identity: Response;
  try {
    identity = await fetchWithin(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: authorization },
    }, 10_000);
  } catch (error) {
    console.error('history search auth service unavailable', error);
    return jsonResponse({
      error: 'AUTH_SERVICE_UNAVAILABLE', request_id: requestIdValue, retryable: true,
      suggestion: '登录校验暂时不可用，请稍后重试',
    }, 503, origin, { 'X-Request-Id': requestIdValue });
  }
  if (!identity.ok) return jsonResponse({ error: 'AUTH_REQUIRED', request_id: requestIdValue }, 401, origin);
  const user = await identity.json();

  try {
    const limit = await enforceRateLimit({
      supabaseUrl,
      serviceKey,
      request,
      scope: 'search',
      userId: String(user.id || ''),
    });
    if (!limit.allowed) return rateLimitResponse(limit, requestIdValue, origin);
  } catch (error) {
    console.error('history search rate limiter unavailable', error);
    return jsonResponse({ error: 'RATE_LIMIT_UNAVAILABLE', request_id: requestIdValue }, 503, origin);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'INVALID_JSON', request_id: requestIdValue }, 400, origin);
  }

  let normalized;
  try {
    normalized = normalizeHistorySearchPayload(payload);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INVALID_SEARCH_REQUEST';
    return jsonResponse({ error: code, request_id: requestIdValue }, 400, origin);
  }

  let response: Response;
  try {
    response = await fetchWithin(`${supabaseUrl}/rest/v1/rpc/search_formal_publications`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(historySearchRpcPayload(normalized)),
    }, 20_000);
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'AbortError';
    console.error('history search RPC unavailable', error);
    return jsonResponse({
      error: timedOut ? 'SEARCH_BACKEND_TIMEOUT' : 'SEARCH_BACKEND_UNAVAILABLE',
      request_id: requestIdValue,
      retryable: true,
      suggestion: timedOut ? '历史搜索超时，请缩小筛选范围后重试' : '历史搜索暂时不可用，请稍后重试',
    }, timedOut ? 504 : 503, origin, { 'X-Request-Id': requestIdValue });
  }
  if (!response.ok) {
    const diagnostic = (await response.text().catch(() => '')).slice(0, 400);
    console.error('history search RPC failed', response.status, diagnostic);
    return jsonResponse({
      error: 'SEARCH_BACKEND_UNAVAILABLE',
      request_id: requestIdValue,
      retryable: response.status >= 500,
      suggestion: '历史搜索暂时不可用，请稍后重试',
    }, 503, origin);
  }

  let result: Record<string, unknown>;
  try {
    result = await response.json();
  } catch {
    return jsonResponse({ error: 'SEARCH_BACKEND_INVALID_RESPONSE', request_id: requestIdValue }, 502, origin);
  }
  if (!result || typeof result !== 'object' || !Array.isArray(result.items)) {
    return jsonResponse({ error: 'SEARCH_BACKEND_INVALID_RESPONSE', request_id: requestIdValue }, 502, origin);
  }

  return jsonResponse({
    ...result,
    request_id: requestIdValue,
    elapsed_ms: Date.now() - startedAt,
  }, 200, origin, { 'X-Request-Id': requestIdValue });
});
