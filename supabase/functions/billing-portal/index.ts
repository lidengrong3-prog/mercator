import {
  allowedOrigins,
  applicationBaseUrl,
  billingCheckoutEnabled,
  corsHeaders,
  jsonResponse,
  serviceHeaders,
  stripeRequest,
  supabaseServiceConfig,
  userFromJwt,
} from '../_shared/billing.ts';
import { enforceRateLimit, rateLimitResponse, requestId as securityRequestId } from '../_shared/security.ts';

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (origin && !allowedOrigins().includes(origin)) return jsonResponse({ error: 'ORIGIN_NOT_ALLOWED' }, 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);
  const config = supabaseServiceConfig();
  if (!config) return jsonResponse({ error: 'BILLING_NOT_CONFIGURED' }, 503, origin);
  const user = await userFromJwt(request, config);
  if (!user) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401, origin);
  const securityRequest = securityRequestId(request);
  try {
    const rate = await enforceRateLimit({ supabaseUrl: config.url, serviceKey: config.serviceKey, request, scope: 'billing', userId: user.id });
    if (!rate.allowed) return rateLimitResponse(rate, securityRequest, origin);
  } catch (error) {
    console.error('billing rate limiter unavailable', error);
    return jsonResponse({ error: 'RATE_LIMIT_UNAVAILABLE', request_id: securityRequest }, 503, origin);
  }

  let payload: Record<string, unknown> = {};
  try { payload = await request.json(); } catch { /* Legacy empty body is resolved to the first workspace. */ }
  const headers = serviceHeaders(config.serviceKey);
  let workspaceId = String(payload.workspace_id || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId)) {
    const membershipsResponse = await fetch(`${config.url}/rest/v1/workspace_members?user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&select=workspace_id&order=joined_at.asc&limit=1`, { headers });
    const memberships = membershipsResponse.ok ? await membershipsResponse.json() : [];
    workspaceId = String(memberships?.[0]?.workspace_id || '');
  }
  if (!workspaceId) return jsonResponse({ error: 'WORKSPACE_REQUIRED' }, 400, origin);
  const membershipResponse = await fetch(`${config.url}/rest/v1/workspace_members?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&role=in.(owner,admin)&select=role&limit=1`, { headers });
  if (!membershipResponse.ok || !(await membershipResponse.json())?.length) return jsonResponse({ error: 'WORKSPACE_BILLING_ADMIN_REQUIRED' }, 403, origin);
  if (!billingCheckoutEnabled(workspaceId)) return jsonResponse({ error: 'BILLING_NOT_ENABLED' }, 503, origin);

  const response = await fetch(
    `${config.url}/rest/v1/workspace_subscriptions?workspace_id=eq.${encodeURIComponent(workspaceId)}&provider=eq.stripe&select=provider_customer_id&limit=1`,
    { headers },
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
