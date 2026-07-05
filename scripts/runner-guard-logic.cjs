'use strict'

const MUTATING = new Set([
  'install', 'i', 'add', 'update', 'up', 'upgrade', 'remove', 'rm', 'uninstall', 'un',
  'link', 'ln', 'unlink', 'import', 'rebuild', 'rb', 'prune', 'dedupe', 'patch-commit', 'fetch',
])

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

function isMutatingPnpmInvocation(argv) {
  return isPnpmLauncher(argv[1]) && (pnpmSubcommand(argv) === '' || MUTATING.has(pnpmSubcommand(argv)))
}

function looksLikeInstallCmdline(cmdline) {
  return /(?:^|[\s"'`])(?:node\s+.*[\\/])?pnpm(?:\.(?:mjs|c?js))?["' ]+(install|add|update|remove|up|i)\b|npm (install|ci)\b|yarn( install)?$/.test(cmdline)
}

function looksLikeDevWatcherCmdline(cmdline) {
  return /next(\.js)? dev|next-server|(?:^|[\s"'`])(?:node\s+.*[\\/])?pnpm(?:\.(?:mjs|c?js))?(?:["' ]+.*)?\bdev\b|vitest\b(?!.*\brun\b)|tsx watch|playwright test-server/.test(cmdline)
}

module.exports = {
  MUTATING,
  VALUE_FLAGS,
  isPnpmLauncher,
  pnpmSubcommand,
  isMutatingPnpmInvocation,
  looksLikeInstallCmdline,
  looksLikeDevWatcherCmdline,
}
