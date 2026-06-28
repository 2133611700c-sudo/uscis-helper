# ADR — Unified Document Contract vertical (Phase 6–10)

Status: ACCEPTED (staging-gated; production flags OFF). Date: 2026-06-28.
Branch: `translation/ru-and-model-matrix-fixes`.

Four decisions, all flag-gated, all OFF-default → byte-identical legacy.

## 1. Canonical lifecycle (single contract source)
The birth-certificate field/label/split knowledge is unified in
`apps/web/src/lib/contracts/birthCertSovietV1Contract.ts`. KEY_ALIASES,
buildMirrorValues aliases, mirror/review labels, and split mappings are SOURCED from
it (Phase 3/4/5/6/7) when `UNIFIED_DOC_CONTRACT_ENABLED` / `_SPLIT_` / `_NORMALIZE_`
are on. Runtime flow: readDocument → arbitrateDocument (CanonicalField) →
toTranslationRows → `applyContractSplitFlow` → `normalizeContractSplitFields` →
review/PDF. Decision: keep flat `runtimeKey` as the stored key; dotted `canonicalKey`
is the human SoT/projection (avoids a big-bang rename).

## 2. Confirmation boundary (final PDF safety)
`assertDocumentReadyForFinalPdf` (`finalPdfGate.ts`) is the single server-side gate
applied to EVERY translation PDF emitter (generate-pdf + render), enforced when
`FINAL_PDF_CONFIRMATION_GATE_ENABLED=1`. A final PDF is allowed ONLY from a confirmed,
validated, non-raw document; server-side (never trusts client `confirmed`); raw→PDF
is closed (Phase 8 fallback closure + this gate). Route invariant + negative battery
(forged/raw/conflict/missing/unreadable/unconfirmed) enforce it.

## 3. Gemini → contract adapter (one boundary)
The live reader derives its response schema from the documentRegistry read-side (one
schema source). `contractExtractionBoundary.ts` provides the contract-side counterpart:
`buildContractExtractionSchema` (from the contract), `buildExtractionProvenance`
(provider/requested/actual model + modelMismatch + schema version + timestamp), and
`sanitizeContractExtractionResponse` — candidate-only (model can never set confirmed),
drops unknown keys, never fabricates. No competing adapter chains.

## 4. Feature-flag rollout
See `docs/architecture/CONTRACT_FLAG_ROLLOUT.md`. Order: base→split→normalize→review→
confirmation-gate→PDF→staging E2E→sign-off→prod. Production flags stay OFF until the
full DB-backed staging E2E passes and the owner signs off. Every flag is independently
reversible (additive design, no data migration).

## Consequences
- OFF golden byte-identical (`sha256 89611c7a…`); ON path proven on synthetic fixtures.
- Live DB-backed browser E2E requires Docker/Supabase (staging) — see
  `docs/runbooks/CONTRACT_STAGING_E2E_RUNBOOK.md`.
- TPS/EAD birth-cert and the legacy non-Core extract path are out of this vertical and
  remain on their existing flow (documented gap).
