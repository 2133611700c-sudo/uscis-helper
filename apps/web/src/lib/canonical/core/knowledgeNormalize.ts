/**
 * canonical/core/knowledgeNormalize.ts — D2 knowledge as an AUTHORITY LAYER (ADR-017 §D2).
 *
 * The dictionary is NOT an auto-replace of the reader's value. It returns a DECISION with
 * provenance + a rule id + an action, and it NEVER silently substitutes a critical value on a
 * conflict — a conflict surfaces a `candidateValue` for human review, the read value is kept.
 *
 * Action contract:
 *   - accept   : deterministic, safe transform of the read (KMU-55 of clean Cyrillic, oblast
 *                genitive→nominative, known authority, gazetteer EXACT, date parse). finalValue set.
 *   - preserve : Latin / controlling spelling (MRZ) — keep as-is, only case cleanup. finalValue set.
 *   - suggest  : the dictionary has a DIFFERENT value than the read but cannot prove it (gazetteer
 *                fuzzy, generated patronymic). finalValue=null; candidateValue offered; review.
 *   - review   : cannot validate / suspicious (Russian spelling on a UA doc, patronymic fragment,
 *                unknown authority, unparsed date). finalValue=null; review. (candidate optional)
 *   - block    : nothing usable. finalValue=null.
 *
 * Pure: no I/O, no env, no flags. The arbiter (gated on KNOWLEDGE_BRAIN_ENABLED) decides what to do
 * with the decision; OFF ⇒ this is never called ⇒ byte-identical.
 */
import {
  transliterateKMU55,
  transliterateRussian,
  convertDateToUSCIS,
  formatLatinName,
  reconcilePatronymic,
  isValidPatronymic,
  snapCity,
  settlementDesignatorEn,
  normalizeName,
  normalizePlace,
  normalizeForeignPlace,
  normalizeAuthority,
  normalizeSex,
  normalizeOblastToNominative,
  generatePatronymic,
  generatePatronymicRu,
  autoCorrectOblast,
  autoCorrectSex,
  autoCorrectCivilStatus,
  autoCorrectCountry,
  autoCorrectDateParts,
  type OutputMode,
  type Sex,
  type NormalizedField,
  type NormalizationContext,
} from '@uscis-helper/knowledge'
import { stripCountryCode } from '@/lib/docintel/transliterationPolicy'

export type KnowledgeAction = 'accept' | 'preserve' | 'suggest' | 'review' | 'block'

export interface KnowledgeDecision {
  action: KnowledgeAction
  /** Value safe to use as the FINAL value (accept/preserve only). null ⇒ do not finalize from D2. */
  finalValue: string | null
  /** The dictionary's proposal when it must NOT silently replace the read (suggest/review). */
  candidateValue: string | null
  /** Machine-readable rule that fired (provenance + audit). */
  ruleId: string
  reasonCodes: string[]
  /** Where the decision came from (kmu55 / gazetteer_exact / mrz_preserved / authority_dict / ...). */
  provenance: string
  /** Deterministic confidence in the transform, 0..1. */
  evidenceStrength: number
}

export interface KnowledgeNormalizeCtx {
  documentClass?: string | null
  sourceDoc?: string
  sex?: Sex | null
  givenNameCyrillic?: string | null
  isHistorical?: boolean
  mode?: OutputMode
  /** the document is a Ukrainian identity doc (enables Russian-spelling suspicion on names). */
  ukrainianDoc?: boolean
  /**
   * Phase 2.0 (bug-B fix): The SOURCE that produced the Latin value — distinguishes
   * controlling Latin (mrz/ead/i94 = preserve as-is) from derived KMU-55 Latin (re-process).
   * When absent and the value is Latin, we use `preserve` only for true authority sources.
   */
  sourceBasis?: 'mrz_latin' | 'ead_latin' | 'i94_latin' | 'reader_latin' | 'raw_cyrillic' | 'unknown'
  /**
   * Constrained-vocabulary auto-correction (DICTIONARY_AUTOCORRECT_ENABLED). When undefined,
   * the env flag decides. Explicit true/false lets the caller/tests pin behaviour. Flag OFF ⇒
   * the auto-correct branches are never reached ⇒ output byte-identical to before.
   */
  autocorrect?: boolean
}

/**
 * The knowledge dictionary (D2 authority: oblast genitive→nominative, ЗАГС/РАЦС
 * agency terms, Міліція era-gating, смт, historical names, patronymic, KMU-55)
 * is ON BY DEFAULT (owner-activated 2026-06-12). It is SAFE to default-on: a
 * dictionary CONFLICT never silently rewrites — it keeps the read value, surfaces
 * a suggestedValue, and forces review (arbitration.ts applyKnowledge). Only
 * deterministic safe transforms are accepted outright. Set KNOWLEDGE_BRAIN_ENABLED=0
 * to disable without a code change (rollback).
 */
export function isKnowledgeBrainEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.KNOWLEDGE_BRAIN_ENABLED !== '0'
}

/**
 * DICTIONARY_AUTOCORRECT_ENABLED — constrained-vocabulary auto-correction (default OFF).
 *
 * GOAL: maximize automatic field-fill. For a CLOSED-set field (oblast/sex/civil_status/
 * country/month/settlement) a near-miss read is almost certainly a misread OF a known
 * value; because the set is closed, snapping it to the UNIQUE nearest entry is safe
 * auto-fill (not a guess into the open world). When ON, a near-miss that today goes to
 * suggest/review is instead CORRECTED + ACCEPTED — but ONLY when the match is unique and
 * tight; AMBIGUITY ⇒ keep the prior suggest/review (ADR-017: never silently pick a side).
 *
 * Default OFF so production output is byte-identical until the lift is measured. Set
 * DICTIONARY_AUTOCORRECT_ENABLED=1 to enable. NEVER auto-corrects a free-text NAME.
 */
export function isDictionaryAutocorrectEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.DICTIONARY_AUTOCORRECT_ENABLED === '1'
}

const CYRILLIC = /[Ѐ-ӿ]/
/** Letters that exist in Russian but NOT in Ukrainian orthography. */
const RUSSIAN_ONLY_LETTERS = /[ыэёъ]/i
/**
 * High-frequency Russian spellings of given names whose Ukrainian form differs but which share all
 * letters (no orthographic signal). Conservative seed — expand with ground-truth, do NOT treat as
 * exhaustive. Presence ⇒ SUSPECT (review), never an auto-rewrite.
 */
const RU_SPELLED_GIVEN = new Set([
  'сергей', 'андрей', 'алексей', 'николай', 'дмитрий', 'евгений', 'геннадий', 'юрий', 'валерий',
  'анатолий', 'григорий', 'михаил', 'наталья', 'татьяна', 'екатерина', 'елена', 'софья', 'мария',
])

function looksRussianSpelled(value: string): boolean {
  if (RUSSIAN_ONLY_LETTERS.test(value)) return true
  return RU_SPELLED_GIVEN.has(value.trim().toLowerCase())
}

function k(key: string): string {
  return (key || '').toLowerCase()
}

const accept = (finalValue: string, ruleId: string, provenance: string, evidence = 0.9): KnowledgeDecision =>
  ({ action: 'accept', finalValue, candidateValue: null, ruleId, reasonCodes: [], provenance, evidenceStrength: evidence })
const preserve = (finalValue: string, ruleId: string): KnowledgeDecision =>
  ({ action: 'preserve', finalValue, candidateValue: null, ruleId, reasonCodes: [], provenance: 'controlling_latin', evidenceStrength: 0.95 })
const suggest = (candidate: string | null, ruleId: string, provenance: string, reasons: string[]): KnowledgeDecision =>
  ({ action: 'suggest', finalValue: null, candidateValue: candidate, ruleId, reasonCodes: reasons, provenance, evidenceStrength: 0.4 })
const review = (candidate: string | null, ruleId: string, provenance: string, reasons: string[]): KnowledgeDecision =>
  ({ action: 'review', finalValue: null, candidateValue: candidate, ruleId, reasonCodes: reasons, provenance, evidenceStrength: 0.2 })

/** Map a knowledge NormalizedField → a decision: clean ⇒ accept, review_required ⇒ suggest. */
function fromField(nf: NormalizedField, ruleId: string, provenance: string): KnowledgeDecision {
  if (nf.review_required) {
    return suggest(nf.normalized_value, ruleId, provenance, [nf.review_reason ?? 'knowledge_uncertain'])
  }
  return accept(nf.normalized_value, ruleId, provenance)
}

/**
 * Decide what D2 says about ONE arbitrated field value. Pure; never throws; never returns a silent
 * critical substitution (conflict ⇒ suggest/review with a candidate, not a final).
 */
export function normalizeCanonicalValue(
  key: string,
  rawValue: string,
  ctx: KnowledgeNormalizeCtx = {},
): KnowledgeDecision {
  const raw = (rawValue ?? '').trim()
  const key_ = k(key)
  const cyr = CYRILLIC.test(raw)
  // Auto-correct gate: explicit ctx wins; otherwise read the env flag (default OFF).
  const autocorrect = ctx.autocorrect ?? isDictionaryAutocorrectEnabled()

  if (raw === '') {
    // EMPTY read. Normally nothing usable → block. EXCEPTION (autocorrect ON):
    // an UNREAD patronymic can be RECONSTRUCTED from the father's given name + sex.
    // Flag OFF ⇒ this exception is skipped ⇒ block (byte-identical to before).
    if (autocorrect && key_.includes('patronymic') && (ctx.sex === 'M' || ctx.sex === 'F') && (ctx.givenNameCyrillic ?? '').trim()) {
      const given = (ctx.givenNameCyrillic ?? '').trim()
      const russianContext = RUSSIAN_ONLY_LETTERS.test(given) || looksRussianSpelled(given)
      const genCy = russianContext ? generatePatronymicRu(given, ctx.sex) : generatePatronymic(given, ctx.sex).value
      if (genCy) {
        // RU отчество transliterates with the RUSSIAN engine (KMU-55 would leak ё/э/ы).
        const translit = russianContext ? transliterateRussian(genCy) : transliterateKMU55(genCy)
        return suggest(translit, 'patronymic.reconstructed', 'patronymic_reconstructed', ['patronymic_reconstructed'])
      }
    }
    return { action: 'block', finalValue: null, candidateValue: null, ruleId: 'empty', reasonCodes: ['empty_value'], provenance: 'none', evidenceStrength: 0 }
  }
  const sourceDoc = ctx.sourceDoc ?? ctx.documentClass ?? 'document'
  const nctx: NormalizationContext = { mode: ctx.mode ?? 'uscis_normalized', is_historical_document: ctx.isHistorical === true }

  try {
    // ── Patronymic (по батькові) — never "Middle Name"; reject OCR fragments ──
    if (key_.includes('patronymic')) {
      if (ctx.sex === 'M' || ctx.sex === 'F') {
        // Source-script routing: a Russian-spelled given name (ё/э/ы or a Russian
        // patronymic suffix on the read) must use the RUSSIAN engine — KMU-55 of a
        // Ukrainian-rule patronymic would leak the wrong отчество. Keep UA vs RU intact.
        const given = ctx.givenNameCyrillic ?? ''
        const russianContext = RUSSIAN_ONLY_LETTERS.test(given) || RUSSIAN_ONLY_LETTERS.test(raw) ||
          looksRussianSpelled(given) || /(евич|овна|евна|инична|ыч)$/i.test(raw.trim())
        const r = reconcilePatronymic(raw, given || null, ctx.sex)
        if (r.source === 'read_valid') return accept(transliterateKMU55(r.value), 'patronymic.read_valid', 'patronymic_reconcile', 0.85)

        // ── RECONSTRUCTION (DICTIONARY_AUTOCORRECT_ENABLED). The patronymic is unread
        // or garbled but the father's given name is known → generate the expected
        // patronymic (uk or ru per source script). It MAY auto-accept when it AGREES
        // with a partial read (same stem); otherwise it remains a suggestion.
        if (autocorrect && given) {
          const genCy = russianContext ? generatePatronymicRu(given, ctx.sex) : generatePatronymic(given, ctx.sex).value
          if (genCy) {
            const partial = raw.trim()
            // "agrees with a partial read": the read is a non-empty prefix/suffix
            // fragment consistent with the generated form (e.g. "Сергій"→"Сергійович"
            // read as "Серг…"/"…ович"). Empty/garbled read → suggest (light review).
            const agrees = partial.length >= 3 &&
              (genCy.toLocaleLowerCase('uk').startsWith(partial.toLocaleLowerCase('uk')) ||
               genCy.toLocaleLowerCase('uk').includes(partial.toLocaleLowerCase('uk')))
            // RU отчество → Russian engine; UA по батькові → KMU-55.
            const translit = russianContext ? transliterateRussian(genCy) : transliterateKMU55(genCy)
            if (agrees) return accept(translit, 'patronymic.reconstructed_agrees', 'patronymic_reconstructed', 0.85)
            return suggest(translit, 'patronymic.reconstructed', 'patronymic_reconstructed', ['patronymic_reconstructed'])
          }
        }

        if (r.value) return suggest(transliterateKMU55(r.value), `patronymic.${r.source}`, 'patronymic_reconcile', [r.reason])
        return review(null, 'patronymic.unresolved', 'patronymic_reconcile', [r.reason || 'patronymic_unresolved'])
      }
      // No sex context: validate the read; a fragment → review, never silent.
      if (isValidPatronymic(raw)) return accept(transliterateKMU55(raw), 'patronymic.read_valid', 'patronymic_reconcile', 0.7)
      return review(cyr ? transliterateKMU55(raw) : raw, 'patronymic.fragment', 'patronymic_reconcile', ['patronymic_fragment_or_unverified'])
    }

    // ── Person name (surname / given) ─────────────────────────────────────────
    if (key_.includes('surname') || key_.includes('family_name') || key_.includes('given_name')) {
      if (!cyr) {
        // Phase 2.0 bug-B fix: Latin input is only treated as CONTROLLING when it
        // comes from an authoritative source (MRZ/EAD/I-94). Derived KMU-55 Latin
        // is NOT controlling — it may contain transliteration errors. We distinguish
        // by sourceBasis: explicit authority sources → preserve; unknown/reader → preserve
        // with a lower evidence score so a conflict would trigger review.
        const isControllingSource = ctx.sourceBasis === 'mrz_latin' || ctx.sourceBasis === 'ead_latin' || ctx.sourceBasis === 'i94_latin'
        const evidence = isControllingSource ? 0.99 : 0.6  // reader-derived Latin is less authoritative
        const result = preserve(formatLatinName(raw), 'name.latin_preserve')
        return { ...result, evidenceStrength: evidence }
      }
      // Russian spelling on a Ukrainian document = a misread, not a fact to transliterate silently.
      if (ctx.ukrainianDoc !== false && looksRussianSpelled(raw)) {
        return review(transliterateKMU55(raw), 'name.russian_spelling_on_ua', 'spelling_guard', ['russian_spelling_suspected'])
      }
      const fieldType = (key_.includes('surname') || key_.includes('family_name')) ? 'surname' : 'given_name'
      return fromField(normalizeName(raw, fieldType, sourceDoc, nctx), `name.${fieldType}`, 'kmu55_name')
    }

    // ── Full-name composite (father/mother/spouse) ────────────────────────────
    if (key_.includes('full_name')) {
      if (!cyr) {
        const isControllingSource = ctx.sourceBasis === 'mrz_latin' || ctx.sourceBasis === 'ead_latin' || ctx.sourceBasis === 'i94_latin'
        const evidence = isControllingSource ? 0.99 : 0.6
        const result = preserve(formatLatinName(raw), 'fullname.latin_preserve')
        return { ...result, evidenceStrength: evidence }
      }
      if (ctx.ukrainianDoc !== false && looksRussianSpelled(raw)) {
        return review(formatLatinName(transliterateKMU55(raw)), 'fullname.russian_spelling_on_ua', 'spelling_guard', ['russian_spelling_suspected'])
      }
      return accept(formatLatinName(transliterateKMU55(raw)), 'fullname.transliterate', 'kmu55_name', 0.75)
    }

    // ── Place (city / oblast / province / place_of_birth / settlement) ────────
    if (/place|city|province|oblast|settlement|region/.test(key_)) {
      // COUNTRY-CODE STRIP (Agent 1, real intl-passport): the passport place-of-birth
      // cell carries the issuing-country code ("ВІННИЦЬКА ОБЛ./UKR"). The reader's
      // toCanonicalValue('place_city') strips it, but D2 here gazetteers/normalizes
      // the ORIGINAL raw Cyrillic — which still has "/UKR" — and neither snapCity nor
      // normalizePlace removes a country token, so it leaked into the released place.
      // Strip it first (any separator, suffix OR prefix; embedded substrings safe).
      const placeRaw = stripCountryCode(raw)
      // FOREIGN PLACE (Task #14): a foreign birthplace ("Канада, місто Торонто",
      // "Росія, город Москва") leads with a known country token. The Ukrainian
      // gazetteer/normalizePlace path has no countries, so it leaked Cyrillic-
      // transliterated junk ("Kanada, misto Toronto"). Try the country dictionary
      // FIRST; it returns null for any domestic place (no country token), so the
      // normal UA path below is untouched. Diaspora/adoptee filings are common.
      if (cyr) {
        const foreign = normalizeForeignPlace(placeRaw)
        if (foreign && foreign.isForeign) {
          return accept(foreign.value, 'place.foreign_country', 'country_dict', 0.85)
        }
      }
      // ── AUTO-CORRECT: oblast (closed set of 24). A garbled oblast adjective
      // ("Вінницка"/"Винницкой") never matches the exact genitive map, so
      // normalizePlace below would KMU-55 it into junk. When the flag is on,
      // snap it to the UNIQUE nearest oblast and accept the DMS English. Ambiguous
      // (two oblasts equally close) ⇒ skip, fall through to the existing path.
      if (autocorrect && cyr && /област|обл\.?$|обл\.\s/i.test(placeRaw)) {
        // Only auto-correct when the EXACT path fails: if normalizeOblastToNominative
        // already resolves it, that deterministic accept (below) is preferred.
        if (!normalizeOblastToNominative(placeRaw)) {
          const oc = autoCorrectOblast(placeRaw)
          if (oc.unique && oc.reason !== 'exact' && oc.canonical) {
            const nom = normalizeOblastToNominative(`${oc.canonical} область`)
            if (nom) return accept(nom.transliterated, 'oblast.autocorrect', 'oblast_autocorrect', 0.88)
          }
        }
      }
      // City fields: gazetteer on the RAW Cyrillic. EXACT ⇒ accept; FUZZY ⇒ suggest (never overwrite).
      if ((key_.includes('city') || key_.endsWith('place_of_birth')) && cyr) {
        const snap = snapCity(placeRaw)
        if (snap.matched) {
          // HARD RULE («смт» = "urban-type settlement", NEVER city/town): snapCity
          // strips the settlement designator and returns the bare gazetteer city, so
          // re-attach it from the RAW value. Without this, «смт Вишневе» released as
          // "Vyshneve" — a silent designator drop (GOLDEN vector V1).
          const designator = settlementDesignatorEn(placeRaw)
          const city = transliterateKMU55(snap.value)
          return accept(designator ? `${designator} ${city}` : city, 'place.gazetteer_exact', 'gazetteer_exact', 0.9)
        }
        // A FUZZY near-match (possible misread of a known place) → review. But a
        // GENUINELY-UNKNOWN town (reason 'unknown_geography') is NOT a misread —
        // our seed gazetteer is ~500 of 28k+ settlements; forcing review on every
        // village not in the seed blocked the pay button on legitimate small-town
        // birthplaces. Fall through to normalizePlace (transliterate + dict, accept).
        if (snap.review_required && snap.reason !== 'unknown_geography') {
          // ── AUTO-CORRECT: settlement. A fuzzy gazetteer hit means a UNIQUE near
          // entry exists (snapCity already applied the MAX_FUZZY_DISTANCE=2 +
          // ratio≤0.34 gate and surfaced ONE suggestedValue). When the flag is on
          // AND the snap is TIGHT (distance ≤ 1 cheap edit, the unambiguous case),
          // correct to the suggested gazetteer entry and accept. A looser fuzzy
          // (distance up to 2) stays a SUGGESTION — not tight enough to auto-fill.
          if (autocorrect && snap.suggestedValue && snap.distance <= 1) {
            const designator = settlementDesignatorEn(placeRaw)
            const city = transliterateKMU55(snap.suggestedValue)
            return accept(designator ? `${designator} ${city}` : city, 'place.gazetteer_autocorrect', 'gazetteer_autocorrect', 0.85)
          }
          return suggest(snap.value ? transliterateKMU55(snap.value) : null, 'place.gazetteer_fuzzy', 'gazetteer_fuzzy', ['place_fuzzy_unconfirmed'])
        }
      }
      return fromField(normalizePlace(placeRaw, key, sourceDoc, nctx), 'place.normalize', 'place_dict')
    }

    // ── Issuing authority (Міліція → Militsiya; unknown → do not invent) ───────
    // NOTE: exclude date keys — 'date_of_issue'/'issue_date' contain 'issu' but are
    // DATES, not authorities. Without the !date guard a valid issue DATE was misrouted
    // to authority.unknown → false review instead of accept (GOLDEN vector V2).
    if (key_.includes('authority') || (key_.includes('issu') && !key_.includes('date'))) {
      const a = normalizeAuthority(raw, sourceDoc, nctx)
      if (!a.review_required && a.rule_applied && a.rule_applied !== 'no_match' && a.rule_applied !== 'passthrough') {
        return accept(a.normalized_value, `authority.${a.rule_applied}`, 'authority_dict')
      }
      // Unknown authority: do NOT invent a final; offer the transliteration as a candidate, review.
      return review(cyr ? transliterateKMU55(raw) : raw, 'authority.unknown', 'authority_dict', ['authority_unverified'])
    }

    // ── Civil / marital status (closed set) ───────────────────────────────────
    // Only when autocorrect is ON (flag OFF ⇒ this branch is skipped entirely so
    // civil_status keeps its prior default-path behaviour → byte-identical).
    if (autocorrect && (key_.includes('civil_status') || key_.includes('marital'))) {
      const cs = autoCorrectCivilStatus(raw)
      if (cs.reason === 'exact') return accept(cs.value, 'civil_status.exact', 'civil_status_dict', 0.9)
      if (cs.unique) return accept(cs.value, 'civil_status.autocorrect', 'civil_status_autocorrect', 0.85)
      // fall through to default handling when not confidently matched
    }

    // ── Country / citizenship / nationality (closed set) ──────────────────────
    if (autocorrect && cyr && /country|citizenship|nationality/.test(key_)) {
      const cc = autoCorrectCountry(raw)
      if (cc.reason === 'exact') return accept(cc.value, 'country.exact', 'country_dict', 0.9)
      if (cc.unique) return accept(cc.value, 'country.autocorrect', 'country_autocorrect', 0.85)
      // fall through
    }

    // ── Sex ───────────────────────────────────────────────────────────────────
    if (key_ === 'sex' || key_.includes('gender')) {
      const s = normalizeSex(raw, sourceDoc)
      if (!s.review_required) return accept(s.normalized_value, 'sex.normalize', 'sex_dict')
      // ── AUTO-CORRECT: sex (closed set). An exact SEX_MAP miss ("чол."/"жіноч")
      // is a near-miss of a known token; snap to the unique entry and accept.
      if (autocorrect) {
        const sc = autoCorrectSex(raw)
        if (sc.unique && sc.reason !== 'exact') return accept(sc.value, 'sex.autocorrect', 'sex_autocorrect', 0.85)
      }
      return review(s.normalized_value, 'sex.uncertain', 'sex_dict', [s.review_reason ?? 'sex_uncertain'])
    }

    // ── Dates (DOB / issue / expiry) → USCIS MM/DD/YYYY ───────────────────────
    if (key_.includes('dob') || key_.includes('date')) {
      // Phase 2.0 bug-A fix: toCanonicalValue emits ISO YYYY-MM-DD; normalizedValue
      // arriving here may already be ISO. convertDateToUSCIS only handles DD.MM.YYYY
      // and Ukrainian month-name formats, so ISO → false review. Accept these first.
      // Helper: when autocorrect is ON, validate a resolved MM/DD/YYYY for
      // plausibility. month>12 with a uniquely-swappable day → correct; both out
      // of range → review (never invent digits). When OFF, the value passes
      // through UNCHANGED (byte-identical to legacy — even an implausible MM).
      const plausibilityGate = (
        mm: string, dd: string, yyyy: string, fallbackRule: string, fallbackProv: string, fallbackEv: number,
      ): KnowledgeDecision => {
        if (!autocorrect) return accept(`${mm}/${dd}/${yyyy}`, fallbackRule, fallbackProv, fallbackEv)
        const fixed = autoCorrectDateParts({ day: parseInt(dd, 10), month: parseInt(mm, 10), year: parseInt(yyyy, 10) })
        if (!fixed) return review(null, 'date.implausible', 'date_autocorrect', ['date_implausible'])
        if (fixed.corrected) {
          return accept(`${String(fixed.month).padStart(2, '0')}/${String(fixed.day).padStart(2, '0')}/${fixed.year}`,
            'date.autocorrect', 'date_autocorrect', 0.8)
        }
        return accept(`${mm}/${dd}/${yyyy}`, fallbackRule, fallbackProv, fallbackEv)
      }

      const uscisMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
      if (uscisMatch) {
        // Already USCIS MM/DD/YYYY — accept as-is (OFF) or plausibility-gate (ON).
        return plausibilityGate(uscisMatch[1], uscisMatch[2], uscisMatch[3], 'date.already_uscis', 'date_pass', 0.95)
      }
      const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (isoMatch) {
        // ISO YYYY-MM-DD → USCIS MM/DD/YYYY (deterministic, no false review).
        return plausibilityGate(isoMatch[2], isoMatch[3], isoMatch[1], 'date.iso_to_uscis', 'date_parse', 0.9)
      }
      const conv = convertDateToUSCIS(raw)
      if (conv) {
        const cm = conv.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
        if (cm) return plausibilityGate(cm[1], cm[2], cm[3], 'date.uscis', 'date_parse', 0.9)
        return accept(conv, 'date.uscis', 'date_parse', 0.9)
      }
      return review(null, 'date.unparsed', 'date_parse', ['date_unparsed'])
    }

    // ── Default: transliterate Cyrillic (safe representation), preserve Latin ──
    if (cyr) return accept(transliterateKMU55(raw), 'default.kmu55', 'kmu55_default', 0.8)
    return preserve(raw, 'default.passthrough')
  } catch {
    // Knowledge must never break recognition — keep the read, force review.
    return review(null, 'error.preserved', 'error', ['knowledge_normalize_error'])
  }
}
