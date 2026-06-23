/**
 * crossDocReconcileWiringAllProducts.test.ts — SEAM A is wired CONSISTENTLY across every
 * multi-document product route (one brain ⇒ same contract everywhere). Source-inspection
 * (routes can't be mounted in Node); the reconciliation behavior is unit-tested in
 * crossDocSession.test.ts. Proves each route: gates the cookie behind the flag, persists under
 * persistSessionId (not the raw ephemeral id), reconciles best-effort, and emits suggestions.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROUTES: Array<{ name: string; rel: string; product: string }> = [
  { name: 'TPS', rel: '../tps/ocr/extract/route.ts', product: 'tps' },
  { name: 'EAD', rel: '../ead/ocr/extract/route.ts', product: 'ead' },
  { name: 'Re-Parole', rel: '../reparole/ocr/extract/route.ts', product: 'reparole' },
]

for (const r of ROUTES) {
  const src = fs.readFileSync(path.resolve(__dirname, r.rel), 'utf-8')
  describe(`Seam A wiring — ${r.name}`, () => {
    it('imports the Seam-A pieces', () => {
      expect(src).toMatch(/reconcileSessionDocuments\s*,\s*suggestionsForDoc/)
      expect(src).toMatch(/isCrossDocReconcileEnabled/)
      expect(src).toMatch(/getWizardAnonId/)
      expect(src).toMatch(/loadAllCanonicalDocumentsForSession/)
    })
    it('reads the wizard cookie only behind the flag', () => {
      expect(src).toMatch(/const crossDocOn = isCrossDocReconcileEnabled\(\)/)
      expect(src).toMatch(/crossDocOn \? getWizardAnonId\(req\) : null/)
      expect(src).toMatch(/const persistSessionId = wizardAnonId \?\? document_id/)
    })
    it('persists under persistSessionId, never the raw ephemeral document_id', () => {
      expect(src).toMatch(/persistCanonicalDocument\([^,]+, persistSessionId\)/)
      expect(src).not.toMatch(/persistCanonicalDocument\([^,]+, document_id\)/)
    })
    it('reconcile is best-effort + flag/cookie gated', () => {
      expect(src).toMatch(/if \(crossDocOn && wizardAnonId\)/)
      expect(src).toMatch(/reconcile failed \(non-blocking\)/)
    })
    it(`loads the session docs scoped to product '${r.product}'`, () => {
      expect(src).toMatch(new RegExp(`loadAllCanonicalDocumentsForSession\\(persistSessionId, '${r.product}'\\)`))
    })
    it('emits cross_doc_suggestions in the response', () => {
      expect(src).toMatch(/cross_doc_suggestions: crossDocSuggestions/)
    })
  })
}
