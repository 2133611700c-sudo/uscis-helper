# T3PS Controlled Beta Day1 Report

- Task: `T3PS-09-CONTROLLED-BETA-OPERATIONS-AND-FIRST-USERS`
- Timestamp (UTC): `2026-05-15T23:50:00Z`
- Production SHA: `ab518223789a60d52c84c3d852f0d1ca21d8671d`

## Operations status
- Health: `ok=true`, SHA matches baseline.
- Monitoring transport: `BLOCKED_WITH_EXACT_MISSING_ENV`.
- Missing env keys: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CRON_SECRET`.

## Support flow
- Manual-help CTA exists in TPS UI.
- Non-PII ticket creation test: `PASS`.
  - Response: `{"ok":true,"ticket_id":"9b7fb5ae-55be-4b60-a179-f5c2cb5eec92","status":"queued"}`
- Route stores only reason/email/locale/stage by contract; no image/raw OCR fields accepted in model.

## Dry run
- Status: `PASS`
- Evidence: `/Users/sergiiredacted/work/uscis-helper/docs/reports/evidence/t3ps-final-release/browser-run-clean/browser_summary.json`
- OCR: `200`
- Generate: `200`
- ZIP intercept bytes: `1825484`
- Failed requests: `2` (non-blocking analytics script 404 noise).

## Testers
- Prepared testers list and invitation template: `3` trusted tester IDs.
- Evidence: `/Users/sergiiredacted/work/uscis-helper/docs/audit/T3PS_CONTROLLED_BETA_USERS.md`

## Issues
- P0: monitoring transport env blocker.
- P1: manual-review endpoint strict schema fix implemented; pending production deploy verification.
- Source: `/Users/sergiiredacted/work/uscis-helper/docs/audit/T3PS_BETA_ISSUES.yaml`

## Day1 status
- `BETA_BLOCKED_MONITORING`
- Continue beta invites only after monitoring transport keys are configured and test alert is delivered.
