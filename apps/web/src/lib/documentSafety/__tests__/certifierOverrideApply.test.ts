/**
 * certifierOverrideApply.test.ts — the route-wiring helper.
 * Proves: disabled → untouched (byte-identical prod); finalize → sets final_value +
 * clears review; refusal → null; anchor conflict + invalid → block (route → 422).
 * Synthetic values only.
 */
import { describe, it, expect } from 'vitest'
import { applyCertifierOverrides, type FieldWithMaybeOverride } from '../certifierOverrideApply'

const ctx = {
  enabled: true,
  docType: 'ua_international_passport',
  documentClass: 'internal_passport_booklet',
  sessionId: 'sess-1',
  timestampUtc: '2026-06-10T20:00:00.000Z',
}

describe('disabled → byte-identical (no mutation, no block)', () => {
  it('returns fields untouched when ctx.enabled is false', async () => {
    const fields: FieldWithMaybeOverride[] = [
      { field: 'given_name', normalized_value: 'Ivan', review_required: true,
        certifier_override: { reason_code: 'source_verified', certifier_id: 'owner' } },
    ]
    const before = JSON.stringify(fields)
    const out = await applyCertifierOverrides(fields, { ...ctx, enabled: false })
    expect(out.block).toBeNull()
    expect(JSON.stringify(out.fields)).toBe(before) // untouched
  })

  it('fields without an override are never touched even when enabled', async () => {
    const fields: FieldWithMaybeOverride[] = [{ field: 'given_name', normalized_value: 'Ivan', review_required: true }]
    const out = await applyCertifierOverrides(fields, ctx)
    expect(out.block).toBeNull()
    expect(out.fields[0].review_required).toBe(true) // no override → unchanged
    expect(out.fields[0].final_value).toBeUndefined()
  })
})

describe('finalize — TIER 1 source_verified', () => {
  it('sets final_value and clears the review flag (certifier attested)', async () => {
    const fields: FieldWithMaybeOverride[] = [
      { field: 'given_name', normalized_value: 'Serhii', review_required: true,
        certifier_override: { reason_code: 'source_verified', certifier_id: 'owner' } },
    ]
    const out = await applyCertifierOverrides(fields, ctx)
    expect(out.block).toBeNull()
    expect(out.fields[0].final_value).toBe('Serhii')
    expect(out.fields[0].review_required).toBe(false)
  })
})

describe('user_confirmed alone on a TIER 1 field → block (422)', () => {
  it('rejects user-alone on critical identity', async () => {
    const fields: FieldWithMaybeOverride[] = [
      { field: 'surname', normalized_value: 'Ivanenko', review_required: true,
        certifier_override: { reason_code: 'user_confirmed', certifier_id: 'user' } },
    ]
    const out = await applyCertifierOverrides(fields, ctx)
    expect(out.block).not.toBeNull()
    expect(out.block?.field).toBe('surname')
  })
})

describe('anchor conflict → block', () => {
  it('blocks when the proposed value disagrees with the cross-document anchor', async () => {
    const fields: FieldWithMaybeOverride[] = [
      { field: 'given_name', normalized_value: 'Oleksandr', review_required: true,
        certifier_override: { reason_code: 'source_verified', certifier_id: 'owner', anchor_value: 'Serhii' } },
    ]
    const out = await applyCertifierOverrides(fields, ctx)
    expect(out.block).toEqual({ field: 'given_name', reason: 'anchor_conflict' })
  })
})

describe('unreadable_per_source → refusal (final_value null, review NOT cleared)', () => {
  it('keeps the field unresolved', async () => {
    const fields: FieldWithMaybeOverride[] = [
      { field: 'given_name', normalized_value: 'Serhii', review_required: true, final_value: 'x',
        certifier_override: { reason_code: 'unreadable_per_source', certifier_id: 'owner' } },
    ]
    const out = await applyCertifierOverrides(fields, ctx)
    expect(out.block).toBeNull()
    expect(out.fields[0].final_value).toBeNull()
    expect(out.fields[0].review_required).toBe(true) // refusal does not resolve review
  })
})
