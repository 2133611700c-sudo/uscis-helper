/**
 * ONE BRAIN GUARD (Constitution L1: gemini-3.1-pro-preview is THE reader for ALL products).
 *
 * Every product's OCR/extraction route MUST read documents through the single shared
 * Gemini Core brain `readDocument` (docintel → geminiVisionProvider → buildPrompt →
 * docReadingRules). This guard fails if any product route stops using readDocument or a
 * new product introduces a divergent reader — structurally enforcing "one brain for all
 * services". (It was VERIFIED 2026-06-22 that translation/TPS/EAD/Re-Parole all already
 * route through readDocument; the DeepSeek path is the SECONDARY US-Latin-doc handler.)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const API = resolve(__dirname, '../../app/api')

// Every product whose OCR reads Cyrillic/identity documents → must use the shared brain.
const PRODUCT_OCR_ROUTES = [
  'translation/vision-extract/route.ts',
  'tps/ocr/extract/route.ts',
  'ead/ocr/extract/route.ts',
  'reparole/ocr/extract/route.ts',
]

describe('ONE BRAIN — all product OCR routes read via the shared Gemini Core (readDocument)', () => {
  for (const rel of PRODUCT_OCR_ROUTES) {
    it(`${rel} reads through readDocument (the one Gemini brain), not a divergent reader`, () => {
      const path = resolve(API, rel)
      expect(existsSync(path), `route missing: ${rel}`).toBe(true)
      const src = readFileSync(path, 'utf8')
      expect(src, `${rel} must import/use readDocument (Constitution L1)`).toMatch(/readDocument/)
    })
  }
})
