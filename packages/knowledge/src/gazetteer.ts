/**
 * gazetteer.ts — D2 Validator: snap a handwriting-OCR place reading to a REAL
 * Ukrainian place using a closed vocabulary + Cyrillic-confusion-weighted edit
 * distance.
 *
 * WHY: handwritten Cyrillic OCR confuses letter pairs that look alike by hand
 * (Т↔П, И↔Н, Ш↔Т, Е↔Є, Л↔А...). "Простянець" is a misread of the real city
 * "Тростянець". Instead of one hardcoded correction, we score the read against
 * a gazetteer of real places and snap to the nearest one when it is close
 * enough — generalizing the fix to ALL places.
 *
 * Seed set below = 24 oblast centres + the cities present in the project's
 * real-document set + common raion centres. Production MUST load the full
 * KOATUU / "Кодифікатор адміністративно-територіальних одиниць" (~28-30k
 * settlements) into GAZETTEER — the matcher does not change, only the data.
 *
 * Returns Cyrillic; KMU-55 transliteration happens downstream.
 */

export interface PlaceMatch {
  /** The value to USE. NEVER a silent fuzzy replacement: on an EXACT match it is the
   *  gazetteer name; on a fuzzy/no match it is the RAW cleaned read (preserved). */
  value: string
  /** True ONLY on an exact gazetteer match. A fuzzy candidate is NOT a match. */
  matched: boolean
  /** Weighted edit distance to the nearest entry (0 = exact). */
  distance: number
  /** Human must confirm (any fuzzy candidate or no confident match). */
  review_required: boolean
  /** Fuzzy candidate to SUGGEST (never silently applied). null on exact/unknown. */
  suggestedValue?: string | null
  reason: string
}

/**
 * Letter pairs that look alike in Ukrainian handwriting / are common OCR
 * confusions. A substitution between a pair costs LESS than a normal edit, so
 * "Простянець"→"Тростянець" (П↔Т) scores as nearly-equal.
 */
const CONFUSABLE: Array<[string, string]> = [
  ['т', 'п'], ['и', 'н'], ['ш', 'т'], ['ш', 'щ'], ['е', 'є'], ['и', 'й'],
  ['л', 'а'], ['о', 'с'], ['р', 'г'], ['ц', 'щ'], ['в', 'б'], ['м', 'ш'],
  ['н', 'п'], ['і', 'и'], ['ї', 'і'], ['у', 'ч'], ['д', 'л'], ['к', 'н'],
]
const CONFUSE_COST = 0.4 // vs 1.0 for an unrelated substitution

function confusable(a: string, b: string): boolean {
  return CONFUSABLE.some(([x, y]) => (a === x && b === y) || (a === y && b === x))
}

/** Weighted Levenshtein: confusable substitutions are cheap. Case-insensitive. */
export function confusionDistance(a: string, b: string): number {
  const s = a.toLocaleLowerCase('uk')
  const t = b.toLocaleLowerCase('uk')
  const n = s.length
  const m = t.length
  if (!n) return m
  if (!m) return n
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 0; i <= n; i++) d[i][0] = i
  for (let j = 0; j <= m; j++) d[0][j] = j
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sc = s[i - 1] === t[j - 1] ? 0 : confusable(s[i - 1], t[j - 1]) ? CONFUSE_COST : 1
      d[i][j] = Math.min(
        d[i - 1][j] + 1,      // deletion
        d[i][j - 1] + 1,      // insertion
        d[i - 1][j - 1] + sc, // substitution (weighted)
      )
    }
  }
  return d[n][m]
}

/**
 * Seed gazetteer. Cyrillic nominative. EXTEND with full KOATUU in production.
 * Includes the real-document set: Тростянець, Шаргород, Енергодар, Коломия.
 */
export const GAZETTEER: string[] = [
  // 24 oblast centres + Kyiv
  'Київ', 'Харків', 'Одеса', 'Дніпро', 'Львів', 'Запоріжжя', 'Кривий Ріг',
  'Миколаїв', 'Маріуполь', 'Вінниця', 'Херсон', 'Полтава', 'Чернігів',
  'Черкаси', 'Житомир', 'Суми', 'Хмельницький', 'Чернівці', 'Рівне',
  'Кропивницький', 'Івано-Франківськ', 'Тернопіль', 'Луцьк', 'Ужгород', 'Луганськ', 'Донецьк',
  // real-document set + common raion centres
  'Тростянець', 'Шаргород', 'Енергодар', 'Коломия', 'Бар', 'Жмеринка',
  'Могилів-Подільський', 'Козятин', 'Гайсин', 'Ладижин', 'Бердичів',
  'Біла Церква', 'Бровари', 'Ірпінь', 'Бориспіль', 'Мелітополь', 'Бердянськ',
  'Нікополь', 'Павлоград', 'Кам\'янець-Подільський', 'Мукачево', 'Дрогобич',
  'Самбір', 'Стрий', 'Нововолинськ', 'Ковель', 'Конотоп', 'Шостка',
  'Умань', 'Сміла', 'Ніжин', 'Прилуки', 'Лубни', 'Кременчук', 'Горішні Плавні',
]

const GAZ_LOWER = GAZETTEER.map((c) => c.toLocaleLowerCase('uk'))

/** Clean a place token: strip settlement-type prefixes, trailing punctuation. */
function cleanPlace(raw: string): string {
  return raw
    .replace(/^\s*(?:с\.?\s*м\.?\s*т\.?|смт\.?|пгт\.?|селище(?:\s+міського\s+типу)?|місто|село|м\.|с\.)\s+/iu, '')
    .replace(/[.,;]+$/g, '')
    .trim()
}

/**
 * Snap a place reading to the nearest real Ukrainian place.
 * threshold: max (distance / length) to accept a snap. 0.34 ≈ "one cheap
 * confusable swap in a short word" still snaps; gibberish does not.
 */
export function snapCity(raw: string, opts: { threshold?: number } = {}): PlaceMatch {
  const threshold = opts.threshold ?? 0.34
  const cleaned = cleanPlace(raw ?? '')
  if (!cleaned) return { value: '', matched: false, distance: Infinity, review_required: true, suggestedValue: null, reason: 'empty' }

  const lower = cleaned.toLocaleLowerCase('uk')
  const exactIdx = GAZ_LOWER.indexOf(lower)
  if (exactIdx >= 0) {
    return { value: GAZETTEER[exactIdx], matched: true, distance: 0, review_required: false, suggestedValue: null, reason: 'exact gazetteer match' }
  }

  let best = Infinity
  let bestIdx = -1
  for (let i = 0; i < GAZ_LOWER.length; i++) {
    const dist = confusionDistance(lower, GAZ_LOWER[i])
    if (dist < best) { best = dist; bestIdx = i }
  }

  const norm = best / Math.max(lower.length, GAZ_LOWER[bestIdx]?.length ?? 1)
  if (bestIdx >= 0 && norm <= threshold) {
    // S1 NO-SILENT-SNAP: a fuzzy candidate is a SUGGESTION, never a silent final
    // value. Keep the RAW read; surface the nearest entry as suggestedValue; force
    // review. (Was: value = GAZETTEER[bestIdx] → "Ярошенець" silently became
    // "Тростянець".) matched=false because we did NOT replace.
    return {
      value: cleaned,
      matched: false,
      distance: best,
      review_required: true,
      suggestedValue: GAZETTEER[bestIdx],
      reason: 'fuzzy_geography_match',
    }
  }

  // No confident match — keep the cleaned read, flag for review (could be a
  // village not yet in the seed gazetteer; production KOATUU would catch it).
  return { value: cleaned, matched: false, distance: best, review_required: true, suggestedValue: null, reason: 'unknown_geography' }
}
