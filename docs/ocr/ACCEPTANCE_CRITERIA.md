# OCR / Extraction — ACCEPTANCE CRITERIA (per-stage gates), 2026-06-28

**Documentation only.** This file defines the measurable gates each future stage MUST pass
**before** its feature flag is turned on. No runtime code, flags, providers, or tests were
changed to produce it.

> **No production readiness is claimed by this document.** A flag is enabled ONLY when (a) its
> gate below is green on a real run of the named bench/test, AND (b) the owner signs off. Passing
> a gate ≠ production-ready; it is the minimum bar to *unblock* a flag for further evaluation.

## How to read this file

- **Printed and handwriting are NEVER merged into one number.** Every accuracy gate is reported
  per-channel (printed-Cyrillic vs handwritten-Cyrillic) and, where applicable, per template.
  A single combined "OCR accuracy %" is a reporting violation and auto-fails the gate.
- **Acceptance is measured ONLY on the primary reader** (`gemini-2.5-pro`, per ADR-018 / CLAUDE.md).
  A fallback (flash) read is force-reviewed and may NEVER be reported as an acceptance number.
  If the primary is unavailable (429 / spend cap), the result is `BLOCKED_…`, not a flash number.
- **Metric source = the existing metrics engine.** The verdict taxonomy is already implemented in
  `apps/web/scripts/gt-pipeline-bench.mjs`:
  `CORRECT | WRONG | MISS | CORRECT_EMPTY | FABRICATED`, with
  `field-recognition rate = CORRECT / (CORRECT + WRONG + MISS + FABRICATED)` and `CORRECT_EMPTY`
  excluded from the denominator (`gt-pipeline-bench.mjs:20-27,148-164`). Do NOT invent a parallel
  scorer. Sibling benches: `evidence-bench.mjs` (raw-crop transcription), `ablation-bench.mjs`,
  `handwriting-trap-bench.mjs` (fabrication/abstention traps), `gemini-ensemble-bench.mjs`,
  `gemini-model-bench.mjs`, `gpt-pipeline-bench.mjs`, `transkribus-bench.mjs`.
- **Flag matrix companion:** `docs/ocr/FEATURE_FLAG_MATRIX.md` is the authoritative flag list.
  > NOTE (2026-06-28): that file does not yet exist in this tree; until it lands, the flag names
  > below are sourced from `docs/ocr/CURRENT_STATE.md`. When the matrix is authored, reconcile
  > the "Unblocks flag" column against it.
- **`TBD-by-owner`** marks every threshold whose number is not yet decided. Do not silently invent
  a number; the owner sets it, then it is recorded here.

## Gate prerequisites (apply to ALL accuracy gates)

A representative GT corpus must exist before any accuracy gate can be green. As of CURRENT_STATE.md
the corpus is N=1 birth-cert + a 2-hand HTR set (MISSING #8/#9). Required minimum corpus:

- Printed-Cyrillic set: ≥ **TBD-by-owner** distinct real docs across ≥ **TBD-by-owner** templates
  (UA-modern, Soviet-bilingual, RU), each with owner-verified GT JSON.
- Handwritten-Cyrillic set: ≥ **TBD-by-owner** distinct real docs / ≥ **TBD-by-owner** hands.
- GT stored only in gitignored `qa-private/` (NO real PII committed — memory: no-real-pii-fictional-only).
- Corpus manifest committed (paths + hashes, no PII) so a run is reproducible.

---

## Gate 1 — Printed Cyrillic baseline gate

Establishes that printed Cyrillic extraction is good enough to surface to a reviewer. The
handwriting 0% result MUST NOT be generalized here (CURRENT_STATE.md §F).

| Metric | Threshold (placeholder) | Measurement source |
|---|---|---|
| Per-field exact % (printed only), primary reader | ≥ **TBD-by-owner** % | `gt-pipeline-bench.mjs` field-recognition rate, printed subset |
| Document-exact % (all scored fields CORRECT in a doc) | ≥ **TBD-by-owner** % | `gt-pipeline-bench.mjs` (per-doc rollup — MISSING #7, must be added) |
| Wrong-field-assignment rate (value placed on wrong field) | ≤ **TBD-by-owner** % | `gt-pipeline-bench.mjs` WRONG attributed to field-mapping (MISSING #7) |
| CER (character error rate, printed) | ≤ **TBD-by-owner** | `gt-pipeline-bench.mjs` CER |
| FABRICATED rate (GT empty, read non-empty) | ≤ **TBD-by-owner** % | `gt-pipeline-bench.mjs` FABRICATED verdict |

- **Reported per template** (UA-modern / Soviet / RU); a single combined number auto-fails.
- **Unblocks flag:** printed-extraction acceptance path (e.g. `OCR_FIELD_SAFETY_ENABLED` for the
  printed channel) — green gate + owner sign-off required.
- **Hard fail conditions:** any combined printed+handwriting number; any number reported on a
  fallback/flash read; corpus below the Gate-prerequisite minimum.

## Gate 2 — Handwriting assisted-review gate (NEVER auto-finalize)

Handwriting recognition is NOT_PROVEN / failed (CURRENT_STATE.md §F; HTR 0/3; LLMs fabricate).
This gate does **not** certify handwriting accuracy — it certifies that the system **abstains
safely and routes to a human**. Auto-finalize of any handwritten field is forbidden regardless of
model (ADR-026 / CLAUDE.md).

| Metric | Threshold (placeholder) | Measurement source |
|---|---|---|
| Auto-finalize of handwritten fields | **0 (hard zero)** | review-state assertion + `negativeAbstentionBattery.test.ts` |
| Abstention precision (when it abstains, the read really was unreliable) | ≥ **TBD-by-owner** % | `handwriting-trap-bench.mjs` (blank-control + consistency traps) |
| Abstention recall (of unreliable reads, fraction abstained/flagged) | ≥ **TBD-by-owner** % | `handwriting-trap-bench.mjs` |
| Fabrication on blank/garbage control | **0 accepted** (must flag) | `handwriting-trap-bench.mjs` TRAP 1 (blank control) |
| Cross-run consistency (same doc, N reads) | distinct accepted values = **0** | `handwriting-trap-bench.mjs` TRAP 2 |
| Mandatory human review on every handwritten field | **100 %** | review-state contract (`contractReviewState.ts`) |

- **Unblocks flag:** HTR sidecar wiring / handwriting route (currently NOT wired) — and only into a
  forced-review state, never an acceptance state.
- **Hard fail conditions:** any handwritten field reaches `confirmed`/final without human action;
  any accepted value on the blank control.

## Gate 3 — bbox / evidence gate (real crops before the review UI shows them)

The review UI can render exact/combined/approximate crops, but the translation path produces NO
per-field bbox today, so it falls back to full-image / zone_fallback (CURRENT_STATE.md §D, MISSING
#2/#6). This gate proves real crops exist before the UI is allowed to claim them.

| Metric | Threshold (placeholder) | Measurement source |
|---|---|---|
| bbox coverage % (scored fields carrying a real per-field bbox) | ≥ **TBD-by-owner** % | `evidence-bench.mjs` + new per-field bbox tally (MISSING #7) |
| Exact-crop rate (crop tightly bounds the field, not full image) | ≥ **TBD-by-owner** % | `evidence-bench.mjs` |
| Full-image / zone_fallback rate | ≤ **TBD-by-owner** % | `EvidenceReviewPage.tsx` evidence_type distribution |
| Crop-region transcription matches field GT | ≥ **TBD-by-owner** % | `evidence-bench.mjs` raw transcription vs GT |

- **Unblocks flag:** review UI rendering real per-field crops (the `combined_bbox`/`evidence_crop_path`
  path in `EvidenceReviewPage.tsx`) instead of full-image fallback.
- **Hard fail conditions:** UI advertises exact crops while coverage is below threshold (showing
  full-image relabeled as "exact").

## Gate 4 — Consensus gate (only after a 2nd real engine works)

Today there is only ONE live reader (Gemini); Google Vision is text-only and EXTERNAL_BLOCKED,
Document AI is not wired (CURRENT_STATE.md §C, MISSING #4). Consensus is meaningless until a second
engine actually runs.

| Metric | Threshold (placeholder) | Measurement source |
|---|---|---|
| Second engine produces real field reads (not 403/blocked) | **2 engines live** | `gemini-ensemble-bench.mjs` / `gpt-pipeline-bench.mjs` / `transkribus-bench.mjs` |
| Engine-disagreement → routed to review | **100 %** | consensus logic (`autoDeliveryConsensus.ts`) + review-state assertion |
| Agreement-acceptance precision (auto-accepted agreements that are CORRECT) | ≥ **TBD-by-owner** % | ensemble bench vs GT |
| Consensus does NOT raise a single combined printed+HW number | enforced | reporting check (per-channel only) |

- **Unblocks flag:** multi-engine consensus / auto-delivery on agreement.
- **Hard fail conditions:** "consensus" enabled with only one live engine; any disagreement
  auto-finalized without review.

## Gate 5 — Confirmation gate / final-PDF gate (browser E2E first, no raw→PDF)

`FINAL_PDF_CONFIRMATION_GATE_ENABLED` is BUILT_BUT_OFF (CURRENT_STATE.md §B). A raw model read must
never reach a generated PDF without explicit per-field human confirmation. Real DB-backed browser
E2E is currently MISSING (#10, blocked: no Docker).

| Metric | Threshold (placeholder) | Measurement source |
|---|---|---|
| Real browser E2E (DB-backed) passes end-to-end | **green** | `apps/web/tests/e2e-contract/*` upgraded to real DB (MISSING #10) |
| Raw (unconfirmed) value reaching final PDF | **0 (hard zero)** | `finalPdfGate.test.ts` + E2E |
| Every released field carries `confirmed` state before PDF | **100 %** | `contractReviewState.ts` + `finalPdfGate.ts` |
| Leak check (no Cyrillic in English output) holds in PDF | **0 leaks** | `phase9VerticalProof.test.ts`, `noSilentStrip.guard.test.ts` |

- **Unblocks flag:** `FINAL_PDF_CONFIRMATION_GATE_ENABLED`.
- **Hard fail conditions:** any raw→PDF path; gate enabled while only mocked E2E exists.

## Gate 6 — Real-document PDF acceptance gate (before any pilot)

Real-document end-to-end PDF acceptance is not measured (MISSING #11). No pilot / external user
before this gate.

| Metric | Threshold (placeholder) | Measurement source |
|---|---|---|
| End-to-end PDFs on real docs reviewed & accepted by owner | ≥ **TBD-by-owner** docs | manual owner review on real corpus (gitignored `qa-private/`) |
| Per-channel acceptance (printed vs handwritten reported separately) | ≥ **TBD-by-owner** % each | owner sign-off log + `gt-pipeline-bench.mjs` rollup |
| Defects requiring rework (wrong field, leak, wrong transliteration) | ≤ **TBD-by-owner** | owner review checklist |
| Disclaimer correctness ("draft translation", not "certified") | **100 %** | content rules (CLAUDE.md CONTENT RULES) |

- **Unblocks flag:** pilot / external-facing release of the translation+PDF flow.
- **Hard fail conditions:** any pilot before this gate is green with owner sign-off; combined
  printed+HW acceptance number.

---

## Sign-off rule (binding)

For each gate: record (1) the exact bench/test command + output, (2) the corpus manifest hash,
(3) per-channel numbers, (4) owner sign-off (name + date) in `HANDOFF.md` / `CHANGELOG.md`. Only
then may the corresponding flag be flipped on, and only that flag. Enabling a flag without its
green gate + owner sign-off is a process violation.
