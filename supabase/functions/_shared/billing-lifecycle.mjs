const SUPPORTED_EVENT_TYPES = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required',
  'invoice.marked_uncollectible',
  'charge.refunded',
  'refund.updated',
]);

export function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function stringId(value) {
  if (typeof value === 'string' && value) return value;
  const record = objectValue(value);
  return typeof record.id === 'string' && record.id ? record.id : null;
}

export function isoFromUnix(value) {
  const seconds = Number(value || 0);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

export function subscriptionId(object) {
  const direct = stringId(objectValue(object).subscription);
  if (direct) return direct;
  const parent = objectValue(objectValue(object).parent);
  return stringId(objectValue(parent.subscription_details).subscription);
}

export function billingMetadata(object) {
  const record = objectValue(object);
  const parent = objectValue(record.parent);
  const subscriptionDetails = objectValue(parent.subscription_details);
  return {
    ...objectValue(subscriptionDetails.metadata),
    ...objectValue(record.metadata),
  };
}

function firstBillingItem(object) {
  const record = objectValue(object);
  const itemRows = objectValue(record.items).data;
  if (Array.isArray(itemRows) && itemRows.length) return objectValue(itemRows[0]);
  const lineRows = objectValue(record.lines).data;
  return Array.isArray(lineRows) && lineRows.length ? objectValue(lineRows[0]) : {};
}

function billingPriceId(item) {
  const direct = stringId(objectValue(item).price);
  if (direct) return direct;
  const pricing = objectValue(objectValue(item).pricing);
  return stringId(objectValue(pricing.price_details).price);
}

export function isSupportedBillingEvent(eventType) {
  return SUPPORTED_EVENT_TYPES.has(String(eventType || ''));
}

export function subscriptionStatus(value, deleted = false) {
  if (deleted) return 'cancelled';
  const status = String(value || 'active');
  if (status === 'trialing') return 'trialing';
  if (status === 'active') return 'active';
  if (['past_due', 'unpaid', 'incomplete', 'paused'].includes(status)) return 'past_due';
  if (status === 'canceled') return 'cancelled';
  return 'expired';
}

function safePlan(metadata, eventPriceId, configuredProPrice, existing) {
  const inferred = eventPriceId && eventPriceId === configuredProPrice ? 'pro' : String(existing.plan || 'free');
  const candidate = String(objectValue(metadata).plan || inferred);
  return ['free', 'pro', 'enterprise'].includes(candidate) ? candidate : inferred;
}

function refundState(eventType, object) {
  const charge = eventType === 'refund.updated' ? objectValue(object.charge_details) : object;
  const refund = eventType === 'refund.updated' ? objectValue(object.refund_details || object) : {};
  const rawRefundStatus = eventType === 'charge.refunded' ? 'succeeded' : String(refund.status || 'pending');
  const refundStatus = rawRefundStatus === 'canceled' ? 'cancelled' : rawRefundStatus;
  const amount = Math.max(0, Number(charge.amount || 0));
  const refundedAmount = Math.max(0, Number(charge.amount_refunded || refund.amount || 0));
  const succeeded = refundStatus === 'succeeded';
  const full = succeeded && (charge.refunded === true || (amount > 0 && refundedAmount >= amount));
  const partial = succeeded && !full && refundedAmount > 0;
  return {
    status: full ? 'full' : (partial ? 'partial' : refundStatus),
    succeeded,
    full,
    amount: refundedAmount,
    currency: String(charge.currency || refund.currency || '').toLowerCase() || null,
  };
}

function clearEntitlementRevocation(patch) {
  patch.refund_status = null;
  patch.refunded_amount_minor = null;
  patch.refund_currency = null;
  patch.refunded_at = null;
  patch.entitlement_revoked_at = null;
  patch.entitlement_revoke_reason = null;
}

export function buildBillingSubscriptionPatch(options) {
  const eventType = String(options.eventType || '');
  const object = objectValue(options.object);
  const existing = objectValue(options.existing);
  const metadata = billingMetadata(object);
  const eventCreatedAt = String(options.eventCreatedAt || '');
  const item = firstBillingItem(object);
  const eventPriceId = billingPriceId(item);
  const inferredPlan = safePlan(metadata, eventPriceId, String(options.configuredProPrice || ''), existing);
  const patch = {
    user_id: options.userId,
    plan: inferredPlan,
    provider: 'stripe',
    provider_customer_id: stringId(object.customer) || existing.provider_customer_id || null,
    provider_subscription_id: subscriptionId(object) || existing.provider_subscription_id || null,
    provider_updated_at: eventCreatedAt,
    last_event_type: eventType,
  };

  if (eventType.startsWith('customer.subscription.')) {
    const price = objectValue(item.price);
    patch.status = subscriptionStatus(object.status, eventType === 'customer.subscription.deleted');
    patch.provider_price_id = stringId(price) || existing.provider_price_id || null;
    patch.current_period_start = isoFromUnix(object.current_period_start || item.current_period_start);
    patch.current_period_end = isoFromUnix(object.current_period_end || item.current_period_end);
    patch.cancel_at_period_end = object.cancel_at_period_end === true;
    patch.canceled_at = isoFromUnix(object.canceled_at);
    patch.ended_at = isoFromUnix(object.ended_at);
    if (patch.status === 'active' || patch.status === 'trialing') {
      patch.last_payment_error = null;
      patch.last_payment_failed_at = null;
      const incomingSubscriptionId = subscriptionId(object);
      if (incomingSubscriptionId && incomingSubscriptionId !== existing.provider_subscription_id) {
        clearEntitlementRevocation(patch);
      }
    }
  } else if (eventType === 'checkout.session.completed' || eventType === 'checkout.session.async_payment_succeeded') {
    patch.status = object.payment_status === 'unpaid' ? 'past_due' : 'active';
    patch.latest_payment_status = String(object.payment_status || 'paid');
    patch.last_payment_error = null;
    patch.last_payment_failed_at = null;
    clearEntitlementRevocation(patch);
  } else if (eventType === 'checkout.session.async_payment_failed') {
    patch.status = 'past_due';
    patch.latest_payment_status = 'failed';
    patch.last_payment_error = 'checkout_async_payment_failed';
    patch.last_payment_failed_at = eventCreatedAt;
  } else if (eventType === 'invoice.paid') {
    patch.status = String(existing.status) === 'cancelled' ? existing.status : 'active';
    patch.latest_invoice_id = stringId(object.id);
    patch.latest_payment_status = 'paid';
    patch.last_payment_error = null;
    patch.last_payment_failed_at = null;
    clearEntitlementRevocation(patch);
    patch.current_period_start = isoFromUnix(object.period_start) || existing.current_period_start || null;
    patch.current_period_end = isoFromUnix(object.period_end) || existing.current_period_end || null;
  } else if (['invoice.payment_failed', 'invoice.payment_action_required', 'invoice.marked_uncollectible'].includes(eventType)) {
    patch.status = ['cancelled', 'expired'].includes(String(existing.status))
      ? existing.status
      : (eventType === 'invoice.marked_uncollectible' ? 'expired' : 'past_due');
    patch.latest_invoice_id = stringId(object.id);
    patch.latest_payment_status = eventType.replace('invoice.', '');
    patch.last_payment_error = String(objectValue(object.last_finalization_error).message || eventType).slice(0, 500);
    patch.last_payment_failed_at = eventCreatedAt;
  } else if (eventType === 'charge.refunded' || eventType === 'refund.updated') {
    const refund = refundState(eventType, object);
    patch.latest_payment_status = refund.status === 'full'
      ? 'refunded'
      : (refund.status === 'partial' ? 'partially_refunded' : `refund_${refund.status}`);
    patch.refund_status = refund.status;
    patch.refunded_amount_minor = refund.amount;
    patch.refund_currency = refund.currency;
    if (refund.succeeded) patch.refunded_at = eventCreatedAt;
    if (refund.full) {
      patch.entitlement_revoked_at = eventCreatedAt;
      patch.entitlement_revoke_reason = 'full_refund';
    }
  }

  return patch;
}
