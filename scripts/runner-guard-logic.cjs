'use strict'

const MUTATING = new Set([
  'install', 'i', 'add', 'update', 'up', 'upgrade', 'remove', 'rm', 'uninstall', 'un',
  'link', 'ln', 'unlink', 'import', 'rebuild', 'rb', 'prune', 'dedupe', 'patch-commit', 'fetch',
])

const INFO_FLAGS = new Set(['-v', '--version', '-h', '--help'])

// Value-taking flags that must skip their following argv token. Keep this list narrow:
// only flags whose next token is not a pnpm subcommand.
const VALUE_FLAGS = new Set(['--dir', '-C', '--filter', '-F', '--filter-prod', '--loglevel'])

function isPnpmLauncher(argv1) {
  return /(^|[/\\])pnpm(?:\.(?:mjs|c?js))?$/.test(argv1 || '')
}

function pnpmSubcommand(argv) {
  const args = argv.slice(2)
  for (let k = 0; k < args.length; k++) {
    const a = args[k]
    if (VALUE_FLAGS.has(a)) { k++; continue }
    if (a.startsWith('-')) continue // boolean flags incl. --workspace-root/-w/-r and --x=value forms
    if (a === 'recursive' || a === 'm' || a === 'multi') continue // pnpm recursive <cmd>
    return a.toLowerCase()
  }
  return ''
}

function isInfoOnlyPnpmInvocation(argv) {
  if (!isPnpmLauncher(argv[1])) return false
  const args = argv.slice(2)
  let sawInfoFlag = false
  for (let k = 0; k < args.length; k++) {
    const a = args[k]
    if (VALUE_FLAGS.has(a)) { k++; continue }
    if (INFO_FLAGS.has(a)) {
      sawInfoFlag = true
      continue
    }
    if (a.startsWith('-')) continue
    return false
  }
  return sawInfoFlag
}

function isMutatingPnpmInvocation(argv) {
  if (!isPnpmLauncher(argv[1])) return false
  if (isInfoOnlyPnpmInvocation(argv)) return false
  const sub = pnpmSubcommand(argv)
  return sub === '' || MUTATING.has(sub)
}

function looksLikeInstallCmdline(cmdline) {
  return /(?:^|[\s"'`])(?:node\s+.*[\\/])?pnpm(?:\.(?:mjs|c?js))?["' ]+(install|add|update|remove|up|i)\b|npm (install|ci)\b|yarn( install)?$/.test(cmdline)
}

function looksLikeMutatingCmdline(cmdline) {
  return /(?:^|[\s"'`])(?:node\s+.*[\\/])?pnpm(?:\.(?:mjs|c?js))?(?:["' ]+.*)?\b(install|i|add|update|up|upgrade|remove|rm|uninstall|un|link|ln|unlink|import|rebuild|rb|prune|dedupe|patch-commit|fetch)\b/.test(cmdline)
}

function looksLikeDevWatcherCmdline(cmdline) {
  return /next(\.js)? dev|next-server|(?:^|[\s"'`])(?:node\s+.*[\\/])?pnpm(?:\.(?:mjs|c?js))?(?:["' ]+.*)?\bdev\b|vitest\b(?!.*\brun\b)|tsx watch|playwright test-server/.test(cmdline)
}

module.exports = {
  MUTATING,
  INFO_FLAGS,
  VALUE_FLAGS,
  isPnpmLauncher,
  pnpmSubcommand,
  isInfoOnlyPnpmInvocation,
  isMutatingPnpmInvocation,
  looksLikeInstallCmdline,
  looksLikeMutatingCmdline,
  looksLikeDevWatcherCmdline,
}
