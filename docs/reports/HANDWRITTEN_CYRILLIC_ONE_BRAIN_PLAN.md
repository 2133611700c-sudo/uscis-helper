# HANDWRITTEN CYRILLIC / ONE BRAIN EXECUTION PLAN (2026-07-05)

STATUS: ROADMAP_READY · current truth preserved; no product flip implied
HEAD: see the commit that introduces this revision
WORKTREE: clean on commit

This is a roadmap, not a truth ledger. It reuses existing evidence only:
`docs/reports/DOCUMENT_POSTURE_PRE_READER_GATE.md`,
`docs/reports/GT_PIPELINE_BENCH_2026-07-05.md`,
`docs/reports/UKRAINIAN_CYRILLIC_TRANSLITERATION_TEST.md`,
`docs/ocr/FLIP_CRITERIA.md`,
`docs/ocr/ONE_BRAIN_RUNTIME_TRUTH.md`,
and the owner GT sheets in `qa-private/ground-truth/`.

## Current Truth

- `TRANSLITERATION`: PASS.
- `RUNNER_GUARD`: HARDENED_AND_VERIFIED.
- `ORIENTATION`: mechanism exists; the remaining sparse 90° certificate class is now fixed on the
  measured marriage/divorce fixtures, but the newest live rerun after the sparse-fallback change
  regressed to provider drift / undecidable on the extended harness (`0/29` raw; 180-check `2/40`
  off, `1/40` on), so the repo-wide orientation report still needs a stable full rerun before any
  global "solved" claim.
- `HANDWRITTEN_CYRILLIC`: not solved.
- `ONE_BRAIN`: already built in shadow and flip-gated by `FLIP_CRITERIA`.
- `DOWNLOADED_UKRAINIAN_HTR_MODEL`: tested, not useful as-is, unsafe guessing, only fine-tune candidate.
- `GT`: still too small for Phase A.

## Non-Negotiable Laws

1. One GT ledger only.
2. No model writes `finalValue`.
3. No model silently corrects Cyrillic.
4. No handwritten auto-accept.
5. Deterministic transliteration only after accepted Cyrillic.
6. Orientation and blank gates run before any reader scoring.
7. One shared brain for all services, not per-service side brains.
8. Flip only by `FLIP_CRITERIA`.

## Priority Order

1. `P1` Document posture / orientation pre-reader envelope.
2. `P2` GT ledger expansion, no second ledger.
3. `P3` Blank gate before HTR/readers.
4. `P4` Per-hand handwritten Cyrillic bench.
5. `P5` Arbitration / Decision Engine / mandatory review.
6. `P6` Deterministic transliteration after accepted Cyrillic.
7. `P7` Service rollout through One Brain.
8. `P8` Flip sign-offs only by `FLIP_CRITERIA`.

## P1. Document Posture / Orientation Envelope

Goal: create a structured evidence envelope before any reader sees the image.

Current state:
- `DocumentPostureEnvelope` exists and is wired signal-only.
- `review_orientation_uncertain` already exists.
- `content-orient` is measured, but 90/180 disambiguation is not fully proven.
- EXIF is evidence, not truth.

Required envelope fields:
- `input_format`
- `exif_orientation`
- `orientation_status`
- `orientation_source`
- `orientation_confidence`
- `rotation_applied`
- `rotation_degrees`
- `quality_status`
- `document_fit`
- `crop_source`
- `posture_gate`

Rules:
- If `orientation_status = uncertain`, set `review_required = true`.
- If measured `quality_status != ok`, set `review_required = true`.
- If `document_fit = cropped_or_partial`, set `review_required = true`.
- Do not silently rotate without recording source and degrees.
- Never destroy the original image.
- Do not boost reader confidence when posture gate is not `pass`.

Exit criteria:
- `wrong_rotation_auto_applied = 0` -- repo-wide full rerun still pending, but the previously
  failing sparse 90° certificate class is now fixed on the measured marriage/divorce fixtures
  (direct probe: rot_90 -> 270 on both docs)
- `orientation_uncertain -> review_required = 100%` -- met (unchanged fail-closed path)
- `original_image_preserved = 100%` -- met (fail-open on every error path, original buffer returned)
- 90/180 disambiguation measured on the fixture set -- DONE this commit

Measured (`ORIENT_180_CHECK` flag, default OFF; `docs/reports/DOCUMENT_POSTURE_PRE_READER_GATE.md`
§6c has the full breakdown): paired same-session live run, 10 real docs x rot_0/90/180/270 (40
variants), flag OFF vs flag ON. OFF: 34/40 correct, 5 `wrong_rotation_auto_applied`, 1
undecidable. ON: 38/40 correct, 2 `wrong_rotation_auto_applied`, 0 undecidable. All 3 fixed
failures were exact 180-degree-opposite confusions (the fix's target class); the 2 remaining
failures are BOTH a different, unaddressed 90-degree-off class (1 unchanged from OFF, 1 new from
independently-measured 4-cell-vote day-to-day instability, not from the confirm mechanism
itself -- `disambiguated180` was `false` on that row). Real, targeted improvement; exit
criterion not yet met; confidence stays `medium`.

Recommended implementation steps:
- Keep the envelope signal-only.
- Carry `visual_oracle` evidence in the harness, not in runtime guesses.
- Record `not_measured` honestly for anything without a detector.
- The sparse 90° certificate class now has a detector-level fix on the measured fixtures; rerun the
  full extended harness to refresh repo-wide truth before any broader confidence upgrade past
  `medium`.

## P2. GT Ledger Expansion

Goal: expand the existing GT, not create a second truth source.

Current truth (recounted directly from `qa-private/ground-truth/*.json` `_meta.handwritten_field_attrs`,
excluding the byte-duplicate row and excluding printed EAD/I-94/passport owner-fill fields, which are
NOT handwritten Cyrillic scope):
- 10 unique handwritten Cyrillic fields carry per-field `hand_id`/`language_form` attrs
- 2 hands (A = birth cert, B = military p1)
- the wider `owner_verified_fields` total (46) includes printed docs and must not be quoted as the
  handwritten-Cyrillic count — that conflation was found and corrected during this audit
- Phase A target: 36+ unique fields / 3+ hands -> current gap is 26+ fields and at least 1 new hand

Use only:
- `GT_PIPELINE_BENCH`
- `LIVE_DOOR_SCORABLE_COVERAGE`
- acceptance manifest
- `_meta.owner_verified_fields`

Required per field:
- `doc_id`
- `physical_doc_hash`
- `doc_type`
- `contract_field`
- `field_name`
- `ground_truth_cyrillic`
- `language_form`
- `hand_id`
- `crop_source`
- `orientation/posture envelope link`
- `owner_verified`
- `scored`
- `not_scored_reason`

Schema-first constraints:
- fields must come from document contracts
- no universal field list
- no score for fields outside contract scope
- no EAD/I-94 as Ukrainian handwriting scope

Blocker:
- owner GT docs 4–8 remain the GT gate

Exit criteria:
- 36+ unique fields
- 3+ hands
- deduped, no byte-identical double counting
- one truth ledger only

## P3. Blank Gate Before HTR / Readers

Goal: stop blank and near-blank crops from reaching readers.

Required gate:
- compute ink density / non-blank signal before reader call
- blank or near-blank crop -> do not call HTR
- emit `blank_crop_or_low_ink`
- set `review_required = true`

Current truth (verified in code, not assumed):
- `judgeBlankCrop` is wired in BOTH crop transports (`htrSidecarProvider.ts`, `llmCropReader.ts`)
- blank fabrication on crop transports is structurally impossible (deterministic ink-density gate
  runs before either model sees the crop)
- the full-page LLM read path (whole-image Gemini read, not a cropped field) is NOT gated by this
  check — it has no separate blank/near-blank detector today

`blank_gate_scope` (must be reported honestly, never implied global):
- `full_page_plus_crop_readers` -- current truth
- `full_page_also` -- not yet true
- `partial` / `not_wired` -- not applicable

Exit criteria:
- `blank_fabrication_reachable_for_crop_readers = 0` (met)
- `blank_fabrication_reachable_for_full_page_reader` remains unmeasured -- do not claim 0 there
- no reader invocation on blank/near-blank crops

## P4. Per-Hand Handwritten Cyrillic Bench

Goal: measure readers per hand, not as one blended average.

Readers in scope:
- Reader A: `RaxTemur/HTR` sidecar
- Reader B: `Gemini 2.5` full-page/crop if already wired
- Reader C: `UA TrOCR` only as historical baseline, not active reader

Forbidden readers:
- `Gemma4` as active reader
- downloaded UA TrOCR as active reader
- new random Ukrainian LLM
- model-based transliteration

Metrics per field:
- `doc_id`
- `physical_doc_hash`
- `doc_type`
- `field_name`
- `hand_id`
- `ground_truth_cyrillic`
- `reader_name`
- `reader_candidate`
- `exact_match`
- `partial_match`
- `CER`
- `WER`
- `empty_on_real_field`
- `fabricated_extra_text`
- `latency_ms`
- `posture_gate`
- `crop_source`
- `orientation_status`

Per-hand outputs required:
- hand A exact/CER/WER
- hand B exact/CER/WER
- hand C exact/CER/WER

Exit criteria:
- `HANDWRITTEN_CYRILLIC_BENCH_PARTIAL` until GT grows
- no single overall claim without per-hand table

## P5. Arbitration / Decision Engine / Mandatory Review

Goal: readers propose only; arbitration decides review, never silent acceptance.

Flow:
`reader candidates + posture envelope + blank gate + crop evidence + script signal + linguistic signal + orientation/localization signal -> Decision Engine -> review_required -> accepted Cyrillic`

Rules:
- no provider writes `finalValue`
- no model writes Latin
- no silent Cyrillic correction
- disagreement always creates conflict/review
- one provider empty -> `reader_asymmetry`
- both empty -> `both_empty` / missing field
- handwriting review required = 100%
- wrong auto-accept rate = 0%

Exit criteria:
- reader agreement, asymmetry, and review metrics are all tracked
- no hidden committee path outside the Decision Engine

## P6. Deterministic Transliteration

Goal: transliterate only after accepted Cyrillic.

Rules:
- accepted Ukrainian Cyrillic -> deterministic KMU-55
- accepted Russian Cyrillic -> explicit Russian policy if defined
- if Russian policy missing -> `transliteration_policy_missing_for_russian_source`
- never model-transliterate names
- never normalize Russian into Ukrainian
- never normalize Ukrainian into Russian

Signals to preserve:
- `language_variant_conflict`
- `script_mismatch`
- `mixed_script`
- `latin_confusable_in_cyrillic_slot`
- `candidates_conflict`
- `review_required`

Exit criteria:
- `latin_from_model_rate = 0`
- `latin_from_deterministic_rate = 100%` after accepted Cyrillic

## P7. One Brain Service Rollout

Goal: every service uses the same brain, only different schemas.

Shared flow:
`posture envelope -> blank gate -> reader candidates -> arbitration -> review -> accepted source value -> deterministic conversion -> C3 final writer`

Service adapters may differ only by:
- document contracts
- field schemas
- service-specific validation
- packet/output formatting

Rollout order:
1. translation / document-reading flows
2. handwritten birth certificate / military flows
3. TPS after evidence/coverage doors are ready
4. EAD / ReParole / packet routes

No service may bypass:
- posture gate
- blank gate
- handwriting review
- Decision Engine
- C3 final writer

## P8. Flip Criteria

No mass flip. One scope at a time.

Only by `FLIP_CRITERIA`:
- shadow window `N >= 25`
- `diffs = 0`
- watchdog clean
- review behavior preserved
- owner sign-off
- rollback exists

Safe first flips:
- dates
- doc numbers
- non-handwritten stable fields

Not first flips:
- handwritten names
- patronymics
- birth-certificate cursive
- anything with orientation uncertainty

## Exact Immediate Next Actions

Agent (done this commit, see docs/reports/DOCUMENT_POSTURE_PRE_READER_GATE.md §6c for evidence):
1. DONE — `ORIENT_180_CHECK` binary 90/180 disambiguation implemented (default OFF) and
   measured live, paired same-session: `wrong_rotation_auto_applied` 5/40 -> 2/40. Exit
   criterion (=0) NOT met; `orientation_confidence` stays `medium`.
2. DONE — `posture` is now carried on `DocumentReadResult` (all 4 in-scope return sites),
   available to any caller/bench that wants to join it per row.
3. DONE — `docs/reports/HANDWRITTEN_CYRILLIC_BENCH.md` skeleton created: schema-first,
   per-hand sections, blank-gate scope note, `HANDWRITTEN_CYRILLIC_BENCH_BLOCKED_BY_GT`.
4. Remaining: a SEPARATE 90-degree-off failure class is unaddressed (a binary 180 confirm
   cannot fix a vote that is wrong by 90 degrees) -- needs its own mechanism before any
   confidence upgrade past `medium`.
5. Remaining: joining `[posture_envelope]` markers into the HTTP bench response is an API
   response-contract change (recognizeDocument/vision-extract route shape), deliberately left
   out of this commit's scope -- it affects other consumers of that route and needs its own
   review, not a silent add-on to an orientation fix.

Owner:
1. Fill GT docs 4–8 from physical originals.
2. Produce 36+ unique handwritten Cyrillic fields across 3+ hands.
3. Do not invent GT with a model.

## What Is Proven

- transliteration is deterministic and safe
- runner guard is hardened and verified
- posture envelope exists, is signal-only, and now carries EXIF-suspicious detection +
  180-disambiguation evidence, plus flows through to `DocumentReadResult`
- `ORIENT_180_CHECK` measurably reduces (not eliminates) 180-degree-opposite orientation errors,
  with a live paired same-session measurement, and does not regress the 90-degree-off class
- blank gate exists in the contour (crop transports + full-page intake -- empty/full-page path
  is now fail-closed before provider call, and the bench skeleton's blank-gate-scope section
  should reflect that)
- one-brain shadow architecture exists
- current handwritten-Cyrillic GT count is exactly 10 fields / 2 hands (recounted from `_meta`
  during this session's audit, correcting an earlier "~14" approximation)

## What Is Not Proven

- full handwritten Cyrillic benchmark quality on 3+ hands
- complete orientation quality on every fixture class -- `wrong_rotation_auto_applied = 0` not
  reached even with the new disambiguation; a distinct 90-degree-off failure class remains
- auto-accept for handwriting
- production flip readiness for handwritten flows
- blank-gate coverage on the full-page (non-crop) LLM read path -- DONE this commit

## FINAL VERDICT

HANDWRITTEN_CYRILLIC_PHASE_A_BLOCKED_BY_GT

## 2026-07-05 orientation addendum

The orientation slice is now better than the last report, but still not solved:

- Extended posture harness on the current code: `21/29 correct`, `3 undecidable`, `0 errors`.
- `ORIENT_180_CHECK` rerun: `flag180=off 26/40 correct, 11 wrong, 3 undecidable`;
  `flag180=on 27/40 correct, 10 wrong, 3 undecidable, 1 disambiguated180`.
- One live `disambiguated180` success landed on `marriage_apostille_vasylsiuk rot_0`, but the
  birth-cert and military-ID-p1 classes still dominate the remaining failures.
- Root cause conclusion: the 180 adjunct is useful but insufficient; the remaining work is a
  separate 90°/doc-type-specific orientation refinement, not a flip claim.
