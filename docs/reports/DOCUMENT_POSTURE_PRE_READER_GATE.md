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

## §7b Quality threading (this commit)

The D0 intake verdict is no longer dropped for non-reshoot pages: `vision-extract` maps it via
`qualityStatusFromQualityResult` (ACCEPT→ok; blur/brightness/resolution named; unattributable →
`degraded_other`, never silently ok) and threads it per-page through `readOpts.qualityStatus`
into `readDocument` → envelope. Gate: any measured non-ok quality ⇒ `review_quality_low`
(monotonic-up). Quality gate OFF (default) ⇒ `not_measured`, byte-identical behavior.

## §7 Bench integration

`gt-pipeline-bench.mjs` now emits a "Document posture (§7 envelope law)" section:
**posture_gate = not_measured for ALL historical rows** (they pre-date the envelope); never
backfilled. New reads emit `[posture_envelope]`; a future bench run may join per row.

## §8 UX

No UX change in this patch (document-only): the user-visible review reasons already carry
`orientation_uncertain` via the existing fail-closed path. Envelope surfaces are logs/markers.

## §10 Tests

- `posture/__tests__/documentPostureEnvelope.test.ts` — 11/11 pass (not_measured law,
  source/confidence mapping, gate precedence + monotonicity, closed enum).
- `vitest run src/lib/docintel src/lib/ocr` — 629 passed | 2 skipped, 0 fail.
- tsc --noEmit: 0 errors.

## FINAL VERDICT

POSTURE_ENVELOPE_WIRED_SIGNAL_ONLY · ORIENTATION_HARNESS_MEASURED_43_OF_50 —
NOT "posture solved", NOT "orientation solved": document_fit has no detector; 6/50 variants are
confident miscorrections (false `pass`) on artificially rotated inputs, though the dominant
real-world case (already-upright doc) measured 10/10.

NEXT: (a) DONE this commit — qualityStatus threaded from the D0 gate into the envelope;
(b) 90°/180°-disambiguation experiment (photo-position / text-baseline prior) BEFORE any
confidence upgrade; (c) join `[posture_envelope]` markers into the next GT bench run per row.
