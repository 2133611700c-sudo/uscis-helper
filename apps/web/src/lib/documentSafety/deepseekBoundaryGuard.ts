/**
 * deepseekBoundaryGuard — CHECKABLE enforcement of LAW 7 (constitution) + ADR-018:
 *   "DeepSeek output can never reach final_value."
 *
 * Until now this was only a comment in C3_USER_CORRECTION_CONTRACT.md. This makes it
 * a runtime assertion + a test gate: any field whose value originated from a DeepSeek
 * path (TPS document-brain, dual-OCR crossref, the translation field-mapper) MUST NOT
 * carry a non-null finalValue. DeepSeek does prose + legacy text-structuring only; it
 * is never an identity/date/number authority.
 *
 * Source provenance tags found in the codebase (read-only audit 2026-06-10):
 *   - TPS: extraction_source 'ai_brain' (documentBrain) and 'dual_ocr_crossref'
 *   - translation field-mapper: untagged today → treated as 'ai_field_mapper' here so the
 *     guard is conservative (a value of unknown DeepSeek origin cannot finalize).
 */

/** Source tags that indicate a value passed through a DeepSeek path. */
export const DEEPSEEK_SOURCES: readonly string[] = [
  'ai_brain',
  'dual_ocr_crossref',
  'deepseek',
  'deepseek-chat',
  'deepseek-reasoner',
  'ai_field_mapper',
]

export function isDeepSeekSource(source: string | null | undefined): boolean {
  const s = (source ?? '').toLowerCase()
  return DEEPSEEK_SOURCES.some((d) => s === d || s.includes('deepseek'))
}

export interface FinalizableField {
  field?: string
  /** provenance tag: extraction_source / source / provider */
  source?: string | null
  finalValue?: string | null
}

export interface DeepSeekBoundaryViolation {
  field: string
  source: string
}

/**
 * Return every field that VIOLATES LAW 7: a DeepSeek-sourced field with a non-null
 * finalValue. An empty array means the boundary holds. Pure; never throws.
 */
export function findDeepSeekFinalViolations(fields: FinalizableField[]): DeepSeekBoundaryViolation[] {
  const out: DeepSeekBoundaryViolation[] = []
  for (const f of fields) {
    if (isDeepSeekSource(f.source) && f.finalValue != null && f.finalValue !== '') {
      out.push({ field: f.field ?? '(unknown)', source: f.source ?? '' })
    }
  }
  return out
}

/**
 * Hard assertion for use at the C3 door / PDF release: throws if any DeepSeek-sourced
 * field carries a finalValue. Call before releasing a certified PDF.
 */
export function assertNoDeepSeekFinal(fields: FinalizableField[]): void {
  const v = findDeepSeekFinalViolations(fields)
  if (v.length) {
    throw new Error(
      `LAW 7 violation: DeepSeek-sourced field(s) reached finalValue: ${v.map((x) => `${x.field}<${x.source}>`).join(', ')}`,
    )
  }
}
