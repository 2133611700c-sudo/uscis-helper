# Runbook 7 — Wrong recipient

## Symptoms
- A delivery went, or is about to go, to a recipient that looks wrong.
- A customer reports they did not receive their document (or someone else did).

## Safe diagnosis (PII-free)
1. The order's `verified_recipient_email` is bound ONCE at `submit-order`, taken EXCLUSIVELY
   from the verified Stripe session — never from a client field.
2. The outbox holds only an OPAQUE `recipient_ref` (sha256 of the lowercased email), never the
   raw email. Compare hashes, not addresses.
3. Audit: `translation_order_events` records `recipient_changed` with old/new recipient HASHES
   + actor + reason.

## Steps
1. Verify the bound recipient against the STRIPE session (the source of truth). If they match,
   the recipient is correct by definition.
2. If a legitimate change is needed, use the dedicated `changeRecipient` action — it requires
   an explicit confirm + reason, records the old-hash, and is independently audited. It does
   NOT read the recipient from the general edit form.
3. The new recipient must itself be verified upstream. After the change, re-deliver via the
   normal outbox path (no PDF regen).

## NEVER
- NEVER set the recipient from a client-supplied field.
- NEVER change `verified_recipient_email` by a direct row update — use `changeRecipient` so it
  is confirmed + audited.
- NEVER log or paste a raw email into the incident channel; use the hash.
