/**
 * canonical/core/translationAdapter.ts — B2
 *
 * Bridges docintel ↔ Core ↔ Translation in both directions:
 *   docintel ExtractedDocField[] → FieldCandidate[] (Core input)
 *   CanonicalField[] → FieldOut[] (Translation wizard output)
 *
 * CRITICAL: raw_cyrillic (original handwritten/printed Ukrainian) is preserved
 * through a separate cyrillicMap so it is never lost after KMU-55 transliteration.
 * The Core's rawValue holds the KMU-55 Latin; cyrillicMap holds the original script.
 *
 * This file is pure: no I/O, no AI calls, no OCR. It only maps data.
 * Used behind ONE_BRAIN_CORE_ENABLED=1 in vision-extract/route.ts (B2).
 */
import type { ExtractedDocField } from '@/lib/docintel/types'
import type { CanonicalField } from '../types'
import type { FieldCandidate } from './types'

export interface FieldOut {
  field: string
  /** KMU-55 transliterated / USCIS-ready English value */
  value: string | null
  /** Original Cyrillic as read from the document — never silently dropped */
  raw_cyrillic: string | null
  confidence: number
  review_required: boolean
  kind: string
  source_page?: number
}

/**
 * Build a map of field_key → raw_cyrillic from docintel output.
 * Call this BEFORE converting to FieldCandidate so the Cyrillic is not lost.
 */
export function buildCyrillicMap(fields: ExtractedDocField[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const f of fields) {
    if (f.raw_cyrillic) map.set(f.field, f.raw_cyrillic)
  }
  return map
}

/**
 * Convert one docintel output field into a Core FieldCandidate.
 * Uses the KMU-55 Latin value as the candidate value (Core sees English).
 */
export function docintelToCandidate(f: ExtractedDocField, page: number): FieldCandidate {
  return {
    key: f.field,
    value: f.value ?? '',           // KMU-55 Latin — what the Core arbitrates
    source: 'ai_vision',
    confidence: f.confidence,
    provider: `docintel:${f.provider}:page${page}`,
    reviewRequired: f.review_required,
    reviewReasons: f.review_required ? ['reader_flagged'] : [],
  }
}

/**
 * Convert Core output to the FieldOut shape vision-extract returns.
 * cyrillicMap (from buildCyrillicMap) restores the original Cyrillic that
 * was stripped by KMU-55 transliteration.
 */
export function canonicalToFieldOut(
  f: CanonicalField,
  cyrillicMap?: Map<string, string>,
): FieldOut {
  return {
    field: f.key,
    value: f.normalizedValue ?? f.rawValue ?? null,
    raw_cyrillic: cyrillicMap?.get(f.key) ?? f.rawValue ?? null,
    confidence: f.confidence.final ?? 0,
    review_required: f.reviewRequired,
    kind: f.source,
  }
}

/**
 * toTranslationRows — named alias for the B2 product adapter.
 * Converts all Core fields to Translation FieldOut[], preserving Cyrillic.
 * Does NOT call OCR or AI — pure field mapping only.
 */
export function toTranslationRows(
  fields: CanonicalField[],
  cyrillicMap: Map<string, string>,
): FieldOut[] {
  return fields.map((f) => canonicalToFieldOut(f, cyrillicMap))
}
