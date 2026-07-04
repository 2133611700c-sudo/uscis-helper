/**
 * KNOWLEDGE EXPORT LEDGER GUARD — ONE-BRAIN v2 Phase 6.
 *
 * Constitution: the codex (`packages/knowledge`) may not accumulate silent dead
 * surface. Every VALUE export of its public index must EITHER
 *   (a) have ≥1 non-test import in apps/web/src, OR
 *   (b) carry an explicit KNOWLEDGE_EXPORT_LEDGER entry (RESERVED/DEPRECATED)
 *       in packages/knowledge/src/DEPRECATED.ts.
 * Type-only exports are exempt (they are erased surface, not runtime code).
 *
 * Companion of oneDictionaryGuard.test.ts (no parallel dictionaries): that guard
 * stops knowledge forking OUT of the codex; this one stops knowledge rotting
 * INSIDE it. NOTHING is deleted — unclassified exports fail this test until a
 * consumer or a ledger entry exists.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { KNOWLEDGE_EXPORT_LEDGER } from '@uscis-helper/knowledge'

const REPO_ROOT = resolve(__dirname, '../../../../..') // apps/web/src/lib/__tests__ → repo root
const APP_SRC = resolve(REPO_ROOT, 'apps/web/src')
const KNOWLEDGE_INDEX = resolve(REPO_ROOT, 'packages/knowledge/src/index.ts')

// ── 1. Parse the codex public index: value exports vs type-only exports ──────
function parseIndexExports(indexSource: string): { values: Set<string>; types: Set<string> } {
  const values = new Set<string>()
  const types = new Set<string>()
  // export { A, B as C, default as D } from '...'   /   export type { T } from '...'
  const exRe = /export\s+(type\s+)?\{([^{}]*)\}\s*from\s*['"][^'"]+['"]/g
  let m: RegExpExecArray | null
  while ((m = exRe.exec(indexSource))) {
    const isTypeBlock = !!m[1]
    for (const raw of m[2].split(',')) {
      const item = raw.trim()
      if (!item) continue
      const isTypeItem = isTypeBlock || /^type\s/.test(item)
      const cleaned = item.replace(/^type\s+/, '')
      const asMatch = cleaned.match(/\s+as\s+(\S+)$/)
      const name = asMatch ? asMatch[1] : cleaned.split(/\s+/)[0]
      if (!name) continue
      ;(isTypeItem ? types : values).add(name)
    }
  }
  return { values, types }
}

// ── 2. Collect names actually imported from the codex in non-test app code ───
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue
      walk(p, out)
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(p)
    }
  }
  return out
}

function collectConsumedNames(files: string[]): Set<string> {
  const consumed = new Set<string>()
  // import { A, B as C } from '@uscis-helper/knowledge'  (also `import type {…}`
  // — a type-position use still counts as a consumer of that export's shape).
  // [^{}]* is deliberate: it cannot span across other import statements.
  const impRe = /import\s+(?:type\s+)?\{([^{}]*)\}\s*from\s*['"]@uscis-helper\/knowledge['"]/g
  for (const f of files) {
    const text = readFileSync(f, 'utf8')
    let m: RegExpExecArray | null
    while ((m = impRe.exec(text))) {
      for (const raw of m[1].split(',')) {
        const name = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
        if (name) consumed.add(name)
      }
    }
  }
  return consumed
}

describe('KNOWLEDGE EXPORT LEDGER — every codex export has a consumer or a ledger entry', () => {
  const { values, types } = parseIndexExports(readFileSync(KNOWLEDGE_INDEX, 'utf8'))
  const consumed = collectConsumedNames(walk(APP_SRC))

  it('sanity: the index parser found the codex surface', () => {
    // The codex exports dozens of values (transliterateKMU55, parseMrz, …).
    // If parsing ever collapses, fail loudly instead of vacuously passing.
    expect(values.size).toBeGreaterThan(40)
    expect(values.has('transliterateKMU55')).toBe(true)
    expect(types.has('MrzResult')).toBe(true)
  })

  it('every VALUE export is consumed by apps/web/src (non-test) OR ledgered', () => {
    const unclassified = [...values]
      .filter((name) => !consumed.has(name) && !(name in KNOWLEDGE_EXPORT_LEDGER))
      .sort()
    expect(
      unclassified,
      `Unclassified codex exports (no non-test apps/web import AND no KNOWLEDGE_EXPORT_LEDGER entry).\n` +
        `Either wire a consumer or add a RESERVED/DEPRECATED entry to packages/knowledge/src/DEPRECATED.ts:\n` +
        unclassified.map((n) => `  - ${n}`).join('\n'),
    ).toEqual([])
  })

  it('ledger honesty: every ledger key names a real index export', () => {
    const ghosts = Object.keys(KNOWLEDGE_EXPORT_LEDGER)
      .filter((name) => !values.has(name) && !types.has(name))
      .sort()
    expect(
      ghosts,
      `Ledger entries that do not match any export of packages/knowledge/src/index.ts ` +
        `(renamed or removed export? fix the ledger):\n` +
        ghosts.map((n) => `  - ${n}`).join('\n'),
    ).toEqual([])
  })

  it('ledger schema: status is RESERVED|DEPRECATED, RESERVED entries explain themselves', () => {
    for (const [name, entry] of Object.entries(KNOWLEDGE_EXPORT_LEDGER)) {
      expect(['RESERVED', 'DEPRECATED'], `${name}: bad status`).toContain(entry.status)
      expect(entry.note?.trim().length ?? 0, `${name}: note is required`).toBeGreaterThan(0)
    }
  })
})
