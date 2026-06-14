# Runbook 1 — Payment succeeded but order missing

## Symptoms
- Stripe shows a paid `checkout.session.completed`, but no `translation_orders_v2` row
  exists for that `checkout_session_id`.
- Alert 6 (payment_succeeded vs orders_created reconciliation) fired.

## Safe diagnosis (PII-free)
1. Identify the session by `checkout_session_id` ONLY (never the customer email).
2. Query `translation_orders_v2` by `checkout_session_id`. Absent → confirmed.
3. Check `webhook_received_total{state=checkout.session.completed}` vs `orders_created_total`.
4. Check `submit-order` route logs for a 402/403/409/503 for that session (codes only).

## Steps
1. Re-drive the order creation by re-invoking `POST /api/translation/submit-order` for the
   session. `createOrGetOrder` is IDEMPOTENT on `checkout_session_id` — a re-run collapses
   to one row, it cannot double-create.
2. Confirm `verified_recipient_email` was bound from the Stripe session (server-side), not
   from any client field.
3. If `submit-order` returns 503 → infra (Supabase/queue). Fix infra, retry.

## NEVER
- NEVER mark-as-paid manually in production.
- NEVER set order status by hand (only `transition_translation_order`).
- NEVER read the recipient from the client; it comes from Stripe only.
- NEVER edit `translation_orders_v2`, `document_artifacts`, or `delivery_outbox` rows directly.
