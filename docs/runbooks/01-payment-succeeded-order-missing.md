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

## Authority model (Phase 2 closeout)
The signature-verified **webhook** is the AUTHORITY for V2 order creation (it calls
`handleVerifiedPayment(source='webhook')`). `submit-order` is **reconciliation**
(`source='client_reconciliation'`). Both converge on ONE order per `checkout_session_id`. A paid
session with no order means BOTH the webhook and the client failed/never-ran, OR the handler
rejected the payment facts.

## Steps
1. **Replay the Stripe event** (preferred): re-deliver the `checkout.session.completed` event from
   the Stripe dashboard. It flows through the idempotent handler. Dedupe is on the Stripe EVENT id
   (`stripe_processed_events`) AND order uniqueness on `checkout_session_id` — a replay cannot
   double-create. NOTE: if the event id was already recorded but the order is missing, the dedupe
   ledger will skip it — in that case re-drive via step 2 instead (different idempotency key).
2. Re-drive reconciliation by re-invoking `POST /api/translation/submit-order` for the session.
   `createOrGetOrder` is IDEMPOTENT on `checkout_session_id` — it collapses to one row.
3. Inspect the `payment_succeeded_order_missing` event `error_code`:
   - `amount_mismatch` / `mode_mismatch` → the paid amount/currency/mode does not match the
     server-expected product. Do NOT force-create. Investigate price-map drift or tampering first.
   - `storage_unavailable` → infra (Supabase). Fix infra; the webhook 5xx makes Stripe retry.
4. Confirm `verified_recipient_email` was bound from the Stripe session (server-side), never client.

## NEVER
- NEVER mark-as-paid manually in production. Replay is ONLY by Stripe event id through the
  idempotent handler.
- NEVER set order status by hand (only `transition_translation_order`).
- NEVER insert a paid order row manually.
- NEVER read the recipient from the client; it comes from Stripe only.
- NEVER change `canonical_document_id` by hand.
- NEVER regenerate an artifact during a payment replay.
- NEVER edit `translation_orders_v2`, `document_artifacts`, `delivery_outbox`, or
  `stripe_processed_events` rows directly. Record any admin action in the audit ledger.
