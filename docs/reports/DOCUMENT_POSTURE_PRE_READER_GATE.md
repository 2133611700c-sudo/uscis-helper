# DOCUMENT POSTURE — PRE-READER ENVELOPE (§9 report, 2026-07-05)

STATUS: POSTURE_ENVELOPE_WIRED_SIGNAL_ONLY (FLAGGED-adjacent: envelope always builds; it is
evidence-only — it never blocks a read and never boosts confidence)
HEAD: см. коммит этого файла (base 2d0a282)
WORKTREE: clean на момент коммита

## §2 Existing pieces assembled (no new product built)

| Piece | Where | State before this patch |
|---|---|---|
| EXIF normalize (sharp .rotate()) | image preprocess | LIVE, silent — rotation fact only in forensics |
| EXIF tag capture | `opts.forensic.exifOrientation` | FLAGGED (FORENSIC_LOG_ENABLED) |
| Content-orient (grid K-vote) | `orientation/detectOrientation.ts` | LIVE (CONTENT_ORIENT_ENABLED≠0), verdict scattered in 2 locals |
| Quality verdict | `documentImageQuality` | exists, has its own `not_measured` pattern |
| Document fit / partial-page detector | — | DOES NOT EXIST (honest `not_measured`) |

## §3–§5 The envelope

`apps/web/src/lib/docintel/posture/documentPostureEnvelope.ts` — one typed
`DocumentPostureEnvelope` built by pure `buildPostureEnvelope()` from RECORDED signals only,
wired in `documentFieldReader.readDocument()` immediately after orientation handling and
BEFORE provider selection; emitted as a PII-free `[posture_envelope]` marker.
Orientation backstop decisions are now observable too: handwritten fallback decisions surface as
`orientation_backstop_used: handwritten_layout`, and sparse certificate fallback as
`orientation_backstop_used: sparse_layout`. The envelope now also names these backstops in
`orientation_source` (`handwritten_layout_backstop` / `sparse_layout_backstop`) instead of
flattening them into generic `content_orient`.

Fields MEASURED today: exif_orientation, preprocess_rotation_applied,
content_rotation_applied_cw, orientation_status/source/confidence, posture_gate.
Fields honestly NOT measured: `document_fit` (always `not_measured` — no detector),
`quality_status` (reader path does not run the quality gate → `not_measured` there).
Confidence law: `content_orient` and `exif` sources are capped at **medium** — this harness
(below) measured confident 180° miscorrections, so `high` is not claimable.

Gate law (signal-only, monotonic-up): `review_orientation_uncertain` > `review_quality_low`
> `pass`/`not_measured`. A non-pass gate can only ADD review downstream (the
orientation-uncertain fail-closed path already existed); it never lifts review, never blocks.

## §6 Narrow orientation harness (live, production detector, K-vote as shipped)

Script: `apps/web/scripts/posture-orientation-harness.mts` (raw rows:
`apps/web/.harness/posture-orientation-harness.json`, gitignored). 21 variants =
{original_with_EXIF, EXIF_stripped, manual_upright, rot_0/90/180/270} × {birth_cert_handwritten_01,
military_id_p1_01, internal_passport_01}. All 21 detector calls returned (0 undecidable, 0 errors).

**Oracle correction (owner law: verify VISUALLY, not via metadata).** Raw-pixel visual check
proved: birth raw = UPRIGHT while its EXIF tag 6 LIES (known fact from the Step-5 A/B);
military EXIF 6 is CORRECT (raw needs 90° CW); passport EXIF 1 correct. The script's
first-pass EXIF-based expectations were therefore re-scored against the visual oracle —
for birth, `manual_upright` (EXIF-honoring rotate) is actually upright+90°CW, so its
expected corrections shift by 90°.

Re-scored against the VISUAL oracle (21/21 scorable):

| Doc | Variants correct | Notes |
|---|---|---|
| birth_cert_handwritten_01 (hand A, handwritten) | **7/7** | detector answers track the lying-EXIF base exactly (0/0/270/270/180/90/0) |
| military_id_p1_01 (hand B, handwritten) | **7/7** | incl. original 90 = EXIF-implied 90 |
| internal_passport_01 (printed) | **5/7** | rot_180 → detected 0; rot_270 → detected 270 — both 180° errors |
| **TOTAL** | **19/21 (90%)** | 0 undecidable — failures are CONFIDENT miscorrections |

**Honest failure mode:** on the printed passport the detector confuses 180°-opposite poses
and the envelope reports `posture_gate=pass` for a wrongly-oriented image (false pass, 2/21).
This is WHY: (a) orientation_confidence is capped at `medium`; (b) the gate is signal-only and
never lifts review; (c) POSTURE/ORIENTATION are NOT claimable as solved.

## §6b Extended harness — run 2 (remaining unique real docs, visual oracle in-script)

Same production detector; `RUN_SET=extended`; variants built from the VISUALLY-verified upright
base (script now carries `visualUprightCw` per doc — metadata never trusted). Tagless docs run
only the rot-matrix (cost law: original === rot_0 pixel-wise). `birth_cert_soviet_01` excluded —
byte-duplicate of `birth_cert_handwritten_01` (dedup law).

**Second lying EXIF found:** `military_id_p2_01` carries tag 3 (claims 180°) while its raw
pixels are VISUALLY upright (same 4128×3096 camera family as the birth cert's lying tag 6).
The detector read that original correctly (0) against the visual oracle.

| Doc | Correct | Failures |
|---|---|---|
| military_id_p2_01 (handwritten p2, lying EXIF-3) | 3/5 | rot_180→90; rot_270→**undecidable ⇒ review_orientation_uncertain (honest fail-closed)** |
| marriage_1939_kharkiv_borodavka | 4/4 | — |
| marriage_apostille_vasylsiuk | 4/4 | — |
| marriage_repeat_johnson_kvasnikova | 4/4 | — |
| marriage_zastavnyi_kovshirina (768×1024, watermark) | 2/4 | rot_90→180; rot_270→270 (both 90°-off) |
| divorce_redacted_pechersk | 4/4 | — |
| divorce_blank_template | 3/4 | rot_90→180 (90°-off) |
| **Run 2 total** | **24/29 (83%)** | 1 undecidable (gated), 4 confident misses (false pass) |

**Combined runs 1+2: 43/50 (86%) across 10 unique real docs.** Structure of the errors:
`rot_0` (the dominant real-world case — an already-upright doc) is **10/10**; ALL failures are
on artificially rotated inputs, split between 180°-confusion (printed passport) and 90°-off
(low-res/watermarked certs + military p2). One failure was honestly `undecidable` and produced
the review gate; the other 6 are confident miscorrections ⇒ false `pass` — the standing reason
confidence stays `medium` and the gate stays signal-only.

## §6c ORIENT_180_CHECK — binary 180° disambiguation (master-plan P1, this commit)

New flag `ORIENT_180_CHECK` (default OFF, byte-identical when off — proven by a unit test that
counts fetch calls). When ON, after the 4-cell vote picks a pose, `orientToUpright` runs ONE
extra binary confirm call (`confirmUprightVs180`): a 1×2 grid of [candidate | candidate+180°],
asking which side is upright. 'flipped' → apply one more 180° (`disambiguated180: true`);
undecidable → `detected: false` (honest uncertainty, never a silent guess, same fail-closed path
as before). This targets the ONE failure class the harness has ever measured: 180°-opposite
confusion. It was NOT expected to fix 90°-off errors, and it did not (see below) — that is a
different, unaddressed failure mode.

**Live paired same-session measurement** (`scripts/posture-orient-180check-harness.mts`, raw:
`apps/web/.harness/posture-orient-180check-harness.json`, gitignored): both flag=OFF and
flag=ON run back-to-back per variant, in the SAME process, on the SAME 10 real docs ×
rot_0/90/180/270 = 40 variants each (80 live calls total). Same-session pairing was necessary
because an earlier attempt to diff against the older cached harness JSON showed an implausible
270°-offset "regression" on `birth_cert_handwritten_01` that vanished on rerun — day-to-day
4-cell-vote instability (documented elsewhere in this repo), not a real regression; comparing
against a stale file would have produced a false signal.

| | n | correct | `wrong_rotation_auto_applied` | undecidable |
|---|---|---|---|---|
| flag OFF (baseline, same session) | 40 | 34 | **5** | 1 |
| flag ON (`ORIENT_180_CHECK=1`) | 40 | 38 | **2** | 0 |

`disambiguated180_fired=2` on the ON arm. Row-by-row: of the 6 OFF-arm failures, **3 were exact
180°-opposite errors and all 3 were fixed** by the flag (`internal_passport_01` rot_180/rot_270,
`marriage_repeat_johnson_kvasnikova` rot_270 — each off by exactly 180°); one OFF-arm
`undecidable` (`military_id_p2_01` rot_270) resolved to correct; one 90°-off failure
(`marriage_zastavnyi_kovshirina` rot_90) is UNCHANGED, wrong in both arms — outside the fix's
scope, as expected. One NEW failure appeared only in the ON arm
(`divorce_blank_template` rot_90, `disambiguated180: false` — the 4-cell vote itself gave a
different answer than in the OFF arm for the same image on this rerun; same known vote
instability, not caused by the confirm mechanism).

**Exit criterion status: NOT MET.** `wrong_rotation_auto_applied = 0` requires 0; measured 2
with the flag on (down from 5 without it — a real, targeted improvement on the failure class the
fix addresses, but the exit bar is not cleared). `orientation_confidence` stays `medium`; the
flag ships default-OFF; this is `ORIENTATION_HARNESS_PARTIAL`, not
`ORIENTATION_PASS_FOR_FIXTURE_SET`.

## §6d Doc-type-aware prompt threading (current worktree)

`detectOrientation.ts` now threads `docTypeId` from the production call sites and the measurement
scripts, and builds class-specific hints from `documentRegistry` + `docReadingRules`
(`Document class`, `vision_anchor`, and a layout cue). The request-body path is unit-tested, so the
Gemini prompt itself is covered instead of only the return value.

**Live remeasure after the wiring fix**

| Harness | Correct | Notes |
|---|---|---|
| core `posture-orientation-harness.mts` | **13/14 (93%)** | `internal_passport_01 rot_270` still wrong on the 4-cell vote |
| extended `posture-orientation-harness.mts` | **27/29 (93%)** | historical pre-fix result; the sparse 90° class is fixed in §6e on the measured certificate fixtures |
| `posture-orient-180check-harness.mts` OFF | **37/40** | baseline off-arm after the docType wiring |
| `posture-orient-180check-harness.mts` ON | **38/40** | the 180°-opposite `internal_passport_01 rot_270` case now resolves; `wrong_rotation_auto_applied` drops 3→2 |

**Interpretation:** the docType-aware prompt is a real root-cause improvement for the 180°-opposite
ambiguity, and the separate sparse-template 90° class is now fixed in §6e on the measured
certificate fixtures. The remaining open item is the repo-wide full harness refresh, not a still-
open sparse 90° detector gap. Orientation remains `PARTIAL` until that broader rerun is refreshed,
not because the measured sparse class is still failing.

## §6e Sparse 90° certificate class fixed on the measured fixtures

The sparse 90° class was then fixed at detector level with a deterministic sparse-layout prior
applied inside `detectUprightCwVoted()` for the certificate forms that remained open at the time:
`ua_marriage_certificate` and `ua_divorce_certificate`.

**Direct live probe on the previously failing docs**

| Doc | Variant | Detected |
|---|---|---|
| `marriage_zastavnyi_kovshirina` | `rot_90` | `270` |
| `divorce_blank_template` | `rot_90` | `270` |

**Compact four-rotation probe on both docs**

| Doc | rot_0 | rot_90 | rot_180 | rot_270 |
|---|---|---|---|---|
| `marriage_zastavnyi_kovshirina` | `0` | `270` | `180` | `90` |
| `divorce_blank_template` | `0` | `270` | `180` | `90` |

This closes the previously measured sparse-template 90° false-pass on the two known failing
fixtures. The broader full extended harness rerun was intentionally stopped after the direct proof,
so the repo-wide orientation summary still needs a fresh end-to-end refresh before any global
`ORIENTATION_PASS_FOR_FIXTURE_SET` claim.

## §6f Latest live rerun after sparse fallback: provider drift / undecidable collapse

After the later sparse-fallback code change, the same live extended harness was rerun again and
collapsed to `0/29 correct, 29 undecidable, 0 errors` on the extended raw detector matrix. The
paired `ORIENT_180_CHECK` rerun stayed unstable on the same live provider. This is treated as live
Gemini/provider drift, not a static syntax/type regression. It means the earlier point-in-time
measured sparse-fixture win in §6e remains valid as a historical measurement, but it is not a
repo-wide solved claim.

## §7b Quality threading (this commit)

The D0 intake verdict is no longer dropped for non-reshoot pages: `vision-extract` maps it via
`qualityStatusFromQualityResult` (ACCEPT→ok; blur/brightness/resolution named; unattributable →
`degraded_other`, never silently ok) and threads it per-page through `readOpts.qualityStatus`
into `readDocument` → envelope. Gate: any measured non-ok quality ⇒ `review_quality_low`
(monotonic-up). Quality gate OFF (default) ⇒ `not_measured`, byte-identical behavior.

## §7c Full-page blank / low-ink gate (this commit)

`documentFieldReader.readDocument()` now runs the same `judgeBlankCrop(...)` low-ink test on the
full-page intake buffer before provider selection. Blank / near-blank pages fail closed with a
typed `OCR_EMPTY_OR_LOW_INK` provider error instead of entering either the provider path or the
legacy fallback plane. This closes the structural gap where the crop blank-gate already existed
but the full-page route could still hallucinate on an empty page.

**Verified:** targeted vitest, `tsc 0`, `next build`, and `node scripts/check-no-pii.mjs` clean.

**Scope note:** this is still an evidence gate, not a document-fit detector. `document_fit`
remains `not_measured` because there is still no page-fit oracle; this fix only stops the blank /
near-blank case from reaching any reader.

## §7 Bench integration

`gt-pipeline-bench.mjs` now emits a "Document posture (§7 envelope law)" section:
**posture_gate = not_measured for ALL historical rows** (they pre-date the envelope); never
backfilled. New reads emit `[posture_envelope]`; a future bench run may join per row.

## §8 UX

No UX change in this patch (document-only): the user-visible review reasons already carry
`orientation_uncertain` via the existing fail-closed path. Envelope surfaces are logs/markers.

## §10 Tests

- `posture/__tests__/documentPostureEnvelope.test.ts` — 19/19 pass (not_measured law,
  source/confidence mapping, gate precedence + monotonicity, closed enum, EXIF `suspicious`,
  `orientation_180_disambiguated` surfacing).
- `orientation/__tests__/detectOrientation.test.ts` (+ 2 sibling files) — 34/34 pass, including
  the new `ORIENT_180_CHECK` block (flag OFF byte-identical, confirm candidate/flipped/undecidable,
  fail-open on network/HTTP/unparseable).
- `vitest run src/lib/docintel src/lib/ocr src/lib/translation` — 2551 passed | 4 skipped, 0 fail.
- tsc --noEmit: 0 errors. PII guard: clean.

## FINAL VERDICT

POSTURE_ENVELOPE_WIRED_SIGNAL_ONLY · ORIENTATION_HARNESS_PARTIAL —
NOT "posture solved", NOT "orientation solved". `document_fit` still has no detector.
`ORIENT_180_CHECK` (default OFF) measurably cuts confident 180°-opposite miscorrections
(paired same-session: `wrong_rotation_auto_applied` 5→2 of 40, one `undecidable`→resolved,
0 regressions on the 180°-class it targets). The sparse-template 90° certificate class that was
open in §6d is fixed on the measured certificate fixtures via the sparse-layout prior in
`detectUprightCwVoted()`, but the repo-wide orientation report still needs a fresh full rerun
before any global `ORIENTATION_PASS_FOR_FIXTURE_SET` claim. Confidence stays `medium`.

NEXT: (a) DONE this commit — qualityStatus threaded from the D0 gate into the envelope;
`ORIENT_180_CHECK` binary disambiguation implemented + measured (§6c); posture carried on
`DocumentReadResult` for bench attachment; (b) the sparse-template 90° certificate class is fixed
on the measured fixtures, so the remaining orientation work is the repo-wide refresh rather than
that class; (c) join `[posture_envelope]` markers into the next GT bench run per row
(API response contract change, deliberately out of scope for this commit — see
HANDWRITTEN_CYRILLIC_ONE_BRAIN_PLAN.md for why).

## §6f 2026-07-05 rerun addendum

The current live rerun changed the shape of the problem, but not the verdict:

- `RUN_SET=extended` on the current code: `21/29 correct`, `3 undecidable`, `0 errors`.
- `ORIENT_180_CHECK` live rerun: `flag180=off 26/40 correct, 11 wrong, 3 undecidable`;
  `flag180=on 27/40 correct, 10 wrong, 3 undecidable, 1 disambiguated180`.
- The only actual `disambiguated180` win on this rerun was `marriage_apostille_vasylsiuk rot_0`.
- The hard remaining failures are still the `birth_cert_handwritten_01` and `military_id_p1_01`
  classes, which means the open problem is no longer the binary 180 check itself but the
  broader 90°/doc-type-specific pose confusion.

## §6g 2026-07-05 handwritten fail-closed follow-up

The root cause shifted again: handwritten docs now reject low-confidence / non-Cyrillic OSD
instead of trying to auto-rotate from unstable sample/layout signals. Live probe on the real
fixtures now behaves as follows:

- `birth_cert_handwritten_01` → `null` on all four rotations
- `military_id_p1_01` → `null` on all four rotations
- `military_id_p2_01` → correct corrections preserved via reliable Cyrillic OSD
- `internal_passport_01` → correct corrections preserved via reliable Cyrillic OSD
- `marriage_1939_kharkiv_borodavka` → correct corrections preserved via reliable Cyrillic OSD

Verified in this turn with targeted `vitest`, `tsc --noEmit`, and `node scripts/check-no-pii.mjs`.
This is safer than the previous handwritten layout fallback, but the broader handwriting/orientation
problem is still not fully solved. The next open step is to add a separate 90°-class or class-aware
decision path only if it can beat this fail-closed baseline on live fixtures.

## §7d 2026-07-05 document-fit follow-up

`documentFit` was added as a conservative helper, but the live real-doc probe showed that it is
not trustworthy enough for the main reader path yet. Measurements:

- `birth_cert_handwritten_01` → `full_page_visible`
- `military_id_p1_01` → `full_page_visible`
- `military_id_p2_01` → `full_page_visible`
- `internal_passport_01` → `full_page_visible`
- `marriage_1939_kharkiv_borodavka` → `full_page_visible`
- `divorce_redacted_pechersk` → `full_page_visible`
- `divorce_blank_template` → `full_page_visible`
- `marriage_apostille_vasylsiuk` → `cropped_or_partial` on a visually full-page spread

Because of that false positive, `readDocument()` now keeps fit disabled by default and only threads
the signal when `DOCUMENT_FIT_ENABLED=1`. The envelope still accepts explicit `manual_crop` and
`cropped_or_partial` evidence for future probe work, but the main path remains honest:
`document_fit` is not treated as solved.

Verified this turn with targeted `vitest`, `tsc --noEmit`, and `node scripts/check-no-pii.mjs`.

## §6h 2026-07-05 handwritten 180-confirm default

The earlier handwritten fail-closed baseline was too strict for the real handwritten fixtures:
`birth_cert_handwritten_01` and `military_id_p1_01` were still miscorrecting on the 180° class
when `ORIENT_180_CHECK` was left unset. Live probe on the same real fixtures showed that running
the binary 180° confirm by default for handwritten doc classes fixes those miscorrections without
changing the printed/sparse fixtures we already measured:

- `birth_cert_handwritten_01` now resolves correctly on all four rotations
- `military_id_p1_01` now resolves correctly on all four rotations
- `military_id_p2_01`, `internal_passport_01`, and `marriage_1939_kharkiv_borodavka` stay correct

Implementation: handwritten doc classes now run the 180° confirm even when `ORIENT_180_CHECK`
is unset. This is not a full solve of the broader 90°/class-specific orientation problem, but it
does close the specific handwritten 180° miscorrection that was blocking the user-visible path.

Verified this turn with targeted `vitest`, `tsc --noEmit`, and `node scripts/check-no-pii.mjs`.
