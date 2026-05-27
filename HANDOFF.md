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

## Test evidence
- 2092/2092 tests pass
- 0 type errors (npx tsc --noEmit)

### P3 — TranslationReviewGate (COMPLETE)
- **TranslationReviewGate.tsx**: 4-locale component. Shows translation + certification draft. Requires checkbox before `reviewConfirmed: true`. Back button available.
- **/api/tps/translation/preview**: POST endpoint for generating translation HTML without ZIP (used by Review Gate)
- **packetBuilder.ts**: `reviewConfirmed: true` required before translation enters ZIP
- **TPSWizardV2.tsx**: "Review Translation" button → preview API → TranslationReviewGate modal → on confirm → `translationReviewConfirmed = true` → generate includes translation

## What was NOT done
- P2.5: Google Vision/DocAI benchmark (needs 5 real documents — data task)
- P3.5: PDF output decision (HTML serves as-is for now)
- P4: Multi-sample robustness (data task)
- P5: Agency glossary expansion
- P6: International passport translation (null for 'passport' docType)
- P7: G1-G13 gates verification

## Exact next task: P3 — Review Gate

Build `apps/web/src/components/translation/TranslationReviewGate.tsx`:
- Shows translation draft to user
- Requires explicit "I have reviewed and certify this translation" checkbox
- Sets reviewConfirmed: true in wizard state when confirmed
- Block ZIP generation in packetBuilder.ts until reviewConfirmed === true

Files to touch:
1. `apps/web/src/components/translation/TranslationReviewGate.tsx` (NEW)
2. `apps/web/src/lib/tps/packetBuilder.ts` — add reviewConfirmed check to TranslationOptions
3. `apps/web/src/app/[locale]/services/tps-ukraine/start/TPSWizardV2.tsx` — integrate ReviewGate into wizard flow
4. `apps/web/src/app/api/tps/generate-packet/route.ts` — validate reviewConfirmed in request

Legal basis: 8 CFR §103.2(b)(3) — certification boundary.

## Evidence
- Commit: [see CHANGELOG for this session]
- Test count: 2092 → 2092 (all pass)
- New files: translationExtractor.ts, translationCandidateSafetyGuard.ts, ADR-008, ADR-009, plus tests
