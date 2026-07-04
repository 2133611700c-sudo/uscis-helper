/**
 * knowledgeEvaluator — the ONE knowledge layer as SIGNALS ONLY (One-Brain v2, Phase 1).
 *
 * Extract-not-rebuild: this is the exact D2 evaluation that lived inline in
 * `arbitration.applyKnowledge` — the derivation of the D2 input (original Cyrillic first)
 * plus the `normalizeCanonicalValue` call — split out so the KNOWLEDGE step is a pure
 * OBSERVER. It returns a `KnowledgeDecision` and writes NOTHING. Whether/how a decision
 * is APPLIED to a field (today: arbitration's accept-rewrite of normalizedValue; target:
 * the Decision Engine consuming it as a signal) is the caller's job, so "knowledge
 * suggests, only the Decision Engine decides" (Invariant #2) becomes structurally
 * enforceable instead of a comment.
 *
 * Byte-parity guarantee: `applyKnowledge` in arbitration.ts now composes
 * `evaluateKnowledge` + its unchanged application branches — same inputs, same
 * KnowledgeDecision, same output field. Proven by knowledgeEvaluator.parity test.
 */
import type { CanonicalField } from '../types'
import {
  validateDocNumber, lookupEadCategory, translatePassportAuthority, resolveAbbreviation,
  type DocNumberKind, type Sex,
} from '@uscis-helper/knowledge'
import { normalizeCanonicalValue, type KnowledgeDecision } from './knowledgeNormalize'

export type { KnowledgeDecision }

/** Doc-level knowledge context — mirrors arbitration.KnowledgeArbitrationCtx (kept structural
 *  to avoid an import cycle; arbitration passes its ctx straight through). */
export interface KnowledgeEvalCtx {
  documentClass?: string | null
  isHistorical?: boolean
  ukrainianDoc?: boolean
}

/**
 * Evaluate the deterministic knowledge layer (D2) for one arbitrated field.
 * PURE + signal-only: no field is mutated, nothing is written. The input priority
 * (rawCyrillic ?? normalizedValue ?? rawValue) is the GAP A+B contract — D2 runs its
 * Cyrillic rules on the ORIGINAL script, falling back to Latin only when no Cyrillic
 * was read (e.g. MRZ), where the preserve path applies.
 */
export function evaluateKnowledge(
  f: CanonicalField,
  ctx: KnowledgeEvalCtx,
  sex: Sex | null,
  givenNameCyrillic: string | null,
): KnowledgeDecision {
  const inputForD2 = f.rawCyrillic ?? f.normalizedValue ?? f.rawValue ?? ''
  return normalizeCanonicalValue(f.key, inputForD2, {
    documentClass: ctx.documentClass ?? null,
    sourceDoc: ctx.documentClass ?? undefined,
    sex,
    givenNameCyrillic,
    isHistorical: ctx.isHistorical === true,
    ukrainianDoc: ctx.ukrainianDoc,
  })
}

// ── Phase 6b — document-number VALIDATION signal (wires the previously-dead
//    docNumberFormats dictionary as an evaluator signal) ─────────────────────────

/** field key → docNumberFormats kind. Only keys with an authoritative format are mapped. */
const DOC_NUMBER_KIND_BY_KEY: Readonly<Record<string, DocNumberKind>> = {
  passport_number: 'ua_intl_passport',
  a_number: 'us_a_number',
  i94_admission_number: 'us_i94',
  ead_category: 'us_ead_category',
  ead_card_number: 'us_ead_card',
  i797_receipt_number: 'us_i797_receipt',
  receipt_number: 'us_i797_receipt',
  military_id_number: 'ua_military_ticket',
}

export interface DocNumberSignal {
  /** 'valid' | 'invalid' | 'no_rule' (key has no authoritative format — signal is silent). */
  status: 'valid' | 'invalid' | 'no_rule'
  kind: DocNumberKind | null
  reason: string | null
  /** For us_ead_category: the human meaning from EAD_CATEGORY_MEANINGS (e.g. 'C11'→parolee). */
  categoryMeaning: string | null
  /** REVIEW-MONOTONIC-UP: true only when a mapped format check FAILED. Never lowers review. */
  reviewRequired: boolean
}

/**
 * Validate a document-number field against the authoritative format dictionary
 * (`docNumberFormats` — previously a ZERO-consumer dead asset). PURE signal:
 * never rewrites a value, never lowers review; an invalid format only ADDS a
 * review reason for the Decision Engine to consume. Unknown keys → 'no_rule'
 * (silent) so this can never affect non-number fields.
 */
export function evaluateDocNumberSignal(fieldKey: string, value: string | null | undefined): DocNumberSignal {
  const kind = DOC_NUMBER_KIND_BY_KEY[fieldKey]
  if (!kind) return { status: 'no_rule', kind: null, reason: null, categoryMeaning: null, reviewRequired: false }
  const r = validateDocNumber(kind, value ?? null)
  const categoryMeaning = kind === 'us_ead_category' ? lookupEadCategory(value ?? null) : null
  if (r.valid) return { status: 'valid', kind, reason: null, categoryMeaning, reviewRequired: false }
  return { status: 'invalid', kind, reason: r.reason ?? 'format_mismatch', categoryMeaning, reviewRequired: true }
}

// ── Phase 6c — issuing-AUTHORITY signal (wires the previously-RESERVED registryLookup
//    family: the official gov-source registry of authorities/abbreviations) ───────────

/** Field keys that carry an issuing authority / agency (UA docs + civil registry). */
const AUTHORITY_FIELD_KEYS: ReadonlySet<string> = new Set([
  'issuing_authority', 'agency', 'issued_by', 'authority',
  'registry_office', 'registry_office_name',
])

export interface AuthoritySignal {
  /** 'match' = official registry translation found; 'no_match' = unknown to the registry;
   *  'no_rule' = not an authority field (silent). */
  status: 'match' | 'no_match' | 'no_rule'
  /** The DMS/gov-source official English rendering (suggestion ONLY — never auto-applied). */
  suggestedEn: string | null
  /** Registry-normalized Ukrainian form. */
  normalizedUk: string | null
  confidence: number
  /** Registry says this rendering needs human review (temporal ambiguity / fuzzy). */
  reviewRequired: boolean
  provenance: string | null
}

/**
 * Look an issuing-authority value up in the official registry (`translatePassportAuthority`
 * → passport authorities, falling back to general authorities; abbreviations resolved).
 * PURE SIGNAL: returns a SUGGESTION with provenance — never rewrites, never lowers review
 * (a no_match is silent, not a review trigger: absence from the registry is not evidence
 * of error). documentDate enables the registry's temporal validity windows.
 */
export function evaluateAuthoritySignal(
  fieldKey: string,
  rawValue: string | null | undefined,
  documentDate?: string,
): AuthoritySignal {
  if (!AUTHORITY_FIELD_KEYS.has(fieldKey)) {
    return { status: 'no_rule', suggestedEn: null, normalizedUk: null, confidence: 0, reviewRequired: false, provenance: null }
  }
  const input = (rawValue ?? '').trim()
  if (!input) {
    return { status: 'no_match', suggestedEn: null, normalizedUk: null, confidence: 0, reviewRequired: false, provenance: null }
  }
  const direct = translatePassportAuthority(input, documentDate)
  const r = direct.matched ? direct : (() => {
    const ab = resolveAbbreviation(input)
    return ab.matched ? translatePassportAuthority(ab.official_en || ab.normalized_uk || input, documentDate) : direct
  })()
  if (!r.matched) {
    return { status: 'no_match', suggestedEn: null, normalizedUk: null, confidence: 0, reviewRequired: false, provenance: null }
  }
  return {
    status: 'match',
    suggestedEn: r.official_en || null,
    normalizedUk: r.normalized_uk || null,
    confidence: r.confidence,
    reviewRequired: r.review_required === true, // registry-flagged only; monotonic-up
    provenance: 'registry_authority',
  }
}
