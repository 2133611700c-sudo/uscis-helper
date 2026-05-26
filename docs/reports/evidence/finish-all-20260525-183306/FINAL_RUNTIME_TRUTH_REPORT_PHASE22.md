# FINAL RUNTIME TRUTH REPORT — PHASE 22 (POST-DEPLOY)

- Date: 2026-05-25
- Live SHA: `692619ca62d47ecb8d3b23a10cf4b137b1351230`
- Commit deployed: `692619c`
- Status: `DEGRADED`

## VERIFIED
1. Production E2E pass with generate ZIP:
   - `e2e/phase22_booklet_review_artifacts/`
2. PDF readback proof:
   - `pdf/phase22_unzipped/I-821.txt`
   - `pdf/phase22_unzipped/I-765.txt`
   - `pdf/phase22_pdf_field_grep.txt`
3. Step6 H.R.1 runtime UI visibility (all locales EN/RU/UK/ES):
   - `runtime-audit/phase22_hr1_locale_results.json`
   - screenshots/text: `runtime-audit/phase22_hr1_*.png|txt`
4. Synthetic booklet rerun on live (`booklet_0` + `booklet_270`):
   - `bench/phase22_synthetic_270_summary.json`
   - result: city/province/middle stable (`Trostianets`, `Vinnytsia Oblast`, `Serhiiovych`) in both rows.
5. Audit trail still writing new shape:
   - `audit-db/phase22_recent_audit_rows.json`
   - shows `has_brain_raw=true`, `rejected_fields` as `array`.
6. Drift gate green/red still valid:
   - `logs/phase22_drift_exit_codes.txt`

## OPEN / BLOCKED
1. Owner-mode full-chain OTP runtime verification: `BLOCKED` (OTP input from owner mailbox required).
2. Full matrix closure (all required owner/normal + mobile/desktop + EN/RU rows with generate+ZIP+PDF): `UNVERIFIED` in this post-deploy pass.
3. Multi-identity real booklet benchmark (not synthetic): `UNVERIFIED`.

## Notes
- Booklet DOB remains honest manual-fallback path; fresh audit rows still show `validated_skipped: dob/date not parseable`.
