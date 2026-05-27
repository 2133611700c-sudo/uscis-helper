# HANDOFF — Session 33 (2026-05-27)

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

## Exact next tasks (priority order)
1. **Deploy approval** — owner must approve `git push origin main` to trigger Vercel deploy
2. **DeepSeek privacy disclosure UI** — add disclosure text to wizard upload step before OCR triggers
3. **Playwright e2e for Review Gate** — verify full review→confirm→generate flow in live browser
4. **Image retention audit** — trace temp files, Vercel function logs, Supabase ZIP storage

## Evidence
- Commits: 36d1260 (P0.5–P2), 20b0c01 (P3), fba7ba4 (P5+P6)
- Test count: 2092/2092
- Gates: 13/13 PASS — docs/reports/P7_GATES_VERIFICATION_2026-05-27.md
