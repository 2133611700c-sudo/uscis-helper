# Runbook 9 — Webhook / client reconciliation race

## Symptoms
- The Stripe webhook and the client `submit-order` both fire for the same paid checkout, possibly
  concurrently or in either order.
- Alert 13 (webhook/client race anomaly) elevated, or a suspicion of double orders.

## What is guaranteed (by design)
The signature-verified webhook is the AUTHORITY; `submit-order` is reconciliation. Both call the
SAME unified handler (`handleVerifiedPayment`). Order creation is idempotent on
`checkout_session_id` (UNIQUE), so EVERY ordering collapses to exactly one order:
- webhook-first / client-second → client reuses the webhook's order.
- client-first / webhook-second → webhook reuses the client's order.
- both concurrent → one INSERT wins, the other re-selects the same row.
- client never returns → webhook still creates the order (no dependence on the browser redirect).
- webhook delayed → the durable order/outbox reconciles when it arrives.
- webhook duplicated → suppressed by the `stripe_processed_events` event-id ledger.
There is exactly ONE order, ONE canonical binding, ONE logical paid (queued) state, and a full
append-only audit. No second audit transition, no second outbox event.

## Safe diagnosis (PII-free)
1. Query `translation_orders_v2` by `checkout_session_id` — expect exactly one row.
2. Query `translation_order_events` by `order_id` — the first transition (if any) is the operator's
   `queued→assigned`; creation itself emits NO transition (the order is born `queued`).
3. Query `stripe_processed_events` by `checkout_session_id` — one row per distinct Stripe event id.

## Steps
1. If exactly one order exists: nothing to do — the race resolved correctly.
2. If you suspect two orders for one checkout: the UNIQUE constraint makes this impossible. If a
   query shows two, it is two DIFFERENT `checkout_session_id`s (two real payments) — treat as two
   orders, do NOT delete either; escalate for a possible double-charge refund decision (Runbook 11).

## NEVER
- NEVER delete an order to "resolve" a race.
- NEVER mark-as-paid or set status by hand.
- NEVER trust the client's view over the server-retrieved Stripe session.
