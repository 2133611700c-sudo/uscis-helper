/**
 * Workstream F (route integration, in-process) — chains the REAL contract functions
 * for the full data vertical with mocked inputs (no server, no Gemini, no Supabase):
 *
 *   mocked Gemini response
 *     → sanitizeContractExtractionResponse (boundary: candidate-only, strip forged)
 *     → applyContractSplitFlow + normalizeContractSplitFields (split + knowledge)
 *     → annotateReviewFields (review states)
 *     → assertDocumentReadyForFinalPdf (final-PDF boundary)
 *
 * Proves: forged confirmation blocked, raw→PDF bypass blocked, valid confirmed
 * canonical document allowed. Fictional data only.
 */
import { describe, it, expect } from 'vitest'
import { sanitizeContractExtractionResponse } from '../contractExtractionBoundary'
import { applyContractSplitFlow, normalizeContractSplitFields } from '../contractFieldFlow'
import { annotateReviewFields, type AnnotatedReviewRow } from '../contractReviewState'
import { assertDocumentReadyForFinalPdf, type FinalPdfField } from '../finalPdfGate'

const DOC = 'ua_birth_certificate'
const ALL_ON = {
  UNIFIED_DOC_CONTRACT_ENABLED: '1',
  UNIFIED_DOC_CONTRACT_SPLIT_ENABLED: '1',
  UNIFIED_DOC_CONTRACT_NORMALIZE_ENABLED: '1',
  FINAL_PDF_CONFIRMATION_GATE_ENABLED: '1',
} as Record<string, string | undefined>

// A deterministic mocked Gemini response (what the provider would return).
const MOCK_GEMINI = [
  { field: 'child_family_name', value: 'Soloviak', raw_cyrillic: "Солов'як", confirmed: true /* forged */ },
  { field: 'child_given_name', value: 'Andrii', raw_cyrillic: 'Андрій' },
  { field: 'child_patronymic', value: 'Bohdanovych', raw_cyrillic: 'Богданович' },
  { field: 'dob', value: '1990-01-15' },
  { field: 'certificate_series_number', value: 'II-BK 530174', raw_cyrillic: 'II-ВК 530174' },
  { field: 'issuing_authority', value: 'Lisove Registry Office, Vinnytsia Oblast', raw_cyrillic: 'Лісовий РАЦС, Вінницька область' },
  { field: 'act_record_number', value: '84' },
]

function runVertical(env: Record<string, string | undefined>) {
  // 1. boundary — strips forged confirmed, candidate-only
  const sane = sanitizeContractExtractionResponse(MOCK_GEMINI, DOC)
  // 2. → FieldOut-ish rows, split + normalize
  const fieldOut = sane.fields.map((f) => ({
    field: f.field, value: f.value, raw_cyrillic: f.raw_cyrillic,
    confidence: 1, review_required: f.review_required, kind: 'text' as const,
  }))
  const split = normalizeContractSplitFields(applyContractSplitFlow(fieldOut, DOC, env), env)
  // 3. → review annotation
  const reviewRows: AnnotatedReviewRow[] = split.map((f) => ({
    field: f.field, raw_value: f.raw_cyrillic, normalized_value: f.value,
    review_required: f.review_required, confirmed: false,
  }))
  return { sane, split, annotated: annotateReviewFields(reviewRows, env) }
}

describe('Workstream F — in-process vertical pipeline integration', () => {
  it('boundary strips the model-forged confirmed flag (candidate-only)', () => {
    const { sane } = runVertical(ALL_ON)
    expect(sane.strippedConfirmedClaims).toContain('child_family_name')
    expect(sane.fields.every((f) => f.confirmed === false)).toBe(true)
  })

  it('split fields are produced and appear as first-class review rows', () => {
    const { annotated } = runVertical(ALL_ON)
    const keys = annotated.map((r) => r.field)
    expect(keys).toContain('document_series')
    expect(keys).toContain('document_number')
    expect(annotated.find((r) => r.field === 'document_series')!.contract_review_state).toBeDefined()
  })

  it('BLOCKED: unconfirmed candidates → final-PDF gate refuses (raw/unconfirmed bypass closed)', () => {
    const { annotated } = runVertical(ALL_ON)
    const pdfFields: FinalPdfField[] = annotated.map((r) => ({
      field: r.field, raw_value: r.raw_value, normalized_value: r.normalized_value,
      review_required: r.review_required, confirmed: r.confirmed,
    }))
    const gate = assertDocumentReadyForFinalPdf(pdfFields, DOC, ALL_ON)
    expect(gate.ready).toBe(false)
    expect(gate.blockedReasons).toContain('unconfirmed_critical')
  })

  it('ALLOWED: after user confirms all critical fields → gate passes', () => {
    const { annotated } = runVertical(ALL_ON)
    const confirmed: FinalPdfField[] = annotated.map((r) => ({
      field: r.field, raw_value: r.raw_value,
      normalized_value: r.normalized_value || r.raw_value || 'x', // user supplied a value on confirm
      review_required: false, confirmed: true,
    }))
    const gate = assertDocumentReadyForFinalPdf(confirmed, DOC, ALL_ON)
    expect(gate.ready).toBe(true)
  })

  it('forged client payload (confirmed=true, empty value) → still BLOCKED', () => {
    const forged: FinalPdfField[] = [
      { field: 'child_family_name', raw_value: '', normalized_value: '', confirmed: true },
    ]
    const gate = assertDocumentReadyForFinalPdf(forged, DOC, ALL_ON)
    expect(gate.ready).toBe(false)
    expect(gate.blockedReasons).toContain('forged_confirmed_empty')
  })
})
