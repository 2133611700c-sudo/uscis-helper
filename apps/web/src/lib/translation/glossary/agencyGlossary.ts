/**
 * Ukrainian Agency Glossary Resolver — Messenginfo v5.0
 *
 * Resolves Ukrainian/Soviet agency abbreviations found in passport documents.
 * Rules:
 *  - Before July 2015: militia-era units → "Militia Department", NOT "Police"
 *  - After July 2015: НПУ/УНП/ГУНП → "National Police of Ukraine"
 *  - Unknown abbreviations → review_required = true, reason = abbreviation_not_verified
 */
import glossaryData from './ukraine_agency_abbreviations.json'

export interface GlossaryEntry {
  uk_full: string
  en: string
  confidence: 'high' | 'medium' | 'low'
  era?: string
  note?: string
  review_required: boolean
}

export interface GlossaryResult {
  abbreviation: string
  resolved_en: string | null
  uk_full: string | null
  confidence: 'high' | 'medium' | 'low' | 'unknown'
  review_required: boolean
  reason?: string
  era?: string
  note?: string
}

const ENTRIES = glossaryData.entries as Record<string, GlossaryEntry>

// Abbreviations that must NEVER become "Police" in pre-2015 context
const MILITIA_ERA_ABBRS = new Set(['РВ', 'РВ УМВС', 'МВ', 'МРВ', 'ВМ', 'ММВ', 'УМВС', 'ГУМВС', 'МВС', 'МВД', 'УМВД', 'ГУМВД'])

/**
 * Resolve an agency abbreviation from a document.
 * @param abbr     The abbreviation found in OCR text, e.g. "РВ УМВС"
 * @param docYear  Year of document issuance (to apply era rules)
 */
export function resolveAgencyAbbr(abbr: string, docYear?: number): GlossaryResult {
  const key = abbr.trim().toUpperCase()
  const entry = ENTRIES[key]

  // Unknown abbreviation
  if (!entry) {
    return {
      abbreviation: abbr,
      resolved_en: null,
      uk_full: null,
      confidence: 'unknown',
      review_required: true,
      reason: 'abbreviation_not_verified',
    }
  }

  // Era safety check: if doc is pre-2015 and abbr is militia-era, verify not rendered as Police
  let note = entry.note
  if (docYear && docYear < 2015 && MILITIA_ERA_ABBRS.has(key)) {
    // Confirm the resolved English does NOT contain "Police"
    if (entry.en.toLowerCase().includes('police')) {
      return {
        abbreviation: abbr,
        resolved_en: null,
        uk_full: entry.uk_full,
        confidence: 'low',
        review_required: true,
        reason: 'militia_era_police_label_rejected',
        era: entry.era,
        note: 'Document pre-dates National Police (July 2015). Cannot use Police label.',
      }
    }
  }

  // Post-2015 police abbreviations on pre-2015 docs need review
  if (docYear && docYear < 2015 && ['НПУ', 'УНП', 'ГУНП'].includes(key)) {
    return {
      abbreviation: abbr,
      resolved_en: entry.en,
      uk_full: entry.uk_full,
      confidence: 'low',
      review_required: true,
      reason: 'police_abbr_on_pre2015_doc',
      era: entry.era,
    }
  }

  return {
    abbreviation: abbr,
    resolved_en: entry.en,
    uk_full: entry.uk_full,
    confidence: entry.confidence as GlossaryResult['confidence'],
    review_required: entry.review_required,
    era: entry.era,
    note,
  }
}

/**
 * Scan a raw text string for known abbreviations and resolve them.
 * Returns all matches found, in order of appearance.
 */
export function scanTextForAgencyAbbr(text: string, docYear?: number): GlossaryResult[] {
  if (!text) return []
  // Sort keys longest-first so "РВ УМВС" matches before "РВ"
  const sortedKeys = Object.keys(ENTRIES).sort((a, b) => b.length - a.length)
  const results: GlossaryResult[] = []
  const seen = new Set<string>()
  for (const key of sortedKeys) {
    if (text.includes(key) && !seen.has(key)) {
      seen.add(key)
      results.push(resolveAgencyAbbr(key, docYear))
    }
  }
  return results
}

/**
 * Find Cyrillic uppercase sequences (2+ chars) in text that are NOT in the glossary.
 * These look like abbreviations (e.g. "УМКН", "ХXYZ") but are unrecognized.
 * Returns an array of GlossaryResult with review_required=true.
 */
function findUnrecognizedAbbreviations(text: string): GlossaryResult[] {
  // Match 2+ consecutive uppercase Cyrillic letters (optionally followed by space + more Cyrillic uppercase)
  // This catches standalone tokens like УМКН or multi-part ones like РВ УМВС handled by known scanner
  const CYRILLIC_UPPER_ABBR = /[А-ЯЁІЇЄҐ]{2,}(?:\s[А-ЯЁІЇЄҐ]{2,})*/gu
  const results: GlossaryResult[] = []
  const seen = new Set<string>()

  for (const match of text.matchAll(CYRILLIC_UPPER_ABBR)) {
    const token = match[0]
    // Skip if it's already a known key (will be handled by scanTextForAgencyAbbr)
    if (ENTRIES[token] || seen.has(token)) continue
    seen.add(token)
    results.push({
      abbreviation: token,
      resolved_en: null,
      uk_full: null,
      confidence: 'unknown',
      review_required: true,
      reason: 'abbreviation_not_verified',
    })
  }
  return results
}

/**
 * Resolve the `issued_by` field value from a document.
 * Detects abbreviations, resolves them, and returns the best English rendering.
 * Sets review_required if any abbreviation is unknown or era-conflicted.
 */
export function resolveIssuedBy(rawText: string, docYear?: number): {
  resolved: string
  review_required: boolean
  reason?: string
  glossary_confidence: string
} {
  if (!rawText) return { resolved: rawText, review_required: false, glossary_confidence: 'none' }

  const knownMatches = scanTextForAgencyAbbr(rawText, docYear)
  const unknownMatches = findUnrecognizedAbbreviations(rawText)
  const matches = [...knownMatches, ...unknownMatches]

  if (matches.length === 0) {
    return { resolved: rawText, review_required: false, glossary_confidence: 'none' }
  }

  // Build resolved text by replacing abbreviations
  let resolved = rawText
  let anyUnknown = false
  let anyReviewRequired = false
  let lowestConfidence = 'high'
  const reasons: string[] = []

  for (const match of matches) {
    if (match.resolved_en) {
      resolved = resolved.replace(match.abbreviation, match.resolved_en)
    }
    if (match.confidence === 'unknown' || match.confidence === 'low') anyUnknown = true
    if (match.review_required) {
      anyReviewRequired = true
      if (match.reason) reasons.push(match.reason)
    }
    if (match.confidence === 'unknown') lowestConfidence = 'unknown'
    else if (match.confidence === 'low' && lowestConfidence !== 'unknown') lowestConfidence = 'low'
    else if (match.confidence === 'medium' && lowestConfidence === 'high') lowestConfidence = 'medium'
  }

  return {
    resolved,
    review_required: anyReviewRequired || anyUnknown,
    reason: reasons.length > 0 ? reasons.join('; ') : undefined,
    glossary_confidence: lowestConfidence,
  }
}
