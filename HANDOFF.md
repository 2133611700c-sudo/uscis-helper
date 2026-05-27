# HANDOFF — Session 32 (2026-05-26)

## Province false-positive triple-fix (latest — this commit)

### What was fixed
Three separate bugs causing `province_of_birth` to be falsely flagged as hallucination risk after Central Brain normalization:

1. **Oblast regex corruption** (`packages/knowledge/src/dictionary.ts` — committed `727e6ea`):
   - Old: `/\s*(області|обл\.?)\s*/gi` — `обл\.?` matched `обл` as a prefix of `область`, corrupting "вінницька**область**" → "вінницька**асть**" (not found in dictionary).
   - Fix: `/\s*(областей?|обл(?:асть|асті|\.?))\s*/gi` — anchored alternation, whole-word match only.

2. **Double "Oblast" in normalizeProvince** (`apps/web/src/lib/tps/dictionaryBridge.ts`):
   - Old: `` value: `${result.transliterated} Oblast` `` — `result.transliterated` already contains "Oblast" (e.g. "Vinnytsia Oblast"), producing "Vinnytsia Oblast Oblast".
   - Fix: `value: result.transliterated` directly.

3. **English "X Oblast" false-positive in checkGeography** (`apps/web/src/lib/tps/hallucinationGuard.ts`):
   - Old: After normalization produced English "Vinnytsia Oblast", `checkGeography` ran `normalizeOblastToNominative()` on Latin text → returned null → flagged as `unknown-province` risk=high.
   - Fix: Added early-return for strings matching `/^[A-Za-z][A-Za-z\s\-]*\s+Oblast$/i` before the Cyrillic dictionary check.

### Verified
- `pnpm --filter web test`: 2019/2019 pass.
- `npx tsc --noEmit -p apps/web/tsconfig.json`: 0 errors.
- Knowledge package tests: 6 oblast regression cases all pass.

### Exact next task
1. ~~Verify production API after push~~ — done, SHA `d76345a` live.
2. ~~P2: DOB fixture proof~~ — done, `passportBooklet.dob.test.ts` 14/14 pass.
3. ~~P3: Add direct Playwright network capture~~ — done, brain-merge-summary.json + brain-merge-network.json artifacts, structural assertions on response.
4. P4: Translation Bridge v0.

---

## What was requested
- Build Central Brain: 5 new files + 2 test files.
- Fix 4 failing tests in hallucinationGuard and centralBrain test suites.

## What changed (this commit)
- New files:
  - `apps/web/src/lib/tps/sourcePriority.ts` — SlottedField, toExtractedCandidate, hasControllingLatinSpelling, slotToSourceDoc.
  - `apps/web/src/lib/tps/hallucinationGuard.ts` — detectGarbageString, checkGeography, crossDocumentConflict, guardField, crossValidateField.
  - `apps/web/src/lib/tps/dictionaryBridge.ts` — normalize() bridging @uscis-helper/knowledge + translation engine.
  - `apps/web/src/lib/tps/centralBrain.ts` — mergeToCentralBrain() server-side coordinator.
  - `apps/web/src/app/api/tps/brain/merge/route.ts` — POST /api/tps/brain/merge endpoint.
  - `apps/web/src/lib/tps/__tests__/centralBrain.test.ts` — 7 integration tests.
  - `apps/web/src/lib/tps/__tests__/hallucinationGuard.test.ts` — 9 unit tests.
- Bug fixes in hallucinationGuard.ts:
  - Removed overly-broad GARBAGE_PATTERN `/^[^letters]+$/` that blocked dob ('1990-03-15') and a_number ('123456789').
  - Replaced `NAME_FIELDS` import (booklet field names) with local `TPS_NAME_FIELDS` set ('family_name', 'given_name', 'middle_name') — fixes isPlausibleName check running for TPS fields.
- Bug fix in centralBrain.test.ts: added required TpsExtractedField properties to test helper (bbox, language_layer, review_required, ocr_word_ids, passes, failures, user_corrected).

## What was verified
- Typecheck: 0 errors.
- Unit tests: 2016/2016 pass (22 new tests added).

## What was NOT done
- Integration of Central Brain into TPSWizardV2 (replace useMemo merge with /api/tps/brain/merge call).
- dictionaryBridge.ts unit tests (normalizeProvince, normalizeCity, normalizeIssuedBy).
- sourcePriority.ts unit tests.

## Session 32 integration (complete)
- `TPSWizardV2.tsx` calls `POST /api/tps/brain/merge` after each OCR upload.
- `mergedFields` useMemo: Central Brain is primary, fieldArbiter is explicit DEGRADED fallback.
- Oblast regex fix: `normalizeOblastToNominative()` now accepts nominative full forms.
- Post-deploy evidence collected (see CHANGELOG).

## Exact next task
1. Push (oblast fix) → verify production API: `province_of_birth` no longer flagged as hallucination.
2. P2: DOB fixture proof — need booklet image where handwritten date is visible.
3. P3: Add direct Playwright network capture for `/api/tps/brain/merge` call.
4. P4: Translation Bridge v0 (Ukrainian booklet → English draft → review → certification-ready).

## Key contradiction resolved (from audit)
- Prior session analysis claimed `dob` was simultaneously `validated_skipped` AND `FORBIDDEN_FIELD_FOR_DOCUMENT_SLOT`.
  This is TRUE for the old production code (pre-this-commit). The current commit fixes BOTH layers:
  the parser (validates Ukrainian dates) AND the contract (allows dob for booklet).
- `provenance.ts` bug was real: `toSourceDocType('booklet')` fell through to default→`user_manual`.
  This made all booklet OCR fields appear as `user_manual` even when OCR extracted them correctly.
  Fixed: explicit `case 'booklet': return 'booklet'`.

## Architecture gap documented (do not ignore)
Per CENTRAL_BRAIN_SPEC_2026-05-24.docx:
- Translation Engine v5.0 has PacketIdentityAnchor, glossary, validators, correctionClassifier.
- TPS Pipeline has its OWN parallel dictionary, wizard merge (useMemo), normalizer.
- They do NOT communicate.
- No plausibility guard, no hallucination detection, no cross-document validation.
- Live accuracy ~35% on booklet+EAD (vs claimed 94.4% in spec).
- Central Brain = the coordinator that bridges both systems.

## Exact next operator action
1. Push this commit: `git push origin main`.
2. Monitor Vercel: `vercel ls` → wait for new SHA `Ready`.
3. Run headed e2e: `cd apps/web && npx playwright test tests/e2e/booklet-only-pdf-proof.spec.ts --headed`.
4. Check `test-results/booklet-only-pdf-proof-artifacts/provenance-proof.json`:
   - `family_name: "booklet"` ← REQUIRED
   - `dob: "booklet"` ← confirms DOB patch active on production
5. Run ZIP/PDF readback: unzip + pdftotext → confirm `REDACTED`, `Trostianets`, `Serhiiovych`.
6. If all pass → status = PASS → begin Central Brain Phase 1.
7. If `dob` still `user_manual` → DOB patch not deploying correctly → investigate route.ts or Brain cache.

## Central Brain - next phase
Files to create (per CENTRAL_BRAIN_SPEC):
- `apps/web/src/lib/tps/centralBrain.ts` (1-2 days)
- `apps/web/src/lib/tps/hallucinationGuard.ts` (1 day)
- `apps/web/src/lib/tps/dictionaryBridge.ts` (0.5 days)
- `apps/web/src/lib/tps/sourcePriority.ts`
- `apps/web/src/app/api/tps/brain/merge/route.ts`
Priority: plausibility guard first (stops garbage like `BiRHEROI` silently passing).

---

# HANDOFF — Session 18 (2026-05-25)

## Session 30 (2026-05-26) — strict booklet-only blocker isolated

### What was requested
- Isolate exact strict booklet-only blocker for `family_name/dob/passport_number` without weakening logic.

### What changed
- Narrow test timing fix in `apps/web/tests/e2e/booklet-only-pdf-proof.spec.ts`:
  - wait for successful `POST /api/tps/ocr/extract` after booklet upload before moving forward.

### What was verified
- OCR now definitely runs in strict test and returns booklet fields:
  - `final_field_keys`: `city_of_birth`, `family_name`, `middle_name`, `province_of_birth`.
- Step5 proof:
  - `family_name` and `middle_name` visible from extracted data.
- Step6 proof:
  - remaining required fields reduced to exactly:
    - `Date of birth`
    - `Passport number`
  - `family_name` no longer a blocker.

### Root-cause classification
- `family_name` blocker: resolved (was test race + previously provenance adapter issue).
- `dob` blocker: production runtime still old behavior (dob omitted from final fields).
- `passport_number` blocker: expected contract behavior (`booklet` forbids it) + `isMinimallyComplete` requires it for packet generation.

### Safety/Scope
- No deploy, no push, no commit.
- No validation weakening.
- No fake provenance assignment.

### Exact next operator action
1. Execute strict proof on runtime containing DOB patch.
2. Keep booklet proof fields unedited.
3. If only passport remains missing, allow manual passport as `MANUAL_GATING_ONLY`.
4. Require payload evidence: `_provenance.family_name.source_document_type = booklet`.
5. Then perform ZIP/PDF readback from that same run.

## Session 29 (2026-05-26) — provenance-strict booklet-only proof attempt

### What was requested
- Build a strict booklet-only evidence path where OCR-derived fields keep booklet provenance (not `user_manual`).

### What changed
- Product-level provenance adapter fix (minimal):
  - `apps/web/src/lib/tps/provenance.ts`
  - added `booklet` to `SourceDocumentType`
  - mapped `doc_slot='booklet'` to `source_document_type='booklet'`
- Added provenance regression test:
  - `apps/web/src/lib/tps/__tests__/provenance.test.ts`
- Tightened strict e2e test:
  - `apps/web/tests/e2e/booklet-only-pdf-proof.spec.ts`
  - removed manual edits for OCR-proof fields (`family_name`, `city/province/middle`, `dob`)
  - added strict provenance assertions in generate payload.

### What was verified
- Unit tests pass:
  - `documentBrain.test.ts`
  - `documentContracts.test.ts`
  - `provenance.test.ts`
  - run output: `59 files / 1994 tests` passed.
- Strict headed e2e reaches Step 6 but cannot render generate CTA.
- Step 6 snapshot evidence: `Required fields remaining: 3`
  - `Family name`, `Date of birth`, `Passport number`.
- Headless run remains environment-blocked (`MachPortRendezvousServer Permission denied`).

### DOB status in this session
- Code-level replay on patched modules confirms:
  - `25 червня 1986 року` -> `06/25/1986` at Brain validation,
  - post-normalization keeps value valid,
  - booklet contract accepts `dob`.
- Local endpoint proof still blocked (`Server action not found`, prior `EMFILE` watcher errors).

### Critical truth
- The prior `user_manual` provenance issue was real and fixed at adapter level.
- Strict no-manual-overwrite runtime proof is still blocked by current required-field gaps in booklet-only production flow.

### Exact next task
1. Resolve local runtime endpoint blocker (read-only diagnosis already captured).
2. Re-run strict booklet-only e2e against patched runtime.
3. Require payload proof:
   - `_provenance.family_name.source_document_type === 'booklet'`
4. Then perform ZIP/PDF readback from that strict run only.

## Session 28 (2026-05-26) — booklet-only production-proof step (zero-trust)

### What was requested
- Prove booklet-only runtime chain to ZIP/PDF with readback and provenance.
- Verify DOB patch in live/local endpoint path.

### What changed
- Narrow test-only edit in:
  - `apps/web/tests/e2e/booklet-only-pdf-proof.spec.ts`
- Fix details:
  - switched Step3 to `Yes Add I-765` so packet must include `I-765.pdf`.
  - corrected stale row labels used by inline edit:
    - `Date of last entry to the US` -> `US entry date`
    - `Status at last entry` -> `Status at entry`

### What was verified
- Unit tests (DOB + contract suites): pass (`59 files / 1993 tests` in run output).
- Headed Playwright booklet-only run: pass, ZIP generated.
- ZIP readback:
  - files present: `I-821.pdf`, `I-765.pdf`, `INSTRUCTION.txt`
  - text contains: `REDACTED`, `Trostianets`, `Vinnytsia Oblast`, `Serhiiovych`.
- Root cause of original generate failure is confirmed from step snapshot:
  - required field `US entry date` remained missing -> `isStep6Eligible=false` -> no `tps-generate-cta`.

### What failed / blocked
- Headless `--reporter=list` run fails in this environment with Chromium launch fatal:
  - `MachPortRendezvousServer ... Permission denied (1100)`.
- Local patched API endpoint proof for DOB is blocked:
  - local `/api/tps/ocr/extract` returns `Server action not found`,
  - dev logs show repeated `EMFILE` watch errors.

### Critical truth for provenance
- Current booklet-only proof run does **not** prove booklet-origin values in generate payload:
  - `_provenance.family_name.source_document_type = user_manual`
  - same for `city_of_birth`, `province_of_birth`, `middle_name`.
- This means PDF values are present, but origin is manual in the submitted payload.

### Exact next task
1. Create a provenance-strict booklet-only e2e variant:
   - do not edit `family_name/city_of_birth/province_of_birth/middle_name`,
   - satisfy only gate-required fields outside booklet scope.
2. Require assertion on `generate-network.json`:
   - `_provenance.family_name.source_document_type` must be booklet-derived.
3. Re-run ZIP/PDF readback and keep sanitized artifacts only.

## Session 27 (2026-05-26) — repository hygiene policy for evidence artifacts

### What changed
- Updated root `.gitignore` with explicit guardrails for generated test outputs and sensitive-by-default raw evidence artifacts.
- Added `docs/reports/retention-policy.md` with operational rules for:
  - track vs ignore decisions,
  - archive-outside-git guidance,
  - PII/OCR/document handling boundaries,
  - promotion workflow from local artifact to sanitized tracked evidence.
- Updated `STATUS.md` and `CHANGELOG.md` to record verified scope, risk, and next checks.

### What was intentionally preserved
- No app/runtime source files changed.
- No production logic changed.
- No manual deployment or environment mutation performed.
- Existing local evidence files were not deleted or moved.

### Operator guidance (next session)
1. Push this docs-only commit through normal guard flow.
2. Verify post-push:
   - `gh run list --limit 10`
   - `Session Docs Guard` status for new run
   - `Content & Brand Guards` status
   - `vercel ls` (confirm latest production remains `Ready` or no relevant deploy trigger)
3. If a guard fails:
   - inspect failing run logs first,
   - patch only required docs/policy deltas,
   - avoid touching app/runtime code unless a separate product issue is explicitly opened.

### Evidence expectation
- Continue storing raw operational evidence locally or external archive by policy.
- Track only sanitized decision-grade summaries in git.
- No DONE/PASS claim without command/output evidence.

## Session 26 (2026-05-26) — persisted MacBook workstation execution policy

### What changed
- Added a permanent workstation/tool-use policy section to `AGENTS.md` so future operators can use this MacBook as a full engineering workstation when needed.
- Updated `STATUS.md` and `CHANGELOG.md` to record the policy persistence and scope.

### Operational expectation for next operators
- Use CLI-first when sufficient, and use browser/app-level verification when the task requires live UI, deployment, production, or visual confirmation.
- Prefer evidence-bearing workflows (logs, screenshots, run IDs, URLs, statuses) over assumption-based reporting.
- Keep safety boundaries strict: explicit owner approval is required for destructive or high-impact operations.

### Scope safety
- No app code changed.
- No runtime/product behavior changed.
- No manual deploy required.
- No push performed in this task step.

### Next action
- Push this docs commit normally when approved, then continue future tasks under the persisted workstation/tool-use policy.

## Session 25 (2026-05-26) — guard-compliant post-push documentation repair

### What changed
- Updated session docs to record verified post-push state with operational detail:
  - `STATUS.md`: current CI/Vercel truth, root cause, risk, and exact re-check sequence.
  - `HANDOFF.md`: operator instructions and decision path for the next push verification cycle.
  - `CHANGELOG.md`: append-only evidence entry with GitHub run IDs and Vercel result.

### Why this was required
- Previous docs commit `1ed8a77` changed `AGENTS.md` + `CHANGELOG.md` without `STATUS.md` + `HANDOFF.md`.
- Repo guard (`Session Docs Guard`) validates each commit in the pushed range, so it failed on `1ed8a77` even though `d9e31a6` was later compliant.
- This commit creates a clean, guard-compliant docs update to be pushed as a fresh range.

### Verified facts used in this handoff
- `Session Docs Guard` run `26461533247`: `failed`; log explicitly identifies missing docs in commit `1ed8a77`.
- `Content & Brand Guards` run `26461533323`: `success`.
- Latest Vercel production deployment: `Ready` (`uscis-helper-k67x575l7-...`).

### Scope safety
- No app code changed.
- No runtime/product logic changed.
- No manual deploy required.
- No push performed in this task step.

### Next operator action
1. Push this commit normally to `origin/main`.
2. Re-check GitHub runs:
   - `gh run list --limit 10`
   - `gh run view <new Session Docs Guard run> --log`
3. Re-check Vercel:
   - `vercel ls`
4. If `Session Docs Guard` still fails:
   - inspect the new failing run log first,
   - do not edit code blindly before confirming exact failing commit/range and missing file list.

## Session 22 (2026-05-25) — deployed patchset for runtime blockers

### What shipped
1. Step6 runtime now renders `PacketCompletenessChecker` in wizard v2:
   - file: `apps/web/src/app/[locale]/services/tps-ukraine/start/TPSWizardV2.tsx`
   - verified effect: H.R.1 fee warning appears in Step6 UI for EN/RU/UK/ES.
2. Booklet city guard hardened:
   - file: `apps/web/src/lib/tps/ocr/postExtractNormalize.ts`
   - effect: English settlement descriptors (`urban-type settlement` / `settlement`) are rejected/manual.
3. Booklet DOB weak-path cleanup:
   - file: `apps/web/src/app/api/tps/ocr/extract/route.ts`
   - effect: dual crossref no longer maps `date_of_birth -> dob` for booklet; prevents noisy DOB auto-fill attempts.
4. Regression test:
   - file: `apps/web/src/lib/tps/__tests__/postExtractNormalize.test.ts`
   - new case: rejects `Prostianets settlement`.

### Verification done
- `pnpm --filter web typecheck` passed.
- `pnpm --filter web test -- src/lib/tps/__tests__/postExtractNormalize.test.ts` passed (`1988/1988`).
- drift gate green+red rerun passed (`red_exit=1`, `green_exit=0`).
- live SHA confirmed: `692619ca62d47ecb8d3b23a10cf4b137b1351230`.
- Playwright production E2E rerun passed with ZIP output (`phase22_booklet_review_artifacts`).
- Step6 H.R.1 locale proof captured for EN/RU/UK/ES (`phase22_hr1_locale_results.json`).
- synthetic `booklet_0` vs `booklet_270` rerun captured (`phase22_synthetic_270_summary.json`) — both returned `Trostianets`.
- fresh Supabase audit rows captured (`phase22_recent_audit_rows.json`) with `has_brain_raw=true`.

### Still open
- owner-mode OTP full-chain remains `BLOCKED` without live OTP input.
- full mandatory matrix coverage (all owner/normal mobile/desktop rows with generate+ZIP+PDF) remains `UNVERIFIED`.
- multi-identity real booklet pack benchmark remains `UNVERIFIED`.

## Session 21 (2026-05-25) — finish-all truth-chain execution

### Final evidence bundle (single source)
- `docs/reports/evidence/finish-all-20260525-183306/`
- Final report: `docs/reports/evidence/finish-all-20260525-183306/FINAL_RUNTIME_TRUTH_REPORT.md`

### What is now VERIFIED
1. Live SHA lock held start→end (`3ec6920...`) with ledger proof.
2. Drift gate v2 still works (green pass + synthetic red fail + clean restore).
3. Logging enhancement is live end-to-end:
   - migration present remotely,
   - fresh `tps_ocr_audit` rows contain `brain_raw` and `rejected_fields` array.
4. Production E2E path for EN `initial+paper+EAD yes`:
   - upload→OCR→review→gate→generate→ZIP→PDF confirmed.
5. Runtime slot matrix (normal mode):
   - EN/RU, desktop/mobile, all 4 required scenarios have verified Step4 slots.
6. DocAI readiness independently verified:
   - processor enabled,
   - real `:process` call success.

### Critical failures detected this session
- H.R.1 runtime drift:
  - wizard Step6 UI (EN/RU/UK/ES) did not show expected H.R.1 strings,
  - generated `INSTRUCTION.txt` did contain H.R.1 notices.
- Booklet DOB reliability remains broken (`NOT_FOUND` in canonical 5/5).
- Synthetic rotation robustness issue remains (270° city drift).

### BLOCKED / UNVERIFIED
- Owner-mode full proof is blocked at OTP verification step:
  - `/api/owner/request-code` returns 200, but code confirmation was not completed in-session.
- Full end-to-end matrix for every row (all generate/ZIP/PDF combinations) remains unverified.
- Multi-identity real-sample benchmark remains unverified (one real canonical identity used + synthetic transforms).

## Session 20 (2026-05-25) — independent completion pass for items 1..6

### What was re-verified live
1. Drift gate v2 is operational:
   - green: `node scripts/check-booklet-contract-drift.mjs` exit 0
   - synthetic red: removing `'dual_ocr_crossref'` from `TpsExtractionSource` triggers exit 1 with explicit diagnostics.
2. Audit logging migration is live and writing:
   - remote migration includes `20260526000001_tps_ocr_audit_brain_raw`
   - latest rows have `brain_raw != null`
   - latest rows store `rejected_fields` as JSON array.
3. Playwright E2E against production passed:
   - `npx playwright test tests/e2e/booklet-review.spec.ts --reporter=list`
   - run generated a real ZIP and two PDFs.
4. H.R.1 output text proof:
   - generated `INSTRUCTION.txt` includes H.R.1 fee/EAD-validity notices (effective 2026-05-29).
5. Booklet benchmark rerun:
   - 5/5 canonical runs stable on 4 fields, but `dob` missing in all 5
   - synthetic rotation run found city drift at 270° (`Prostianets`).

### New engineering change done this session
- `TPSWizardV2` contract drift surface reduced:
  - removed manual slot whitelist copy
  - now derives `SLOT_ALLOWED_FIELDS` from `DOCUMENT_CONTRACTS`
  - `ExtractionSource` now aliases shared `TpsExtractionSource`.
- `scripts/check-booklet-contract-drift.mjs` updated to support both:
  - legacy literal mode
  - new contract-derived mode + type alias mode.

### Evidence created this session
- E2E artifacts:
  - `apps/web/test-results/booklet-review-artifacts/step5-review.png`
  - `apps/web/test-results/booklet-review-artifacts/step6-generated.png`
  - `apps/web/test-results/booklet-review-artifacts/tps-packet.zip`
  - `apps/web/test-results/booklet-review-artifacts/unzipped/I-821.txt`
  - `apps/web/test-results/booklet-review-artifacts/unzipped/I-765.txt`
  - `apps/web/test-results/booklet-review-artifacts/unzipped/INSTRUCTION.txt`
- Benchmarks:
  - `reports/booklet-stability-20260525-182233/results.csv`
  - `reports/booklet-synthetic-multisample-20260525-182452.csv`

### Open after Session 20
- Booklet `dob` extraction remains unreliable (`NOT_FOUND` in 5/5 canonical rerun).
- Synthetic rotation reveals weak city robustness (`Prostianets` at 270°).
- RU/UK/ES runtime proof for H.R.1 copy is still unverified this session.

## Session 19 (2026-05-26) — hard facts only

### Completed
1. Playwright production E2E implemented and passing:
   - `apps/web/playwright.config.ts`
   - `apps/web/tests/e2e/booklet-review.spec.ts`
   - Flow covers upload → OCR CTA → Step 5 review → Step 6 generate → ZIP download.
2. Real ZIP/PDF proof captured:
   - ZIP: `apps/web/test-results/booklet-review-artifacts/tps-packet.zip` (non-empty)
   - PDF text extraction done with `pdftotext`; grep proof in `.../unzip/pdf-grep.txt`.
3. Audit logging wiring implemented:
   - `apps/web/src/lib/tps/ocrAudit.ts`: adds `brain_raw` payload + migration-safe fallback insert path when column absent.
   - `apps/web/src/app/api/tps/ocr/extract/route.ts`: builds/passes structured `brain_raw` diagnostics (emitted fields, validated_skipped, normalization diagnostics, reject metadata).
4. Migration path hardened and pushed to remote DB:
   - `supabase/migrations/20260525000002_tps_ocr_audit.sql`: policy creation made idempotent.
   - `supabase/migrations/20260526000001_tps_ocr_audit_brain_raw.sql`: applied remotely.
   - `supabase migration list` now shows local/remote synced through `20260526000001`.
5. New tests:
   - `apps/web/src/lib/tps/__tests__/ocrAudit.test.ts` (brain_raw write + fallback retry coverage).

### Verified commands (this session)
- `npx playwright test tests/e2e/booklet-review.spec.ts --reporter=list` → pass.
- `pnpm --filter web typecheck` → pass.
- `pnpm --filter web test -- src/lib/tps/__tests__/ocrAudit.test.ts ...` → pass (1987 tests total in run output).
- `node scripts/check-booklet-contract-drift.mjs` → pass.
- `supabase db push` → applied pending migrations (including `brain_raw`).

### Live truth right now
- Live app SHA is `2d0a626584925b88657381f32cad5793d7ab8da5`.
- Supabase live `tps_ocr_audit` is receiving fresh rows.
- New post-deploy rows (`2026-05-26 01:08:30..01:08:44+00`) show:
  - `brain_raw IS NOT NULL = true`
  - `rejected_fields` type = `array`
  - `validated_skipped_count` and `normalization_diag_count` populated in `brain_raw`.
- Pre-deploy historical rows still have legacy shape (`brain_raw` null + `rejected_fields` string scalar).

### Not closed yet (why not PASS)
- In verified production E2E runs, booklet `city/province/middle` auto-fill flags are still false; only surname + core identity/address fields are proven in generated PDFs.
- Because this mission required stable booklet OCR→review parity for those weak fields, overall status remains `DEGRADED`.

## What was done

### 1. Killed the client-side whitelist drift that ate `family_name` (commit 794b86d, prod live)
The server contract for booklet (`documentContracts.booklet.allowed_fields`) already included `family_name` in commit `ce12446`. The wizard client did not. Three independent filters silently dropped the field before it reached Step 5 review. This commit updates those filters and extends the source-type unions so the server-emitted `dual_ocr_crossref` source survives the wire.

### 2. Wired a CI drift gate so the same bug pattern can't ship again (commit 8bce911, pushed)
`scripts/check-booklet-contract-drift.mjs` parses the three set literals at CI time and fails the workflow if they don't match. Added to `.github/workflows/guards.yml` between typecheck and build.

### 3. Wrote evidence report on what blocks dob and given_name (commit pending push)
`reports/BOOKLET_PIPELINE_EVIDENCE_REPORT_20260525.md` — analysis of 28 stability runs. Distinguishes contract failures from validation failures from OCR failures. Key findings:
- `dob`: brain emits unparseable format in 28/28 runs. Fixable via prompt/parser improvement + multi-sample benchmark + contract relaxation.
- `given_name`: raw OCR garbage on the canonical sample (`"Behri"` from Cyrillic `В` misread as Latin `B`). Both Vision and DocAI fail the same zone. Manual entry is the honest path.

This is the foundation for any future "relax the booklet contract" conversation. Don't have it without re-reading the report.

### 4. Corrected evidence-report formulation after external review (commit pending push)
External reader (vendor-strategy note) caught two too-absolute claims in the evidence report. The `given_name` section was titled "structural OCR limitation, not a contract issue" and concluded "not fixable from this sample" — both phrasings drift from "Vision+DocAI failed on our N=1 sample" to "OCR cannot do this".

Added to the report:
- A global evidence-classification rule (*officially claimed* / *verified on our data* / *not verified*) applied to every provider-capability claim.
- Explicit acknowledgement that Azure Read and Yandex Vision were never benchmarked on Cyrillic handwritten booklets and could behave differently.
- Image preprocessing + region cropping as a fourth investigation path (cheap, untried).
- A "do not write absolute claims about provider capability based on N=1 sample" rule under "What you should NOT do".

No code change. This is correcting the analytical record. Same lesson as Session 17's post-mortem, applied to vendor framing instead of pipeline framing: don't generalize from one sample to a capability claim.

### Files changed (this commit)
- `reports/BOOKLET_PIPELINE_EVIDENCE_REPORT_20260525.md`
- `STATUS.md`, `HANDOFF.md`, `CHANGELOG.md`

### 5. Extended drift gate to cover source-type union drift — third leg of Session 17 bug (commit pending push)
`scripts/check-booklet-contract-drift.mjs` v2 now also parses every `extraction_source: '...'` literal from `route.ts` and asserts each value appears in all three client unions (`TpsExtractionSource` in `types.ts`, local `ExtractionSource` in `TPSWizardV2.tsx`, `SourceType` in `fieldArbiter.ts`).

Server currently emits 3 sources: `ai_brain`, `dual_ocr_crossref`, `ocr_mrz`. All 3 are members of all 3 unions → green. Synthetic test: removed `dual_ocr_crossref` from `types.ts` copy → gate fires with exact diagnostic `"TpsExtractionSource (lib/tps/types.ts) missing server-emitted sources: ['dual_ocr_crossref']"` and exit 1.

Observation surfaced: `TpsExtractionSource` (shared) and local `ExtractionSource` in TPSWizardV2 are byte-for-byte identical duplicates. Should be consolidated via import.

Honest scope of gate v2: still does NOT check `fieldArbiter` priority-map keys (`booklet_dual_ocr_crossref` style compound keys). Server doesn't currently emit any uncovered combo, so the risk is theoretical; filed as follow-up.

### Files changed (this commit)
- `scripts/check-booklet-contract-drift.mjs` (added source-type union check section)
- `STATUS.md`, `HANDOFF.md`, `CHANGELOG.md`

### Files changed (all five commits this session)
- `apps/web/src/app/[locale]/services/tps-ukraine/start/TPSWizardV2.tsx`
- `apps/web/src/lib/tps/fieldArbiter.ts`
- `scripts/wizard-simulation-test.mjs` (regression script the predecessor wrote)
- `scripts/check-booklet-contract-drift.mjs` (new: CI gate)
- `.github/workflows/guards.yml` (new step wired)
- `STATUS.md`, `HANDOFF.md`, `CHANGELOG.md`
- `reports/booklet-stability-20260525-*` (10 stability runs)
- `daily-briefing-2026-05-25.md`

### Verification done
- `pnpm typecheck` (apps/web): clean.
- `pnpm test` (apps/web vitest): 1985/1985 in 12s.
- Drift gate green locally: all three sets equal at `[city_of_birth, family_name, middle_name, province_of_birth]`.
- Synthetic drift check: regex correctly extracts a renamed identifier; set diff would fire.
- Vercel deploy of `794b86d`: state READY.
- Prod regression check: `node scripts/wizard-simulation-test.mjs https://messenginfo.com` returned 4/4 fields surfacing with `dual_ocr_crossref` source.

### Verification NOT done
- **No browser-level Step 5 walk.** No Playwright. No screenshot of the actual Step 5 review screen with the surname populated. The simulation script mirrors the client filter — it does not exercise the deployed JS bundle, localStorage hydration, or PDF generation.
- **No PDF byte-grep.** The downloaded I-821 / I-765 PDFs have not been inspected to confirm `REDACTED` actually lands in the right form fields.
- These are the proper-E2E gate. They are the real Definition of Done. They are owed next session.

## What must happen next (in order)

### 1. Real E2E with Playwright + PDF byte-grep
Write a script that:
- Spins up the booklet upload flow in a headless browser against staging (or prod with a controlled test account).
- Walks Steps 1→6 with the canonical booklet image.
- Downloads the generated I-821 and I-765 PDFs.
- Uses `pdftotext` (already a CI dep — see `guards.yml`) to grep for `REDACTED`, `Trostianets`, `Vinnytsia Oblast`, `Serhiiovych`.
- Fails non-zero on any missing field.
This is the actual gate that catches "shipped, but doesn't reach the user". Make it the new `npm test:e2e` and wire into a separate CI job (slow; should not block the typecheck/build/unit fast path).

### 2. Contract-as-API consolidation
Server emits `GET /api/tps/contract/booklet → { allowed_fields, forbidden_fields }`. Client fetches once on wizard mount, uses for the three filter call sites. Deprecate `BOOKLET_WAVE1_FIELDS` and `SLOT_ALLOWED_FIELDS.booklet` literals. After this lands, the drift gate `scripts/check-booklet-contract-drift.mjs` is replaced by a TypeScript-level guarantee.

### 3. Multi-sample booklet benchmark
The real Phase 0 gap the predecessor correctly identified. Need 3-5 real booklets from other Ukrainian TPS holders (PII — handle per `qa-shots/private/` rules — gitignored). Without this, every "production-stable" claim is on a one-sample benchmark.

### 4. Open product question — booklet-only `given_name` and `dob`
For booklet-only TPS users these are critical fields still on the server `forbidden_fields` list. Relaxing them requires multi-sample benchmark proof that dual-OCR crossref handles them. **Do not relax before evidence.**

## Unrelated but on the clock

`daily-briefing-2026-05-25.md` flags **H.R.1 IFR effective 2026-05-29** — TPS EAD capped at 1 year, no auto-extension, fee non-waivable. That is **4 days from now**. Affects TPS section copy, fee guidance, I-765 instructions. Not a pipeline change — content/legal copy. Schedule before the rule goes live or users will see stale guidance. Same briefing flags adjustment-of-status restriction (PM-602-0199, effective 2026-05-21) and signatures rule (effective 2026-07-10).

## Why session 17's "production verified" was wrong (for the record)
"10/10 stable on canonical dataset, surname=REDACTED, crossref_ok, latency=15.3s on messenginfo.com" — true at the OCR API boundary. Not true at the user boundary. The session declared success on `curl` output and committed before walking a wizard. Cost: 0 (caught in the same session before propagation). Lesson: API success and user success are different invariants. New rule enforced in CI gate above.
