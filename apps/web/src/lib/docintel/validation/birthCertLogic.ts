/**
 * birthCertLogic — deterministic, FREE, review-MONOTONIC logical validation for
 * Ukrainian birth certificates (PR C).
 *
 * WHY: even when the reader/ensemble accept individual fields, the SET of fields
 * can be internally inconsistent (a birth date after the registration date, both
 * parents recorded identically, the certificate series number colliding with the
 * act-record number, a child surname that matches neither parent). These are
 * cheap, deterministic cross-field checks that a general vision LLM does not do.
 *
 * CONTRACT (mirrors applyDateEnsemble):
 *  - Operates on a STRUCTURAL subtype of the translation field row.
 *  - ONLY RAISES review (sets review_required=true) and APPENDS a reason code.
 *    NEVER lowers review, NEVER mutates `value` / `raw_cyrillic`.
 *  - Returns NEW field objects for the entries it flags (shallow copy); untouched
 *    entries are returned by reference.
 *  - Reason codes + flags are PII-FREE (field-relationship codes only).
 *  - Never throws. A parse/compare failure means "cannot compare" ⇒ skip that
 *    check, never crash.
 *  - Flag-gated (BIRTH_CERT_LOGIC_ENABLED) at the call site ⇒ OFF is byte-identical.
 *
 * No engine I/O, no AI, no network.
 */
import { parseDateText } from '../ensemble/dateReconcile'

/** Enable flag. Default OFF ⇒ the whole pass is skipped ⇒ byte-identical output. */
export function isBirthCertLogicEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.BIRTH_CERT_LOGIC_ENABLED === '1'
}

/** Structural subtype of a translation field row — everything this validator reads/writes. */
export interface BirthCertLogicField {
  field: string
  value?: string | null
  raw_cyrillic?: string | null
  review_required?: boolean
  review_reasons?: string[]
}

export interface BirthCertLogicOutcome<T extends BirthCertLogicField> {
  fields: T[]
  applied: boolean
  /** PII-free reason codes that fired (for logging/diag). May repeat if a code fired for >1 pair. */
  flags: string[]
}

const BIRTH_CERT_DOC_TYPES = new Set(['ua_birth_certificate', 'ua_birth_certificate_soviet'])

/** First field in the array whose id matches, or undefined. */
function findField<T extends BirthCertLogicField>(fields: T[], id: string): T | undefined {
  return fields.find((f) => f.field === id)
}

/** Non-empty trimmed string preference: value first, else raw_cyrillic. Empty ⇒ null. */
function textOf(f: BirthCertLogicField | undefined): string | null {
  if (!f) return null
  const v = typeof f.value === 'string' ? f.value.trim() : ''
  if (v) return v
  const r = typeof f.raw_cyrillic === 'string' ? f.raw_cyrillic.trim() : ''
  return r || null
}

/** Case/space-insensitive normalized form for equality comparison. */
function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Parse a date field into a comparable yyyymmdd integer, or null if it cannot be
 * fully parsed. Tries ISO YYYY-MM-DD from `value` first, else parseDateText on
 * raw_cyrillic. Requires year+month+day all present to be comparable.
 */
function dateKey(f: BirthCertLogicField | undefined): number | null {
  if (!f) return null
  try {
    const value = typeof f.value === 'string' ? f.value.trim() : ''
    const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (iso) {
      const y = +iso[1], m = +iso[2], d = +iso[3]
      return y * 10000 + m * 100 + d
    }
    const p = parseDateText(f.raw_cyrillic ?? '')
    if (p.year != null && p.month != null && p.day != null) {
      return p.year * 10000 + p.month * 100 + p.day
    }
    return null
  } catch {
    return null
  }
}

/**
 * Apply birth-certificate cross-field logical validation.
 *
 * MONOTONIC: for every flagged field we set review_required=true and APPEND a
 * distinct reason code, preserving any pre-existing review state and reasons.
 * Fields not implicated by any check are returned untouched (by reference).
 */
export function applyBirthCertLogic<T extends BirthCertLogicField>(
  fields: T[],
  docTypeId: string,
): BirthCertLogicOutcome<T> {
  if (!BIRTH_CERT_DOC_TYPES.has(docTypeId)) {
    return { fields, applied: false, flags: [] }
  }

  const flags: string[] = []
  // Accumulate reason codes per field id, then materialize copies once at the end
  // so a field flagged by multiple checks gets exactly one shallow copy.
  const toFlag = new Map<string, Set<string>>()
  const flag = (id: string | undefined, reason: string): void => {
    if (!id) return
    let set = toFlag.get(id)
    if (!set) { set = new Set<string>(); toFlag.set(id, set) }
    set.add(reason)
    flags.push(reason)
  }

  try {
    // ── 1. date_order — plausible chronology is dob <= act_record_date <= date_of_issue.
    //    Compare only pairs where BOTH parse fully. Equality is NOT a violation.
    const dobF = findField(fields, 'dob')
    const actF = findField(fields, 'act_record_date')
    const issF = findField(fields, 'date_of_issue')
    const dob = dateKey(dobF)
    const act = dateKey(actF)
    const iss = dateKey(issF)
    const REASON_DATE = 'date_order_implausible'
    if (dob != null && act != null && dob > act) { flag('dob', REASON_DATE); flag('act_record_date', REASON_DATE) }
    if (act != null && iss != null && act > iss) { flag('act_record_date', REASON_DATE); flag('date_of_issue', REASON_DATE) }
    if (dob != null && iss != null && dob > iss) { flag('dob', REASON_DATE); flag('date_of_issue', REASON_DATE) }

    // ── 2. parents_identical — both parent names present and equal (normalized) ⇒ suspect.
    const fatherT = textOf(findField(fields, 'father_full_name'))
    const motherT = textOf(findField(fields, 'mother_full_name'))
    if (fatherT && motherT && normalizeName(fatherT) === normalizeName(motherT)) {
      flag('father_full_name', 'parents_identical')
      flag('mother_full_name', 'parents_identical')
    }

    // ── 3. cert_vs_act_number — certificate series/number equal to act-record number ⇒ suspect.
    const certT = textOf(findField(fields, 'certificate_series_number'))
    const actNumT = textOf(findField(fields, 'act_record_number'))
    if (certT && actNumT && certT.trim() === actNumT.trim()) {
      flag('certificate_series_number', 'certificate_number_equals_act_record')
      flag('act_record_number', 'certificate_number_equals_act_record')
    }

    // ── 4. child_surname_parent_match (SOFT) — Ukrainian naming varies (a child may
    //    carry either parent's surname, or a maiden/married variant), so this is a
    //    WEAK signal, not proof of error. If the child family name appears as a token
    //    in NEITHER present parent field, flag ONLY the child field. Skip entirely if
    //    the child surname is empty or BOTH parent fields are empty.
    const childSurT = textOf(findField(fields, 'child_family_name'))
    if (childSurT && (fatherT || motherT)) {
      const childToken = normalizeName(childSurT)
      const parentBlob = normalizeName([fatherT ?? '', motherT ?? ''].join(' '))
      // token containment: parent full name split into words, compare each to the child surname token.
      const parentTokens = new Set(parentBlob.split(' ').filter(Boolean))
      const matched = childToken.split(' ').some((ct) => parentTokens.has(ct))
      if (!matched) {
        flag('child_family_name', 'child_surname_no_parent_match')
      }
    }
  } catch {
    // Defensive: any unexpected failure ⇒ return whatever we accumulated so far
    // (never throw). In practice the guarded helpers above already swallow errors.
  }

  if (toFlag.size === 0) {
    return { fields, applied: true, flags }
  }

  const out = fields.map((f) => {
    const reasons = toFlag.get(f.field)
    if (!reasons) return f
    return {
      ...f,
      review_required: true,
      review_reasons: [...(f.review_reasons ?? []), ...reasons],
    }
  })

  return { fields: out, applied: true, flags }
}
