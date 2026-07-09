/**
 * detectLanguageCountry.ts — ONE BRAIN ordered intake nodes #2 and #3 (after orientation).
 *
 * CANONICAL PIPELINE ORDER (owner 2026-07-08): intake → ORIENT → LANGUAGE → COUNTRY → TYPE → READ.
 * Language and country come BEFORE type — they narrow the candidate types (a Ukrainian-language
 * document from Ukraine can only be a Ukrainian type). This module is the language+country funnel
 * that was missing; type detection (detectDocumentType.ts) runs AFTER, scoped by these results.
 *
 * Grounded in measured evidence: language and country are read from PRINTED text/script/layout
 * (headers, "UKRAINE", MRZ country code, form numbers) — the model's proven-reliable strength,
 * never handwriting. Fail-closed: uncertain → 'unknown' / 'mixed', never a confident wrong guess.
 */

export type DocLanguage = 'uk' | 'ru' | 'en' | 'mixed' | 'unknown'
export type DocCountry = 'UA' | 'US' | 'SU' | 'other' | 'unknown' // SU = former USSR (Soviet-era docs)

export interface LanguageDetection {
  language: DocLanguage
  scripts_seen: string[] // e.g. ['cyrillic','latin']
  confidence: number
  measured: boolean
  // presence signals (fail-closed to null when the model doesn't report them). handwritingPresent
  // feeds the intake review policy (force_review_if_handwritten) + the 'handwriting_present' reason.
  printedTextPresent: boolean | null
  handwritingPresent: boolean | null
}
export interface CountryDetection {
  country: DocCountry
  confidence: number
  evidence: string | null // the printed cue read (e.g. "UKRAINE", "I-94", "УССР")
  measured: boolean
}

export const LANG_MIN_CONFIDENCE = 0.6
export const COUNTRY_MIN_CONFIDENCE = 0.6

export function langCountryDetectEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.DOC_LANG_COUNTRY_DETECT_ENABLED === '1'
}

export function buildLanguagePrompt(): string {
  return (
    'Identify the primary written LANGUAGE from the PRINTED text and script of this document image ' +
    '(judge the LANGUAGE from printed text only, ignoring handwriting for the language decision). ' +
    'SEPARATELY, report whether any PRINTED text is present and whether any HANDWRITTEN (cursive or ' +
    'hand-filled) text is present anywhere on the page. Return STRICT JSON: ' +
    '{"language":"uk|ru|en|mixed|unknown","scripts_seen":["cyrillic"|"latin"...],"confidence":0..1,' +
    '"printed_text_present":true|false,"handwriting_present":true|false}. ' +
    'Use "mixed" if two languages are printed together (e.g. a bilingual Russian+Ukrainian Soviet ' +
    'form). If the language is unclear, "unknown". Set handwriting_present true only if you actually ' +
    'see hand-written characters (not printed).'
  )
}

export function buildCountryPrompt(): string {
  return (
    'Look ONLY at the PRINTED text, emblems, form numbers, and layout of this document image ' +
    '(ignore handwriting). Which country ISSUED it? Return STRICT JSON: ' +
    '{"country":"UA|US|SU|other|unknown","confidence":0..1,"evidence":"<the printed cue you used, ' +
    'e.g. UKRAINE / I-94 / USCIS / УССР / СРСР>"}. Use "SU" for a Soviet-era (USSR) document ' +
    '(e.g. "УССР"/"СССР"/"СРСР" on the form). Use "UA" for modern Ukraine, "US" for United States. ' +
    'Base it on printed cues only; if unclear, "unknown".'
  )
}

export function normalizeLanguage(parsed: unknown, min = LANG_MIN_CONFIDENCE): LanguageDetection {
  const valid: DocLanguage[] = ['uk', 'ru', 'en', 'mixed', 'unknown']
  const p = (parsed ?? {}) as Record<string, unknown>
  const langRaw = typeof p.language === 'string' ? (p.language as DocLanguage) : 'unknown'
  const conf = typeof p.confidence === 'number' && p.confidence >= 0 && p.confidence <= 1 ? p.confidence : 0
  const scripts = Array.isArray(p.scripts_seen)
    ? p.scripts_seen.filter((s): s is string => typeof s === 'string').slice(0, 4)
    : []
  // 'mixed' and 'unknown' are always allowed (they ARE the honest low-certainty answers);
  // a specific language below threshold fails closed to 'unknown'.
  const isSpecific = langRaw === 'uk' || langRaw === 'ru' || langRaw === 'en'
  const language: DocLanguage = !valid.includes(langRaw)
    ? 'unknown'
    : isSpecific && conf < min
      ? 'unknown'
      : langRaw
  // presence signals: only accept a real boolean, else fail-closed to null (unknown, never a guess).
  const printedTextPresent = typeof p.printed_text_present === 'boolean' ? p.printed_text_present : null
  const handwritingPresent = typeof p.handwriting_present === 'boolean' ? p.handwriting_present : null
  return { language, scripts_seen: scripts, confidence: conf, measured: true, printedTextPresent, handwritingPresent }
}

export function normalizeCountry(parsed: unknown, min = COUNTRY_MIN_CONFIDENCE): CountryDetection {
  const valid: DocCountry[] = ['UA', 'US', 'SU', 'other', 'unknown']
  const p = (parsed ?? {}) as Record<string, unknown>
  const cRaw = typeof p.country === 'string' ? (p.country as DocCountry) : 'unknown'
  const conf = typeof p.confidence === 'number' && p.confidence >= 0 && p.confidence <= 1 ? p.confidence : 0
  const evidence = typeof p.evidence === 'string' ? p.evidence : null
  const isSpecific = cRaw === 'UA' || cRaw === 'US' || cRaw === 'SU'
  const country: DocCountry = !valid.includes(cRaw)
    ? 'unknown'
    : isSpecific && conf < min
      ? 'unknown'
      : cRaw
  return { country, confidence: conf, evidence, measured: true }
}

/**
 * Registry-id prefixes reachable given a detected country — the funnel that scopes TYPE detection.
 * SU (Soviet-era) and UA both reach the ua_* / soviet types (a Soviet birth cert is still a
 * ua_birth_certificate_soviet in this registry). US reaches us_*.
 */
export function countryToTypePrefixes(country: DocCountry): string[] {
  switch (country) {
    case 'UA':
    case 'SU':
      return ['ua_']
    case 'US':
      return ['us_']
    default:
      return [] // unknown/other ⇒ no scoping (all types remain candidates, or ask the human)
  }
}

async function classifyWith<T>(
  imageBuffer: Buffer,
  visionCall: (prompt: string, image: Buffer) => Promise<string | null>,
  prompt: string,
  normalize: (parsed: unknown) => T,
  failValue: T,
): Promise<T> {
  let raw: string | null
  try {
    raw = await visionCall(prompt, imageBuffer)
  } catch {
    return failValue
  }
  if (!raw) return failValue
  try {
    return normalize(JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '').trim()))
  } catch {
    return failValue
  }
}

export function detectLanguage(
  imageBuffer: Buffer,
  visionCall: (prompt: string, image: Buffer) => Promise<string | null>,
): Promise<LanguageDetection> {
  return classifyWith(imageBuffer, visionCall, buildLanguagePrompt(), (p) => normalizeLanguage(p),
    { language: 'unknown', scripts_seen: [], confidence: 0, measured: false, printedTextPresent: null, handwritingPresent: null })
}

export function detectCountry(
  imageBuffer: Buffer,
  visionCall: (prompt: string, image: Buffer) => Promise<string | null>,
): Promise<CountryDetection> {
  return classifyWith(imageBuffer, visionCall, buildCountryPrompt(), (p) => normalizeCountry(p),
    { country: 'unknown', confidence: 0, evidence: null, measured: false })
}
