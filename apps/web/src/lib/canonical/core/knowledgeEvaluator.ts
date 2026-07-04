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
import { validateDocNumber, lookupEadCategory, type DocNumberKind, type Sex } from '@uscis-helper/knowledge'
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
