# GT Pipeline Bench — 2026-06-22 · DRY (offline, frozen reads)

Per-field accuracy of the production read vs owner-verified GT. Field names + verdicts only — NO personal values.
Verdict taxonomy: CORRECT / WRONG / MISS (GT non-empty, read empty) / FABRICATED (GT empty, read non-empty) / CORRECT_EMPTY (both empty).
**Recognition rate = CORRECT / (CORRECT+WRONG+MISS+FABRICATED)** — CORRECT_EMPTY excluded; an empty read can NEVER inflate it.
Verdict stamp: **EXPLORATORY (N<30 scored fields — NOT canary approval)** (per GT_BENCHMARK_EXIT_CRITERIA: <30 scored fields/class ⇒ direction only).

## internal_passport_booklet (handwritten)
- http 200 · status `ok:core-b2` · model `removed preview primary` · fields_returned 3

| field | channel | verdict | present | review |
|---|---|---|---|---|
| family_name | latin | ✓ | ✓ | review |
| given_name | latin | ✓ | ✓ | review |
| patronymic | latin | ∅ MISS | ✗ | — |
| dob | latin | ✓ | ✓ | review |
| sex | latin | ∅ MISS | ✗ | — |

**Recognition rate: 60.0%** — CORRECT 3 · WRONG 0 · MISS 2 · FABRICATED 0 · empty-ok 0

## birth_certificate (handwritten)
- http 200 · status `ok:core-b2` · model `removed preview primary` · fields_returned 4

| field | channel | verdict | present | review |
|---|---|---|---|---|
| child_family_name | cyrillic | ✓ | ✓ | review |
| child_given_name | cyrillic | ✗ WRONG | ✓ | review |
| child_patronymic | cyrillic | ✗ WRONG | ✓ | review |
| dob | latin | ✗ WRONG | ✓ | review |
| sex | latin | ∅ MISS | ✗ | — |

**Recognition rate: 20.0%** — CORRECT 1 · WRONG 3 · MISS 1 · FABRICATED 0 · empty-ok 0

## birth_certificate (Soviet bilingual)
- http 200 · status `ok:core-b2` · model `removed preview primary` · fields_returned 4

| field | channel | verdict | present | review |
|---|---|---|---|---|
| child_family_name | cyrillic | ✓ | ✓ | review |
| child_given_name | cyrillic | ✗ WRONG | ✓ | review |
| child_patronymic | cyrillic | ✗ WRONG | ✓ | review |
| dob | latin | ✗ WRONG | ✓ | review |
| sex | latin | ∅ MISS | ✗ | — |

**Recognition rate: 20.0%** — CORRECT 1 · WRONG 3 · MISS 1 · FABRICATED 0 · empty-ok 0

## military_id_p1 (printed+hw)
- http 200 · status `ok:core-b2` · model `removed preview primary` · fields_returned 4

| field | channel | verdict | present | review |
|---|---|---|---|---|
| family_name | latin | ✓ | ✓ | review |
| given_name | latin | ✓ | ✓ | review |
| patronymic | latin | ✓ | ✓ | review |
| dob | latin | ✓ | ✓ | review |
| sex | latin | ∅ MISS | ✗ | — |

**Recognition rate: 80.0%** — CORRECT 4 · WRONG 0 · MISS 1 · FABRICATED 0 · empty-ok 0

## Summary

| scope | CORRECT | WRONG | MISS | FABRICATED | empty-ok | recognition rate |
|---|---|---|---|---|---|---|
| ua_internal_passport_booklet | 3 | 0 | 2 | 0 | 0 | 60.0% |
| ua_birth_certificate | 2 | 6 | 2 | 0 | 0 | 20.0% |
| ua_military_id | 4 | 0 | 1 | 0 | 0 | 80.0% |
| **OVERALL** | 9 | 6 | 5 | 0 | 0 | **45.0%** |

Scored fields (denominator) = 20. Verdict: **EXPLORATORY (N<30 scored fields — NOT canary approval)**.
