/**
 * gatesAsReadersShadow — Phase 1b flip evidence. FICTIONAL data only.
 * Pins: identical verdicts → match; engine loosening is surfaced (flip-blocking);
 * tightening is reported separately; output is keys-only (PII-free).
 */
import { describe, it, expect } from 'vitest'
import { runGatesAsReadersShadow, type GatesShadowLegacyField } from '../gatesAsReadersShadow'
import type { FieldDecision } from '../decisionEngine'

const dec = (field: string, over: Partial<FieldDecision> = {}): FieldDecision => ({
  field,
  status: 'accept',
  finalValue: 'Testovych',
  candidateValue: null,
  reviewRequired: false,
  manualRequired: false,
  criticality: 'critical_identity' as FieldDecision['criticality'],
  ...over,
})

describe('runGatesAsReadersShadow', () => {
  it('identical verdicts on both sides → match, zero diffs', () => {
    const legacy: GatesShadowLegacyField[] = [
      { field: 'given_name', finalValue: 'Testovych', review_required: false },
      { field: 'dob', finalValue: null, review_required: true },
    ]
    const out = runGatesAsReadersShadow(legacy, [
      dec('given_name'),
      dec('dob', { status: 'reject', finalValue: null, candidateValue: '1990-01-01', reviewRequired: true }),
    ])
    expect(out.match).toBe(true)
    expect(out.unresolved_diff_keys).toEqual([])
    expect(out.release_diff_keys).toEqual([])
    expect(out.legacy_unresolved).toContain('dob')
    expect(out.engine_unresolved).toContain('dob')
  })

  it('engine LOOSENS (unblocks a legacy-blocked field) → flip-blocking evidence', () => {
    const legacy: GatesShadowLegacyField[] = [
      { field: 'family_name', finalValue: null, review_required: true },
    ]
    const out = runGatesAsReadersShadow(legacy, [dec('family_name')])
    expect(out.engine_loosened_keys).toEqual(['family_name'])
    expect(out.match).toBe(false)
  })

  it('engine TIGHTENS (blocks more) → reported, distinct from loosening', () => {
    const legacy: GatesShadowLegacyField[] = [
      { field: 'sex', finalValue: 'M', review_required: false },
    ]
    const out = runGatesAsReadersShadow(legacy, [
      dec('sex', { finalValue: 'M', reviewRequired: true }),
    ])
    expect(out.engine_tightened_keys).toEqual(['sex'])
    expect(out.engine_loosened_keys).toEqual([])
    expect(out.match).toBe(false)
  })

  it('releasability diff (legacy releases, engine rejects) is caught even when review flags agree', () => {
    const legacy: GatesShadowLegacyField[] = [
      { field: 'doc_number', finalValue: 'AB123456', review_required: true },
    ]
    const out = runGatesAsReadersShadow(legacy, [
      dec('doc_number', { status: 'reject', finalValue: null, candidateValue: 'AB123456', reviewRequired: true }),
    ])
    expect(out.release_diff_keys).toEqual(['doc_number'])
  })

  it('output is keys-only — no field VALUES ever leak (PII-free by construction)', () => {
    const legacy: GatesShadowLegacyField[] = [
      { field: 'family_name', finalValue: 'Vyhadanenko', review_required: false },
    ]
    const out = runGatesAsReadersShadow(legacy, [dec('family_name', { finalValue: 'Vyhadanenko' })])
    expect(JSON.stringify(out)).not.toContain('Vyhadanenko')
  })
})
