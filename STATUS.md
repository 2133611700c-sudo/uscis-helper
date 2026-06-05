# STATUS (2026-06-05 — honest, no overclaiming)

## Translation hardening (local fix verified, production pending deploy)

- Public Translation Wizard false-readiness gap CLOSED locally:
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
- Truth boundary: PRODUCTION NOT YET RE-VERIFIED AFTER THIS FIX.

## Production Safety Gates

| Gate | Env | Runtime Observed | Evidence |
|------|-----|-----------------|----------|
| ANTI_FABRICATION_GATE | ON (27 min ago) | **NO** (0 docs processed) | Local liveness proven, prod awaiting first event |
| SELF_CONSISTENCY_GATE | ON (20 min ago) | **NO** (0 docs processed) | Local liveness proven, prod awaiting first event |
| DOCUMENT_CLASS_METRICS | ON (16h ago) | **NO** (metric_count=0) | No extraction since deploy |
| SMART_NORMALIZE | OFF | N/A | DO_NOT_ENABLE |

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
