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
import { settlementDesignatorEn } from '@uscis-helper/knowledge'
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
  /** ENSEMBLE_DATE: reasons + the second engine's date reading on a cross-engine conflict. */
  review_reasons?: string[]
  ensemble_candidate?: string | null
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
 * Uses the KMU-55 Latin value as the candidate value (Core arbitrates Latin).
 * Phase 2.0 (GAP A fix): rawCyrillic is now threaded so D2 sees original Cyrillic,
 * not the already-transliterated value.
 */
export function docintelToCandidate(f: ExtractedDocField, page: number): FieldCandidate {
  return {
    key: f.field,
    value: f.value ?? '',           // KMU-55 Latin — what the Core arbitrates
    rawCyrillic: f.raw_cyrillic ?? undefined,  // original Cyrillic for D2 authority layer
    source: 'ai_vision',
    confidence: f.confidence,
    provider: `docintel:${f.provider}:page${page}`,
    reviewRequired: f.review_required,
    // Carry the reader's SPECIFIC reasons (source_script_ambiguous, date_role_conflict,
    // fallback_model_used…). Replacing them with a generic tag blinded the D5 review
    // screen — found by a live prod test on a real handwritten birth cert (2026-06-10).
    reviewReasons: f.review_reasons?.length
      ? [...f.review_reasons]
      : f.review_required ? ['reader_flagged'] : [],
  }
}

/**
 * Convert Core output to the FieldOut shape vision-extract returns.
 * Phase 2.0: prefer f.rawCyrillic (threaded from FieldCandidate) over cyrillicMap
 * — the map remains for backward compat when rawCyrillic is absent.
 */
export function canonicalToFieldOut(
  f: CanonicalField,
  cyrillicMap?: Map<string, string>,
): FieldOut {
  // Phase 3 (ADR-017 C3 contract): use finalValue when C3 has run.
  // finalValue=string → C3 accepted (release). finalValue=null → C3 rejected (block).
  // finalValue=undefined → C3 not run (flag OFF); fall back to normalizedValue for backward compat.
  let value = f.finalValue !== undefined ? f.finalValue : (f.normalizedValue ?? f.rawValue ?? null)
  const rawCyr = f.rawCyrillic ?? cyrillicMap?.get(f.key) ?? null
  // SETTLEMENT DESIGNATOR re-add (hard rule: «смт» = "urban-type settlement").
  // Extraction strips the prefix from the canonical city value; for the
  // TRANSLATION product the document must mirror the source, so the English
  // designator (taken ONLY from the raw Cyrillic the model read — never
  // inferred) is restored as a PREFIX, mirroring the Ukrainian «смт Тростянець»
  // order: "urban-type settlement Trostianets" (a bare-city suffix read oddly and
  // landed at the end of composite place strings). Guarded against double-add.
  if (value && rawCyr && /city|place_of_birth/.test(f.key)) {
    const designator = settlementDesignatorEn(rawCyr)
    if (designator && !value.toLowerCase().includes(designator)) {
      value = `${designator} ${value}`
    }
  }
  return {
    field: f.key,
    value,
    raw_cyrillic: rawCyr,
    confidence: f.confidence.final ?? 0,
    review_required: f.reviewRequired,
    // Surface WHY review is needed (the D5 screen explains it to the user).
    // Omitted when empty to keep the response shape unchanged for clean fields.
    ...(f.reviewReasons?.length ? { review_reasons: [...f.reviewReasons] } : {}),
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
