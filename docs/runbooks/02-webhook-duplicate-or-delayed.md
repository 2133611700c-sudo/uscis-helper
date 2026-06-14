# Runbook 2 — Webhook duplicate or delayed

## Symptoms
- Same Stripe event delivered more than once, or arriving late.
- Alert 5 (webhook signature failure spike) or duplicate counters elevated.

## Safe diagnosis (PII-free)
1. Identify by Stripe event id + `checkout_session_id` (never email/payload).
2. `webhook_signature_failure_total` spike → secret drift, NOT a code bug.
3. Duplicate delivery is EXPECTED from Stripe (at-least-once). Idempotency is the defense.

## Steps
1. Duplicate `checkout.session.completed`: order creation is idempotent on
   `checkout_session_id` (UNIQUE). A duplicate collapses to the existing row. No action.
2. Signature failures: verify `STRIPE_WEBHOOK_SECRET` matches the LIVE endpoint's signing
   secret in Stripe. A rotation mismatch is the usual cause.
3. Delayed webhook: the order/outbox pipeline is durable; a late event still reconciles.
   If the order was created via `submit-order` first, the webhook is informational.

## NEVER
- NEVER weaken or bypass `stripe.webhooks.constructEvent` signature verification.
- NEVER add a fake/unauthenticated webhook endpoint in production.
- NEVER hardcode `whsec_...` in code; it stays an env secret.
- NEVER trust a client-supplied `paid=true`.
