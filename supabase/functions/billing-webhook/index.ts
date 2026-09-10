import {
  jsonResponse,
  serviceHeaders,
  stripeRetrieve,
  supabaseServiceConfig,
} from '../_shared/billing.ts';
import {
  buildBillingSubscriptionPatch,
  billingMetadata,
  isSupportedBillingEvent,
  isoFromUnix,
  objectValue,
  stringId,
  subscriptionId,
} from '../_shared/billing-lifecycle.mjs';
import { verifyStripeSignature } from '../_shared/stripe-signature.mjs';

type JsonRecord = Record<string, unknown>;

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
      metadata: billingMetadata(object),
    },
  };
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
    if (!isSupportedBillingEvent(eventType)) {
      await finalize('ignored', 'EVENT_TYPE_NOT_USED');
      return jsonResponse({ received: true, ignored: true }, 200, null);
    }
    if (event.livemode !== true && Deno.env.get('STRIPE_ALLOW_TEST_EVENTS') !== 'true') {
      await finalize('ignored', 'TEST_EVENT_REJECTED_IN_LIVE_MODE');
      return jsonResponse({ received: true, ignored: true }, 200, null);
    }

    let object = objectValue(objectValue(event.data).object) as JsonRecord;
    if (eventType === 'refund.updated') {
      const chargeId = stringId(object.charge);
      if (!chargeId) throw new Error('REFUND_CHARGE_ID_MISSING');
      const chargeResponse = await stripeRetrieve(`charges/${encodeURIComponent(chargeId)}`);
      if (!chargeResponse.ok) throw new Error(`REFUND_CHARGE_LOOKUP_FAILED:${chargeResponse.status}`);
      const charge = objectValue(await chargeResponse.json()) as JsonRecord;
      object = {
        ...object,
        customer: charge.customer || null,
        charge_details: charge,
        refund_details: object,
      };
    }

    const metadata = billingMetadata(object);
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

    if (!resolvedUserId) {
      await finalize('ignored', 'USER_NOT_RESOLVED');
      return jsonResponse({ received: true, ignored: true }, 200, null);
    }

    const existingUpdated = existing?.provider_updated_at ? Date.parse(String(existing.provider_updated_at)) : 0;
    if (existingUpdated > Date.parse(eventCreatedAt)) {
      await finalize('ignored', 'STALE_EVENT');
      return jsonResponse({ received: true, stale: true }, 200, null);
    }

    const patch = buildBillingSubscriptionPatch({
      eventType,
      object,
      existing: existing || {},
      eventCreatedAt,
      configuredProPrice: Deno.env.get('STRIPE_PRICE_PRO_MONTHLY') || '',
      userId: resolvedUserId,
    }) as JsonRecord;

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
