/**
 * canonical/core/knowledgeNormalize.ts — "dictionary in the brain" (ADR-017 §D2).
 *
 * Deterministic D2 knowledge applied INSIDE the Core, to the arbitrated value, so EVERY product
 * (Translation / TPS / Reparole / EAD) gets identical, correct Ukrainian normalization on the
 * FINAL value — instead of re-implementing it per product (the gap the 2026-06-09 audit found:
 * TPS normalizes places/authorities, the Translation path does not → "Міліція"/genitive oblast
 * could reach the user).
 *
 * Contract (facts > opinion, NEVER silent):
 *  - Cyrillic name/place/authority → KMU-55 / gazetteer / dictionary normalized.
 *  - Latin value (MRZ / controlling spelling) → preserved; only formatLatinName cleanup.
 *    HARD RULE (CLAUDE.md): controlling Latin spelling beats re-transliteration.
 *  - Patronymic → reconciled (rejects OCR fragments like "ович"); NEVER becomes "Middle Name".
 *  - A fuzzy / unresolved / historical-authority / oblast-uncertain case → review_required=true,
 *    value PRESERVED, never auto-replaced.
 *
 * Pure: no I/O, no env, no flags. Unwired by itself → importing it changes nothing until the
 * arbiter calls it (Phase 1 step 2, behind KNOWLEDGE_BRAIN_ENABLED, default OFF).
 */
import {
  transliterateKMU55,
  convertDateToUSCIS,
  formatLatinName,
  reconcilePatronymic,
  isValidPatronymic,
  snapCity,
  normalizeName,
  normalizePlace,
  normalizeAuthority,
  normalizeSex,
  type OutputMode,
  type Sex,
  type NormalizedField,
  type NormalizationContext,
} from '@uscis-helper/knowledge'

export interface KnowledgeNormalizeCtx {
  documentClass?: string | null
  /** source-document tag passed to the knowledge layer (e.g. 'birth_certificate'). */
  sourceDoc?: string
  /** subject sex — used to reconstruct/validate a patronymic when known. */
  sex?: Sex | null
  /** subject given name in Cyrillic — used to reconstruct a missing patronymic. */
  givenNameCyrillic?: string | null
  /** old document → authority names are historical (Міліція, not Police). */
  isHistorical?: boolean
  /** output register; defaults to USCIS-normalized. */
  mode?: OutputMode
}

export interface KnowledgeNormalizeResult {
  /** the value to USE (normalized when safe, otherwise the preserved raw read). */
  value: string
  /** human must confirm before this is final (fuzzy/unresolved/historical/conflict). */
  reviewRequired: boolean
  reviewReason?: string
  /** machine-readable note for the provenance/audit log. */
  rule: string
}

const CYRILLIC = /[Ѐ-ӿ]/

function k(key: string): string {
  return (key || '').toLowerCase()
}

function fromField(nf: NormalizedField, ruleTag: string): KnowledgeNormalizeResult {
  return {
    value: nf.normalized_value,
    reviewRequired: nf.review_required === true,
    reviewReason: nf.review_reason,
    rule: nf.rule_applied || ruleTag,
  }
}

/**
 * Apply the deterministic knowledge layer to ONE arbitrated field value.
 * Returns the value to use plus whether a human must confirm it. Never throws.
 */
export function normalizeCanonicalValue(
  key: string,
  rawValue: string,
  ctx: KnowledgeNormalizeCtx = {},
): KnowledgeNormalizeResult {
  const raw = (rawValue ?? '').trim()
  if (raw === '') return { value: '', reviewRequired: false, rule: 'empty' }

  const key_ = k(key)
  const cyr = CYRILLIC.test(raw)
  const sourceDoc = ctx.sourceDoc ?? ctx.documentClass ?? 'document'
  const nctx: NormalizationContext = {
    mode: ctx.mode ?? 'uscis_normalized',
    is_historical_document: ctx.isHistorical === true,
  }

  try {
    // ── Patronymic (по батькові) — never "Middle Name"; reject OCR fragments ──
    if (key_.includes('patronymic')) {
      // Reconcile against the given name + sex when we have them; else validate the read.
      if (ctx.sex === 'M' || ctx.sex === 'F') {
        const r = reconcilePatronymic(raw, ctx.givenNameCyrillic ?? null, ctx.sex)
        const value = r.value ? transliterateKMU55(r.value) : raw
        return {
          value: r.value ? value : raw,
          reviewRequired: r.review_required || r.source === 'unresolved',
          reviewReason: r.reason,
          rule: `patronymic:${r.source}`,
        }
      }
      const ok = isValidPatronymic(raw)
      return {
        value: cyr ? transliterateKMU55(raw) : raw,
        reviewRequired: !ok,
        reviewReason: ok ? undefined : 'patronymic_unverified_no_sex',
        rule: ok ? 'patronymic:read_valid' : 'patronymic:needs_review',
      }
    }

    // ── Person name (surname / given) — controlling Latin beats re-translit ──
    if (key_.includes('surname') || key_.includes('family_name') || key_.endsWith('given_name') || key_.includes('given_name')) {
      if (!cyr) {
        // Latin (MRZ / controlling) — preserve, only fix case per segment.
        return { value: formatLatinName(raw), reviewRequired: false, rule: 'name:latin_preserved' }
      }
      const fieldType = (key_.includes('surname') || key_.includes('family_name')) ? 'surname' : 'given_name'
      return fromField(normalizeName(raw, fieldType, sourceDoc, nctx), `name:${fieldType}`)
    }

    // ── Full-name composite fields (father/mother/spouse) ─────────────────────
    if (key_.includes('full_name')) {
      return {
        value: cyr ? formatLatinName(transliterateKMU55(raw)) : formatLatinName(raw),
        reviewRequired: false,
        rule: cyr ? 'fullname:transliterated' : 'fullname:latin_preserved',
      }
    }

    // ── Place (city / province / oblast / place_of_birth / settlement) ────────
    if (/place|city|province|oblast|settlement|region/.test(key_)) {
      const placed = fromField(normalizePlace(raw, key, sourceDoc, nctx), 'place')
      // For city fields, run the gazetteer to catch handwriting confusions
      // (Простянець→Тростянець). NEVER silent: a fuzzy match → review, value kept.
      if ((key_.includes('city') || key_.endsWith('place_of_birth')) && cyr) {
        const snap = snapCity(placed.value || raw)
        if (snap.matched) {
          return { value: transliterateKMU55(snap.value), reviewRequired: placed.reviewRequired, rule: 'place:gazetteer_exact' }
        }
        if (snap.review_required) {
          return { value: placed.value, reviewRequired: true, reviewReason: 'place_fuzzy_unconfirmed', rule: 'place:gazetteer_fuzzy' }
        }
      }
      return placed
    }

    // ── Issuing authority (Міліція → Militsiya, never Police) ─────────────────
    if (key_.includes('authority') || key_.includes('issu')) {
      return fromField(normalizeAuthority(raw, sourceDoc, nctx), 'authority')
    }

    // ── Sex ───────────────────────────────────────────────────────────────────
    if (key_ === 'sex' || key_.includes('gender')) {
      return fromField(normalizeSex(raw, sourceDoc), 'sex')
    }

    // ── Dates (DOB / issue / expiry) → USCIS MM/DD/YYYY ───────────────────────
    if (key_.includes('dob') || key_.includes('date')) {
      const conv = convertDateToUSCIS(raw)
      if (conv) return { value: conv, reviewRequired: false, rule: 'date:uscis' }
      return { value: raw, reviewRequired: true, reviewReason: 'date_unparsed', rule: 'date:needs_review' }
    }

    // ── Default: transliterate any Cyrillic, preserve Latin ───────────────────
    if (cyr) return { value: transliterateKMU55(raw), reviewRequired: false, rule: 'kmu55_default' }
    return { value: raw, reviewRequired: false, rule: 'passthrough' }
  } catch (e) {
    // Knowledge layer must never break recognition — preserve raw, force review.
    return { value: raw, reviewRequired: true, reviewReason: 'knowledge_normalize_error', rule: 'error_preserved' }
  }
}
