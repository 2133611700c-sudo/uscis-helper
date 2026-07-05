/**
 * .pnpmfile.cjs — SECOND enforcement point of the install interlock (2026-07-05).
 *
 * WHY: the root `preinstall` hook covers `pnpm install`/`add`/`update`/`remove`, but the
 * 2026-07-05 audit measured two lawful bypasses: `pnpm rebuild` (no lifecycle) and
 * `pnpm install --ignore-scripts` (skips ALL lifecycle). pnpm loads THIS file for every
 * command that touches the dependency graph — including those two (`--ignore-scripts`
 * does NOT skip the pnpmfile; only `--ignore-pnpmfile` does, and nobody has a reason to
 * pass that). Top-level code here runs the same guard; a refusal aborts the command
 * BEFORE node_modules is touched.
 *
 * The hooks below are intentionally EMPTY — this file must never change resolution.
 * NOTE: pnpm records pnpmfileChecksum in pnpm-lock.yaml; editing this file requires a
 * local `bash scripts/safe-install.sh` to refresh the lockfile, or CI's frozen install
 * will honestly fail with a config mismatch.
 */
'use strict'
const { spawnSync } = require('node:child_process')
const path = require('node:path')

// This file is require()d INSIDE the pnpm process, so process.argv carries the pnpm
// subcommand. Enforce ONLY on node_modules-MUTATING subcommands — `pnpm exec/run/test/dev`
// must never be blocked (measured 2026-07-05: an unscoped guard paralyzed vitest runs).
const MUTATING = new Set([
  'install', 'i', 'add', 'update', 'up', 'upgrade', 'remove', 'rm', 'uninstall', 'un',
  'link', 'ln', 'unlink', 'import', 'rebuild', 'rb', 'prune', 'dedupe', 'patch-commit', 'fetch',
])
// argv parsing: skip flags AND the values of known value-taking flags (--dir apps/web
// must not read "apps/web" as the subcommand); unwrap `recursive`/`m` prefixes.
const VALUE_FLAGS = new Set(['--dir', '-C', '--filter', '-F', '--filter-prod', '--workspace-root', '--loglevel'])
function pnpmSubcommand(argv) {
  const args = argv.slice(2)
  for (let k = 0; k < args.length; k++) {
    const a = args[k]
    if (VALUE_FLAGS.has(a)) { k++; continue }
    if (a.startsWith('-')) continue
    if (a === 'recursive' || a === 'm' || a === 'multi') continue // pnpm -r/recursive <cmd>
    return a.toLowerCase()
  }
  return ''
}
const sub = pnpmSubcommand(process.argv)

if (MUTATING.has(sub)) {
  try {
    const guard = path.join(__dirname, 'scripts', 'install-guard.mjs')
    const r = spawnSync(process.execPath, [guard], { stdio: 'inherit' })
    if (r.status !== 0 && r.status !== null) {
      throw new Error('install-guard refused (see message above) — use scripts/safe-install.sh')
    }
  } catch (e) {
    if (e instanceof Error && /install-guard refused/.test(e.message)) throw e
    // fail-open on the guard's own plumbing errors — the interlock must never be the breaker
  }
}

module.exports = { hooks: {} }
