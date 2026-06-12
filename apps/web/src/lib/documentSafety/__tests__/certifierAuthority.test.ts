/**
 * certifierAuthority.test.ts — L0 authorization primitive (ADR-021 + LAW 2#5).
 *
 * TDD anchor (the most important Q2 constraint): user_clarified is TIER-3 only;
 * using it on a TIER-1 field MUST be rejected. Plus full tier×reason matrix,
 * anchor-conflict block, documented-refusal, and PII-free audit hashing.
 * Synthetic example values only (privacy LAW 5).
 */
import { describe, it, expect } from 'vitest'
import {
  fieldTier,
  isReasonValidForTier,
  evaluateCertifierOverride,
  buildCertifierAuditRecord,
} from '../certifierAuthority'

describe('TDD anchor — user_clarified rejected on a TIER 1 field', () => {
  it('child_given_name (birth cert) is TIER 1, and user_clarified there is reject_invalid', () => {
    expect(fieldTier('ua_birth_certificate', 'child_given_name')).toBe(1)
    const r = evaluateCertifierOverride({
      docType: 'ua_birth_certificate',
      field: 'child_given_name',
      proposedValue: 'Ivan',
      authority: 'user_clarified',
    })
    expect(r.decision).toBe('reject_invalid')
    expect(r.finalValue).toBeNull()
    expect(r.reasons).toContain('reason_user_clarified_invalid_for_tier_1')
  })
})

describe('Q1 — (docType, field) → TIER matrix', () => {
  it('applicant identity fields are TIER 1', () => {
    expect(fieldTier('ua_birth_certificate', 'dob')).toBe(1)
    expect(fieldTier('ua_international_passport', 'passport_number')).toBe(1)
    expect(fieldTier('us_ead', 'a_number')).toBe(1)
  })
  it('related-person + document-validity fields are TIER 2', () => {
    expect(fieldTier('ua_birth_certificate', 'father_full_name')).toBe(2)
    expect(fieldTier('ua_birth_certificate', 'mother_full_name')).toBe(2)
    expect(fieldTier('ua_birth_certificate', 'issuing_authority')).toBe(2)
    expect(fieldTier('ua_marriage_certificate', 'act_record_number')).toBe(2)
  })
  it('unmapped fields fall back to substring criticality mapped to a tier (never under-protect)', () => {
    // a clearly non-critical/unknown field → TIER 3
    expect(fieldTier('ua_birth_certificate', 'remarks')).toBe(3)
    // an identity-looking field on an unmapped docType still resolves critical → TIER 1
    expect(fieldTier('some_unknown_doc', 'surname')).toBe(1)
  })
})

describe('Q2 ADDITION A — tier × reason_code validity matrix', () => {
  it('user_clarified valid ONLY on TIER 3', () => {
    expect(isReasonValidForTier('user_clarified', 1)).toBe(false)
    expect(isReasonValidForTier('user_clarified', 2)).toBe(false)
    expect(isReasonValidForTier('user_clarified', 3)).toBe(true)
  })
  it('source_verified + source_corroborated_user_value valid on all tiers', () => {
    for (const t of [1, 2, 3] as const) {
      expect(isReasonValidForTier('source_verified', t)).toBe(true)
      expect(isReasonValidForTier('source_corroborated_user_value', t)).toBe(true)
    }
  })
})

describe('LAW 2#5 — evaluate override decisions', () => {
  it('TIER 1 source_verified → finalize', () => {
    const r = evaluateCertifierOverride({
      docType: 'ua_international_passport', field: 'given_name', proposedValue: 'Ivan', authority: 'source_verified',
    })
    expect(r.decision).toBe('finalize')
    expect(r.finalValue).toBe('Ivan')
  })

  it('TIER 1 user_confirmed alone → reject (needs certifier_override)', () => {
    const r = evaluateCertifierOverride({
      docType: 'ua_international_passport', field: 'surname', proposedValue: 'Ivanenko', authority: 'user_confirmed',
    })
    expect(r.decision).toBe('reject_invalid')
    expect(r.reasons).toContain('user_confirmed_requires_certifier_override_on_critical')
  })

  it('TIER 3 user_confirmed → finalize (user self-path)', () => {
    const r = evaluateCertifierOverride({
      docType: 'ua_birth_certificate', field: 'remarks', proposedValue: 'note', authority: 'user_confirmed',
    })
    expect(r.decision).toBe('finalize')
    expect(r.finalValue).toBe('note')
  })

  it('cross-document anchor conflict on a critical field → block_escalate, never override', () => {
    const r = evaluateCertifierOverride({
      docType: 'ua_international_passport', field: 'given_name',
      proposedValue: 'Oleksandr',          // user/certifier typed this
      authority: 'source_verified',
      anchorValue: 'Ivan',               // passport MRZ says this
    })
    expect(r.decision).toBe('block_escalate')
    expect(r.finalValue).toBeNull()
    expect(r.reasons).toContain('anchor_conflict')
  })

  it('anchor AGREEMENT on a critical field → allowed to finalize', () => {
    const r = evaluateCertifierOverride({
      docType: 'ua_international_passport', field: 'given_name',
      proposedValue: 'Ivan', authority: 'source_verified', anchorValue: 'Ivan',
    })
    expect(r.decision).toBe('finalize')
  })

  it('unreadable_per_source → refused_null (documented refusal, never finalizes)', () => {
    const r = evaluateCertifierOverride({
      docType: 'ua_birth_certificate', field: 'dob', proposedValue: '1990-05-14', authority: 'unreadable_per_source',
    })
    expect(r.decision).toBe('refused_null')
    expect(r.finalValue).toBeNull()
  })

  it('dual_witness is post-launch only → reject pre-launch', () => {
    const r = evaluateCertifierOverride({
      docType: 'ua_birth_certificate', field: 'dob', proposedValue: '1990-05-14', authority: 'dual_witness',
    })
    expect(r.decision).toBe('reject_invalid')
    expect(r.reasons).toContain('dual_witness_post_launch_only')
  })

  it('other_with_text requires a note; with a note it finalizes and is flagged for audit', () => {
    const noNote = evaluateCertifierOverride({
      docType: 'ua_birth_certificate', field: 'father_full_name', proposedValue: 'Ivan Ivanenko', authority: 'other_with_text',
    })
    expect(noNote.decision).toBe('reject_invalid')
    const withNote = evaluateCertifierOverride({
      docType: 'ua_birth_certificate', field: 'father_full_name', proposedValue: 'Ivan Ivanenko',
      authority: 'other_with_text', note: 'partially torn; cross-checked against marriage cert',
    })
    expect(withNote.decision).toBe('finalize')
    expect(withNote.flaggedForAuditReview).toBe(true)
  })
})

describe('audit hook — ADR-021 schema, PII-free (values hashed, LAW 5)', () => {
  it('record has all required fields and NEVER stores raw values', () => {
    const rec = buildCertifierAuditRecord({
      authority: 'source_verified', tier: 1, field: 'given_name', documentClass: 'internal_passport_booklet',
      previousValue: 'Иван', newValue: 'Ivan', certifierId: 'owner', timestampUtc: '2026-06-10T20:00:00.000Z',
      sessionId: 'sess-1', linkedPdfDocId: 'pdf-1', crossDocAnchorId: 'case-1', decision: 'finalize',
    })
    // all ADR-021 fields present
    for (const k of ['reason_code','tier','field_name','document_class','previous_value_hash','new_value_hash',
      'certifier_id','timestamp_utc','session_id','linked_pdf_doc_id','cross_doc_anchor_id','decision','immutable_marker']) {
      expect(rec).toHaveProperty(k)
    }
    // raw values must NOT appear anywhere in the serialized record
    const json = JSON.stringify(rec)
    expect(json).not.toContain('Иван')
    expect(json).not.toContain('Ivan')
    // hashes are 64-hex sha256
    expect(rec.previous_value_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(rec.new_value_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(rec.immutable_marker).toMatch(/^[a-f0-9]{64}$/)
  })

  it('immutable_marker changes if any field changes (tamper-evident)', () => {
    const base = {
      authority: 'source_verified' as const, tier: 1 as const, field: 'given_name', documentClass: 'passport',
      previousValue: null, newValue: 'Ivan', certifierId: 'owner', timestampUtc: '2026-06-10T20:00:00.000Z',
      sessionId: 's', decision: 'finalize' as const,
    }
    const a = buildCertifierAuditRecord(base)
    const b = buildCertifierAuditRecord({ ...base, newValue: 'Oleksandr' })
    expect(a.immutable_marker).not.toBe(b.immutable_marker)
  })
})
