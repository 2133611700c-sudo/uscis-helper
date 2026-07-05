# GT Pipeline Bench — 2026-07-05 · LIVE (prod /api/translation/vision-extract)

Per-field accuracy of the production read vs owner-verified GT. Field names + verdicts only — NO personal values.
Verdict taxonomy: CORRECT / WRONG / MISS (GT non-empty, read empty) / FABRICATED (GT empty, read non-empty) / CORRECT_EMPTY (both empty).
**Recognition rate = CORRECT / (CORRECT+WRONG+MISS+FABRICATED)** — CORRECT_EMPTY excluded; an empty read can NEVER inflate it.
Verdict stamp: **TIER-1 sample** (per GT_BENCHMARK_EXIT_CRITERIA: <30 scored fields/class ⇒ direction only).

## international_passport (printed + MRZ)
- http 200 · status `ok:core-b2` · model `gemini-2.5-pro` · fields_returned 8 · downscaled from 4.1MB (>4MB edge limit)

| field | channel | verdict | present | review |
|---|---|---|---|---|
| family_name | latin | ✓ | ✓ | review |
| given_name | latin | ✗ WRONG | ✓ | review |
| dob | latin | ✓ | ✓ | review |
| sex | latin | ✓ | ✓ | ok |

**Recognition rate: 75.0%** — CORRECT 3 · WRONG 1 · MISS 0 · FABRICATED 0 · empty-ok 0
**AUTO-FILLED correctly (no human): 1/4 = 25.0%** (correct value AND review_required=false)

## birth_certificate (handwritten)
- http 200 · status `ok:core-b2` · model `gemini-2.5-pro` · fields_returned 12 · downscaled from 7.1MB (>4MB edge limit)

| field | channel | verdict | present | review |
|---|---|---|---|---|
| child_family_name | latin | ✗ WRONG | ✓ | review |
| child_given_name | latin | ✓ | ✓ | review |
| child_patronymic | latin | ✗ WRONG | ✓ | review |
| dob | latin | ✓ | ✓ | review |
| sex | latin | ∅ MISS | ✗ | — |

**Recognition rate: 40.0%** — CORRECT 2 · WRONG 2 · MISS 1 · FABRICATED 0 · empty-ok 0
**AUTO-FILLED correctly (no human): 0/5 = 0.0%** (correct value AND review_required=false)

## birth_certificate (Soviet bilingual)
- http 200 · status `ok:core-b2` · model `gemini-2.5-pro` · fields_returned 12 · downscaled from 7.1MB (>4MB edge limit)

| field | channel | verdict | present | review |
|---|---|---|---|---|
| child_family_name | latin | ✗ WRONG | ✓ | review |
| child_given_name | latin | ✓ | ✓ | review |
| child_patronymic | latin | ✗ WRONG | ✓ | review |
| dob | latin | ✓ | ✓ | review |
| sex | latin | ∅ MISS | ✗ | — |

**Recognition rate: 40.0%** — CORRECT 2 · WRONG 2 · MISS 1 · FABRICATED 0 · empty-ok 0
**AUTO-FILLED correctly (no human): 0/5 = 0.0%** (correct value AND review_required=false)

## military_id_p1 (printed+hw)
- http 200 · status `ok:core-b2` · model `gemini-2.5-pro` · fields_returned 5 · downscaled from 4.8MB (>4MB edge limit)

| field | channel | verdict | present | review |
|---|---|---|---|---|
| family_name | latin | ✓ | ✓ | ok |
| given_name | latin | ✓ | ✓ | ok |
| patronymic | latin | ✓ | ✓ | review |
| dob | latin | ∅ MISS | ✓ | review |
| sex | latin | ∅ MISS | ✗ | — |

**Recognition rate: 60.0%** — CORRECT 3 · WRONG 0 · MISS 2 · FABRICATED 0 · empty-ok 0
**AUTO-FILLED correctly (no human): 2/5 = 40.0%** (correct value AND review_required=false)

## international_passport (owner photo)
- http 200 · status `ok:core-b2` · model `gemini-2.5-pro` · fields_returned 8

| field | channel | verdict | present | review |
|---|---|---|---|---|
| family_name | latin | ✓ | ✓ | review |
| given_name | latin | ✓ | ✓ | review |
| dob | latin | ✓ | ✓ | review |
| sex | latin | ✓ | ✓ | ok |

**Recognition rate: 100.0%** — CORRECT 4 · WRONG 0 · MISS 0 · FABRICATED 0 · empty-ok 0
**AUTO-FILLED correctly (no human): 1/4 = 25.0%** (correct value AND review_required=false)

## us_i94 (printout)
- http 200 · status `ok:core-b2` · model `gemini-2.5-pro` · fields_returned 10

| field | channel | verdict | present | review |
|---|---|---|---|---|
| family_name | latin | ✓ | ✓ | review |
| given_name | latin | ✓ | ✓ | review |
| date_of_birth | latin | ✓ | ✓ | review |
| i94_admission_number | latin | ✓ | ✓ | review |
| i94_class_of_admission | latin | ✓ | ✓ | review |
| i94_date_of_entry | latin | ✓ | ✓ | review |

**Recognition rate: 100.0%** — CORRECT 6 · WRONG 0 · MISS 0 · FABRICATED 0 · empty-ok 0
**AUTO-FILLED correctly (no human): 0/6 = 0.0%** (correct value AND review_required=false)

## us_ead (card)
- http 200 · status `ok:core-b2` · model `gemini-2.5-pro` · fields_returned 8

| field | channel | verdict | present | review |
|---|---|---|---|---|
| family_name | latin | ✓ | ✓ | review |
| given_name | latin | ✓ | ✓ | review |
| card_number | latin | ∅ MISS | ✓ | review |
| a_number | latin | ∅ MISS | ✓ | review |
| ead_category | latin | ∅ MISS | ✓ | review |

**Recognition rate: 40.0%** — CORRECT 2 · WRONG 0 · MISS 3 · FABRICATED 0 · empty-ok 0
**AUTO-FILLED correctly (no human): 0/5 = 0.0%** (correct value AND review_required=false)

## Summary

| scope | CORRECT | WRONG | MISS | FABRICATED | empty-ok | recognition rate |
|---|---|---|---|---|---|---|
| ua_international_passport | 7 | 1 | 0 | 0 | 0 | 87.5% |
| ua_birth_certificate | 4 | 4 | 2 | 0 | 0 | 40.0% |
| ua_military_id | 3 | 0 | 2 | 0 | 0 | 60.0% |
| us_i94 | 6 | 0 | 0 | 0 | 0 | 100.0% |
| us_ead | 2 | 0 | 3 | 0 | 0 | 40.0% |
| **OVERALL** | 22 | 5 | 7 | 0 | 0 | **64.7%** |

Scored fields (denominator) = 34. Verdict: **TIER-1 sample**.
