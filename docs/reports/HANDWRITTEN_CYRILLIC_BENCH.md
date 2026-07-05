# HANDWRITTEN CYRILLIC BENCH — SKELETON (schema only, no run yet)

STATUS: HANDWRITTEN_CYRILLIC_BENCH_BLOCKED_BY_GT

HEAD: see the commit that introduces this file
WORKTREE: clean on commit

This is a SKELETON, not a benchmark run. No owner data has been scored under this schema
yet. Every table below is either empty or carries exactly one row of clearly-marked
FICTIONAL schema-example data. When real per-hand data becomes available it must drop
into this exact structure — do not restructure the tables to fit a run; extend the run to
fit the tables.

## Source of truth (no second ledger)

This file is NOT a ground-truth ledger and does not define new GT fields. It is a
reporting shell that will consume:
- `qa-private/ground-truth/*.json` → `_meta.handwritten_field_attrs` (per-field `hand_id`,
  `language_form`, `ground_truth_cyrillic`, etc. — the ONE GT ledger, per Non-Negotiable
  Law 1 in `docs/reports/HANDWRITTEN_CYRILLIC_ONE_BRAIN_PLAN.md`)
- `docs/reports/GT_PIPELINE_BENCH_2026-07-05.md` artifacts (per-field CORRECT/WRONG/MISS/
  FABRICATED verdicts, recognition-rate math, TIER-1 sample stamp)
- `docs/reports/DOCUMENT_POSTURE_PRE_READER_GATE.md` (`posture_gate`, `orientation_status`
  values to be joined onto each row)

Do not add a parallel field list, a parallel hand registry, or a parallel scoring
convention here. If a field needed by this bench is missing from the GT `_meta`, that is a
GT gap to close in the ledger — not a reason to invent a local schema.

## Current GT count (recounted from `_meta`, not estimated)

Recounted directly from `qa-private/ground-truth/*.json` → `_meta.handwritten_field_attrs`
(same count as `docs/reports/HANDWRITTEN_CYRILLIC_ONE_BRAIN_PLAN.md` §P2, cross-checked
here, not independently re-derived):

- **10** unique handwritten Cyrillic fields carry per-field `hand_id`/`language_form` attrs
- **2** hands present: `A` (birth certificate), `B` (military ID p1)
- **Target: 36+ unique fields / 3+ hands** before Phase A of this bench can run for real
- **Gap: 26+ fields, at least 1 new hand**
- The wider `_meta.owner_verified_fields` total (46) includes printed docs (passport, I-94,
  EAD) and must NOT be quoted as the handwritten-Cyrillic count — see the conflation
  correction already logged in the plan.

No number in this section was estimated, projected, or rounded up from a smaller sample.

## Readers in scope

- **Reader A** — `RaxTemur/HTR` sidecar (key-free HTR, native-resolution crop + contrast,
  per ADR-026; cannot abstain, so it is gated by `blankCropGate` before it sees a crop)
- **Reader B** — `Gemini 2.5` full-page/crop read, if already wired for the doc/field in
  question (per ADR-018/modelMatrix; `gemini-2.5-pro` is DISQUALIFIED for acceptance on
  handwritten certs today — it fabricates — so its candidate here is diagnostic/forensic
  only unless and until that changes)
- **Reader C** — downloaded UA TrOCR, **HISTORICAL BASELINE ONLY**, `NOT_ACTIVE_READER`
  (measured to fabricate on a blank crop 3/3 per `blankCropGate.ts` comment; kept in this
  bench purely as a fixed comparison point, never as a candidate for acceptance)

## Forbidden readers (do not add rows for these as active candidates)

- `Gemma4` as an active reader
- downloaded UA TrOCR as an **active** reader (Reader C above is baseline-only, not this)
- any new / random Ukrainian LLM introduced ad hoc for this bench
- model-based transliteration of any candidate (transliteration is deterministic-only,
  post-acceptance, per Law 5 / P6 of the plan)

## Blank-gate scope (must be stated honestly, not implied global)

`crop_readers_only` is the current true scope. `judgeBlankCrop`
(`apps/web/src/lib/docintel/ensemble/blankCropGate.ts`) is called by BOTH crop transports
— `htrSidecarProvider.ts` and `llmCropReader.ts` — before the model sees the crop, making
blank-crop fabrication structurally impossible on those two paths. The full-page LLM read
path (whole-image Gemini read, not a cropped field) is **NOT** gated by this check today
and has no separate blank/near-blank detector. Any row scored via a full-page read must
carry `crop_source = full_page` and must not be reported as blank-gated.

## Per-field metrics schema

Exact columns, in order. The table below carries only the header row and ONE example row
using FICTIONAL placeholder data, explicitly marked as schema example, not real data.

| doc_id | physical_doc_hash | doc_type | field_name | hand_id | ground_truth_cyrillic | reader_name | reader_candidate | exact_match | partial_match | CER | WER | empty_on_real_field | fabricated_extra_text | latency_ms | posture_gate | orientation_status | crop_source |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| EXAMPLE_ROW_NOT_REAL_DATA | EXAMPLE_HASH_0000 | fictional_birth_certificate | child_given_name | A | "Приклад" (schema example only, not real data) | raxtemur_htr_sidecar | "Прклад" (schema example only, not real data) | false | true | 0.14 | 1.0 | false | false | 812 | pass | upright | crop |

No further rows exist. This table must not be extended with synthetic or model-generated
rows — only with rows sourced from the real GT ledger once it is sufficient.

## Per-hand results

### Hand A
NO DATA YET — blocked by GT.
- exact match: _(pending)_
- CER: _(pending)_
- WER: _(pending)_

### Hand B
NO DATA YET — blocked by GT.
- exact match: _(pending)_
- CER: _(pending)_
- WER: _(pending)_

### Hand C
NO DATA YET — blocked by GT (hand C does not exist in the GT ledger yet; Phase A requires
at least 1 new hand beyond A and B).
- exact match: _(pending)_
- CER: _(pending)_
- WER: _(pending)_

## Allowed / forbidden verdicts

Allowed verdicts for this bench (per `docs/reports/HANDWRITTEN_CYRILLIC_ONE_BRAIN_PLAN.md`
§P4 exit criteria and general plan verdict discipline):
- `HANDWRITTEN_CYRILLIC_BENCH_PARTIAL`
- `HANDWRITTEN_CYRILLIC_READER_DEGRADED`
- `HANDWRITTEN_CYRILLIC_BLOCKED_BY_GT`
- `HANDWRITTEN_CYRILLIC_BLOCKED_BY_POSTURE`

Forbidden verdicts — never write these for this bench, under any circumstance:
- `HANDWRITING_SOLVED`
- `HTR_SOLVED`
- `LLM_SOLVED`

## NEXT_ACTIONS

Owner:
1. Fill `qa-private/ground-truth/OWNER_FILL_REQUIRED.md` docs 4–8 from physical originals.
   No model-generated ground truth is acceptable for this ledger (Non-Negotiable Law 2/3).
2. Produce 36+ unique handwritten Cyrillic fields across 3+ hands before Phase A of this
   bench can run for real.

Agent:
1. Once the GT ledger meets the 36+/3+ threshold, run the real per-hand bench: join
   `_meta.handwritten_field_attrs` with `GT_PIPELINE_BENCH` verdicts and posture-envelope
   markers, fill the per-field table and per-hand sections above with real measured rows.
2. Report only an allowed verdict from the list above — never a blended overall number
   without the per-hand breakdown alongside it.
3. Keep the blank-gate scope note (`crop_readers_only`) accurate as of the run date; if the
   full-page path gets a blank/near-blank detector, update the note and cite the commit.

## FINAL VERDICT

HANDWRITTEN_CYRILLIC_BENCH_BLOCKED_BY_GT
