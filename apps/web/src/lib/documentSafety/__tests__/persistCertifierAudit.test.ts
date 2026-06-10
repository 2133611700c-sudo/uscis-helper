/**
 * persistCertifierAudit.test.ts — the pure row-builder that mirrors the DB's 5 CHECK
 * constraints (defense-in-depth: never attempt an insert the DB would reject). Synthetic.
 */
import { describe, it, expect } from 'vitest'
import { buildAuditRow, isCertifierAuditPersistEnabled } from '../persistCertifierAudit'
import type { CertifierAuditRecord } from '../certifierAuthority'

const OWNER = '123e4567-e89b-12d3-a456-426614174000'
const rec = (over: Partial<CertifierAuditRecord> = {}): CertifierAuditRecord => ({
  reason_code: 'source_verified', tier: 1, field_name: 'given_name', document_class: 'internal_passport_booklet',
  previous_value_hash: 'a'.repeat(64), new_value_hash: 'b'.repeat(64), certifier_id: 'owner',
  timestamp_utc: '2026-06-10T20:00:00.000Z', session_id: 'sess-1', linked_pdf_doc_id: null, cross_doc_anchor_id: null,
  decision: 'finalize', immutable_marker: 'c'.repeat(64), ...over,
})

describe('flag gate', () => {
  it('OFF by default', () => {
    expect(isCertifierAuditPersistEnabled({})).toBe(false)
    expect(isCertifierAuditPersistEnabled({ CERTIFIER_AUDIT_PERSIST_ENABLED: '1' })).toBe(true)
  })
})

describe('buildAuditRow — constraint defense-in-depth', () => {
  it('a clean finalize maps to a valid row', () => {
    const r = buildAuditRow(rec(), { ownerCertifierId: OWNER })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.row.certifier_id).toBe(OWNER)
      expect(r.row.doc_type).toBe('internal_passport_booklet')
      expect(r.row.immutable_signature).toBe('c'.repeat(64))
      expect(r.row.new_value_sha256).toBe('b'.repeat(64))
    }
  })

  it('skips user_confirmed (not a certifier reason code)', () => {
    const r = buildAuditRow(rec({ reason_code: 'user_confirmed' as never }), { ownerCertifierId: OWNER })
    expect(r).toEqual({ ok: false, reason: 'not_a_certifier_reason_code' })
  })

  it('skips a non-acted override (block/reject)', () => {
    const r = buildAuditRow(rec({ decision: 'block_escalate' }), { ownerCertifierId: OWNER })
    expect(r).toEqual({ ok: false, reason: 'not_an_acted_override' })
  })

  it('constraint 4: unreadable_per_source MUST have null new hash', () => {
    expect(buildAuditRow(rec({ reason_code: 'unreadable_per_source', decision: 'refused_null', new_value_hash: null }), { ownerCertifierId: OWNER }).ok).toBe(true)
    // a non-null new hash on a refusal is rejected
    expect(buildAuditRow(rec({ reason_code: 'unreadable_per_source', decision: 'refused_null' }), { ownerCertifierId: OWNER }))
      .toEqual({ ok: false, reason: 'refusal_must_have_null_new_value' })
    // a non-refusal with null new hash is rejected
    expect(buildAuditRow(rec({ new_value_hash: null }), { ownerCertifierId: OWNER }))
      .toEqual({ ok: false, reason: 'non_refusal_needs_new_value' })
  })

  it('constraint 3: other_with_text needs a note', () => {
    expect(buildAuditRow(rec({ reason_code: 'other_with_text' }), { ownerCertifierId: OWNER }).ok).toBe(false)
    expect(buildAuditRow(rec({ reason_code: 'other_with_text' }), { ownerCertifierId: OWNER, note: 'torn' }).ok).toBe(true)
  })

  it('constraint 5: user_clarified is tier-3 only', () => {
    expect(buildAuditRow(rec({ reason_code: 'user_clarified', tier: 1 }), { ownerCertifierId: OWNER }))
      .toEqual({ ok: false, reason: 'user_clarified_tier3_only' })
    expect(buildAuditRow(rec({ reason_code: 'user_clarified', tier: 3 }), { ownerCertifierId: OWNER }).ok).toBe(true)
  })

  it('requires an owner certifier uuid (certifier_id is NOT NULL uuid)', () => {
    expect(buildAuditRow(rec(), { ownerCertifierId: null })).toEqual({ ok: false, reason: 'missing_owner_certifier_uuid' })
    expect(buildAuditRow(rec(), { ownerCertifierId: 'owner' })).toEqual({ ok: false, reason: 'missing_owner_certifier_uuid' })
  })

  it('coerces non-uuid session/pdf/anchor ids to null (uuid columns)', () => {
    const r = buildAuditRow(rec({ session_id: 'legacy', cross_doc_anchor_id: 'case-1' }), { ownerCertifierId: OWNER })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.row.session_id).toBeNull()
      expect(r.row.cross_doc_anchor_id).toBeNull()
    }
  })
})
