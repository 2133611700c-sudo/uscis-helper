/**
 * readerBridge.test.ts — B→A decision-shadow bridge. Verifies the PURE decision function:
 * decision-shadow NEVER changes the reader type (effectiveDocTypeId === manual always), records
 * agreement/readiness/safety PII-free, and fails closed to manual on not-ready/unknown/not-run.
 */
import { describe, it, expect } from 'vitest'
import { decideReaderDocType, isReaderControlEnabled } from '../readerBridge'
import type { ShadowObservation } from '../shadowRunner'

function obs(over: Partial<ShadowObservation>): ShadowObservation {
  return {
    ran: true, service: 'translation', intakeStatus: 'ready',
    brainDocTypeId: 'ua_birth_certificate_soviet', declaredDocTypeId: 'ua_birth_certificate_soviet',
    typeMatchesDeclared: true, readyForRecognition: true, reasonCodes: [], ...over,
  }
}

describe('reader bridge — flag default', () => {
  it('ONE_BRAIN_CONTROLS_READER default OFF', () => {
    expect(isReaderControlEnabled({})).toBe(false)
    expect(isReaderControlEnabled({ ONE_BRAIN_CONTROLS_READER: '1' })).toBe(true)
  })
})

describe('reader bridge — decideReaderDocType (decision-shadow: reader ALWAYS keeps manual)', () => {
  it('ready + agreement → recorded safe, but effective type stays manual', () => {
    const d = decideReaderDocType('ua_birth_certificate_soviet', obs({}))
    expect(d.agreement).toBe(true)
    expect(d.intakeReady).toBe(true)
    expect(d.safeToBridge).toBe(true)
    expect(d.effectiveDocTypeId).toBe('ua_birth_certificate_soviet') // manual, unchanged
    expect(d.reasonCodes).toEqual([])
  })

  it('disagreement → recorded, manual type still used', () => {
    const d = decideReaderDocType('ua_internal_passport_booklet', obs({ brainDocTypeId: 'ua_birth_certificate_soviet', typeMatchesDeclared: false }))
    expect(d.agreement).toBe(false)
    expect(d.reasonCodes).toContain('type_disagreement')
    expect(d.effectiveDocTypeId).toBe('ua_internal_passport_booklet') // manual, NOT intake
  })

  it('intake not ready → manual fallback, not safe', () => {
    const d = decideReaderDocType('ua_birth_certificate_soviet', obs({ readyForRecognition: false, intakeStatus: 'needs_review' }))
    expect(d.safeToBridge).toBe(false)
    expect(d.reasonCodes).toContain('intake_not_ready')
    expect(d.effectiveDocTypeId).toBe('ua_birth_certificate_soviet')
  })

  it('unknown/unsupported intake type → not usable, manual fallback', () => {
    for (const t of ['unknown', 'unsupported', 'not_a_document']) {
      const d = decideReaderDocType('ua_birth_certificate_soviet', obs({ brainDocTypeId: t, typeMatchesDeclared: false }))
      expect(d.safeToBridge).toBe(false)
      expect(d.reasonCodes).toContain('intake_type_unusable')
      expect(d.effectiveDocTypeId).toBe('ua_birth_certificate_soviet')
    }
  })

  it('intake did not run (flag off / error → ran:false) → manual fallback', () => {
    const d = decideReaderDocType('ua_birth_certificate_soviet', obs({ ran: false, brainDocTypeId: null, readyForRecognition: null, typeMatchesDeclared: null, intakeStatus: null }))
    expect(d.intakeDocTypeId).toBe(null)
    expect(d.safeToBridge).toBe(false)
    expect(d.reasonCodes).toContain('intake_not_run')
    expect(d.effectiveDocTypeId).toBe('ua_birth_certificate_soviet')
  })

  it('null observation (no shadow at all) → manual fallback', () => {
    const d = decideReaderDocType('ua_birth_certificate_soviet', null)
    expect(d.safeToBridge).toBe(false)
    expect(d.effectiveDocTypeId).toBe('ua_birth_certificate_soviet')
    expect(d.reasonCodes).toContain('intake_not_run')
  })

  it('is PII-free: only type ids + booleans + reason codes (no field values)', () => {
    const d = decideReaderDocType('ua_birth_certificate_soviet', obs({}))
    const json = JSON.stringify(d)
    // keys are a closed set — no name/date/number/value fields leak in
    expect(Object.keys(d).sort()).toEqual(
      ['agreement', 'effectiveDocTypeId', 'intakeDocTypeId', 'intakeReady', 'intakeStatus', 'manualDocTypeId', 'reasonCodes', 'safeToBridge', 'service'].sort(),
    )
    expect(json).not.toMatch(/name|birth_date|surname|passport_number/i)
  })
})
