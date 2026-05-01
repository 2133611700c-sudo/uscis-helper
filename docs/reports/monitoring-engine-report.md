# Monitoring Engine Report (TASK-06)

- Date (UTC): 2026-05-01T08:46:10Z
- Branch: `pain-misinfo-faq-20260430-2242`
- Commit: `105778c`
- Supabase project ref: `taqlarevwifgfnjxilfh`

## Verification Summary

- Migration applied: **yes**
  - Evidence: `docs/reports/evidence/task-06/09-supabase-migration-success.png`
  - Method: Supabase SQL Editor execution of `supabase/migrations/20260501010337_monitoring_engine.sql`

- Tables verified: **yes**
  - Evidence: `docs/reports/evidence/task-06/10-supabase-table-verification-4rows.png`
  - Expected table list result: **4 rows**
    - `dead_links_log`
    - `form_editions`
    - `monitoring_alerts`
    - `monitoring_sources`

- Initial table counts (before seed): **verified**
  - Evidence: `docs/reports/evidence/task-06/11-supabase-initial-counts-zero.png`
  - Counts:
    - `monitoring_sources`: 0
    - `monitoring_alerts`: 0
    - `form_editions`: 0
    - `dead_links_log`: 0

- Sources seeded: **yes**
  - CLI evidence: `/tmp/task-06-seed-rerun.log`
  - Supabase evidence: `docs/reports/evidence/task-06/12-supabase-seeded-source-type-counts.png`
  - Seed output:
    - Latest rerun: `Seed completed. Inserted: 0, skipped(existing): 21`
    - Initial successful run in this task window inserted 21 rows.
  - Source counts:
    - `federal_register`: 1
    - `form_page`: 8
    - `uscis_page`: 2
    - `uscis_rss`: 1
    - `youtube_rss`: 9
    - **Total**: 21

- GitHub secrets verified by name: **yes (required names except optional Resend)**
  - CLI evidence: `gh secret list`
  - Browser evidence: `docs/reports/evidence/task-06/16-github-actions-secrets.png`
  - Present:
    - `SUPABASE_URL`
    - `SUPABASE_SERVICE_ROLE_KEY`
    - `CONTACT_EMAIL_DESTINATION`
    - `FEDERAL_REGISTER_USER_AGENT`
  - Also present:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Missing:
    - `RESEND_API_KEY` (optional unless email delivery verification is required)

## GitHub Workflow Trigger Verification

- Target branch for manual run: `pain-misinfo-faq-20260430-2242`
- Workflow files exist on target branch: **yes**
  - Evidence: `gh api 'repos/2133611700c-sudo/uscis-helper/contents/.github/workflows?ref=pain-misinfo-faq-20260430-2242'`
  - Browser evidence: `docs/reports/evidence/task-06/14-github-branch-page.png`
- Actions UI verification screenshot:
  - `docs/reports/evidence/task-06/15-github-actions-branch-view.png`

### Manual trigger results (real)

Evidence: `/tmp/task-06-workflow-dispatch.log`

| Workflow | Trigger attempt | Result | Reason |
|---|---|---|---|
| `dead-link-checker.yml` | attempted | failed | HTTP 404: workflow not found on default branch |
| `uscis-news-monitor.yml` | attempted | failed | HTTP 404: workflow not found on default branch |
| `federal-register-monitor.yml` | attempted | failed | HTTP 404: workflow not found on default branch |
| `form-edition-checker.yml` | attempted | failed | HTTP 404: workflow not found on default branch |
| `youtube-monitor.yml` | attempted | failed | HTTP 404: workflow not found on default branch |

- Workflows triggered: **0/5 successful dispatches**
- Workflows succeeded: **0/5**
- `gh run list --limit 20`: empty (`[]`)

## DB Effects After Workflow Attempts

- Evidence (counts): `docs/reports/evidence/task-06/13-supabase-post-workflow-counts.png`
  - `monitoring_alerts`: 0
  - `form_editions`: 0
  - `dead_links_log`: 0

- Evidence (source monitoring status view): `docs/reports/evidence/task-06/18-supabase-monitoring-sources-last-checked-results.png`
  - Query:
    - `select source_type, last_checked_at from monitoring_sources order by source_type, url limit 30;`
  - Observed:
    - 21 rows returned
    - `last_checked_at` values are `NULL` (expected because no workflow run executed)

## Browser Evidence Folder

- `docs/reports/evidence/task-06/`
  - `08-supabase-taql-overview.png`
  - `09-supabase-migration-success.png`
  - `10-supabase-table-verification-4rows.png`
  - `11-supabase-initial-counts-zero.png`
  - `12-supabase-seeded-source-type-counts.png`
  - `13-supabase-post-workflow-counts.png`
  - `14-github-branch-page.png`
  - `15-github-actions-branch-view.png`
  - `16-github-actions-secrets.png`
  - `18-supabase-monitoring-sources-last-checked-results.png`

## Final Status

**PARTIAL**

Reason:
- Migration: done
- Seeding: done
- Mandatory workflow success gate not met: `dead-link-checker.yml` could not be dispatched because GitHub returns `workflow ... not found on the default branch`.

To reach **DONE**:
1. Make these workflow files available on the repository default branch (`main`) or change default branch policy.
2. Re-run 5 dispatch commands.
3. Confirm at least `dead-link-checker.yml` succeeds and capture run logs/screenshots.
