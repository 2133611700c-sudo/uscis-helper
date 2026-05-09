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
  | 'ua_passport_booklet'       // Ukrainian internal passport (book format, blue cover)
  | 'ua_passport_internal'      // alias kept for backward compatibility
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

// ── Evidence / OCR provenance types ─────────────────────────────────────────

/**
 * How the field was located in the source image.
 * ocr_bbox          — exact bbox from a single OCR token (best)
 * combined_ocr_bbox — union of multiple OCR token bboxes (multi-word value)
 * full_image        — legacy: vision model saw whole image, bbox from model
 * zone_fallback     — no bbox available (OCR returned no matching token)
 */
export type EvidenceType = 'ocr_bbox' | 'combined_ocr_bbox' | 'full_image' | 'zone_fallback'

/**
 * Reliability of the bounding box.
 * exact       — single OCR token matched directly
 * combined    — multiple OCR tokens combined into union bbox
 * approximate — bbox present but uncertain (legacy vision path)
 * missing     — no usable bbox; review_required must be true for critical fields
 */
export type BboxStatus = 'exact' | 'combined' | 'approximate' | 'missing'

/**
 * One evidence block from a VisionProvider result.
 * Represents either a recognised field or a raw text block.
 */
export interface EvidenceItem {
  field?: string                              // field name when mapped; undefined for raw text blocks
  raw_text: string                            // verbatim text from this evidence zone
  bbox?: [number, number, number, number]    // [x0, y0, x1, y1] normalised 0–1; absent when missing
  page: number                                // 0-indexed page
  confidence: number                          // 0.0–1.0
  evidence_type: EvidenceType
  bbox_status: BboxStatus
}

/**
 * Canonical result returned by every VisionProvider implementation.
 */
export interface VisionExtractionResult {
  raw_text: string
  provider: 'google_vision' | 'deepseek_vision' | 'tesseract_deepseek' | 'manual'
  ocr_confidence: number         // 0.0–1.0 overall confidence
  pages: number                  // number of pages processed
  warnings: string[]
  created_at: string             // ISO 8601
  evidence_items?: EvidenceItem[] // per-field evidence blocks when available
}

/**
 * Contract that every OCR/Vision adapter must satisfy.
 */
export interface VisionProvider {
  extractRawTextFromDocument(document: {
    imageBase64?: string
    imageBuffer?: Buffer
    mimeType: string
    docType: DocumentType
    glossaryJson: string
    fieldTemplate: string[]
  }): Promise<VisionExtractionResult & {
    ok: boolean
    fields: ExtractedField[]
    imageQuality?: { overall: number; issues: string[] }
  }>
}

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
  // ── OCR ID evidence (v6 — Google Vision + DeepSeek Text path) ────────────
  ocr_ids?: string[]        // IDs from OcrWord/OcrLine that back this field
  combined_bbox?: [number, number, number, number]  // union of multi-word bboxes when ocr_ids.length > 1
  // ── Evidence provenance ───────────────────────────────────────────────────
  evidence_crop_path?: string
  evidence_type?: EvidenceType
  bbox_status?: BboxStatus
  user_corrected?: boolean
  correction_class?: 'controlling_spelling' | 'ocr_error' | 'one_document_exception'
}

export interface CertificationRecord {
  signer_full_name: string
  language_pair_confirmed: boolean
  statement: string
  signature_typed_name: string
  signed_at: string          // ISO 8601
  source_language?: string   // e.g. 'Ukrainian'
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
