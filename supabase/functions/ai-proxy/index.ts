import { verifyProductionAcceptanceFault } from '../_shared/production-acceptance.mjs';

const defaultOrigins = [
  'https://lidengrong3-prog.github.io',
  'http://localhost:8000', 'http://127.0.0.1:8000',
  'http://localhost:4173', 'http://127.0.0.1:4173',
  'http://localhost:4174', 'http://127.0.0.1:4174',
];

function allowedOrigins(): string[] {
  const configured = Deno.env.get('ALLOWED_ORIGINS');
  return configured ? configured.split(',').map((value) => value.trim()).filter(Boolean) : defaultOrigins;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && allowedOrigins().includes(origin) ? origin : allowedOrigins()[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-request-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Expose-Headers': 'Retry-After, X-JAY-Release',
    Vary: 'Origin',
  };
}

function jsonResponse(body: Record<string, unknown>, status: number, origin: string | null, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8', 'X-JAY-Release': Deno.env.get('RELEASE_SHA') || 'unversioned', ...extra },
  });
}

function uuid(value: unknown): string | null {
  const candidate = typeof value === 'string' ? value : '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate) ? candidate : null;
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  const inputPerMillion = Math.max(0, Number(Deno.env.get('AI_INPUT_COST_PER_MILLION_USD') || 0));
  const outputPerMillion = Math.max(0, Number(Deno.env.get('AI_OUTPUT_COST_PER_MILLION_USD') || 0));
  return Number(((inputTokens * inputPerMillion + outputTokens * outputPerMillion) / 1_000_000).toFixed(8));
}

Deno.serve(async (request) => {
  const startedAt = Date.now();
  const origin = request.headers.get('Origin');
  if (origin && !allowedOrigins().includes(origin)) return jsonResponse({ error: 'ORIGIN_NOT_ALLOWED' }, 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);

  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401, origin);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return jsonResponse({ error: 'AI_SERVICE_NOT_CONFIGURED' }, 503, origin);

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authorization } });
  if (!userResponse.ok) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401, origin);
  const user = await userResponse.json();
  const serviceHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

  const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
  if (!apiKey) return jsonResponse({ error: 'AI_SERVICE_NOT_CONFIGURED' }, 503, origin);

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return jsonResponse({ error: 'INVALID_JSON' }, 400, origin); }
  const requestIdCandidate = String(payload.request_id || request.headers.get('X-Request-Id') || crypto.randomUUID()).slice(0, 240);
  const requestId = /^[A-Za-z0-9._:-]{8,240}$/.test(requestIdCandidate) ? requestIdCandidate : crypto.randomUUID();
  const operation = String(payload.operation || 'analysis').slice(0, 120);
  const model = Deno.env.get('DEEPSEEK_MODEL') || 'deepseek-chat';
  const dataVersion = payload.data_version ? String(payload.data_version).slice(0, 240) : null;

  const messages = payload.messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 20) return jsonResponse({ error: 'INVALID_MESSAGES' }, 400, origin);
  let totalLength = 0;
  for (const message of messages) {
    if (!message || typeof message !== 'object') return jsonResponse({ error: 'INVALID_MESSAGES' }, 400, origin);
    const role = (message as Record<string, unknown>).role;
    const content = (message as Record<string, unknown>).content;
    if (!['system', 'user', 'assistant'].includes(String(role)) || typeof content !== 'string') return jsonResponse({ error: 'INVALID_MESSAGES' }, 400, origin);
    totalLength += content.length;
  }
  if (totalLength > 30_000) return jsonResponse({ error: 'PROMPT_TOO_LARGE' }, 413, origin);

  const acceptance = await verifyProductionAcceptanceFault(request.headers, {
    serviceKey: Deno.env.get('ACCEPTANCE_HMAC_SECRET') || serviceKey,
    userId: String(user.id || ''),
    requestId,
  });
  if (acceptance.error) return jsonResponse({ error: acceptance.error }, 403, origin);
  const acceptanceScenario = acceptance.scenario;

  const temperature = Math.max(0, Math.min(1.5, Number(payload.temperature ?? 0.5)));
  const maxTokens = Math.max(128, Math.min(3_000, Number(payload.max_tokens ?? 1_500)));

  const ownedId = async (table: 'report_runs' | 'generated_reports', value: unknown): Promise<string | null> => {
    const id = uuid(value);
    if (!id) return null;
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`, { headers: serviceHeaders });
    const rows = response.ok ? await response.json() : [];
    return rows?.[0]?.id || null;
  };
  const [reportRunId, reportId] = await Promise.all([ownedId('report_runs', payload.report_run_id), ownedId('generated_reports', payload.report_id)]);

  const logRequest = async (values: Record<string, unknown>) => {
    await fetch(`${supabaseUrl}/rest/v1/ai_request_logs`, {
      method: 'POST',
      headers: { ...serviceHeaders, Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({
        user_id: user.id, report_run_id: reportRunId, report_id: reportId, request_id: requestId,
        operation, provider: 'deepseek', model, data_version: dataVersion,
        search_enabled: Boolean(payload.web_search || payload.plugins),
        duration_ms: Date.now() - startedAt, metadata: {
          client_report_id: String(payload.client_report_id || '').slice(0, 180),
          acceptance_scenario: acceptanceScenario,
        },
        ...values,
      }),
    });
  };

  const effectivePlanResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/effective_billing_plan`, {
    method: 'POST', headers: serviceHeaders, body: JSON.stringify({ p_user_id: user.id }),
  });
  if (!effectivePlanResponse.ok) return jsonResponse({ error: 'BILLING_ENTITLEMENTS_UNAVAILABLE' }, 503, origin);
  const effectivePlan = String(await effectivePlanResponse.json() || 'free');
  const entitlementResponse = await fetch(`${supabaseUrl}/rest/v1/billing_plan_entitlements?plan=eq.${encodeURIComponent(effectivePlan)}&active=eq.true&select=monthly_ai_token_limit,ai_requests_per_minute&limit=1`, { headers: serviceHeaders });
  if (!entitlementResponse.ok) return jsonResponse({ error: 'BILLING_ENTITLEMENTS_UNAVAILABLE' }, 503, origin);
  const entitlementRows = await entitlementResponse.json();
  const entitlement = entitlementRows?.[0];
  if (!entitlement) return jsonResponse({ error: 'BILLING_ENTITLEMENTS_UNAVAILABLE' }, 503, origin);

  const configuredMinuteCap = Math.max(0, Number(Deno.env.get('AI_REQUESTS_PER_MINUTE') || 0));
  const planMinuteLimit = Math.max(1, Number(entitlement.ai_requests_per_minute || 1));
  const perMinuteLimit = configuredMinuteCap > 0 ? Math.min(planMinuteLimit, configuredMinuteCap) : planMinuteLimit;
  const configuredMonthlyCap = Math.max(0, Number(Deno.env.get('AI_MONTHLY_TOKEN_LIMIT') || 0));

  const minuteStart = new Date(Date.now() - 60_000).toISOString();
  const rateResponse = await fetch(`${supabaseUrl}/rest/v1/ai_request_logs?user_id=eq.${encodeURIComponent(user.id)}&created_at=gte.${encodeURIComponent(minuteStart)}&select=id`, {
    method: 'HEAD', headers: { ...serviceHeaders, Prefer: 'count=exact' },
  });
  if (!rateResponse.ok) return jsonResponse({ error: 'AI_RATE_LIMIT_CHECK_FAILED' }, 503, origin);
  const recentCount = Number((rateResponse.headers.get('content-range') || '0/0').split('/')[1] || 0);
  if (acceptanceScenario === 'rate_limit' || recentCount >= perMinuteLimit) {
    await logRequest({ status: 'failed', input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0, http_status: 429, error_code: 'AI_RATE_LIMITED' });
    return jsonResponse({ error: 'AI_RATE_LIMITED', plan: effectivePlan, limit: perMinuteLimit, retry_after: 60 }, 429, origin, { 'Retry-After': '60' });
  }

  const estimatedInputTokens = Math.max(1, totalLength);
  const requestedTokens = estimatedInputTokens + maxTokens;
  const reservationResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/reserve_ai_token_quota`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({
      p_user_id: user.id,
      p_request_id: requestId,
      p_requested_tokens: requestedTokens,
      p_limit_override: acceptanceScenario === 'quota' ? 1 : (configuredMonthlyCap > 0 ? configuredMonthlyCap : null),
    }),
  });
  if (!reservationResponse.ok) return jsonResponse({ error: 'BILLING_USAGE_UNAVAILABLE' }, 503, origin);
  const reservation = await reservationResponse.json();
  if (reservation?.allowed !== true) {
    const reservationError = String(reservation?.error || 'AI_QUOTA_EXCEEDED');
    if (reservationError === 'AI_REQUEST_IN_PROGRESS' || reservationError === 'AI_REQUEST_ALREADY_COMPLETED') {
      return jsonResponse({ error: reservationError }, 409, origin);
    }
    await logRequest({ status: 'failed', input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0, http_status: 402, error_code: 'AI_QUOTA_EXCEEDED' });
    return jsonResponse({
      error: 'AI_QUOTA_EXCEEDED', plan: effectivePlan,
      used_tokens: Number(reservation?.used_tokens || 0),
      reserved_tokens: Number(reservation?.reserved_tokens || 0),
      limit: Number(reservation?.limit || 0),
      remaining_tokens: Number(reservation?.remaining_tokens || 0),
      reset_at: String(reservation?.reset_at || ''),
    }, 402, origin);
  }

  const finalizeReservation = async (status: 'completed' | 'released', actualTokens = 0) => {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/finalize_ai_token_reservation`, {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify({
        p_user_id: user.id,
        p_request_id: requestId,
        p_status: status,
        p_actual_tokens: Math.max(0, Math.floor(actualTokens)),
      }),
    });
    return response.ok;
  };
  const upstreamBody: Record<string, unknown> = { model, messages, temperature, max_tokens: maxTokens, stream: false };
  if (payload.web_search) upstreamBody.web_search = { type: 'enabled' };
  if (payload.plugins) upstreamBody.plugins = ['web_search'];

  const baseUrl = (Deno.env.get('DEEPSEEK_API_URL') || 'https://api.deepseek.com').replace(/\/$/, '');
  const controller = new AbortController();
  const providerTimeout = acceptanceScenario === 'provider_timeout'
    ? 1
    : Math.max(5_000, Math.min(55_000, Number(Deno.env.get('AI_PROVIDER_TIMEOUT_MS') || 50_000)));
  const timer = setTimeout(() => controller.abort(), providerTimeout);
  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(upstreamBody), signal: controller.signal,
    });
  } catch (error) {
    const aborted = controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError');
    const code = aborted ? 'AI_PROVIDER_TIMEOUT' : 'AI_PROVIDER_UNREACHABLE';
    const status = code === 'AI_PROVIDER_TIMEOUT' ? 504 : 502;
    await logRequest({ status: 'failed', input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0, http_status: status, error_code: code });
    await finalizeReservation('released');
    return jsonResponse({ error: code }, status, origin);
  } finally { clearTimeout(timer); }

  if (!upstream.ok) {
    const code = upstream.status === 429 ? 'AI_RATE_LIMITED' : ([402, 403].includes(upstream.status) ? 'AI_QUOTA_EXCEEDED' : 'AI_PROVIDER_ERROR');
    const status = code === 'AI_RATE_LIMITED' ? 429 : (code === 'AI_QUOTA_EXCEEDED' ? 402 : (upstream.status >= 500 ? 502 : 400));
    await logRequest({ status: 'failed', input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0, http_status: upstream.status, error_code: code });
    await finalizeReservation('released');
    return jsonResponse({ error: code, provider_status: upstream.status }, status, origin, upstream.status === 429 ? { 'Retry-After': upstream.headers.get('retry-after') || '60' } : {});
  }

  let result: Record<string, unknown>;
  try {
    result = await upstream.json();
  } catch {
    await logRequest({ status: 'failed', input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0, http_status: 502, error_code: 'AI_PROVIDER_INVALID_RESPONSE' });
    await finalizeReservation('released');
    return jsonResponse({ error: 'AI_PROVIDER_INVALID_RESPONSE' }, 502, origin);
  }
  const usage = result && typeof result.usage === 'object' ? result.usage as Record<string, unknown> : {};
  const inputTokens = Math.max(0, Number(usage.prompt_tokens || usage.input_tokens || 0));
  const outputTokens = Math.max(0, Number(usage.completion_tokens || usage.output_tokens || 0));
  const totalTokens = Math.max(1, inputTokens + outputTokens, Number(usage.total_tokens || 0), estimatedInputTokens);
  if (!await finalizeReservation('completed', totalTokens)) {
    await logRequest({ status: 'failed', input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: totalTokens, estimated_cost_usd: estimateCost(inputTokens, outputTokens), http_status: 503, error_code: 'AI_USAGE_FINALIZATION_FAILED' });
    return jsonResponse({ error: 'AI_USAGE_FINALIZATION_FAILED' }, 503, origin);
  }
  await logRequest({ status: 'completed', input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: totalTokens, estimated_cost_usd: estimateCost(inputTokens, outputTokens), http_status: 200, error_code: null });
  if (result && typeof result === 'object') {
    const quotaLimit = Math.max(0, Number(reservation?.limit || 0));
    const usedAfter = Math.max(0, Number(reservation?.used_tokens || 0)) + totalTokens;
    const otherReserved = Math.max(0, Number(reservation?.reserved_tokens || 0) - requestedTokens);
    result.jay_quota = {
      plan: effectivePlan,
      used_tokens: usedAfter,
      reserved_tokens: otherReserved,
      limit: quotaLimit,
      remaining_tokens: Math.max(0, quotaLimit - usedAfter - otherReserved),
      reset_at: String(reservation?.reset_at || ''),
    };
  }
  return jsonResponse(result, 200, origin);
});
