# One Brain Intake — Mainline Integration (2026-07-10)

**Mode: NO_ILLUSIONS.** This PR lands the One Brain **intake foundation** onto `main`'s history
so it stops being an untracked prototype. It changes **no** production behaviour.

## Why COPY, not merge (critical finding)

`main` (`c24b253d`) and the prototype branch `feat/one-brain-reader-result` (`842a3f68`) have
**NO common git ancestor** (`git merge-base` → empty; `main` is 1097 commits with no shared base).
Cause: the PII-purge repo delete+recreate rewrote `main`'s history entirely.

Consequences (verified):
- `git diff main...feat` and `gh pr create feat→main` are mechanically broken (unrelated histories).
- Merging `feat` would drag in the **pre-purge history** and risks **re-introducing purged PII**.

Therefore the foundation was brought over as a **working-tree file copy onto a fresh branch off
`main`** (`feat/one-brain-intake-foundation`), carrying **zero** of the old history.

## What this PR adds (27 files, all previously ABSENT on main)

- Intake nodes: `docintel/intake/{canonicalRegistry,contracts,documentIntakeBrain,realProviders,
  shadowRunner,trace,arbitration,c3,evidenceReport,metrics}.ts` + `providers/{availability,
  ruleAnchorClassifier}.ts`
- Detectors: `detectLanguageCountry.ts`, `detectDocumentType.ts`, `orientation/detectOrientation.ts`,
  `docReadingRules.ts` (transitive dep)
- Diag endpoint: `api/diag/intake/route.ts` (404-gated behind `DIAG_ORIENT_ENABLED`)
- Tests: 11 intake `__tests__/*` + `providers/__tests__/providers.test.ts`

## Static verification done before commit (no node_modules present locally)

- **Import completeness:** 27/27 files parsed, 50 internal imports, **0 unresolved paths**.
- **Integration seams:** only **4** pre-existing `main` modules are imported by the foundation;
  **all 8 imported symbols exist on main** — `DOCUMENT_TYPES`, `getDocTypeSpec`
  (`documentRegistry.ts`), `primaryGeminiModel` (`geminiVisionProvider.ts`), `getGeminiApiKey`
  (`gemini/apiKey.ts`), `computeCacheKeySha`, `estCostUsdMicros`, `sha256Hex`, `withOcrCostMetrics`
  (`v1/ocrCostMetrics.ts`).
- **No external fixtures / no PII:** intake tests are self-contained (mocked providers); no
  `qa-private` / real-doc / image-fixture dependencies.
- **Authoritative typecheck/build/test** is delegated to this PR's CI (local `node_modules` absent;
  install is intentionally not run per the hardened-install contract).

## What this PR explicitly does NOT do / NOT claim

- **No production wiring.** Nothing on any live route calls this code — it is dead-but-present until
  a later PR wires the Translation shadow hook (default OFF) with a shadow-off proof.
- Not production flipped · not family-trusted · not `N>=25/family` · not handwriting solved ·
  not TPS/EAD/Re-Parole migrated · not field-recognition changed.

## Next steps (separate PRs, staged)

1. Wire `runIntakeShadow` into the Translation route behind `ONE_BRAIN_INTAKE_SHADOW` (default OFF)
   + shadow-off proof tests (zero provider calls, byte-identical response).
2. Preview-only shadow window; collect `N>=25/family` before any trust claim.
3. Recognition-reality report (intake detection ≠ field extraction).
