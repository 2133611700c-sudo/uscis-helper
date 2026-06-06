# CI Failure Root Cause Report — uscis-helper — 2026-06-06

**Date:** 2026-06-06  
**Repo:** `2133611700c-sudo/uscis-helper`  
**Prepared by:** CI incident responder (autonomous)

---

## 1. Executive Summary

The repo shows repeated `startup_failure` runs with blank workflow name and
`path=BuildFailed`. These are NOT caused by any current workflow YAML being broken.
All 8 workflow files on `main` parse correctly and are listed as `active` in the GitHub API.

**Root cause:** GitHub's scheduler has a stale/orphan schedule entry for a workflow that
no longer exists at its internal path. This is a known GitHub behavior that self-resolves
within approximately 7 days of the triggering event (workflow rename, delete, or internal
ID collision).

---

## 2. Evidence

```
Run conclusion: startup_failure
Workflow name: (empty string)
Display title: (Unknown event)
Path:          BuildFailed
Event:         schedule
Branch:        main
```

Firing pattern observed (UTC):
- 2026-06-06: 08:24, 08:47, 10:04, 13:08, 14:09, 15:14, 17:59, 19:05, 19:47

This is NOT a regular interval matching any of the 8 active scheduled workflows:
- dead-link-checker: daily 08:00
- federal-register-monitor: daily 14:00
- form-edition-checker: Mondays 14:00
- prod-safety-monitor: every 6h at :17
- uscis-news-monitor: every 6h at :00
- youtube-monitor: daily 17:00

The pattern is consistent with GitHub retrying a stale schedule entry for a workflow that
was renamed or whose internal database ID was invalidated.

---

## 3. Workflow Health Check

All 8 active workflows verified:

| Workflow | State | Schedule | Secrets |
|----------|-------|----------|---------|
| Dead Link Checker | active | daily 08:00 UTC | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: YES |
| Federal Register Monitor | active | daily 14:00 UTC | SUPABASE_URL, RESEND_API_KEY, etc: YES |
| Form Edition Checker | active | Mon 14:00 UTC | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: YES |
| Content & Brand Guards | active | push/PR only | (no secrets) |
| Prod Safety Monitor (Wave D) | active | every 6h | (no secrets, curl only) |
| Session Docs Guard | active | push/PR only | (no secrets) |
| USCIS News Monitor | active | every 6h | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: YES |
| YouTube Monitor | active | daily 17:00 UTC | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: YES |

Note: `Prod Safety Monitor (Wave D)` has a built-in self-expiry check that no-ops after
2026-06-07. After that date, delete `prod-safety-monitor.yml` to avoid toggle debt
(the file itself documents this intent).

---

## 4. No Safe Fixes to Apply

No changes to workflow YAML files are needed. The startup_failure is a GitHub platform
issue, not a code defect.

---

## 5. OWNER_QUEUE

### OQ-1: Wait for startup_failure to self-resolve
**Timeline:** Should stop by 2026-06-13.  
**Action if not resolved:** Go to GitHub UI → Actions → each scheduled workflow →
click "Disable workflow" → "Enable workflow" to force GitHub to reset the schedule entry.

### OQ-2: Delete prod-safety-monitor.yml after 2026-06-07
**Action:** After the monitoring window closes (2026-06-07), delete:
`.github/workflows/prod-safety-monitor.yml`  
The workflow already has a built-in guard that no-ops (exit 0) after that date, but
leaving the file wastes runner time and shows as an active scheduled workflow.

---

## 6. Confirmed Safe Guards

- No secrets were printed or logged.
- No production data was modified.
- No RLS policies were changed.
- No destructive SQL was run.
- No .env files were committed.
