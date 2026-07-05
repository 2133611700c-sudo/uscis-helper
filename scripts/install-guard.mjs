#!/usr/bin/env node
/**
 * install-guard — root `preinstall` interlock (2026-07-05, owner order: the runner must
 * never break again).
 *
 * Every measured node_modules destruction had one of two mechanical causes:
 *   (1) TWO package installs running at once in/over the same worktree;
 *   (2) an install swapping files under a LIVE `next dev` server.
 * This guard makes both physically fail fast at `pnpm install` time, for EVERY agent and
 * human, regardless of whether they remembered the rules.
 *
 * Design laws:
 *   - fail-open on the guard's own errors (the guard must never be the thing that breaks
 *     an install) — only a POSITIVE detection aborts;
 *   - CI and the sanctioned wrapper (scripts/safe-install.sh sets SAFE_INSTALL=1 after
 *     taking the mutex and stopping dev) bypass;
 *   - zero dependencies, macOS+Linux `ps`/`lsof` only.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

if (process.env.CI || process.env.SAFE_INSTALL === '1') process.exit(0)

function ps(args) {
  try { return execFileSync('ps', args, { encoding: 'utf8' }) } catch { return '' }
}

/** pids in this process's own ancestor chain (so we never flag ourselves). */
function ancestorPids() {
  const out = new Set()
  let pid = process.pid
  for (let i = 0; i < 30 && pid > 1; i++) {
    out.add(pid)
    const line = ps(['-o', 'ppid=', '-p', String(pid)]).trim()
    const ppid = Number(line)
    if (!Number.isFinite(ppid) || ppid <= 1) break
    pid = ppid
  }
  return out
}

try {
  const self = ancestorPids()
  const table = ps(['-axo', 'pid=,command='])
  const lines = table.split('\n').filter(Boolean)

  // (1) another package install anywhere on this machine (same pnpm store, same disease).
  // Shell wrappers (zsh/bash -c '...') merely QUOTE the command text in their own cmdline —
  // measured false positive 2026-07-05: the agent shell that launched `pnpm add` got flagged.
  // The real installer is always the node/pnpm child process, which still matches.
  const installRe = /pnpm(\.cjs)?["' ]+(install|add|update|remove|up|i)\b|npm (install|ci)\b|yarn( install)?$/
  const shellWrapperRe = /\b(zsh|bash|sh)\s+-l?c\b/
  const otherInstalls = lines.filter((l) => {
    const pid = Number(l.trim().split(/\s+/)[0])
    return installRe.test(l) && !shellWrapperRe.test(l) && !self.has(pid)
  })
  if (otherInstalls.length > 0) {
    console.error('✗ install-guard: ANOTHER package install is already running:')
    for (const l of otherInstalls.slice(0, 3)) console.error('   ', l.trim().slice(0, 160))
    console.error('  Concurrent installs are the #1 measured cause of destroyed node_modules.')
    console.error('  Wait for it to finish, or use: bash scripts/safe-install.sh')
    process.exit(1)
  }

  // (2) a live dev/watch server whose cwd is inside THIS worktree (audit 2026-07-05:
  // widened beyond next dev — any watcher holding module files breaks under a file swap)
  const devPids = lines
    .filter((l) => /next(\.js)? dev|next-server|pnpm .*\bdev\b|vitest\b(?!.*\brun\b)|tsx watch|playwright test-server/.test(l))
    .filter((l) => !/\b(zsh|bash|sh)\s+-l?c\b/.test(l))
    .map((l) => Number(l.trim().split(/\s+/)[0]))
    .filter((pid) => Number.isFinite(pid) && !self.has(pid))
  for (const pid of devPids) {
    let cwd = ''
    try {
      const out = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8' })
      cwd = (out.split('\n').find((x) => x.startsWith('n')) || '').slice(1)
    } catch { continue } // lsof unavailable/denied → fail-open for this pid
    if (cwd && (cwd === ROOT || cwd.startsWith(ROOT + path.sep))) {
      console.error(`✗ install-guard: a dev server (pid ${pid}) is running INSIDE this worktree (${cwd}).`)
      console.error('  Installing under a live server is the #2 measured cause of destroyed node_modules.')
      console.error('  Stop it first, or use: bash scripts/safe-install.sh (stops dev, installs, verifies).')
      process.exit(1)
    }
  }
} catch (e) {
  // fail-open: the guard itself must never block a legitimate install
  console.warn('install-guard: detection error (fail-open):', e instanceof Error ? e.message : String(e))
}
process.exit(0)
