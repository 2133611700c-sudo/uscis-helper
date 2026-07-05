#!/bin/bash
# safe-install — the ONLY sanctioned way to (re)install dependencies (2026-07-05).
#
# Owner order: the runner must never break again. Every measured breakage came from
# concurrent installs, installs under a live dev server, or interrupted interactive
# prompts. This wrapper serializes and sequences the whole operation:
#   1) take a per-worktree mutex (stale after 30 min);
#   2) stop any dev server running INSIDE this worktree (records it, restarts after);
#   3) run the non-interactive install (declarative build allowlist — never prompts);
#   4) verify with dev-doctor (heals once more if needed);
#   5) release the mutex, restart dev if we stopped it.
#
# Usage: bash scripts/safe-install.sh [extra pnpm install args]
set -u
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
# MACHINE-GLOBAL lock (audit 2026-07-05, hole #1): the pnpm store is per-user, not
# per-worktree — two safe-installs in SIBLING worktrees used to run concurrently and
# reintroduce disease #1 through the sanctioned path. One lock per user closes it.
LOCK="$HOME/.uscis-safe-install.lock"

# 1) mutex — concurrent installs are the #1 measured killer
if mkdir "$LOCK" 2>/dev/null; then
  trap 'rmdir "$LOCK" 2>/dev/null' EXIT
else
  # stale-lock rescue: older than 30 min ⇒ previous run died; take over
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +30 2>/dev/null)" ]; then
    echo "── safe-install: taking over a STALE lock (>30 min)"
    trap 'rmdir "$LOCK" 2>/dev/null' EXIT
  else
    echo "✗ safe-install: another install holds the lock ($LOCK). Wait for it." >&2
    exit 1
  fi
fi

# 2) stop dev servers whose cwd is inside this worktree (installing under a live
#    server is the #2 measured killer); remember to restart
RESTART_DEV=0
for pid in $(ps -axo pid=,command= | awk '/next(\.js)? dev|next-server|pnpm .*[[:space:]]dev([[:space:]]|$)/ {print $1}'); do
  cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)"
  case "$cwd" in
    "$ROOT"|"$ROOT"/*)
      echo "── safe-install: stopping dev server pid $pid (cwd $cwd)"
      kill "$pid" 2>/dev/null && RESTART_DEV=1
      ;;
  esac
done
[ "$RESTART_DEV" = "1" ] && sleep 3

# 3) non-interactive install; SAFE_INSTALL=1 tells the preinstall guard this path is sanctioned
echo "── safe-install: pnpm install $*"
SAFE_INSTALL=1 pnpm install "$@"
status=$?

# 4) verify + heal (dev-doctor re-checks binaries, native modules, cross-worktree symlinks)
if [ $status -eq 0 ]; then
  SAFE_INSTALL=1 bash scripts/dev-doctor.sh || status=1
else
  echo "── safe-install: install failed — attempting one dev-doctor heal"
  SAFE_INSTALL=1 bash scripts/dev-doctor.sh --heal || true
fi

# 5) restart dev if we stopped it (same canonical command the repo uses)
if [ "$RESTART_DEV" = "1" ]; then
  echo "── safe-install: restarting dev server (pnpm --dir apps/web dev, background)"
  nohup pnpm --dir "$ROOT/apps/web" dev >/tmp/uscis-dev-restart.log 2>&1 &
fi

exit $status
