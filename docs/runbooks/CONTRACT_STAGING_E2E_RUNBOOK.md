# Unified Document Contract — Staging E2E Runbook (full DB-backed)

The local mocked browser E2E (Workstream F) proves the prod server + Chromium +
Playwright stack and the in-process data vertical. The **full DB-backed** browser E2E
(upload → extract → review → confirm → PDF) needs Supabase, which needs **Docker** —
absent in the dev sandbox. Run this on a Docker host or CI with staging secrets.

## Prerequisites
- Docker running (for `supabase start`).
- `supabase` CLI (installed: 2.90.0).
- Node + pnpm; Playwright Chromium (`npx playwright install chromium`).
- A deterministic Gemini mock OR an opt-in `GEMINI_API_KEY` for a live-provider smoke.
- **Synthetic fixtures only — never real PII, never the production DB/secrets.**

## Steps
```bash
# 1. Local Supabase stack + migrations + synthetic seed (no PII)
supabase start
supabase db reset            # applies migrations
psql "$SUPABASE_DB_URL" -f scripts/seed/synthetic-birth-cert.sql   # synthetic session + extracted_fields

# 2. Build + start prod server with the contract flags ON (staging only)
export NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
export UNIFIED_DOC_CONTRACT_ENABLED=1 UNIFIED_DOC_CONTRACT_SPLIT_ENABLED=1 \
       UNIFIED_DOC_CONTRACT_NORMALIZE_ENABLED=1 FINAL_PDF_CONFIRMATION_GATE_ENABLED=1
pnpm --filter web build
CONTRACT_E2E_BASE_URL=http://127.0.0.1:3100 npx next start -p 3100 &

# 3. Run the contract browser E2E against the seeded session
cd apps/web
CONTRACT_E2E_BASE_URL=http://127.0.0.1:3100 \
  npx playwright test -c playwright.contract.config.ts --project=chromium
```
The seeded synthetic session makes `tests/e2e-contract/review-contract.spec.ts` reach
the review surface (no longer skipped) and assert: split fields are first-class rows,
Cyrillic renders, and the certify/PDF action is blocked until all critical fields are
confirmed, then allowed.

## Vercel ephemeral preview (alternative)
Edit `.github/workflows/staging-e2e-translation.yml` deploy step to add:
```
-e UNIFIED_DOC_CONTRACT_ENABLED=1 -e UNIFIED_DOC_CONTRACT_SPLIT_ENABLED=1 \
-e UNIFIED_DOC_CONTRACT_NORMALIZE_ENABLED=1 -e FINAL_PDF_CONFIRMATION_GATE_ENABLED=1
```
then run the contract E2E with `CONTRACT_E2E_BASE_URL=<preview-url>` (skips the local
webServer). Tear the preview down afterward.

## Rollback
Unset the four flags (or set `=0`) and redeploy → byte-identical legacy behavior
(OFF golden `sha256 89611c7a…`). No data migration to undo (all additive).
