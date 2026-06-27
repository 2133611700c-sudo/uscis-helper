# GT Pipeline Bench — 2026-06-22 · LIVE (prod /api/translation/vision-extract)

Per-field accuracy of the production read vs owner-verified GT. Field names + verdicts only — NO personal values.
Verdict taxonomy: CORRECT / WRONG / MISS (GT non-empty, read empty) / FABRICATED (GT empty, read non-empty) / CORRECT_EMPTY (both empty).
**Recognition rate = CORRECT / (CORRECT+WRONG+MISS+FABRICATED)** — CORRECT_EMPTY excluded; an empty read can NEVER inflate it.
Verdict stamp: **EXPLORATORY (N<30 scored fields — NOT canary approval)** (per GT_BENCHMARK_EXIT_CRITERIA: <30 scored fields/class ⇒ direction only).

## internal_passport_booklet (handwritten)
- http 200 · status `ok:core-b2` · model `removed preview primary` · fields_returned 8 · downscaled from 4.1MB (>4MB edge limit)

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
- ERROR: timeout(90s)

## military_id_p1 (printed+hw)
- http 200 · status `ok:core-b2` · model `removed preview primary` · fields_returned 5 · downscaled from 4.8MB (>4MB edge limit)

| field | channel | verdict | present | review |
|---|---|---|---|---|
| family_name | latin | ✓ | ✓ | ok |
| given_name | latin | ✓ | ✓ | ok |
| patronymic | latin | ✓ | ✓ | review |
| dob | latin | ∅ MISS | ✓ | review |
| sex | latin | ∅ MISS | ✗ | — |

**Recognition rate: 60.0%** — CORRECT 3 · WRONG 0 · MISS 2 · FABRICATED 0 · empty-ok 0
**AUTO-FILLED correctly (no human): 2/5 = 40.0%** (correct value AND review_required=false)

## Summary

| scope | CORRECT | WRONG | MISS | FABRICATED | empty-ok | recognition rate |
|---|---|---|---|---|---|---|
| ua_internal_passport_booklet | 3 | 0 | 2 | 0 | 0 | 60.0% |
| ua_military_id | 3 | 0 | 2 | 0 | 0 | 60.0% |
| **OVERALL** | 6 | 0 | 4 | 0 | 0 | **60.0%** |

Scored fields (denominator) = 10. Verdict: **EXPLORATORY (N<30 scored fields — NOT canary approval)**.
