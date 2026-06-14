# STATUS (current — 2026-06-14)

> **This file is current state ONLY.** Machine-readable **verified snapshot**: [RELEASE_STATE.yaml](RELEASE_STATE.yaml)
> (describes main at a basis SHA; CI reports `snapshot_is_stale` — it is NOT a live mirror of main).
> History: [CHANGELOG.md](CHANGELOG.md) and [docs/STATUS_ARCHIVE.md](docs/STATUS_ARCHIVE.md).
> Do not stack historical status blocks here (CI: `scripts/verify-release-state.mjs`).
> **V1 pipeline:** [V1_COMPLETION.yaml](V1_COMPLETION.yaml) · board [V1_STATUS.md](V1_STATUS.md). Phases 1–3 PASS (control plane, dark-code inventory, document registry); **active = GROUND_TRUTH_CORPUS_AND_CACHE** (phase 4). Phase-4 cache half (budget-gated OCR cache) built; ground-truth + paid benchmark remain.

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
