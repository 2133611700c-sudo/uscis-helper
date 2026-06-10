# NEXT SESSION — L1 OPERATIONS KICKOFF (paste this as the first message)

Grounded by a read-only map (2026-06-10). Verified premise: **a paid 422/503 IS possible** — the
confirmed_value_guard 422, ocr_field_safety 403, persistCertification 503, and a silent email-failure all occur
AFTER the payment gate (generate-pdf line ~124). The new certifier_override 422 is pre-payment (safe). **No refund
code exists anywhere.** L1 closes this operational blind spot. REUSE existing infra — do NOT reinvent.

```
TASK: Build L1 operations layer. Reuse existing infra. TDD where logic exists.

ANTI-DRIFT: The constitution + ADR-021 are RULED. Refund TERMS are an OWNER business
decision (see Q below) — draft, do not invent. Synthetic data only; no real PII in
code/tests/logs. The generate-pdf route is the payment path — minimal surface, behind
flags, byte-identical when OFF.

REUSE (mapped 2026-06-10 — do not rebuild):
- Email: apps/web/src/lib/email/resend.ts  sendEmail()
- Owner/operator alert: apps/web/src/lib/translation/manualReview/notifications.ts
    notifyOwnerAlert() / notifyOperator()  (Resend + optional Telegram webhook
    TELEGRAM_OWNER_WEBHOOK_URL). NO Slack — use Telegram + email.
- Auto-ticket: apps/web/src/lib/translation/manualReview/createManualReviewTicket.ts
    + table public.manual_review_queue (already exists)
- Counter candidate: apps/web/src/lib/docintel/documentClassMetric.ts
    recordDocumentClassMetric (behind DOCUMENT_CLASS_METRICS_ENABLED)
- Cron pattern: .github/workflows/federal-register-monitor.yml (scheduled → Supabase → email)
- Tables: translation_quality_log, monitoring_alerts, manual_review_queue

L1 SCOPE (owner-ruled):
1. REFUND + auto-ticket on any post-payment block/failure.
   - At the post-payment failure points in generate-pdf (confirmed_value_guard 422,
     ocr_field_safety 403, persistCertification 503, email-failure), call
     createManualReviewTicket(reason='paid_request_failed_<gate>') + notifyOwnerAlert().
   - Behind REFUND_AUTOTICKET_ENABLED (default OFF → byte-identical) until measured.
   - Refund EXECUTION: see owner Q below (auto stripe.refunds.create vs ticket-only+manual).
   - Write docs/policy/REFUND_POLICY.md from the owner ruling.
2. RATE-ALERT on guard-block frequency.
   - Guard-block console logs are NOT consumed today (no log drain). Persist each block
     to a small table (pattern: translation_quality_log), then a GH-cron rate-checker
     (pattern: federal-register-monitor) alerts via notifyOwnerAlert when blocks/hour > X.
   - X: measure current baseline first (start in shadow), then set. Do NOT hardcode blind.
3. HANDWRITING-FAILURE COUNTER (HTR-threshold prerequisite).
   - Define + persist handwriting_field_failure per the constitution HTR gate condition 4:
     field critical AND gemini confidence < 0.7 AND handwritten-origin AND review_required.
   - NOTE (ADDITION C): no handwritten-origin classifier nor visual_evidence_score exists
     yet — build the minimal signal first, then the per-rolling-100-doc counter.
   - Extend documentClassMetric or a new handwriting_failure_log table. Behind a flag.

OUT OF SCOPE:
- D5 review UI
- criticality-per-doc live-swap
- enabling CERTIFIER_OVERRIDE_ENABLED
- gazetteer history
- ADR-020 / HTR itself

DEFINITION OF DONE:
- Post-payment failure points emit an auto-ticket + owner alert (behind flag); tested.
- Guard-block events persist; a rate-checker alerts over threshold (shadow baseline first).
- handwriting_field_failure defined, counted, persisted (behind flag).
- REFUND_POLICY.md written from the owner ruling.
- tsc 0, content-guard 0, full suite green. STATUS/HANDOFF/CHANGELOG updated.
```

## OWNER RULING NEEDED BEFORE L1 CODE (business decision — draft, don't invent)
**Refund execution on a post-payment failure:** which path?
- (A) **Ticket-only + manual refund** (transitional, owner refunds via Stripe dashboard) — simplest, safest, matches the owner-only-certifier transitional stance.
- (B) **Auto `stripe.refunds.create()`** on specific deterministic failures (e.g. persist 503) — faster for the user, but auto-moving money needs guardrails (idempotency, which failures qualify).
- Recommendation: **(A) now** (ticket + owner alert + manual refund), (B) later for narrow deterministic cases. Confirm.

## TEMPO RECOMMENDATION
Fresh session for L1 implementation. Reason: context is dense after the L0 build, and item 1 wires the **payment route** — the same sensitivity that warranted a fresh session for the L0 primitive. The map above makes the fresh session start from code, not assumptions.
