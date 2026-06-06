# STATUS (2026-06-06 — OCR INCIDENT / NOT TRUSTED; P0 forensic audit done)

## ✅ Containment guard built (ocrFieldSafetyGate) — pure, tested, NOT yet wired
- `lib/documentSafety/ocrFieldSafetyGate.ts`: one global guard, PII-free by construction (no value in/out),
  enforces the 10-rule contract (candidate≠final; zero-recognition≠success; source/stale/hard-case/legacy/low-conf
  → not final). + `hasUnresolvedCriticalForOutput` (shared PDF/payment gate). tsc 0; 18 guard tests; full suite
  2893 passed. Pure/unwired → prod byte-identical. **Next: wire into Translation/TPS/legacy/PDF behind
  `OCR_FIELD_SAFETY_ENABLED` (default OFF), per-flow + tests.** D0/ReaderResult/OneBrain still HELD.
<!-- P0 docs PII-scrubbed: incident identity values replaced by placeholders -->

## ⛔ Global OCR / Recognition = INCIDENT / NOT TRUSTED (2026-06-06)
Owner uploaded a birth cert → translator gave **0 results**; TPS showed a wrong/flagged patronymic (a truncated patronymic suffix)
+ many blank fields. Prior narrow PASS verdicts were per-endpoint, NOT global. **All next brain layers FROZEN**
(D0 prod / ReaderResult / OneBrain / HTR / 2nd provider / SMART / model work).
**P0 forensic audit COMPLETE (docs-only, no code changed):**
- `docs/reports/P0_OCR_FLOW_INVENTORY.md` — 6 reader paths, 4 safety regimes (Gemini-gated / DeepSeek-ungated /
  TPS-legacy-modules-ungated / gpt-4o-mini-ungated).
- `docs/reports/P0_FIELD_LIFECYCLE_MAP.md` — per-field origin/flag/final/PDF trace; where safety is lost.
- `docs/reports/P0_ROOT_CAUSE_ANALYSIS.md` — RC-1 birth `auto:false`→0 results; RC-2 wrong value shown AS value
  (candidate≠final not enforced — "a truncated patronymic"); RC-3 six paths/four regimes; RC-4 TPS multi-doc; RC-5 core→legacy fallback ungated.
- `docs/architecture/GLOBAL_OCR_FIELD_SAFETY_CONTRACT.md` — 10 binding rules.
- `docs/reports/P0_OCR_SAFETY_TEST_PLAN.md` — RED-first regression tests.
Ruled out: NOT my D0 (flag absent in prod), NOT the gates (keep values), NOT a crash (0 errors), NOT Supabase.
**Next phase:** adopt the contract → build shared `ocrFieldSafetyGate` + RED tests → only then resume D0/ReaderResult/OneBrain.

# STATUS (2026-06-05 — honest, no overclaiming)

## D0 quality/reshoot — IMPLEMENTED behind flag OFF (first real brick)
- `lib/docintel/quality/documentImageQuality.ts`: image metrics → ACCEPT / DEGRADED_REVIEW / RESHOOT_REQUIRED
  + reshoot messages. Flag `QUALITY_GATE_ENABLED` default OFF → prod byte-identical. Inert hook in translation
  vision-extract route. Blur is NEVER a fabrication signal. tsc 0; D0 16 tests; full suite 2875 passed.
- NOT enabled in prod. Next (Gate 2) = ReaderResult interface. Enabling D0 in prod = separate owner decision.

## Agent rails in place (operating contract + phase gates + D0 start pack)
- Refined: Gemini-first guardrails hardened — "Gemini-first ≠ fan-out", "HTR research ≠ implementation",
  and a Gemini top-version benchmark must precede ANY non-Gemini provider discussion.
- `docs/architecture/AGENT_OPERATING_CONTRACT.md` = the law (live vs target, autonomy boundaries, evidence
  contract, phase-gate order). `docs/reports/RECOGNITION_PHASE_GATES_CHECKLIST.md` = Gates 0–6.
- Next CODE step = D0 quality/reshoot (`docs/reports/NEXT_PROMPT_B_D0_QUALITY_RESHOOT.md`), flag default OFF,
  ONLY after clean 24–48h monitor + owner "start D0". HTR/2nd provider/OneBrain stay gated.

## Reader strategy = GEMINI-FIRST (locked 2026-06-05)
- Near-term reader work stays within the Gemini family (top versions/benchmarks). A second reader = a
  provider-agnostic DISABLED slot — GPT-4o/Claude NOT near-term; HTR research-only. No fan-out until ROI proven.
  All gated on GT breadth from different people + owner decision. (Roadmap docs corrected via follow-up PR.)

## Recognition structure roadmap accepted (docs-only; build = next, phased)
- Truth map + target D0–D6 + 10-phase build plan + 5 next-prompts written (see CHANGELOG / OWNER_QUEUE).
- Order: monitoring closeout → D0 quality → ReaderResult contract → OneBrain shadow → D2/D3/D4 → Auditor;
  HTR/GPT-4o research only AFTER GT from different people. Still a safety wrapper, NOT a full brain.

## Wave D monitoring ACTIVE (PASS_RUNTIME_VERIFIED reached; PR #86 merged)
- Read-only healthz workflow `.github/workflows/prod-safety-monitor.yml` (every 6h, no secrets, self-no-ops
  after 2026-06-07 — delete after window) + manual runbook `docs/reports/PROD_SAFETY_MONITORING_24H_RUNBOOK.md`.
- Watch 24–48h: 5xx, document_class_metric count, review_rate (incl. printed-birth-cert false positives),
  self-consistency latency/cost, UI/PDF block. Rollback: SELF_CONSISTENCY first, keep ANTI_FAB (owner-confirm).
- No new architecture (HTR/OneBrain/GPT-4o/SMART/L2-WIRE parked). Next real unblock = GT from different people.

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

## Production Safety Gates — PASS_RUNTIME_VERIFIED (2026-06-05, prod==main==7c6068c)

| Gate | Env (prod) | Firing proven | Evidence |
|------|-----|-----------------|----------|
| ANTI_FABRICATION_GATE | **present** (`vercel env ls`, set 2h ago) | **YES — prod + local agree** | owner prod-HTTP: 8/10 review=true, ALL identity protected (corroborated by logs, 0 errors); agent local real-model: 5/5 identity forced, reasons attached, values unchanged. Field-for-field match. |
| SELF_CONSISTENCY_GATE | **present** (set 1h ago) | **YES (runtime, local real-model)** | `self_consistency=mismatch` (2 reads disagreed on identity) → forced review. |
| DOCUMENT_CLASS_METRICS | **present — RUNTIME VERIFIED =1** | **YES** | multiple `[document_class_metric]` on real prod `POST /vision-extract` 200 (01:01–01:03, 02:01–02:02) |
| (extraction path) | — | **HEALTHY** | all vision-extract / tps-ocr 200; **0 error/fatal**. No regression. |
| SMART_NORMALIZE | **absent** | N/A | DO_NOT_ENABLE ✅ |

> Gate firing is now **prod-runtime-observed** (owner's controlled hard-case upload) AND independently
> reproduced by the agent's local real-model proof — the two agree field-for-field. Remaining honesty note:
> env `ls` shows presence not the literal `=1` value (metric proves its own flag `=1`; the two gate flags are
> presence + set-time + the observed firing). This is a **safety wrapper working in prod**, NOT a full OneBrain.
> Full report: `docs/reports/POST_RUNTIME_GATE_VERIFICATION.md`. **Next: monitor 24–48h.**

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
