/**
 * detectDocumentType.test.ts — the ONE BRAIN doc-type detector's fail-closed contract.
 * Pure: exercises normalizeDetection + classifyDocumentType with a mocked vision call. No network.
 */
import { describe, it, expect } from 'vitest'
import {
  normalizeDetection,
  classifyDocumentType,
  knownTypeCatalog,
  buildDocTypePrompt,
  DOC_TYPE_MIN_CONFIDENCE,
} from '../detectDocumentType'

describe('normalizeDetection — fail-closed, registry-bounded', () => {
  it('accepts a known id above threshold', () => {
    const r = normalizeDetection({ doc_type_id: 'ua_birth_certificate_soviet', confidence: 0.95, printed_title_seen: 'СВИДЕТЕЛЬСТВО О РОЖДЕНИИ' }, DOC_TYPE_MIN_CONFIDENCE)
    expect(r.doc_type_id).toBe('ua_birth_certificate_soviet')
    expect(r.confidence).toBe(0.95)
    expect(r.measured).toBe(true)
  })
  it('FAIL-CLOSED: known id but BELOW threshold ⇒ unknown', () => {
    const r = normalizeDetection({ doc_type_id: 'ua_birth_certificate', confidence: 0.4 }, DOC_TYPE_MIN_CONFIDENCE)
    expect(r.doc_type_id).toBe('unknown')
    expect(r.confidence).toBe(0.4) // confidence preserved for the caller/audit
  })
  it('FAIL-CLOSED: an id NOT in the registry ⇒ unknown (never invent a type)', () => {
    const r = normalizeDetection({ doc_type_id: 'ua_drivers_license', confidence: 0.99 }, DOC_TYPE_MIN_CONFIDENCE)
    expect(r.doc_type_id).toBe('unknown')
  })
  it('explicit unknown from the model stays unknown', () => {
    const r = normalizeDetection({ doc_type_id: 'unknown', confidence: 0.2, candidates: [{ doc_type_id: 'us_i94', confidence: 0.3 }] }, DOC_TYPE_MIN_CONFIDENCE)
    expect(r.doc_type_id).toBe('unknown')
    expect(r.candidates).toEqual([{ doc_type_id: 'us_i94', confidence: 0.3 }])
  })
  it('drops candidates not in the registry; caps at 3', () => {
    const r = normalizeDetection({
      doc_type_id: 'unknown', confidence: 0,
      candidates: [
        { doc_type_id: 'ua_birth_certificate', confidence: 0.5 },
        { doc_type_id: 'made_up', confidence: 0.4 },
        { doc_type_id: 'us_ead', confidence: 0.3 },
        { doc_type_id: 'us_i94', confidence: 0.2 },
        { doc_type_id: 'us_i797', confidence: 0.1 },
      ],
    }, DOC_TYPE_MIN_CONFIDENCE)
    expect(r.candidates.map((c) => c.doc_type_id)).toEqual(['ua_birth_certificate', 'us_ead', 'us_i94'])
  })
  it('garbage/out-of-range confidence ⇒ 0 and unknown', () => {
    const r = normalizeDetection({ doc_type_id: 'ua_birth_certificate', confidence: 5 }, DOC_TYPE_MIN_CONFIDENCE)
    expect(r.confidence).toBe(0)
    expect(r.doc_type_id).toBe('unknown')
  })
})

describe('classifyDocumentType — provider-failure = fail-closed unknown', () => {
  const img = Buffer.from('fake')
  it('provider throws ⇒ unknown, measured:false', async () => {
    const r = await classifyDocumentType(img, async () => { throw new Error('down') })
    expect(r).toMatchObject({ doc_type_id: 'unknown', confidence: 0, measured: false })
  })
  it('null response ⇒ unknown, measured:false', async () => {
    const r = await classifyDocumentType(img, async () => null)
    expect(r.measured).toBe(false)
  })
  it('unparseable response ⇒ unknown, measured:false', async () => {
    const r = await classifyDocumentType(img, async () => 'not json at all')
    expect(r.measured).toBe(false)
  })
  it('strips ```json fences and classifies', async () => {
    const r = await classifyDocumentType(img, async () => '```json\n{"doc_type_id":"us_ead","confidence":0.9}\n```')
    expect(r.doc_type_id).toBe('us_ead')
  })
})

describe('catalog + prompt', () => {
  it('catalog only lists registry ids that have a signature', () => {
    const cat = knownTypeCatalog()
    expect(cat.length).toBeGreaterThanOrEqual(10)
    expect(cat.every((c) => typeof c.signature === 'string' && c.signature.length > 0)).toBe(true)
    expect(cat.some((c) => c.id === 'ua_birth_certificate_soviet')).toBe(true)
  })
  it('prompt names every catalog id and forbids reading handwriting', () => {
    const p = buildDocTypePrompt()
    for (const c of knownTypeCatalog()) expect(p).toContain(c.id)
    expect(p.toLowerCase()).toContain('printed')
    expect(p.toLowerCase()).toContain('handwrit')
  })
})
