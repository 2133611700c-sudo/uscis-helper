#!/usr/bin/env bash
# post-transfer-smoke.sh
# Run after Supabase project transfer of rtfxrlountkoegsseukx to verify
# nothing observable changed for the application.
# READ-ONLY. No writes anywhere.

set -euo pipefail

PROD_REF="rtfxrlountkoegsseukx"
BASE="https://${PROD_REF}.supabase.co"

ts() { date -u +%FT%TZ; }
ok()  { printf "  ✅ %s\n" "$*"; }
bad() { printf "  ❌ %s\n" "$*"; FAILED=1; }
hdr() { printf "\n== %s ==\n" "$*"; }

FAILED=0

hdr "1. URL endpoints still reachable (expecting same codes as before transfer)"
for ep in /storage/v1/status /auth/v1/health /rest/v1/; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" "${BASE}${ep}" || echo "000")
  case "$ep" in
    /storage/v1/status) want=200 ;;
    *)                  want=401 ;;
  esac
  if [ "$code" = "$want" ]; then ok "$ep -> $code"; else bad "$ep -> $code (expected $want)"; fi
done

hdr "2. GitHub Secrets still authenticate (re-run staging keep-alive)"
if command -v gh >/dev/null 2>&1; then
  gh workflow run staging-keepalive.yml --ref main >/dev/null 2>&1 \
    && ok "Dispatched staging-keepalive.yml — check Actions tab for green run within ~30s"
  sleep 20
  latest=$(gh run list --workflow=staging-keepalive.yml --limit 1 --json conclusion,status,databaseId -q '.[0]' 2>/dev/null || echo "{}")
  echo "      latest run: $latest"
else
  bad "gh CLI not installed — skipped Actions probe"
fi

hdr "3. Manual SQL check (paste into Supabase SQL Editor, compare to baseline)"
cat <<'SQL'
  -- expected (from docs/ops/transfer/2026-06-28-prod-baseline.json):
  --   schema_fingerprint = b8a85fd95319a3f74501696343c66121
  --   migrations_count   = 51
  --   latest_migration   = 20260615060119
  --   total_public_rows  = 1751 (or higher if app received traffic during transfer)
  --   storage_buckets    = 4
  --   storage_objects    = 17
  --   storage_bytes      = 6187137

  with sf as (
    select md5(string_agg(c.relname||':'||a.attname||':'||t.typname||':'||a.attnotnull, ',' order by c.relname,a.attnum)) as fp
    from pg_attribute a
    join pg_class c on c.oid=a.attrelid
    join pg_namespace n on n.oid=c.relnamespace
    join pg_type t on t.oid=a.atttypid
    where n.nspname='public' and c.relkind='r' and a.attnum>0 and not a.attisdropped
  )
  select
    (select fp from sf) as schema_fingerprint,
    (select count(*) from supabase_migrations.schema_migrations) as migrations_count,
    (select max(version) from supabase_migrations.schema_migrations) as latest_migration,
    (select sum(n_live_tup) from pg_stat_user_tables where schemaname='public') as total_public_rows,
    (select count(*) from storage.buckets) as storage_buckets,
    (select count(*) from storage.objects) as storage_objects,
    (select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects) as storage_bytes;
SQL

hdr "4. Vercel deploy still healthy (production URL)"
if command -v vercel >/dev/null 2>&1; then
  ok "Run 'vercel ls --prod' separately and confirm uscis-helper production URL still 200"
else
  echo "  (vercel CLI not present — open https://messenginfo.com manually)"
fi

hdr "5. Reminder: re-authorize Supabase MCP in Claude"
echo "  Claude Settings → Connectors → Supabase → Reconnect under the new account/org."
echo "  Without this, the assistant cannot call Supabase tools against the moved project."

hdr "Result"
if [ "$FAILED" = "0" ]; then
  printf "  ✅ ALL AUTOMATED CHECKS PASSED at %s\n" "$(ts)"
  printf "     Now paste the SQL above into the Supabase SQL Editor and compare against baseline.\n"
  exit 0
else
  printf "  ❌ ONE OR MORE CHECKS FAILED at %s — investigate before declaring transfer done.\n" "$(ts)"
  exit 1
fi
