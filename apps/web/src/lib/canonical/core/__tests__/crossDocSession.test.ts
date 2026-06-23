/**
 * crossDocSession.test.ts — SESSION-level wiring for cross-doc reconciliation.
 * Proves: (1) the adapter keeps ONE PerDoc per doc_type (latest createdAt wins);
 * (2) the orchestrator runs reconcileAcrossDocuments end-to-end from CanonicalDocumentResult[]
 * — a passport MRZ DOB fills a sibling birth-cert's held DOB; (3) flag OFF ⇒ zero changes
 * (byte-identical); (4) RU/UA name script guard (L8) survives the session path.
 */
import { describe, it, expect } from 'vitest'
import { canonicalDocsToPerDocFields, reconcileSessionDocuments } from '../crossDocSession'
import type { CanonicalDocumentResult, CanonicalField } from '../../types'

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

const doc = (p: Partial<CanonicalDocumentResult> & { docType: string; fields: CanonicalField[] }): CanonicalDocumentResult => ({
  documentSessionId: '',
  product: 'tps',
  hashes: { uploadHash: null, normalizedImageHash: null, canonicalResultHash: null },
  createdAt: '2026-06-22T00:00:00Z',
  requiresReview: p.fields.some((f) => f.reviewRequired),
  ...p,
})

/** Passport: MRZ-validated DOB + Ukrainian printed name (raw Cyrillic Сергій). */
function passportDoc(): CanonicalDocumentResult {
  return doc({
    documentSessionId: 'd_pass',
    docType: 'ua_international_passport',
    createdAt: '2026-06-22T10:00:00Z',
    fields: [
      field({ key: 'date_of_birth', normalizedValue: '1986-06-25', source: 'mrz', reviewRequired: false }),
      field({ key: 'given_name', normalizedValue: 'SERHII', source: 'mrz', rawCyrillic: 'Сергій', reviewRequired: false }),
    ],
  })
}

/** Soviet birth-cert: DOB held-for-review (uncertain handwriting) + Russian name (Сергей). */
function birthCertDoc(): CanonicalDocumentResult {
  return doc({
    documentSessionId: 'd_birth',
    docType: 'ua_birth_certificate',
    createdAt: '2026-06-22T10:05:00Z',
    fields: [
      field({ key: 'date_of_birth', normalizedValue: null, reviewRequired: true, reviewReasons: ['handwritten_uncertain'] }),
      field({ key: 'given_name', normalizedValue: 'Sergey', rawCyrillic: 'Сергей', reviewRequired: false }),
    ],
  })
}

describe('canonicalDocsToPerDocFields', () => {
  it('keeps one PerDoc per doc_type, latest createdAt wins', () => {
    const older = doc({ docType: 'ua_birth_certificate', createdAt: '2026-06-22T09:00:00Z', fields: [field({ key: 'sex', normalizedValue: 'F' })] })
    const newer = doc({ docType: 'ua_birth_certificate', createdAt: '2026-06-22T11:00:00Z', fields: [field({ key: 'sex', normalizedValue: 'M' })] })
    const out = canonicalDocsToPerDocFields([older, newer])
    expect(out).toHaveLength(1)
    expect(out[0].fields[0].normalizedValue).toBe('M') // newer wins
  })

  it('uses docType as docId when documentSessionId is empty', () => {
    const out = canonicalDocsToPerDocFields([doc({ docType: 'ua_military_id', fields: [field({ key: 'sex' })] })])
    expect(out[0].docId).toBe('ua_military_id')
  })
})

describe('reconcileSessionDocuments', () => {
  it('passport MRZ DOB fills the sibling birth-cert held DOB (suggestedValue, review kept)', () => {
    const { perDoc, changes } = reconcileSessionDocuments([passportDoc(), birthCertDoc()], true)
    const birth = perDoc.find((d) => d.docType === 'ua_birth_certificate')!
    const dob = birth.fields.find((f) => f.key === 'date_of_birth')!
    expect(dob.suggestedValue).toBe('1986-06-25')
    expect(dob.knowledgeProvenance).toBe('cross_doc_reconciled')
    expect(dob.reviewRequired).toBe(true) // L6: still a one-click confirm, not auto-applied
    expect(changes.some((c) => c.fieldKey === 'date_of_birth' && c.fromDocType === 'ua_international_passport')).toBe(true)
  })

  it('does NOT push the Ukrainian passport name onto the Russian birth-cert name (L8 script guard)', () => {
    const { perDoc } = reconcileSessionDocuments([passportDoc(), birthCertDoc()], true)
    const birth = perDoc.find((d) => d.docType === 'ua_birth_certificate')!
    const given = birth.fields.find((f) => f.key === 'given_name')!
    expect(given.suggestedValue).toBeUndefined() // Сергей stays Сергей; never harmonized to Сергій
    expect(given.normalizedValue).toBe('Sergey')
  })

  it('flag OFF ⇒ zero changes, byte-identical pass-through', () => {
    const { perDoc, changes } = reconcileSessionDocuments([passportDoc(), birthCertDoc()], false)
    expect(changes).toHaveLength(0)
    const birth = perDoc.find((d) => d.docType === 'ua_birth_certificate')!
    expect(birth.fields.find((f) => f.key === 'date_of_birth')!.suggestedValue).toBeUndefined()
  })

  it('single document ⇒ no reconciliation', () => {
    const { changes } = reconcileSessionDocuments([passportDoc()], true)
    expect(changes).toHaveLength(0)
  })
})
