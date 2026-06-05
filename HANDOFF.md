# HANDOFF (2026-06-05 — PASS_RUNTIME_VERIFIED · roadmap · GEMINI-FIRST locked)

**Gemini-first correction (this turn, docs-only follow-up PR):** removed near-term GPT-4o framing from all
roadmap docs. D1 near-term = Gemini family (top versions); second reader = provider-agnostic DISABLED slot
(GPT-4o/Claude NOT near-term); HTR research-only; no fan-out until ROI. Gated on GT breadth + owner decision.
PR #88 was already merged → this is a follow-up PR (NOT auto-merged per owner boundary). No code/flag/prod change.



**Recognition structure roadmap (docs-only, this turn):** PR #87 merged (monitoring baseline). Wrote truth map
(LIVE/PARKED/LEGACY/TARGET), target D0–D6 architecture, 10-phase build plan, and 5 copy-paste next-prompts —
see CHANGELOG. Build order: monitoring closeout → D0 quality → ReaderResult contract → OneBrain shadow → D2/D3/D4
→ Auditor; HTR/GPT-4o research only after GT from different people. No code/flag/prod change. Still a safety
wrapper, not a full brain. Next concrete agent step = Prompt B (D0 quality, flag default OFF) after monitoring is clean.



**Monitoring set up (this turn):** PR #86 merged (origin/main 08b183a). Read-only healthz workflow
`.github/workflows/prod-safety-monitor.yml` (every 6h, no secrets, self-no-ops after 2026-06-07 — delete after
window) + manual runbook `docs/reports/PROD_SAFETY_MONITORING_24H_RUNBOOK.md` (vercel logs/env, what-to-watch,
rollback policy: self-consistency first). No code/flag/env change. Next real unblock = GT from different people.

**Status: PASS_RUNTIME_VERIFIED.** prod == main == `7c6068c` (healthz ok, deploy READY). PRs #80–#85 merged.
Anti-fab gate firing is **prod-runtime-observed** (owner controlled hard-case upload: 8/10 review=true, ALL
identity protected; corroborated by logs — vision-extract 200 + metric, 0 errors) AND independently reproduced
by the agent's local real-model proof (5/5 identity forced, values unchanged, self_consistency mismatch) — the
two agree field-for-field. env flags present (`vercel env ls`); SMART absent. This is a **safety wrapper working
in prod**, NOT a full OneBrain (HTR/GPT-4o/consensus/OneBrain still NOT live, parked). **Next: monitor 24–48h**
(5xx, review_rate, self-consistency latency/cost, UI/PDF block, support). Rollback ready (env rm + redeploy,
self-consistency first if cost rises). Report: docs/reports/POST_RUNTIME_GATE_VERIFICATION.md.

--- prior (superseded) ---
Prod = `2d2a391` = origin/main (healthz verified). Review-gate fix (e298d97, PR #84) IS in prod. PRs #80–#84 merged.
Real extractions DID run in prod ~01:01–01:03 (3× vision-extract + 2× tps/ocr/extract, all 200, 0 errors in 3h)
→ `document_class_metric` emitted ×3 → **DOCUMENT_CLASS_METRICS runtime VERIFIED**; deployed safety code = no regression.
NOW CONFIRMED by agent (this turn): (1) env flags PRESENT in prod via `vercel env ls production` (CLI authed) —
ANTI_FABRICATION + SELF_CONSISTENCY + DOCUMENT_CLASS_METRICS present, SMART_NORMALIZE absent (ls shows presence
not the literal value); (2) gate FIRING proven on the identical readDocument code path locally (real Soviet birth
cert + gemini-3.1-pro + flags ON) → 5/5 identity forced review + reasons + values unchanged + self_consistency
mismatch caught. Report: docs/reports/POST_RUNTIME_GATE_VERIFICATION.md.
ONE residual (owner-only): a literal PROD HTTP hard-case extraction RESPONSE (needs a PII upload the agent won't do)
— flips gate from local-runtime-proven to prod-runtime-observed. Independent fix re-verify: tsc 0, suite 2859 passed.
See STATUS.md (Production Safety Gates table). Rollback: `vercel env rm ANTI_FABRICATION_GATE_ENABLED production --yes`

## 2026-06-04 — translation public wizard hardening

- Fixed the real public Translation Wizard gap:
  - unresolved OCR review fields could reach payment/download path in the legacy public flow
  - server `generate-pdf` did not reject unresolved OCR review fields from that payload
- Changed:
  - `apps/web/src/components/services/translation/TranslateWizard.tsx`
  - `apps/web/src/lib/translation/reviewGate.ts`
  - `apps/web/src/app/api/translation/generate-pdf/route.ts`
  - targeted tests for review gate + certifier UX
- Verified locally:
  - typecheck PASS
  - vitest PASS
  - build PASS
  - live local browser run proved `payDisabledBefore=true` with 4 OCR review flags, then `payDisabledAfter=false` after 4 explicit confirms
- Evidence: `docs/reports/TRANSLATION_REVIEW_HARDENING_2026-06-04.md`
- Exact next action:
  1. scoped commit these files
  2. deploy branch / merge
  3. rerun one production translation flow to move this fix from local-verified to prod-verified

## 2026-06-04 — target recognition scheme verification

- Added `docs/reports/TARGET_RECOGNITION_SCHEME_FILE_VERIFICATION_2026-06-04.md`.
- This is a file-by-file reconciliation of the requested D0..D6 + Auditor architecture versus the actual repository.
- Verified outcome:
  - D0 preprocess = real and live
  - parked consensus/HTR stack = real code, not the live default product spine
  - live spine = `documentFieldReader.ts` -> `geminiVisionProvider.ts` -> `arbitration.ts`
  - KMU-55 = live; gazetteer/patronymic = real but not universally active by default
  - review/PDF/audit pieces exist, but not yet as one exact shared runtime matching the target scheme
- Exact blocker:
  - the repo currently contains target docs, parked implementation, and live Gemini-core runtime at the same time
  - therefore "already exactly this scheme" is false
- Next action:
  - choose explicitly whether to migrate live runtime to the target scheme, or to revise the target scheme to match the proven live spine

## 2026-06-04 — latest audit / inventory reconciliation

- Added `docs/reports/LATEST_AUDIT_INVENTORY_RECONCILIATION_2026-06-04.md`.
- Purpose: separate fresh truth-layer reports from older partial snapshots that are now stale.
- Verified against code:
  - live reader remains `docintel/documentFieldReader.ts` with Gemini default provider
  - `ua_military_id` now exists in `docintel/documentRegistry.ts`
  - translation central-brain path remains gated, not the default spine
- Practical reading order now:
  - first trust `TARGET_RECOGNITION_SCHEME_FILE_VERIFICATION_2026-06-04.md`
  - then `ARCHITECTURE_INVENTORY_VERDICT.md`
  - then `BASELINE_MATRIX.md` and `ACCURACY_OFFON_RESULTS.md`
- Do not trust older `PROJECT_ARCHITECTURE_VERDICT.md` / `DOCUMENT_CLASS_EXTRACTION_MATRIX.md` as fully current without reconciliation.

## 2026-06-04 — critical live-door re-verify

- Added `docs/reports/CRITICAL_REVERIFY_LIVE_DOOR_2026-06-04.md`.
- Purpose: correct the overly coarse claim that several dictionary/gate pieces were "not yet in the brain".
- Verified from code:
  - `snapCity`, patronymic reconcile, authority resolve are already wired into the live `readDocument()` door
  - anti-fabrication and self-consistency are also already in `readDocument()`
  - all of the above are behavior-gated, not absent
  - `garbageGuard` is live in UI surfaces, but not server-side in `readDocument`
- Reading rule after this correction:
  - absent != flag-gated
  - parked != unreachable

## 2026-06-04 — project understanding master

- Added `docs/reports/PROJECT_UNDERSTANDING_MASTER_2026-06-04.md`.
- Purpose: establish one code-backed understanding of what this project actually is.
- Verified outcome:
  - this is not just an OCR subsystem; it is a multi-product USCIS workflow app
  - repo contains legacy TPS/product OCR, a current shared docintel/canonical spine, and a parked OneBrain/consensus target layer
  - accepted ADRs and current live code do not describe a single clean final architecture yet
- Practical implication:
  - future changes must be explicit about which architectural plane they touch
  - "brain", "core", and "central brain" are not interchangeable terms in this repo
