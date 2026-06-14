# STATUS (2026-06-14 — P0 env-isolation guard SHADOW-first; PR open, prod unchanged)
- P0 ENV ISOLATION GUARD IN FLIGHT (branch fix/p0-env-isolation-guard off main ca88c2b → PR to main): NEW apps/web/src/lib/env/environmentGuard.ts detects when a non-prod deploy uses the PROD Supabase project (rtfxrlountkoegsseukx) with the RLS-bypassing service-role key. Modes via ENV_ISOLATION_MODE: shadow (default; PII-free console.warn, NEVER throws) / enforce (opt-in throw) / off. Shadow-wired one-time at top of createAdminSupabaseClient() (apps/web/src/lib/supabase/admin.ts) — LOGS only, does NOT gate client creation, cannot throw there; NOT wired to prod startup. 20 tests; tsc 0 real / suite 3815 pass / build OK / content-guard 0. NO Vercel env var removed; prod behaviour UNCHANGED. Full isolation BLOCKED_EXTERNAL (owner must provision staging Supabase + Stripe test keys + test provider keys) — see docs/audit/ENV_ISOLATION_PLAN.md. PR NOT merged.
- audit branch audit/full-project-reality-2026-06-14; main==prod==02eb595 (live healthz), shadow; ledger flag OFF (/api/wizard-draft=404).
- 23 audit deliverables under docs/audit/ + artifacts/audit/project_truth.json. Synthesis: FULL_PROJECT_AUDIT_2026-06-14.md, CLAIMS_VS_REALITY.csv, RISK_REGISTER.csv, V1_COMPLETION_PLAN_V2.md.
- Verdict: legacy flows real (TPS read+payment, Translation→operator queue). Parallel V1 track (#121-#133) overclaims: ledger NOT_WIRED (orphan component), OCR cache/budget NOT_WIRED, "0 fabricated"/"3/3 readback" UNVERIFIED/PROVEN_LOCAL-via-#116, staging NOT_BUILT.
- P0: raw PII cleartext in tps_ocr_audit; no env isolation. P1: Re-Parole free-packet payment bypass; ledger NOT_WIRED; DB drift (4 V2 migrations only in #119); anti-fab gate OFF on vision; canonical override orphan.
- P0 WRITER FIX IN FLIGHT (branch fix/p0-tps-ocr-audit-pii → PR to main): tps_ocr_audit.brain_raw is now sanitized by apps/web/src/lib/tps/ocrAuditSanitize.ts at the route AND in the writer (defence in depth) — applicant values (source_value/final_value/input_raw/source_line text) dropped, technical keys kept (field/present/confidence/requires_review/inferred/has_source_line/reasons/counts). User-facing OCR result UNCHANGED. Redaction migration 20260614020000_redact_tps_ocr_audit_brain_raw_pii.sql WRITTEN, NOT applied (coordinator applies post-merge; redact-in-place + DB guard trigger). Gates: tsc 0 real / full suite pass / build OK / content-guard 0.
- NOTE: STATUS block below ("PII ledger WIRED/READY", "phases PASS", sha 62c897a) is STALE/overclaiming — see CLAIMS_VS_REALITY.csv. No runtime/env/PR119 change in this audit.

---
## Pre-audit pipeline state — 2026-06-14 (NOTE: claims below are STALE/overclaiming per the audit above; sha 62c897a is outdated, real main=prod=02eb595)

> **This file is current state ONLY.** Machine-readable **verified snapshot**: [RELEASE_STATE.yaml](RELEASE_STATE.yaml)
> (describes main at a basis SHA; CI reports `snapshot_is_stale` — it is NOT a live mirror of main).
> History: [CHANGELOG.md](CHANGELOG.md) and [docs/STATUS_ARCHIVE.md](docs/STATUS_ARCHIVE.md).
> Do not stack historical status blocks here (CI: `scripts/verify-release-state.mjs`).
> **V1 pipeline:** [V1_COMPLETION.yaml](V1_COMPLETION.yaml) · board [V1_STATUS.md](V1_STATUS.md). Phases 1–3 PASS (control plane, dark-code inventory, document registry); **active = GROUND_TRUTH_CORPUS_AND_CACHE** (phase 4). Phase-4 cache half (budget-gated OCR cache) built; ground-truth + paid benchmark remain. Benchmark run: PDF proof 3/3 PASS, recognition 0-fabricated on verified set (I-94 canonical = SAME with correct fixture). BLOCKER: Stripe TEST keys absent (only LIVE) → Stripe Test Mode E2E blocked.
> **PII ledger (crit #9):** server ledger PROVEN E2E + TPS wizard WIRED behind NEXT_PUBLIC_SERVER_LEDGER_ENABLED (default OFF, byte-identical; tsc+build green). READY, NOT verified-live. Re-Parole/Translate hydrate is inline/entangled → need refactor + browser smoke.

## Production
- **production_sha = `62c897a`** = `main` (verified live: `messenginfo.com/api/healthz`).
- Merged & deployed: PR #117 (canonical continuity/persistence), #118 (4-product carriage + product-scoped modes + 404-not-503), #120 (browser-PII containment), #121 (single source of truth: RELEASE_STATE.yaml + guard), **#122 (legacy Translation security: per-action auth + Stripe-re-verified recipient)**.
- All 4 products run the one Document Core (`readDocument → arbitrate → CanonicalDocumentResult`); canonical modes default **shadow** in code. **Live prod env modes (`CANONICAL_MODE_*`) are UNVERIFIED from the repo** — read Vercel to confirm before any enforce.

## Open / in-flight
- **PR #119** (Translation Operator Pipeline V2: canonical-bound orders, artifacts, outbox, state machine) — **OPEN, draft, FROZEN, NOT merged.** Replaces the legacy operator flow but is not in production.
- Browser PII: **containment only** (#120). `value` (localStorage, TPS/Re-Parole) and `raw_cyrillic` (sessionStorage, Translation) still persist. Full removal = Phase B (server ledger) — deferred.

## Open verification gaps (deployed but not fully runtime-proven)
- **Positive paid Translation delivery = RUNTIME_UNVERIFIED.** #122's negative/fail-closed security paths are deployed + prod-smoke-verified (admin routes 404 unauth, raw POST blocked, recipient non-submitting). A successful **hosted Stripe Test Mode** delivery end-to-end has NOT been run — verify on dedicated staging before relying on auto-delivery.

## Blockers (live in production)
- **No dedicated staging:** heavy OCR e2e runs against the production DB + paid providers.

## Next actions (agreed order)
0. **Single source of truth** (this PR) — RELEASE_STATE.yaml + STATUS hygiene.
0.5 **Legacy Translation security hotfix** — per-action auth + server-authoritative recipient (fail-closed).
1. Dedicated staging (staging Supabase + Stripe test mode + test provider keys).
1.5 Dark-code inventory (quality/Brain gates present but OFF — audit before enabling).
2. Private document registry + coverage matrix.
3. Ground-truth corpus + OCR cache (provider+model+prompt+preproc+file_sha256) + hard cost ceiling.
4. Printed-Cyrillic + image-quality benchmark.
5. Brain + dictionaries benchmark.
6. I-821/I-131/I-765 field-by-field generated-PDF proof.
7. Rebase PR #119 onto main → 8. hosted Stripe test E2E → 9. merge #119 → shadow → canary → cutover.
10. Phase B server ledger. 11. Product-scoped enforce (one product at a time). 12. P2 ops. 13. Handwriting (outside v1).

## Hard "do NOT" (standing)
Do not: add a new product · rewrite Canonical Core · enable global enforce · claim handwriting is fully recognized · treat one document as type-coverage · commit real originals/ground-truth-with-PII · keep using production as a test lab · treat test count as user-path proof · let the Brain guess unreadable values.