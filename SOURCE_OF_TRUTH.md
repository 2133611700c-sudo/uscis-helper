# SOURCE_OF_TRUTH.md
Purpose: define canonical modules. Prevent duplication. Stop re-litigation.

## Unified Document Contract (birth certificate) — Phase 6–10 (authoritative code tip `91f1cdb`; flags default OFF)

### Runtime flow (the ONE lifecycle for the translation birth-cert vertical)
`upload → content-orient → docType (registry-validated, fail-safe) → Gemini 2.5 Pro read (docintel) → arbitrateDocument → CanonicalField[] → toTranslationRows (FieldOut[]) → applyContractSplitFlow → normalizeContractSplitFields → persist extracted_fields → review-state(annotateReviewFields) → user confirm/correct → assertDocumentReadyForFinalPdf → mirror/official PDF`.

### Authoritative source-of-truth per concern (do NOT duplicate)
- **Contract / field keys / labels / splits / criticality:** `apps/web/src/lib/contracts/birthCertSovietV1Contract.ts`. The ONE source.
- **Aliases:** `KEY_ALIASES` (`canonical/core/keyAliases.ts`) and mirror `ALIASES` (`translation/pdf/buildMirrorValues.ts`) SOURCE from the contract when `UNIFIED_DOC_CONTRACT_ENABLED`.
- **Labels (EN + UK):** the contract (`englishLabel` / `reviewLabelUk`) — single source for PDF + review when the flag is ON.
- **Split fields:** `splitMergedFields.ts` + `contractFieldFlow.ts` (`applyContractSplitFlow`). `document.series/number`, `event.birth.place.*`, `registry.office.*`.
- **Translation / normalization:** `@uscis-helper/knowledge` ONLY (KMU-55 / BGN-PCGN / gazetteer / oblast nominative), via `normalizeContractSplitFields`. NO parallel dictionary (Constitution L2).
- **Review states:** `contractReviewState.ts` (`annotateReviewFields`, `contractReviewState`, `mustAlwaysReview`) — candidate/confirmed/missing/unreadable/not_applicable/conflict.
- **Gemini 2.5 Pro → contract boundary:** `contractExtractionBoundary.ts` (schema-from-contract, provenance with model-mismatch flag, candidate-only sanitizer). Model returns CANDIDATES only; it can never set `confirmed`/`final_value`. One adapter — no competing chains.
- **Confirmation / final-PDF boundary (server-side):** `finalPdfGate.ts` `assertDocumentReadyForFinalPdf`, applied to BOTH translation PDF emitters (`api/translation/generate-pdf`, `api/translation/render`).
- **Observability:** `contractObservability.ts` (PII-free allow-list events).

### Persistence (Supabase-independent; Supabase DISCONNECTED)
- **Authoritative persistence abstraction:** `apps/web/src/lib/repositories/` — `RepositoryBundle` (Document/Review/Confirmation/Translation/PdfArtifact/AuditEvent). Domain code calls `getRepositories()`; it must NOT import a Supabase client directly. Default driver = **in-memory**; Supabase = opt-in (`REPOSITORY_DRIVER=supabase`) and the adapter is a fail-closed stub until owner-wired. ONE contract suite (`repositoryContract.test.ts`) is the spec all impls satisfy. raw values are immutable (confirm/correct never overwrite raw). Future wiring: `docs/architecture/SUPABASE_CONNECTION_PLAN.md` + `supabase/migrations/0001_contract_vertical.sql` (DO NOT RUN). No competing repository abstraction.

### FORBIDDEN bypass paths (enforced by tests)
- raw extracted field → final PDF (closed: `shouldBlockRawPdfFallback` + `assertDocumentReadyForFinalPdf`; route invariant `finalPdfGateRouteInvariant`).
- ANY translation route emitting `application/pdf` without the gate (route-scan `workstreamERoutes` — currently only `generate-pdf` + `render`, both gated).
- a renderer running before the gate (`finalPdfGateRouteInvariant`).
- the model declaring a field `confirmed` (stripped by `sanitizeContractExtractionResponse`).
- field rows reaching the PDF outside `toTranslationRows`/sanctioned guards (`brainSingleArbiterInvariant`).
- a second/parallel dictionary for translation (Constitution L2).

### Flags (ALL default OFF → byte-identical)
`UNIFIED_DOC_CONTRACT_ENABLED`, `UNIFIED_DOC_CONTRACT_SPLIT_ENABLED`, `UNIFIED_DOC_CONTRACT_NORMALIZE_ENABLED`, `FINAL_PDF_CONFIRMATION_GATE_ENABLED`. Rollout: `docs/architecture/CONTRACT_FLAG_ROLLOUT.md`. ADR: `docs/adr/ADR-CONTRACT-VERTICAL.md`. Design: `docs/architecture/contracts/ua_birth_certificate_soviet_v1/`. Out of this vertical: TPS/EAD birth-cert + legacy non-Core extract path (unchanged).

> **LIVE V1 PROGRAM TRACKER:** GitHub issue #159 "USCIS HELPER V1 — FINAL DELIVERY PROGRAM" is the single source of release-gate truth. DONE: #161 (OCR coordination wired to live path, off by default), #160 (isolated staging LIVE + runtime-proven — Supabase `rxnlpvldngxgdxkxoaaj` + Vercel preview, `V1_STAGING_READY=true`, ADR-023). PR #119 (Translation V2) = KEEP_DRAFT→REBUILD_FROM_MAIN→supersede. NEXT: product browser E2E (TPS first). Staging deploy = `.github/workflows/staging-deploy.yml` (`vercel deploy -e/-b`); staging DB provision = `.github/workflows/staging-provision.yml`. V1 verdict: **NOT_READY** (E2E/visual/Stripe-test/canary gates pending).

## Canonical normalization layer
- `packages/knowledge/src/dictionary.ts` — authorities, geography, field labels, oblasts, blocklist
- `packages/knowledge/src/normalize.ts` — normalizeName, normalizeDate, normalizeSex, normalizeAuthority, normalizePlace, validateOutput
- `packages/knowledge/src/transliterate.ts` — KMU-55 engine, date converter
These own: transliteration, authority names, historical policy, geography, USCIS output, conflicts.

## Canonical TPS data structure
- `apps/web/src/lib/tps/answers.ts` — TPSAnswers interface, 60+ fields

## Canonical OCR / extraction modules
- `apps/web/src/lib/tps/modules/passport.ts` — international passport MRZ
- `apps/web/src/lib/tps/modules/passportBooklet.ts` — internal passport (handwritten)
- `apps/web/src/lib/tps/modules/dl.ts` — driver license (address, eye/hair, controlling Latin names)
- `apps/web/src/lib/tps/modules/i94.ts` — I-94 (entry date, status, admission number)
- `apps/web/src/lib/tps/modules/ead.ts` — EAD card (A-number, category)
- `apps/web/src/lib/tps/modules/i797.ts` — I-797 notice (A-number, receipt#, uscis_online_account)
- `apps/web/src/lib/tps/modules/visionBridge.ts` — OCR→Knowledge→TPSAnswers bridge

## Canonical form maps
- `apps/web/src/lib/tps/forms/i765FieldMap.ts` — I-765 edition 08/21/25 (TPS pipeline)
- `apps/web/src/lib/ead/i765FieldMap.ts` — I-765 edition 08/21/25 (EAD wizard, sparse `EadFieldData`; UNIFICATION with the TPS map is documented-not-executed, kept separate until a golden-PDF parity harness exists — do NOT naively merge)
- `apps/web/src/lib/tps/forms/i821FieldMap.ts` — I-821 edition 01/20/25

## Product gate E2E (real-artifact proof, per product)
- TPS: `tests/e2e-ui/tps-golden-path.spec.ts` + `.github/workflows/staging-e2e-tps.yml` → real I-821(+I-765) ZIP. **CLOSED** (run 27853270531).
- EAD: `tests/e2e-ui/ead-golden-path.spec.ts` + `.github/workflows/staging-e2e-ead.yml` → real filled I-765 PDF via the live UI (EAD is FREE — no owner/Stripe gating). Hard acceptance = negative readiness + pypdf field-level checks (name/dob/category a+12/app-type/address/A-number blank/signature blank) + 7 pages + render/missing-page + staging-ref proof. Stable testids live on `apps/web/src/components/services/ead/EADWizard.tsx`. **CLOSED** (run 27885324248, 2026-06-20).
- Translation V2: REBUILD from main (supersede draft PR #119; forensic audit first, do NOT merge #119). Target full E2E: Stripe test → verified webhook (idempotency already on main via #184) → one order → upload → classify → quality → Cyrillic OCR (uk/ru separated; printed vs handwriting; uncertain critical → review_required+null) → translation candidate → operator review/correction (provenance) → approval → immutable PDF once → visual acceptance → exact stored bytes delivered. IN PROGRESS.

## Canonical PDF prefill
- `apps/web/src/lib/tps/pdfPrefiller.ts` — XFA-strip, AcroForm fill, WinAnsi safety

## Canonical transliteration (app-level, uses knowledge package)
- `apps/web/src/lib/tps/transliterate.ts` — WinAnsi-safe wrapper over KMU-55

## Canonical OCR entry point
- `apps/web/src/app/api/tps/ocr/extract/route.ts` — POST endpoint, dispatches to modules

## Canonical prompts
- `prompts/universal-document-extraction.md` — 10 document types, vision extraction
- `prompts/vision-extraction-prompt.md` — legacy, simpler version
- `prompts/translation-agent-system.md` — translation agent rules

## Rules that must never be bypassed
1. Patronymic = "Patronymic", NEVER "Middle Name"
2. Historical "Міліція" → "Militsiya", NEVER "Police" or "Militia"
3. Self-name on authority's own .gov.ua site beats third-party references
4. Controlling Latin spelling from MRZ/I-94/EAD beats retransliteration
5. Historical place names in old issuers must not be auto-modernized
6. "Вінницької області" auto-converts to "Vinnytsia Oblast" (DMS-verified)
7. "смт" = "urban-type settlement", NEVER "city" or "town"

## Deprecated paths — do not use
- Any ad-hoc transliteration outside `packages/knowledge` — superseded
- Any hardcoded authority name mapping outside `dictionary.ts` — superseded
- `docs/UKRAINE_TERMINOLOGY_DICTIONARY.md` (v1.0 from other agent) — superseded by v1.2 in `dictionary.ts`


## Canonical mail-ready gate
- `apps/web/src/lib/tps/mailReadyGate.ts` — blocks export on: empty required fields, unresolved spelling conflicts, low OCR confidence, invalid phone/email. Messages in EN/RU/UK.

## KNOWN BYPASS PATHS (must migrate to @uscis-helper/knowledge)
- `apps/web/src/lib/translation/glossary/agencyGlossary.ts` — OLD agency resolver. Uses "Militia Department" (violates ADR-004, should be "Militsiya")
- `apps/web/src/lib/translation/glossary/ukraine_agency_abbreviations.json` — OLD abbreviation data. Superseded by dictionary.ts
- `apps/web/src/lib/translation/glossary/civil_registry_terms.json` — OLD ЗАГС/РАЦС terms. Superseded by dictionary.ts
- `apps/web/src/lib/translation/glossary/nominativeCaseRestorer.ts` — OLD genitive→nominative. Superseded by normalizeOblastToNominative in knowledge
- **BUG:** translation glossary.test.ts line 47 expects "Militia Department" — must change to "Militsiya" per ADR-004
