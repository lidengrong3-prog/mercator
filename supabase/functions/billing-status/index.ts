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
    `${config.url}/rest/v1/user_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&select=id,plan,status,provider,provider_customer_id,provider_subscription_id,provider_price_id,current_period_start,current_period_end,cancel_at_period_end,latest_invoice_id,latest_payment_status,last_payment_error,last_payment_failed_at,canceled_at,ended_at,refunded_at,updated_at&limit=1`,
    { headers },
  );
  if (!subscriptionResponse.ok) return jsonResponse({ error: 'BILLING_STATUS_UNAVAILABLE' }, 502, origin);
  const subscriptionRows = await subscriptionResponse.json();
  const subscription = subscriptionRows?.[0] || { plan: 'free', status: 'active', provider: 'internal' };
  const effectivePlan = ['active', 'trialing'].includes(String(subscription.status)) ? String(subscription.plan || 'free') : 'free';

  const [entitlementResponse, usageResponse] = await Promise.all([
    fetch(`${config.url}/rest/v1/billing_plan_entitlements?plan=eq.${encodeURIComponent(effectivePlan)}&active=eq.true&select=plan,currency,monthly_price_minor,monthly_ai_token_limit,ai_requests_per_minute,monthly_report_limit,monthly_export_limit,features&limit=1`, { headers }),
    fetch(`${config.url}/rest/v1/rpc/get_user_billing_usage`, {
      method: 'POST', headers, body: JSON.stringify({ p_user_id: user.id }),
    }),
  ]);
  if (!entitlementResponse.ok || !usageResponse.ok) return jsonResponse({ error: 'BILLING_ENTITLEMENTS_UNAVAILABLE' }, 503, origin);
  const entitlementRows = await entitlementResponse.json();
  const entitlement = entitlementRows?.[0];
  if (!entitlement) return jsonResponse({ error: 'BILLING_ENTITLEMENTS_UNAVAILABLE' }, 503, origin);
  const usage = await usageResponse.json();

  return jsonResponse({
    billing_enabled: billingEnabled(),
    effective_plan: effectivePlan,
    subscription,
    entitlement,
    usage,
  }, 200, origin);
});
