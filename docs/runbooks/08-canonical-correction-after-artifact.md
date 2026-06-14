# Runbook 8 — Canonical correction after artifact

## Symptoms
- An order's artifact was already generated (and possibly delivered) when a correction to the
  canonical data is needed (operator override or upstream fix).

## Safe diagnosis (PII-free)
1. Identify by order `internal_uuid` + artifact `truncated_hash`. Never open the document.
2. The existing artifact is IMMUTABLE — it must be preserved as the record of what was sent.

## Steps
1. Apply the correction through the canonical override channel (`applyOperatorOverride`,
   `source='operator_override'`, `confirmed=true`). The immutable base canonical is never
   mutated; the effective value resolves base + confirmed overrides.
2. Re-run `approveForRender`. Because the resolved canonical changed, the render produces NEW
   bytes → a NEW `artifact_version` with a NEW storage key. The OLD artifact is preserved.
3. The new version enqueues its own outbox row (new idempotency_key). This is a SUPERSESSION:
   the new artifact supersedes the old; the old is never overwritten or deleted.
4. If the old artifact was already delivered, communicate the corrected version per policy;
   the audit chain (events + override version) records the supersession.

## NEVER
- NEVER overwrite or edit the existing artifact bytes/row (immutability trigger rejects it).
- NEVER reuse the old artifact's idempotency_key for the corrected version.
- NEVER mutate the base canonical evidence/rejection reasons — corrections are overrides.
- NEVER deliver a corrected document without a new artifact version + new outbox row.
