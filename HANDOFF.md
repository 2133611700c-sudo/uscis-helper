# HANDOFF (2026-06-05)

Gates enabled in prod env. Code deployed. NO runtime event yet (0 docs processed since deploy).
Status = ENABLED_BY_ENV, not RUNTIME_VERIFIED. One controlled upload needed.
See STATUS.md for honest state. See RECOGNITION_ROADMAP for waves A-E.
Rollback: `vercel env rm ANTI_FABRICATION_GATE_ENABLED production --yes`

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
