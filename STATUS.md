# STATUS.md
Last updated: 2026-05-23 03:10 UTC
Owner: Claude session (I-765 audit + knowledge engine build)

## Product
Messenginfo = self-help immigration information, document translation, and USCIS draft-form generation platform.
Not a law firm. No legal advice. User reviews, signs, and files independently.

## Current production goal
Fully automatic: upload docs → OCR/vision → normalization → TPSAnswers → I-765/I-821 PDF → translation → review → clean export.
User manual input: phone, email, marital status, SSN only. Everything else from documents.

## VERIFIED
- [x] Canonical normalization package: `packages/knowledge/` — 74 tests, 0 failures
- [x] TPS auto-fill rate: 94.4% (17/18 document-sourced fields) per Engineering Spec v1.1
- [x] I-765 edition 08/21/25 field map: 40+ ops in `i765FieldMap.ts`
- [x] I-821 edition 01/20/25 field map: exists in `i821FieldMap.ts`
- [x] PDF prefill with XFA-strip: working, 181 readback fields, 0 mismatches
- [x] 6 document modules: passport MRZ, passportBooklet, DL, I-94, EAD, I-797
- [x] KMU-55 transliteration engine: ЗГ→Zgh, ALL-CAPS, apostrophe — 35 tests
- [x] Oblast genitive→nominative: 24 oblasts, DMS-verified English names
- [x] passportBooklet extracts: patronymic, city_of_birth, province_of_birth
- [x] DL extracts: address(4), eye_color, hair_color — wired to TPSAnswers
- [x] I-797 extracts: uscis_online_account (NEW) — wired to TPSAnswers
- [x] Web app: 1932 tests pass, 0 type errors, 51 test files
- [x] Workspace linked: `@uscis-helper/knowledge` in pnpm workspace

## OPEN
- [ ] visionBridge.ts not called from live OCR API route
- [ ] Translation module does not import `@uscis-helper/knowledge` at runtime
- [ ] Mail-ready export gate: no block on unresolved spelling conflicts
- [ ] E2E proof on production: internal passport upload → fields in review → PDF → translation

## RISKS
- Dictionary v1.2 is in repo but not yet consumed by translation glossary
- passportBooklet extraction depends on Google Vision OCR quality for handwritten text
- Forms and translations may use different normalization if knowledge package is bypassed

## NEXT EXACT ACTION
Wire `visionBridge.ts` into `/api/tps/ocr/extract` route so normalized fields from internal passport flow through the live pipeline to TPSAnswers, then verify in review UI + exported PDFs.

## DO NOT RE-LITIGATE
- Dictionary v1.2 is canonical (ADR-002)
- Patronymic ≠ Middle Name (blocklist enforced)
- Historical Militsiya stays Militsiya (ADR-004)
- Self-name on .gov.ua beats third-party references
- Existing pipeline is correct; extend, do not rebuild

## RELATED ADRs
- `docs/adr/ADR-001-product-boundary.md`
- `docs/adr/ADR-002-ukraine-dictionary-v1.2.md`
- `docs/adr/ADR-003-tps-runtime-pipeline.md`
- `docs/adr/ADR-004-historical-authority-policy.md`
