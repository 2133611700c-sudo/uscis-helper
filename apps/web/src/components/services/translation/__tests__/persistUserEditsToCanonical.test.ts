/**
 * persistUserEditsToCanonical — source guard for the edit→certified-PDF fix.
 *
 * FINDING: in shadow/enforce canonical mode, generate-pdf resolves the canonical
 * document and renders its (override-applied) finalValues — but the wizard never
 * wrote the user's in-review corrections as overrides, so the certified PDF showed
 * the RAW reader value, silently dropping the user's correction.
 *
 * FIX: before calling generate-pdf, the wizard persists `kind:'user_corrected'`
 * fields as confirmed canonical overrides (source:'user_edit') via the existing
 * /api/canonical/[id]/override route. This guard locks that wiring.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const dir = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(resolve(dir, '..', 'TranslateWizard.tsx'), 'utf8')

describe('TranslateWizard — persist user corrections to canonical before PDF', () => {
  it('POSTs user_corrected fields to the override route as confirmed user_edit overrides', () => {
    expect(src).toMatch(/canonical\/\$\{canonicalDocumentId\}\/override/)
    expect(src).toContain("source: 'user_edit'")
    expect(src).toContain('confirmed: true')
    // only the fields the user actually changed
    expect(src).toMatch(/kind\?\:\s*string[^)]*\)\.kind\s*===\s*'user_corrected'/)
    // field_key + override_value carried from the edited field
    expect(src).toMatch(/field_key:\s*f\.field/)
    expect(src).toMatch(/override_value:\s*f\.value/)
  })

  it('writes overrides BEFORE the generate-pdf call (so canonical resolves with them)', () => {
    const overrideIdx = src.indexOf('/override`, {')
    const generateIdx = src.indexOf("fetch('/api/translation/generate-pdf'")
    expect(overrideIdx).toBeGreaterThan(-1)
    expect(generateIdx).toBeGreaterThan(-1)
    expect(overrideIdx).toBeLessThan(generateIdx)
  })

  it('is fail-safe: the override write is wrapped so it never blocks the paid PDF', () => {
    // the override write sits inside a try/catch whose catch is a no-op comment
    const seg = src.slice(src.indexOf('editedFields'), src.indexOf("fetch('/api/translation/generate-pdf'"))
    expect(seg).toMatch(/try\s*\{/)
    expect(seg).toMatch(/\}\s*catch\s*\{/)
  })
})
