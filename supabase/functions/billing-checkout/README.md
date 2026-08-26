# Billing checkout deployment

The function creates a Stripe subscription Checkout Session only when the server-side Stripe secrets are configured. Without them it returns `BILLING_NOT_CONFIGURED`; the browser never changes a user's tier directly.

```bash
supabase secrets set STRIPE_SECRET_KEY=... STRIPE_PRICE_PRO_MONTHLY=... ALLOWED_ORIGINS=https://lidengrong3-prog.github.io
supabase functions deploy billing-checkout
```

Stripe webhook processing should update `user_subscriptions` and append `billing_events` before production billing is enabled.
