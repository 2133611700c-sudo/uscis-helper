/**
 * i765DocumentBoundary (EAD) — the EAD document/application BOUNDARY for I-765.
 *
 * GAP-3: converts the sparse, document-derived EadFieldData facts into a minimal
 * CanonicalDocumentResult whose released values the shared I-765 mapper
 * (buildI765DocumentOps) transcribes verbatim.
 *
 * The EAD wizard already assumes country is normalized upstream (see
 * i765FieldMap docstring), so this boundary is a pure pass-through — NO value
 * transform. It maps the EAD gender enum ('male'/'female'/'nonbinary'/'') to the
 * canonical 'M'/'F' currency the shared mapper expects (nonbinary/'' ⇒ absent,
 * matching I-765 which only has Male/Female boxes).
 *
 * It does NOT touch user-declared / product-config fields (appType, category,
 * usAddress, Line 29) — those stay in the EAD field map at the application layer.
 */
import type { EadFieldData } from './i765FieldMap'
import type { CanonicalDocumentResult, CanonicalField } from '@/lib/canonical/types'

// U-STAGE 4 provenance fix: EadFieldData is HAND-TYPED wizard input, not an OCR
// read. Stamping source:'document_ocr' + confidence.final:1 FAKED OCR provenance,
// which would fool any confidence-/source-based gate into trusting typed values as
// document-verified. Mark it as 'manual_user_entry' (lowest authority) with no
// synthetic confidence (final:0 — typed input carries no OCR/source agreement).
// SAFE: the I-765/I-131 mappers release values via getCanonicalValue, which reads
// ONLY finalValue/normalizedValue/rawValue — never source or confidence — so the
// filled PDF is byte-identical. This change only stops the gate from being fooled.
function docField(key: string, value: string | null | undefined): CanonicalField | null {
  if (value == null || value === '') return null
  return {
    key,
    rawValue: value,
    normalizedValue: value,
    criticality: 'medium',
    confidence: { ocr: null, field_match: null, normalization: null, source_match: null, final: 0 },
    source: 'manual_user_entry',
    reviewRequired: false,
    reviewReasons: [],
    evidence: [],
  }
}

/** EAD gender enum → canonical 'M' | 'F' | '' (nonbinary/empty ⇒ absent). */
function eadGenderToSex(g: EadFieldData['gender']): string {
  if (g === 'male') return 'M'
  if (g === 'female') return 'F'
  return ''
}

export function eadDocumentFactsToCanonical(d: EadFieldData): CanonicalDocumentResult {
  const pairs: Array<[string, string | null | undefined]> = [
    ['family_name', d.lastName],
    ['given_name', d.firstName],
    ['middle_name', d.middleName],
    ['date_of_birth', d.dob],
    ['sex', eadGenderToSex(d.gender)],
    ['country_of_birth', d.countryOfBirth], // assumed already normalized upstream
    ['a_number', d.alienNumber],
  ]
  const fields = pairs
    .map(([k, v]) => docField(k, v))
    .filter((f): f is CanonicalField => f !== null)

  return {
    documentSessionId: 'ead-i765-boundary',
    product: 'ead',
    docType: 'ead_wizard',
    fields,
    hashes: { uploadHash: null, normalizedImageHash: null, canonicalResultHash: null },
    createdAt: new Date().toISOString(),
    requiresReview: false,
  }
}
