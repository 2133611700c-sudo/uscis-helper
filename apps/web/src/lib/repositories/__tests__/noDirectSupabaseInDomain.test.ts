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
  // ✅ EMPTY (2026-06-28): ALL active translation routes migrated to getRepositories().
  // APPLICATION CODE COMPLETE for routes — Supabase access lives only in the
  // (not-connected) adapter stub. Do NOT add to this set; migrate any new route to
  // getRepositories() instead. Migrated: upload, ocr-from-storage, extract, extraction-
  // status, manual-review-status, review-state, confirm-field, correct-field, certify,
  // delete, process, render, generate-pdf.
  const KNOWN_COUPLED_ROUTES = new Set<string>([])

  it('no NEW route couples to Supabase (set ⊆ known backlog)', () => {
    const routes = tsFiles(join(WEB, 'src/app/api/translation')).filter((f) => /route\.tsx?$/.test(f))
    const coupled = routes
      .filter((f) => SUPABASE_IMPORT.test(readFileSync(f, 'utf8')))
      .map((f) => f.replace(WEB + '/', ''))
    const unknown = coupled.filter((r) => !KNOWN_COUPLED_ROUTES.has(r))
    expect(unknown, 'a NEW route imports Supabase directly — route it through getRepositories()').toEqual([])
  })

  it('ZERO active translation routes import Supabase directly (APPLICATION CODE COMPLETE)', () => {
    const routes = tsFiles(join(WEB, 'src/app/api/translation')).filter((f) => /route\.tsx?$/.test(f))
    const remaining = routes
      .filter((f) => SUPABASE_IMPORT.test(readFileSync(f, 'utf8')))
      .map((f) => f.replace(WEB + '/', ''))
    // Migration COMPLETE: the route layer is fully repository-driven.
    expect(remaining, 'a translation route still imports Supabase directly').toEqual([])
    expect(KNOWN_COUPLED_ROUTES.size).toBe(0)
  })
})
