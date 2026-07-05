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
# 2026-07-05 hardening (owner order: the runner must never break again):
#   - NEW check: cross-worktree symlink contamination — a node_modules symlink resolving
#     OUTSIDE this worktree (measured live: packages/db/node_modules/typescript pointed
#     into a SIBLING worktree ⇒ EPERM). Any such link ⇒ heal.
#   - can target a sibling worktree: bash scripts/dev-doctor.sh /path/to/worktree
#   - heals through scripts/safe-install.sh semantics (SAFE_INSTALL=1, non-interactive).
#   - prevention layer lives in scripts/install-guard.mjs (root preinstall): raw
#     `pnpm install` REFUSES under a concurrent install or a live in-worktree dev server.
#
# Usage:  bash scripts/dev-doctor.sh              # check this worktree, heal only if broken
#         bash scripts/dev-doctor.sh --heal       # force reinstall regardless
#         bash scripts/dev-doctor.sh /path/to/wt [--heal]   # check/heal a sibling worktree
set -u
SELF="$(cd "$(dirname "$0")/.." && pwd)"
if [ -n "${1:-}" ] && [ -d "${1:-}" ]; then TARGET="$(cd "$1" && pwd)"; shift; else TARGET="$SELF"; fi
cd "$TARGET"
RECHECK="${DEV_DOCTOR_RECHECK:-0}"

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

# 3) cross-worktree symlink contamination (measured 2026-07-05: EPERM in a sibling
#    worktree because packages/db/node_modules/typescript resolved into ANOTHER worktree).
#    Every pnpm link must resolve inside THIS worktree; anything else = infected install.
infected=0
for lnk in $(find apps/*/node_modules packages/*/node_modules node_modules \
               -maxdepth 2 -type l 2>/dev/null | head -2000); do
  tgt="$(cd "$(dirname "$lnk")" 2>/dev/null && cd "$(readlink "$lnk")" 2>/dev/null && pwd)" || continue
  case "$tgt" in
    "$TARGET"/*) : ;;   # healthy: resolves inside this worktree
    *) echo "✗ cross-worktree symlink: $lnk → $tgt"; infected=1; fail=1 ;;
  esac
done
[ "$infected" = "0" ] && echo "✓ no cross-worktree symlinks (shallow)"

# 3b) DEEP contamination sweep (audit 2026-07-05): links climbing ≥4 levels are the only
#     candidates that CAN escape; resolve just those (few — workspace links legitimately
#     climb 4 to packages/*) and flag only targets outside this worktree.
deep=0
for lnk in $(find node_modules/.pnpm -maxdepth 3 -type l 2>/dev/null | head -4000); do
  raw="$(readlink "$lnk")" || continue
  case "$raw" in *../../../../*) : ;; *) continue ;; esac
  tgt="$(cd "$(dirname "$lnk")" 2>/dev/null && cd "$raw" 2>/dev/null && pwd)" || continue
  case "$tgt" in
    "$TARGET"/*) : ;;   # healthy: workspace link resolving inside this worktree
    *) echo "✗ deep cross-worktree symlink: $lnk → $tgt"; deep=1; fail=1 ;;
  esac
done
[ "$deep" = "0" ] && echo "✓ no deep cross-worktree symlinks (.pnpm)"

if [ "$fail" = "1" ] || [ "${1:-}" = "--heal" ]; then
  if [ "$RECHECK" = "1" ]; then
    echo "── re-check failed after heal; stopping after one recursive pass"
    exit 1
  fi
  # Audit 2026-07-05 hole #2: NEVER install under a live dev server — stop any dev/watch
  # process whose cwd is inside the TARGET worktree (mirror of safe-install), restart after.
  RESTART_DEV=0
  for pid in $(ps -axo pid=,command= | awk '!/(zsh|bash|sh) -c/ && (/next(\.js)? dev|next-server/ || /pnpm .*[[:space:]]dev([[:space:]]|$)/) {print $1}'); do
    dcwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)"
    case "$dcwd" in
      "$TARGET"|"$TARGET"/*)
        echo "── heal: stopping dev server pid $pid (cwd $dcwd)"
        kill "$pid" 2>/dev/null && RESTART_DEV=1
        ;;
    esac
  done
  [ "$RESTART_DEV" = "1" ] && sleep 3
  echo "── healing: pnpm install --force (declarative build allowlist, no prompts)"
  SAFE_INSTALL=1 pnpm install --force || exit 1
  echo "── re-check"
  DEV_DOCTOR_RECHECK=1 bash "$0" "$TARGET"   # one recursive verify pass (heals are idempotent)
  if [ "$RESTART_DEV" = "1" ]; then
    echo "── heal: restarting dev server (pnpm --dir apps/web dev, background)"
    nohup pnpm --dir "$TARGET/apps/web" dev >/tmp/uscis-dev-restart.log 2>&1 &
  fi
else
  echo "── healthy"
fi
