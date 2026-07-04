# FLIP_CRITERIA — machine-readable One Brain flip law

This file is the only place that defines when a shadow/flagged One Brain node may move to the
next stronger runtime class. A clean CI run is necessary but not sufficient.

**No guessing law:** a flip is forbidden if the new path can silently loosen review, invent a
value, hide a conflict, or downgrade evidence/source honesty. Better `unknown` than fabricated.

**Approval law:** parity-CI may prove "merge-safe while OFF". It never proves "ready to flip ON".
Every flip below additionally requires:
- a clean real-traffic or staging-realistic window for the cited markers
- explicit owner sign-off

## 1. Decision Engine (`Decision Engine (decideField ≡ C3) + gates-as-readers differ`)

Current class in runtime truth: `SHADOW_ONLY`

Required evidence:
- `decision_shadow.diffs == 0`
- `decision_shadow.unresolved_mismatches == 0`
- window size `N >= 25` documents per targeted doc family before any family-specific flip

Blocking conditions:
- any non-zero `diffs`
- any non-zero `unresolved_mismatches`
- any shadow failure that suppresses the marker stream

Allowed next class:
- `FLAGGED` for the concrete route/doc-family flip target

## 2. Gates-as-Readers

Current class in runtime truth: folded into node `2a` as shadow evidence

Required evidence:
- `gates_shadow.mismatched_docs == 0`
- `gates_shadow.engine_loosened_total == 0`
- window size `N >= 25` documents per targeted doc family

Blocking conditions:
- any `engine_loosened_total > 0`
- any `mismatched_docs > 0`

Interpretation:
- tightening is reportable but not automatically promotable
- loosening is always flip-forbidden

Allowed next class:
- remains part of node `2a`; this clean window is required before flipping the engine-fed gate path

## 3. Normalize Collapse (`Normalize collapse (P8)`)

Current class in runtime truth: `SHADOW_ONLY`

Required evidence:
- `normalize_collapse_shadow.mismatched_docs == 0`
- `normalize_collapse_shadow.value_diff_total == 0`
- `normalize_collapse_shadow.reject_diff_total == 0`
- window size `N >= 25` documents per targeted TPS doc type

Blocking conditions:
- any mismatch on value or reject behavior
- missing marker stream

Allowed next class:
- `FLAGGED` for the route reading signals while the existing live writer still owns final output

## 4. TPS One-Arbitration

Current class in runtime truth: `SHADOW_ONLY`

Required evidence:
- `one_arbitration_shadow.missing_in_shadow_total == 0`
- `one_arbitration_shadow.review_loosened_total == 0`
- window size `N >= 25` documents per TPS doc-type hint (`passport`, `booklet`, `i94`, `ead`, `dl`, `i797`, `militaryId`, `birthCertificate`)

Blocking conditions:
- any `missing_in_shadow_total > 0`
- any `review_loosened_total > 0`

Allowed next class:
- `FLAGGED` doc-type by doc-type, never whole-TPS at once

## 5. ReaderResult Seam

Current class in runtime truth: `FLAGGED`

Required evidence:
- byte-parity CI stays green for the built-in ReaderResult seam inside `recognizeDocument`
- a clean targeted runtime/staging window with no route-level regressions on the enabled family
- no new unresolved diffs introduced in `decision_shadow`

Blocking conditions:
- byte-parity failure
- any route-level response shape drift outside the declared seam

Allowed next class:
- `LIVE` only after the seam's host path (`recognizeDocument`) becomes the only route path, not merely one flagged route option

## 6. Retry-On-Empty / In-Door Retry

Current class in runtime truth detail table: `FLAGGED`

Required evidence:
- retry markers present and bounded
- no increase in false-final or review-loosened outcomes on the targeted family
- empty-read rate decreases or stays flat; it must never improve apparent success by masking failure

Blocking conditions:
- retry loop changes final values without increasing evidence/review honesty
- retry path revives a silent second reader plane instead of collapsing it

Allowed next class:
- `LIVE` only after the legacy fallback reader plane is removed for that route/family

## 7. Review Explainer

Current class in runtime truth: `FLAGGED`

Required evidence:
- reviewer-visible staging proof that explanations match reason codes honestly
- no prose layer may invent values or certainty

Blocking conditions:
- any mismatch between reason code and displayed instruction
- any model-written prose shown without the deterministic base layer

Allowed next class:
- `LIVE` for deterministic glossary surfaces
- prose polish remains separately flag-gated until explicitly proven

## 8. Provider BBox

Current class in runtime truth: `DARK`

Required evidence:
- real provider invocation proof
- token normalization proof
- localization proof
- UI proof with `source=provider`
- accuracy benchmark against ground truth

Blocking conditions:
- template-labelled-as-provider
- approximate-labelled-as-exact
- missing geometry rendered as a precise box

Allowed next class:
- `FLAGGED`, then `LIVE`

## 9. DeepSeek Helper Roles

Current role law:
- allowed as `SHADOW_ONLY` analyst or `FLAGGED` prose/helper
- forbidden as a silent final-value writer

Required evidence before any stronger status:
- input remains keys/codes/counts only for helper surfaces
- no route grants DeepSeek authority to finalize a field value

Blocking conditions:
- any silent write into final value/review release
- any claim stronger than helper/prose/shadow evidence actually proves
