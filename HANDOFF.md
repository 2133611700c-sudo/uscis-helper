# HANDOFF.md
Session date: 2026-05-23
Author: Claude session (full day: audit → knowledge engine → pipeline wiring → bypass elimination → gate wiring)

## What was completed
- [x] `@uscis-helper/knowledge` — canonical dictionary + KMU-55 + normalization (74 tests)
- [x] OCR route: `postExtractNormalize` — normalizes extracted fields (oblast genitive→nominative) BEFORE returning to wizard
- [x] OCR route: returns `knowledge_conflicts` + `knowledge_low_confidence` in response
- [x] Wizard V2: stores knowledge metadata per upload
- [x] Wizard V2: collects all conflicts/low_confidence from uploads
- [x] Wizard V2: `runMailReadyGate(answers, allConflicts, allLowConf)` BEFORE generate-packet call
- [x] Wizard V2: `province_of_birth` auto-normalizes genitive→nominative in merge
- [x] Wizard V2: `uscis_online_account`, `eye_color`, `hair_color` wired to TPSAnswers
- [x] GeneratePacketBlock (old wizard): also has mailReadyGate with conflict/confidence props
- [x] mailReadyGate: 8 tests covering required fields, conflicts, OCR confidence, phone/email format
- [x] agencyGlossary: bridges to knowledge for unknown abbreviations
- [x] nominativeCaseRestorer: delegates transliteration to canonical KMU-55 (duplicate table removed)
- [x] "Militia Department" → "Militsiya Department" in JSON + tests
- [x] passportBooklet: extracts city_of_birth + province_of_birth
- [x] I-797: extracts uscis_online_account
- [x] ADR-001 through ADR-005
- [x] Continuity system: STATUS/HANDOFF/SOURCE_OF_TRUTH/CHANGELOG/PROJECT_HISTORY/CLAUDE.md/AGENTS.md

## Evidence
- TypeScript: 0 errors
- Web tests: 1940 pass, 52 files
- Knowledge tests: 74 pass (35+26+13)
- Total: 2014 tests, 0 failures

## Data flow proof (architecture)
```
Photo → Google Vision → OCR route
  → module extraction (passportBooklet/passport/DL/I-94/EAD/I-797)
  → postExtractNormalize (oblast genitive→nominative via @uscis-helper/knowledge)
  → response with knowledge_conflicts + knowledge_low_confidence
  → wizard stores per-upload metadata
  → mergedFields resolves controlling spelling from DL
  → province_of_birth auto-normalizes via normalizeOblastToNominative
  → handleGenerate collects ALL conflicts/lowConf from ALL uploads
  → runMailReadyGate(answers, conflicts, lowConf)
  → if blockers: show user message in their language, STOP
  → if clean: build provenance → fetch generate-packet → download ZIP
```

## What was NOT completed
- [ ] city_of_birth from passportBooklet: arrives as raw Cyrillic "смт. Устинівка", not normalized to Latin in postExtractNormalize (only province gets oblast normalization; city stays for pdfPrefiller toWinAnsiSafe)
- [ ] civil_registry_terms.json not migrated to knowledge
- [ ] generateTranslationHTML.ts has own KMU table (justified: handles Russian GOST, ADR-005)
- [ ] Live production E2E: requires deployment + real photo upload + Google Vision
- [ ] visionBridge.ts exists but postExtractNormalize serves the same purpose more cleanly — visionBridge may be deprecated

## Exact next task
Deploy to Vercel. Upload real internal passport photo through production wizard. Verify:
1. Patronymic appears in review UI
2. Province shows "Vinnytsia Oblast" (not "Вінницької області")
3. Same values in generated I-765 PDF (Line 1c, 18a, 18b)
4. mailReadyGate blocks when required field is empty
5. Export gate unblocks when user fills missing field

## Do not re-investigate
- Dictionary v1.2 is canonical (ADR-002)
- Extend existing pipeline, not rebuild (ADR-003)
- Historical authorities preserved (ADR-004)
- Ukrainian→knowledge, Russian GOST→stays local (ADR-005)
- Patronymic ≠ Middle Name (blocklist)
