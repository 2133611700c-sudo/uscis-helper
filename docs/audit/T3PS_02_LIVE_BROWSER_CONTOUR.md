# T3PS-02 Live Browser Contour Verification

- task_id: `T3PS-02-LIVE-BROWSER-CONTOUR-VERIFICATION`
- generated_at: `2026-05-15T01:26:40Z`
- deployed_commit_sha: `0e239635b062c1c0e9289bc08794da5d7fbe59b7`
- verdict: **FAIL**

## Browser runs executed

1) Prior run bundle:  
`/Users/sergiiredacted/work/uscis-helper/docs/reports/evidence/t3ps-browser-contour/`

2) Re-run bundle (latest):  
`/Users/sergiiredacted/work/uscis-helper/docs/reports/evidence/t3ps-final-release/browser-run/`

## Latest run facts (VERIFIED)

- `ocr_status`: `null` (no OCR API request captured)
- `generate_status`: `null` (no generate API request captured)
- `downloaded_file`: `null`
- failed requests: 2x `404 /ru/_vercel/insights/script.js`
- screenshots captured: 7 (`01_start_fresh.png` ... `07_generate_result.png`)

### Re-run update (`2026-05-15`)

Evidence dir: `/Users/sergiiredacted/work/uscis-helper/docs/reports/evidence/t3ps-final-release/browser-run/`

- OCR API reached: `200`
- Generate API reached: `422` (missing fields in payload)
- Missing fields returned by API:
  - `family_name`, `given_name`, `dob`
  - `passport_number`, `passport_expiration_date`
  - `us_address_street`, `us_address_city`, `us_address_state`, `us_address_zip`
  - `last_entry_date`, `daytime_phone`, `email`, `marital_status`
- ZIP download: `not captured`

## Required pass criteria vs actual

- Generate + ZIP in same run: **NOT MET**
- OCR upload proof: **NOT MET**
- prior_denial_yes screenshot: **NOT MET**
- console/network export: **MET**

## Exact broken step

Wizard interaction did not reach controllable upload/review/generate checkpoints in automated mobile run (no file input and no attestation/generate API calls observed).

## One recommended fix

Add stable test IDs/selectors for wizard controls (`upload`, `continue`, `attestation`, `generate`) and rerun this prompt against production until one session captures:
1) `POST /api/tps/ocr/extract = 200`,
2) `POST /api/tps/generate-packet = 200`,
3) ZIP download artifact.
