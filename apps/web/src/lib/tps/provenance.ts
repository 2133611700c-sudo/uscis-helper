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

// ── Phase 2: Wizard → ProvenanceMap converter ────────────────────────────────

/**
 * Generic input shape matching the wizard's FieldExtraction.
 * Avoids importing from UI component — dependency flows lib → UI, not reverse.
 */
export interface ProvenanceInput {
  value: string
  /** ExtractionSource from wizard: ocr_mrz | ocr_visual | ocr_keyword | ai_brain | user_input | user_corrected | inferred */
  source: string
  /** Upload slot: passport | i94 | ead | i797 | dl */
  doc_slot: string
  confidence: number | null
  source_field?: string | null
}

/** Map wizard ExtractionSource → provenance ExtractionMethod */
function toExtractionMethod(source: string): ExtractionMethod {
  switch (source) {
    case 'ocr_mrz': return 'ocr_mrz'
    case 'ocr_visual': return 'ocr_label_match'
    case 'ocr_keyword': return 'ocr_rule_parser'
    case 'ai_brain': return 'ai_brain'
    case 'user_input':
    case 'user_corrected': return 'user_manual'
    case 'inferred': return 'system_default'
    default: return 'ocr_rule_parser'
  }
}

/** Map wizard doc_slot → provenance SourceDocumentType */
function toSourceDocType(docSlot: string): SourceDocumentType {
  switch (docSlot) {
    case 'passport': return 'passport'
    case 'i94': return 'i94'
    case 'ead': return 'ead'
    case 'i797': return 'i797'
    case 'dl':
    case 'driver_license': return 'driver_license'
    default: return 'user_manual'
  }
}

/**
 * Known system defaults for TPS-Ukraine filing.
 * These fields get auto-populated with hardcoded values when no OCR source exists.
 */
const SYSTEM_DEFAULT_FIELDS: Record<string, string> = {
  country_of_birth: 'Ukraine',
  country_of_nationality: 'Ukraine',
  passport_country_of_issuance: 'Ukraine',
  mailing_same_as_physical: 'true',
}

/**
 * Build a ProvenanceMap from the wizard's merged field state.
 *
 * Rules:
 * 1. If mergedFields[key] exists AND manualOverrides didn't change the value
 *    → ocrProvenance from the extraction source
 * 2. If manualOverrides[key] exists AND mergedFields[key] exists with a different value
 *    → manualProvenance(true) — user corrected an OCR result
 * 3. If manualOverrides[key] exists AND mergedFields[key] does NOT exist
 *    → manualProvenance(false) — user entered from scratch
 * 4. If the value matches a known system default AND no OCR/manual source
 *    → defaultProvenance()
 * 5. Driver license fields CANNOT provide immigration provenance
 *    (slot firewall: DL only supports address/identity cross-check)
 */
export function buildProvenanceFromWizard(
  mergedFields: Record<string, ProvenanceInput>,
  manualOverrides: Record<string, string>,
  finalAnswerKeys: string[],
): ProvenanceMap {
  const map: ProvenanceMap = {}

  /** Fields that DL is forbidden from providing as immigration source */
  const DL_FORBIDDEN_IMMIGRATION_FIELDS = new Set([
    'a_number', 'i94_admission_number', 'last_entry_date', 'status_at_last_entry',
    'passport_number', 'passport_expiration_date', 'passport_country_of_issuance',
    'country_of_birth', 'country_of_nationality',
  ])

  for (const key of finalAnswerKeys) {
    const mf = mergedFields[key]
    const manual = manualOverrides[key]
    const hasManual = manual !== undefined && manual !== null && manual.toString().trim() !== ''

    if (mf && mf.value) {
      // DL firewall: if the field came from DL and it's an immigration field, reject provenance
      if (toSourceDocType(mf.doc_slot) === 'driver_license' && DL_FORBIDDEN_IMMIGRATION_FIELDS.has(key)) {
        // Treat as if the field was manually entered — DL cannot be the source
        map[key] = hasManual ? manualProvenance(false) : defaultProvenance(key)
        continue
      }

      if (hasManual && manual.trim() !== mf.value.trim()) {
        // User corrected the OCR value
        map[key] = manualProvenance(true)
      } else {
        // OCR value accepted (with or without review)
        map[key] = ocrProvenance(
          toSourceDocType(mf.doc_slot),
          toExtractionMethod(mf.source),
          mf.confidence ?? 0,
          mf.source_field ?? key,
        )
      }
    } else if (hasManual) {
      // No OCR, user typed from scratch
      map[key] = manualProvenance(false)
    } else if (key in SYSTEM_DEFAULT_FIELDS) {
      // Known system default
      map[key] = defaultProvenance(key)
    }
    // If none of the above, field is missing — no provenance entry
  }

  return map
}
