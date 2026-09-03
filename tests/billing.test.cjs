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

test('billing lifecycle is fail-closed, idempotent and deployed in the required order', () => {
  const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260903000000_billing_lifecycle.sql'), 'utf8');
  const checkout = fs.readFileSync(path.join(root, 'supabase/functions/billing-checkout/index.ts'), 'utf8');
  const webhook = fs.readFileSync(path.join(root, 'supabase/functions/billing-webhook/index.ts'), 'utf8');
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

  assert.match(shared, /Deno\.env\.get\('BILLING_ENABLED'\) === 'true'/);
  assert.match(shared, /Idempotency-Key/);
  assert.match(checkout, /client_reference_id: user\.id/);
  assert.match(checkout, /subscription_data\[metadata\]\[user_id\]/);
  assert.match(webhook, /const rawBody = await request\.text\(\)/);
  assert.ok(webhook.indexOf('request.text()') < webhook.indexOf('JSON.parse(rawBody)'));
  for (const eventType of [
    'checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated',
    'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed', 'charge.refunded',
  ]) assert.match(webhook, new RegExp(eventType.replaceAll('.', '\\.')));

  assert.match(aiProxy, /billing_plan_entitlements/);
  assert.match(aiProxy, /get_user_billing_usage/);
  assert.match(aiProxy, /remaining_tokens/);
  assert.match(config, /\[functions\.billing-webhook\][\s\S]*verify_jwt = false/);
  assert.match(workflow, /Deploy Stripe webhook without Supabase JWT verification/);
  assert.ok(workflow.indexOf('Apply database migrations before functions') < workflow.indexOf('Deploy Stripe webhook without Supabase JWT verification'));
});
