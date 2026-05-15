# T3PS-04 Real Document Pilot + AI/OCR Robustness

- Task: T3PS-04-REAL-DOCUMENT-PILOT-AI-OCR-ROBUSTNESS
- Commit: `2b8b64bb011f090000add69b21c2005a2c2a86d9`
- Verdict: **FAIL**

## Real-file pilot (redacted)
- Detected file: `Passport Kuropiatnyk .jpg`
- Size: `4,091,062 bytes`
- MIME: `image/jpeg`
- File was deleted after pilot per privacy rule.

## Endpoint pilot result (redacted)
- `POST /api/tps/ocr/extract` with `doc_type_hint=passport`: **200**
- `x-tps-brain`: `off`
- `x-tps-brain-added`: `0`
- `provider`: `google_vision`
- `module_field_count`: `0`
- `module_field_keys`: `[]`

## Why fail
1. Real document did not produce extracted structured fields.
2. Production health still reports `ocr_configured: false`.
3. End-to-end real-doc browser flow cannot be considered operational with zero extraction.

## What still executed
- Synthetic OCR safety test (brain off): `docs/audit/generated/t3ps_phase3_brain_off_safety.json`
- OCR robustness matrix (20 degraded variants):
  - `docs/audit/T3PS_OCR_ROBUSTNESS_MATRIX.csv`
  - `docs/audit/T3PS_OCR_ROBUSTNESS_MATRIX.md`
- Manual fallback endpoint test: `/api/tps/manual-review` -> 200, ticket queued (no image stored).

## Key results
- Synthetic passport call: `200`, brain header `off`, but `field_count=0`.
- Robustness matrix: 19x 200 with zero fields, 1x 422 (`too_small`).
- This fails real-document pilot acceptance for T3PS-04.

## Privacy
- Real-file delete command executed.
- No real image files tracked in git.

## Required next fix batch
1. Configure production OCR (`ocr_configured=true` in health).
2. Restore non-empty field extraction for passport doc_type on production.
3. Re-run redacted browser real-doc flow and verify generated packet semantics.
