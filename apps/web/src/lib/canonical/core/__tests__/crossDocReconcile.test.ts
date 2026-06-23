/**
 * crossDocReconcile.test.ts — STAGE 3 cross-document reconciliation engine (the proof).
 *
 * Realistic multi-doc fixture: an MRZ-validated passport (dob 1986-06-25, name Сергій) +
 * a Soviet-era birth-cert (dob held-for-review, name Сергей). Proves the HARD INVARIANTS:
 *   - passport DOB (mrz_validated) resolves the birth-cert held DOB → suggestedValue
 *     1986-06-25, provenance cross_doc_reconciled, review STILL required (one-click).
 *   - a confidently-read field is NEVER overwritten.
 *   - a Ukrainian-passport NAME does NOT overwrite a Russian birth-cert NAME (L8 script guard).
 *   - flag OFF → byte-identical, zero changes.
 */
import { describe, it, expect } from 'vitest'
import {
  reconcileAcrossDocuments,
  classifyStrength,
  sameNameScript,
  ANCHOR_STRENGTH,
  type PerDocFields,
} from '../crossDocReconcile'
import type { CanonicalField } from '../../types'

const field = (p: Partial<CanonicalField> & { key: string }): CanonicalField => ({
  rawValue: null,
  normalizedValue: null,
  criticality: 'critical',
  confidence: { ocr: null, field_match: null, normalization: null, source_match: null, final: 0 },
  source: 'ai_vision',
  reviewRequired: false,
  reviewReasons: [],
  evidence: [],
  ...p,
})

// --- realistic fixture ------------------------------------------------------

/** Passport: MRZ-validated DOB + Ukrainian printed name (raw Cyrillic Сергій). */
function passport(): PerDocFields {
  return {
    docId: 'doc_passport',
    docType: 'ua_international_passport',
    fields: [
      field({ key: 'date_of_birth', normalizedValue: '1986-06-25', source: 'mrz', reviewRequired: false }),
      field({ key: 'given_name', normalizedValue: 'SERHII', source: 'mrz', rawCyrillic: 'Сергій', reviewRequired: false }),
    ],
  }
}

/** Birth-cert: DOB held for review (faded handwriting), Russian name Сергей. */
function birthCert(): PerDocFields {
  return {
    docId: 'doc_birthcert',
    docType: 'ua_birth_certificate',
    fields: [
      field({
        key: 'date_of_birth',
        normalizedValue: null,
        rawValue: null,
        source: 'ai_vision',
        reviewRequired: true,
        reviewReasons: ['handwritten_blanket', 'low_confidence'],
      }),
      field({
        key: 'given_name',
        normalizedValue: 'SERGEY',
        source: 'ai_vision',
        rawCyrillic: 'Сергей',
        reviewRequired: false, // confidently read on the cert
      }),
    ],
  }
}

describe('cross-doc reconcile — the biggest lever', () => {
  it('passport MRZ DOB resolves the held birth-cert DOB (one-click pre-fill, review kept)', () => {
    const { docs, changes } = reconcileAcrossDocuments([passport(), birthCert()], true)

    const certDob = docs.find(d => d.docId === 'doc_birthcert')!.fields.find(f => f.key === 'date_of_birth')!
    expect(certDob.suggestedValue).toBe('1986-06-25')
    expect(certDob.knowledgeProvenance).toBe('cross_doc_reconciled')
    expect(certDob.reviewRequired).toBe(true) // L6 — still held, human confirms
    expect(certDob.reviewReasons).toContain('cross_doc_reconciled')
    // NEVER auto-applied into the released value path.
    expect(certDob.normalizedValue).toBeNull()
    expect(certDob.finalValue).toBeUndefined()

    expect(changes).toContainEqual(expect.objectContaining({
      docId: 'doc_birthcert',
      fieldKey: 'date_of_birth',
      suggestedValue: '1986-06-25',
      fromDocId: 'doc_passport',
      fromStrength: 'mrz_validated',
      toStrength: 'handwritten_uncertain',
    }))
  })

  it('NEVER overwrites a confidently-read field (passport DOB untouched)', () => {
    const { docs } = reconcileAcrossDocuments([passport(), birthCert()], true)
    const passDob = docs.find(d => d.docId === 'doc_passport')!.fields.find(f => f.key === 'date_of_birth')!
    expect(passDob.suggestedValue).toBeUndefined()
    expect(passDob.normalizedValue).toBe('1986-06-25')
    expect(passDob.knowledgeProvenance).toBeUndefined()
  })

  it('NAME-SCRIPT GUARD (L8): Ukrainian passport name does NOT overwrite Russian birth-cert name', () => {
    const { docs, changes } = reconcileAcrossDocuments([passport(), birthCert()], true)
    const certName = docs.find(d => d.docId === 'doc_birthcert')!.fields.find(f => f.key === 'given_name')!
    // Сергей stays Сергей — no Serhii pushed across the RU/UA boundary.
    expect(certName.normalizedValue).toBe('SERGEY')
    expect(certName.suggestedValue).toBeUndefined()
    expect(certName.knowledgeProvenance).toBeUndefined()
    expect(changes.find(c => c.fieldKey === 'given_name')).toBeUndefined()
  })

  it('flag OFF → byte-identical pass-through, zero changes', () => {
    const input = [passport(), birthCert()]
    const { docs, changes } = reconcileAcrossDocuments(input, false)
    expect(changes).toHaveLength(0)
    expect(docs).toBe(input) // same reference — no copy, no mutation
    const certDob = docs[1].fields.find(f => f.key === 'date_of_birth')!
    expect(certDob.suggestedValue).toBeUndefined()
  })

  it('does NOT manufacture a value when no doc produced an anchor (all held)', () => {
    const a: PerDocFields = {
      docId: 'a', docType: 'ua_birth_certificate',
      fields: [field({ key: 'date_of_birth', reviewRequired: true, reviewReasons: ['low_confidence'] })],
    }
    const b: PerDocFields = {
      docId: 'b', docType: 'ua_military_id',
      fields: [field({ key: 'date_of_birth', reviewRequired: true, reviewReasons: ['low_confidence'] })],
    }
    const { changes, docs } = reconcileAcrossDocuments([a, b], true)
    expect(changes).toHaveLength(0)
    expect(docs[0].fields[0].suggestedValue).toBeUndefined()
  })

  it('reconciles a same-script (UA→UA) held name from a stronger anchor', () => {
    const passUa: PerDocFields = {
      docId: 'p', docType: 'ua_international_passport',
      fields: [field({ key: 'given_name', normalizedValue: 'SERHII', source: 'mrz', rawCyrillic: 'Сергій', reviewRequired: false })],
    }
    const militaryUa: PerDocFields = {
      docId: 'm', docType: 'ua_military_id',
      fields: [field({ key: 'given_name', rawCyrillic: 'Сергій', source: 'ai_vision', reviewRequired: true, reviewReasons: ['low_confidence'] })],
    }
    const { docs, changes } = reconcileAcrossDocuments([passUa, militaryUa], true)
    const milName = docs[1].fields[0]
    expect(milName.suggestedValue).toBe('SERHII')
    expect(milName.reviewRequired).toBe(true)
    expect(changes).toHaveLength(1)
  })
})

describe('classifyStrength', () => {
  it('valid MRZ (not review) → mrz_validated', () => {
    expect(classifyStrength(field({ key: 'date_of_birth', source: 'mrz', normalizedValue: '1986-06-25', reviewRequired: false }))).toBe('mrz_validated')
  })
  it('held/review field → handwritten_uncertain (can never be an anchor)', () => {
    expect(classifyStrength(field({ key: 'date_of_birth', reviewRequired: true }))).toBe('handwritten_uncertain')
  })
  it('gazetteer_exact provenance → dictionary_exact', () => {
    expect(classifyStrength(field({ key: 'place_of_birth', normalizedValue: 'Vinnytsia Oblast', knowledgeProvenance: 'gazetteer_exact', reviewRequired: false }))).toBe('dictionary_exact')
  })
  it('strictly-stronger ordering holds', () => {
    expect(ANCHOR_STRENGTH.mrz_validated).toBeGreaterThan(ANCHOR_STRENGTH.printed)
    expect(ANCHOR_STRENGTH.printed).toBeGreaterThan(ANCHOR_STRENGTH.dictionary_exact)
    expect(ANCHOR_STRENGTH.dictionary_exact).toBeGreaterThan(ANCHOR_STRENGTH.consensus)
    expect(ANCHOR_STRENGTH.consensus).toBeGreaterThan(ANCHOR_STRENGTH.handwritten_uncertain)
  })
})

describe('sameNameScript guard', () => {
  it('UA vs RU → false (no cross-push)', () => {
    expect(sameNameScript('Сергій', 'Сергей')).toBe(false)
  })
  it('UA vs UA → true', () => {
    expect(sameNameScript('Сергій', 'Сергій')).toBe(true)
  })
  it('unknown (no distinctive letter) → false (review, never guess)', () => {
    expect(sameNameScript('Иван', 'Иван')).toBe(false) // no ru-only/ua-only letter
  })
  it('missing raw cyrillic → false', () => {
    expect(sameNameScript(null, 'Сергій')).toBe(false)
  })
})
