# Billing checkout deployment

The function creates a Stripe subscription Checkout Session only when the server-side Stripe secrets are configured. Without them it returns `BILLING_NOT_CONFIGURED`; the browser never changes a user's tier directly.

```bash
supabase secrets set STRIPE_SECRET_KEY=... STRIPE_PRICE_PRO_MONTHLY=... ALLOWED_ORIGINS=https://lidengrong3-prog.github.io
supabase functions deploy billing-checkout
```

Stripe webhook processing updates `workspace_subscriptions` and appends the idempotent `billing_events` ledger. Keep `BILLING_ENABLED=false` until the audited live acceptance run passes. `BILLING_LIVE_ACCEPTANCE_MODE=true` may temporarily allow Checkout only for the exact `BILLING_ACCEPTANCE_WORKSPACE_ID`; it must never be enabled at the same time as public billing. See `docs/STRIPE_LIVE_BILLING.md`.
