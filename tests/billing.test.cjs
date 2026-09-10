const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');

test('Stripe webhook signatures are verified against the raw body and timestamp', async () => {
  const moduleUrl = pathToFileURL(path.join(root, 'supabase/functions/_shared/stripe-signature.mjs')).href;
  const { verifyStripeSignature } = await import(moduleUrl);
  const rawBody = JSON.stringify({ id: 'evt_test', type: 'invoice.paid' });
  const timestamp = 1788364800;
  const secret = 'whsec_test_signing_secret';
  const digest = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');

  assert.equal(await verifyStripeSignature(rawBody, `t=${timestamp},v1=${digest}`, secret, { nowSeconds: timestamp }), true);
  assert.equal(await verifyStripeSignature(rawBody + ' ', `t=${timestamp},v1=${digest}`, secret, { nowSeconds: timestamp }), false);
  assert.equal(await verifyStripeSignature(rawBody, `t=${timestamp},v1=bad,v1=${digest}`, secret, { nowSeconds: timestamp }), true);
  assert.equal(await verifyStripeSignature(rawBody, `t=${timestamp},v1=${digest}`, secret, { nowSeconds: timestamp + 301 }), false);
});

test('billing lifecycle preserves access until period-end cancellation and revokes it on deletion', async () => {
  const moduleUrl = pathToFileURL(path.join(root, 'supabase/functions/_shared/billing-lifecycle.mjs')).href;
  const { buildBillingSubscriptionPatch } = await import(moduleUrl);
  const base = {
    user_id: '00000000-0000-4000-8000-000000000001',
    plan: 'pro',
    status: 'active',
    provider_customer_id: 'cus_1',
    provider_subscription_id: 'sub_1',
  };
  const scheduled = buildBillingSubscriptionPatch({
    eventType: 'customer.subscription.updated',
    eventCreatedAt: '2026-09-09T00:00:00.000Z',
    configuredProPrice: 'price_pro',
    userId: base.user_id,
    existing: base,
    object: {
      id: 'sub_1', customer: 'cus_1', status: 'active', cancel_at_period_end: true,
      current_period_start: 1788825600, current_period_end: 1791504000,
      items: { data: [{ price: { id: 'price_pro' } }] },
    },
  });
  assert.equal(scheduled.status, 'active');
  assert.equal(scheduled.cancel_at_period_end, true);
  assert.equal(scheduled.current_period_end, '2026-10-09T00:00:00.000Z');

  const deleted = buildBillingSubscriptionPatch({
    eventType: 'customer.subscription.deleted',
    eventCreatedAt: '2026-10-09T00:00:00.000Z',
    configuredProPrice: 'price_pro',
    userId: base.user_id,
    existing: { ...base, ...scheduled },
    object: { id: 'sub_1', customer: 'cus_1', status: 'canceled', ended_at: 1791504000, items: { data: [] } },
  });
  assert.equal(deleted.status, 'cancelled');
  assert.equal(deleted.ended_at, '2026-10-09T00:00:00.000Z');
});

test('billing lifecycle pauses failed payments and restores access after renewal', async () => {
  const moduleUrl = pathToFileURL(path.join(root, 'supabase/functions/_shared/billing-lifecycle.mjs')).href;
  const { buildBillingSubscriptionPatch } = await import(moduleUrl);
  const existing = {
    user_id: '00000000-0000-4000-8000-000000000001', plan: 'pro', status: 'active',
    provider_customer_id: 'cus_1', provider_subscription_id: 'sub_1',
  };
  const failed = buildBillingSubscriptionPatch({
    eventType: 'invoice.payment_failed', eventCreatedAt: '2026-09-09T01:00:00.000Z',
    configuredProPrice: 'price_pro', userId: existing.user_id, existing,
    object: { id: 'in_1', customer: 'cus_1', subscription: 'sub_1', last_finalization_error: { message: 'card declined' } },
  });
  assert.equal(failed.status, 'past_due');
  assert.equal(failed.latest_payment_status, 'payment_failed');
  assert.equal(failed.last_payment_error, 'card declined');

  const renewed = buildBillingSubscriptionPatch({
    eventType: 'invoice.paid', eventCreatedAt: '2026-09-09T02:00:00.000Z',
    configuredProPrice: 'price_pro', userId: existing.user_id, existing: { ...existing, ...failed },
    object: { id: 'in_2', customer: 'cus_1', subscription: 'sub_1', period_start: 1788825600, period_end: 1791504000 },
  });
  assert.equal(renewed.status, 'active');
  assert.equal(renewed.latest_payment_status, 'paid');
  assert.equal(renewed.last_payment_error, null);
  assert.equal(renewed.entitlement_revoked_at, null);
});

test('billing lifecycle reads current Stripe invoice metadata and price fields', async () => {
  const moduleUrl = pathToFileURL(path.join(root, 'supabase/functions/_shared/billing-lifecycle.mjs')).href;
  const { billingMetadata, buildBillingSubscriptionPatch, subscriptionId } = await import(moduleUrl);
  const invoice = {
    id: 'in_current',
    customer: 'cus_1',
    parent: {
      subscription_details: {
        subscription: 'sub_1',
        metadata: { user_id: '00000000-0000-4000-8000-000000000001', plan: 'pro' },
      },
    },
    lines: { data: [{ pricing: { price_details: { price: 'price_pro' } } }] },
  };
  assert.equal(subscriptionId(invoice), 'sub_1');
  assert.equal(billingMetadata(invoice).user_id, '00000000-0000-4000-8000-000000000001');
  const patch = buildBillingSubscriptionPatch({
    eventType: 'invoice.paid', eventCreatedAt: '2026-09-09T02:00:00.000Z',
    configuredProPrice: 'price_pro', userId: billingMetadata(invoice).user_id,
    existing: {}, object: invoice,
  });
  assert.equal(patch.plan, 'pro');
  assert.equal(patch.provider_subscription_id, 'sub_1');
});

test('billing lifecycle distinguishes partial and full refunds', async () => {
  const moduleUrl = pathToFileURL(path.join(root, 'supabase/functions/_shared/billing-lifecycle.mjs')).href;
  const { buildBillingSubscriptionPatch } = await import(moduleUrl);
  const existing = {
    user_id: '00000000-0000-4000-8000-000000000001', plan: 'pro', status: 'active',
    provider_customer_id: 'cus_1', provider_subscription_id: 'sub_1',
  };
  const partial = buildBillingSubscriptionPatch({
    eventType: 'charge.refunded', eventCreatedAt: '2026-09-09T03:00:00.000Z',
    configuredProPrice: 'price_pro', userId: existing.user_id, existing,
    object: { id: 'ch_1', customer: 'cus_1', amount: 99900, amount_refunded: 20000, refunded: false, currency: 'cny' },
  });
  assert.equal(partial.refund_status, 'partial');
  assert.equal(partial.latest_payment_status, 'partially_refunded');
  assert.equal(partial.entitlement_revoked_at, undefined);

  const full = buildBillingSubscriptionPatch({
    eventType: 'refund.updated', eventCreatedAt: '2026-09-09T04:00:00.000Z',
    configuredProPrice: 'price_pro', userId: existing.user_id, existing: { ...existing, ...partial },
    object: {
      customer: 'cus_1',
      refund_details: { id: 're_1', status: 'succeeded', amount: 99900, currency: 'cny' },
      charge_details: { id: 'ch_1', customer: 'cus_1', amount: 99900, amount_refunded: 99900, refunded: true, currency: 'cny' },
    },
  });
  assert.equal(full.refund_status, 'full');
  assert.equal(full.latest_payment_status, 'refunded');
  assert.equal(full.entitlement_revoke_reason, 'full_refund');
  assert.equal(full.entitlement_revoked_at, '2026-09-09T04:00:00.000Z');
});

test('billing lifecycle is fail-closed, idempotent and deployed in the required order', () => {
  const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260903000000_billing_lifecycle.sql'), 'utf8');
  const hardening = fs.readFileSync(path.join(root, 'supabase/migrations/20260909000000_billing_entitlement_hardening.sql'), 'utf8');
  const checkout = fs.readFileSync(path.join(root, 'supabase/functions/billing-checkout/index.ts'), 'utf8');
  const webhook = fs.readFileSync(path.join(root, 'supabase/functions/billing-webhook/index.ts'), 'utf8');
  const lifecycle = fs.readFileSync(path.join(root, 'supabase/functions/_shared/billing-lifecycle.mjs'), 'utf8');
  const shared = fs.readFileSync(path.join(root, 'supabase/functions/_shared/billing.ts'), 'utf8');
  const aiProxy = fs.readFileSync(path.join(root, 'supabase/functions/ai-proxy/index.ts'), 'utf8');
  const config = fs.readFileSync(path.join(root, 'supabase/config.toml'), 'utf8');
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/deploy-production.yml'), 'utf8');

  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.billing_plan_entitlements/);
  assert.match(migration, /monthly_ai_token_limit/);
  assert.match(migration, /monthly_report_limit/);
  assert.match(migration, /monthly_export_limit/);
  assert.match(migration, /claim_stripe_billing_event/);
  assert.match(migration, /ON CONFLICT \(provider, provider_event_id\) DO NOTHING/);
  assert.match(migration, /report_runs_enforce_plan_quota/);
  assert.match(migration, /report_exports_enforce_plan_quota/);
  assert.match(hardening, /entitlement_revoked_at IS NULL/);
  assert.match(hardening, /current_period_end > NOW\(\)/);
  assert.match(hardening, /CREATE TABLE IF NOT EXISTS public\.ai_token_reservations/);
  assert.match(hardening, /pg_advisory_xact_lock/);
  assert.match(hardening, /reserve_ai_token_quota/);
  assert.match(hardening, /finalize_ai_token_reservation/);
  assert.match(hardening, /EXPORT_FEATURE_NOT_AVAILABLE/);
  assert.match(hardening, /processing_started_at < NOW\(\) - INTERVAL '5 minutes'/);

  assert.match(shared, /Deno\.env\.get\('BILLING_ENABLED'\) === 'true'/);
  assert.match(shared, /Idempotency-Key/);
  assert.match(checkout, /client_reference_id: user\.id/);
  assert.match(checkout, /subscription_data\[metadata\]\[user_id\]/);
  assert.match(webhook, /const rawBody = await request\.text\(\)/);
  assert.ok(webhook.indexOf('request.text()') < webhook.indexOf('JSON.parse(rawBody)'));
  for (const eventType of [
    'checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated',
    'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed', 'charge.refunded',
  ]) assert.match(lifecycle, new RegExp(eventType.replaceAll('.', '\\.')));

  assert.match(aiProxy, /billing_plan_entitlements/);
  assert.match(aiProxy, /reserve_ai_token_quota/);
  assert.match(aiProxy, /finalize_ai_token_reservation/);
  assert.match(aiProxy, /remaining_tokens/);
  assert.match(config, /\[functions\.billing-webhook\][\s\S]*verify_jwt = false/);
  assert.match(workflow, /Deploy Stripe webhook without Supabase JWT verification/);
  assert.ok(workflow.indexOf('Apply database migrations before functions') < workflow.indexOf('Deploy Stripe webhook without Supabase JWT verification'));
});
