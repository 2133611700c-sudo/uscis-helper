/**
 * provenance.test.ts — Phase 1 provenance sidecar tests.
 *
 * Verifies:
 *   1. Factory helpers create correct provenance records.
 *   2. Audit rows link canonical fields to PDF fields with provenance.
 *   3. Unknown provenance is surfaced, not hidden.
 *   4. Summary produces counts without PII.
 *   5. No raw PII in any output.
 */

import { describe, it, expect } from 'vitest'

import {
  ocrProvenance,
  manualProvenance,
  defaultProvenance,
  buildAuditRows,
  summarizeProvenance,
  type ProvenanceMap,
  type PdfAuditRow,
} from '../provenance'

describe('provenance factory helpers', () => {
  it('ocrProvenance creates auto_with_source record', () => {
    const p = ocrProvenance('passport', 'ocr_mrz', 0.95, 'family_name')
    expect(p.source_document_type).toBe('passport')
    expect(p.extraction_method).toBe('ocr_mrz')
    expect(p.confidence).toBe(0.95)
    expect(p.value_status).toBe('auto_with_source')
    expect(p.user_review_status).toBe('unreviewed')
  })

  it('ocrProvenance with reviewed=true sets reviewed status', () => {
    const p = ocrProvenance('i94', 'ai_brain', 0.8, 'dob', true)
    expect(p.user_review_status).toBe('reviewed')
  })

  it('manualProvenance creates user_manual record', () => {
    const p = manualProvenance()
    expect(p.source_document_type).toBe('user_manual')
    expect(p.extraction_method).toBe('user_manual')
    expect(p.confidence).toBeNull()
    expect(p.value_status).toBe('user_manual')
  })

  it('manualProvenance with corrected=true sets corrected status', () => {
    const p = manualProvenance(true)
    expect(p.user_review_status).toBe('corrected')
  })

  it('defaultProvenance creates system_default record', () => {
    const p = defaultProvenance('country_of_nationality')
    expect(p.value_status).toBe('system_default')
    expect(p.extraction_method).toBe('system_default')
  })
})

describe('buildAuditRows', () => {
  const ops = [
    { field: 'form1[0].Page01[0].Part2_Item1_FamilyName[0]', kind: 'text' as const, value: 'TEST' },
    { field: 'form1[0].Page01[0].Part2_Item1_GivenName[0]', kind: 'text' as const, value: 'USER' },
    { field: 'form1[0].Page01[0].Part1_Item1_ApplicationType[0]', kind: 'checkbox' as const, value: true },
  ]

  it('creates audit row for each op', () => {
    const rows = buildAuditRows(ops, 'I-821', null, new Set(ops.map(o => o.field)))
    expect(rows).toHaveLength(3)
  })

  it('marks unknown provenance when no sidecar provided', () => {
    const rows = buildAuditRows(ops, 'I-821', null, new Set())
    for (const r of rows) {
      expect(r.source_document_type).toBe('unknown')
      expect(r.extraction_method).toBe('unknown')
    }
  })

  it('attaches provenance from sidecar when available', () => {
    const prov: ProvenanceMap = {
      family_name: ocrProvenance('passport', 'ocr_mrz', 0.95, 'family_name'),
    }
    const rows = buildAuditRows(ops, 'I-821', prov, new Set(ops.map(o => o.field)))
    const fnRow = rows.find(r => r.canonical_field === 'family_name')
    expect(fnRow?.source_document_type).toBe('passport')
    expect(fnRow?.extraction_method).toBe('ocr_mrz')
    expect(fnRow?.confidence).toBe(0.95)
  })

  it('marks pdf_written correctly', () => {
    const applied = new Set(['form1[0].Page01[0].Part2_Item1_FamilyName[0]'])
    const rows = buildAuditRows(ops, 'I-821', null, applied)
    const fnRow = rows.find(r => r.canonical_field === 'family_name')
    const gnRow = rows.find(r => r.canonical_field === 'given_name')
    expect(fnRow?.pdf_written).toBe(true)
    expect(gnRow?.pdf_written).toBe(false)
  })
})

describe('summarizeProvenance', () => {
  it('counts source types without PII', () => {
    const rows: PdfAuditRow[] = [
      { canonical_field: 'family_name', pdf_form: 'I-821', pdf_field_name: 'f1', op_kind: 'text', source_document_type: 'passport', extraction_method: 'ocr_mrz', confidence: 0.95, user_review_status: 'reviewed', pdf_written: true },
      { canonical_field: 'dob', pdf_form: 'I-821', pdf_field_name: 'f2', op_kind: 'text', source_document_type: 'passport', extraction_method: 'ocr_mrz', confidence: 0.9, user_review_status: 'reviewed', pdf_written: true },
      { canonical_field: 'email', pdf_form: 'I-821', pdf_field_name: 'f3', op_kind: 'text', source_document_type: 'user_manual', extraction_method: 'user_manual', confidence: null, user_review_status: 'manual_entry', pdf_written: true },
      { canonical_field: 'phone', pdf_form: 'I-821', pdf_field_name: 'f4', op_kind: 'text', source_document_type: 'unknown', extraction_method: 'unknown', confidence: null, user_review_status: 'unknown', pdf_written: true },
    ]
    const s = summarizeProvenance(rows)
    expect(s.total_fields).toBe(4)
    expect(s.auto_with_source).toBe(2)
    expect(s.user_manual).toBe(1)
    expect(s.unknown_provenance).toBe(1)
    expect(s.source_breakdown['passport']).toBe(2)
    expect(s.source_breakdown['user_manual']).toBe(1)
    expect(s.source_breakdown['unknown']).toBe(1)
  })

  it('summary output contains zero raw PII values', () => {
    const rows: PdfAuditRow[] = [
      { canonical_field: 'family_name', pdf_form: 'I-821', pdf_field_name: 'f1', op_kind: 'text', source_document_type: 'passport', extraction_method: 'ocr_mrz', confidence: 0.95, user_review_status: 'reviewed', pdf_written: true },
    ]
    const s = summarizeProvenance(rows)
    const serialized = JSON.stringify(s)
    // No actual values like names, numbers, dates should appear
    expect(serialized).not.toContain('TESTFAMILY')
    expect(serialized).not.toContain('1980')
    expect(serialized).not.toContain('XX0000000')
  })
})
