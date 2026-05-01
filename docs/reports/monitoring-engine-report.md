# Monitoring Engine Report (TASK-06)

- Date (UTC): 2026-05-01T17:43:00Z
- Branch verified: `main`
- PR: [#1](https://github.com/2133611700c-sudo/uscis-helper/pull/1)
- Merge commit: `f02f305b3ed0a1cddbcd054416f29d6875b9eeb3`
- Supabase project ref: `taqlarevwifgfnjxilfh`

## 1) Supabase Verification

- Migration applied: **yes**
  - Evidence: `docs/reports/evidence/task-06/09-supabase-migration-success.png`
  - SQL source: `supabase/migrations/20260501010337_monitoring_engine.sql`

- Required tables exist: **yes (4/4)**
  - Evidence: `docs/reports/evidence/task-06/10-supabase-table-verification-4rows.png`
  - Tables:
    - `monitoring_sources`
    - `monitoring_alerts`
    - `form_editions`
    - `dead_links_log`

- Seed run status: **yes**
  - CLI evidence: `/tmp/task-06-seed-rerun.log`
  - Supabase evidence: `docs/reports/evidence/task-06/12-supabase-seeded-source-type-counts.png`
  - Seed state after rerun: `Inserted: 0, skipped(existing): 21`
  - Source totals:
    - `federal_register`: 1
    - `form_page`: 8
    - `uscis_page`: 2
    - `uscis_rss`: 1
    - `youtube_rss`: 9
    - **Total**: 21

## 2) GitHub Verification

- Default branch verified: `main`
- Workflow files visible on default branch: **yes**
  - Evidence: `docs/reports/evidence/task-06/19-github-actions-main-workflows-visible.png`
  - Files:
    - `.github/workflows/dead-link-checker.yml`
    - `.github/workflows/uscis-news-monitor.yml`
    - `.github/workflows/federal-register-monitor.yml`
    - `.github/workflows/form-edition-checker.yml`
    - `.github/workflows/youtube-monitor.yml`

- Secrets by name verified: **yes**
  - Evidence: `docs/reports/evidence/task-06/16-github-actions-secrets.png`
  - Present:
    - `SUPABASE_URL`
    - `SUPABASE_SERVICE_ROLE_KEY`
    - `CONTACT_EMAIL_DESTINATION`
    - `FEDERAL_REGISTER_USER_AGENT`
  - Missing optional:
    - `RESEND_API_KEY` (only needed for email sending verification)

## 3) Manual Workflow Runs on `main`

Dispatch method: `gh workflow run ... --ref main`

| Workflow | Run URL | Branch | Status | Result | Failure Step | Error |
|---|---|---|---|---|---|---|
| `dead-link-checker.yml` | https://github.com/2133611700c-sudo/uscis-helper/actions/runs/25224990241 | `main` | completed | failure | `Run actions/setup-node@v4` | `Unable to locate executable file: pnpm` |
| `uscis-news-monitor.yml` | https://github.com/2133611700c-sudo/uscis-helper/actions/runs/25224990257 | `main` | completed | failure | `Run actions/setup-node@v4` | `Unable to locate executable file: pnpm` |
| `youtube-monitor.yml` | https://github.com/2133611700c-sudo/uscis-helper/actions/runs/25224990295 | `main` | completed | failure | `Run actions/setup-node@v4` | `Unable to locate executable file: pnpm` |
| `federal-register-monitor.yml` | https://github.com/2133611700c-sudo/uscis-helper/actions/runs/25224990350 | `main` | completed | failure | `Run actions/setup-node@v4` | `Unable to locate executable file: pnpm` |
| `form-edition-checker.yml` | https://github.com/2133611700c-sudo/uscis-helper/actions/runs/25224990370 | `main` | completed | failure | `Run actions/setup-node@v4` | `Unable to locate executable file: pnpm` |

Workflow evidence screenshots:
- `docs/reports/evidence/task-06/20-run-dead-link-checker-25224990241.png`
- `docs/reports/evidence/task-06/20-run-uscis-news-monitor-25224990257.png`
- `docs/reports/evidence/task-06/20-run-youtube-monitor-25224990295.png`
- `docs/reports/evidence/task-06/20-run-federal-register-monitor-25224990350.png`
- `docs/reports/evidence/task-06/20-run-form-edition-checker-25224990370.png`

Failed log extract reference:
- `/tmp/task-06-failed-last50.log`

## 4) Supabase Post-Run Effects

Post-run SQL evidence:
- `docs/reports/evidence/task-06/21-supabase-postrun-table-counts.png`
- `docs/reports/evidence/task-06/22-supabase-postrun-source-type-counts.png`
- `docs/reports/evidence/task-06/18-supabase-monitoring-sources-last-checked-results.png`

Post-run counts:
- `monitoring_sources`: 21
- `monitoring_alerts`: 0
- `form_editions`: 0
- `dead_links_log`: 0

Monitoring sources by type:
- `federal_register`: 1
- `form_page`: 8
- `uscis_page`: 2
- `uscis_rss`: 1
- `youtube_rss`: 9

`last_checked_at` status:
- 21 rows visible
- values remain `NULL` (consistent with all workflow runs failing before monitor steps execute)

## 5) Final Status

**PARTIAL**

Reason:
- Migration and seed are complete.
- Workflows are now correctly visible on default branch (`main`) and can be dispatched.
- Mandatory success gate is not met because all 5 runs failed on missing `pnpm` in GitHub Actions runtime.

Blocker to reach DONE:
1. Fix workflow setup so `pnpm` is installed before/with `actions/setup-node`.
2. Re-run workflows on `main`.
3. Confirm at least `dead-link-checker.yml` completes successfully and verify non-empty DB effects if changes are detected.
