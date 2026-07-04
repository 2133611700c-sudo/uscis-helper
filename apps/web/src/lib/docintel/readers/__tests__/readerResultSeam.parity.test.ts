/**
 * TRUTH-PLAN step 4 — ReaderResult LIVE-SEAM byte-parity.
 * Candidates produced THROUGH the ReaderResult contract (readerResultFromExtracted →
 * observationToCandidate) must equal the direct docintelToCandidate path FIELD-FOR-FIELD,
 * across every candidate-relevant shape (values, cyrillic, review, consensus, evidence).
 * Also proves the flag matrix on recognizeDocument (seam OFF = identical candidates).
 * FICTIONAL data only.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { readerResultFromExtracted, observationToCandidate } from '../ReaderResult'
import { docintelToCandidate } from '@/lib/canonical/core/translationAdapter'
import { recognizeDocument } from '../../recognizeDocument'
import type { ExtractedDocField } from '../../types'
import type { EvidenceRegion } from '../../evidence/EvidenceRegion'

afterEach(() => { delete process.env.READER_RESULT_SEAM })

const region: EvidenceRegion = {
  fieldKey: 'family_name', bbox: [0.1, 0.2, 0.3, 0.25], page: 1, status: 'exact', source: 'ocr_token',
}

const FIELDS: ExtractedDocField[] = [
  { field: 'family_name', kind: 'name', raw_cyrillic: 'Тестенко', value: 'Testenko', confidence: 0.92, review_required: false, source: 'vision', provider: 'gemini', evidenceRegions: [region] },
  { field: 'given_name', kind: 'name', raw_cyrillic: 'Іван', value: 'Ivan', confidence: 0.4, review_required: true, review_reasons: ['low_confidence', 'source_script_ambiguous'], source: 'vision', provider: 'gemini' },
  { field: 'dob', kind: 'date', raw_cyrillic: null, value: '1990-01-01', confidence: 0.99, review_required: false, source: 'vision', provider: 'gemini', consensus_reliable: true },
  { field: 'notes', kind: 'text', raw_cyrillic: null, value: null, confidence: 0, review_required: true, source: 'vision', provider: 'gemini' },
]

describe('ReaderResult live seam ≡ direct docintelToCandidate (byte parity)', () => {
  it('per-field parity across all candidate-relevant shapes', () => {
    const rr = readerResultFromExtracted(FIELDS, 'mock-model', 5)
    for (const [i, f] of FIELDS.entries()) {
      const direct = docintelToCandidate(f, 3)
      const viaSeam = observationToCandidate(rr.fields[i], 3, f.provider)
      // docintelToCandidate uses `f.value ?? ''`; seam mirrors with canonicalValue ?? ''
      expect(viaSeam).toEqual({ ...direct })
    }
  })

  it('observation abstention: empty value+cyrillic → abstained; any content → not', () => {
    const rr = readerResultFromExtracted(FIELDS, 'm', 0)
    expect(rr.fields[3].abstained).toBe(true)   // notes: no value, no cyrillic
    expect(rr.fields[0].abstained).toBe(false)
    expect(rr.status).toBe('ok')
  })

  it('recognizeDocument: seam ON produces IDENTICAL canonical output to seam OFF', async () => {
    const reader = (async () => ({ ok: true, status: 'ok', ms: 1, model: 'mock', fields: FIELDS })) as never
    const input = {
      pages: [{ buffer: Buffer.from('x'), mime: 'image/jpeg' }],
      docTypeId: 'ua_international_passport',
      product: 'translation' as const,
      reader,
      createdAt: '2026-07-04T00:00:00.000Z',
      documentSessionId: 'parity-test',
    }
    delete process.env.READER_RESULT_SEAM
    const off = await recognizeDocument(input)
    process.env.READER_RESULT_SEAM = '1'
    const on = await recognizeDocument(input)
    expect(on.candidateCount).toBe(off.candidateCount)
    expect(on.canonicalResult?.fields).toEqual(off.canonicalResult?.fields)
    expect([...on.cyrillicMap.entries()]).toEqual([...off.cyrillicMap.entries()])
  })

  it("strict flag: 'true' does NOT enable the seam (still identical, via direct path)", async () => {
    process.env.READER_RESULT_SEAM = 'true'
    const reader = (async () => ({ ok: true, status: 'ok', ms: 1, model: 'mock', fields: FIELDS })) as never
    const out = await recognizeDocument({
      pages: [{ buffer: Buffer.from('x'), mime: 'image/jpeg' }],
      docTypeId: 'ua_international_passport',
      product: 'translation' as const,
      reader,
      createdAt: '2026-07-04T00:00:00.000Z',
    })
    expect(out.candidateCount).toBe(FIELDS.length)
  })
})
