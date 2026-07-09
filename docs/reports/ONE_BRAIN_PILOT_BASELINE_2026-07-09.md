# ONE BRAIN — PILOT BASELINE (2026-07-09) — locked, do not overclaim

Phase A of translation_shadow_v1. This CEMENTS the pilot as the reference baseline. PII-free.

## Config (reproducibility)
- branch: `feat/one-brain-reader-result`
- prompt-version commit (handwriting v2 = data-field, not signature): `fb9de48f`
- baseline doc commit: this commit
- measured on preview: `uscis-helper-du5fk28te-...vercel.app` (Vercel PREVIEW, pre-production — NOT live prod)
- endpoint: `POST /api/diag/intake` (the SAME DocumentIntakeBrain the Translation shadow runs)
- providers: intake vision = OpenAI `gpt-4.1` (strict json), orientation = Gemini; DeepSeek NOT used for vision
- mode: incognito — NO docType/language/country/orientation hint; raw file only; PII-free output

## Dataset (21 real docs, IDs only — no PII)
doc_001 birth_certificate hw=T (civil_record) · doc_002 marriage_certificate hw=T (civil_record)
doc_003/004 military_id hw=T (unknown) · doc_005-008/021 booklet hw=F (passport)
doc_009/010 passport hw=F (passport) · doc_011/012 dl hw=F (unknown)
doc_013-016 ead hw=F (us_immigration) · doc_017-020 i94 hw=F (us_immigration)

## Per-family N (trust target N>=25/family) — NONE MET → pilot only
- civil_record N=2 · passport N=7 · us_immigration N=8 · unknown N=4  → all < 25 = PILOT

## Metrics (measured, split — do NOT conflate)
- **docType** (self-detected vs manifest hint, mappable): **19/19 = 100%** (birth/marriage/passport/ead/i94)
- **country** (SU/UA/US): correct on measured rows
- **handwriting detection** (handwritingPresent vs GT): **76%** (v2, up from 57% v1)
- **review-policy** (separate metric): 5 passport SAFE false-positives (over-review), 0 handwriting false-negatives
- **runtime**: ~14 s/doc, 21/21 ran, 0 errors, 0 504

## The 5 passport FP cases (doc_005-008, 021) — SAFE false-positive REVIEW, NOT a docType failure
docType was CORRECT (passport) for all 5. Only handwritingPresent over-fired (booklet signature) → extra
review. Consequence = worse UX, NOT a legal risk. A false-NEGATIVE (handwriting missed → auto-final) would
be the dangerous case, and that did NOT happen. classifier_prompt and review_policy_prompt are separate;
do not degrade the 100% docType prompt to fix this review-policy FP.

## Allowed claims
- "21-doc pilot proves docType classification works on this pilot set."
- "country detection correct on measured rows."
- "handwriting detection improved from 57% to 76%."

## Forbidden claims (NOT proven)
- family trusted · production ready · Translation flipped · handwriting solved · all passport review solved
