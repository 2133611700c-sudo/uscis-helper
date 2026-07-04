/**
 * gatesAsReadersShadow — ONE-BRAIN v2 Phase 1b in SHADOW form.
 *
 * The plan step "gates become READERS of FieldDecision" flips only after evidence that
 * feeding the gates from the Decision Engine changes NOTHING a user can observe. This
 * module produces that evidence: it runs the REAL gate derivation (reviewGate's
 * getUnresolvedReviewFields + finalPdfGate's releasability rule) twice —
 *   legacy side : the post-C3 fields exactly as the live pipeline persists them,
 *   engine side : the same fields projected through fieldDecisionToReviewGateField —
 * and reports a keys-only diff. No behavior change; the caller only logs the result.
 *
 * FLIP-BLOCKING (same philosophy as decision/arbitration shadows):
 *   - engine_loosened_keys — the engine-fed gate would UNBLOCK something legacy blocks.
 *     Loosening is never acceptable evidence; any occurrence forbids the flip.
 *   - unresolved_diff_keys — the two sides disagree on the unresolved-review set at all.
 *   Tightening alone (engine blocks more) does not block the flip but is reported.
 *
 * PII-FREE BY CONSTRUCTION: output carries field KEYS, counts and booleans only.
 */
import type { FieldDecision } from './decisionEngine'
import { fieldDecisionToReviewGateField } from './fieldDecisionGateAdapter'
import { getUnresolvedReviewFields, type ReviewGateField } from '@/lib/translation/reviewGate'

export interface GatesShadowLegacyField {
  field: string
  /** C3 release value (string = released, null/absent = not released). */
  finalValue?: string | null
  review_required?: boolean | null
  review_reasons?: string[] | null
}

export interface GatesShadowDiff {
  fields: number
  legacy_unresolved: string[]
  engine_unresolved: string[]
  /** symmetric difference of the two unresolved sets (keys only) */
  unresolved_diff_keys: string[]
  /** keys whose releasability (non-empty release value) differs between the sides */
  release_diff_keys: string[]
  /** engine-fed gate would unblock what legacy blocks — ANY entry forbids the flip */
  engine_loosened_keys: string[]
  /** engine blocks more than legacy — reported, does not block the flip */
  engine_tightened_keys: string[]
  match: boolean
}

const released = (v: string | null | undefined): boolean => !!(v ?? '').trim()

/** Pure. Runs the real gate derivation on both sides and diffs the verdicts. */
export function runGatesAsReadersShadow(
  legacy: GatesShadowLegacyField[],
  decisions: FieldDecision[],
): GatesShadowDiff {
  const legacyGateFields: ReviewGateField[] = legacy.map((f) => ({
    field: f.field,
    normalized_value: f.finalValue ?? null,
    review_required: f.review_required,
    review_reasons: f.review_reasons,
  }))
  const engineGateFields: ReviewGateField[] = decisions.map(fieldDecisionToReviewGateField)

  const legacyUnresolved = new Set(getUnresolvedReviewFields(legacyGateFields))
  const engineUnresolved = new Set(getUnresolvedReviewFields(engineGateFields))

  const allKeys = new Set<string>([...legacyUnresolved, ...engineUnresolved])
  const unresolvedDiff: string[] = []
  const loosened: string[] = []
  const tightened: string[] = []
  for (const k of allKeys) {
    const l = legacyUnresolved.has(k)
    const e = engineUnresolved.has(k)
    if (l === e) continue
    unresolvedDiff.push(k)
    if (l && !e) loosened.push(k)
    else tightened.push(k)
  }

  const decisionByKey = new Map(decisions.map((d) => [d.field, d]))
  const releaseDiff: string[] = []
  for (const f of legacy) {
    const d = decisionByKey.get(f.field)
    if (!d) continue
    if (released(f.finalValue) !== released(d.finalValue)) releaseDiff.push(f.field)
  }

  return {
    fields: legacy.length,
    legacy_unresolved: [...legacyUnresolved],
    engine_unresolved: [...engineUnresolved],
    unresolved_diff_keys: unresolvedDiff,
    release_diff_keys: releaseDiff,
    engine_loosened_keys: loosened,
    engine_tightened_keys: tightened,
    match: unresolvedDiff.length === 0 && releaseDiff.length === 0,
  }
}
