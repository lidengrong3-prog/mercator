import {
  isoFromUnix,
  jsonResponse,
  serviceHeaders,
  supabaseServiceConfig,
} from '../_shared/billing.ts';
import { verifyStripeSignature } from '../_shared/stripe-signature.mjs';

type JsonRecord = Record<string, unknown>;

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringId(value: unknown): string | null {
  if (typeof value === 'string' && value) return value;
  const record = objectValue(value);
  return typeof record.id === 'string' && record.id ? record.id : null;
}

function uuid(value: unknown): string | null {
  const candidate = typeof value === 'string' ? value : '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate) ? candidate : null;
}

function eventSummary(event: JsonRecord): JsonRecord {
  const object = objectValue(objectValue(event.data).object);
  return {
    id: event.id,
    type: event.type,
    created: event.created,
    livemode: event.livemode === true,
    object: {
      id: object.id || null,
      object: object.object || null,
      customer: stringId(object.customer),
      subscription: subscriptionId(object),
      status: object.status || null,
      payment_status: object.payment_status || null,
      metadata: objectValue(object.metadata),
    },
  };
}

function subscriptionId(object: JsonRecord): string | null {
  const direct = stringId(object.subscription);
  if (direct) return direct;
  const parent = objectValue(object.parent);
  return stringId(objectValue(parent.subscription_details).subscription);
}

function subscriptionStatus(value: unknown, deleted = false): string {
  if (deleted) return 'cancelled';
  const status = String(value || 'active');
  if (status === 'trialing') return 'trialing';
  if (status === 'active') return 'active';
  if (['past_due', 'unpaid', 'incomplete'].includes(status)) return 'past_due';
  if (status === 'canceled') return 'cancelled';
  return 'expired';
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405, null);
  const config = supabaseServiceConfig();
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
  if (!config || !webhookSecret) return jsonResponse({ error: 'BILLING_WEBHOOK_NOT_CONFIGURED' }, 503, null);

  const rawBody = await request.text();
  const signature = request.headers.get('Stripe-Signature') || '';
  if (!await verifyStripeSignature(rawBody, signature, webhookSecret, {
    toleranceSeconds: Number(Deno.env.get('STRIPE_WEBHOOK_TOLERANCE_SECONDS') || 300),
  })) {
    return jsonResponse({ error: 'INVALID_STRIPE_SIGNATURE' }, 400, null);
  }

  let event: JsonRecord;
  try { event = JSON.parse(rawBody); } catch { return jsonResponse({ error: 'INVALID_JSON' }, 400, null); }
  const eventId = String(event.id || '');
  const eventType = String(event.type || '');
  const eventCreatedAt = isoFromUnix(event.created);
  if (!eventId.startsWith('evt_') || !eventType || !eventCreatedAt) return jsonResponse({ error: 'INVALID_STRIPE_EVENT' }, 400, null);

  const headers = serviceHeaders(config.serviceKey);
  const claimResponse = await fetch(`${config.url}/rest/v1/rpc/claim_stripe_billing_event`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      p_event_id: eventId,
      p_event_type: eventType,
      p_event_created_at: eventCreatedAt,
      p_payload: eventSummary(event),
    }),
  });
  if (!claimResponse.ok) return jsonResponse({ error: 'BILLING_EVENT_CLAIM_FAILED' }, 500, null);
  if (await claimResponse.json() !== true) return jsonResponse({ received: true, duplicate: true }, 200, null);

  let resolvedUserId: string | null = null;
  const finalize = async (status: 'processed' | 'failed' | 'ignored', error: string | null = null) => {
    const response = await fetch(
      `${config.url}/rest/v1/billing_events?provider=eq.stripe&provider_event_id=eq.${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          user_id: resolvedUserId,
          processing_status: status,
          processed_at: status === 'processed' || status === 'ignored' ? new Date().toISOString() : null,
          last_error: error,
        }),
      },
    );
    if (!response.ok) throw new Error('BILLING_EVENT_FINALIZE_FAILED');
  };

  try {
    const object = objectValue(objectValue(event.data).object);
    const metadata = objectValue(object.metadata);
    const objectSubscriptionId = subscriptionId(object);
    const customerId = stringId(object.customer);
    resolvedUserId = uuid(metadata.user_id) || uuid(object.client_reference_id);

    let existing: JsonRecord | null = null;
    if (!resolvedUserId && (objectSubscriptionId || customerId)) {
      const filters = objectSubscriptionId
        ? `provider_subscription_id=eq.${encodeURIComponent(objectSubscriptionId)}`
        : `provider_customer_id=eq.${encodeURIComponent(customerId || '')}`;
      const lookup = await fetch(
        `${config.url}/rest/v1/user_subscriptions?provider=eq.stripe&${filters}&select=*&limit=1`,
        { headers },
      );
      const rows = lookup.ok ? await lookup.json() : [];
      existing = rows?.[0] || null;
      resolvedUserId = uuid(existing?.user_id);
    }
    if (resolvedUserId && !existing) {
      const lookup = await fetch(
        `${config.url}/rest/v1/user_subscriptions?user_id=eq.${encodeURIComponent(resolvedUserId)}&select=*&limit=1`,
        { headers },
      );
      const rows = lookup.ok ? await lookup.json() : [];
      existing = rows?.[0] || null;
    }

    const supported = new Set([
      'checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed',
      'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
      'invoice.paid', 'invoice.payment_failed', 'invoice.payment_action_required', 'invoice.marked_uncollectible',
      'charge.refunded', 'refund.updated',
    ]);
    if (!supported.has(eventType)) {
      await finalize('ignored', 'EVENT_TYPE_NOT_USED');
      return jsonResponse({ received: true, ignored: true }, 200, null);
    }
    if (event.livemode !== true && Deno.env.get('STRIPE_ALLOW_TEST_EVENTS') !== 'true') {
      await finalize('ignored', 'TEST_EVENT_REJECTED_IN_LIVE_MODE');
      return jsonResponse({ received: true, ignored: true }, 200, null);
    }
    if (!resolvedUserId) {
      await finalize('ignored', 'USER_NOT_RESOLVED');
      return jsonResponse({ received: true, ignored: true }, 200, null);
    }

    const existingUpdated = existing?.provider_updated_at ? Date.parse(String(existing.provider_updated_at)) : 0;
    if (existingUpdated > Date.parse(eventCreatedAt)) {
      await finalize('ignored', 'STALE_EVENT');
      return jsonResponse({ received: true, stale: true }, 200, null);
    }

    const subscriptionItem = objectValue((objectValue(object.items).data as unknown[] || [])[0]);
    const eventPriceId = stringId(objectValue(subscriptionItem.price));
    const configuredProPrice = Deno.env.get('STRIPE_PRICE_PRO_MONTHLY') || '';
    const inferredPlan = eventPriceId && eventPriceId === configuredProPrice ? 'pro' : existing?.plan || 'free';
    const plan = String(metadata.plan || inferredPlan);
    const safePlan = ['free', 'pro', 'enterprise'].includes(plan) ? plan : String(inferredPlan);
    const patch: JsonRecord = {
      user_id: resolvedUserId,
      plan: safePlan,
      provider: 'stripe',
      provider_customer_id: customerId || existing?.provider_customer_id || null,
      provider_subscription_id: objectSubscriptionId || existing?.provider_subscription_id || null,
      provider_updated_at: eventCreatedAt,
      last_event_type: eventType,
    };

    if (eventType.startsWith('customer.subscription.')) {
      const price = objectValue(subscriptionItem.price);
      patch.status = subscriptionStatus(object.status, eventType === 'customer.subscription.deleted');
      patch.provider_price_id = stringId(price) || existing?.provider_price_id || null;
      patch.current_period_start = isoFromUnix(object.current_period_start || subscriptionItem.current_period_start);
      patch.current_period_end = isoFromUnix(object.current_period_end || subscriptionItem.current_period_end);
      patch.cancel_at_period_end = object.cancel_at_period_end === true;
      patch.canceled_at = isoFromUnix(object.canceled_at);
      patch.ended_at = isoFromUnix(object.ended_at);
      if (patch.status === 'active' || patch.status === 'trialing') {
        patch.last_payment_error = null;
        patch.last_payment_failed_at = null;
      }
    } else if (eventType === 'checkout.session.completed' || eventType === 'checkout.session.async_payment_succeeded') {
      patch.status = object.payment_status === 'unpaid' ? 'past_due' : 'active';
      patch.latest_payment_status = String(object.payment_status || 'paid');
      patch.last_payment_error = null;
      patch.last_payment_failed_at = null;
    } else if (eventType === 'checkout.session.async_payment_failed') {
      patch.status = 'past_due';
      patch.latest_payment_status = 'failed';
      patch.last_payment_error = 'checkout_async_payment_failed';
      patch.last_payment_failed_at = eventCreatedAt;
    } else if (eventType === 'invoice.paid') {
      patch.status = ['cancelled', 'expired'].includes(String(existing?.status)) ? existing?.status : 'active';
      patch.latest_invoice_id = stringId(object.id);
      patch.latest_payment_status = 'paid';
      patch.last_payment_error = null;
      patch.last_payment_failed_at = null;
      patch.current_period_start = isoFromUnix(object.period_start) || existing?.current_period_start || null;
      patch.current_period_end = isoFromUnix(object.period_end) || existing?.current_period_end || null;
    } else if (['invoice.payment_failed', 'invoice.payment_action_required', 'invoice.marked_uncollectible'].includes(eventType)) {
      patch.status = ['cancelled', 'expired'].includes(String(existing?.status))
        ? existing?.status
        : (eventType === 'invoice.marked_uncollectible' ? 'expired' : 'past_due');
      patch.latest_invoice_id = stringId(object.id);
      patch.latest_payment_status = eventType.replace('invoice.', '');
      patch.last_payment_error = String(objectValue(object.last_finalization_error).message || eventType).slice(0, 500);
      patch.last_payment_failed_at = eventCreatedAt;
    } else if (eventType === 'charge.refunded' || eventType === 'refund.updated') {
      patch.latest_payment_status = 'refunded';
      patch.refunded_at = eventCreatedAt;
    }

    const upsert = await fetch(`${config.url}/rest/v1/user_subscriptions?on_conflict=user_id`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(patch),
    });
    if (!upsert.ok) throw new Error(`SUBSCRIPTION_SYNC_FAILED:${upsert.status}`);
    await finalize('processed');
    return jsonResponse({ received: true, processed: true }, 200, null);
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).slice(0, 1000);
    try { await finalize('failed', message); } catch { /* Preserve the original processing failure. */ }
    return jsonResponse({ error: 'BILLING_WEBHOOK_PROCESSING_FAILED' }, 500, null);
  }
});
