/**
 * Import-boundary invariant — domain/canonical/review/PDF code must NOT import a
 * Supabase client; Supabase access lives ONLY in an allow-listed adapter layer.
 *
 * Two guards:
 *  1. CLEAN LAYERS: the unified-contract domain (lib/contracts), the repository
 *     runtime (lib/repositories, minus the adapter stub), the PDF layer
 *     (lib/translation/pdf), and the canonical CORE (lib/canonical/core) import NO
 *     Supabase client. (These are already clean — this LOCKS them.)
 *  2. RATCHET: the set of active translation ROUTES that still import Supabase may
 *     only SHRINK. A new coupled route fails this test. When the set is empty, the
 *     runtime is fully repository-driven (APPLICATION CODE COMPLETE for routes).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const WEB = resolve(__dirname, '../../../..') // apps/web
const SUPABASE_IMPORT = /(from\s+['"][^'"]*lib\/supabase[^'"]*['"])|(@supabase\/supabase-js)|createAdminSupabaseClient/

function tsFiles(dir: string): string[] {
  const out: string[] = []
  let entries: string[] = []
  try { entries = readdirSync(dir) } catch { return out }
  for (const e of entries) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...tsFiles(p))
    else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p)
  }
  return out
}

describe('boundary — clean layers import NO Supabase client', () => {
  const CLEAN_DIRS = [
    'src/lib/contracts',
    'src/lib/translation/pdf',
    'src/lib/canonical/core',
  ]
  for (const d of CLEAN_DIRS) {
    it(`${d} has zero Supabase-client imports`, () => {
      const offenders = tsFiles(join(WEB, d)).filter((f) => SUPABASE_IMPORT.test(readFileSync(f, 'utf8')))
      expect(offenders.map((f) => f.replace(WEB + '/', ''))).toEqual([])
    })
  }
  it('lib/repositories runtime (excluding the adapter stub) imports no Supabase client', () => {
    const offenders = tsFiles(join(WEB, 'src/lib/repositories'))
      .filter((f) => !/supabaseAdapter/.test(f))
      .filter((f) => SUPABASE_IMPORT.test(readFileSync(f, 'utf8')))
    expect(offenders.map((f) => f.replace(WEB + '/', ''))).toEqual([])
  })
})

describe('ratchet — active translation routes coupled to Supabase may only shrink', () => {
  // KNOWN backlog (2026-06-28). MUST shrink to [] for APPLICATION CODE COMPLETE.
  // Do NOT add to this list — migrate the route to getRepositories() instead.
  const KNOWN_COUPLED_ROUTES = new Set([
    'src/app/api/translation/[sessionId]/confirm-field/route.ts',
    'src/app/api/translation/[sessionId]/correct-field/route.ts',
    'src/app/api/translation/[sessionId]/delete/route.ts',
    'src/app/api/translation/[sessionId]/extraction-status/[runId]/route.ts',
    'src/app/api/translation/[sessionId]/manual-review-status/route.ts',
    'src/app/api/translation/[sessionId]/ocr-from-storage/route.ts',
    'src/app/api/translation/[sessionId]/review-state/route.ts',
    'src/app/api/translation/certify/route.ts',
    'src/app/api/translation/extract/route.ts',
    'src/app/api/translation/generate-pdf/route.ts',
    'src/app/api/translation/process/route.ts',
    'src/app/api/translation/render/route.ts',
    'src/app/api/translation/upload/route.ts',
  ])

  it('no NEW route couples to Supabase (set ⊆ known backlog)', () => {
    const routes = tsFiles(join(WEB, 'src/app/api/translation')).filter((f) => /route\.tsx?$/.test(f))
    const coupled = routes
      .filter((f) => SUPABASE_IMPORT.test(readFileSync(f, 'utf8')))
      .map((f) => f.replace(WEB + '/', ''))
    const unknown = coupled.filter((r) => !KNOWN_COUPLED_ROUTES.has(r))
    expect(unknown, 'a NEW route imports Supabase directly — route it through getRepositories()').toEqual([])
  })

  it('documents remaining backlog count (APPLICATION CODE COMPLETE when 0)', () => {
    const routes = tsFiles(join(WEB, 'src/app/api/translation')).filter((f) => /route\.tsx?$/.test(f))
    const remaining = routes.filter((f) => SUPABASE_IMPORT.test(readFileSync(f, 'utf8'))).length
    // Honest tripwire: when migration completes, flip this to toBe(0).
    expect(remaining).toBeLessThanOrEqual(KNOWN_COUPLED_ROUTES.size)
  })
})
