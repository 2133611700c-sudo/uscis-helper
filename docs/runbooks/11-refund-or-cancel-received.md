# Runbook 11 — Refund / cancel received

## Symptoms
- A `charge.refunded` (or related refund/dispute) event arrives for a paid translation order.

## Current policy (load-bearing)
Refund **business policy is NOT yet defined** (full vs partial refund handling, whether a refund
cancels an in-flight order, clawback of an already-delivered artifact). Per the Phase 2 closeout
rules we do NOT guess. The webhook therefore:
- records the event in `stripe_processed_events` with `result_code='refund_review_required'`;
- makes **NO** state-machine change automatically;
- never deletes audit rows, never deletes/modifies immutable artifacts, never re-sends anything.

## Safe diagnosis (PII-free)
1. Identify the order by `checkout_session_id` / payment_intent (never email/payload).
2. Read the order status and its append-only `translation_order_events`.

## Steps (operator decision, through the allowed state machine ONLY)
1. Decide the business outcome (owner policy). Until policy exists, treat the order as
   **review_required** and pause delivery.
2. If the order has NOT yet been delivered and the decision is to stop it: transition via
   `transition_translation_order` to `cancelled` along an ALLOWED edge (e.g. `queued→cancelled`,
   `assigned→cancelled`, `in_review→cancelled`). Record the actor + reason in the audit ledger.
3. If the order WAS already delivered: a refund does NOT undo delivery. Do NOT delete the artifact
   or the delivery record. Any remediation (e.g. a corrected document) is a NEW artifact version,
   never an overwrite (see Runbook 8).

## NEVER
- NEVER invent refund legal/financial policy in code or by hand.
- NEVER delete an order, an audit event, or an immutable artifact in response to a refund.
- NEVER re-send a document because of a refund event.
- NEVER change order status outside `transition_translation_order`.
- Replay (if a refund event is re-delivered) is idempotent via the `stripe_processed_events` ledger.
