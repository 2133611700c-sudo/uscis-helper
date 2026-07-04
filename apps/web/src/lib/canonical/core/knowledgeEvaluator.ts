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
import type { Sex } from '@uscis-helper/knowledge'
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
