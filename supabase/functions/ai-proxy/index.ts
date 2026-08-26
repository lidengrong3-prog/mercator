const defaultOrigins = [
  'https://lidengrong3-prog.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

function allowedOrigins(): string[] {
  const configured = Deno.env.get('ALLOWED_ORIGINS');
  return configured
    ? configured.split(',').map((value) => value.trim()).filter(Boolean)
    : defaultOrigins;
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

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (origin && !allowedOrigins().includes(origin)) {
    return jsonResponse({ error: 'ORIGIN_NOT_ALLOWED' }, 403, origin);
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);
  }

  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    return jsonResponse({ error: 'AUTH_REQUIRED' }, 401, origin);
  }

  const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
  if (!apiKey) {
    return jsonResponse({ error: 'AI_SERVICE_NOT_CONFIGURED' }, 503, origin);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'INVALID_JSON' }, 400, origin);
  }

  const messages = payload.messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 20) {
    return jsonResponse({ error: 'INVALID_MESSAGES' }, 400, origin);
  }

  let totalLength = 0;
  for (const message of messages) {
    if (!message || typeof message !== 'object') {
      return jsonResponse({ error: 'INVALID_MESSAGES' }, 400, origin);
    }
    const role = (message as Record<string, unknown>).role;
    const content = (message as Record<string, unknown>).content;
    if (!['system', 'user', 'assistant'].includes(String(role)) || typeof content !== 'string') {
      return jsonResponse({ error: 'INVALID_MESSAGES' }, 400, origin);
    }
    totalLength += content.length;
  }
  if (totalLength > 30_000) {
    return jsonResponse({ error: 'PROMPT_TOO_LARGE' }, 413, origin);
  }

  const temperature = Math.max(0, Math.min(1.5, Number(payload.temperature ?? 0.5)));
  const maxTokens = Math.max(128, Math.min(3_000, Number(payload.max_tokens ?? 1_500)));
  const upstreamBody: Record<string, unknown> = {
    model: Deno.env.get('DEEPSEEK_MODEL') || 'deepseek-chat',
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: false,
  };
  if (payload.web_search) upstreamBody.web_search = { type: 'enabled' };
  if (payload.plugins) upstreamBody.plugins = ['web_search'];

  const baseUrl = (Deno.env.get('DEEPSEEK_API_URL') || 'https://api.deepseek.com').replace(/\/$/, '');
  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(upstreamBody),
    });
  } catch {
    return jsonResponse({ error: 'AI_PROVIDER_UNREACHABLE' }, 502, origin);
  }

  if (!upstream.ok) {
    return jsonResponse(
      { error: 'AI_PROVIDER_ERROR', provider_status: upstream.status },
      upstream.status >= 500 ? 502 : 400,
      origin,
    );
  }

  const result = await upstream.json();
  return jsonResponse(result, 200, origin);
});
