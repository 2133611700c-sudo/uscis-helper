/**
 * Workstream B — server-side final-PDF confirmation boundary (negative battery).
 *
 * assertDocumentReadyForFinalPdf gated on FINAL_PDF_CONFIRMATION_GATE_ENABLED:
 *  - OFF → not enforced → ready (legacy/golden compatibility);
 *  - ON  → raw-only / unconfirmed-handwriting / conflict / missing-mandatory /
 *          unreadable-mandatory / forged-confirmed → BLOCKED;
 *          valid confirmed canonical → ALLOWED.
 *
 * Fictional data only.
 */
import { describe, it, expect } from 'vitest'
import {
  assertDocumentReadyForFinalPdf,
  isFinalPdfConfirmationGateEnabled,
  type FinalPdfField,
} from '../finalPdfGate'

const OFF = {} as Record<string, string | undefined>
const ON = { FINAL_PDF_CONFIRMATION_GATE_ENABLED: '1' } as Record<string, string | undefined>
const DOC = 'ua_birth_certificate'

// A fully valid, confirmed birth-cert field set.
const VALID: FinalPdfField[] = [
  { field: 'child_family_name', raw_value: "Солов'як", normalized_value: 'Soloviak', confirmed: true, review_required: false },
  { field: 'child_given_name', raw_value: 'Андрій', normalized_value: 'Andrii', confirmed: true, review_required: false },
  { field: 'child_patronymic', raw_value: 'Богданович', normalized_value: 'Bohdanovych', confirmed: true, review_required: false },
  { field: 'date_of_birth', raw_value: '', normalized_value: '01/15/1990', confirmed: true, review_required: false },
  { field: 'act_record_number', raw_value: '84', normalized_value: '84', confirmed: true, review_required: false },
]

describe('Workstream B — flag default', () => {
  it('FINAL_PDF_CONFIRMATION_GATE_ENABLED defaults OFF; OFF → not enforced → ready', () => {
    expect(isFinalPdfConfirmationGateEnabled({})).toBe(false)
    const r = assertDocumentReadyForFinalPdf([], DOC, OFF)
    expect(r.enforced).toBe(false)
    expect(r.ready).toBe(true)
  })
})

describe('Workstream B — ON: valid confirmed canonical → ALLOWED', () => {
  it('all critical fields confirmed → ready', () => {
    const r = assertDocumentReadyForFinalPdf(VALID, DOC, ON)
    expect(r.enforced).toBe(true)
    expect(r.ready).toBe(true)
    expect(r.blockedReasons).toEqual([])
  })
})

describe('Workstream B — ON: negative battery (all BLOCKED)', () => {
  it('raw-only document → blocked', () => {
    const rawOnly: FinalPdfField[] = [{ field: 'child_family_name', raw_value: "Солов'як", normalized_value: '', confirmed: false, review_required: true }]
    const r = assertDocumentReadyForFinalPdf(rawOnly, DOC, ON)
    expect(r.ready).toBe(false)
    expect(r.blockedReasons).toContain('raw_only_document')
  })

  it('unconfirmed handwriting (critical, review_required, not confirmed) → blocked', () => {
    const fields = VALID.map((f) => f.field === 'child_family_name' ? { ...f, confirmed: false, review_required: true } : f)
    const r = assertDocumentReadyForFinalPdf(fields, DOC, ON)
    expect(r.ready).toBe(false)
    expect(r.blockedReasons).toContain('unconfirmed_critical')
  })

  it('unresolved conflict → blocked', () => {
    const fields = VALID.map((f) => f.field === 'date_of_birth' ? { ...f, review_reasons: ['conflict'] } : f)
    const r = assertDocumentReadyForFinalPdf(fields, DOC, ON)
    expect(r.ready).toBe(false)
    expect(r.blockedReasons).toContain('unresolved_conflict')
  })

  it('missing mandatory field → blocked', () => {
    const fields = VALID.map((f) => f.field === 'child_given_name' ? { ...f, raw_value: '', normalized_value: '', confirmed: false } : f)
    const r = assertDocumentReadyForFinalPdf(fields, DOC, ON)
    expect(r.ready).toBe(false)
    expect(r.blockedReasons).toContain('missing_mandatory')
  })

  it('unreadable mandatory field (raw present, no value) → blocked', () => {
    const fields = VALID.map((f) => f.field === 'child_patronymic' ? { ...f, normalized_value: '', confirmed: false } : f)
    const r = assertDocumentReadyForFinalPdf(fields, DOC, ON)
    expect(r.ready).toBe(false)
    expect(r.blockedReasons).toContain('unreadable_mandatory')
  })

  it('forged client payload claiming confirmed (confirmed=true but empty) → blocked', () => {
    const fields = VALID.map((f) => f.field === 'act_record_number' ? { ...f, raw_value: '', normalized_value: '', final_value: null, confirmed: true } : f)
    const r = assertDocumentReadyForFinalPdf(fields, DOC, ON)
    expect(r.ready).toBe(false)
    expect(r.blockedReasons).toContain('forged_confirmed_empty')
  })

  it('blockedFields lists PII-free field keys + reasons', () => {
    const r = assertDocumentReadyForFinalPdf([{ field: 'child_family_name', raw_value: 'x', normalized_value: '', confirmed: false, review_required: true }], DOC, ON)
    expect(r.blockedFields.every((b) => typeof b.field === 'string' && typeof b.reason === 'string')).toBe(true)
  })
})
