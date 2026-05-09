/**
 * Messenginfo Translation Engine — Core Types
 * v5.0 Final Controlled Autonomy Standard
 */

export type TranslationStatus =
  | 'created'
  | 'uploaded'
  | 'extracted'
  | 'reviewed'
  | 'certified'
  | 'paid'
  | 'rendered'
  | 'downloaded'
  | 'manual_review'

export type LanguageLayer = 'uk' | 'ru' | 'mixed' | 'unknown'

export type DocumentType =
  | 'ua_passport_booklet'
  | 'ua_passport_id_card'
  | 'ua_passport_biometric'
  | 'ua_birth_certificate'
  | 'ua_marriage_certificate'
  | 'ua_death_certificate'
  | 'ua_drivers_license'
  | 'ua_diploma'
  | 'ua_school_certificate'
  | 'ua_military'
  | 'other'

export interface ExtractedField {
  field: string
  source_label: string
  source_zone: string
  bbox: [number, number, number, number]
  raw_value: string
  normalized_value: string
  language_layer: LanguageLayer
  confidence: number        // 0.0–1.0
  review_required: boolean
  evidence_crop_path?: string
  user_corrected?: boolean
  correction_class?: 'controlling_spelling' | 'ocr_error' | 'one_document_exception'
}

export interface CertificationRecord {
  signer_full_name: string
  language_pair_confirmed: boolean
  statement: string
  signature_typed_name: string
  signed_at: string          // ISO 8601
  address?: string
  phone?: string
  email?: string
  certification_version: string
}

export interface SourceTrace {
  field: string
  document_type: DocumentType
  source_label: string
  source_zone: string
  bbox: [number, number, number, number]
  raw_value: string
  normalized_value: string
  language_layer: LanguageLayer
  confidence: number
  review_required: boolean
}

export interface QAResult {
  status: 'PASS' | 'FAIL' | 'REVIEW_REQUIRED'
  failures: string[]
  warnings: string[]
  required_actions: string[]
}

export interface PacketState {
  session_id: string
  status: TranslationStatus
  document_type: DocumentType | null
  controlling_spelling: Record<string, string>   // field → latin spelling from official ID
  uploaded_pages: number
  total_pages_declared: number
  extracted_fields: ExtractedField[]
  source_traces: SourceTrace[]
  user_corrections: ExtractedField[]
  certification_record: CertificationRecord | null
  payment_confirmed: boolean
  payment_checkout_id: string | null
  qa_result: QAResult | null
  scope_title: string      // partial vs full scope
  locale: string
  created_at: string
  updated_at: string
}

export interface ImageQualityReport {
  overall: number          // 0.0–1.0
  issues: string[]
  retake_required: boolean
  retake_count: number
  user_message?: string
}
