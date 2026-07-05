import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require_ = createRequire(import.meta.url)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const guard = require_(path.resolve(HERE, '../../../../../scripts/runner-guard-logic.cjs')) as {
  isPnpmLauncher: (argv1: string) => boolean
  pnpmSubcommand: (argv: string[]) => string
  isInfoOnlyPnpmInvocation: (argv: string[]) => boolean
  isMutatingPnpmInvocation: (argv: string[]) => boolean
  looksLikeInstallCmdline: (cmd: string) => boolean
  looksLikeMutatingCmdline: (cmd: string) => boolean
  looksLikeDevWatcherCmdline: (cmd: string) => boolean
}

const argv = (...a: string[]) => ['node', '/x/pnpm.mjs', ...a]

describe('runner guard logic', () => {
  it('recognizes pnpm launchers across current launcher forms', () => {
    expect(guard.isPnpmLauncher('/x/pnpm.mjs')).toBe(true)
    expect(guard.isPnpmLauncher('/x/pnpm.cjs')).toBe(true)
    expect(guard.isPnpmLauncher('/x/pnpm.js')).toBe(true)
    expect(guard.isPnpmLauncher('/x/pnpm')).toBe(true)
  })

  it('classifies mutating invocations through pnpm.mjs', () => {
    expect(guard.pnpmSubcommand(argv('install'))).toBe('install')
    expect(guard.pnpmSubcommand(argv('--workspace-root', 'rebuild'))).toBe('rebuild')
    expect(guard.isInfoOnlyPnpmInvocation(argv('--version'))).toBe(true)
    expect(guard.isInfoOnlyPnpmInvocation(argv('-v'))).toBe(true)
    expect(guard.isInfoOnlyPnpmInvocation(argv('--help'))).toBe(true)
    expect(guard.isInfoOnlyPnpmInvocation(argv('install'))).toBe(false)
    expect(guard.isMutatingPnpmInvocation(argv('install'))).toBe(true)
    expect(guard.isMutatingPnpmInvocation(argv('--workspace-root', 'rebuild'))).toBe(true)
    expect(guard.isMutatingPnpmInvocation(argv('--version'))).toBe(false)
    expect(guard.isMutatingPnpmInvocation(argv('-v'))).toBe(false)
    expect(guard.isMutatingPnpmInvocation(argv('exec', 'vitest', 'run'))).toBe(false)
  })

  it('detects install cmdlines from node /path/pnpm.mjs and friends', () => {
    expect(guard.looksLikeInstallCmdline('node /path/pnpm.mjs install')).toBe(true)
    expect(guard.looksLikeInstallCmdline('node /path/pnpm.cjs add left-pad')).toBe(true)
    expect(guard.looksLikeInstallCmdline('node /path/pnpm.js update')).toBe(true)
    expect(guard.looksLikeInstallCmdline('pnpm install')).toBe(true)
    expect(guard.looksLikeInstallCmdline('node /path/pnpm.mjs dev')).toBe(false)
  })

  it('detects all mutating pnpm cmdlines, including rebuild/prune/dedupe', () => {
    expect(guard.looksLikeMutatingCmdline('node /path/pnpm.mjs rebuild')).toBe(true)
    expect(guard.looksLikeMutatingCmdline('node /path/pnpm.mjs prune')).toBe(true)
    expect(guard.looksLikeMutatingCmdline('pnpm dedupe')).toBe(true)
    expect(guard.looksLikeMutatingCmdline('pnpm --dir apps/web rebuild sharp')).toBe(true)
    expect(guard.looksLikeMutatingCmdline('pnpm config get onlyBuiltDependencies')).toBe(false)
  })

  it('detects live dev/watch cmdlines broadly but not run/test scripts', () => {
    expect(guard.looksLikeDevWatcherCmdline('node /path/pnpm.mjs dev')).toBe(true)
    expect(guard.looksLikeDevWatcherCmdline('pnpm --dir apps/web dev')).toBe(true)
    expect(guard.looksLikeDevWatcherCmdline('vitest watch')).toBe(true)
    expect(guard.looksLikeDevWatcherCmdline('tsx watch src/index.ts')).toBe(true)
    expect(guard.looksLikeDevWatcherCmdline('playwright test-server')).toBe(true)
    expect(guard.looksLikeDevWatcherCmdline('pnpm run test')).toBe(false)
  })
})
