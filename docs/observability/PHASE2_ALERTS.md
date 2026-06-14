# Phase 2 — Translation Operator Pipeline V2: Alert Definitions

Status: SHADOW. Production is not enforcing. These alerts are defined so that when the
pipeline carries real traffic the on-call has explicit thresholds + auto-responses.

Source signals: the PII-safe event emitter `apps/web/src/lib/translation/observability/events.ts`
(`[phase2_event]` structured `console.info` lines, enabled by `PHASE2_EVENTS_ENABLED=1`).
All dimensions are PII-free (codes, counts, durations, opaque UUIDs, truncated hashes).

> Every alert payload and every runbook diagnosis MUST stay PII-free. Never paste a
> recipient email, document value, or raw Stripe payload into an alert channel.

| # | Alert | Signal | Threshold | Severity | Auto-response |
|---|-------|--------|-----------|----------|---------------|
| 1 | Outbox oldest age | `outbox_oldest_age` (age_seconds of oldest `pending`/`retry` row) | > 15 min | WARN; > 60 min CRITICAL | Trigger the delivery worker (`/api/internal/translation-delivery`). If still climbing → page on-call; check Resend status + `CRON_SECRET`. Runbook 6. |
| 2 | Delivery failure spike | `delivery_failure_total` rate | > 5 in 10 min OR failure:success ratio > 0.2 | CRITICAL | Pause auto-retry escalation review. Inspect `error_code` distribution (`email_send_failed` vs `artifact_unavailable`). If `artifact_unavailable` dominates → escalate to alert 3. Runbook 6. |
| 3 | Artifact hash mismatch | `artifact_hash_mismatch_total` | **> 0 (any)** | CRITICAL (paging) | BLOCK delivery for the affected order, quarantine the artifact, do NOT overwrite. Generate a NEW artifact version. Never deliver bytes whose sha ≠ stored hash. Runbook 5. |
| 4 | Operator queue age | `orders_waiting_review_age` (age_seconds, oldest non-terminal order) | > 24 h WARN; > 72 h CRITICAL | Notify operator staffing. Confirm orders are not stuck in `needs_user_clarification`. Runbook 3. |
| 5 | Webhook signature failure spike | `webhook_signature_failure_total` | > 3 in 5 min | CRITICAL | Possible secret rotation drift or forged calls. Verify `STRIPE_WEBHOOK_SECRET` matches the live endpoint secret. NEVER weaken signature verification. Runbook 2. |
| 6 | Payment succeeded but order missing | reconcile `webhook_received_total{state=checkout.session.completed}` vs `orders_created_total` | any unmatched paid session after 10 min | CRITICAL | Reconcile by checkout_session_id (idempotent `createOrGetOrder`). Re-drive `submit-order` for the session. NEVER mark-as-paid manually in prod. Runbook 1. |
| 7 | Order ready but artifact missing | order in `approved_for_render` with no `artifact_generation_total` after threshold | > 30 min | WARN; > 2 h CRITICAL | Re-run `approveForRender` (idempotent: same idempotency_key, content-addressed storage key). Check `artifact_storage_failures_total` / signer config. Runbook 4. |
| 8 | Outbox claim failures | `outbox_claim_failures_total` | > 3 in 10 min | WARN | DB/RPC availability — check `claim_outbox_event` and Supabase health. Worker backs off (breaks the drain loop). |
| 9 | Stale version conflicts | `stale_version_conflicts_total` | sustained > 10/min | WARN | Usually benign (operator double-tab); a sustained spike implies a UI not refreshing version. No data action. |
| 10 | Operator auth denied spike | `operator_auth_denied_total` | > 10 in 5 min | WARN | Possible misconfigured `ADMIN_SECRET` or probing. Verify operator cookie/secret. Fail-closed is correct behavior. |

## Gauge signals (poll, not edge-triggered)

| Gauge | Event | Notes |
|-------|-------|-------|
| Queue depth | `operator_queue_depth` | non-terminal order count |
| Outbox pending | `outbox_pending_count` | rows in `pending`/`retry` |
| Webhook amount/price mismatch | `webhook_amount_mismatch_total`, `webhook_price_mismatch_total` | DEFINED but not yet wired into the legacy webhook (V2 payment coupling is owner-side). Any non-zero = CRITICAL: a paid amount/price that does not match the expected product. NEVER trust client `paid=true`. |
| Payment→order latency | `payment_to_order_latency` (duration_bucket) | DEFINED; wire when V2 webhook→order linkage lands. `gte5m` bucket spike = investigate. |

## Escalation order

1. Auto-response (re-drive worker / re-run idempotent action).
2. If unresolved in one cycle → page on-call.
3. CRITICAL data-integrity (alert 3 hash mismatch, alert 6 paid-no-order) → page immediately, do NOT wait a cycle.

## Hard prohibitions during incident response

- No production mark-as-paid; no manual prod order-status change; no fake webhook in prod.
- No weakening of Stripe signature verification.
- Recipient is ALWAYS Stripe-derived, NEVER from the client.
- Artifacts are immutable: corrections create a NEW version; never overwrite/quarantine-delete the certified bytes.
