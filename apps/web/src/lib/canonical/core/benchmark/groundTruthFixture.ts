/**
 * benchmark/groundTruthFixture — the OWNER-facing GT fixture format + validator +
 * scorer. One fixture = one real document's ground truth. The owner fills these
 * (synthetic example in ./examples/); the runner scores live reader output against them.
 *
 * Why a new format on top of GroundTruth: GroundTruth models only value-bearing fields.
 * L2 also needs `expected: null` = "this field MUST NOT be finalized" (illegible /
 * wrong-person). Finalizing such a field is a SILENT identity substitution — the single
 * worst failure — so a false-finalization is folded into `critical_wrong_count` (the
 * existing zero-tolerance metric) without touching the proven scoreAgainstTruth.
 *
 * PRIVACY (LAW 5): real fixtures live in test-fixtures/owner/ (gitignored). Only
 * synthetic Ivanenko examples are committed.
 */
import { scoreAgainstTruth, type GroundTruth, type ProducedField, type BenchmarkScore } from '../benchmark'

export interface FixtureField {
  field: string
  /** the true value, or null = MUST NOT be finalized (illegible / wrong-person / no value) */
  expected: string | null
  /** override criticality; defaults to the field's own criticality */
  critical?: boolean
}

export interface GroundTruthFixture {
  docId: string
  documentClass: string
  fields: FixtureField[]
}

/** Validate untrusted JSON into a GroundTruthFixture. Returns errors, never throws. */
export function parseFixture(
  raw: unknown,
): { ok: true; fixture: GroundTruthFixture } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const o = raw as Record<string, unknown>
  if (!o || typeof o !== 'object') return { ok: false, errors: ['fixture is not an object'] }
  if (typeof o.docId !== 'string' || !o.docId.trim()) errors.push('docId must be a non-empty string')
  if (typeof o.documentClass !== 'string' || !o.documentClass.trim()) errors.push('documentClass must be a non-empty string')
  if (!Array.isArray(o.fields)) errors.push('fields must be an array')
  else {
    o.fields.forEach((f, i) => {
      const ff = f as Record<string, unknown>
      if (typeof ff?.field !== 'string' || !ff.field.trim()) errors.push(`fields[${i}].field must be a non-empty string`)
      if (!(typeof ff?.expected === 'string' || ff?.expected === null)) errors.push(`fields[${i}].expected must be a string or null`)
      if (ff?.critical !== undefined && typeof ff.critical !== 'boolean') errors.push(`fields[${i}].critical must be a boolean`)
    })
  }
  if (errors.length) return { ok: false, errors }
  return { ok: true, fixture: o as unknown as GroundTruthFixture }
}

/** Field names the model MUST NOT finalize (expected === null). */
export function mustNotFinalizeFields(f: GroundTruthFixture): Set<string> {
  return new Set(f.fields.filter((x) => x.expected === null).map((x) => x.field))
}

/** The value-bearing fields → GroundTruth (null-expected fields are excluded here). */
export function fixtureToGroundTruth(f: GroundTruthFixture): GroundTruth {
  const fields: GroundTruth['fields'] = {}
  for (const x of f.fields) {
    if (x.expected === null) continue
    fields[x.field] = x.critical === undefined ? { value: x.expected } : { value: x.expected, critical: x.critical }
  }
  return { document_id: f.docId, doc_type: f.documentClass, fields }
}

/**
 * Score one document's produced output against its fixture. Reuses the proven
 * scoreAgainstTruth for value fields, then ADDS any false-finalization (a non-null
 * produced value on a must-not-finalize field) to critical_wrong_count — the
 * zero-tolerance signal the class verdict already fails on.
 */
export function scoreFixture(f: GroundTruthFixture, produced: ProducedField[]): BenchmarkScore {
  const base = scoreAgainstTruth(produced, fixtureToGroundTruth(f))
  const mustNot = mustNotFinalizeFields(f)
  if (mustNot.size === 0) return base
  let falseFinalizations = 0
  for (const p of produced) {
    if (mustNot.has(p.key) && p.value != null && p.value !== '' && p.reviewRequired !== true) {
      falseFinalizations++
    }
  }
  return falseFinalizations
    ? { ...base, critical_wrong_count: base.critical_wrong_count + falseFinalizations }
    : base
}
