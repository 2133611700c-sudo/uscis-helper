# Acceptance — USCIS Document Translation MVP

**Status:** MVP **NOT READY**. This file defines the gates; nothing here is enabled.

## Immovable rules (apply to all stages)
1. Gemini/OCR output is a **candidate**, never a fact.
2. `raw_cyrillic` is never overwritten.
3. translation / transliteration / normalization / confirmation are **separate layers**.
4. A field without evidence cannot be auto-confirmed.
5. An unreadable value becomes `null` + an `AbstentionReason`, never a guess.
6. Handwriting is **manual-review only** until a separate, proven HTR benchmark.
7. Unconfirmed / unreadable / conflicting fields **cannot** reach the final PDF.
8. Do NOT rebuild existing components: `EvidenceReviewPage`, RU/UA validators, raw immutability,
   review states, HTR route, metrics engine, `finalPdfGate`.
9. Do not enable production flags without acceptance evidence.
10. Do not claim production readiness from unit tests or synthetic vectors.

## Engineering stages (gated; each unlocks the next)
1. **Scope + runtime map** — this folder (docs only). ✅ done.
2. **Corpus gate** — ≥20–30 printed GT docs (verified fields + expected translation + template +
   holdout). **STOP if absent** with an exact missing list. (Status: see Stage-2 report — corpus
   not present in this worktree.)
3. **Provider preflight** — safe single-document call to Gemini / Vision / Document AI. If 429/403
   persist → STOP with exact owner action.
4. **Printed baseline** — compare providers/combinations on one corpus (field-exact, CER, wrong-field,
   missing, fabricated, bbox coverage, exact-crop, latency, cost). Choose engine **only** from results.
   Scoring uses the Stage-2 metrics module `apps/web/src/lib/ocr/metrics/`.
5. **Evidence integration** — feed chosen OCR/layout bbox into the EXISTING review UI
   (`OCR bbox → EvidenceRegion → FieldCandidate → evidence_crop_path → EvidenceReviewPage`); add tests.
6. **Abstention + gates** — formal `AbstentionReason`, conflict handling, fail-closed critical-field rules.
7. **Real browser E2E** — full non-mocked path through a production-like environment.
8. **PDF acceptance** — all expected translation text; original Cyrillic preserved in audit layer;
   names/dates/numbers correct; no duplicates; no unresolved fields; certification complete; PDF stored
   + downloadable.

## MVP-ready checklist (ALL required)
- [ ] ≥30 real printed GT documents processed
- [ ] 100% original Cyrillic preserved
- [ ] 0 fabricated confirmed values
- [ ] 0 unresolved critical fields in final PDF
- [ ] 0 unconfirmed fields in final PDF
- [ ] 100% PDFs downloadable
- [ ] 100% certifications contain required fields
- [ ] all real E2E steps pass (no mocks)
- [ ] API cost measured
- [ ] operator review process documented
- [ ] field-exact target set **after** baseline (do NOT pre-claim 95%)

## Pilot (Stage 8)
5–10 real orders, printed birth certificates only, mandatory operator review, all corrections
logged, time + API cost measured, result checked before delivery, refund if translation impossible.
After pilot → decide whether to expand document types.

## Final status vocabulary (allowed values only)
- **DOCUMENT TRANSLATION MVP READY FOR CONTROLLED PILOT** — only if: real printed GT corpus exists;
  printed baseline measured; no fabricated confirmed values; no unresolved critical fields in PDF;
  review evidence works; browser E2E passes without mocks; payment test passes; final PDF exists in
  Storage + downloads; rollback documented; worktree clean; local SHA == remote.
- **DOCUMENT TRANSLATION MVP NOT READY** — otherwise, with the exact blockers listed.

Current: **DOCUMENT TRANSLATION MVP NOT READY.** Blockers: no real printed GT corpus (owner);
Gemini 429 + Vision/DocAI 403 (owner billing/quota); no printed baseline; no evidence bbox in
translation path; no non-mocked browser E2E. None are code-only-solvable by the agent.
