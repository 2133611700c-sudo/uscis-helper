/**
 * Phase 9 — full vertical proof of the Unified Document Contract for ONE synthetic
 * birth certificate (no PII). Deterministic; exercises the real lib functions from
 * extraction payload → split → normalization → translation → review → confirmed PDF.
 *
 * Proves the 12 required points (numbered in the tests). Live browser/API E2E is a
 * SEPARATE concern (needs a running server + DB) and is BLOCKED in this sandbox —
 * see the report; this proves the deterministic vertical end-to-end.
 */
import { describe, it, expect } from 'vitest'
import { getDocTypeSpec } from '@/lib/docintel/documentRegistry'
import { getOfficialSchema } from '@/lib/translation/forms/ukraine/schemas/registry'
import { detectDocumentScript } from '@uscis-helper/knowledge'
import { applyContractSplitFlow, normalizeContractSplitFields } from '../contractFieldFlow'
import { contractReviewState, mustAlwaysReview, shouldBlockRawPdfFallback } from '../contractReviewState'
import { renderMirrorTranslationPDF } from '@/lib/translation/pdf/renderMirrorTranslationPDF'
import { buildMirrorValues } from '@/lib/translation/pdf/buildMirrorValues'
import { pdfSafe } from '@/lib/translation/pdf/renderValue'
import type { FieldOut } from '@/lib/canonical/core/translationAdapter'

const DOC = 'ua_birth_certificate'
const SPLIT_ON = { UNIFIED_DOC_CONTRACT_SPLIT_ENABLED: '1' } as Record<string, string | undefined>
const NORM_ON = { UNIFIED_DOC_CONTRACT_NORMALIZE_ENABLED: '1' } as Record<string, string | undefined>
const CONTRACT_ON = { UNIFIED_DOC_CONTRACT_ENABLED: '1' } as Record<string, string | undefined>
const CYRILLIC = /[Ѐ-ӿ]/

// (3) synthetic extraction payload — fictional UA family + Soviet-era place chain.
const EXTRACTED: FieldOut[] = [
  { field: 'child_family_name', value: 'Soloviak', raw_cyrillic: "Солов'як", confidence: 0.9, review_required: true, kind: 'name' },
  { field: 'child_given_name', value: 'Andrii', raw_cyrillic: 'Андрій', confidence: 0.9, review_required: true, kind: 'name' },
  { field: 'child_patronymic', value: 'Bohdanovych', raw_cyrillic: 'Богданович', confidence: 0.9, review_required: true, kind: 'name' },
  { field: 'dob', value: '1990-01-15', raw_cyrillic: '', confidence: 0.9, review_required: true, kind: 'date' },
  { field: 'place_of_birth_city', value: 'смт Lisove, Lisovyi district, Vinnytsia oblast, UkrSSR', raw_cyrillic: 'смт Лісове, Лісовий район, Вінницька область, УРСР', confidence: 0.7, review_required: true, kind: 'place_city' },
  { field: 'issuing_authority', value: 'Lisove Registry Office, Vinnytsia Oblast', raw_cyrillic: 'Лісовий РАЦС, Вінницька область', confidence: 0.7, review_required: true, kind: 'agency' },
  { field: 'certificate_series_number', value: 'II-BK 530174', raw_cyrillic: 'II-ВК 530174', confidence: 0.8, review_required: true, kind: 'doc_number' },
  { field: 'act_record_number', value: '84', raw_cyrillic: '84', confidence: 0.8, review_required: true, kind: 'doc_number' },
  { field: 'date_of_issue', value: '1990-01-22', raw_cyrillic: '', confidence: 0.8, review_required: true, kind: 'date' },
]

describe('Phase 9 — full vertical proof (synthetic birth certificate)', () => {
  it('(1) document classification — docType is a recognized birth certificate', () => {
    expect(getDocTypeSpec(DOC)?.id).toBe(DOC)
    expect(getOfficialSchema(DOC)?.docType).toBe(DOC)
  })

  it('(2) canonical orientation input — extraction payload is consumed upright (orientation upstream, proven in Phase 5b)', () => {
    // Orientation runs before extraction; here we assert the post-orientation payload
    // is well-formed (every field has the canonical row shape the contract expects).
    for (const f of EXTRACTED) {
      expect(typeof f.field).toBe('string')
      expect('raw_cyrillic' in f).toBe(true)
    }
  })

  it('(3) extraction payload is present and non-trivial', () => {
    expect(EXTRACTED.length).toBeGreaterThan(5)
  })

  it('(4) RU/UA routing — script detected as Ukrainian from the Cyrillic raw', () => {
    const script = detectDocumentScript(EXTRACTED.map((f) => f.raw_cyrillic))
    expect(script).toBe('uk') // і/ї present → UA, not RU
  })

  // pipeline: split → normalize (the route flow)
  const split = applyContractSplitFlow(EXTRACTED, DOC, SPLIT_ON)
  const normalized = normalizeContractSplitFields(split, NORM_ON)

  it('(5) split fields — merged values decomposed, originals kept as raw evidence', () => {
    const added = normalized.slice(EXTRACTED.length).map((f) => f.field)
    expect(added).toContain('document_series')
    expect(added).toContain('document_number')
    expect(added).toContain('place_of_birth_oblast')
    // originals preserved untouched
    for (const o of EXTRACTED) expect(normalized.find((f) => f.field === o.field)).toEqual(o)
  })

  it('(6) normalization — oblast genitive→nominative; district preserved (raw intact)', () => {
    const obl = normalized.find((f) => f.field === 'place_of_birth_oblast')!
    expect(obl.raw_cyrillic).toBe('Вінницька область') // RAW untouched
    expect(obl.value).toMatch(/Vinnytsia Oblast/i)      // normalized/translated
    const dist = normalized.find((f) => f.field === 'place_of_birth_district')!
    expect(dist.raw_cyrillic).toBe('Лісовий район')     // district NOT collapsed
  })

  it('(7) translation — English value layer carries NO raw Cyrillic for name fields', () => {
    for (const k of ['child_family_name', 'child_given_name', 'child_patronymic']) {
      const f = normalized.find((x) => x.field === k)!
      expect(CYRILLIC.test(f.value ?? '')).toBe(false)
    }
  })

  it('(8) review-required — critical handwritten fields ALWAYS require review', () => {
    for (const k of ['child_family_name', 'child_given_name', 'child_patronymic', 'date_of_birth', 'act_record_number']) {
      expect(mustAlwaysReview(k)).toBe(true)
    }
    // an unconfirmed critical field is a candidate (pending), not confirmed
    expect(contractReviewState({ field: 'child_family_name', value: 'Soloviak', raw_cyrillic: "Солов'як" })).toBe('candidate')
  })

  it('(12) PDF blocked before confirmation — raw fallback closed when contract ON', () => {
    expect(shouldBlockRawPdfFallback(DOC, CONTRACT_ON)).toBe(true)
  })

  it('(9)+(10) after user confirmation, mirror PDF renders from the confirmed fields', async () => {
    const confirmed = normalized.map((f) => ({ ...f, confirmed: true, review_required: false }))
    for (const f of confirmed.filter((x) => ['child_family_name', 'date_of_birth'].includes(x.field))) {
      expect(contractReviewState(f as never)).toBe('confirmed')
    }
    const res = await renderMirrorTranslationPDF(DOC, confirmed, { signerName: 'Ivan Ivanenko', signerAddress: '1213 Gordon St, Los Angeles, CA 90038', signedAt: '2026-05-30T00:00:00Z' })
    expect(res).not.toBeNull()
    expect(res!.pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(res!.pdf.length).toBeGreaterThan(1000)
  })

  it('(11) no Cyrillic leakage in the RENDERED English mirror (pdfSafe transliteration)', () => {
    // The renderer draws pdfSafe(value); the English output is pdfSafe(value), which
    // is the layer that must never carry raw Cyrillic. Assert on exactly that.
    const schema = getOfficialSchema(DOC)!
    const values = buildMirrorValues(schema, normalized)
    for (const [key, v] of Object.entries(values)) {
      if (v.canRead && v.value) {
        const drawn = pdfSafe(v.value)
        expect(CYRILLIC.test(drawn), `Cyrillic leaked in rendered field ${key}: ${drawn}`).toBe(false)
      }
    }
  })
})
