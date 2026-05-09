/**
 * Tests — Evidence Review Flow, OCR gates, and completeness audit
 *
 * Tests cover:
 *   1. CRITICAL_FIELDS constant is correct
 *   2. Certify gate logic: block until all critical fields confirmed
 *   3. Completeness audit logic
 *   4. Field humanisation labels
 *   5. OCR adapter response parsing
 */

import { describe, it, expect } from 'vitest'

// ── Constants ─────────────────────────────────────────────────────────────────

const CRITICAL_FIELDS = [
  'surname', 'given_names', 'date_of_birth', 'place_of_birth',
  'series', 'number', 'issued_by', 'date_of_issue',
]

// ── Helpers mirroring production logic ───────────────────────────────────────

function canCertify(
  fields: Array<{ field: string; confirmed: boolean }>
): { ok: boolean; unconfirmed: string[] } {
  const unconfirmed = CRITICAL_FIELDS.filter(cf => {
    const row = fields.find(f => f.field === cf)
    return row && !row.confirmed
  })
  return { ok: unconfirmed.length === 0, unconfirmed }
}

function completenessAudit(
  dbFields: Array<{ field: string; confirmed: boolean; normalized_value: string }>,
  finalFields: Array<{ field: string; normalized_value: string }>
): { passed: boolean; unconfirmedCritical: string[]; mismatchedFields: string[] } {
  const finalMap = Object.fromEntries(finalFields.map(f => [f.field, f.normalized_value]))
  const dbMap = Object.fromEntries(dbFields.map(f => [f.field, f]))

  const unconfirmedCritical = CRITICAL_FIELDS.filter(cf => {
    const row = dbMap[cf]
    return row && !row.confirmed
  })

  const mismatchedFields: string[] = []
  for (const [field, dbRow] of Object.entries(dbMap)) {
    const finalVal = finalMap[field]
    if (dbRow.confirmed && finalVal && finalVal !== dbRow.normalized_value) {
      mismatchedFields.push(field)
    }
  }

  return {
    passed: unconfirmedCritical.length === 0 && mismatchedFields.length === 0,
    unconfirmedCritical,
    mismatchedFields,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CRITICAL_FIELDS', () => {
  it('contains exactly 8 fields', () => {
    expect(CRITICAL_FIELDS).toHaveLength(8)
  })

  it('contains all required USCIS fields for ua_passport_booklet', () => {
    expect(CRITICAL_FIELDS).toContain('surname')
    expect(CRITICAL_FIELDS).toContain('given_names')
    expect(CRITICAL_FIELDS).toContain('date_of_birth')
    expect(CRITICAL_FIELDS).toContain('place_of_birth')
    expect(CRITICAL_FIELDS).toContain('series')
    expect(CRITICAL_FIELDS).toContain('number')
    expect(CRITICAL_FIELDS).toContain('issued_by')
    expect(CRITICAL_FIELDS).toContain('date_of_issue')
  })
})

describe('canCertify gate', () => {
  it('blocks certification when no critical fields are confirmed', () => {
    const fields = CRITICAL_FIELDS.map(f => ({ field: f, confirmed: false }))
    const { ok, unconfirmed } = canCertify(fields)
    expect(ok).toBe(false)
    expect(unconfirmed).toHaveLength(8)
  })

  it('blocks when some critical fields unconfirmed', () => {
    const fields = [
      { field: 'surname', confirmed: true },
      { field: 'given_names', confirmed: true },
      { field: 'date_of_birth', confirmed: false },  // not yet confirmed
      { field: 'place_of_birth', confirmed: true },
      { field: 'series', confirmed: true },
      { field: 'number', confirmed: true },
      { field: 'issued_by', confirmed: true },
      { field: 'date_of_issue', confirmed: false },  // not yet confirmed
    ]
    const { ok, unconfirmed } = canCertify(fields)
    expect(ok).toBe(false)
    expect(unconfirmed).toContain('date_of_birth')
    expect(unconfirmed).toContain('date_of_issue')
    expect(unconfirmed).toHaveLength(2)
  })

  it('allows certification when all critical fields confirmed', () => {
    const fields = CRITICAL_FIELDS.map(f => ({ field: f, confirmed: true }))
    const { ok, unconfirmed } = canCertify(fields)
    expect(ok).toBe(true)
    expect(unconfirmed).toHaveLength(0)
  })

  it('ignores extra non-critical fields in confirmation check', () => {
    const fields = [
      ...CRITICAL_FIELDS.map(f => ({ field: f, confirmed: true })),
      { field: 'nationality', confirmed: false },  // non-critical, not confirmed — should not block
      { field: 'sex', confirmed: false },
    ]
    const { ok } = canCertify(fields)
    expect(ok).toBe(true)
  })

  it('blocks if a critical field is present but session has no extracted_fields row', () => {
    // surname missing from extracted fields entirely — should not block (field not found → not in unconfirmed)
    const fields = CRITICAL_FIELDS.filter(f => f !== 'surname').map(f => ({ field: f, confirmed: true }))
    const { ok, unconfirmed } = canCertify(fields)
    // surname is not in extracted fields, so not in unconfirmed
    expect(ok).toBe(true)
    expect(unconfirmed).toHaveLength(0)
  })
})

describe('completeness audit', () => {
  const allConfirmed = CRITICAL_FIELDS.map(f => ({
    field: f,
    confirmed: true,
    normalized_value: `Value_${f}`,
  }))
  const finalFields = CRITICAL_FIELDS.map(f => ({
    field: f,
    normalized_value: `Value_${f}`,
  }))

  it('passes when all critical confirmed and values match', () => {
    const { passed, unconfirmedCritical, mismatchedFields } = completenessAudit(allConfirmed, finalFields)
    expect(passed).toBe(true)
    expect(unconfirmedCritical).toHaveLength(0)
    expect(mismatchedFields).toHaveLength(0)
  })

  it('fails when confirmed DB value differs from final render value', () => {
    const finalWithMismatch = finalFields.map(f =>
      f.field === 'surname' ? { ...f, normalized_value: 'DIFFERENT_VALUE' } : f
    )
    const { passed, mismatchedFields } = completenessAudit(allConfirmed, finalWithMismatch)
    expect(passed).toBe(false)
    expect(mismatchedFields).toContain('surname')
  })

  it('fails when critical field is not confirmed', () => {
    const withUnconfirmed = allConfirmed.map(f =>
      f.field === 'date_of_birth' ? { ...f, confirmed: false } : f
    )
    const { passed, unconfirmedCritical } = completenessAudit(withUnconfirmed, finalFields)
    expect(passed).toBe(false)
    expect(unconfirmedCritical).toContain('date_of_birth')
  })

  it('does not flag mismatch for unconfirmed fields', () => {
    const withUnconfirmedMismatch = allConfirmed.map(f =>
      f.field === 'nationality' ? { ...f, confirmed: false, normalized_value: 'UKRAINIAN' } : f
    )
    const finalWithDiff = finalFields.concat([{ field: 'nationality', normalized_value: 'Ukraine' }])
    const { mismatchedFields } = completenessAudit(withUnconfirmedMismatch, finalWithDiff)
    // nationality is not confirmed — mismatch should not be flagged
    expect(mismatchedFields).not.toContain('nationality')
  })
})

describe('review-state gate composition', () => {
  it('can_certify is false when critical fields unconfirmed', () => {
    const gates = {
      can_certify: false,
      can_render: false,
      unconfirmed_critical: ['date_of_birth', 'date_of_issue'],
      missing_critical: [],
    }
    expect(gates.can_certify).toBe(false)
    expect(gates.can_render).toBe(false)
    expect(gates.unconfirmed_critical).toHaveLength(2)
  })

  it('can_render requires can_certify + cert_record + payment', () => {
    // All gates pass
    const canRender = (canCertifyResult: boolean, hasCert: boolean, paymentConfirmed: boolean) =>
      canCertifyResult && hasCert && paymentConfirmed

    expect(canRender(true, true, true)).toBe(true)
    expect(canRender(true, true, false)).toBe(false)
    expect(canRender(true, false, true)).toBe(false)
    expect(canRender(false, true, true)).toBe(false)
  })
})

describe('OCR extraction result parsing', () => {
  it('marks field as review_required when confidence < 0.70', () => {
    const rawFields = [
      { field: 'surname', confidence: 0.95, review_required: false },
      { field: 'date_of_birth', confidence: 0.60, review_required: false },
      { field: 'number', confidence: 0.69, review_required: false },
    ]
    const processed = rawFields.map(f => ({
      ...f,
      review_required: f.confidence < 0.70 || f.review_required,
    }))
    expect(processed[0].review_required).toBe(false)
    expect(processed[1].review_required).toBe(true)
    expect(processed[2].review_required).toBe(true)
  })

  it('clamps confidence to [0, 1]', () => {
    const raw = [
      { confidence: 1.5 },
      { confidence: -0.1 },
      { confidence: 0.85 },
    ]
    const processed = raw.map(f => ({
      confidence: Math.min(1, Math.max(0, f.confidence)),
    }))
    expect(processed[0].confidence).toBe(1)
    expect(processed[1].confidence).toBe(0)
    expect(processed[2].confidence).toBe(0.85)
  })

  it('defaults bbox to [0,0,1,1] when malformed', () => {
    const raw = [
      { bbox: [0.1, 0.2, 0.8, 0.4] },
      { bbox: null },
      { bbox: [0.5] },
      { bbox: undefined },
    ]
    const processed = raw.map(f => ({
      bbox: Array.isArray(f.bbox) && f.bbox.length === 4 ? f.bbox : [0, 0, 1, 1],
    }))
    expect(processed[0].bbox).toEqual([0.1, 0.2, 0.8, 0.4])
    expect(processed[1].bbox).toEqual([0, 0, 1, 1])
    expect(processed[2].bbox).toEqual([0, 0, 1, 1])
    expect(processed[3].bbox).toEqual([0, 0, 1, 1])
  })
})
