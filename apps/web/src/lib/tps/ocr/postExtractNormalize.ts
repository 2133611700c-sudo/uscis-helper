/**
 * Post-extraction normalization — applies @uscis-helper/knowledge rules
 * to extracted fields BEFORE they reach the wizard.
 *
 * This runs inside the OCR route, after module extraction and Brain,
 * but before the response is returned. It normalizes field values
 * so the wizard receives clean, USCIS-ready data.
 *
 * Lightweight by design — only normalizes what needs normalizing.
 * Raw values are preserved for audit trail.
 */

import { normalizeOblastToNominative } from '@uscis-helper/knowledge'
import type { TpsExtractedField } from '@/lib/tps/types'

/**
 * Normalize extracted fields in-place using canonical knowledge rules.
 * Returns the same array with updated normalized_value where applicable.
 * Also returns metadata about what was normalized and any conflicts found.
 */
export function postExtractNormalize(fields: TpsExtractedField[]): {
  fields: TpsExtractedField[]
  normalizations_applied: string[]
  conflicts: Array<{ field: string; reason: string }>
  low_confidence: Array<{ field: string; confidence: number }>
} {
  const normalizations: string[] = []
  const conflicts: Array<{ field: string; reason: string }> = []
  const lowConf: Array<{ field: string; confidence: number }> = []

  for (const f of fields) {
    // Track low-confidence fields for mail-ready gate
    if (f.confidence !== null && f.confidence < 0.7) {
      lowConf.push({ field: f.field, confidence: f.confidence })
    }

    // Oblast genitive → nominative (DMS-verified English)
    if (f.field === 'province_of_birth' && f.normalized_value) {
      const norm = normalizeOblastToNominative(f.normalized_value)
      if (norm) {
        f.normalized_value = norm.transliterated
        f.passes = [...f.passes, 'knowledge_oblast_nominative']
        normalizations.push(`province_of_birth: "${f.raw_value}" → "${norm.transliterated}"`)
      }
    }

    // City of birth: expand Ukrainian settlement type abbreviations
    // "смт. Устинівка" → "Устинівка" (strip prefix, pdfPrefiller transliterates)
    // "м. Київ" → "Київ"
    // "с. Іванівка" → "Іванівка"
    if (f.field === 'city_of_birth' && f.normalized_value) {
      const cleaned = f.normalized_value
        .replace(/^смт\.?\s*/i, '')    // селище міського типу → strip
        .replace(/^с-ще\.?\s*/i, '')   // селище → strip
        .replace(/^м\.?\s*/i, '')      // місто → strip
        .replace(/^с\.?\s*/i, '')      // село → strip
        .replace(/^сел\.?\s*/i, '')    // село → strip
        .replace(/^хут\.?\s*/i, '')    // хутір → strip
        .replace(/^п\.?г\.?т\.?\s*/i, '') // пгт (Russian) → strip
        .replace(/^селище\s+міського\s+типу\s*/i, '') // full form → strip
        .trim()
      if (cleaned !== f.normalized_value) {
        normalizations.push(`city_of_birth: "${f.normalized_value}" → "${cleaned}"`)
        f.normalized_value = cleaned
        f.passes = [...f.passes, 'knowledge_city_prefix_stripped']
      }
    }

    // Track duplicate field values across documents for conflict detection
    // (e.g., name from passport MRZ vs name from DL)
  }

  return { fields, normalizations_applied: normalizations, conflicts, low_confidence: lowConf }
}
