#!/usr/bin/env node
/**
 * verify-release-state.mjs — Stage 0 guard for the single source of truth.
 *
 * Dependency-free (Node built-ins only). Verifies, WITHOUT fabricating facts:
 *   1. RELEASE_STATE.yaml exists and has the required top-level shape.
 *   2. STATUS.md has exactly ONE current "# STATUS" H1 (no stacked history).
 *   3. STATUS.md does not contain the stale "PR #120 DRAFT" assertion.
 *   4. RELEASE_STATE main_sha is a REAL commit object (not a silently-fabricated SHA).
 *   5. production_sha is a 40-hex SHA; production_sha_matches_main agrees with the values.
 *   6. Unknown values use the literal UNVERIFIED token (no guessed Vercel/Stripe state).
 *
 * Exit 0 = PASS. Non-zero = the specific violation (printed). PII-safe: prints no values.
 */
import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fail = (msg) => { console.error(`[release-state] FAIL: ${msg}`); process.exit(1) }
const ok = (msg) => console.log(`[release-state] OK: ${msg}`)

const RS = resolve(ROOT, 'RELEASE_STATE.yaml')
const STATUS = resolve(ROOT, 'STATUS.md')
if (!existsSync(RS)) fail('RELEASE_STATE.yaml missing')
if (!existsSync(STATUS)) fail('STATUS.md missing')

const rs = readFileSync(RS, 'utf8')
const status = readFileSync(STATUS, 'utf8')

// (1) required top-level keys present
const REQUIRED = [
  'schema_version:', 'generated_at:', 'repository:', 'main_sha:', 'production_sha:',
  'production_sha_matches_main:', 'prs:', 'products:', 'tps:', 'reparole:', 'ead:',
  'translation:', 'browser_pii:', 'test_infrastructure:', 'document_intelligence:',
  'blockers:', 'deferred:', 'last_verified_at:',
]
const missing = REQUIRED.filter((k) => !rs.includes(k))
if (missing.length) fail(`RELEASE_STATE.yaml missing required keys: ${missing.join(', ')}`)
ok('RELEASE_STATE.yaml has required shape')

// (2) exactly one current STATUS H1
const h1 = (status.match(/^# STATUS\b/gm) || []).length
if (h1 !== 1) fail(`STATUS.md must have exactly ONE "# STATUS" H1, found ${h1} (history belongs in docs/STATUS_ARCHIVE.md)`)
ok('STATUS.md has exactly one current heading')

// (3) no stale "PR #120 DRAFT"
if (/#\s*120\s*draft/i.test(status) || /pr\s*#?120\b[^\n]*draft/i.test(status)) {
  fail('STATUS.md still asserts "PR #120 DRAFT" — #120 is merged/deployed')
}
ok('STATUS.md does not assert the stale #120 DRAFT state')

// helper: read a simple "key: value" (first match) from the yaml text.
// Tolerates inline "# comments" and surrounding quotes.
const yval = (key) => {
  const m = rs.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm'))
  if (!m) return undefined
  let v = m[1].trim()
  v = v.replace(/\s+#.*$/, '').trim() // strip inline comment
  v = v.replace(/^["']|["']$/g, '').trim() // strip quotes
  return v
}
const mainSha = yval('main_sha')
const prodSha = yval('production_sha')
const matches = yval('production_sha_matches_main')

// (4) main_sha must be a real commit object (anti-fabrication)
if (!/^[0-9a-f]{40}$/.test(mainSha || '')) fail('repository.main_sha must be a 40-hex SHA')
try {
  const t = execFileSync('git', ['cat-file', '-t', mainSha], { cwd: ROOT }).toString().trim()
  if (t !== 'commit') fail(`main_sha is not a commit object (got ${t})`)
} catch {
  fail('main_sha is not a real commit in this repository (possible fabrication)')
}
ok('main_sha is a real commit object')

// (5) production_sha format + matches flag consistency (UNVERIFIED allowed)
if (prodSha !== 'UNVERIFIED' && !/^[0-9a-f]{40}$/.test(prodSha || '')) {
  fail('production_sha must be a 40-hex SHA or UNVERIFIED')
}
const expectMatch = (prodSha === mainSha)
if (prodSha !== 'UNVERIFIED' && String(expectMatch) !== String(matches)) {
  fail(`production_sha_matches_main=${matches} contradicts SHA comparison (${expectMatch})`)
}
ok('production_sha is well-formed and consistent')

// (6) UNVERIFIED discipline — Vercel/Stripe modes must be UNVERIFIED unless externally read.
//     We only assert they are not silently set to a plausible-but-unproven literal.
for (const key of ['production_mode', 'stripe_test_environment', 'hosted_stripe_e2e']) {
  const m = rs.match(new RegExp(`${key}:\\s*"?([^"\\n]+)"?`, 'g')) || []
  for (const line of m) {
    const v = line.split(':')[1].replace(/["']/g, '').trim()
    if (/^(enforce|live|test|true|passed|green)$/i.test(v)) {
      fail(`${key} claims "${v}" — not verifiable from repository; must be UNVERIFIED`)
    }
  }
}
ok('no Vercel/Stripe runtime state is fabricated (UNVERIFIED discipline held)')

console.log('[release-state] PASS')
