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
    Vary: 'Origin',
  };
}

function jsonResponse(body: Record<string, unknown>, status: number, origin: string | null, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8', ...extra },
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
  const requestId = String(payload.request_id || request.headers.get('X-Request-Id') || crypto.randomUUID()).slice(0, 240);
  const operation = String(payload.operation || 'analysis').slice(0, 120);
  const model = Deno.env.get('DEEPSEEK_MODEL') || 'deepseek-chat';
  const dataVersion = payload.data_version ? String(payload.data_version).slice(0, 240) : null;

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
        duration_ms: Date.now() - startedAt, metadata: { client_report_id: String(payload.client_report_id || '').slice(0, 180) },
        ...values,
      }),
    });
  };

  const minuteStart = new Date(Date.now() - 60_000).toISOString();
  const rateResponse = await fetch(`${supabaseUrl}/rest/v1/ai_request_logs?user_id=eq.${encodeURIComponent(user.id)}&created_at=gte.${encodeURIComponent(minuteStart)}&select=id`, {
    method: 'HEAD', headers: { ...serviceHeaders, Prefer: 'count=exact' },
  });
  const recentCount = Number((rateResponse.headers.get('content-range') || '0/0').split('/')[1] || 0);
  const perMinuteLimit = Math.max(1, Number(Deno.env.get('AI_REQUESTS_PER_MINUTE') || 20));
  if (recentCount >= perMinuteLimit) {
    await logRequest({ status: 'failed', input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0, http_status: 429, error_code: 'AI_RATE_LIMITED' });
    return jsonResponse({ error: 'AI_RATE_LIMITED' }, 429, origin, { 'Retry-After': '60' });
  }

  const monthlyLimit = Math.max(0, Number(Deno.env.get('AI_MONTHLY_TOKEN_LIMIT') || 0));
  if (monthlyLimit > 0) {
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const usageResponse = await fetch(`${supabaseUrl}/rest/v1/ai_request_logs?user_id=eq.${encodeURIComponent(user.id)}&created_at=gte.${encodeURIComponent(monthStart.toISOString())}&select=total_tokens&limit=10000`, { headers: serviceHeaders });
    const usageRows = usageResponse.ok ? await usageResponse.json() : [];
    const usedTokens = usageRows.reduce((sum: number, row: { total_tokens?: number }) => sum + Number(row.total_tokens || 0), 0);
    if (usedTokens >= monthlyLimit) {
      await logRequest({ status: 'failed', input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0, http_status: 402, error_code: 'AI_QUOTA_EXCEEDED' });
      return jsonResponse({ error: 'AI_QUOTA_EXCEEDED' }, 402, origin);
    }
  }

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

  const temperature = Math.max(0, Math.min(1.5, Number(payload.temperature ?? 0.5)));
  const maxTokens = Math.max(128, Math.min(3_000, Number(payload.max_tokens ?? 1_500)));
  const upstreamBody: Record<string, unknown> = { model, messages, temperature, max_tokens: maxTokens, stream: false };
  if (payload.web_search) upstreamBody.web_search = { type: 'enabled' };
  if (payload.plugins) upstreamBody.plugins = ['web_search'];

  const baseUrl = (Deno.env.get('DEEPSEEK_API_URL') || 'https://api.deepseek.com').replace(/\/$/, '');
  const controller = new AbortController();
  const providerTimeout = Math.max(5_000, Math.min(55_000, Number(Deno.env.get('AI_PROVIDER_TIMEOUT_MS') || 50_000)));
  const timer = setTimeout(() => controller.abort(), providerTimeout);
  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(upstreamBody), signal: controller.signal,
    });
  } catch (error) {
    const code = error instanceof DOMException && error.name === 'AbortError' ? 'AI_PROVIDER_TIMEOUT' : 'AI_PROVIDER_UNREACHABLE';
    const status = code === 'AI_PROVIDER_TIMEOUT' ? 504 : 502;
    await logRequest({ status: 'failed', input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0, http_status: status, error_code: code });
    return jsonResponse({ error: code }, status, origin);
  } finally { clearTimeout(timer); }

  if (!upstream.ok) {
    const code = upstream.status === 429 ? 'AI_RATE_LIMITED' : ([402, 403].includes(upstream.status) ? 'AI_QUOTA_EXCEEDED' : 'AI_PROVIDER_ERROR');
    const status = code === 'AI_RATE_LIMITED' ? 429 : (code === 'AI_QUOTA_EXCEEDED' ? 402 : (upstream.status >= 500 ? 502 : 400));
    await logRequest({ status: 'failed', input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0, http_status: upstream.status, error_code: code });
    return jsonResponse({ error: code, provider_status: upstream.status }, status, origin, upstream.status === 429 ? { 'Retry-After': upstream.headers.get('retry-after') || '60' } : {});
  }

  const result = await upstream.json();
  const usage = result && typeof result.usage === 'object' ? result.usage : {};
  const inputTokens = Math.max(0, Number(usage.prompt_tokens || usage.input_tokens || 0));
  const outputTokens = Math.max(0, Number(usage.completion_tokens || usage.output_tokens || 0));
  const totalTokens = Math.max(inputTokens + outputTokens, Number(usage.total_tokens || 0));
  await logRequest({ status: 'completed', input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: totalTokens, estimated_cost_usd: estimateCost(inputTokens, outputTokens), http_status: 200, error_code: null });
  return jsonResponse(result, 200, origin);
});
