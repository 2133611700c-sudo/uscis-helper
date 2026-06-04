# Anti-Fabrication Gate — Canary Plan (PREPARE only; NOT executed)

**Date:** 2026-06-04. Plan only — the agent does NOT enable any flag. Owner executes via the commands
below when ready. Evidence: hard-case Ukrainian birth certs read ≈0–1/5 vs owner GT; mode C
(anti-fabrication + self-consistency) drove `false_negative_review` to 0 and caught the month error.
That proves the NEED for a forced-review gate on hard-case classes; enabling still goes through canary +
rollback + metrics (not a blind flip).

## Flag
- `ANTI_FABRICATION_GATE_ENABLED` (default OFF). Optionally `SELF_CONSISTENCY_GATE_ENABLED` (requires the
  former). `SMART_NORMALIZE_ENABLED` stays OFF (no benefit; can't fix a reading failure).

## Target document classes ONLY (not blanket)
- `birth_certificate_handwritten`, `birth_certificate_soviet_bilingual` (the confirmed hard-case allowlist).
- Passports/printed/marriage/unknown are NOT targeted — the gate already excludes them (and printed reads fine).

## Behavior when ON (already implemented + tested, currently dormant)
- Forces `review_required=true` on identity fields for the hard-case classes; never changes values; never
  lowers a flag. Self-consistency re-read flags instability → review. Model `review=false` cannot override.

## Rollout scope (canary)
1. Enable in a **preview/canary** deployment first (not full prod), or a small traffic slice if the platform
   supports it. Observe.
2. Only after the metrics below hold, enable in production.
3. The gate only RAISES review on a minority class (hard-case) — worst case is more review, never a silent
   wrong value; that bounds the downside.

## Rollback command (must be ready before enabling)
```
# disable (preferred — remove the var) then redeploy the controlled commit:
vercel env rm ANTI_FABRICATION_GATE_ENABLED production    # (and SELF_CONSISTENCY_GATE_ENABLED if set)
# redeploy main (NOT a local feature branch)
```
Rollback = flag OFF → behavior returns to byte-identical current. No data migration.

## Metrics to watch (during canary)
- `false_negative_review` (wrong identity, review=false) — **MUST stay 0**. Any > 0 → rollback/block.
- `false_positive_review` (correct field forced to review) — UX cost; track, set an acceptable ceiling.
- `review_rate_by_doc_type` — how much each class goes to review.
- `hard_case_submission_count` — how many hard-case docs actually arrive (from `document_class_metric`).
- `user_manual_correction_rate` — how often users edit the forced-review fields.
- support complaints / abandonment on the review step.

## Stop condition (hard)
- ANY critical identity field wrong WITHOUT review → immediate rollback + block (the exact harm the gate
  exists to prevent).
- Review rate so high it breaks the product UX with no safety payoff → pause, retune (or invest in a better
  Ukrainian reader / HTR — the unresolved model blocker).

## Pre-canary gates (NOT yet met)
- Owner GT batch ≥6 across categories + threshold calibration (currently N=2, BLOCKED).
- A rollback rehearsal.
- `document_class_metric` collecting in prod (flag set; emits on first real extraction).

## What this plan does NOT do
No flag enabled, no prod env change, no deploy, no model switch, no SMART/HTR, no L2-WIRE. Execution is a
separate explicit owner command after the pre-canary gates are met.
