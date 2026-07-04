/**
 * MODEL POLICY HARD LOCK (owner law, 2026-07-04): `gemini-3.1*` is NOT a working option —
 * it must not be used, tested, or referenced as active anywhere. Primary printed reader is
 * `gemini-2.5-pro` (modelMatrix.PRIMARY_READER); handwritten is never LLM-acceptance.
 *
 * This guard fails CI if any ACTIVE surface references gemini-3.1:
 *  - all runtime code + tests (apps/web/src, packages) — zero tolerance;
 *  - active scripts (apps/web/scripts);
 *  - authoritative docs (docs/architecture, docs/ocr, docs/adr, STATUS.md, CLAUDE.md).
 * HISTORICAL surfaces are exempt BY LIST (session history is never rewritten): CHANGELOG.md,
 * HANDOFF.md, docs/reports/** (point-in-time observations, marked historical).
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const WEB = resolve(process.cwd())            // apps/web
const REPO = resolve(WEB, '../..')

const PATTERN = /gemini[-_.]?3\.1/i

const ACTIVE_ROOTS = [
  join(WEB, 'src'),
  join(WEB, 'scripts'),
  join(REPO, 'packages'),
  join(REPO, 'docs/architecture'),
  join(REPO, 'docs/ocr'),
  join(REPO, 'docs/adr'),
]
const ACTIVE_FILES = [join(REPO, 'STATUS.md'), join(REPO, 'CLAUDE.md')]

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|mjs|js|md|yaml|yml|json)$/.test(name)) out.push(p)
  }
  return out
}

describe('model policy hard lock — gemini-3.1 is not an active option', () => {
  it('no active code/script/authoritative-doc references gemini-3.1', () => {
    const files = [...ACTIVE_ROOTS.flatMap((r) => walk(r)), ...ACTIVE_FILES.filter(existsSync)]
    const offenders = files
      // this guard file itself names the pattern on purpose
      .filter((f) => !f.endsWith('noGemini31.guard.test.ts'))
      .filter((f) => PATTERN.test(readFileSync(f, 'utf8')))
      .map((f) => relative(REPO, f))
    expect(
      offenders,
      `gemini-3.1 referenced on an ACTIVE surface (owner law: not a working option — remove or move to a HISTORICAL report):\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })
})
