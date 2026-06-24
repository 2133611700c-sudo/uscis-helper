# GT Pipeline Bench — 2026-06-23 · LIVE (prod /api/translation/vision-extract)

Per-field accuracy of the production read vs owner-verified GT. Field names + verdicts only — NO personal values.
Verdict taxonomy: CORRECT / WRONG / MISS (GT non-empty, read empty) / FABRICATED (GT empty, read non-empty) / CORRECT_EMPTY (both empty).
**Recognition rate = CORRECT / (CORRECT+WRONG+MISS+FABRICATED)** — CORRECT_EMPTY excluded; an empty read can NEVER inflate it.
Verdict stamp: **EXPLORATORY (N<30 scored fields — NOT canary approval)** (per GT_BENCHMARK_EXIT_CRITERIA: <30 scored fields/class ⇒ direction only).

## internal_passport_booklet (handwritten)
- http 200 · status `ok:core-b2` · model `gemini-3.1-pro-preview` · fields_returned 8 · downscaled from 4.1MB (>4MB edge limit)

| field | channel | verdict | present | review |
|---|---|---|---|---|
| family_name | latin | ✓ | ✓ | ok |
| given_name | latin | ✓ | ✓ | ok |
| patronymic | latin | ∅ MISS | ✓ | review |
| dob | latin | ∅ MISS | ✓ | review |
| sex | latin | ✓ | ✓ | ok |

**Recognition rate: 60.0%** — CORRECT 3 · WRONG 0 · MISS 2 · FABRICATED 0 · empty-ok 0
**AUTO-FILLED correctly (no human): 3/5 = 60.0%** (correct value AND review_required=false)

## birth_certificate (handwritten)
- ERROR: timeout(90s)

## birth_certificate (Soviet bilingual)
- http 200 · status `ok:core-b2` · model `gemini-3.1-pro-preview` · fields_returned 12 · downscaled from 7.1MB (>4MB edge limit)

| field | channel | verdict | present | review |
|---|---|---|---|---|
| child_family_name | latin | ✗ WRONG | ✓ | review |
| child_given_name | latin | ✗ WRONG | ✓ | review |
| child_patronymic | latin | ✗ WRONG | ✓ | review |
| dob | latin | ✓ | ✓ | review |
| sex | latin | ∅ MISS | ✗ | — |

**Recognition rate: 20.0%** — CORRECT 1 · WRONG 3 · MISS 1 · FABRICATED 0 · empty-ok 0
**AUTO-FILLED correctly (no human): 0/5 = 0.0%** (correct value AND review_required=false)

## military_id_p1 (printed+hw)
- http 200 · status `ok:core-b2` · model `gemini-3.1-pro-preview` · fields_returned 5 · downscaled from 4.8MB (>4MB edge limit)

| field | channel | verdict | present | review |
|---|---|---|---|---|
| family_name | latin | ✓ | ✓ | ok |
| given_name | latin | ✓ | ✓ | ok |
| patronymic | latin | ✓ | ✓ | review |
| dob | latin | ✓ | ✓ | review |
| sex | latin | ∅ MISS | ✗ | — |

**Recognition rate: 80.0%** — CORRECT 4 · WRONG 0 · MISS 1 · FABRICATED 0 · empty-ok 0
**AUTO-FILLED correctly (no human): 2/5 = 40.0%** (correct value AND review_required=false)

## Summary

| scope | CORRECT | WRONG | MISS | FABRICATED | empty-ok | recognition rate |
|---|---|---|---|---|---|---|
| ua_internal_passport_booklet | 3 | 0 | 2 | 0 | 0 | 60.0% |
| ua_birth_certificate | 1 | 3 | 1 | 0 | 0 | 20.0% |
| ua_military_id | 4 | 0 | 1 | 0 | 0 | 80.0% |
| **OVERALL** | 8 | 3 | 4 | 0 | 0 | **53.3%** |

Scored fields (denominator) = 15. Verdict: **EXPLORATORY (N<30 scored fields — NOT canary approval)**.
