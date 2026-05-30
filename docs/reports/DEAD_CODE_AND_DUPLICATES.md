# Dead Code & Duplicates
**Date:** 2026-05-30 · READ-ONLY. Nothing deleted — report only.

## Dead / unwired files
| File | Why | Action |
|---|---|---|
| `lib/translation/pdf/templates/ukraine/renderMarriageCertificateTranslation.ts` | 0 importers; superseded by generic `renderOfficialTranslation` | DELETE_LATER |
| `lib/engine/assembler.ts` | no caller | DELETE_LATER |
| `packages/knowledge/src/normalize.ts` | superseded by orchestrator/dictionaryBridge; not imported in app/api | DELETE_LATER |
| `lib/engine/htr.ts` (Transkribus) | broken (OAuth account, password grant fails); never runtime-verified | NEEDS_OWNER (creds) |
| `lib/translation/mockOCR.ts`, `sampleDocuments.ts`, `TranslationSamplePreview.tsx` | Translation Lab / marketing demo only | KEEP (lab-only) |
| legacy TPS storage keys `wizard:tps-ukraine:state(:v1)`, `:v3:state`, `:personal:v1`, `:part7:v1` | older wizard versions | NEEDS_OWNER (confirm v2 is the only live) |

## Duplicate logic (consolidate)
| Duplicate | Files | Action |
|---|---|---|
| **Two recognition stacks** | engine/docintel (Translation) vs tps/* (TPS) | MERGE → ADR-016 (one brain) |
| **Two preprocessors** | `lib/ocr/image-preprocess.ts` vs `lib/engine/preprocess.ts` | MERGE (prefer ocr/image-preprocess) |
| **Transliteration reimpl** | `lib/tps/transliterate.ts` vs `packages/knowledge/transliterate.ts` | REPLACE tps → import knowledge |
| **PDF renderers** | `renderOfficialTranslation` (generic) vs `renderMarriageCertificateTranslation` (hardcoded) | MERGE → generic |
| **Geography normalize** | engine `snapCity`+`registryLookup` vs `tps/dictionaryBridge` | MERGE → one path (ADR-016 B3) |
| **Dictionaries** | `registry/*` (canonical) vs `glossary/ukraine_agency_abbreviations.json` + `glossaryLoader.ts` | MERGE → registry (NORMATIVE_BASE_INVENTORY P2) |
| **Packet endpoints (5)** | `/api/{tps,translation,ead,reparole,packet}/generate-packet` | NEEDS_OWNER (consolidate or justify) |
| **OCR endpoints** | `/api/ocr/extract`, `/api/ocr/translate` vs `/api/tps/ocr/extract`, `/api/translation/vision-extract` | NEEDS_OWNER (deprecate legacy) |

## Mock / sample in production paths
| Finding | File | Risk | Action |
|---|---|---|---|
| `SAMPLE_ROWS` (ПРИКЛАД/SAMPLE) shown when no fields extracted | `TranslateWizard.tsx:~303` | LOW (watermark "ОБРАЗЕЦ") but reaches review screen | KEEP + add a test asserting the watermark renders; never feed SAMPLE into the PDF |
| `paymentStatus: 'mock_paid'` union | `contexts/WizardContext.tsx` + `Screen10.tsx` | MEDIUM if compared loosely | NEEDS_OWNER (ensure strict `=== 'paid'`, hidden in prod) |

## Stale docs vs code
- `docs/audit/` (140) + `docs/research/` (92) predate the current architecture; many contradict current code (e.g. pre-fix DB-audit, pre-garbage-guard). Treat `docs/reports/` (dated) + `docs/adr/` as authoritative; `docs/audit`/`docs/research` = historical. Action: KEEP (history), but the inventory/ADR/risk reports are the live truth.

## Recommended order (no deletes yet)
1. Land ADR-016 brain unification (removes the biggest duplicate).
2. Replace `tps/transliterate` with knowledge import.
3. Merge marriage renderer + one preprocessor.
4. Dictionary consolidation (P1 done; P2–P5).
5. Owner decision on 5 packet endpoints + legacy OCR endpoints + Transkribus.
6. Delete confirmed-dead (`assembler`, `normalize.ts`, marriage renderer) LAST, after callers proven gone.
