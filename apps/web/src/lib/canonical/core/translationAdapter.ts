/**
 * canonical/core/translationAdapter.ts
 *
 * Thin bridge: converts docintel ExtractedDocField[] → FieldCandidate[] (Core
 * input) and CanonicalField[] → the FieldOut shape the vision-extract route returns.
 *
 * Used by vision-extract/route.ts behind ONE_BRAIN_CORE_ENABLED=1.
 * Pure. No side effects, no I/O.
 */
import type { ExtractedDocField } from '@/lib/docintel/types'
import type { CanonicalField } from '../types'
import type { FieldCandidate } from './types'

export interface FieldOut {
  field: string
  value: string | null
  raw_cyrillic: string | null
  confidence: number
  review_required: boolean
  kind: string
  source_page?: number
}

/** Convert one docintel output field into a Core FieldCandidate. */
export function docintelToCandidate(f: ExtractedDocField, page: number): FieldCandidate {
  return {
    key: f.field,
    value: f.value ?? '',
    source: 'ai_vision',
    confidence: f.confidence,
    provider: `docintel:${f.provider}:page${page}`,
    reviewRequired: f.review_required,
    reviewReasons: f.review_required ? ['reader_flagged'] : [],
  }
}

/** Convert Core output back to the FieldOut shape vision-extract returns. */
export function canonicalToFieldOut(f: CanonicalField): FieldOut {
  return {
    field: f.key,
    value: f.normalizedValue ?? f.rawValue ?? null,
    raw_cyrillic: f.rawValue ?? null,
    confidence: f.confidence.final ?? 0,
    review_required: f.reviewRequired,
    kind: f.source,
  }
}
