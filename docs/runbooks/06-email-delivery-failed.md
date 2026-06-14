# Runbook 6 — Email delivery failed

## Symptoms
- Order in `delivery_failed`, or outbox rows aging in `retry`.
- Alert 1 (outbox oldest age) / alert 2 (delivery failure spike) elevated.

## Safe diagnosis (PII-free)
1. `delivery_failure_total{error_code}` — `email_send_failed` (Resend) vs `artifact_unavailable`
   (escalate to runbook 5).
2. `outbox_oldest_age` / `outbox_pending_count` show backlog; `attempt_count` shows retries.

## Steps
1. Transient `email_send_failed`: the worker auto-retries with exponential backoff
   (1,2,4,8,16 min) up to MAX_ATTEMPTS, then permanent → `delivery_failed`.
2. Re-drive the worker: `POST /api/internal/translation-delivery` (Bearer `CRON_SECRET`).
   It claims one due row at a time (`FOR UPDATE SKIP LOCKED`) — safe to run concurrently.
3. For a `delivery_failed` order, use the operator `retryDelivery` action: it re-arms the
   EXISTING outbox row (state→pending) and transitions back to `delivery_pending`.
4. Check Resend health and `CRON_SECRET` if everything is failing.

## NEVER
- NEVER regenerate the PDF on retry — the bytes are immutable; retry re-sends the SAME stored,
  hash-verified artifact.
- NEVER create a duplicate order or a second outbox row to "force" delivery. The outbox
  idempotency_key + claim is the exactly-once gate.
- NEVER read or log the recipient email.
