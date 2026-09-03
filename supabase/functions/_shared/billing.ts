export const defaultOrigins = [
  'https://lidengrong3-prog.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:4174',
  'http://127.0.0.1:4174',
];

export function allowedOrigins(): string[] {
  return (Deno.env.get('ALLOWED_ORIGINS') || defaultOrigins.join(','))
    .split(',').map((value) => value.trim()).filter(Boolean);
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const configured = allowedOrigins();
  const allowed = origin && configured.includes(origin) ? origin : configured[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-request-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Expose-Headers': 'Retry-After, X-JAY-Release',
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

export function billingEnabled(): boolean {
  return Deno.env.get('BILLING_ENABLED') === 'true'
    && Boolean(Deno.env.get('STRIPE_SECRET_KEY'))
    && Boolean(Deno.env.get('STRIPE_PRICE_PRO_MONTHLY'))
    && Boolean(Deno.env.get('STRIPE_WEBHOOK_SECRET'));
}

export function applicationBaseUrl(origin: string | null): string {
  const configured = String(Deno.env.get('PRODUCTION_SITE_URL') || '').trim();
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (parsed.protocol === 'https:') return configured.replace(/\/$/, '');
    } catch {
      // Fall through to the already allow-listed request origin.
    }
  }
  return (origin && allowedOrigins().includes(origin) ? origin : allowedOrigins()[0]).replace(/\/$/, '');
}

export function supabaseServiceConfig(): { url: string; anonKey: string; serviceKey: string } | null {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return url && anonKey && serviceKey ? { url, anonKey, serviceKey } : null;
}

export function serviceHeaders(serviceKey: string): Record<string, string> {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };
}

export async function userFromJwt(
  request: Request,
  config: { url: string; anonKey: string },
): Promise<{ id: string; email?: string } | null> {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.anonKey, Authorization: authorization },
  });
  return response.ok ? await response.json() : null;
}

export async function stripeRequest(
  path: string,
  body: URLSearchParams,
  idempotencyKey?: string,
): Promise<Response> {
  const secret = Deno.env.get('STRIPE_SECRET_KEY') || '';
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey.slice(0, 255);
  return fetch(`https://api.stripe.com/v1/${path.replace(/^\/+/, '')}`, {
    method: 'POST',
    headers,
    body,
  });
}

export function isoFromUnix(value: unknown): string | null {
  const seconds = Number(value || 0);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}
