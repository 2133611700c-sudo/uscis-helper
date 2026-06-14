# Phase 2 — Data Lifecycle & Retention

Config module: `apps/web/src/lib/translation/lifecycle.ts` (PURE planning helpers; NO
destructive migration runs here). All windows are env-configurable; defaults below.

> NO destructive production migration is shipped now. This document + the config module
> define the policy and compute deletion PLANS. A future cron/worker consumes the plans.

## Retention windows (defaults; env-overridable)

| Data class | Table / store | Default | Env var | Rationale |
|------------|---------------|---------|---------|-----------|
| Orders | `translation_orders_v2` | 365 d | `RETENTION_ORDER_DAYS` | Support/dispute window. |
| Overrides | canonical override rows | 365 d | `RETENTION_OVERRIDE_DAYS` | Operator-edit audit. |
| Artifacts (bytes) | `translation-artifacts` bucket | 90 d | `RETENTION_ARTIFACT_DAYS` | Delivered PDF availability. Bytes are immutable; expiry deletes, never overwrites. |
| Outbox | `delivery_outbox` (terminal rows) | 30 d | `RETENTION_OUTBOX_DAYS` | Delivery ledger after `delivered`/`failed`. |
| Audit / events | `translation_order_events`, `audit_log` | ~7 y (2555 d) | `RETENTION_AUDIT_DAYS` | Compliance; PII-free by construction. Kept longest. |
| Signed-URL TTL | (no store) | 600 s, cap 3600 s | `ARTIFACT_SIGNED_URL_TTL_SECONDS` | Short-lived private access. |

## Customer deletion (right-to-erasure)

`planCustomerDeletion()` computes a plan that guarantees:

1. **No orphan storage objects** — EVERY artifact `{bucket, storageKey}` for the order is
   in `storageKeysToDelete`. Storage deletion must accompany row deletion.
2. **Minimum non-PII audit stub preserved** — `{ orderId, reason: 'customer_deletion' }`.
   We keep the opaque order id + state-history hashes so we can prove what happened, with
   NO names/emails/values retained. Order/override rows are PII-purged (tombstoned), not
   silently dropped.
3. **Legal hold blocks the whole plan** — `blockedByLegalHold=true` → nothing deleted; the
   audit stub is still preserved.

## Legal hold

A held order suspends all deletion until released. `decideExpiredArtifactAccess()` lets a
legal hold KEEP an otherwise-expired artifact accessible to authorized internal review
(`legal_hold_overrides_expiry`). Hold is set out-of-band (operator/admin), never by the client.

## Expired artifact access

- Default: an expired artifact is **NOT served** (`decideExpiredArtifactAccess → allowed:false`).
- Access requires a freshly minted signed URL; an expired URL is never reusable.

## Signed URLs (private artifacts)

- `planSignedUrl()` → short-lived (default 10 min, hard cap 1 h), `isPublic:false`,
  `reusableAfterExpiry:false`.
- Private artifacts are NEVER made public. No permanent/public artifact URL is ever issued.
- After expiry, `isSignedUrlValid()` returns false; the caller must mint a new URL.

## Hard rules

- Artifacts are immutable: a correction is a NEW artifact version (runbook 8), never an
  overwrite. Expiry-deletion of old bytes is allowed only past the retention window and
  only when not under legal hold.
- Audit/event log is append-only and PII-free; it is the LAST thing deleted (or never).
- No deletion path may leave a storage object without its owning row, or a row pointing at
  deleted bytes that a customer can still be told "exists".
