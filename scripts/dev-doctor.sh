#!/bin/bash
# dev-doctor — ONE-COMMAND node_modules health check + self-heal (2026-07-05).
#
# WHY THIS EXISTS: two agent sessions in one worktree destroyed node_modules four times
# in one night — pnpm 10 blocks native build scripts and PROMPTS interactively
# (approve-builds); an interrupted prompt writes junk into pnpm-workspace.yaml and leaves
# a half-linked node_modules. The allowlist is now declarative
# (package.json → pnpm.onlyBuiltDependencies), so installs never prompt; this script
# verifies the runtime actually works and heals if not.
#
# Usage:  bash scripts/dev-doctor.sh          # check, heal only if broken
#         bash scripts/dev-doctor.sh --heal   # force reinstall regardless
set -u
cd "$(dirname "$0")/.."

fail=0
check() {
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then echo "✓ $name"; else echo "✗ $name"; fail=1; fi
}

echo "── dev-doctor: workspace $(pwd)"

# 1) workspace file must not carry interrupted approve-builds junk
if grep -q "set this to true or false" pnpm-workspace.yaml 2>/dev/null; then
  echo "✗ pnpm-workspace.yaml carries approve-builds junk — reverting"
  git checkout -- pnpm-workspace.yaml
  fail=1
fi

# 2) the binaries and native modules the pipeline actually needs
check "next binary"            test -e apps/web/node_modules/.bin/next
check "vitest binary"          test -e apps/web/node_modules/.bin/vitest
check "tsc binary"             test -e apps/web/node_modules/.bin/tsc
check "sharp loads (native)"   node -e "require('/$(pwd)/apps/web/node_modules/sharp')"
check "tesseract.js present"   test -d apps/web/node_modules/tesseract.js
check "@swc/helpers present"   bash -c "ls node_modules/.pnpm/next@*/node_modules/@swc/helpers/package.json"

if [ "$fail" = "1" ] || [ "${1:-}" = "--heal" ]; then
  echo "── healing: pnpm install --force (declarative build allowlist, no prompts)"
  pnpm install --force || exit 1
  echo "── re-check"
  bash "$0"   # one recursive verify pass (heals are idempotent)
else
  echo "── healthy"
fi
