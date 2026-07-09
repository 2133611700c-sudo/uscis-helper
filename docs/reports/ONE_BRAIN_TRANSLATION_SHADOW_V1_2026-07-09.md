# ONE BRAIN — Translation SHADOW_ONLY v1 (2026-07-09)

Phase B–D of translation_shadow_v1. SHADOW_ONLY. User-visible output UNCHANGED. Translation only. Preview.

## Baseline
See ONE_BRAIN_PILOT_BASELINE_2026-07-09.md (docType 100%, handwriting 76%, N=21 pilot, per-family < 25).

## Shadow config (wired, default OFF)
- `apps/web/src/app/api/translation/vision-extract/route.ts`: `runIntakeShadow` on the raw first page,
  gated FIRST by `ONE_BRAIN_INTAKE_SHADOW` → OFF = zero-cost byte-identical no-op; ON = PII-free trace,
  fail-open, never touches the response. Shared `buildRealIntakeProviders` (diag + translation).
- Preview env `ONE_BRAIN_INTAKE_SHADOW=1` on the shadow preview only. Prod/main = OFF.

## Trace completeness (spans present per intake)
preflight → orientation → language(+printed/handwriting) → country → family/type → pageSide →
readerRoute → reviewPolicy. All nodes emit status/timing; verified `measured` on the real birth cert
(ONE_BRAIN_INTAKE_LIVE_MEASURED_2026-07-09.md).

## Metric split (Phase C)
| metric | measured | note |
|---|---|---|
| docType | 100% (19/19) | selectedDocType correct |
| country | correct by rows | SU/UA/US |
| handwriting | 76% | handwritingPresent vs GT |
| review-policy | 5 safe FP, 0 FN | minimize false-NEGATIVE first (done: 0) |
| runtime | ~14s/doc, 0 err, 0 504 | 21/21 |

## Success criteria (SHADOW v1)
- 0 user-visible output changes ✅ (flag OFF by default; POST returned the normal Translation response)
- 0 PII in logs/reports ✅ (toSafeLog + summarizeTrace)
- 0 504 / provider crash ✅
- docType stable ✅ (100%)
- unknown/bad image fail-closed ✅ (corrupt→not_a_document; military_id/dl→unknown)
- handwriting never auto-final ✅ (force_review + 0 false-negatives)

## Blockers / honest limits
- N per family < 25 → NOT family-trusted. Need more real docs per family (owner-provided) to reach N>=25.
- Field RECOGNITION (not intake) still 429 on the preview Gemini key — separate from this shadow decision.
- 5 passport handwriting FP remain (safe over-review) — a review-policy item, not a docType/shadow blocker.

## Recommendation
**No flip.** Shadow v1 is safe (all success criteria met, no user-visible change, no PII, no FN). Next:
gather N>=25/family real docs, then re-run the shadow scorecard per family; only after a clean per-family
window + owner sign-off consider a controlled Translation flip. Do NOT flip on pilot N=21.
