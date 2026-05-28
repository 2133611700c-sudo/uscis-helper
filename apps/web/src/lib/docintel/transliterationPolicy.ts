/**
 * docintel/transliterationPolicy — THE single place that turns a Cyrillic
 * vision read into a canonical value. Centralizes the rule proven empirically
 * (2026-05-27) and mandated by v5 §13: vision reads Cyrillic, KMU-55 produces
 * Latin — the LLM NEVER transliterates names (it returned "Troshchianets" for
 * Тростянець). Every product flow gets identical canonical values from here.
 */

import { transliterateKMU55 } from '@uscis-helper/knowledge'
import { normalizeProvince, normalizeCity } from '@/lib/tps/dictionaryBridge'
import type { FieldKind, VisionFieldRead } from './types'

/**
 * Strip a leading Ukrainian settlement-type prefix from a place name, robust to
 * dotted/spaced variants (смт, с.м.т., смт., м., с., село, місто, селище
 * міського типу). The bare locality remains; the original (with type) is kept
 * by the caller in raw_cyrillic so translation can re-add "urban-type settlement".
 */
export function stripSettlementPrefix(cy: string): string {
  return cy
    .replace(
      /^\s*(?:с\.?\s*м\.?\s*т\.?|смт\.?|селище(?:\s+міського\s+типу)?|місто|село|м\.|с\.)\s+/iu,
      '',
    )
    .trim()
}

/**
 * Convert one vision read to its canonical value by field kind.
 * Returns null when there is nothing trustworthy to emit (no guessing).
 */
export function toCanonicalValue(read: VisionFieldRead, kind: FieldKind): string | null {
  const cy = (read.cyrillic ?? '').trim()

  switch (kind) {
    case 'date':
      // Dates: trust only a well-formed ISO from the model; never guess.
      return read.iso_date && /^\d{4}-\d{2}-\d{2}$/.test(read.iso_date) ? read.iso_date : null

    case 'name':
      // Names: KMU-55 ONLY. Never the LLM's own Latin.
      return cy ? transliterateKMU55(cy) || null : null

    case 'place_city': {
      // City: strip the settlement-type prefix so the canonical value is the
      // BARE city (USCIS form wants "Trostianets", not "urban-type settlement
      // Trostianets"). Vision may return дотted/spaced variants (смт, с.м.т.,
      // м., с.). We strip on the Cyrillic first (robust to dots), then run
      // normalizeCity (blocklist/geo-corrections), then KMU-55. The settlement
      // type stays in raw_cyrillic for the translation layer to re-add.
      if (!cy) return null
      const bare = stripSettlementPrefix(cy)
      const nc = normalizeCity(bare)
      if (nc.value === null) return null // blocklisted
      return /[a-zA-Z]/.test(nc.value) ? nc.value : transliterateKMU55(nc.value) || null
    }

    case 'place_oblast':
      // Oblast → nominative + "Oblast" (e.g. Вінницька область → Vinnytsia Oblast).
      return cy ? normalizeProvince(cy).value || transliterateKMU55(cy) || null : null

    case 'doc_number':
      // Document/series/act numbers: preserve exactly. If the model returned a
      // Latin/numeric value in cyrillic field, keep it verbatim.
      return cy || null

    case 'agency':
      // Agency name: transliterate as a baseline; downstream glossary may refine.
      return cy ? transliterateKMU55(cy) || cy : null

    case 'text':
    default:
      return cy ? transliterateKMU55(cy) || cy : null
  }
}
