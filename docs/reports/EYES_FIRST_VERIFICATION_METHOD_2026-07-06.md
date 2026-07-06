# EYES-FIRST VERIFICATION METHOD (2026-07-06)

STATUS: METHOD_ADOPTED — mandatory going forward for any orientation/recognition claim
HEAD: see the commit that introduces this file

## The law (owner-mandated 2026-07-06)

Before trusting or reporting any pipeline output (orientation, handwritten/printed
classification, language, field content), the agent must FIRST look at the actual document
with its own (multimodal) eyes and form an independent judgment:

1. Render the RAW stored pixels (no auto-rotate) — this is the ground truth the code must
   reason about, not an assumption.
2. Judge, independently of any code output: orientation (upright/rotated), handwritten vs
   printed, language (Ukrainian/Russian/mixed), which fields are actually visible on THIS
   specific page/crop.
3. Only THEN run the pipeline and compare its output against that independent judgment.
4. Any mismatch is inventoried precisely: is it a real pipeline defect, a test-corpus
   mismatch (wrong page/doc-type pairing), an external blocker (quota), or expected behavior
   (e.g. a genuinely blank template)?
5. Write the finding into a rule/report — not just a chat reply — so future agents do not
   re-litigate a question already answered by direct visual inspection.

Never accept "the log says 0 fields" or "the log says upright" as proof by itself. The log is
a claim; the image is the evidence.

## First application — live sweep of all 11 real documents in test-fixtures/real-docs

Ran every document through `apps/web/scripts/one-brain-orient-read.mts`
(`HANDWRITING_CROP_LLM=openai --provider openai`, since Gemini is quota-exhausted this
session), THEN independently inspected the two anomalous results with the raw-pixel image
directly (`sharp(...).rotate().resize()` renders EXIF-only-corrected pixels — the same base
the content-orient detector reasons from).

| Doc | Pipeline orientation | My own visual check | Pipeline HANDWRITTEN fields | My own read of the page |
|---|---|---|---|---|
| birth_cert_handwritten_01 | upright, cw=90 | not re-checked (already proven earlier this session) | 12/12, all review_required | matches prior sessions |
| birth_cert_soviet_01 (byte-dup) | upright, cw=90 | same file as above | 12/12 | dedup law: not independently re-verified |
| military_id_p1_01 | upright, cw=90 | matches prior sessions | 5/5 | matches prior sessions |
| **military_id_p2_01** | upright, cw=180 | **CONFIRMED VISUALLY: raw pixels are genuinely upside-down; the 180° correction is correct** | 0/5 (family_name/given_name/patronymic/dob/doc_number) | **This photo is PAGE 2 (military commissariat / service-record annex), not the identity page. None of the 5 contract fields physically appear on this page — 0 is the CORRECT read, not a defect.** |
| **internal_passport_01** | upright, cw=0 | **CONFIRMED VISUALLY — and this exposed the biggest finding of this sweep** | (before fix) 8/8 "handwritten"; (after fix) 0/0, all 8 fields correctly non-handwritten | **This is NOT the internal passport booklet — it is the PRINTED international/foreign-travel passport** (bilingual UA/EN labels, MRZ line, biometric-card layout). Every field visible is machine-typed. This was ALREADY discovered and recorded on 2026-06-27 in `qa-private/ground-truth/internal_passport_01.json._meta` (`"handwritten_actual": false`, explicit agent note), and `gt-pipeline-bench.mjs` (the authoritative scoring script) already scores it as `ua_international_passport`. This session's NEW CLI tool (`one-brain-orient-read.mts`) had its own, uncorrected alias mapping this filename to `ua_internal_passport_booklet` — contradicting the project's own established truth. **`ua_internal_passport_booklet` has ZERO real photographed fixtures in this project** — its GT placeholders (`booklet_page_1..4.json`) are all `ground_truth_status:"MISSING"` with no image file. Fixed the CLI alias to `ua_international_passport`; reran live — now correctly shows 0 handwritten fields. |
| marriage_1939_kharkiv_borodavka | upright, cw=0 | not re-checked this round | 18/18 via full-page; crop-route htr_fields=0 | **expected**: `FIELD_BOX_TEMPLATES` has no entry for `ua_marriage_certificate` (only birth_certificate + internal_passport_booklet do), so the crop-route's template path cannot produce anything; the Gemini-bbox localizer fallback is blocked by this session's quota exhaustion (429, see prior reports). Full-page path is doing all the work here. |
| marriage_apostille_vasylsiuk | upright, cw=0 | not re-checked | 18/18 via full-page; crop=0 | same explanation as above |
| marriage_repeat_johnson_kvasnikova | upright, cw=0 | not re-checked | 18/18 via full-page; crop=0 | same |
| marriage_zastavnyi_kovshirina | upright, cw=0 | not re-checked | 18/18 via full-page; crop=0 | same |
| divorce_redacted_pechersk | upright, cw=0 | not re-checked | 14/14 via full-page; crop=0 | same template-gap explanation |
| **divorce_blank_template** | upright, cw=0 | **CONFIRMED VISUALLY: this is the official UNFILLED specimen form ("Зразок"), printed Ukrainian, zero handwritten content anywhere** | 0/0 | **0 is the CORRECT read — there is nothing to recognize on a blank government template.** |

## What this run proves, honestly

- **Orientation was correct on all 11 documents in this sweep** (visually spot-checked the
  two most suspicious ones directly; the rest were previously verified in earlier sessions of
  this same work). No false-pass found in this batch.
- **The uniform `htr_fields:0` across all 6 marriage/divorce documents is a known, already-
  documented gap** (`FIELD_BOX_TEMPLATES` only covers 2 of 7 handwritten doc families), NOT a
  new regression. The crop-route mechanism itself works (proven on birth_cert and military_id
  p1 in this same sweep); it simply has no deterministic box for these families yet, and the
  Gemini-bbox fallback path is blocked by quota, not by code.
- **military_id_p2_01 "0 fields" is a test-corpus mismatch, not a pipeline defect** — the
  fixture photographs the wrong page for the `ua_military_id` field contract. This is worth
  fixing in the fixture inventory (either add page-2-specific contract fields, or stop scoring
  page 2 against the page-1 field set), not in the reader code.
- **`internal_passport_01.jpg` was tested under the WRONG doc-type-id for this entire
  session, until this eyes-first check caught it.** Every earlier claim in this session about
  "the passport crop-route now recovers N handwritten fields" (0 -> 3 -> 8 across several
  commits) was measuring progress against a document that should never have been routed
  through the handwritten pipeline at all — it is fully printed. `ua_internal_passport_booklet`
  as a document class has never had a real photographed fixture in this project. This is
  corrected now (`one-brain-orient-read.mts` alias fixed to `ua_international_passport`), but
  it means: **do not cite this session's earlier "passport handwritten-field recovery"
  measurements as evidence of anything** — they were measuring a misclassification, not a
  capability. The `ua_military_id` family-gate fix from earlier today remains valid on its own
  merits (proven on `military_id_p1_01`, a genuine handwritten fixture), but it was never
  properly cross-checked against a real booklet fixture, because none exists.

## Rule for future agents

1. Do not report a "0 fields" or "N fields" number as a defect or a success without first
   looking at the source image and asking: does this page even CONTAIN the fields being
   scored? Wrong-page-vs-contract mismatches look identical to reader failures in the logs.
2. Do not claim an orientation success/failure from the log alone. Render the raw pixels and
   look. A detector can be "consistent with itself" (log says upright) while still being wrong
   if the raw truth was never independently checked.
3. When a template-driven mechanism (crop-route, evidence template) shows 0 output across an
   ENTIRE doc family, check `FIELD_BOX_TEMPLATES` (or the equivalent registry) for that family
   BEFORE assuming the mechanism itself is broken — a missing template produces byte-identical
   symptoms to a broken template.
4. **Before trusting a doc-type-id assigned to a CLI tool's filename alias, cross-check it
   against the project's OWN existing GT `_meta` and the authoritative bench script
   (`gt-pipeline-bench.mjs`)** — this project had already discovered and recorded the
   `internal_passport_01.jpg` misclassification on 2026-06-27; a new convenience tool built
   this session silently re-introduced the same wrong mapping because nobody checked the
   existing GT record before writing a new alias table. A second source of truth (a new
   alias map) drifting from the first (GT `_meta` + the bench script) is exactly the class of
   error the project's own "one GT ledger" law exists to prevent — it applies to ad-hoc tool
   aliases too, not just formal ledgers.

## FINAL VERDICT

`EYES_FIRST_METHOD_ADOPTED` · orientation confirmed correct on this 11-doc sweep (3 directly
re-inspected, 8 relying on prior-session direct inspection) · three findings resolved by direct
visual inspection, not by trusting the log: military_id_p2 0-fields (wrong page vs contract,
non-defect), divorce_blank 0-fields (genuinely blank template, non-defect), and
internal_passport_01 mislabeled as the booklet class it never was (real defect, now fixed in
the CLI alias — `ua_internal_passport_booklet` has zero real fixtures in this project) · the
real, still-open gap is `FIELD_BOX_TEMPLATES` coverage (2/7 handwritten families), unchanged
by this sweep.
