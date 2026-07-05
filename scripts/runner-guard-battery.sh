#!/bin/bash
# runner-guard-battery — reproducible ADVERSARIAL bypass table (audit 2026-07-05, §7).
#
# Requires a live dev server inside this worktree (that's the point: every mutating
# path must REFUSE under it; every non-mutating path must WORK). LOCAL tool — needs
# live processes, so it is NOT a CI job; run after any change to the guard layer:
#   bash scripts/runner-guard-battery.sh
set -u
cd "$(dirname "$0")/.."

if ! ps -axo command= | grep -qE "next(\.js)? dev|next-server"; then
  echo "SKIP: no live dev server — start one first (pnpm --dir apps/web dev) for a meaningful battery"
  exit 2
fi

pass=0; failn=0
refuse() { # cmd... : must refuse via guard
  if bash -lc "$*" 2>&1 | grep -qE "✗ install-guard"; then
    echo "REFUSED  ✓  pnpm-path: $*"; pass=$((pass+1))
  else
    echo "EXECUTED ✗✗ BYPASS: $*"; failn=$((failn+1))
  fi
}
works() { # cmd... : must succeed
  if bash -lc "$*" >/dev/null 2>&1; then
    echo "WORKS    ✓  benign:    $*"; pass=$((pass+1))
  else
    echo "BLOCKED  ✗✗ paralysis: $*"; failn=$((failn+1))
  fi
}

echo "── mutating paths (must all REFUSE under live dev)"
refuse "pnpm install"
refuse "pnpm install --ignore-scripts"
refuse "pnpm --dir apps/web install"
refuse "pnpm -r install"
refuse "pnpm add -w left-pad"
refuse "pnpm --workspace-root add left-pad"
refuse "pnpm --workspace-root rebuild"
refuse "pnpm --workspace-root prune"
refuse "pnpm --workspace-root install --ignore-scripts"
refuse "pnpm --dir apps/web rebuild sharp"
refuse "pnpm prune"
refuse "pnpm update -w left-pad"
refuse "pnpm dedupe"

echo "── benign paths (must all WORK under live dev)"
works "pnpm --dir apps/web exec tsc --version"
works "pnpm --filter web exec node -e 1"
works "pnpm --version"
works "pnpm -v"
works "pnpm config get onlyBuiltDependencies"
works "pnpm store path"

echo "── mutation-leak check"
if grep -q left-pad package.json pnpm-lock.yaml 2>/dev/null || [ -d node_modules/left-pad ]; then
  echo "LEAK     ✗✗ left-pad reached the tree"; failn=$((failn+1))
else
  echo "NO LEAK  ✓  left-pad never landed"; pass=$((pass+1))
fi

echo "── RESULT: pass=$pass fail=$failn"
[ "$failn" = "0" ] || exit 1
