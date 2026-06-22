/**
 * ONE DICTIONARY GUARD (Constitution law: all knowledge lives in the codex).
 *
 * The codex is `packages/knowledge`. No app file may carry its OWN Cyrillic→Latin
 * transliteration map (a "parallel dictionary" — CLAUDE.md forbids it; it caused the
 * proven Соловьёв→Solovev/Solovyev divergence bug). This guard scans apps/web/src and
 * FAILS if any file (outside the allowlist) defines a Cyrillic-letter→Latin map literal.
 * It structurally prevents re-forking after U-STAGE 1 unified the engines.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SRC = resolve(__dirname, '../..') // apps/web/src
// A single map entry like  'а': 'a'   or   "Ш": "Sh"  — a Cyrillic letter key → Latin value.
const MAP_ENTRY = /['"][Ѐ-ӿ]['"]\s*:\s*['"][a-zA-Z]{0,4}['"]/g

// Files legitimately allowed to contain such patterns (NONE should — kept empty on
// purpose; add ONLY with an owner-approved reason).
const ALLOWLIST: string[] = []

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue
      walk(p, out)
    } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) {
      out.push(p)
    }
  }
  return out
}

describe('ONE DICTIONARY — no parallel transliteration maps outside the codex', () => {
  it('no app file defines a Cyrillic→Latin character map (use @uscis-helper/knowledge)', () => {
    const offenders: { file: string; entries: number }[] = []
    for (const file of walk(SRC)) {
      if (ALLOWLIST.some((a) => file.endsWith(a))) continue
      const text = readFileSync(file, 'utf8')
      const matches = text.match(MAP_ENTRY)
      // 3+ Cyrillic→Latin entries in one file = a transliteration map fork.
      if (matches && matches.length >= 3) {
        offenders.push({ file: file.replace(SRC, 'src'), entries: matches.length })
      }
    }
    expect(
      offenders,
      `Parallel transliteration map(s) found OUTSIDE packages/knowledge — move them into the codex:\n${offenders.map((o) => `  ${o.file} (${o.entries} entries)`).join('\n')}`,
    ).toEqual([])
  })
})
