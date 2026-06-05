# Target Recognition Architecture — D0 → D6 + Auditor

**Date:** 2026-06-05. The end-state. This is NOT the current reality (see `RECOGNITION_SYSTEM_TRUTH_MAP.md`).
Binding rules across all layers: no silent correction (a dictionary signals, never rewrites); Ukrainian source
text is the truth (a Russianized output is a model error to penalize); raw model output is never ground truth;
no production threshold/model decision from single-person GT.

```
D0 intake/quality → D1 independent readers → OneBrain.decideField → D2 knowledge(signal)
→ D3 translation → D4 validators → D5 review UI → D6 PDF → Auditor/provenance
```

## D0 — Intake / quality (accept · degraded · reshoot_required)
The 80-year-old uploads a photo; the system decides if it is readable BEFORE any model spend.
- Signals: rotation, blur, crop/edge-cutoff, contrast, document bounds, page orientation.
- Output is a quality verdict only: `accept` | `degraded` | `reshoot_required` — NOT a fabrication signal
  (blur ≠ fabrication). UI shows a plain instruction ("photo is blurry / document is cropped / retake").
- Current: `sharp`/preprocess computes some signals but they do NOT reach `readDocument`. Gap to close.

## D1 — Reader layer (not "one Gemini forever")
A formal `ReaderResult` contract so adding a reader is additive, not a rewrite. NO prod fan-out yet.
```
ReaderResult { reader_id, provider/model, document_class, fields[], confidence, raw_text?,
               source_spans/crops?, errors[], cost, latency_ms }
```
- Gemini = reader_1 (live). GPT-4o = adapter stub (disabled). HTR = adapter stub (disabled).
- Phase 3 only formalizes the interface + maps the current Gemini output onto it (no behavior change).

## OneBrain — field decision center (one judge, not three brains)
`decideField(reads[], quality, dictionarySignals, validationSignals, selfConsistency, antiFab)` →
`{ raw_value, normalized_value, decision, review_required, review_reasons, provenance, audit_hash }`.
- Shadow-first: live output unchanged; OneBrain only writes a sanitized decision-comparison for evaluation.
- Rules: dictionary = signal not truth; no silent correction; doubt → review with provenance.

## D2 — Knowledge assets (validate, don't guess)
- Unicode NFC for compare/hash; preserve raw; normalize apostrophes safely (never drop the UA `ʼ`).
- KMU-55 UA→English transliteration, applied ONLY after a correct Ukrainian read.
- Gazetteer (КАТОТТГ / validated source): exact → normalize; fuzzy → suggestion + review (never silent snap).
- Authority resolver (ЗАГС/РАЦС/ДРАЦС/МВС…): phrase-level, era-aware (Міліція@1986 → Militsiya, not Police).
- Patronymic: validation-only; never reconstruct from the holder's given name (that is the father's name).

## D3 — Translation (English only after a correct Ukrainian read)
- Names / dates / numbers LOCKED before any prose translation.
- DeepSeek/LLM translates prose only; no translator ever touches identity values.

## D4 — Validators / ОТК (release blocked on critical inconsistency)
Dates valid; DOB not in the future; issue date after DOB; sex enum; passport/doc-number format; forbidden
phrases; missing critical identity; any unresolved review field → block.

## D5 — Review UI (the human actually sees what to check)
Crop next to the field + value + why-review + confirm/correct + audit trail; no payment/download until every
critical review field is closed. (Partly live for Translation; generalize as one shared component.)

## D6 — PDF / release (confirmed values only)
Block while review unresolved; use confirmed DB values; audit source-to-final mismatch; never leak a hidden
raw/uncertain value into the PDF. (Live for Translation via `generate-pdf` + `reviewGate`.)

## Auditor — provenance + learning loop
Each user correction becomes an evaluation/GT-candidate signal: `{field_before, field_after, reason,
document_class, reader_id}` — PII-free in public logs; private GT candidate stored separately. Feeds later
HTR/model evaluation. Never auto-promotes model output to ground truth.

## What gates the deep layers
- OneBrain wiring + calibration is BLOCKED on **GT from different people** (current N ≈ 1 person).
- HTR / GPT-4o second reader = research only, justified by metrics (hard-case review rate), AFTER GT breadth.
- SMART_NORMALIZE stays OFF. No model switch without owner GT + traffic metrics.
