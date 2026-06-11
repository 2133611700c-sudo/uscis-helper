# First REAL ground-truth bench — 2026-06-11 (PII-free)

Owner directed: fill the GT templates from the original documents and USE them.

## What was done
1. Found the owner's VERIFIED_BY_OWNER GT in qa-private/ground-truth/ (4 docs, partially
   filled under parallel key names) — the real-docs templates were empty duplicates.
2. Merged owner-verified values into the templates; the agent visually read the original
   documents (high-res crops) and filled every remaining blank. Cross-check: every field
   where both owner GT and the agent read exist agrees semantically (the apparent diffs are
   script-form only: owner = Ukrainian/ISO identity forms, agent = as-written Russian from
   the Soviet form — per the locked as-written rule). The handwritten birth DATE is now
   corroborated by THREE independent sources: owner ISO GT, the passport MRZ anchor, and
   the agent's high-resolution visual read.
3. GT files live ONLY in gitignored dirs (verified via git check-ignore + git status).
4. USED: all 3 unique documents run through the LIVE prod pipeline (vision-extract) and
   scored against the filled GT.

## Results (N=3 documents, 12 scored critical fields)
| Doc | Type | Critical fields | Match | Notes |
|---|---|---|---|---|
| birth certificate | HANDWRITTEN cursive | 5 | 4/5 | names + PLACE read correctly from cursive; DOB mismatched (the known hard month/day) — review-gated |
| military booklet | printed + handwriting | 4 | 4/4 | incl. handwritten name lines |
| internal passport | printed | 3 read | 3/3 | patronymic field absent from the read (NOT_READ, not wrong) |

**Aggregate: 11/12 (91%) · SILENT-WRONG: 0** — the only mismatch was review_required=true.
Every field on every document was review-gated (handwritten/critical policy holds live).

## Honest framing
- verdict: **INSUFFICIENT_N** (N=3 < 30) — these numbers are a first measured slice, NOT a
  rollout-grade benchmark. The L2 threshold decision still needs ≥30 docs/class from ≥5 people.
- Handwritten Cyrillic NAMES + PLACE: read correctly on this document. The handwritten DATE
  remains the systematic failure — and remains correctly review-gated (zero silent output).
- The one passport field returned as NOT_READ (skipped, not fabricated) is the designed
  fail-closed behavior.

## PII handling
Originals + GT values used locally only (owner-directed); GT JSONs are gitignored
(verified); /tmp working copies deleted; this report carries counts and statuses only.

## UPDATE 2026-06-11 — full-spec bench + the silent-wrong fix (closed loop)

Re-ran with the FULL birth-certificate spec (docTypeId=ua_birth_certificate, 10 fields incl parents/act/authority):

| Stage | Critical fields | Match | SILENT-WRONG |
|---|---|---|---|
| before fix | 9 | 6/9 (66%) | **1** — act_record_number wrong at high confidence, review=false |
| after fix (handwritten:true on all fields, deployed via git) | 9 | 6/9 (66%) | **0** — every field review-gated |

- PARENTS (father + mother) read correctly from cursive handwriting; place too.
- The 3 mismatches (dob / act number / authority) are ALL review-gated — the certifier sees and fixes them; nothing flows silently.
- The review-reasons fix is visibly live (source_script_ambiguous, date_role_conflict in prod responses).
- Ops note: one broken manual CLI deploy caused ~15 min of vision-extract 504s — detected by a light probe, rolled back per runbook, redelivered via the proper git build (see OPS_INCIDENT_LOG.md).
