/**
 * docintel/transliterationPolicy — THE single place that turns a Cyrillic
 * vision read into a canonical value. Centralizes the rule proven empirically
 * (2026-05-27) and mandated by v5 §13: vision reads Cyrillic, KMU-55 produces
 * Latin — the LLM NEVER transliterates names (free-form LLM output is unstable
 * and non-reproducible). Every product flow gets identical canonical values from here.
 */

import { transliterateKMU55, transliterateRussian, detectNameScript } from '@uscis-helper/knowledge'
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
 * Owner-locked source-script rule (2026-06-10): VISIBLE source script controls
 * transliteration. A name line is AMBIGUOUS when its script is not visually
 * confirmed — no distinctive Ukrainian letter (і/ї/є/ґ) AND no distinctive
 * Russian letter (ы/э/ё/ъ). Old Soviet/bilingual docs legitimately mix UA and RU
 * lines, so we never guess the document's language: an ambiguous name must go to
 * review (review_required=true, reason_code=source_script_ambiguous) and must NOT
 * be finalized by C3 until the source script is confirmed or the user/admin
 * confirms. D2 may still surface a best-effort KMU-55 candidate for the screen.
 *
 * Only active behind RU_TRANSLIT_ENABLED (the RU/UA routing feature); when OFF we
 * keep the legacy KMU-55-for-all behavior and do not raise this flag.
 */
export function isNameSourceScriptAmbiguous(
  cy: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.RU_TRANSLIT_ENABLED !== '1') return false
  const s = (cy ?? '').trim()
  if (!s) return false
  return detectNameScript(s) === 'unknown'
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

    case 'name': {
      // Names: KMU-55 (Ukrainian). Never the LLM's own Latin.
      if (!cy) return null
      // RU_TRANSLIT_ENABLED (default OFF): a name line written in clearly-RUSSIAN
      // script (ы/э/ё/ъ present) is transliterated with the Russian system, not
      // KMU-55 — Soviet/bilingual docs are as-written, never harmonized to Ukrainian.
      // 'unknown' (no distinctive letter) yields a best-effort KMU-55 CANDIDATE so
      // the review screen isn't empty — but the reader flags it ambiguous and C3
      // must not finalize it (see isNameSourceScriptAmbiguous + the source-script
      // gate in documentFieldReader). Visible source controls translit; ambiguity
      // blocks final. (For the APPLICANT's own name, MRZ/passport stays controlling.)
      if (process.env.RU_TRANSLIT_ENABLED === '1' && detectNameScript(cy) === 'ru') {
        return transliterateRussian(cy) || null
      }
      return transliterateKMU55(cy) || null
    }

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
