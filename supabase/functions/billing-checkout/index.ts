import {
  allowedOrigins,
  applicationBaseUrl,
  billingEnabled,
  corsHeaders,
  jsonResponse,
  serviceHeaders,
  stripeRequest,
  supabaseServiceConfig,
  userFromJwt,
} from '../_shared/billing.ts';

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (origin && !allowedOrigins().includes(origin)) return jsonResponse({ error: 'ORIGIN_NOT_ALLOWED' }, 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);
  if (!billingEnabled()) return jsonResponse({ error: 'BILLING_NOT_ENABLED' }, 503, origin);

  const config = supabaseServiceConfig();
  if (!config) return jsonResponse({ error: 'BILLING_NOT_CONFIGURED' }, 503, origin);
  const user = await userFromJwt(request, config);
  if (!user) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401, origin);

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return jsonResponse({ error: 'INVALID_JSON' }, 400, origin); }
  const plan = String(payload.plan || '').toLowerCase();
  if (plan !== 'pro') return jsonResponse({ error: 'BILLING_CONTACT_REQUIRED' }, 400, origin);

  const subscriptionResponse = await fetch(
    `${config.url}/rest/v1/user_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&select=plan,status,provider,provider_customer_id,provider_subscription_id&limit=1`,
    { headers: serviceHeaders(config.serviceKey) },
  );
  if (!subscriptionResponse.ok) return jsonResponse({ error: 'BILLING_STATUS_UNAVAILABLE' }, 503, origin);
  const subscriptionRows = await subscriptionResponse.json();
  const current = subscriptionRows?.[0];
  const effectivePlanResponse = await fetch(`${config.url}/rest/v1/rpc/effective_billing_plan`, {
    method: 'POST',
    headers: serviceHeaders(config.serviceKey),
    body: JSON.stringify({ p_user_id: user.id }),
  });
  if (!effectivePlanResponse.ok) return jsonResponse({ error: 'BILLING_ENTITLEMENTS_UNAVAILABLE' }, 503, origin);
  const effectivePlan = String(await effectivePlanResponse.json() || 'free');
  if (effectivePlan === 'pro') {
    return jsonResponse({ error: 'SUBSCRIPTION_ALREADY_ACTIVE' }, 409, origin);
  }
  if (current?.provider === 'stripe' && current?.provider_subscription_id
    && !['cancelled', 'expired'].includes(String(current.status))) {
    return jsonResponse({ error: 'SUBSCRIPTION_REQUIRES_MANAGEMENT' }, 409, origin);
  }

  const requestKey = String(payload.idempotency_key || request.headers.get('X-Request-Id') || crypto.randomUUID());
  const normalizedKey = /^[A-Za-z0-9._:-]{8,160}$/.test(requestKey) ? requestKey : crypto.randomUUID();
  const priceId = Deno.env.get('STRIPE_PRICE_PRO_MONTHLY') || '';
  const baseUrl = applicationBaseUrl(origin);
  const body = new URLSearchParams({
    mode: 'subscription',
    client_reference_id: user.id,
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: `${baseUrl}/?billing=success&session_id={CHECKOUT_SESSION_ID}#pricing`,
    cancel_url: `${baseUrl}/?billing=cancelled#pricing`,
    allow_promotion_codes: 'true',
    billing_address_collection: 'auto',
    'metadata[user_id]': user.id,
    'metadata[plan]': plan,
    'subscription_data[metadata][user_id]': user.id,
    'subscription_data[metadata][plan]': plan,
  });
  if (current?.provider_customer_id) body.set('customer', String(current.provider_customer_id));
  else if (user.email) body.set('customer_email', String(user.email));

  let stripeResponse: Response;
  try {
    stripeResponse = await stripeRequest('checkout/sessions', body, `checkout:${user.id}:${plan}:${normalizedKey}`);
  } catch {
    return jsonResponse({ error: 'BILLING_PROVIDER_UNREACHABLE' }, 502, origin);
  }
  if (!stripeResponse.ok) return jsonResponse({ error: 'BILLING_PROVIDER_ERROR', provider_status: stripeResponse.status }, 502, origin);
  const session = await stripeResponse.json();
  if (!session.url) return jsonResponse({ error: 'CHECKOUT_URL_MISSING' }, 502, origin);
  return jsonResponse({ url: session.url, provider: 'stripe', plan, status: 'checkout_created' }, 200, origin);
});
