# Runbook 10 — Client did not return from Stripe Checkout

## Symptoms
- A customer paid on Stripe but the browser never returned to the success URL (closed the tab, lost
  connectivity, etc.), so `submit-order` was never called.

## What is guaranteed (by design)
Order creation does NOT depend on the browser redirect. The signature-verified webhook
(`checkout.session.completed`) is the authority and creates the V2 order server-to-server. The
recipient email is taken from the verified Stripe session, so the finished PDF can still be
delivered after operator approval even though the client never returned.

## Safe diagnosis (PII-free)
1. Query `translation_orders_v2` by `checkout_session_id` — the webhook should have created the row.
2. Confirm `verified_recipient_email` is present (Stripe-derived). If null, the customer did not
   provide an email at checkout → operator must request a delivery address out of band; NEVER
   fabricate a recipient.

## Steps
1. If the order exists (expected): no action — the operator picks it up from the queue normally.
2. If the order is MISSING: the webhook also failed/never-arrived. Replay the Stripe event id
   through the idempotent handler (Runbook 1). Do NOT create the order manually.
3. If `verified_recipient_email` is null: hold delivery; obtain a recipient through a verified
   channel; record it via the audited `changeRecipient` operator action (never a raw DB edit).

## NEVER
- NEVER use a client-supplied email as the delivery authority.
- NEVER mark-as-paid manually; the webhook event id replay is the only re-drive.
- NEVER fabricate a recipient when the Stripe session has none.
