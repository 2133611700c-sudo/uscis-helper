/**
 * reviewGateAutoDetect — source guard: the wizard MUST enforce the mandatory review
 * gate on the auto-detect path. When the user did not pick a document type and the
 * system read fields itself, those candidates must be confirmed before finalization
 * (anti-fabrication: never let a user pay/finalize with unconfirmed fields).
 *
 * Found in P0 inventory: needsReviewGate was `currentDocMeta?.auto || hardCaseHasFields`,
 * which is false on the birth-cert auto-detect path (auto:false, HARD_CASE_AUTOREAD off)
 * → the Pay CTA was NOT blocked despite review_required fields.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const dir = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(resolve(dir, '..', 'TranslateWizard.tsx'), 'utf8')

describe('TranslateWizard — mandatory review gate on auto-detect', () => {
  it('needsReviewGate includes the auto-detect path (autoDetect && extractedFields.length > 0)', () => {
    const line = src.split('\n').find((l) => l.includes('const needsReviewGate =')) ?? ''
    expect(line).toContain('autoDetect')
    expect(line).toMatch(/autoDetect\s*&&\s*extractedFields\.length\s*>\s*0/)
  })

  it('the Pay/finalize CTA is still gated by canProceedToCertifiedOutput', () => {
    // canProceedToCertifiedOutput blocks finalization while unresolved review fields remain.
    expect(src).toMatch(/canProceedToCertifiedOutput\s*=\s*\n?\s*!needsReviewGate\s*\|\|/)
    expect(src).toMatch(/disabled=\{[^}]*!canProceedToCertifiedOutput/)
  })
})
