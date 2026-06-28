/**
 * Workstream B/E — route invariant: the generate-pdf route applies the single
 * server-side final-PDF gate BEFORE every renderer, so no PDF path can bypass it.
 *
 * Source-scan test (like brainSingleArbiterInvariant): reads the route text and
 * proves assertDocumentReadyForFinalPdf is called before any mirror/generic render.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const routeSrc = readFileSync(
  resolve(__dirname, '../../../app/api/translation/generate-pdf/route.ts'),
  'utf8',
)
const lineOf = (needle: string): number => {
  const idx = routeSrc.split('\n').findIndex((l) => l.includes(needle))
  return idx < 0 ? Infinity : idx
}

describe('generate-pdf route — final-PDF gate covers every renderer', () => {
  it('imports and calls assertDocumentReadyForFinalPdf', () => {
    expect(routeSrc).toContain("from '@/lib/contracts/finalPdfGate'")
    expect(routeSrc).toContain('assertDocumentReadyForFinalPdf(')
  })

  it('the gate call precedes the mirror renderer', () => {
    expect(lineOf('assertDocumentReadyForFinalPdf(')).toBeLessThan(lineOf('renderMirrorTranslationPDF('))
  })

  it('the gate call precedes the generic renderer invocation', () => {
    expect(lineOf('assertDocumentReadyForFinalPdf(')).toBeLessThan(lineOf('pdfBuffer = await renderGenericPdf()'))
  })

  it('a blocked gate returns 403 review_required (no PDF emitted)', () => {
    const after = routeSrc.slice(routeSrc.indexOf('assertDocumentReadyForFinalPdf('))
    expect(after).toMatch(/finalGate\.enforced\s*&&\s*!finalGate\.ready/)
    expect(after).toContain("error: 'review_required'")
    expect(after).toContain("gate: 'final_pdf_confirmation'")
    expect(after).toContain('status: 403')
  })

  it('the raw→PDF fallback closure (shouldBlockRawPdfFallback) is still present', () => {
    expect(routeSrc).toContain('shouldBlockRawPdfFallback(')
  })
})
