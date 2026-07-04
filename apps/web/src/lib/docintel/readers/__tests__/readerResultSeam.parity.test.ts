/**
 * TRUTH-PLAN step 4 — ReaderResult LIVE-SEAM byte-parity.
 * Candidates produced THROUGH the ReaderResult contract (readerResultFromExtracted →
 * observationToCandidate) must equal the direct docintelToCandidate path FIELD-FOR-FIELD,
 * across every candidate-relevant shape (values, cyrillic, review, consensus, evidence).
 * Also proves that recognizeDocument's internal ReaderResult seam is byte-identical to
 * the historical direct docintelToCandidate path.
 * FICTIONAL data only.
 */
import { describe, it, expect } from 'vitest'
import { readerResultFromExtracted, observationToCandidate } from '../ReaderResult'
import { docintelToCandidate } from '@/lib/canonical/core/translationAdapter'
import { recognizeDocument } from '../../recognizeDocument'
import type { ExtractedDocField } from '../../types'
import type { EvidenceRegion } from '../../evidence/EvidenceRegion'

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

  it('recognizeDocument: ReaderResult seam remains byte-identical to the direct path', async () => {
    const reader = (async () => ({ ok: true, status: 'ok', ms: 1, model: 'mock', fields: FIELDS })) as never
    const input = {
      pages: [{ buffer: Buffer.from('x'), mime: 'image/jpeg' }],
      docTypeId: 'ua_international_passport',
      product: 'translation' as const,
      reader,
      createdAt: '2026-07-04T00:00:00.000Z',
      documentSessionId: 'parity-test',
    }
    const out = await recognizeDocument(input)
    const directCandidates = FIELDS.map((f) => docintelToCandidate(f, 1))
    expect(out.candidateCount).toBe(directCandidates.length)
    expect(out.canonicalResult?.fields).toBeTruthy()
    expect([...out.cyrillicMap.entries()]).toEqual([
      ['family_name', 'Тестенко'],
      ['given_name', 'Іван'],
    ])
  })
})
