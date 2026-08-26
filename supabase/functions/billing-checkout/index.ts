const defaultOrigins = [
  'https://lidengrong3-prog.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

function origins(): string[] {
  return (Deno.env.get('ALLOWED_ORIGINS') || defaultOrigins.join(','))
    .split(',').map((value) => value.trim()).filter(Boolean);
}
function cors(origin: string | null): Record<string, string> {
  const allowed = origin && origins().includes(origin) ? origin : origins()[0];
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
}
function json(body: Record<string, unknown>, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json; charset=utf-8' } });
}
async function userFromJwt(request: Request): Promise<{ id: string; email?: string } | null> {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authorization } });
  return response.ok ? await response.json() : null;
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (origin && !origins().includes(origin)) return json({ error: 'ORIGIN_NOT_ALLOWED' }, 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);

  const user = await userFromJwt(request);
  if (!user) return json({ error: 'AUTH_REQUIRED' }, 401, origin);
  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return json({ error: 'INVALID_JSON' }, 400, origin); }
  const plan = String(payload.plan || '').toLowerCase();
  if (plan !== 'pro') return json({ error: 'BILLING_CONTACT_REQUIRED' }, 400, origin);
  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
  const priceId = Deno.env.get('STRIPE_PRICE_PRO_MONTHLY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!stripeSecret || !priceId || !webhookSecret) return json({ error: 'BILLING_NOT_CONFIGURED' }, 503, origin);

  const successUrl = `${origin || origins()[0]}/?billing=success#pricing`;
  const cancelUrl = `${origin || origins()[0]}/?billing=cancelled#pricing`;
  const body = new URLSearchParams({
    mode: 'subscription',
    customer_email: String(user.email || ''),
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: successUrl,
    cancel_url: cancelUrl,
    'metadata[user_id]': user.id,
    'metadata[plan]': plan,
  });
  let stripeResponse: Response;
  try {
    stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${stripeSecret}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  } catch { return json({ error: 'BILLING_PROVIDER_UNREACHABLE' }, 502, origin); }
  if (!stripeResponse.ok) return json({ error: 'BILLING_PROVIDER_ERROR', provider_status: stripeResponse.status }, 502, origin);
  const session = await stripeResponse.json();
  if (!session.url) return json({ error: 'CHECKOUT_URL_MISSING' }, 502, origin);
  return json({ url: session.url, provider: 'stripe', plan, status: 'checkout_created' }, 200, origin);
});
