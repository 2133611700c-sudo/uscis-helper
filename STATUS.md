# STATUS (2026-06-05 — honest, no overclaiming)

## Translation hardening — NOW IN PROD (verified 2026-06-05 01:43)

- ✅ **Live in prod**: PR #84 merged; `origin/main` = `2d2a391`; review-gate commit `e298d97` is an ancestor
  of main; prod `healthz` sha = `2d2a391` == main. The fix that was "local only" last entry IS now deployed.
- (history) Public Translation Wizard false-readiness gap CLOSED:
  - OCR `review_required` fields now block payment and PDF download
  - user can explicitly confirm unchanged flagged OCR values
  - `/api/translation/generate-pdf` now rejects unresolved OCR review fields from the legacy public wizard payload
- Local proof:
  - Typecheck PASS
  - Vitest PASS
  - Build PASS
  - Live local browser run on `/en/services/translate-document/start` with real booklet fixture:
    - `reviewBadgesBefore=4`
    - `confirmButtonsBefore=4`
    - `payDisabledBefore=true`
    - `reviewBadgesAfter=0`
    - `confirmButtonsAfter=0`
    - `payDisabledAfter=false`
- Evidence: `docs/reports/TRANSLATION_REVIEW_HARDENING_2026-06-04.md`
- Independent re-verify (agent, raw): tsc 0 errors; full suite **2859 passed / 4 skipped** (matches claim);
  server gate logic + wizard block + tests read and correct. Build NOT re-run by agent (tsc+suite = proxy).

## Production Safety Gates (re-verified 2026-06-05 — env + gate-firing proven)

| Gate | Env (prod) | Firing proven | Evidence |
|------|-----|-----------------|----------|
| ANTI_FABRICATION_GATE | **present** (`vercel env ls`, set 2h ago) | **YES (runtime, local real-model)** | real Soviet birth cert + gemini-3.1-pro + flag ON → 5/5 identity forced review, reasons attached, values unchanged. Prod HTTP response deferred (PII). |
| SELF_CONSISTENCY_GATE | **present** (set 1h ago) | **YES (runtime, local real-model)** | same run: `self_consistency=mismatch` (2 reads disagreed on identity) → forced review. |
| DOCUMENT_CLASS_METRICS | **present — RUNTIME VERIFIED =1** | **YES** | 3× `[document_class_metric]` on real prod `POST /vision-extract` 200 at 01:01–01:03 |
| (extraction path) | — | **HEALTHY** | 3 vision-extract + 2 tps/ocr/extract = 200; **0 error/fatal in 2–3h**. No regression. |
| SMART_NORMALIZE | **absent** | N/A | DO_NOT_ENABLE ✅ |

> Honest boundary (the one residual): env `ls` shows presence + target, NOT the literal value (`=1`); the metric
> proves its own flag `=1` at runtime, the two gate flags are presence+set-time. Gate FIRING is proven on the
> **identical `readDocument` code path** locally (real model, real hard-case, flags ON) — NOT via a prod HTTP
> response (that needs a PII upload the agent won't do). Owner upload of one hard-case doc flips this from
> *local-runtime-proven* to *prod-runtime-observed*. Full report: `docs/reports/POST_RUNTIME_GATE_VERIFICATION.md`.

## What is NOT live (do not claim otherwise)

- HTR: dead (auth 401)
- GPT-4o second reader: code exists, not in live path
- consensus.ts: dormant (gated by ONE_BRAIN_CORE)
- OneBrain/decideField: PARKED, 0 callers
- Quality signal to readDocument: not threaded

## Accuracy (measured, owner GT, N=6/1 person)

- Printed: 60-83% (live-door-scorable fields only)
- Hard-case: 25% (1/4 identity). Model Russianizes Ukrainian.
- false_negative_review mode C = 0

## Decisions (ADR-016)

- Hard-case UA = human review by policy
- PII = internal-only forever (CLOSED)
- OneBrain = PARKED until GT≥50

## Next owner action

ONE CONTROLLED UPLOAD of a hard-case document through messenginfo.com UI.
This is the ONLY way to change status from ENABLED_BY_ENV to RUNTIME_VERIFIED.

## 2026-06-04 — TARGET SCHEME FILE VERIFICATION

- Report added: `docs/reports/TARGET_RECOGNITION_SCHEME_FILE_VERIFICATION_2026-06-04.md`
- Verified file-by-file against the requested D0..D6 + Auditor scheme.
- Verdict: the scheme exists as documentation and as parked `engine/*` / `central-brain/*` code, but the live product spine is still `docintel/documentFieldReader.ts` + `geminiVisionProvider.ts` + `canonical/core/arbitration.ts`.
- Confirmed mismatch to the exact target:
  - `consensus.ts` exists but is not the live default Chief Engineer.
  - `models.ts` contains Gemini/GPT-4o/Vision readers, but not as the active multi-reader production fanout.
  - `htr.ts` exists, but HTR is not proven live and not the active reader path.
  - D0 preprocess is real, but it does not cut documents into line crops as claimed in the target scheme.
  - D2 KMU-55 is live; gazetteer/patronymic are real but partly flag-sensitive, not universally "inside the brain by default".
- Current truth:
  - target scheme documented = PASS
  - most building blocks present in repo = PASS
  - project already matches the exact target scheme in live runtime = FAIL

## 2026-06-04 — LATEST AUDIT / INVENTORY RECONCILIATION

- Report added: `docs/reports/LATEST_AUDIT_INVENTORY_RECONCILIATION_2026-06-04.md`
- Verified latest report layer against current code.
- Current trustworthy layer:
  - `TARGET_RECOGNITION_SCHEME_FILE_VERIFICATION_2026-06-04.md`
  - `ARCHITECTURE_INVENTORY_VERDICT.md`
  - `BASELINE_MATRIX.md`
  - `GT_ACCURACY_VERIFICATION.md`
  - `ACCURACY_OFFON_RESULTS.md`
  - `LIVE_DOOR_SCORABLE_COVERAGE.md`
  - `RECOGNITION_ROADMAP_FROM_CURRENT_TO_TARGET.md`
- Partially stale snapshots:
  - `PROJECT_ARCHITECTURE_VERDICT.md`
  - `DOCUMENT_CLASS_EXTRACTION_MATRIX.md`
  - parts of `KNOWLEDGE_CORE_INVENTORY.md`
- Strongest stale point confirmed by code:
  - older reports saying `ua_military_id` is absent are now false; registry entry exists in `docintel/documentRegistry.ts`
- Reconfirmed live truth:
  - default runtime spine is still `readDocument()` -> Gemini provider -> arbitration/gates
  - exact target multi-reader consensus runtime is still not live

## 2026-06-04 — CRITICAL LIVE-DOOR RE-VERIFY

- Report added: `docs/reports/CRITICAL_REVERIFY_LIVE_DOOR_2026-06-04.md`
- Correction to earlier over-broad audit wording:
  - `snapCity` IS already wired into the live door, but behind `SMART_NORMALIZE_ENABLED`
  - patronymic reconcile IS already wired into the live door, but behind `SMART_NORMALIZE_ENABLED`
  - authority resolve IS already wired into the live door, but behind `SMART_NORMALIZE_ENABLED`
  - anti-fabrication and self-consistency ARE already wired into `readDocument`, but behind flags
  - `garbageGuard` is runtime-used in UI/review surfaces, but NOT server-side in `readDocument`
- Strong corrected truth:
  - "not wired at all" was too rough for several D2 / gate components
  - more exact status = wired, but flag-gated and OFF by default

## 2026-06-04 — PROJECT UNDERSTANDING MASTER

- Report added: `docs/reports/PROJECT_UNDERSTANDING_MASTER_2026-06-04.md`
- Full-project understanding pass completed across:
  - startup truth docs (`AGENTS.md`, `STATUS.md`, `HANDOFF.md`, `SOURCE_OF_TRUTH.md`, `CHANGELOG.md`)
  - accepted ADRs
  - top-level repo structure
  - `apps/web/src/lib/*`
  - product OCR routes
- Strongest verified understanding:
  - this repo contains **three architectural eras at once**
    1. legacy TPS/product-specific pipelines
    2. current shared live `docintel` + `canonical/core` spine
    3. parked / target `central-brain` + `engine/consensus` layer
  - project understanding must distinguish these planes instead of flattening them into one claim
  - TPS merge brain (`lib/tps/centralBrain.ts`) is a separate live plane, not dead code
