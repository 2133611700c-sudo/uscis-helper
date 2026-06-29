/**
 * Dead-flag guard (One-Brain flag-truth, 2026-06-29).
 *
 * `ONE_CORE_TPS_ENABLED`, `ONE_CORE_EAD_ENABLED`, `ONE_CORE_REPAROLE_ENABLED`
 * (and their `NEXT_PUBLIC_` twins) are DEAD flags: the product Core paths are no
 * longer gated by them. Old docs/ADRs described them as live gates; that was true
 * historically but is false now. This guard FAILS if any runtime source file starts
 * reading one again — so the dead flags can never silently resurrect as a hidden gate.
 *
 * The only recognition flag the routes actually read is `ONE_BRAIN_RECOGNIZE_ENABLED`
 * (selects the recognizeDocument orchestrator vs the inline readDocument spine).
 *
 * Allowed mentions: test files that ASSERT the flag is gone (string literals, not
 * env reads) — those are guards, not gates, and are excluded by scanning for the
 * `process.env.` / `env[` read form only.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const SRC = resolve(process.cwd(), 'src')

const DEAD_READ = new RegExp(
  String.raw`(?:process\.env\.|env\[['"\`])\s*(?:NEXT_PUBLIC_)?ONE_CORE_(?:TPS|EAD|REPAROLE)_ENABLED`,
)

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules') continue
      out.push(...walk(p))
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(p)
    }
  }
  return out
}

describe('dead-flag guard — ONE_CORE_*_ENABLED are not runtime gates', () => {
  it('no source file reads a dead ONE_CORE_*_ENABLED flag', () => {
    const offenders = walk(SRC)
      .filter((f) => DEAD_READ.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f).split('\\').join('/'))
    expect(
      offenders,
      `These files READ a dead ONE_CORE_*_ENABLED flag. The Core paths are unconditional / gated only by ONE_BRAIN_RECOGNIZE_ENABLED — remove the read:\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })
})
