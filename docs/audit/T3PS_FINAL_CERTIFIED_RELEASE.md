# T3PS-07 Final Real-Doc ZIP Closeout

- Task ID: `T3PS-07-FINAL-REAL-DOC-ZIP-CLOSEOUT`
- Generated at (UTC): `2026-05-15T23:22:00Z`
- Repo: `/Users/sergiiredacted/work/uscis-helper`

## What Was Broken

Real-document browser contour reached Step 6, but `Generate` returned `422` with:
- `passport_number`
- `passport_expiration_date`

## What Was Fixed

- Added stable Step 6 selectors in `GeneratePacketBlock`:
  - `data-testid="tps-passport-number-input"`
  - `data-testid="tps-passport-expiration-input"`
- Added localized helper copy for manual expiration fallback (RU/UK/EN/ES).
- Kept server validation unchanged (no weakening of required fields).

## Production + Evidence

- `origin/main` commit: `36ec53e7e3a38708053383ecc5b7ac36cd6e80c5`
- `/api/tps/health` SHA: `36ec53e7e3a38708053383ecc5b7ac36cd6e80c5`
- Gates: `PASS` (`typecheck`, `vitest`, `lint`, `guard`, `build`)

### Real-doc browser run (mobile 390x844)

Evidence: `/Users/sergiiredacted/work/uscis-helper/docs/reports/evidence/t3ps-final-release/browser-run-clean/browser_summary.json`

- `OCR: 200`
- `Generate: 200`
- `ZIP downloaded: true`
- `ZIP bytes: 1826099`
- Non-blocking console/network noise: `/_vercel/insights/script.js 404` (analytics script, not product flow).

Redacted screenshots:
- `/Users/sergiiredacted/work/uscis-helper/docs/reports/evidence/t3ps-final-release/browser-run-clean/screenshots-redacted/07_step6_screen.png`
- `/Users/sergiiredacted/work/uscis-helper/docs/reports/evidence/t3ps-final-release/browser-run-clean/screenshots-redacted/08_before_generate.png`
- `/Users/sergiiredacted/work/uscis-helper/docs/reports/evidence/t3ps-final-release/browser-run-clean/screenshots-redacted/09_after_generate.png`

### ZIP/PDF proof (redacted)

- ZIP listing: `/Users/sergiiredacted/work/uscis-helper/docs/reports/evidence/t3ps-final-release/zip-list.txt`
- I-821 keys only: `/Users/sergiiredacted/work/uscis-helper/docs/reports/evidence/t3ps-final-release/i821-fields-redacted.txt`
- I-765 keys only: `/Users/sergiiredacted/work/uscis-helper/docs/reports/evidence/t3ps-final-release/i765-fields-redacted.txt` (`NOT_PRESENT` in this run)
- Summary: `/Users/sergiiredacted/work/uscis-helper/docs/reports/evidence/t3ps-final-release/pdf-proof-closeout/summary.json`

Confirmed in generated PDF:
- `family_name`
- `given_name`
- `dob`
- `passport_number`
- `passport_expiration_date`
- `marital_status`
- `Part7` checkboxes
- `cyrillic_leak = NONE`

## Final Verdict

- `GO_CONTROLLED_BETA`
- `paid_launch_ready: false`
