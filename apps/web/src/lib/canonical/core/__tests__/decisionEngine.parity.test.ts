/**
 * decisionEngine ≡ applyOcrFieldSafety — BYTE-PARITY (One-Brain v2, Phase 1).
 *
 * The engine is a mechanical lift of the live C3 branch; this test freezes that claim:
 * for a matrix of field kinds × safety contexts × options, `decideFields` must produce
 * EXACTLY the same output fields and the same anyUnresolvedCritical as the legacy
 * `applyOcrFieldSafety`. Any drift = the engine is no longer the live logic → fail.
 * FICTIONAL data only.
 */
import { describe, it, expect } from 'vitest'
import { applyOcrFieldSafety, type SafeField, type SafetyContext } from '@/lib/documentSafety/applyOcrFieldSafety'
import { decideFields, decideField, isDecisionShadowEnabled } from '../decisionEngine'

const FIELDS: SafeField[] = [
  // identity-critical, clean high-confidence
  { field: 'family_name', value: 'Testenko', raw_cyrillic: 'Тестенко', confidence: 0.95, review_required: false },
  // identity-critical, reader-flagged review
  { field: 'given_name', value: 'Ivan', raw_cyrillic: 'Іван', confidence: 0.4, review_required: true },
  // identity-critical with normalizedValue (release value preference)
  { field: 'patronymic', value: 'Petrovych', raw_cyrillic: 'Петрович', confidence: 0.9, review_required: false, normalizedValue: 'Petrovych-N' } as SafeField,
  // document-critical
  { field: 'passport_number', value: 'AB123456', confidence: 0.99, review_required: false },
  // admin
  { field: 'address', value: '1 Test St', confidence: 0.8, review_required: false },
  // optional / unknown
  { field: 'notes', value: 'x', confidence: 0.5, review_required: false },
  // empty value with cyrillic candidate
  { field: 'mother_full_name', value: null, raw_cyrillic: 'Тестова Марія', confidence: 0.2, review_required: true },
  // consensus-validated critical
  { field: 'dob', value: '1990-01-01', confidence: 0.97, review_required: false, consensus_reliable: true },
]

const CONTEXTS: SafetyContext[] = [
  { flow: 'translation_public', document_class: 'birth_certificate', hard_case: true, legacy_reader: false, strong_source_anchor: false },
  { flow: 'translation_session', document_class: 'passport', hard_case: false, legacy_reader: false, strong_source_anchor: true },
  { flow: 'tps_core', document_class: 'passport', hard_case: false, legacy_reader: true, strong_source_anchor: false },
  { flow: 'tps_legacy', document_class: null, source_doc_type: 'x', expected_source_doc_type: 'y', hard_case: true, legacy_reader: true },
]

const OPTS = [
  {},
  { zeroRecognition: true },
  { anchorResolver: (f: SafeField) => f.field === 'dob' || f.field === 'passport_number' },
]

describe('decisionEngine ≡ applyOcrFieldSafety (byte parity)', () => {
  for (const [ci, ctx] of CONTEXTS.entries()) {
    for (const [oi, opts] of OPTS.entries()) {
      it(`ctx#${ci} opts#${oi}: identical fields + anyUnresolvedCritical`, () => {
        const legacy = applyOcrFieldSafety(FIELDS.map((f) => ({ ...f })), ctx, opts)
        const engine = decideFields(FIELDS.map((f) => ({ ...f })), ctx, opts)
        expect(engine.fields).toEqual(legacy.fields)
        expect(engine.anyUnresolvedCritical).toBe(legacy.anyUnresolvedCritical)
      })
    }
  }

  it('decideField is pure — input field is not mutated', () => {
    const f: SafeField = { field: 'family_name', value: 'Testenko', confidence: 0.1, review_required: false }
    const snapshot = JSON.parse(JSON.stringify(f))
    decideField(f, CONTEXTS[0], {})
    expect(f).toEqual(snapshot)
  })

  it('shadow flag strict: absent/"true"/"0" → OFF, "1" → ON', () => {
    expect(isDecisionShadowEnabled({})).toBe(false)
    expect(isDecisionShadowEnabled({ ONE_BRAIN_DECISION_SHADOW: 'true' })).toBe(false)
    expect(isDecisionShadowEnabled({ ONE_BRAIN_DECISION_SHADOW: '0' })).toBe(false)
    expect(isDecisionShadowEnabled({ ONE_BRAIN_DECISION_SHADOW: '1' })).toBe(true)
  })
})
