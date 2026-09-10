import {
  allowedOrigins,
  billingEnabled,
  corsHeaders,
  jsonResponse,
  serviceHeaders,
  supabaseServiceConfig,
  userFromJwt,
} from '../_shared/billing.ts';

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (origin && !allowedOrigins().includes(origin)) return jsonResponse({ error: 'ORIGIN_NOT_ALLOWED' }, 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);

  const config = supabaseServiceConfig();
  if (!config) return jsonResponse({ error: 'BILLING_STATUS_NOT_CONFIGURED' }, 503, origin);
  const user = await userFromJwt(request, config);
  if (!user) return jsonResponse({ error: 'AUTH_REQUIRED' }, 401, origin);

  const headers = serviceHeaders(config.serviceKey);
  const subscriptionResponse = await fetch(
    `${config.url}/rest/v1/user_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&select=id,plan,status,provider,provider_customer_id,provider_subscription_id,provider_price_id,current_period_start,current_period_end,cancel_at_period_end,latest_invoice_id,latest_payment_status,last_payment_error,last_payment_failed_at,canceled_at,ended_at,refunded_at,refund_status,refunded_amount_minor,refund_currency,entitlement_revoked_at,entitlement_revoke_reason,updated_at&limit=1`,
    { headers },
  );
  if (!subscriptionResponse.ok) return jsonResponse({ error: 'BILLING_STATUS_UNAVAILABLE' }, 502, origin);
  const subscriptionRows = await subscriptionResponse.json();
  const subscription = subscriptionRows?.[0] || { plan: 'free', status: 'active', provider: 'internal' };
  const periodEnd = subscription.current_period_end ? Date.parse(String(subscription.current_period_end)) : 0;
  const periodExpired = subscription.provider === 'stripe'
    && ['active', 'trialing'].includes(String(subscription.status))
    && Number.isFinite(periodEnd) && periodEnd > 0 && periodEnd <= Date.now();
  const accessState = subscription.entitlement_revoke_reason === 'full_refund'
    ? 'refunded'
    : (periodExpired ? 'expired' : String(subscription.status || 'active'));
  const effectivePlanResponse = await fetch(`${config.url}/rest/v1/rpc/effective_billing_plan`, {
    method: 'POST', headers, body: JSON.stringify({ p_user_id: user.id }),
  });
  if (!effectivePlanResponse.ok) return jsonResponse({ error: 'BILLING_ENTITLEMENTS_UNAVAILABLE' }, 503, origin);
  const effectivePlan = String(await effectivePlanResponse.json() || 'free');

  const [entitlementResponse, usageResponse] = await Promise.all([
    fetch(`${config.url}/rest/v1/billing_plan_entitlements?plan=eq.${encodeURIComponent(effectivePlan)}&active=eq.true&select=plan,currency,monthly_price_minor,monthly_ai_token_limit,ai_requests_per_minute,monthly_report_limit,monthly_export_limit,features&limit=1`, { headers }),
    fetch(`${config.url}/rest/v1/rpc/get_user_billing_usage`, {
      method: 'POST', headers, body: JSON.stringify({ p_user_id: user.id }),
    }),
  ]);
  if (!entitlementResponse.ok || !usageResponse.ok) return jsonResponse({ error: 'BILLING_ENTITLEMENTS_UNAVAILABLE' }, 503, origin);
  const entitlementRows = await entitlementResponse.json();
  const planEntitlement = entitlementRows?.[0];
  if (!planEntitlement) return jsonResponse({ error: 'BILLING_ENTITLEMENTS_UNAVAILABLE' }, 503, origin);
  const entitlement = { ...planEntitlement };
  const monthlyCap = Math.max(0, Number(Deno.env.get('AI_MONTHLY_TOKEN_LIMIT') || 0));
  const minuteCap = Math.max(0, Number(Deno.env.get('AI_REQUESTS_PER_MINUTE') || 0));
  if (monthlyCap > 0) entitlement.monthly_ai_token_limit = Math.min(Number(planEntitlement.monthly_ai_token_limit || 0), monthlyCap);
  if (minuteCap > 0) entitlement.ai_requests_per_minute = Math.min(Number(planEntitlement.ai_requests_per_minute || 1), minuteCap);
  const usage = await usageResponse.json();

  return jsonResponse({
    billing_enabled: billingEnabled(),
    effective_plan: effectivePlan,
    access_state: accessState,
    subscription,
    entitlement,
    usage,
  }, 200, origin);
});
