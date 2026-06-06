/**
 * documentSafety/applyOcrFieldSafety — C3 wiring helper.
 *
 * Maps a list of extracted fields through the pure `protectOcrField` guard so any reader path can enforce the
 * Global OCR Field Safety Contract identically. Used ONLY behind `OCR_FIELD_SAFETY_ENABLED` (default OFF) — when
 * OFF the caller skips this entirely (byte-identical prod). When ON, an unsafe critical value is moved to a
 * SEPARATE candidate slot (value→null) and flagged review/manual; the actual content is never altered.
 *
 * Generic over the field shape (works for translation FieldOut + TPS fields): only reads field/value/
 * raw_cyrillic/confidence/review_required.
 */
import {
  protectOcrField,
  type OcrFlow,
  type OcrFieldCriticality,
  type OcrSafetyReason,
} from './ocrFieldSafetyGate'

export function isOcrFieldSafetyEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.OCR_FIELD_SAFETY_ENABLED === '1'
}

const IDENTITY = [
  'family_name', 'surname', 'given_name', 'patronymic', 'middle_name',
  'child_family_name', 'child_given_name', 'child_patronymic',
  'father_full_name', 'mother_full_name', 'spouse_1_full_name', 'spouse_2_full_name',
  'dob', 'date_of_birth', 'place_of_birth', 'place_of_birth_city', 'place_city',
  'city_of_birth', 'province_of_birth', 'place_of_birth_region', 'sex', 'citizenship',
]
const DOCNUM = [
  'passport_number', 'doc_number', 'document_number', 'act_record_number',
  'a_number', 'i94_admission_number', 'i94_admission', 'military_id_number',
]

/** Map a field name → criticality. Identity/document numbers are critical; addresses/contact are admin. */
export function classifyCriticality(fieldName: string): OcrFieldCriticality {
  const f = (fieldName || '').toLowerCase()
  if (IDENTITY.some((s) => f.includes(s))) return 'critical_identity'
  if (DOCNUM.some((s) => f.includes(s))) return 'critical_document'
  if (/address|phone|email|marital|zip|state|city_us/.test(f)) return 'admin'
  return 'optional'
}

export interface SafetyContext {
  flow: OcrFlow
  document_class?: string | null
  source_doc_type?: string | null
  expected_source_doc_type?: string | null
  legacy_reader?: boolean
  hard_case?: boolean
  source_doc_id_hash?: string | null
  session_doc_id_hash?: string | null
  /** strong source anchor present (e.g. MRZ controlling-Latin). Default: false for hard-case/legacy. */
  strong_source_anchor?: boolean
}

export interface SafeField {
  field: string
  value: string | null
  raw_cyrillic?: string | null
  confidence?: number
  review_required?: boolean
  // C3 safety additions:
  candidate_value?: string | null
  manual_required?: boolean
  safety_decision?: string
  safety_reason_codes?: OcrSafetyReason[]
  [k: string]: unknown
}

/**
 * Apply the safety guard to every field. Returns new field objects (input not mutated). An unsafe critical
 * field keeps its raw read in `candidate_value`, has `value` set to null, and is marked review+manual.
 * `zeroRecognition` (no usable fields at all) is passed per-field so the guard returns block/manual.
 */
export function applyOcrFieldSafety<T extends SafeField>(
  fields: T[],
  ctx: SafetyContext,
  opts: { zeroRecognition?: boolean } = {},
): { fields: SafeField[]; anyUnresolvedCritical: boolean } {
  let anyUnresolvedCritical = false
  const out = fields.map((f): SafeField => {
    const criticality = classifyCriticality(f.field)
    const r = protectOcrField({
      flow: ctx.flow,
      field_name: f.field,
      criticality,
      document_class: ctx.document_class ?? null,
      source_doc_type: ctx.source_doc_type ?? null,
      expected_source_doc_type: ctx.expected_source_doc_type ?? null,
      value_present: f.value != null && f.value !== '',
      candidate_value_present: (f.raw_cyrillic != null && f.raw_cyrillic !== '') || (f.value != null && f.value !== ''),
      review_required: f.review_required === true,
      confidence: typeof f.confidence === 'number' ? f.confidence : null,
      strong_source_anchor: ctx.strong_source_anchor === true,
      legacy_reader: ctx.legacy_reader === true,
      hard_case: ctx.hard_case === true,
      source_doc_id_hash: ctx.source_doc_id_hash ?? null,
      session_doc_id_hash: ctx.session_doc_id_hash ?? null,
      zero_usable_recognition: opts.zeroRecognition === true,
    })
    if ((criticality === 'critical_identity' || criticality === 'critical_document') &&
        (r.review_required || r.manual_required)) {
      anyUnresolvedCritical = true
    }
    if (r.final_value_allowed) {
      // safe → keep as-is, only ensure review flag isn't lowered
      return { ...f, review_required: f.review_required === true || r.review_required, manual_required: r.manual_required }
    }
    // unsafe → candidate-only: value out of the value slot, kept as candidate
    return {
      ...f,
      candidate_value: f.value ?? f.raw_cyrillic ?? null,
      value: null,
      review_required: true,
      manual_required: r.manual_required,
      safety_decision: r.decision,
      safety_reason_codes: r.reason_codes,
    }
  })
  return { fields: out, anyUnresolvedCritical }
}
