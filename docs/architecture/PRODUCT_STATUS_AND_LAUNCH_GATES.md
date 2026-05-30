# PRODUCT_STATUS_AND_LAUNCH_GATES.md

**Status:** CONSTITUTION DOC (required by ENGINEERING_MASTER_PLAN.md §4)
**Purpose:** One honest board of what is actually live, and the gate any product must pass before it may be marked `ACTIVE`.
**Rule:** No product/doc-type is `ACTIVE` without **runtime proof**. "Unit-green ≠ product-pass."

---

## 1. Status vocabulary

| Status | Meaning |
|---|---|
| `ACTIVE` | Live for real paying users. Passed the full Launch Gate. |
| `OWNER_TEST_ONLY` | Reachable only in owner mode (free testing). Not exposed to paying users. |
| `FLAGGED_OFF` | Built but disabled behind a flag. Not reachable. |
| `DRAFT` | Partially built; not wired end-to-end. |
| `BLOCKED` | Cannot advance — waiting on owner/source/external dependency. |
| `DEPRECATED` | Retired; kept read-only for audit. |

---

## 2. Current honest status board

| Product / doc type | Status | Honest note |
|---|---|---|
| **Translation engine (core)** | `ACTIVE` | Live; session isolation + garbage guard + no-silent-strip shipped. |
| **TPS (draft-form)** | `OWNER_TEST_ONLY` | Owner-mode generation live; canonical migration + S1/S2/S3 not yet shipped → not paying-user ACTIVE. |
| **ReParole** | `DRAFT` | Adapter not built on canonical core; no review/audit proof. |
| **EAD (I-765 draft)** | `DRAFT` | No canonical adapter, no PDF proof yet. |
| **Translation: birth certificate** | `BLOCKED` | Owner visual approval of pilot PNG required (master plan §5 owner-gated). |
| **Translation: marriage certificate** | `FLAGGED_OFF` | Renderer exists but expansion frozen in Phase 0. |
| **Translation: divorce decree** | `FLAGGED_OFF` | Frozen in Phase 0; no source-coverage proof. |
| **Translation: death certificate** | `FLAGGED_OFF` | Frozen in Phase 0. |
| **Translation: name-change certificate** | `FLAGGED_OFF` | Frozen in Phase 0. |
| **BUREAU_PDF** | `FLAGGED_OFF` | Explicitly off in Phase 0 freeze; do not enable without ADR + gate. |

> Update this table only with runtime evidence. Moving a row to `ACTIVE` requires §3 sign-off recorded in the row's note (PR #, proof type).

---

## 3. Product Launch Gate (all required for `ACTIVE`)

A product/doc-type may be `ACTIVE` only when ALL hold, with evidence:

1. **Canonical result** — product reads `CanonicalDocumentResult` (no direct OCR/provider/render calls).
2. **Review snapshot** — review gate produces a frozen `review_snapshot_hash` (name+address+2 checkboxes+signature).
3. **Audit write** — finalization writes a durable `audit_id`; DB-write failure hard-fails (S2).
4. **PDF visual + text proof** — two-layer proof: PNG visual + text readback + hash == snapshot; no `[CONFIRM]`/placeholder in signed output.
5. **Source coverage** — every rendered field has a pinned official source/rule (OFFICIAL_RULES_COVERAGE_MATRIX); no field without a source.
6. **Canary pass** — post-deploy production canary green (healthz sha, owner mode, no-review reject, reset, garbage reject).
7. **Owner / live test** — an owner-mode live generation + owner visual approval of the output.

Missing any one → status stays below `ACTIVE` (`OWNER_TEST_ONLY` at best). No exceptions for "tests are green".

---

## 4. Test status ladder (climb in order)

| Rung | Meaning | Sufficient for |
|---|---|---|
| `UNIT_PASS` | Vitest unit/contract tests green. | `DRAFT` → ready for fixtures. NOT product-pass. |
| `LOCAL_FIXTURE_PASS` | Full pipeline on saved fixtures (real-doc images) green. | confidence to wire end-to-end. |
| `LIVE_OWNER_PASS` | Owner ran one real doc live end-to-end; output visually approved. | `OWNER_TEST_ONLY`. |
| `MULTI_PERSON_PASS` | ≥3–5 different real people/docs produce canonical ≥ old + correct output. | candidate for migration / `ACTIVE`. |
| `PRODUCTION_PASS` | Live paying-user path + canary green in production. | `ACTIVE` confirmed. |

**Law of the ladder:** a higher rung is never assumed from a lower one. `UNIT_PASS` is `[~]`, not `[x]`. Only `PRODUCTION_PASS` (with §3 gate) justifies `ACTIVE`.

---

## 5. Acceptance
- Every product row has a status from §1 and an evidence note.
- No row is `ACTIVE` without all seven §3 items recorded.
- Status changes reference the test rung (§4) that justifies them.
