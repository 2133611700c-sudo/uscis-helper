/**
 * Recognition fork RATCHET — the "one brain" tripwire (One-Brain plan, Step 0-guard).
 *
 * One brain = readers OBSERVE, the Decision Engine DECIDES. The danger is a NEW
 * route quietly adding a second recognition plane (its own OCR/LLM read) that
 * writes fields outside the single spine — exactly the forks the audit found
 * (TPS legacy/dualOcr/brain, translation ocr-from-storage).
 *
 * This test freezes the CURRENT set of files that touch a second-recognition-plane
 * symbol and FAILS if a new file starts using one. It is GREEN at HEAD (the
 * allowlist == today's callers) and RATCHETS DOWN: as each fork is converted into
 * a ReaderResult adapter behind the Decision Engine, delete its entry here.
 *
 * Mirrors the noDirectSupabaseInDomain ratchet idiom. Pure static scan; no runtime.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const SRC = resolve(process.cwd(), 'src')

/** Second-recognition-plane symbols → the ONLY files allowed to reference them.
 *  Shrink these lists as forks collapse into the one Decision Engine. */
const FORK_SYMBOLS: Record<string, string[]> = {
  // Dual-OCR cross-reference (Google Vision + DocAI → DeepSeek) — TPS legacy plane.
  runDualOcrCrossref: ['app/api/tps/ocr/extract/route.ts'],
  // DeepSeek documentBrain extraction — TPS AI fallback plane.
  runBrain: ['app/api/tps/ocr/shape-debug/route.ts', 'app/api/tps/ocr/extract/route.ts'],
  // DeepSeek field-mapper over Google-Vision OCR — translation dark pipeline.
  mapFieldsWithDeepSeek: ['app/api/translation/[sessionId]/ocr-from-storage/route.ts'],
  // Google Vision provider (adjunct OCR / bbox / date ensemble — to become a Reader).
  googleVisionProvider: [
    'app/api/translation/vision-extract/route.ts',
    'app/api/reparole/ocr/extract/route.ts',
    'app/api/tps/ocr/shape-debug/route.ts',
    'app/api/tps/ocr/extract/route.ts',
    'lib/ocr/providers/index.ts',
    // One-Brain evidence locator (STEP E): produces EvidenceRegion bbox, NOT a field
    // decision — sanctioned as the bbox source, not a parallel recognition plane.
    'lib/docintel/evidence/visionBboxLocator.ts',
  ],
}

/** The module that DEFINES each symbol (excluded from caller scanning). */
const OWN_MODULE: Record<string, RegExp> = {
  runDualOcrCrossref: /dualOcrCrossref\.ts$/,
  runBrain: /documentBrain\.ts$/,
  mapFieldsWithDeepSeek: /field-mapper\.ts$/,
  googleVisionProvider: /providers[\/\\]google-vision\.ts$/,
}

/** Files that NAME the fork symbols as documentation/data, not as callers
 *  (the fork registry maps the forks — it must not be counted as a bypass). */
const DOC_ONLY = [/oneBrainForkRegistry\.ts$/]

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '__tests__') continue
      out.push(...walk(p))
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !DOC_ONLY.some((re) => re.test(name))) {
      out.push(p)
    }
  }
  return out
}

const ALL_FILES = walk(SRC)

describe('recognition fork ratchet — no NEW second-recognition-plane bypass', () => {
  for (const [symbol, allow] of Object.entries(FORK_SYMBOLS)) {
    it(`'${symbol}' is referenced only by allow-listed files`, () => {
      const own = OWN_MODULE[symbol]
      const callers = ALL_FILES.filter((f) => {
        if (own.test(f)) return false
        return new RegExp(`\\b${symbol}\\b`).test(readFileSync(f, 'utf8'))
      }).map((f) => relative(SRC, f).split('\\').join('/'))
      const unexpected = callers.filter((c) => !allow.includes(c))
      expect(
        unexpected,
        `NEW '${symbol}' caller(s) not in the ratchet allow-list — route recognition through the one Decision Engine (a ReaderResult adapter), do not add a parallel plane:\n  ${unexpected.join('\n  ')}`,
      ).toEqual([])
    })
  }

  it('ratchet metadata is internally consistent', () => {
    expect(Object.keys(FORK_SYMBOLS).sort()).toEqual(Object.keys(OWN_MODULE).sort())
  })
})
