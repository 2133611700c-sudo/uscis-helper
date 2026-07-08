/**
 * contracts.test.ts — Phase 2 canonical decision-spine invariants. Pure, no network.
 */
import { describe, it, expect } from 'vitest'
import {
  mkDecision, isTrustworthy, assertCanonicalHasSource, intakeReadyForRecognition,
  emptyIntake, deriveIntakeStatus, toSafeLog, type DocumentIntakeResult,
} from '../contracts'
import { startTrace, addSpan, isTraceComplete, summarizeTrace } from '../trace'

describe('mkDecision — trusted requires measured', () => {
  it('cannot be trusted without status measured', () => {
    for (const status of ['not_attempted', 'attempted', 'failed', 'skipped', 'unavailable'] as const) {
      expect(mkDecision({ status, trusted: true }).trusted).toBe(false)
    }
  })
  it('trusted allowed only when measured', () => {
    expect(mkDecision({ status: 'measured', trusted: true }).trusted).toBe(true)
    expect(isTrustworthy(mkDecision({ status: 'measured', trusted: true }))).toBe(true)
  })
  it('measured but not asked-trusted stays untrusted', () => {
    expect(mkDecision({ status: 'measured' }).trusted).toBe(false)
  })
  it('normalizes optional fields to safe defaults', () => {
    const d = mkDecision({ status: 'attempted' })
    expect(d.reasonCodes).toEqual([]); expect(d.provider).toBeNull(); expect(d.confidence).toBeNull()
  })
})

describe('assertCanonicalHasSource — no final without candidate source', () => {
  it('no finalValue ⇒ no violations', () => {
    expect(assertCanonicalHasSource({ key: 'dob' })).toEqual([])
    expect(assertCanonicalHasSource({ key: 'dob', finalValue: null })).toEqual([])
  })
  it('finalValue without evidence ⇒ violation (cannot mark provider result final without source)', () => {
    const v = assertCanonicalHasSource({ key: 'surname', finalValue: 'X', evidence: [], source: null })
    expect(v.length).toBeGreaterThan(0)
    expect(v.join(' ')).toMatch(/no evidence|no controlling source/)
  })
  it('finalValue with evidence + provider + source ⇒ ok', () => {
    const v = assertCanonicalHasSource({ key: 'surname', finalValue: 'X', source: 'mrz', evidence: [{ source: 'mrz', provider: 'openai' }] })
    expect(v).toEqual([])
  })
  it('evidence without provider ⇒ violation', () => {
    const v = assertCanonicalHasSource({ key: 'x', finalValue: 'y', source: 'ocr', evidence: [{ source: 'ocr' }] })
    expect(v.join(' ')).toMatch(/no provider/)
  })
})

describe('intake gate + status derivation (fail-closed)', () => {
  const ready = (): DocumentIntakeResult => {
    const d = emptyIntake()
    d.preflight = { ...d.preflight, status: 'measured', isDocument: true, quality: 'ok', mediaType: 'image' }
    d.docType = { ...d.docType, status: 'measured', docTypeId: 'passport', confidence: 0.95, trusted: true }
    d.country = { ...d.country, status: 'measured', country: 'UA' }
    d.family = { ...d.family, status: 'measured', family: 'identity_document' }
    d.route = { ...d.route, reader: 'passport_reader' }
    const { status, review } = deriveIntakeStatus(d)
    return { ...d, status, review }
  }
  it('unknown type ⇒ status unknown, not ready', () => {
    const d = emptyIntake()
    const { status } = deriveIntakeStatus(d)
    expect(status).toBe('unknown')
    expect(intakeReadyForRecognition({ ...d, status, review: { reviewRequired: true, policy: null, reasonCodes: [] } })).toBe(false)
  })
  it('not-a-document ⇒ rejected', () => {
    const d = emptyIntake()
    d.preflight = { ...d.preflight, status: 'measured', isDocument: false }
    expect(deriveIntakeStatus(d).status).toBe('rejected')
  })
  it('confident passport with route ⇒ ready + recognition allowed', () => {
    const r = ready()
    expect(r.status).toBe('ready')
    expect(intakeReadyForRecognition(r)).toBe(true)
  })
  it('handwriting present ⇒ needs_review (not ready), recognition still allowed but held', () => {
    const r = ready()
    r.language = { ...r.language, handwritingPresent: true }
    const { status } = deriveIntakeStatus(r)
    expect(status).toBe('needs_review')
  })
  it('user hint conflicting with measured type is a review reason, never overrides', () => {
    const r = ready()
    r.userHint = { docTypeId: 'i94' } // conflicts with measured passport
    const { status, review } = deriveIntakeStatus(r)
    expect(status).toBe('needs_review')
    expect(review.reasonCodes).toContain('user_hint_conflicts_measured')
    // measured type is preserved — hint did NOT change it
    expect(r.docType.docTypeId).toBe('passport')
  })
  it('reader none ⇒ never ready for recognition', () => {
    const r = ready(); r.route = { ...r.route, reader: 'none' }
    expect(intakeReadyForRecognition(r)).toBe(false)
  })
})

describe('toSafeLog — PII redaction', () => {
  it('redacts value-bearing keys, keeps decision metadata', () => {
    const obj = { status: 'measured', confidence: 0.9, printed_title_seen: 'СВИДЕТЕЛЬСТВО…', fields: [{ key: 'surname', rawValue: 'REALNAME', finalValue: 'REALNAME', confidence: 0.8 }] }
    const safe = toSafeLog(obj) as any
    expect(safe.status).toBe('measured')
    expect(safe.confidence).toBe(0.9)
    expect(safe.printed_title_seen).toBe('[redacted]')
    expect(safe.fields[0].rawValue).toBe('[redacted]')
    expect(safe.fields[0].finalValue).toBe('[redacted]')
    expect(safe.fields[0].key).toBe('surname') // key is not PII
    expect(safe.fields[0].confidence).toBe(0.8)
  })
  it('null value-bearing keys stay null (not the string [redacted])', () => {
    expect((toSafeLog({ value: null }) as any).value).toBeNull()
  })
})

describe('OneBrainTrace', () => {
  it('builds spans, filters free-text evidence ids, summarizes PII-free', () => {
    let t = startTrace('trace-1')
    t = addSpan(t, { name: 'orientation', status: 'ok', startMs: 0, endMs: 5, provider: 'openai', decision: 'cw=0', reasonCodes: [], evidenceIds: ['sha256:abc', 'has space should drop'] })
    t = addSpan(t, { name: 'type', status: 'ok', startMs: 5, endMs: 12, provider: 'openai', decision: 'passport conf=0.95', reasonCodes: [] })
    expect(t.spans).toHaveLength(2)
    expect(t.spans[0].evidenceIds).toEqual(['sha256:abc']) // free-text with space dropped
    expect(isTraceComplete(t)).toBe(true)
    const sum = summarizeTrace(t)
    expect(sum[0]).toContain('orientation: ok 5ms [openai]')
    expect(sum.join(' ')).not.toMatch(/should drop/)
  })
  it('incomplete trace (unset/no-end) is not complete', () => {
    let t = startTrace('t2')
    t = addSpan(t, { name: 'intake', status: 'unset', startMs: 0, endMs: null, provider: null, decision: null, reasonCodes: [] })
    expect(isTraceComplete(t)).toBe(false)
  })
})
