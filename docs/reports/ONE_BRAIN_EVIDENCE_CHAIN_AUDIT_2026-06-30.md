# One-Brain Evidence Chain Audit (2026-06-30)

STATUS: DEGRADED

Scope audited:
`provider bbox/layout -> EvidenceRegion adapter -> ReaderResult -> candidate -> Decision Engine -> API response -> TranslateWizard review UI -> visible crop/highlight`

## Verified

1. `EvidenceRegion` is a real, centralized contract and enforces the honesty invariant (`exact` requires a real bbox; `full_image`/`missing` cannot fake one).
   - Source: `apps/web/src/lib/docintel/evidence/EvidenceRegion.ts`

2. Provider-side evidence adapters exist and are tested:
   - deterministic template path: `templateEvidenceForDocType()`
   - OCR token locator: `locateFieldEvidence()`
   - Source: `apps/web/src/lib/docintel/evidence/evidenceAdapters.ts`, `apps/web/src/lib/docintel/evidence/visionBboxLocator.ts`

3. The recognition spine itself is real and tested:
   - `readDocument(...)` is the live entry point
   - `recognizeDocument(...)` is the one-brain orchestrator behind the flag
   - `applyKnowledgeBrainIfEnabled(...)` + `buildCanonicalResult(...)` are the live decision path
   - Source: `apps/web/src/lib/docintel/documentFieldReader.ts`, `apps/web/src/lib/docintel/recognizeDocument.ts`, `apps/web/src/lib/canonical/core/arbitration.ts`

4. Translation route attaches user-visible evidence today only through the route-local template path.
   - `templateEvidenceForDocType(docTypeId)` is called in `api/translation/vision-extract`
   - evidence is attached after `toTranslationRows(...)`
   - Source: `apps/web/src/app/api/translation/vision-extract/route.ts`

5. The review UI does render a visible crop/highlight when evidence is present and honest.
   - page mismatch no longer falls back to page 1
   - non-field-level evidence (`full_image`, `missing`, `zone_fallback`) renders nothing
   - Source: `apps/web/src/components/services/translation/fieldEvidenceCrop.ts`, `apps/web/src/components/services/translation/TranslateWizard.tsx`

## Critical Findings

### 1. The promised provider-bbox chain is NOT end-to-end live
Severity: HIGH

What is true:
- `ReaderFieldObservation` has `evidenceRegion?: ReaderEvidenceRegion | null`

What is not true:
- the live Gemini adapter `readerResultFromVision(...)` does not populate `evidenceRegion`
- `docintelToCandidate(...)` does not accept or forward any geometry
- `FieldCandidate` has no bbox/evidence-region channel
- `CanonicalField.evidence[]` is semantic candidate provenance, not visual bbox evidence

Result:
- provider-localized bbox/layout does **not** currently survive the live path
  `ReaderResult -> candidate -> arbitration -> CanonicalDocumentResult -> FieldOut`
- the visible crop shown in the translation wizard is not sourced from the live provider/layout chain

Impacted files:
- `apps/web/src/lib/docintel/readers/ReaderResult.ts`
- `apps/web/src/lib/canonical/core/translationAdapter.ts`
- `apps/web/src/lib/canonical/core/types.ts`
- `apps/web/src/lib/canonical/types.ts`

### 2. `visionBboxLocator` exists but is dark code relative to the live translation review flow
Severity: HIGH

Verified:
- `locateFieldEvidence(...)` is implemented and tested
- no live route currently calls it
- `api/translation/vision-extract` uses `templateEvidenceForDocType(...)`, not `locateFieldEvidence(...)`

Result:
- exact/combined OCR-token evidence is not reaching the client
- current review crop is template-backed only

Impacted files:
- `apps/web/src/lib/docintel/evidence/visionBboxLocator.ts`
- `apps/web/src/app/api/translation/vision-extract/route.ts`

### 3. Visible crop coverage is narrow and doc-type-specific
Severity: MEDIUM

Verified:
- current evidence attachment is limited to doc types covered by `FIELD_BOX_TEMPLATES`
- current documented coverage is effectively `ua_birth_certificate`
- passport path returns zero evidence regions in this payoff path

Result:
- the review UI crop/highlight is a real feature, but only for a narrow deterministic template subset
- it is not a general provider-bbox visualization layer

### 4. Multi-region UI bottleneck was real and is now closed locally
Severity: CLOSED_LOCAL

Was true during the audit:
- `TranslateWizard` collapsed `evidence[]` to the first item

Now true:
- the wizard preserves the full `evidence[]` array
- the client renders every honest region whose page preview exists

Limit still remaining:
- the backend still emits at most one template region per field today, so this fix removes a local UI bottleneck but does not by itself create provider-driven multi-region evidence

## Runtime/Test Evidence

- Targeted evidence-chain tests:
  - `fieldEvidenceCrop.test.ts`
  - `evidenceAdapters.test.ts`
  - `visionBboxLocator.test.ts`
  - `readerProviderSelect.test.ts`
  - `recognizeDocument.test.ts`
  - Result: 36/36 PASS

- Translation route tests:
  - `visionExtractCorePath.test.ts`
  - `translationCanonicalCutover.test.ts`
  - `translationPipelineFixtureE2E.test.ts`
  - Result: 23/23 PASS

- Full web suite:
  - 378 files passed, 5 skipped
  - 5085 tests passed, 26 skipped

- Build:
  - PASS

- Typecheck:
  - first run failed on stale `.next/types` include targets
  - rerun after `next build` passed cleanly
  - this is an environment/worktree generation issue, not a code-path error in the audited chain

## Honest Verdict

The user-visible translation evidence payoff is real, but it is **not** yet the full provider-driven chain implied by the architecture prompt.

Current truth:
- live review crop/highlight = PASS for the scoped template-backed translation path
- general provider bbox/layout -> decision engine -> UI evidence chain = NOT COMPLETE
- exact OCR-token evidence path exists in code, but is not wired into the live translation route

## Next Exact Step

Do not claim full bbox/layout convergence yet. The next engineering step is to thread visual evidence as first-class data from reader output through candidate/arbitration/adapter boundaries, or explicitly scope the product truth to "template-backed translation evidence only".
