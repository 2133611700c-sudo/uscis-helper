/**
 * GT corpus contract + metrics types (Stage 1/2 of docs/ocr/EVALUATION_PROTOCOL.md).
 *
 * This is the SCORING contract only — pure types + (in metrics.ts) pure functions.
 * The actual corpus VALUES (real documents / expected Cyrillic) live ONLY in
 * gitignored qa-private/ and are supplied by the owner; committed tests use FICTIONAL
 * data. printed and handwriting are ALWAYS scored + reported SEPARATELY.
 */

export type Rendering = 'printed' | 'handwritten'
export type QualityGrade = 'good' | 'medium' | 'poor'
export type RegionType = 'printed_line' | 'handwritten_field' | 'stamp' | 'signature' | 'mixed' | 'unknown'

/** One ground-truth field of one document in the corpus. */
export interface GroundTruthRecord {
  docId: string
  documentFamily: string // e.g. UA_BIRTH_CERT_MODERN | UA_BIRTH_CERT_SOVIET | RU_BIRTH_CERT_SOVIET
  template?: string | null
  fieldId: string
  /** expected source-script value; null = field legitimately ABSENT on this document. */
  expectedCyrillic: string | null
  regionType: RegionType
  qualityGrade: QualityGrade
  rendering: Rendering
  /** true when a correct system SHOULD abstain (unreadable / not present). */
  expectedAbstention: boolean
}

/** One model prediction for one field. */
export interface Prediction {
  docId: string
  fieldId: string
  /** null = abstained / produced no value. */
  value: string | null
  abstained: boolean
  /** optional evidence metadata for bbox/crop metrics. */
  hasBbox?: boolean
  bboxStatus?: 'exact' | 'combined' | 'approximate' | 'missing' | null
}

/** Per-field verdict (extends the existing CORRECT/WRONG/MISS/CORRECT_EMPTY/FABRICATED taxonomy). */
export type FieldVerdict =
  | 'EXACT'            // expected value present & matches
  | 'WRONG'            // produced a value that does not match the expected value
  | 'MISS'             // expected a value but abstained / empty
  | 'CORRECT_ABSTAIN'  // should abstain (absent/unreadable) and did
  | 'FABRICATED'       // should abstain but produced a value

export interface RollupCounts {
  total: number
  exact: number
  wrong: number
  miss: number
  correctAbstain: number
  fabricated: number
  /** field-exact rate over fields that SHOULD have a value (exact / (exact+wrong+miss)). */
  fieldExactRate: number
  /** mean CER over fields that should have a value. */
  meanCer: number
}

export interface AbstentionScore {
  /** of all abstentions made, fraction that were correct. */
  precision: number
  /** of all fields that should abstain, fraction the system abstained on. */
  recall: number
  shouldAbstain: number
  didAbstain: number
  correctAbstain: number
}

export interface EvidenceCoverage {
  /** fraction of (non-abstained) predictions carrying any bbox. */
  bboxCoverage: number
  /** fraction carrying an EXACT crop (bboxStatus === 'exact'). */
  exactCropRate: number
}
