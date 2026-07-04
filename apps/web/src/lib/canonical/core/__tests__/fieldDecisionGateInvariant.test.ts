/**
 * ONE-BRAIN v2 Phase 1b — CROSS-PLANE INVARIANT: the Decision Engine's verdict cannot be
 * bypassed by the gates. For every decision the engine can produce (driven through the REAL
 * decideField on a matrix of fields × contexts):
 *   reject (finalValue=null) ⟹ reviewGate counts the field UNRESOLVED
 *                            ⟹ finalPdfGate (enforced) does NOT see it releasable/ready.
 *   engine reviewRequired    ⟹ the projected gate field is review_required (monotonic).
 * The projection (fieldDecisionGateAdapter) never asserts confirmation and never lowers review.
 * FICTIONAL data only.
 */
import { describe, it, expect } from 'vitest'
import { decideField } from '../decisionEngine'
import type { SafeField, SafetyContext } from '@/lib/documentSafety/applyOcrFieldSafety'
import { fieldDecisionToReviewGateField, fieldDecisionToFinalPdfField } from '../fieldDecisionGateAdapter'
import { getUnresolvedReviewFields } from '@/lib/translation/reviewGate'
import { assertDocumentReadyForFinalPdf } from '@/lib/contracts/finalPdfGate'

const FIELDS: SafeField[] = [
  { field: 'family_name', value: 'Testenko', raw_cyrillic: 'Тестенко', confidence: 0.95, review_required: false },
  { field: 'family_name', value: 'Testenko', raw_cyrillic: 'Тестенко', confidence: 0.2, review_required: true },
  { field: 'passport_number', value: 'AB123456', confidence: 0.99, review_required: false },
  { field: 'dob', value: '1990-01-01', confidence: 0.3, review_required: true },
  { field: 'mother_full_name', value: null, raw_cyrillic: 'Тестова Марія', confidence: 0.2, review_required: true },
  { field: 'notes', value: 'x', confidence: 0.5, review_required: false },
]
const CONTEXTS: SafetyContext[] = [
  { flow: 'translation_public', document_class: 'birth_certificate', hard_case: true },
  { flow: 'translation_public', document_class: 'passport', strong_source_anchor: true },
  { flow: 'tps_legacy', document_class: null, hard_case: true, legacy_reader: true },
]

describe('cross-plane invariant — engine verdict flows through the gates un-bypassable', () => {
  for (const [ci, ctx] of CONTEXTS.entries()) {
    for (const [fi, f] of FIELDS.entries()) {
      it(`ctx#${ci} field#${fi} (${f.field}): reject⟹unresolved+blocked; review⟹review`, () => {
        const d = decideField({ ...f }, ctx, {})
        const gateField = fieldDecisionToReviewGateField(d)
        const pdfField = fieldDecisionToFinalPdfField(d)

        // projection is monotonic: engine review or reject always survives to the gate shape
        if (d.reviewRequired || d.status === 'reject') {
          expect(gateField.review_required).toBe(true)
          expect(pdfField.review_required).toBe(true)
        }
        // projection never asserts human confirmation
        expect(pdfField.confirmed).toBe(false)

        if (d.status === 'reject') {
          // reviewGate: a rejected field is ALWAYS unresolved (empty normalized_value)
          expect(getUnresolvedReviewFields([gateField])).toContain(d.field)
          // finalPdfGate (enforced): the rejected field can never be part of a ready doc
          const res = assertDocumentReadyForFinalPdf(
            [pdfField], 'birth_certificate', { FINAL_PDF_CONFIRMATION_GATE_ENABLED: '1' },
          )
          expect(res.ready).toBe(false)
        }

        if (d.status === 'accept' && d.finalValue) {
          // an accepted value is NOT unresolved unless the engine ALSO said review
          const unresolved = getUnresolvedReviewFields([gateField])
          if (!d.reviewRequired) expect(unresolved).not.toContain(d.field)
          else expect(unresolved).toContain(d.field) // review sticks — monotonic
        }
      })
    }
  }

  it('sanity: the matrix actually exercises BOTH engine outcomes (accept and reject)', () => {
    const statuses = new Set(
      CONTEXTS.flatMap((ctx) => FIELDS.map((f) => decideField({ ...f }, ctx, {}).status)),
    )
    expect(statuses.has('accept')).toBe(true)
    expect(statuses.has('reject')).toBe(true)
  })
})
