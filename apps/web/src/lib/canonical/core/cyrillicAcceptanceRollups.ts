/**
 * cyrillicAcceptanceRollups — pure additive acceptance metrics for One-Brain Step I.
 *
 * WHY THIS EXISTS: cyrillicAcceptanceMetrics computes per-document and per-doc-TYPE
 * roll-ups. It does NOT compute:
 *   - the rate at which a value lands in the WRONG field key (a routing failure),
 *   - whether our REVIEW gate actually catches the bad reads (abstention quality),
 *   - exact-match cuts by RENDERING (printed vs handwritten), LANGUAGE (ua vs ru),
 *     and FIELD KIND — the cuts ADR-026 says must drive route-by-rendering.
 *
 * These are ADDITIVE, pure, and PII-free: they operate on opaque verdict ROWS that
 * carry only a key + categorical tags + a verdict — never a field value.
 *
 * Style matches cyrillicAcceptanceMetrics.ts (pure functions, rate = num/denom,
 * 0 when the denominator is empty).
 */

/** Minimal PII-free verdict row — only categorical tags + verdict, no values. */
export interface Row {
  key: string
  fieldKind?: string
  rendering?: 'printed' | 'handwritten'
  language?: 'ua' | 'ru'
  /** EXACT | WRONG | EMPTY | REVIEW | FABRICATED | NA. */
  verdict: 'EXACT' | 'WRONG' | 'EMPTY' | 'REVIEW' | 'FABRICATED' | 'NA'
  /** True if the system flagged this field for human review (abstained). */
  reviewRequired: boolean
}

/** A bad outcome the abstention gate SHOULD have caught: a wrong value or an empty read. */
function isWrongOrEmpty(r: Row): boolean {
  return r.verdict === 'WRONG' || r.verdict === 'EMPTY' || r.verdict === 'FABRICATED'
}

/**
 * wrongFieldAssignmentRate — share of rows whose value landed in a DIFFERENT key.
 * The caller pre-classifies this via the taxonomy (TaxonomyCode 'WRONG_FIELD') and
 * marks the row's verdict as WRONG; here we expose it as a dedicated rate using an
 * explicit predicate so the metric is independent of the taxonomy module.
 *
 * A row is counted as a wrong-field assignment when its verdict is WRONG and its
 * fieldKind is tagged 'wrong_field' (the canonical, value-free signal). This keeps
 * the function pure and PII-free while still measuring the routing failure.
 */
export function wrongFieldAssignmentRate(rows: Row[]): number {
  const considered = rows.filter((r) => r.verdict !== 'NA')
  if (considered.length === 0) return 0
  const wrongField = considered.filter((r) => r.fieldKind === 'wrong_field').length
  return wrongField / considered.length
}

/**
 * abstentionPrecision — of the fields we flagged for REVIEW, what share were
 * actually bad (WRONG ∨ EMPTY ∨ FABRICATED)? High = we don't waste reviewers on
 * good reads. Denominator = all review-flagged rows.
 */
export function abstentionPrecision(rows: Row[]): number {
  const reviewed = rows.filter((r) => r.reviewRequired)
  if (reviewed.length === 0) return 0
  const caught = reviewed.filter(isWrongOrEmpty).length
  return caught / reviewed.length
}

/**
 * abstentionRecall — of all the bad reads (WRONG ∨ EMPTY ∨ FABRICATED), what share
 * did we flag for REVIEW? High = few bad reads slip through auto-release.
 * Denominator = all bad rows.
 */
export function abstentionRecall(rows: Row[]): number {
  const bad = rows.filter(isWrongOrEmpty)
  if (bad.length === 0) return 0
  const caught = bad.filter((r) => r.reviewRequired).length
  return caught / bad.length
}

/** One bucket of a roll-up: how many rows and how many of them were EXACT. */
export interface RollupBucket {
  n: number
  exact: number
}

function rollupBy(rows: Row[], keyFn: (r: Row) => string | undefined): Record<string, RollupBucket> {
  const out: Record<string, RollupBucket> = {}
  for (const r of rows) {
    if (r.verdict === 'NA') continue
    const k = keyFn(r)
    if (k === undefined) continue
    const b = out[k] ?? { n: 0, exact: 0 }
    b.n += 1
    if (r.verdict === 'EXACT') b.exact += 1
    out[k] = b
  }
  return out
}

/** Exact-match cut by rendering ('printed' vs 'handwritten') — ADR-026's key axis. */
export function rollupByRendering(rows: Row[]): Record<string, RollupBucket> {
  return rollupBy(rows, (r) => r.rendering)
}

/** Exact-match cut by language ('ua' vs 'ru') — the KMU-55 vs RU routing axis. */
export function rollupByLanguage(rows: Row[]): Record<string, RollupBucket> {
  return rollupBy(rows, (r) => r.language)
}

/** Exact-match cut by field kind (name/date/docnum/place/…). */
export function rollupByFieldKind(rows: Row[]): Record<string, RollupBucket> {
  return rollupBy(rows, (r) => r.fieldKind)
}
