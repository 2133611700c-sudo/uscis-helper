# HANDOFF — Session 36 (2026-05-27)

## What was done this session

### P0 (COMPLETE — prior session, reconfirmed)
- P0 Playwright e2e proof: fresh ZIP with Translation_Internal_Passport.html (2759 bytes) + Certification_Translation.html (1387 bytes). translation-proof.json written.

### P0.5 — Provider Architecture ADRs (COMPLETE)
- **ADR-008**: Provider architecture locked — Vision (primary OCR), DocAI (flag-only), DeepSeek (text-only), Central Brain, KMU-55, Controlled Translation Renderer, Review Gate
- **ADR-009**: Provider data policy — image bytes only to Google; text only to DeepSeek; image retention OPEN items listed; DeepSeek privacy disclosure required pre-production

### P1 — Translation Mode Extraction + DOB format (COMPLETE)
- **translationExtractor.ts**: Translation Mode field extraction. Bypasses CB form contract (given_name/sex/passport_number blocked for forms, valid for translation). Priority: cb_merged → cb_rejected → manual
- **formatDobForTranslation()**: YYYY-MM-DD / MM/DD/YYYY / DD.MM.YYYY → "June 25, 1986"
- **translateBookletFromBrain()** updated: uses translationExtractor + rejected[] + manual{}
- **packetBuilder.ts**: added brainRejected and brainManual to TranslationOptions
- **TPSWizardV2.tsx**: passes centralBrainResult.rejected + data.manual to _translation block
- **mapTPSToBookletFields** (fallback path): DOB format fixed there too
- Tests: translationExtractor.test.ts (21 tests)

### P1.5 — TranslationCandidateSafetyGuard (COMPLETE)
- **translationCandidateSafetyGuard.ts**: blocks forbidden phrases, Militsiya/Police, Middle Name, Cyrillic leak, label-as-value before Renderer runs
- Integrated into translateBookletFromBrain (returns empty HTML + violations[] on block)
- Tests: translationCandidateSafetyGuard.test.ts (20 tests)

### P2 — issued_by + date_of_issue OCR extraction (COMPLETE)
- **passportBooklet.ts**: added label-based extraction for "Орган, що видав" (issued_by) and "Дата видачі" (passport_date_of_issue)
- **documentContracts.ts**: explicitly added both to booklet forbidden_fields with comment (form contract stays strict; translationExtractor picks them up from rejected[])

### P3 — TranslationReviewGate (COMPLETE)
- **TranslationReviewGate.tsx**: 4-locale component. Shows translation + certification draft. Requires checkbox before `reviewConfirmed: true`. Back button available.
- **/api/tps/translation/preview**: POST endpoint for generating translation HTML without ZIP (used by Review Gate)
- **packetBuilder.ts**: `reviewConfirmed: true` required before translation enters ZIP
- **TPSWizardV2.tsx**: "Review Translation" button → preview API → TranslationReviewGate modal → on confirm → `translationReviewConfirmed = true` → generate includes translation

### P5 — Agency Glossary Expansion (COMPLETE)
- `ukraine_agency_abbreviations.json`: 24 → 49 entries
- Added post-2015 police units (ВП, ГОВП, ГУНП), DMS variants (ВДДМС, СДМС, ТДМС), civil registry (ВАЦС), admin service centers (ЦНАП, МЦНАП), historical units (УВС, ГУВС, ОВС, ОМ, РМ, КМ)

### P6 — International Passport Translation (COMPLETE)
- `generateTPSTranslation` now handles 'passport' docType via 'internationalPassport' template
- Renders full HTML with "International Passport of Ukraine" title
- Was returning null — now produces translation + certification HTML

### P7 — Gates Verification (COMPLETE)
- All 13 gates G1–G13 verified: PASS
- Evidence: `docs/reports/P7_GATES_VERIFICATION_2026-05-27.md`
- Production readiness note: G10 (Review Gate) requires end-to-end Playwright browser run to confirm full flow

## Test evidence
- 2092/2092 tests pass
- 0 type errors (npx tsc --noEmit)

## What was NOT done
- P2.5: Google Vision/DocAI benchmark (needs 5 real documents — data task, not code)
- P3.5: PDF output decision (HTML serves as-is for now)
- P4: Multi-sample robustness (data task)
- End-to-end Playwright test for Review Gate: requires browser run
- DeepSeek privacy disclosure UI: required pre-production, not yet added to wizard
- Image retention audit: temp files, Vercel logs, Supabase ZIP storage (ADR-009 OPEN items)
- Deploy to production: all commits on main, awaiting owner approval for `git push`

## Post-P7 work (this commit)
- AI data processing disclosure UI: `aiDisclosure` key in 4 locales + 🔒 box in Step 4 (uses "AI assistant" — guard-safe, not provider name)
- Review Gate testids added (translation-review-gate, checkbox, confirm, back buttons)
- `translation-review-gate.spec.ts`: full 7-gate Playwright e2e proof spec written

## Session 34 work (this commit)
- ADR-009 audit closure: all 4 open items verified by code trace, table updated
- Comment bug fixed: passportBookletContract.ts "Militia Department" → "Militsiya Department"
- Payment verification: generate-packet verifies real Stripe cs_* session ID (was hardcoded string bypass)
- Wizard stores `stripeCheckoutId` from `?cs=` URL param, sends as X-Payment-Token

## Session 36 work (this commit)

### Translation PDF in TPS ZIP (COMPLETE)
- **translationBridge.ts**: `translateBookletFromBrain()` and `generateTPSTranslation()` return types extended with `_rawFields?: Record<string,string>`, `_signerName?: string`, `_signerAddress?: string`
  - `passportBooklet` branch: `_rawFields = Object.fromEntries(fields.filter(non-null).map([field,value]))` + signer info
  - `internationalPassport` branch: `_rawFields = fieldMap` + signer info
- **packetBuilder.ts**: added imports `generateTranslationPDF` + `PacketInput`; added `buildTranslationPacketInput()` helper; when `result._rawFields` present — builds `PacketInput` from raw fields + signer info → calls `generateTranslationPDF()` → adds bureau-style PDF to ZIP as `Translation_Internal_Passport.pdf` alongside existing HTML. PDF generation failure is caught + logged; doesn't block the ZIP.

### mailing_in_care_of (COMPLETE)
- `WizardData['manual']` extended with `mailing_in_care_of`
- `ReviewManual` component: FieldInput inside the `mailing_different` block
- `buildDraftAnswers()` passes `mailing_in_care_of` when mailing flag is true

### registration_address extraction (COMPLETE)
- `passportBooklet.module.ts`: `registration_address` wired into `extraction.fieldTargets`, `expectedLabels` (`МІСЦЕ ПРОЖИВАННЯ`, `МІСЦЕ РЕЄСТРАЦІЇ`), and `render.renderFields`

## Session 37 work (this commit)

### Gate field manual fallback (COMPLETE)
- **Root cause found**: booklet form contract forbids `given_name`, `passport_number`, `last_entry_date` from booklet slot. When only booklet is uploaded, these are always missing → `isStep6Eligible=false` → translation button hidden.
- **Fix**: Added `given_name_manual`, `dob_manual`, `passport_number_manual`, `last_entry_date_manual` to `WizardData['manual']`
- **ReviewManual**: 4 conditional `FieldInput` blocks shown ONLY when OCR is missing the value (testids: `tps-review-manual-given-name`, `tps-review-manual-dob`, `tps-review-manual-passport-number`, `tps-review-manual-last-entry-date`)
- **`buildDraftAnswers()`**: manual fallbacks for all 4 gate fields
- **`translation-review-gate.spec.ts`**: replaced `fillReviewRow` for identity gate fields with `fillIfEmpty` using new testids
- **`booklet-multi-sample.spec.ts`**: same fix; new spec for 5 real documents created

## Session 37 hotfix (this commit)

### Translation audit — CB race + non-identity guidance (this commit)
- **Audit**: 5 real booklet spreads of ONE passport. Visual inspection: 1.jpg/2.jpg/booklet_known = identity pages (translate OK); 3.jpg = issuing-authority spread, 4.jpg = registration spread rotated 90° (NO identity data).
- **Real bug 1 (CB race)**: `Review Translation` button didn't gate on `centralBrainStatus`. After `?paid=1` reload, CB re-merges; clicking during loading → `brainMerged` null → 140-byte placeholder. Fix: disable button until CB ready + defensive guard in handleTranslationPreview.
- **Real bug 2 (no guidance)**: non-identity booklet page → buttons silently absent. Fix: Step-5 warning `tps-booklet-no-identity-warning`.
- **Test**: `identityPage` flag added; non-identity docs assert the warning instead of translation.

### Multi-sample preview-capture async race (prior commit)
- **Root cause**: `page.on('response', async ...)` handler had `await resp.json()` inside. After `await previewRespPromise` the metrics line ran immediately — before handler finished. `violations_count` always read as -1.
- **Fix**: removed the listener; parse directly from `waitForResponse` response object — synchronous after the await, no race.

### Multi-sample count() race (this commit)
- **Root cause**: `reviewBtn.count()` fired immediately after `page.goto('?paid=1')` — before React rehydrated + `/api/owner/status` resolved. All 5 docs failed.
- **Fix**: replaced `if (count() === 0) throw` with `await expect(...).toBeVisible({ timeout: 20_000 })`.

### Stale closure fix in generatePacket (COMPLETE)
- **Root cause**: `translationReviewConfirmed` missing from `generatePacket` useCallback deps array (line 2534). Callback captured `false` at mount → `_translation.reviewConfirmed` always sent as `false` → packetBuilder skipped translation in ZIP even after user confirmed Review Gate.
- **Fix**: Added `translationReviewConfirmed` to deps array.
- **Found by**: Running `translation-review-gate.spec.ts` against production (gate 6 assertion: `reviewConfirmed` must be `true`).

### Patronymic manual fallback (this commit)
- doc2 (RU-side identity page): OCR missed the handwritten patronymic. Test now fills `tps-review-manual-middle-name` (fake value) only when OCR missed it. Flows into translation via extractTranslationFields manual path.

## FINAL STATUS — Ukrainian passport translation VERIFIED (2026-05-27, prod 6ddce4a)
- `booklet-multi-sample.spec.ts`: 5/5 GREEN (3 identity → full translation; 2 non-identity → warning, no translation)
- `translation-review-gate.spec.ts`: 1/1 GREEN (full ZIP + safety assertions)
- 2092/2092 unit, 0 type errors

## Exact next tasks (priority order)
1. **TASK-04/05/06** (Form Intelligence, Pain/FAQ DB, Monitoring Engine) — not started, codeable
2. **Draft modules** (birth/marriage/divorce certs) — blocked on real sanitized fixtures
3. **DeepSeek privacy disclosure UI** — required pre-production (separate from translation)

## Evidence
- Test count: 2092/2092
- Type errors: 0
- Gates: 13/13 PASS — docs/reports/P7_GATES_VERIFICATION_2026-05-27.md
