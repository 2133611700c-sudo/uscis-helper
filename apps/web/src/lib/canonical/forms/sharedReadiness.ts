/**
 * sharedReadiness — ONE product-agnostic content-validation rulebook for the
 * pre-PDF firewall, shared by TPS / EAD / Re-Parole.
 *
 * BACKGROUND (U-STAGE 4). Before this module the same three content checks were
 * implemented THREE times:
 *   - TPS:      app/api/tps/generate-packet/route.ts      preflightAudit()  (the strong gate)
 *   - Re-Parole app/api/reparole/generate-packet/route.ts preflightAudit()  (a copy)
 *   - EAD:      app/api/ead/generate-packet/route.ts        — NONE (only "first OR last name")
 *
 * The three checks, factored out here VERBATIM from the TPS gate (the canonical,
 * strongest one):
 *   1. No Cyrillic in fields USCIS expects in Latin (KMU-55 transliteration
 *      runs upstream; a leak is a bug we refuse to render into a signed PDF).
 *   2. Dates are MM/DD/YYYY (USCIS canonical) or YYYY-MM-DD (ISO) — anything else
 *      is rejected rather than written malformed into an I-821/I-765/I-131 field.
 *   3. A-Number is digits-only, 7–9 digits. The forms reject dashes/letters.
 *
 * PURE FUNCTIONS — no I/O, no env reads, no behavior of its own. TPS keeps using
 * its own route-level preflightAudit (UNCHANGED); this module is the SAME logic
 * factored out + unit-tested so EAD/Re-Parole can adopt it behind a flag without
 * any new copy drifting from the TPS source of truth.
 *
 * The regexes/thresholds below are byte-identical to the TPS route as of
 * U-STAGE 4 (Cyrillic block U+0400–U+04FF, the two date shapes, 7–9 A-Number).
 */

/** Cyrillic block U+0400–U+04FF. Identical to the TPS route's HAS_CYRILLIC. */
export const HAS_CYRILLIC = /[Ѐ-ӿ]/

/**
 * Accept the two canonical date shapes:
 *   USCIS canonical  MM/DD/YYYY
 *   ISO              YYYY-MM-DD
 * Identical to the TPS route's VALID_DATE. Anything else is a bug upstream.
 */
export const VALID_DATE = /^(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})$/

/** One firewall issue: which field failed and the machine-readable reason. */
export interface SharedFirewallIssue {
  field: string
  reason:
    | 'cyrillic_in_pdf_bound_field'
    | 'date_not_mm_dd_yyyy_or_iso'
    | 'a_number_must_be_digits_only'
    | 'a_number_digit_count_out_of_range'
}

/** Which fields each content check applies to, for a given product's answer shape. */
export interface SharedReadinessSpec {
  /** Fields that USCIS expects in Latin — flagged if they contain Cyrillic. */
  latinFields: readonly string[]
  /** Fields that must be MM/DD/YYYY or YYYY-MM-DD when present. */
  dateFields: readonly string[]
  /** Key of the A-Number field (digits-only, 7–9), or null if the product has none. */
  aNumberField: string | null
}

/**
 * Read a string field from an arbitrary answers record. Returns '' for any
 * non-string / empty value so callers don't have to type-narrow. Pure.
 */
function readString(answers: Record<string, unknown>, key: string): string {
  const v = answers[key]
  return typeof v === 'string' ? v : ''
}

/**
 * Run the three shared content checks over `answers` according to `spec`.
 * Returns the list of issues (empty ⇒ pass). Mirrors the TPS preflightAudit
 * EXACTLY: same order (latin → date → a_number), same reasons, same thresholds.
 *
 * Pure: no env reads, no mutation of `answers`.
 */
export function sharedContentAudit(
  answers: Record<string, unknown>,
  spec: SharedReadinessSpec,
): SharedFirewallIssue[] {
  const issues: SharedFirewallIssue[] = []

  for (const k of spec.latinFields) {
    const v = readString(answers, k)
    if (v && HAS_CYRILLIC.test(v)) {
      issues.push({ field: k, reason: 'cyrillic_in_pdf_bound_field' })
    }
  }

  for (const k of spec.dateFields) {
    const v = readString(answers, k)
    if (v && !VALID_DATE.test(v)) {
      issues.push({ field: k, reason: 'date_not_mm_dd_yyyy_or_iso' })
    }
  }

  if (spec.aNumberField) {
    const a = readString(answers, spec.aNumberField)
    if (a) {
      const digits = a.replace(/\D/g, '')
      if (a !== digits) {
        issues.push({ field: spec.aNumberField, reason: 'a_number_must_be_digits_only' })
      } else if (digits.length < 7 || digits.length > 9) {
        issues.push({ field: spec.aNumberField, reason: 'a_number_digit_count_out_of_range' })
      }
    }
  }

  return issues
}

/**
 * EAD I-765 content spec. EadFieldData is camelCase (firstName/lastName/...),
 * so the Latin/date field names differ from TPS but the CHECKS are identical.
 * Address is a single free-text line (`usAddress`) on the EAD wizard.
 */
export const EAD_READINESS_SPEC: SharedReadinessSpec = {
  latinFields: [
    'firstName',
    'lastName',
    'middleName',
    'usAddress',
    'countryOfBirth',
    'alienNumber',
  ],
  dateFields: ['dob'],
  aNumberField: 'alienNumber',
}

/**
 * Re-Parole I-131 content spec. Field names match the TPS route's Re-Parole
 * preflightAudit EXACTLY (this is the list already enforced unconditionally in
 * the Re-Parole route today) so flag-ON output is identical to that gate.
 */
export const REPAROLE_READINESS_SPEC: SharedReadinessSpec = {
  latinFields: [
    'family_name',
    'given_name',
    'middle_name',
    'mailing_street',
    'mailing_city',
    'mailing_state',
    'mailing_zip',
    'physical_street',
    'physical_city',
    'physical_state',
    'physical_zip',
    'a_number',
    'country_of_birth',
  ],
  dateFields: ['dob'],
  aNumberField: 'a_number',
}

/**
 * The single env flag that wires the shared content gate into EAD + Re-Parole.
 * DEFAULT OFF → both routes are byte-identical to today (EAD: no content gate;
 * Re-Parole: its existing local preflightAudit only). When 'on'/'1'/'true',
 * the routes additionally run sharedContentAudit and 422 on any issue.
 *
 * TPS is intentionally NOT gated by this flag — it keeps its own route-level
 * preflightAudit unconditionally, exactly as before U-STAGE 4.
 */
export function isSharedFormGateEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = (env.SHARED_FORM_GATE_ENABLED ?? '').trim().toLowerCase()
  return v === 'on' || v === '1' || v === 'true'
}
