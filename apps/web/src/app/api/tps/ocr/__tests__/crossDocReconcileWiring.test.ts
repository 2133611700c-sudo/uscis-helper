/**
 * crossDocReconcileWiring.test.ts — SEAM A wiring in the TPS OCR extract route.
 *
 * Proves the SAFE contract (CONSTITUTION L10):
 *   1. The route imports the Seam-A pieces and uses the stable wizard cookie ONLY behind the
 *      flag — flag OFF ⇒ persist session id = today's ephemeral document_id (byte-identical).
 *   2. The persist call uses `persistSessionId` (not the raw document_id), so the grouping key
 *      is the one the flag controls.
 *   3. The response carries `cross_doc_suggestions` (empty unless flag ON + cookie + a stronger
 *      sibling anchor produced a change).
 *
 * Style mirrors the sibling reparole canonicalCarriage.test.ts: source inspection (the route
 * cannot be mounted in Node) + pure simulation of the session-id decision. The reconciliation
 * BEHAVIOR itself is fully unit-tested in crossDocSession.test.ts / crossDocReconcile.test.ts.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROUTE_SRC = fs.readFileSync(path.resolve(__dirname, '../extract/route.ts'), 'utf-8')

describe('TPS extract route — Seam A cross-doc wiring (source contract)', () => {
  it('imports the Seam-A pieces (reconcile + flag + cookie reader + session loader)', () => {
    expect(ROUTE_SRC).toMatch(/reconcileSessionDocuments\s*,\s*suggestionsForDoc/)
    expect(ROUTE_SRC).toMatch(/isCrossDocReconcileEnabled/)
    expect(ROUTE_SRC).toMatch(/getWizardAnonId/)
    expect(ROUTE_SRC).toMatch(/loadAllCanonicalDocumentsForSession/)
  })

  it('reads the wizard cookie ONLY when the flag is on (flag gates the grouping change)', () => {
    expect(ROUTE_SRC).toMatch(/const crossDocOn = isCrossDocReconcileEnabled\(\)/)
    expect(ROUTE_SRC).toMatch(/crossDocOn \? getWizardAnonId\(req\) : null/)
  })

  it('persists under persistSessionId = wizardAnonId ?? document_id (OFF ⇒ ephemeral id)', () => {
    expect(ROUTE_SRC).toMatch(/const persistSessionId = wizardAnonId \?\? document_id/)
    expect(ROUTE_SRC).toMatch(/persistCanonicalDocument\(tpsCanonicalResult, persistSessionId\)/)
    // must NOT still persist under the raw ephemeral id.
    expect(ROUTE_SRC).not.toMatch(/persistCanonicalDocument\(tpsCanonicalResult, document_id\)/)
  })

  it('reconcile is best-effort (wrapped in try/catch) and gated on flag AND cookie', () => {
    expect(ROUTE_SRC).toMatch(/if \(crossDocOn && wizardAnonId\)/)
    expect(ROUTE_SRC).toMatch(/\[seam-a\/cross-doc\] reconcile failed \(non-blocking\)/)
  })

  it('emits cross_doc_suggestions in the response', () => {
    expect(ROUTE_SRC).toMatch(/cross_doc_suggestions: crossDocSuggestions/)
  })
})

// Pure simulation of the route's session-id decision (the exact inline logic).
function resolvePersistSessionId(flagOn: boolean, cookie: string | null, ephemeralId: string): string {
  const wizardAnonId = flagOn ? cookie : null
  return wizardAnonId ?? ephemeralId
}

describe('TPS Seam A — session-id decision (pure simulation)', () => {
  const EPH = 'doc_123_abcd'
  const COOKIE = '11111111-2222-3333-4444-555555555555'

  it('flag OFF ⇒ ephemeral id regardless of cookie (byte-identical to today)', () => {
    expect(resolvePersistSessionId(false, COOKIE, EPH)).toBe(EPH)
    expect(resolvePersistSessionId(false, null, EPH)).toBe(EPH)
  })

  it('flag ON + cookie ⇒ stable wizard id (documents group)', () => {
    expect(resolvePersistSessionId(true, COOKIE, EPH)).toBe(COOKIE)
  })

  it('flag ON + NO cookie ⇒ falls back to ephemeral id (never throws, no grouping)', () => {
    expect(resolvePersistSessionId(true, null, EPH)).toBe(EPH)
  })
})
