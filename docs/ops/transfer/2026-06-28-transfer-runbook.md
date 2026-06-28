# Supabase Project Transfer — Runbook

**Date:** 2026-06-28
**Project:** `rtfxrlountkoegsseukx` (uscis-helper, messenginfo.com production)
**Source org:** `nqzhalwtefrgoguvlqex` ("USCIS Helper", Free plan, main account `2133611700c-sudo`)
**Target org:** `mbsqpyxwkfuwymnebsbh` (under `2133611700uscis@gmail.com`, currently holds staging `rxnlpvldngxgdxkxoaaj`)

## Why transfer (confirmed motivation)

Consolidate prod into the new Free-account organisation `mbsqpyxwkfuwymnebsbh`, which was created specifically to keep prod on Free. Source org showed Free quota pressure ("тариф рос"); the new org has unused Free headroom. Result after transfer: 2/2 Free projects in target org (staging + prod), 0 projects in old org.

ADR-023 staging isolation is NOT broken: staging stays under the new email exactly as before; only prod moves into the same org.

## What stays the same (verified by read-only audit)

| Asset | After transfer |
|---|---|
| Project ref `rtfxrlountkoegsseukx` | unchanged |
| API URL `https://rtfxrlountkoegsseukx.supabase.co` | unchanged |
| Anon / service-role / JWT secret | unchanged |
| Region `us-east-1` | unchanged (transfer does NOT change region) |
| All 47 public tables, 1751 rows | unchanged (in-place ownership change, not migration) |
| 17 storage objects, 6,187,137 bytes | unchanged |
| 51 migrations, latest `20260615060119` | unchanged |
| GitHub Secrets `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_*` | unchanged values |
| Vercel env vars on `uscis-helper` project | unchanged values |
| Code references | runtime code uses `NEXT_PUBLIC_SUPABASE_URL` env only — zero hardcoded refs |

Baseline: `docs/ops/transfer/2026-06-28-prod-baseline.json` (re-run smoke after transfer to prove zero drift).

## Pre-flight checks (do these BEFORE clicking Transfer)

1. **Log into Supabase as the new account** `2133611700uscis@gmail.com` → Organization `mbsqpyxwkfuwymnebsbh` → **Team** → confirm plan is Free and that you are Owner.
2. **Invite the main account** (the GitHub account that owns `rtfxrlountkoegsseukx`) into the new org with role **Owner** or at least **Administrator**.
3. **Switch to the main account** → accept the invitation. Now the main account is a member of BOTH orgs (source and target) — this is the precondition Supabase requires for transfer.
4. **Verify Free quota in target org:** after transfer it will be 2/2. Acceptable, but zero headroom — no more Free projects can be created there afterwards.

## The transfer itself (UI only — there is no API for this)

5. Logged in as the main account: open project `rtfxrlountkoegsseukx` → **Settings** → **General** → scroll to **Transfer project**.
6. Select target organization `mbsqpyxwkfuwymnebsbh`. Supabase shows precheck modal:
   - Source plan: Free → Target plan: Free
   - Downtime: 0 (free→free has no downtime; only paid→free triggers 1–2 min)
   - Free quota: PASS (2/2)
7. Confirm. Transfer completes in seconds.

## Post-transfer smoke (run immediately)

```bash
bash scripts/transfer/post-transfer-smoke.sh
```

This script:
- Probes prod URL/auth/storage endpoints (must return identical HTTP codes as before)
- Triggers `staging-keepalive.yml` to confirm GitHub Secrets still authenticate
- Prints "RUN THIS QUERY IN SUPABASE SQL EDITOR" with the schema-fingerprint check

## Known side-effect: re-authorise MCP

The Claude Supabase MCP connector was authorized against the SOURCE org. After transfer, the MCP token belongs to an org that no longer owns the project, so MCP calls to `rtfxrlountkoegsseukx` will fail with "permission denied" until the MCP is re-authorized under the new org context. This is one-click fix in Claude Settings → Connectors → Supabase → Reconnect, but Claude's automation can't do it for you.

## Rollback

A Supabase project transfer is reversible: same UI, opposite direction. Source org must still exist (don't delete it for at least 24h after transfer). No data risk: the project is the same machine throughout.

## Stop conditions — do NOT click Transfer if

- Precheck modal shows any "Plan mismatch" / "Quota exceeded" warning.
- Target org plan is shown as "Pro" or "Team" you didn't expect (means biling will switch to that plan).
- Downtime shown >0 minutes (means something is misdetected).
- You are not the Owner of the source org (Admin alone cannot transfer — Supabase docs).
