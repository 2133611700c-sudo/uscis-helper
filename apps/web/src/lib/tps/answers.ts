/**
 * TPSAnswers — wizard-internal contract for TPS Ukraine packet construction.
 *
 * Locked structure: this is what we collect from the user (whether typed or
 * OCR'd from documents), and what gets written into I-821 + I-765 PDFs by
 * the prefiller engine. Per the source layer audit (2026-05-10), all 4
 * fillable USCIS PDFs are Hybrid XFA + AcroForm — the prefiller strips XFA
 * after fill so Adobe falls back to AcroForm rendering.
 *
 * NOT in scope today: OCR (user types fields), I-912 prefill (optional path),
 * I-601, online filing through my.uscis.gov.
 */

export type FilingPath = 'initial' | 're_registration'

/**
 * I-765 Eligibility Category. For TPS this is exactly (a)(12) or (c)(19).
 *   - 'a12' → first-time TPS applicant filing concurrently with I-821 initial
 *   - 'c19' → already-granted TPS re-registering
 */
export type EadCategory = 'a12' | 'c19' | null

export type Sex = 'M' | 'F'

export interface TPSAnswers {
  // ── Identity (Part 2 of I-821, Part 2 of I-765) ────────────────────────────
  family_name: string
  given_name: string
  middle_name?: string
  other_names?: Array<{ family: string; given: string; middle?: string }>

  dob: string                  // YYYY-MM-DD (HTML date input format)
  sex: Sex
  country_of_birth: string
  country_of_nationality: string   // 'Ukraine'

  a_number?: string                // 9-digit, no 'A' prefix
  uscis_online_account?: string    // 12 digits
  ssn?: string                     // 9 digits, no dashes

  // ── Travel document ─────────────────────────────────────────────────────────
  passport_number: string
  passport_country_of_issuance: string
  passport_expiration_date: string  // YYYY-MM-DD

  // ── US physical address (I-821 Pt2 Item 4, I-765 Pt2 Item 5) ──────────────
  us_address_in_care_of?: string
  us_address_street: string
  us_address_unit_type?: 'apt' | 'ste' | 'flr'
  us_address_unit_number?: string
  us_address_city: string
  us_address_state: string          // 2-letter, e.g. 'CA'
  us_address_zip: string

  mailing_same_as_physical: boolean
  mailing_in_care_of?: string
  mailing_street?: string
  mailing_unit_type?: 'apt' | 'ste' | 'flr'
  mailing_unit_number?: string
  mailing_city?: string
  mailing_state?: string
  mailing_zip?: string

  // ── Entry information ──────────────────────────────────────────────────────
  last_entry_date: string           // YYYY-MM-DD
  i94_admission_number?: string     // 11 digits
  status_at_last_entry?: string     // e.g. 'Parole', 'B-2'
  current_immigration_status?: string

  // ── Filing path & EAD bundle ───────────────────────────────────────────────
  filing_path: FilingPath
  wants_ead: boolean
  ead_category: EadCategory         // 'a12' for initial, 'c19' for re-registration

  // ── Fee bundle ─────────────────────────────────────────────────────────────
  /** True if the user is requesting a fee waiver (Form I-912). Drives README
   *  fee guidance + (future) I-912 packet inclusion. */
  wants_fee_waiver?: boolean

  // ── Contact ────────────────────────────────────────────────────────────────
  daytime_phone: string
  email: string

  // ── Risk flags (drive manual review routing) ───────────────────────────────
  has_criminal_concern: boolean
  has_prior_tps_denial: boolean
  left_us_without_advance_parole: boolean
}

/**
 * Returns true if the answers are minimally complete enough to attempt PDF
 * generation. Does not validate USCIS eligibility — only "all required fields
 * have a value". Eligibility checks live in the classifier (next cycle).
 */
export function isMinimallyComplete(a: TPSAnswers): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  const need: Array<keyof TPSAnswers> = [
    'family_name', 'given_name', 'dob', 'sex',
    'country_of_birth', 'country_of_nationality',
    'passport_number', 'passport_country_of_issuance', 'passport_expiration_date',
    'us_address_street', 'us_address_city', 'us_address_state', 'us_address_zip',
    'last_entry_date',
    'filing_path',
    'daytime_phone', 'email',
  ]
  for (const k of need) {
    const v = a[k]
    if (v === undefined || v === null || v === '') missing.push(String(k))
  }
  if (a.wants_ead && !a.ead_category) missing.push('ead_category')
  return { ok: missing.length === 0, missing }
}

/**
 * Convenience: given filing_path, return the EAD category that USCIS expects.
 * Caller can let user override (rare but possible).
 */
export function defaultEadCategoryFor(path: FilingPath): EadCategory {
  if (path === 'initial') return 'a12'
  if (path === 're_registration') return 'c19'
  return null
}

/**
 * Convert YYYY-MM-DD (HTML date input) to MM/DD/YYYY (USCIS form format).
 * Returns '' if input is empty/invalid.
 */
export function toUscisDate(iso: string | undefined): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  return `${m[2]}/${m[3]}/${m[1]}`
}
