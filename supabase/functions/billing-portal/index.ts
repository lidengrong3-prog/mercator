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

  const response = await fetch(
    `${config.url}/rest/v1/user_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&provider=eq.stripe&select=provider_customer_id&limit=1`,
    { headers: serviceHeaders(config.serviceKey) },
  );
  const rows = response.ok ? await response.json() : [];
  const customerId = String(rows?.[0]?.provider_customer_id || '');
  if (!customerId) return jsonResponse({ error: 'BILLING_CUSTOMER_NOT_FOUND' }, 404, origin);

  const returnUrl = `${applicationBaseUrl(origin)}/#pricing`;
  let stripeResponse: Response;
  try {
    stripeResponse = await stripeRequest('billing_portal/sessions', new URLSearchParams({ customer: customerId, return_url: returnUrl }));
  } catch {
    return jsonResponse({ error: 'BILLING_PROVIDER_UNREACHABLE' }, 502, origin);
  }
  if (!stripeResponse.ok) return jsonResponse({ error: 'BILLING_PROVIDER_ERROR', provider_status: stripeResponse.status }, 502, origin);
  const session = await stripeResponse.json();
  if (!session.url) return jsonResponse({ error: 'BILLING_PORTAL_URL_MISSING' }, 502, origin);
  return jsonResponse({ url: session.url, provider: 'stripe' }, 200, origin);
});
