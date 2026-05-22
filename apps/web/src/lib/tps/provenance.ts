/**
 * provenance.ts — sidecar provenance tracking for TPS answers.
 *
 * Phase 1: types + adapter + audit row generator.
 * Does NOT change TPSAnswers or wizard state.
 * Travels alongside the flat answers as a parallel map.
 *
 * Architecture:
 *   OCR → TpsExtractedField[] (has provenance)
 *       ↓ wizard applies to flat TPSAnswers
 *   TPSAnswers (flat, no provenance)  +  ProvenanceMap (sidecar)
 *       ↓ buildI821Ops / buildI765Ops
 *   I821Op[] / I765Op[]  +  AuditRow[] (provenance attached per op)
 *       ↓ prefill
 *   PDF  →  readback verification
 */

// ── Source document types ────────────────────────────────────────────────────

export type SourceDocumentType =
  | 'passport'
  | 'i94'
  | 'ead'
  | 'i797'
  | 'driver_license'
  | 'user_manual'

export type ExtractionMethod =
  | 'ocr_mrz'
  | 'ocr_rule_parser'
  | 'ocr_label_match'
  | 'ai_brain'
  | 'ai_brain_targeted'
  | 'user_manual'
  | 'system_default'

export type UserReviewStatus =
  | 'unreviewed'
  | 'reviewed'
  | 'corrected'
  | 'manual_entry'

export type ValueStatus =
  | 'auto_with_source'
  | 'user_manual'
  | 'system_default'
  | 'missing'

// ── Per-field provenance record ──────────────────────────────────────────────

export interface FieldProvenance {
  /** Which document this value came from */
  source_document_type: SourceDocumentType
  /** How it was extracted */
  extraction_method: ExtractionMethod
  /** OCR/AI confidence 0..1, null for user_manual */
  confidence: number | null
  /** Original field key from extraction (e.g. 'family_name' from TpsExtractedField) */
  source_field: string | null
  /** User review state */
  user_review_status: UserReviewStatus
  /** Final classification */
  value_status: ValueStatus
}

/** Sidecar provenance map — keyed by TPSAnswers field name */
export type ProvenanceMap = Record<string, FieldProvenance>

// ── PDF audit row (generated during buildOps) ────────────────────────────────

export interface PdfAuditRow {
  /** Canonical field name from TPSAnswers */
  canonical_field: string
  /** Which USCIS form */
  pdf_form: 'I-821' | 'I-765'
  /** Exact AcroForm field name in the PDF */
  pdf_field_name: string
  /** Op kind: text, checkbox, choice */
  op_kind: 'text' | 'checkbox' | 'choice'
  /** Source document provenance (from sidecar, or 'unknown' if missing) */
  source_document_type: SourceDocumentType | 'unknown'
  /** Extraction method (from sidecar, or 'unknown') */
  extraction_method: ExtractionMethod | 'unknown'
  /** Confidence (from sidecar) */
  confidence: number | null
  /** User review status */
  user_review_status: UserReviewStatus | 'unknown'
  /** Was the op applied to the PDF? */
  pdf_written: boolean
}

// ── Factory helpers ──────────────────────────────────────────────────────────

/** Create provenance for an OCR-extracted field */
export function ocrProvenance(
  source: SourceDocumentType,
  method: ExtractionMethod,
  confidence: number,
  sourceField: string,
  reviewed: boolean = false,
): FieldProvenance {
  return {
    source_document_type: source,
    extraction_method: method,
    confidence,
    source_field: sourceField,
    user_review_status: reviewed ? 'reviewed' : 'unreviewed',
    value_status: 'auto_with_source',
  }
}

/** Create provenance for a user-manually-entered field */
export function manualProvenance(corrected: boolean = false): FieldProvenance {
  return {
    source_document_type: 'user_manual',
    extraction_method: 'user_manual',
    confidence: null,
    source_field: null,
    user_review_status: corrected ? 'corrected' : 'manual_entry',
    value_status: 'user_manual',
  }
}

/** Create provenance for a system default (e.g. country_of_nationality = 'Ukraine') */
export function defaultProvenance(field: string): FieldProvenance {
  return {
    source_document_type: 'user_manual',
    extraction_method: 'system_default',
    confidence: null,
    source_field: field,
    user_review_status: 'unreviewed',
    value_status: 'system_default',
  }
}

// ── Audit row builder ────────────────────────────────────────────────────────

interface OpLike {
  field: string
  kind: 'text' | 'checkbox' | 'choice'
  value: string | boolean
}

/**
 * Map a canonical TPSAnswers key from an AcroForm field name.
 * Heuristic: extract the most specific Part/Item/Line identifier.
 * Falls back to the raw field name if no match.
 */
function canonicalKeyFromPdfField(pdfField: string): string {
  // e.g. 'form1[0].Page01[0].Part2_Item1_FamilyName[0]' → 'family_name'
  const last = pdfField.split('.').pop() ?? pdfField
  const base = last.replace(/\[\d+\]$/g, '')
  // Common mappings
  if (base.includes('FamilyName')) return 'family_name'
  if (base.includes('GivenName')) return 'given_name'
  if (base.includes('MiddleName')) return 'middle_name'
  if (base.includes('DOB') || base.includes('DateOfBirth')) return 'dob'
  if (base.includes('PassportNumber')) return 'passport_number'
  if (base.includes('AlienNumber') || base.includes('A_Number')) return 'a_number'
  if (base.includes('StreetNumberName')) return 'us_address_street'
  if (base.includes('TPScountry')) return 'country_of_nationality'
  return base
}

/**
 * Generate audit rows for a set of PDF ops with optional provenance sidecar.
 * If provenance is not available for a field, source is marked 'unknown'.
 */
export function buildAuditRows(
  ops: OpLike[],
  form: 'I-821' | 'I-765',
  provenance: ProvenanceMap | null,
  appliedFields: Set<string>,
): PdfAuditRow[] {
  return ops.map((op) => {
    const canonical = canonicalKeyFromPdfField(op.field)
    const prov = provenance?.[canonical] ?? null
    return {
      canonical_field: canonical,
      pdf_form: form,
      pdf_field_name: op.field,
      op_kind: op.kind,
      source_document_type: prov?.source_document_type ?? 'unknown',
      extraction_method: prov?.extraction_method ?? 'unknown',
      confidence: prov?.confidence ?? null,
      user_review_status: prov?.user_review_status ?? 'unknown',
      pdf_written: appliedFields.has(op.field),
    }
  })
}

// ── Provenance summary (no PII) ──────────────────────────────────────────────

export interface ProvenanceSummary {
  total_fields: number
  auto_with_source: number
  user_manual: number
  system_default: number
  unknown_provenance: number
  source_breakdown: Record<string, number>
  method_breakdown: Record<string, number>
}

export function summarizeProvenance(rows: PdfAuditRow[]): ProvenanceSummary {
  const summary: ProvenanceSummary = {
    total_fields: rows.length,
    auto_with_source: 0,
    user_manual: 0,
    system_default: 0,
    unknown_provenance: 0,
    source_breakdown: {},
    method_breakdown: {},
  }
  for (const r of rows) {
    const src = r.source_document_type
    summary.source_breakdown[src] = (summary.source_breakdown[src] ?? 0) + 1
    const meth = r.extraction_method
    summary.method_breakdown[meth] = (summary.method_breakdown[meth] ?? 0) + 1
    if (src === 'unknown') summary.unknown_provenance++
    else if (src === 'user_manual') summary.user_manual++
    else summary.auto_with_source++
  }
  return summary
}
