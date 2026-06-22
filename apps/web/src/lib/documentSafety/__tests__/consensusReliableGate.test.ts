/**
 * consensusReliableGate.test.ts — auto-delivery calibration: a cross-read-consensus
 * field overrides the SOFT C3 conditions (hard_case/no_anchor/low_conf) so a verifiably
 * stable critical field on a handwritten birth cert can accept_final instead of being
 * parked candidate_only. HARD conditions (mismatch/stale/unknown) still block.
 */
import { describe, it, expect } from 'vitest'
import { protectOcrField } from '@/lib/documentSafety/ocrFieldSafetyGate'

const base = {
  flow: 'translation_public' as const,
  field_name: 'family_name',
  criticality: 'critical_identity' as const,
  document_class: 'birth_certificate_handwritten',
  value_present: true,
  candidate_value_present: true,
  confidence: 0.96,
}

describe('C3 consensus_reliable calibration', () => {
  it('WITHOUT consensus: hard-case critical → candidate_only (unchanged safe default)', () => {
    const r = protectOcrField({ ...base })
    expect(r.decision).toBe('candidate_only')
    expect(r.final_value_allowed).toBe(false)
  })
  it('WITH consensus_reliable: hard-case critical → accept_final (auto-deliver)', () => {
    const r = protectOcrField({ ...base, consensus_reliable: true })
    expect(r.decision).toBe('accept_final')
    expect(r.final_value_allowed).toBe(true)
    expect(r.review_required).toBe(false)
  })
  it('consensus does NOT override a HARD condition (doc-type mismatch still blocks)', () => {
    const r = protectOcrField({ ...base, consensus_reliable: true, source_doc_type: 'passport', expected_source_doc_type: 'birth_certificate' })
    expect(r.decision).not.toBe('accept_final')
  })
  it('consensus does NOT override zero recognition', () => {
    const r = protectOcrField({ ...base, consensus_reliable: true, value_present: false, zero_usable_recognition: true })
    expect(r.decision).not.toBe('accept_final')
  })
})
