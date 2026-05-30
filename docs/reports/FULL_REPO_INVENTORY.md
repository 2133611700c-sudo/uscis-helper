# Full Repository Inventory
**Date:** 2026-05-30 · READ-ONLY audit · no code changes.

## Executive summary
1,423 tracked files. The product is 4 wizards (TPS, Translation, Re-Parole, EAD)
over **two divergent recognition stacks** (Gemini-docintel vs Google-Vision-keyword-
modules), one shared `packages/knowledge`, a partially-wired `central-brain`, and a
large `docs/` corpus (audit 140, research 92, reports 41+). The biggest systemic risks
are: **two brains** (legal divergence), **dictionary fragmentation**, **stale wizard
state** (`tps:legal-risk:v1` persists cross-document), and **audit/DB writes that
continue on failure**.

## Counts by area
| Area | Files |
|---|---|
| apps/web (code+assets) | 597 |
| docs/audit | 140 · docs/research 92 · docs/reports 41 · docs/architecture 20 · docs/adr 17 |
| test-fixtures (proof/degraded) | 98 |
| packages/knowledge | 27 |
| supabase/migrations | 26 |
| API routes (`route.ts`) | 47 · pages 40 · wizards 8 · scripts 52 · workflows 7 |
| Extensions | ts 407 · md 338 · tsx 150 · png 120 · yaml 89 · json 46 · mjs 35 · pdf 30 · sql 27 · csv 15 |

## Active product flows (verified)
- **TPS** → `/api/tps/ocr/extract` (Google Vision + DocAI + keyword modules + flagged DeepSeek/Gemini arbiter) → `/api/tps/brain/merge` (tps/centralBrain) → review → owner/Stripe → `/api/tps/generate-packet` → **ZIP (I-821+I-765)**.
- **Translation** → `/api/translation/vision-extract` (Gemini docintel + central-brain) → review+signature+attestation → owner/Stripe → `/api/translation/generate-pdf` → **PDF + cert**.
- **Re-Parole** → reuses `/api/tps/ocr/extract` → `/api/reparole/generate-packet` → **ZIP (I-131)**.
- **EAD** → manual entry (no OCR) → `/api/ead/generate-packet` → **HTML/PDF (I-765)**.

## Duplicated brains / engines (the core problem)
- Recognition: **2 stacks** (engine/docintel for Translation; tps/* for TPS+Re-Parole). The most capable engine (`engine/orchestrator`) is NOT wired to TPS.
- Preprocessing: **2** (`ocr/image-preprocess` + `engine/preprocess`).
- Transliteration: `packages/knowledge/transliterate` (canonical) vs `lib/tps/transliterate` (reimpl).
- PDF renderers: `renderOfficialTranslation` (generic) vs `renderMarriageCertificateTranslation` (hardcoded dup, UNWIRED) + `pdf.ts` (live flat) + `engine/renderPdf` + `bureauStyleRenderer` (text).
- Dictionaries: see NORMATIVE_BASE_INVENTORY (registry vs parallel glossary JSONs).

## Top critical files
1. `app/api/translation/generate-pdf/route.ts` — payment+review gate, PDF, **DB audit (continues on failure)**.
2. `app/api/tps/ocr/extract/route.ts` — TPS OCR brain (weaker stack).
3. `app/api/translation/vision-extract/route.ts` — Translation OCR brain (stronger stack).
4. `lib/packet/pdf.ts` — live translation PDF + cert block + signature embed.
5. `lib/translation/reviewGate.ts` / `attestation.ts` — certification gate + audit.
6. `lib/tps/centralBrain.ts` + `dictionaryBridge.ts` — TPS normalize (parallel to engine).
7. `packages/knowledge/registry/*` — D-GLOSSARY (canonical, partly used).
8. `TranslateWizard.tsx` / `TPSWizardV2.tsx` — wizard state + storage keys.

## Top risks (see RISK_REGISTER_BY_FILE.md)
1. 🔴 Two recognition brains → divergent fields on the same doc (legal).
2. 🔴 `[CONFIRM]` markers can reach a signed certified PDF (renderOfficialTranslation; live path uses flat pdf.ts which doesn't, but bureau path does — flagged OFF).
3. 🔴 `translation_orders` + `translation_certification_audit` insert errors are LOGGED but the route returns 200 → audit gap.
4. 🟠 `tps:legal-risk:v1` / `tps:attest:v1` persist cross-document (no reset on new upload).
5. 🟠 Dictionary fragmentation (parallel glossaries vs registry).
6. 🟠 `central_brain_audit` table referenced but not in migrations (possible drift).
7. 🟠 5 separate packet endpoints + 2 OCR endpoints (legacy/duplication).
8. 🟠 Transkribus HTR code present but broken/unverified.

## Immediate STOP list
No P2 glossary migration · no new doc types · no OCR refactor mid-audit · no Stripe changes · no BUREAU_PDF on · no deletes.

## Next 10 actions (read RISK_REGISTER + DEAD_CODE + ARCHITECTURE_DEPENDENCY_MAP)
1. ADR-016 B1: unify TPS onto the Gemini-docintel reader (parity test).
2. Make audit/order DB write block-or-DEGRADE (not silent 200).
3. Reset `tps:legal-risk:v1`/`tps:attest:v1` on new upload (state isolation).
4. Confirm `central_brain_audit` table exists in prod (drift check).
5. Single packet endpoint (or document why 5).
6. Merge `renderMarriageCertificateTranslation` → `renderOfficialTranslation`.
7. Replace `lib/tps/transliterate` with `@uscis-helper/knowledge`.
8. One preprocessor.
9. P1–P5 dictionary consolidation (after brains).
10. Add a real fixture-parity E2E (same doc → identical fields both products).
