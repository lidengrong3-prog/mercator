import {
  allowedOrigins,
  billingAcceptanceMode,
  billingCheckoutEnabled,
  billingEnabled,
  corsHeaders,
  jsonResponse,
  serviceHeaders,
  stripeConfigured,
  stripeRetrieve,
  supabaseServiceConfig,
  userFromJwt,
} from '../_shared/billing.ts';
import { buildBillingSubscriptionPatch, objectValue } from '../_shared/billing-lifecycle.mjs';
import { enforceRateLimit, rateLimitResponse, requestId as securityRequestId } from '../_shared/security.ts';

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (origin && !allowedOrigins().includes(origin)) return jsonResponse({ error: 'ORIGIN_NOT_ALLOWED' }, 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);

  const config = supabaseServiceConfig();
  if (!config) return jsonResponse({ error: 'BILLING_STATUS_NOT_CONFIGURED' }, 503, origin);
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

  const headers = serviceHeaders(config.serviceKey);
  let payload: Record<string, unknown> = {};
  try { payload = await request.json(); } catch { /* Empty body keeps legacy callers working. */ }
  let workspaceId = typeof payload.workspace_id === 'string' ? payload.workspace_id.trim() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId)) {
    const membershipResponse = await fetch(`${config.url}/rest/v1/workspace_members?user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&select=workspace_id&order=joined_at.asc&limit=1`, { headers });
    const memberships = membershipResponse.ok ? await membershipResponse.json() : [];
    workspaceId = String(memberships?.[0]?.workspace_id || '');
  }
  if (!workspaceId) return jsonResponse({ error: 'WORKSPACE_REQUIRED' }, 400, origin);
  const membershipResponse = await fetch(`${config.url}/rest/v1/workspace_members?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&select=role&limit=1`, { headers });
  const memberships = membershipResponse.ok ? await membershipResponse.json() : [];
  if (!memberships?.length) return jsonResponse({ error: 'WORKSPACE_FORBIDDEN' }, 403, origin);
  const subscriptionResponse = await fetch(
    `${config.url}/rest/v1/workspace_subscriptions?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=id,workspace_id,plan,status,provider,provider_customer_id,provider_subscription_id,provider_price_id,current_period_start,current_period_end,cancel_at_period_end,latest_invoice_id,latest_payment_status,last_payment_error,last_payment_failed_at,canceled_at,ended_at,refunded_at,refund_status,refunded_amount_minor,refund_currency,entitlement_revoked_at,entitlement_revoke_reason,seat_limit,manual_reason,updated_at&limit=1`,
    { headers },
  );
  if (!subscriptionResponse.ok) return jsonResponse({ error: 'BILLING_STATUS_UNAVAILABLE' }, 502, origin);
  const subscriptionRows = await subscriptionResponse.json();
  const subscription = subscriptionRows?.[0] || { workspace_id: workspaceId, plan: 'free', status: 'active', provider: 'internal', seat_limit: 1 };
  const periodEnd = subscription.current_period_end ? Date.parse(String(subscription.current_period_end)) : 0;
  const periodExpired = subscription.provider === 'stripe'
    && ['active', 'trialing'].includes(String(subscription.status))
    && Number.isFinite(periodEnd) && periodEnd > 0 && periodEnd <= Date.now();
  const accessState = subscription.entitlement_revoke_reason === 'full_refund'
    ? 'refunded'
    : (periodExpired ? 'expired' : String(subscription.status || 'active'));
  const effectivePlanResponse = await fetch(`${config.url}/rest/v1/rpc/workspace_effective_entitlement`, {
    method: 'POST', headers, body: JSON.stringify({ p_workspace_id: workspaceId, p_user_id: user.id }),
  });
  if (!effectivePlanResponse.ok) return jsonResponse({ error: 'BILLING_ENTITLEMENTS_UNAVAILABLE' }, 503, origin);
  const planEntitlement = await effectivePlanResponse.json();
  const effectivePlan = String(planEntitlement?.plan || 'free');

  const usageResponse = await fetch(`${config.url}/rest/v1/rpc/get_workspace_billing_usage`, {
    method: 'POST', headers, body: JSON.stringify({ p_workspace_id: workspaceId, p_user_id: user.id }),
  });
  if (!usageResponse.ok || !planEntitlement) return jsonResponse({ error: 'BILLING_ENTITLEMENTS_UNAVAILABLE' }, 503, origin);
  const entitlement = { ...planEntitlement };
  const monthlyCap = Math.max(0, Number(Deno.env.get('AI_MONTHLY_TOKEN_LIMIT') || 0));
  const minuteCap = Math.max(0, Number(Deno.env.get('AI_REQUESTS_PER_MINUTE') || 0));
  if (monthlyCap > 0) entitlement.monthly_ai_token_limit = Math.min(Number(planEntitlement.monthly_ai_token_limit || 0), monthlyCap);
  if (minuteCap > 0) entitlement.ai_requests_per_minute = Math.min(Number(planEntitlement.ai_requests_per_minute || 1), minuteCap);
  const usage = await usageResponse.json();

  let providerConsistency: Record<string, unknown> = { status: subscription.provider === 'stripe' ? 'unverified' : 'not_applicable', consistent: null };
  if (subscription.provider === 'stripe' && subscription.provider_subscription_id && stripeConfigured()) {
    try {
      const providerResponse = await stripeRetrieve(`subscriptions/${encodeURIComponent(String(subscription.provider_subscription_id))}`);
      if (providerResponse.ok) {
        const providerSubscription = objectValue(await providerResponse.json());
        const normalized = buildBillingSubscriptionPatch({
          eventType: 'customer.subscription.updated', object: providerSubscription, existing: subscription,
          eventCreatedAt: new Date().toISOString(), configuredProPrice: Deno.env.get('STRIPE_PRICE_PRO_MONTHLY') || '',
          workspaceId, userId: user.id,
        }) as Record<string, unknown>;
        const timeMatches = (left: unknown, right: unknown) => {
          if (!left && !right) return true;
          const leftTime = Date.parse(String(left || '')), rightTime = Date.parse(String(right || ''));
          return Number.isFinite(leftTime) && Number.isFinite(rightTime) && Math.abs(leftTime - rightTime) <= 2000;
        };
        const checks = {
          livemode: providerSubscription.livemode === true,
          subscription_id: String(normalized.provider_subscription_id || '') === String(subscription.provider_subscription_id || ''),
          customer_id: String(normalized.provider_customer_id || '') === String(subscription.provider_customer_id || ''),
          price_id: String(normalized.provider_price_id || '') === String(subscription.provider_price_id || ''),
          status: String(normalized.status || '') === String(subscription.status || ''),
          cancel_at_period_end: normalized.cancel_at_period_end === subscription.cancel_at_period_end,
          current_period_end: timeMatches(normalized.current_period_end, subscription.current_period_end),
        };
        const consistent = Object.values(checks).every(Boolean);
        providerConsistency = { status: consistent ? 'consistent' : 'mismatch', consistent, checks, checked_at: new Date().toISOString() };
      } else {
        providerConsistency = { status: 'provider_unavailable', consistent: false, provider_status: providerResponse.status, checked_at: new Date().toISOString() };
      }
    } catch {
      providerConsistency = { status: 'provider_unavailable', consistent: false, checked_at: new Date().toISOString() };
    }
  }

  return jsonResponse({
    billing_enabled: billingEnabled(),
    checkout_enabled: billingCheckoutEnabled(workspaceId),
    live_acceptance_mode: !billingEnabled() && billingAcceptanceMode() && billingCheckoutEnabled(workspaceId),
    workspace_id: workspaceId,
    effective_plan: effectivePlan,
    access_state: accessState,
    subscription,
    entitlement,
    usage,
    provider_consistency: providerConsistency,
  }, 200, origin);
});
