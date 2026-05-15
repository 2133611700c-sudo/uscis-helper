# T3PS-04 Real Document Pilot + AI/OCR Robustness

- Task: T3PS-04-REAL-DOCUMENT-PILOT-AI-OCR-ROBUSTNESS
- Commit: `3128f08c1a31112d715b479b668ab3a52f0b0563`
- Verdict: **BLOCKED**

## Why blocked
1. No required real pilot files found in `/Users/sergiikuropiatnyk/Downloads/` (`t3ps-real-*` / `tps-real-test.*`).
2. Production `/api/tps/health` currently reports `ocr_configured: false`.

## What still executed
- Synthetic OCR safety test (brain off): `docs/audit/generated/t3ps_phase3_brain_off_safety.json`
- OCR robustness matrix (20 degraded variants):
  - `docs/audit/T3PS_OCR_ROBUSTNESS_MATRIX.csv`
  - `docs/audit/T3PS_OCR_ROBUSTNESS_MATRIX.md`
- Manual fallback endpoint test: `/api/tps/manual-review` -> 200, ticket queued (no image stored).

## Key results
- Synthetic passport call: `200`, brain header `off`, but `field_count=0`.
- Robustness matrix: 19x 200 with zero fields, 1x 422 (`too_small`).
- This does not satisfy real-document pilot acceptance for T3PS-04.

## Privacy
- Real-file delete command executed.
- No real image files tracked in git.

## Required next fix batch
1. Configure production OCR (`ocr_configured=true` in health).
2. Provide real/sanitized pilot file at required path and re-run full redacted browser flow.
