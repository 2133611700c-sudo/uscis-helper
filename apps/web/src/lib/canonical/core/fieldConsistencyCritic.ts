/**
 * fieldConsistencyCritic — the VERIFY node of the agentic reading loop
 * (AGENTIC_BRAIN_BLUEPRINT §3 step 5). Deterministic CROSS-FIELD logic checks — the
 * "second look" an app performs implicitly and our one-shot pipeline never had.
 *
 * CONTRACT (same as every knowledge signal):
 *  - PURE + deterministic: dictionaries only (sexFromPatronymic, isKnownSettlement,
 *    docNumber signal), no network, no LLM.
 *  - SIGNALS ONLY, review-MONOTONIC-UP: a finding can only ADD a review reason; it never
 *    changes a value, never lowers review, never blocks a document by itself.
 *  - Fail-open per check: an unparseable input yields no finding (absence of a finding is
 *    NEVER evidence of correctness).
 *
 * Checks (each mirrors a real fabrication mode seen on live docs):
 *  C1 date order      — dob < issue_date < expiry (when present & parseable)
 *  C2 plausible age   — dob not in the future, age ≤ 120 at issue (or today-less doc)
 *  C3 sex↔patronymic  — dictionary suffix sex contradicts the sex field
 *  C4 place exists    — a Cyrillic place is neither in the gazetteer nor known raion
 *                       (soft signal: registries are incomplete → 'place_unverified')
 *  C5 doc-number      — format check via the existing docNumber signal
 */
import { sexFromPatronymic, isKnownSettlement, isKnownRaion } from '@uscis-helper/knowledge'
import { evaluateDocNumberSignal } from './knowledgeEvaluator'

export interface ConsistencyFinding {
  check: 'date_order' | 'implausible_age' | 'sex_patronymic_conflict' | 'place_unverified' | 'doc_number_invalid'
  /** field keys involved (keys only — findings are PII-free by construction) */
  fields: string[]
  reviewReason: string
}

export interface CriticInputField {
  key: string
  /** the released/normalized value the pipeline currently carries */
  value: string | null
  rawCyrillic?: string | null
}

const DOB_KEYS = ['dob', 'date_of_birth', 'child_dob', 'child_date_of_birth']
const ISSUE_KEYS = ['issue_date', 'date_of_issue']
const EXPIRY_KEYS = ['expiry_date', 'date_of_expiry', 'expiration_date', 'passport_expiration_date']
const SEX_KEYS = ['sex']
const PATRONYMIC_KEYS = ['patronymic', 'child_patronymic']
const PLACE_KEYS = ['place_of_birth_city', 'city_of_birth', 'place_city']

function parseIso(v: string | null | undefined): Date | null {
  if (!v) return null
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/) ?? v.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return null
  const iso = m[0].includes('/') ? `${m[3]}-${m[1]}-${m[2]}` : m[0]
  const d = new Date(iso + 'T00:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d
}

function firstValue(fields: CriticInputField[], keys: string[]): { key: string; value: string } | null {
  for (const k of keys) {
    const f = fields.find((x) => x.key === k && (x.value ?? '').trim() !== '')
    if (f) return { key: f.key, value: f.value as string }
  }
  return null
}

/**
 * Run all deterministic cross-field checks. `now` is injectable for testability
 * (defaults to the caller-provided reference date — callers pass new Date()).
 */
export function runConsistencyCritic(fields: CriticInputField[], now: Date): ConsistencyFinding[] {
  const findings: ConsistencyFinding[] = []

  const dob = firstValue(fields, DOB_KEYS)
  const issue = firstValue(fields, ISSUE_KEYS)
  const expiry = firstValue(fields, EXPIRY_KEYS)
  const dDob = parseIso(dob?.value)
  const dIssue = parseIso(issue?.value)
  const dExpiry = parseIso(expiry?.value)

  // C1 — date order
  if (dDob && dIssue && dDob.getTime() >= dIssue.getTime()) {
    findings.push({ check: 'date_order', fields: [dob!.key, issue!.key], reviewReason: 'critic:dob_not_before_issue' })
  }
  if (dIssue && dExpiry && dIssue.getTime() >= dExpiry.getTime()) {
    findings.push({ check: 'date_order', fields: [issue!.key, expiry!.key], reviewReason: 'critic:issue_not_before_expiry' })
  }

  // C2 — plausible age
  if (dDob) {
    const ref = dIssue ?? now
    const age = (ref.getTime() - dDob.getTime()) / (365.25 * 24 * 3600 * 1000)
    if (dDob.getTime() > now.getTime()) {
      findings.push({ check: 'implausible_age', fields: [dob!.key], reviewReason: 'critic:dob_in_future' })
    } else if (age > 120) {
      findings.push({ check: 'implausible_age', fields: [dob!.key], reviewReason: 'critic:age_over_120' })
    }
  }

  // C3 — sex ↔ patronymic suffix (dictionary; only fires on a REAL contradiction)
  const sex = firstValue(fields, SEX_KEYS)
  const pat = firstValue(fields, PATRONYMIC_KEYS)
  const patSource = pat ?? (() => {
    const f = fields.find((x) => PATRONYMIC_KEYS.includes(x.key) && (x.rawCyrillic ?? '').trim() !== '')
    return f ? { key: f.key, value: f.rawCyrillic as string } : null
  })()
  if (sex && patSource) {
    const norm = sex.value.trim().toLowerCase()
    const sexNorm = /^(m|male|чол|муж)/.test(norm) ? 'M' : /^(f|female|жін|жен)/.test(norm) ? 'F' : null
    const fromPat = sexFromPatronymic(patSource.value)
    if (sexNorm && fromPat && sexNorm !== fromPat) {
      findings.push({
        check: 'sex_patronymic_conflict',
        fields: [sex.key, patSource.key],
        reviewReason: 'critic:sex_patronymic_conflict',
      })
    }
  }

  // C4 — place existence (SOFT: registries are incomplete; absence ⇒ verify, not error)
  for (const k of PLACE_KEYS) {
    const f = fields.find((x) => x.key === k)
    const cyr = (f?.rawCyrillic ?? '').trim()
    if (!cyr || !/[Ѐ-ӿ]/.test(cyr)) continue
    if (!isKnownSettlement(cyr) && !isKnownRaion(cyr)) {
      findings.push({ check: 'place_unverified', fields: [k], reviewReason: 'critic:place_unverified' })
    }
  }

  // C5 — document-number formats (reuses the existing signal; invalid only)
  for (const f of fields) {
    const s = evaluateDocNumberSignal(f.key, f.value)
    if (s.status === 'invalid') {
      findings.push({ check: 'doc_number_invalid', fields: [f.key], reviewReason: `critic:doc_number_${s.reason ?? 'invalid'}` })
    }
  }

  return findings
}
