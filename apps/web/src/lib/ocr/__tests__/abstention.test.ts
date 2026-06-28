/**
 * Track A6 — canonical AbstentionReason mapping (audit-preserving, fail-closed).
 */
import { describe, it, expect } from 'vitest'
import { AbstentionReason, mapAbstentionReason, mapAbstentionReasons, blocksAutoConfirm } from '../abstention'

describe('mapAbstentionReason — classifies + preserves original', () => {
  const cases: Array<[string, AbstentionReason]> = [
    ['mrz_check_failed', AbstentionReason.ENGINE_DISAGREEMENT],
    ['provider_disagreement', AbstentionReason.ENGINE_DISAGREEMENT],
    ['fabricated', AbstentionReason.NO_SOURCE_EVIDENCE],
    ['unreadable', AbstentionReason.NO_SOURCE_EVIDENCE],
    ['not_read_manual_entry', AbstentionReason.NO_SOURCE_EVIDENCE], // contains "not_read" → no source
    ['route_to_manual_review', AbstentionReason.MANUAL_ENTRY_REQUIRED],
    ['needs_manual_review', AbstentionReason.MANUAL_ENTRY_REQUIRED],
    ['birth_certificate_always_review', AbstentionReason.MANUAL_ENTRY_REQUIRED],
    ['low_final_confidence', AbstentionReason.MANUAL_ENTRY_REQUIRED],
    ['c3_rejected', AbstentionReason.MANUAL_ENTRY_REQUIRED],
    ['fallback_model_used', AbstentionReason.PROVIDER_FAILURE],
    ['retake_required', AbstentionReason.LOW_IMAGE_QUALITY],
    ['unknown_document_type', AbstentionReason.UNKNOWN_DOCUMENT_TYPE],
    ['unsupported_document', AbstentionReason.UNSUPPORTED_DOCUMENT],
    ['field_not_present', AbstentionReason.FIELD_NOT_PRESENT],
    ['handwriting_unreadable', AbstentionReason.HANDWRITING_UNREADABLE],
    ['mixed_script_ambiguity', AbstentionReason.SCRIPT_AMBIGUITY],
  ]
  for (const [raw, expected] of cases) {
    it(`'${raw}' → ${expected}`, () => {
      const m = mapAbstentionReason(raw)!
      expect(m.reason).toBe(expected)
      expect(m.original).toBe(raw) // audit preserved verbatim
    })
  }

  it('empty/nullish → null', () => {
    expect(mapAbstentionReason('')).toBeNull()
    expect(mapAbstentionReason(null)).toBeNull()
    expect(mapAbstentionReason(undefined)).toBeNull()
  })

  it('UNRECOGNIZED reason falls back to MANUAL_ENTRY_REQUIRED (never a confident class)', () => {
    const m = mapAbstentionReason('some_totally_new_reason_xyz')!
    expect(m.reason).toBe(AbstentionReason.MANUAL_ENTRY_REQUIRED)
    expect(m.original).toBe('some_totally_new_reason_xyz')
  })
})

describe('mapAbstentionReasons — dedup, originals preserved', () => {
  it('dedupes by reason+original, keeps originals', () => {
    const out = mapAbstentionReasons(['mrz_check_failed', 'mrz_check_failed', 'fabricated', null, ''])
    expect(out.length).toBe(2)
    expect(out.map((m) => m.reason).sort()).toEqual([AbstentionReason.ENGINE_DISAGREEMENT, AbstentionReason.NO_SOURCE_EVIDENCE].sort())
  })
})

describe('fail-closed', () => {
  it('every abstention reason blocks auto-confirm', () => {
    for (const r of Object.values(AbstentionReason)) expect(blocksAutoConfirm(r)).toBe(true)
  })
})
