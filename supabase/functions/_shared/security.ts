// Shared public-service security primitives. Keep this module free of service
// specific business logic so every Edge Function uses the same policy.

export const defaultOrigins = [
  'https://lidengrong3-prog.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:4174',
  'http://127.0.0.1:4174',
];

const DEFAULT_LIMITS: Record<string, { user: number; ip: number; window: number }> = {
  ai: { user: 20, ip: 60, window: 60 },
  search: { user: 30, ip: 90, window: 60 },
  report: { user: 5, ip: 15, window: 60 },
  export: { user: 10, ip: 30, window: 60 },
  invite: { user: 10, ip: 20, window: 600 },
  upload: { user: 20, ip: 60, window: 60 },
  billing: { user: 10, ip: 20, window: 60 },
  data_subject: { user: 3, ip: 10, window: 3600 },
};

export function allowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS');
  const values = (raw ? raw.split(',') : defaultOrigins).map((value) => value.trim()).filter(Boolean);
  return Array.from(new Set(values));
}

export function originAllowed(origin: string | null): boolean {
  return !origin || allowedOrigins().includes(origin);
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const configured = allowedOrigins();
  const allowed = origin && configured.includes(origin) ? origin : configured[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-request-id, x-client-version',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Expose-Headers': 'Retry-After, X-JAY-Release, X-Request-Id',
    Vary: 'Origin',
  };
}

export function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string | null,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json; charset=utf-8',
      'X-JAY-Release': Deno.env.get('RELEASE_SHA') || 'unversioned',
      ...extra,
    },
  });
}

export function requestId(request: Request, supplied?: unknown): string {
  const candidate = String(supplied || request.headers.get('X-Request-Id') || '').slice(0, 240);
  return /^[A-Za-z0-9._:-]{8,240}$/.test(candidate) ? candidate : crypto.randomUUID();
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const value = forwarded || request.headers.get('cf-connecting-ip')?.trim() || request.headers.get('x-real-ip')?.trim();
  return value && value.length <= 128 ? value : 'unknown';
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((part) => part.toString(16).padStart(2, '0')).join('');
}

function limitFor(scope: string): { user: number; ip: number; window: number } {
  const defaults = DEFAULT_LIMITS[scope] || { user: 30, ip: 90, window: 60 };
  const prefix = `RATE_LIMIT_${scope.toUpperCase()}_`;
  const numeric = (name: string, fallback: number) => {
    const value = Number(Deno.env.get(prefix + name) || fallback);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  };
  return {
    user: numeric('USER_PER_WINDOW', defaults.user),
    ip: numeric('IP_PER_WINDOW', defaults.ip),
    window: numeric('WINDOW_SECONDS', defaults.window),
  };
}

export type RateLimitResult = {
  allowed: boolean;
  scope: string;
  retryAfter: number;
  limit: number;
  used: number;
};

async function consume(
  supabaseUrl: string,
  serviceKey: string,
  scope: string,
  subject: string,
  limit: number,
  window: number,
  userId: string | null,
): Promise<RateLimitResult> {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/consume_security_rate_limit`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_scope: scope, p_subject_key: subject, p_limit: limit, p_window_seconds: window, p_user_id: userId }),
  });
  if (!response.ok) throw new Error(`RATE_LIMIT_RPC_${response.status}`);
  const value = await response.json();
  return {
    allowed: value?.allowed === true,
    scope,
    retryAfter: Math.max(0, Number(value?.retry_after || 0)),
    limit: Math.max(1, Number(value?.limit || limit)),
    used: Math.max(0, Number(value?.used || 0)),
  };
}

export async function enforceRateLimit(options: {
  supabaseUrl: string;
  serviceKey: string;
  request: Request;
  scope: string;
  userId?: string | null;
}): Promise<RateLimitResult> {
  const limits = limitFor(options.scope);
  const userId = options.userId || null;
  if (userId) {
    const userResult = await consume(options.supabaseUrl, options.serviceKey, `security:${options.scope}:user`, userId, limits.user, limits.window, userId);
    if (!userResult.allowed) return userResult;
  }
  const ipHash = await sha256(`${Deno.env.get('RATE_LIMIT_SALT') || 'jay-guanhai'}:${clientIp(options.request)}`);
  return consume(options.supabaseUrl, options.serviceKey, `security:${options.scope}:ip`, ipHash, limits.ip, limits.window, userId);
}

export function rateLimitResponse(result: RateLimitResult, requestIdValue: string, origin: string | null): Response {
  const retryAfter = String(Math.max(1, result.retryAfter || 1));
  return jsonResponse({
    error: 'RATE_LIMITED',
    code: 'RATE_LIMITED',
    request_id: requestIdValue,
    scope: result.scope,
    limit: result.limit,
    used: result.used,
    retry_after: Number(retryAfter),
    suggestion: '请求过于频繁，请稍后重试',
  }, 429, origin, { 'Retry-After': retryAfter, 'X-Request-Id': requestIdValue });
}

export function originError(request: Request): Response | null {
  const origin = request.headers.get('Origin');
  return originAllowed(origin) ? null : jsonResponse({ error: 'ORIGIN_NOT_ALLOWED', code: 'ORIGIN_NOT_ALLOWED' }, 403, origin);
}
