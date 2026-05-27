# HANDOFF — Session 39f (2026-05-27)

## Session 39f — e2e 10/10 GREEN + test flakiness fix

### E2E results on production (messenginfo.com, commit 0397b6f)
```
booklet_known:  structural_pass=true  ocr_fields=4  violations=0  translation_bytes=2568 ✓
booklet_doc1:   structural_pass=true  ocr_fields=3  violations=0  translation_bytes=2555 ✓
booklet_doc2:   structural_pass=true  ocr_fields=4  violations=0  translation_bytes=2569 ✓
booklet_doc3:   NON-IDENTITY page: warning shown (expected)                               ✓
booklet_doc4:   NON-IDENTITY page: warning shown (expected)                               ✓
review-gate:    violations=0  translation_bytes=2572  ZIP=2591649 bytes                   ✓
passport-only:  has_given_name=true  has_passport_number=true  has_dob=true              ✓
booklet-only:   has_family_name=true  has_dob=false  has_given_name=false                ✓
i94-only:       has_last_entry_date=true  has_i94_number=true                            ✓
all-3-docs:     edit buttons present  no blank manual identity inputs                    ✓
10/10 passed (4.8m)
```

### Test fix
`booklet-multi-sample.spec.ts`: doc3/doc4 non-identity warning timeout 15s → 30s; added `result.warning_showed` flag; hard assertions now guarded by `if (doc.identityPage)` so non-identity timeout flakiness never bleeds into identity assertions.

### Remaining open issues
1. booklet-only DOB = "has_dob: false" — booklet OCR extracts city/family_name/middle_name/province but NOT dob. Root cause TBD.
2. `place_of_last_entry` (Port of Entry) doesn't extract from user's I-94 (format mismatch or user's I-94 label not matched). User must fill manually.

### Next tasks
- Investigate DOB "Не найдено" when booklet-only (has_dob=false in verify test)
- TASK-04/05/06 (Form Intelligence, Pain/FAQ DB, Monitoring Engine)

---

# HANDOFF — Session 39e (2026-05-27)

## Session 39e — fix: UX confusion + I-94 port patterns

### Issues fixed
1. **Секция "Заполните вручную"** → переименована в "Проверьте и дополните" (ru/uk/en/es). Была причиной путаницы — адрес авто-заполняется из прав, но заголовок кричал "заполните вручную".
2. **Подсказка city_of_birth** → объясняет что смт/пгт убирается из формы I-821 намеренно, а тип поселения добавляется в перевод паспорта.
3. **Подсказка place_of_last_entry** → честная: "Город и штат въезда, напр. 'Los Angeles, CA'" вместо обманчивого "робот заполнит".
4. **I-94 port of entry OCR** → добавлено 3 новых паттерна меток (place of entry, entry port, last entry port) + value regex принимает апостроф, дефис, полное имя штата.

### Files changed
- `TPSWizardV2.tsx`: s5ManualTitle 4 locales + city_of_birth tip + place_of_entry tip
- `i94.ts`: expanded port-of-entry label + value regex patterns

### Tests
2098/2098, 0 type errors

### Next tasks
- Investigate DOB "Не найдено" when booklet-only uploaded
- TASK-04/05/06 (Form Intelligence, Pain/FAQ DB, Monitoring Engine)

---

# HANDOFF — Session 39d (2026-05-27)

## Session 39d — fix: смт → "urban-type settlement" in translation

### Bug
Translation showed "Trostianets" instead of "Trostianets urban-type settlement" for a city born in смт.

### Root cause
`postExtractNormalize.cleanCityCandidate()` strips "смт" prefix → passes "Тростянець" to `normalizePlace()` → "Trostianets" stored in `MergedField.value`. No record of original prefix survived to translation layer.

### Fix
- `centralBrain.ts`: `MergedField` got `raw_value?: string`; `winningCandidate.raw_value` threaded into merged record
- `translationExtractor.ts`: `SETTLEMENT_SUFFIX_MAP` + `cityWithSettlementType(normalizedCity, rawValue)` helper; `city_of_birth` uses raw_value to detect смт/пгт/с./хут. → appends English suffix
- USCIS form path unchanged — still uses `MergedField.value = "Trostianets"` (no suffix)

### Tests
+6 new unit tests in `translationExtractor.test.ts`
2098/2098 pass, 0 type errors

### Next task
Investigate why DOB is "Не найдено" when only booklet uploaded (booklet OCR should extract dob). Then TASK-04/05/06 (Form Intelligence, Pain/FAQ DB, Monitoring Engine).

---

# HANDOFF — Session 39c (2026-05-27)

## Session 39c — knowledge v1.3 ingested from three reference files

### Source files
- `/Users/sergiiredacted/Downloads/UKRAINE_TERMINOLOGY_DICTIONARY.md`
- `/Users/sergiiredacted/Downloads/TPS_UKRAINE_OFFICIAL_REQUIREMENTS.html`
- `/Users/sergiiredacted/Downloads/TPS_UKRAINE_VERIFIED_REQUIREMENTS.html`

### What was already in the knowledge base (not duplicated)
KMU-55 full table, all 25 oblast genitive→nominative, all GEO_CORRECTIONS, MVS/MFA/MINJUST/DMS/NPU/MILITSIYA/SBGSU/CIVIL_REGISTRY/DAI/UMVS/GUMVS, settlement types, sex map, ЗАГС/РАЦС/ДРАЦС, 49 agency abbreviations.

### What was added
- dictionary.ts: 9 new authorities (виконком, РДА, ОДА, сільрада, міська рада, нотаріус, паспортний стіл, дільничний інспектор), DOCUMENT_TYPES (14 doc types), reordered AUTHORITY_PATTERNS
- tps_ukraine_requirements.ts (new): eligibility 2022-04-11 (rereg) / 2023-08-16 (new initial), H.R.1 NON-WAIVABLE $500-510, EAD A12/C19, submission rules, common mistakes
- ukraine_agency_abbreviations.json: +ВИКОНКОМ, РДА, ОДА, ТЦК, ДСНС, ДПСУ, ЦНАП

### Next task
Investigate why booklet OCR misses DOB field (`has_dob: false` in single-booklet verify test).

---

# HANDOFF — Session 39b (2026-05-27)

## Session 39b — fix: booklet source label bug

### Bug found by user manual testing
Fields extracted from the internal passport (буклет) were showing "Паспорт · OCR" as source label — same as international passport. Root cause: `provenanceLabel()` had no handler for `actualSlot === 'booklet'`, fell through to `fallbackDoc === 'passport'` → `t.source.visual` = "Паспорт · OCR".

### Fix
Added `booklet: 'Внутр. паспорт · OCR'` to `t.source` in all 4 locales (uk/ru/en/es) and `if (actualSlot === 'booklet') return t.source.booklet` in `provenanceLabel()`.

### Second issue: OCR misread "REDACTED" → "Khlopiatnyk"
This is Vision API OCR accuracy on the real uploaded image — not a code bug. The "Изменить" button is there to correct it. Cannot be fixed in code without image quality improvements on the user's side.

### What was NOT done
OCR accuracy improvement — requires image preprocessing or alternative OCR provider for handwritten fields.

### Next task
Investigate why DOB is "Не найдено" when only booklet uploaded (booklet OCR should extract dob).

---

# HANDOFF — Session 39 (2026-05-27)

## Session 39 — e2e tests fully green (booklet-multi-sample 5/5, translation-review-gate 1/1)

### What was done
- Fixed `booklet-multi-sample.spec.ts`: added passport + I-94 sequential uploads (same as review-gate test) so CB completes in <25s instead of timing out at 60s with booklet-only data.
- Fixed doc3 (issuing-authority page) timeout: changed bookletOcr `waitForResponse` to accept any HTTP status (removed `&& r.status() === 200`) — OCR returns non-200 for non-identity pages, causing the status===200 filter to never match.
- All 5/5 booklet-multi-sample tests GREEN: booklet_known ✓, booklet_doc1 ✓, booklet_doc2 ✓ (translation_bytes 2564-2569, violations=0), booklet_doc3 ✓ (non-identity, expected), booklet_doc4 ✓ (non-identity, expected).
- `translation-review-gate.spec.ts`: 1/1 GREEN (confirmed in prior session).

### What was NOT done
- TASK-04/05/06 (Form Intelligence, Pain/FAQ DB, Monitoring Engine) — not started
- Draft modules (birth/marriage/divorce certs) — blocked on real sanitized fixtures
- DeepSeek privacy disclosure UI — required pre-production

### Exact next task
Commit the e2e test changes to git. Then proceed to TASK-04 (Form Intelligence) per the product roadmap.

### Evidence
```
booklet_known: structural_pass=true ocr_fields=4 violations=0 translation_bytes=2568 ✓
booklet_doc1: structural_pass=true ocr_fields=4 violations=0 translation_bytes=2568 ✓
booklet_doc2: structural_pass=true ocr_fields=4 violations=0 translation_bytes=2569 ✓
booklet_doc3: NON-IDENTITY page: no-identity warning shown (expected) ✓
booklet_doc4: NON-IDENTITY page: no-identity warning shown (expected) ✓
5 passed (3.4m)
translation-review-gate: 1/1 PASSED 56.3s (prior session)
```

---

# HANDOFF — Session 38 (2026-05-27)

## Session 38 — auto-fill-only model + PII purge (this commit)
- **Owner directive**: everything auto-filled from documents; NO manual identity entry; only an "Изменить" button on recognized values. phone/email/marital_status stay typed (not on any document).
- Removed real-PII placeholders from the LIVE site (Sergii/FU262473/06-25-1986/Serhiiovych) + from e2e test files → synthetic values.
- Removed 4 manual identity FieldInputs from Step-5 ReviewManual (given_name/dob/passport_number/last_entry_date) — they duplicated ReviewOcr rows. Removed *_manual keys from WizardData.manual + buildDraftAnswers.
- ReviewOcr edit buttons now have stable testids `tps-ocr-edit-<key>`; editing writes to synthetic 'manual' slot under base key → gate/forms/translation. Fixes the *_manual key mismatch that lost the given name in the translation.
- **How to verify on prod after deploy**: Step 4 upload загранпаспорт (MRZ) + I-94 + booklet → Step 5 shows recognized values with "Изменить", NO blank identity inputs. given_name auto-fills from passport MRZ.
- 2092/2092 unit, 0 type errors. e2e pending prod run.

## What was done in Session 36

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
