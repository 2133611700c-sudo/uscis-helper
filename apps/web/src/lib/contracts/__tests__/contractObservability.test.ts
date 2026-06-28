/**
 * Workstream H — observability is PII-free by construction.
 */
import { describe, it, expect } from 'vitest'
import { emitContractEvent, sanitizeContractEvent } from '../contractObservability'

describe('Workstream H — PII-free observability', () => {
  it('strips any key not on the allow-list (no name/DOB/cert/raw-text leak)', () => {
    const dirty = {
      event: 'final_pdf_blocked', docType: 'ua_birth_certificate', fieldKey: 'child_family_name',
      state: 'unconfirmed_critical', errorCategory: 'review_required', modelId: 'gemini-2.5-pro',
      schemaVersion: 'v1', latencyMs: 12, correlationId: 'abc',
      // forbidden — must be stripped:
      name: "Солов'як", dob: '1990-01-15', certificate_number: 'II-BK 530174',
      raw_value: "Солов'як", normalized_value: 'Soloviak', ocr_text: 'lots of text', image: '<bytes>',
    }
    const safe = sanitizeContractEvent(dirty)
    for (const banned of ['name', 'dob', 'certificate_number', 'raw_value', 'normalized_value', 'ocr_text', 'image']) {
      expect((safe as Record<string, unknown>)[banned]).toBeUndefined()
    }
    expect(safe.event).toBe('final_pdf_blocked')
    expect(safe.fieldKey).toBe('child_family_name') // a KEY, not a value — allowed
  })

  it('emitted line contains no forbidden values', () => {
    let line = ''
    emitContractEvent(
      { event: 'final_pdf_generated', docType: 'ua_birth_certificate', schemaVersion: 'v1', latencyMs: 9, correlationId: 'cid' } as never,
      (l) => { line = l },
    )
    expect(line).toContain('[contract_event]')
    expect(line).not.toMatch(/Солов|Ivanenko|530174|1990-01-15/)
  })

  it('provider_model_mismatch carries only model ids (non-PII)', () => {
    const safe = sanitizeContractEvent({ event: 'provider_model_mismatch', modelId: 'gemini-2.5-flash', state: 'fallback_used' })
    expect(safe.modelId).toBe('gemini-2.5-flash')
    expect(Object.keys(safe).sort()).toEqual(['event', 'modelId', 'state'])
  })
})
