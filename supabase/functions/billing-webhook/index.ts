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
  if (await claimResponse.json() !== true) {
    const replayResponse = await fetch(`${config.url}/rest/v1/rpc/record_stripe_webhook_replay_evidence`, {
      method: 'POST', headers, body: JSON.stringify({ p_provider_event_id: eventId }),
    });
    if (!replayResponse.ok) return jsonResponse({ error: 'BILLING_REPLAY_EVIDENCE_FAILED' }, 500, null);
    return jsonResponse({ received: true, duplicate: true, replay_verified: Boolean(await replayResponse.json()) }, 200, null);
  }

  let resolvedUserId: string | null = null;
  let resolvedWorkspaceId: string | null = null;
  const finalize = async (status: 'processed' | 'failed' | 'ignored', error: string | null = null) => {
    const response = await fetch(
      `${config.url}/rest/v1/billing_events?provider=eq.stripe&provider_event_id=eq.${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          user_id: resolvedUserId,
          workspace_id: resolvedWorkspaceId,
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
    resolvedUserId = uuid(metadata.user_id);
    resolvedWorkspaceId = uuid(metadata.workspace_id);
    // New checkout sessions use client_reference_id for the workspace. A
    // lookup keeps old sessions, which used the user id, fully compatible.
    if (!resolvedWorkspaceId && uuid(object.client_reference_id)) {
      const reference = uuid(object.client_reference_id) as string;
      const workspaceReference = await fetch(
        `${config.url}/rest/v1/workspace_subscriptions?workspace_id=eq.${encodeURIComponent(reference)}&select=workspace_id&limit=1`,
        { headers },
      );
      const workspaceRows = workspaceReference.ok ? await workspaceReference.json() : [];
      if (workspaceRows?.[0]?.workspace_id) resolvedWorkspaceId = uuid(workspaceRows[0].workspace_id);
      else resolvedUserId = resolvedUserId || reference;
    }

    let existing: JsonRecord | null = null;
    const subscriptionLookupFilters = objectSubscriptionId
      ? `provider_subscription_id=eq.${encodeURIComponent(objectSubscriptionId)}`
      : `provider_customer_id=eq.${encodeURIComponent(customerId || '')}`;
    if (resolvedWorkspaceId) {
      const lookup = await fetch(
        `${config.url}/rest/v1/workspace_subscriptions?workspace_id=eq.${encodeURIComponent(resolvedWorkspaceId)}&${subscriptionLookupFilters}&select=*&limit=1`,
        { headers },
      );
      const rows = lookup.ok ? await lookup.json() : [];
      existing = rows?.[0] || null;
    }
    if (!existing && !resolvedWorkspaceId && (objectSubscriptionId || customerId)) {
      const workspaceLookup = await fetch(
        `${config.url}/rest/v1/workspace_subscriptions?provider=eq.stripe&${subscriptionLookupFilters}&select=*&limit=1`,
        { headers },
      );
      const workspaceRows = workspaceLookup.ok ? await workspaceLookup.json() : [];
      existing = workspaceRows?.[0] || null;
      resolvedWorkspaceId = uuid(existing?.workspace_id);
    }
    if (!existing && !resolvedWorkspaceId && !resolvedUserId && (objectSubscriptionId || customerId)) {
      const lookup = await fetch(
        `${config.url}/rest/v1/user_subscriptions?provider=eq.stripe&${subscriptionLookupFilters}&select=*&limit=1`,
        { headers },
      );
      const rows = lookup.ok ? await lookup.json() : [];
      existing = rows?.[0] || null;
      resolvedUserId = uuid(existing?.user_id);
    }
    if (resolvedWorkspaceId && !resolvedUserId) {
      const ownerLookup = await fetch(`${config.url}/rest/v1/workspaces?id=eq.${encodeURIComponent(resolvedWorkspaceId)}&select=owner_id&limit=1`, { headers });
      const owners = ownerLookup.ok ? await ownerLookup.json() : [];
      resolvedUserId = uuid(owners?.[0]?.owner_id);
    }
    if (resolvedUserId && !existing && !resolvedWorkspaceId) {
      const lookup = await fetch(
        `${config.url}/rest/v1/user_subscriptions?user_id=eq.${encodeURIComponent(resolvedUserId)}&select=*&limit=1`,
        { headers },
      );
      const rows = lookup.ok ? await lookup.json() : [];
      existing = rows?.[0] || null;
    }

    if (!resolvedUserId && !resolvedWorkspaceId) {
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
      workspaceId: resolvedWorkspaceId,
    }) as JsonRecord;

    const targetTable = resolvedWorkspaceId ? 'workspace_subscriptions' : 'user_subscriptions';
    const conflict = resolvedWorkspaceId ? 'workspace_id' : 'user_id';
    const upsert = await fetch(`${config.url}/rest/v1/${targetTable}?on_conflict=${conflict}`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(patch),
    });
    if (!upsert.ok) throw new Error(`SUBSCRIPTION_SYNC_FAILED:${upsert.status}`);

    if (resolvedWorkspaceId && event.livemode === true) {
      const evidence: Array<{ scenario: string; passed: boolean; details: JsonRecord }> = [];
      if ((eventType === 'checkout.session.completed' || eventType === 'checkout.session.async_payment_succeeded')
        && String(object.payment_status || '') === 'paid') {
        evidence.push({ scenario: 'purchase', passed: patch.status === 'active', details: { payment_status: object.payment_status, subscription_id_resolved: Boolean(patch.provider_subscription_id) } });
      }
      if (eventType === 'invoice.paid' && String(object.billing_reason || '') === 'subscription_cycle') {
        evidence.push({ scenario: 'renewal', passed: patch.status === 'active', details: { billing_reason: 'subscription_cycle', invoice_status: object.status || null } });
      }
      if (eventType === 'invoice.payment_failed') {
        evidence.push({ scenario: 'payment_failed', passed: patch.status === 'past_due', details: { subscription_id_resolved: Boolean(patch.provider_subscription_id) } });
      }
      if (eventType === 'invoice.paid' && existing?.last_payment_failed_at) {
        evidence.push({ scenario: 'payment_recovered', passed: patch.status === 'active' && patch.last_payment_error === null, details: { previous_failure_recorded: true } });
      }
      if (eventType === 'customer.subscription.updated' && object.cancel_at_period_end === true) {
        evidence.push({ scenario: 'cancel_period_end', passed: patch.status === 'active' && patch.cancel_at_period_end === true, details: { entitlement_retained_until_period_end: Boolean(patch.current_period_end) } });
      }
      if (eventType === 'customer.subscription.deleted') {
        const previousPeriodEnd = existing?.current_period_end ? Date.parse(String(existing.current_period_end)) : 0;
        const endedBeforePeriod = Number.isFinite(previousPeriodEnd) && previousPeriodEnd > Date.parse(eventCreatedAt) + 60_000;
        const immediate = existing?.cancel_at_period_end !== true || endedBeforePeriod;
        if (immediate) evidence.push({ scenario: 'cancel_immediate', passed: patch.status === 'cancelled', details: { ended_before_previous_period_end: endedBeforePeriod } });
      }
      if (['charge.refunded', 'refund.updated'].includes(eventType) && patch.refund_status === 'partial') {
        evidence.push({ scenario: 'refund_partial', passed: !patch.entitlement_revoked_at, details: { refund_status: 'partial', refunded_amount_minor: patch.refunded_amount_minor || 0, currency: patch.refund_currency || null } });
      }
      if (['charge.refunded', 'refund.updated'].includes(eventType) && patch.refund_status === 'full') {
        evidence.push({ scenario: 'refund_full', passed: patch.entitlement_revoke_reason === 'full_refund', details: { refund_status: 'full', refunded_amount_minor: patch.refunded_amount_minor || 0, currency: patch.refund_currency || null, entitlement_revoked: Boolean(patch.entitlement_revoked_at) } });
      }
      for (const item of evidence) {
        const evidenceResponse = await fetch(`${config.url}/rest/v1/rpc/record_stripe_live_billing_evidence`, {
          method: 'POST', headers,
          body: JSON.stringify({
            p_workspace_id: resolvedWorkspaceId, p_scenario: item.scenario,
            p_provider_event_id: eventId, p_event_type: eventType,
            p_provider_object_id: stringId(object.id) || objectSubscriptionId || customerId,
            p_observed_at: eventCreatedAt, p_passed: item.passed,
            p_details: { livemode: true, ...item.details },
          }),
        });
        if (!evidenceResponse.ok) throw new Error(`LIVE_ACCEPTANCE_EVIDENCE_FAILED:${item.scenario}:${evidenceResponse.status}`);
      }
    }
    await finalize('processed');
    return jsonResponse({ received: true, processed: true }, 200, null);
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).slice(0, 1000);
    try { await finalize('failed', message); } catch { /* Preserve the original processing failure. */ }
    return jsonResponse({ error: 'BILLING_WEBHOOK_PROCESSING_FAILED' }, 500, null);
  }
});
