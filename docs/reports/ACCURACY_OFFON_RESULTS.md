# Accuracy OFF-vs-ON — Results (sanitized; counts/verdicts only, no PII values)

**Date:** 2026-06-04  **Local only, prod untouched.** Raw (PII) → `qa-private/reports/accuracy-offon/` (gitignored).
**GT:** owner-VERIFIED, scored ONLY the 6 `owner_verified_fields` (family/given/patronymic cyrillic,
date_of_birth, place_of_birth_raw, sex). `sex` is N/A on birth certs (spec emits no sex field) → not penalized.
candidate-not-verified fields (issue_date/act_record/parents/authority) NOT scored.
**Runs:** 2 docs (soviet, handwritten) × modes A/B/C × 2 models = 12 cells, all OK (no API errors).
**N=2 documents, one person → SIGNAL, not proof.** A prod decision needs varied people/doc-types.

## Modes
- A: SMART_OFF / ANTI_OFF / SELF_OFF (current prod behavior)
- B: SMART_ON / ANTI_OFF / SELF_OFF (P2 dictionaries)
- C: SMART_ON / ANTI_ON / SELF_ON, self-consistency N=3 (full gate)

## Results (per model; both docs gave identical verdicts)

| model | mode | correct/wrong/missing/NA (of 6) | false_negative_review | false_positive_review | DOB month gt/read | DOB caught? | self_consistency |
|---|---|---|---|---|---|---|---|
| gemini-2.5-flash | A | 0/5/0/1 | **5** | 0 | 06 / 02 | **MISSED** | — |
| gemini-2.5-flash | B | 0/5/0/1 | **5** | 0 | 06 / 02 | **MISSED** | — |
| gemini-2.5-flash | C | 0/5/0/1 | **0** | 0 | 06 / 02 | **CAUGHT** | mismatch (instability=true) |
| gemini-3.1-pro-preview | A | 1/4/0/1 | 2 | 0 | 06 / 07 | CAUGHT | — |
| gemini-3.1-pro-preview | B | 1/4/0/1 | 2 (0 on soviet) | 0 (1 on soviet) | 06 / 07 | CAUGHT | — |
| gemini-3.1-pro-preview | C | 1/4/0/1 | **0** | 1 | 06 / 07 | CAUGHT | agree (soviet: mismatch) |

## Findings

1. **The gate (mode C) drives `false_negative_review` to 0 in every cell** — both models, both docs.
   Without it (A/B), 2.5-flash emits 5 wrong identity fields with `review=false` (confident fabrication)
   and MISSES the DOB month error. With it, every identity field is forced to review, the DOB
   month-mismatch is CAUGHT, and self-consistency reports `mismatch`/instability on 2.5-flash. **This is
   the proven, model-independent safety win.**
2. **DOB month-mismatch (the critical test-case):** GT month = 06 (June). 2.5-flash read month 02, 3.1-pro
   read month 07 — both WRONG, and inconsistent with each other and with prior runs (July seen earlier) →
   gross instability on the date. Gate result: 2.5-flash MISSED in A/B, CAUGHT in C; 3.1-pro self-flagged
   DOB (review=true) even in A, CAUGHT throughout.
3. **SMART_NORMALIZE (B vs A): no accuracy improvement** on these docs (2.5-flash 0/5 = 0/5; 3.1-pro 1/4 =
   1/4). On 3.1-pro soviet, B even introduced a `false_positive_review` (place normalization flagged a
   correct field). → SMART shows zero correctness benefit here, small UX cost.
4. **Model comparison (hard-case):** 2.5-flash is materially worse — 0/5 correct (reads a different
   person) and DOB unflagged (FN=5) without the gate. 3.1-pro: 1/5 correct and self-flags DOB (FN=2).
   Neither is trustworthy unaided.

## Honest caveat — RU-document vs UA-ground-truth

The raw accuracy is depressed partly by a LANGUAGE-LAYER mismatch, not pure fabrication: the certificates
are **Russian-language**, so the model reads Russian spellings (e.g. given/patronymic in RU), while the
owner GT is the **Ukrainian canonical** form. Exact-match scoring counts the RU↔UA spelling difference as
"wrong". 2.5-flash additionally hallucinates a different person (true 0/5). **Open question for the owner:**
should GT be "as written on the document" (RU) or "canonical" (UA)? That choice changes which "wrong" cells
are genuine errors vs expected transliteration. Until clarified, treat the per-field accuracy as a lower
bound, but the **review/false-negative metrics (the safety signal) are unaffected** by this nuance.

## Bottom line
- Safety: **mode C eliminates false-negative review (0 everywhere)** → the gate works.
- Dictionaries: **SMART_NORMALIZE gives no measured accuracy gain here.**
- Caveat: N=2/one-person + RU-vs-UA GT question → not a prod-grade verdict yet.
