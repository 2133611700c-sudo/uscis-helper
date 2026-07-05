/**
 * pnpmfileGuard.guard — contract tests for the .pnpmfile.cjs interlock parser
 * (audit 2026-07-05: `pnpm --workspace-root rebuild` parsed to '' and bypassed
 * enforcement — this suite is the permanent regression net for that class).
 *
 * Requiring the pnpmfile from vitest is safe: process.argv here carries vitest's
 * 'run' subcommand, which is non-mutating, so the top-level guard does not fire.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require_ = createRequire(import.meta.url)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const pnpmfile = require_(path.resolve(HERE, '../../../../../.pnpmfile.cjs'))
const { pnpmSubcommand, MUTATING, isPnpmLauncher } = pnpmfile._internal as {
  pnpmSubcommand: (argv: string[]) => string
  MUTATING: Set<string>
  isPnpmLauncher: (argv1: string) => boolean
}
const argv = (...a: string[]) => ['node', '/x/pnpm.mjs', ...a]
const enforces = (...a: string[]) => {
  const sub = pnpmSubcommand(argv(...a))
  return sub === '' || MUTATING.has(sub)
}

describe('pnpmSubcommand — audit bypasses (must ENFORCE)', () => {
  it('pnpm.mjs / pnpm.cjs / pnpm.js all count as the pnpm launcher', () => {
    expect(isPnpmLauncher('/x/pnpm.mjs')).toBe(true)
    expect(isPnpmLauncher('/x/pnpm.cjs')).toBe(true)
    expect(isPnpmLauncher('/x/pnpm.js')).toBe(true)
    expect(isPnpmLauncher('/x/pnpm')).toBe(true)
    expect(isPnpmLauncher('/x/node_modules/pnpm/bin/pnpm.mjs')).toBe(true)
    expect(isPnpmLauncher('/x/node_modules/pnpm/bin/pnpm')).toBe(true)
  })

  it('--workspace-root is BOOLEAN: rebuild/prune/add/install behind it are seen', () => {
    expect(pnpmSubcommand(argv('--workspace-root', 'rebuild'))).toBe('rebuild')
    expect(enforces('--workspace-root', 'rebuild')).toBe(true)
    expect(enforces('--workspace-root', 'prune')).toBe(true)
    expect(enforces('--workspace-root', 'add', 'left-pad')).toBe(true)
    expect(enforces('--workspace-root', 'install', '--ignore-scripts')).toBe(true)
    expect(enforces('-w', 'add', 'left-pad')).toBe(true)
  })

  it('value-taking flags do not swallow the subcommand', () => {
    expect(pnpmSubcommand(argv('--dir', 'apps/web', 'install'))).toBe('install')
    expect(pnpmSubcommand(argv('--filter', 'web', 'add', 'x'))).toBe('add')
    expect(pnpmSubcommand(argv('-C', 'apps/web', 'rebuild', 'sharp'))).toBe('rebuild')
  })

  it('recursive prefixes unwrap; = -forms are flags', () => {
    expect(pnpmSubcommand(argv('recursive', 'install'))).toBe('install')
    expect(pnpmSubcommand(argv('-r', 'install'))).toBe('install')
    expect(pnpmSubcommand(argv('--dir=apps/web', 'update'))).toBe('update')
  })

  it('unparseable command line → fail-closed (enforce)', () => {
    expect(enforces('--some-future-boolean-flag')).toBe(true) // sub === '' ⇒ enforce
    expect(enforces()).toBe(true)
  })

  it('every mutating subcommand + aliases are in the set', () => {
    for (const s of ['install', 'i', 'add', 'update', 'up', 'remove', 'rm', 'link', 'unlink', 'import', 'rebuild', 'rb', 'prune', 'dedupe', 'fetch']) {
      expect(MUTATING.has(s)).toBe(true)
    }
  })
})

describe('pnpmSubcommand — non-mutating paths (must NOT enforce: exec-paralysis regression)', () => {
  it('exec/run/test/dev/dlx/store never enforce', () => {
    expect(enforces('exec', 'vitest', 'run', 'src')).toBe(false)
    expect(enforces('--filter', 'web', 'exec', 'tsc', '--version')).toBe(false)
    expect(enforces('run', 'test')).toBe(false)
    expect(enforces('--dir', 'apps/web', 'dev')).toBe(false)
    expect(enforces('dlx', 'cowsay')).toBe(false)
    expect(enforces('store', 'path')).toBe(false)
    expect(enforces('config', 'get', 'onlyBuiltDependencies')).toBe(false)
  })

  it("a script ARGUMENT named like a mutating word is not the subcommand", () => {
    expect(pnpmSubcommand(argv('exec', 'vitest', 'run', 'install.test.ts'))).toBe('exec')
    expect(pnpmSubcommand(argv('run', 'add'))).toBe('run')
  })
})
