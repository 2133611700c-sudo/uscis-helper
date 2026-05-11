/**
 * I-765 field map — Application for Employment Authorization.
 *
 * Source PDF: apps/web/public/uscis/tps/i-765.pdf
 * Edition: 08/21/25 (verified 2026-05-10 against uscis.gov page + PDF footer)
 * Total fields: 180 (per field_inventory_i765.json)
 *
 * For TPS the Eligibility Category is exactly:
 *   - (a)(12) → first-time TPS applicant filing concurrently with I-821 initial
 *   - (c)(19) → already-granted TPS re-registering
 *
 * USCIS splits the category into three small boxes on Page 3, Item 27:
 *   #area[1].section_1 = first letter ('a' or 'c')
 *   #area[1].section_2 = first number ('12' or '19')
 *   #area[1].section_3 = optional third segment (empty for TPS)
 */

import type { TPSAnswers } from '../answers'
import { toUscisDate } from '../answers'

export interface I765Op {
  field: string
  kind: 'text' | 'checkbox' | 'choice'
  value: string | boolean
}

export function buildI765Ops(a: TPSAnswers): I765Op[] {
  const ops: I765Op[] = []

  // ── Page 1: legal name (Line 1) ────────────────────────────────────────────
  ops.push({ field: 'form1[0].Page1[0].Line1a_FamilyName[0]', kind: 'text', value: a.family_name })
  ops.push({ field: 'form1[0].Page1[0].Line1b_GivenName[0]',  kind: 'text', value: a.given_name })
  ops.push({ field: 'form1[0].Page1[0].Line1c_MiddleName[0]', kind: 'text', value: a.middle_name ?? '' })

  // ── Page 2: US mailing address (Item 4) and physical address (Item 7) ─────
  // Per I-765 instructions, Item 4 is "U.S. Mailing Address" and Item 6 is
  // "Is your current mailing address the same as your physical address?".
  // We map the user's chosen mailing address into Line 4 fields.
  const useSeparateMailing = a.mailing_same_as_physical === false && !!a.mailing_street

  // Item 4 — mailing address (always required)
  ops.push({
    field: 'form1[0].Page2[0].Line4b_StreetNumberName[0]',
    kind: 'text',
    value: useSeparateMailing ? (a.mailing_street ?? '') : a.us_address_street,
  })

  // Item 5 — alternative address (we map physical here when separate-mailing case)
  // For the simple case (mailing = physical), Item 5 carries the same physical address.
  ops.push({ field: 'form1[0].Page2[0].Pt2Line5_AptSteFlrNumber[0]', kind: 'text', value: a.us_address_unit_number ?? '' })
  ops.push({ field: 'form1[0].Page2[0].Pt2Line5_CityOrTown[0]',     kind: 'text', value: a.us_address_city })
  ops.push({ field: 'form1[0].Page2[0].Pt2Line5_State[0]',          kind: 'choice', value: a.us_address_state })
  ops.push({ field: 'form1[0].Page2[0].Pt2Line5_ZipCode[0]',        kind: 'text', value: a.us_address_zip })

  // ── Page 2: Item 7 — A-Number (Alien Registration Number) ────────────────
  // Routed from EAD-card OCR (lib/tps/modules/ead.ts emits `a_number`).
  // Inventory field name: form1[0].Page2[0].Line7_AlienNumber[0]
  if (a.a_number) {
    ops.push({ field: 'form1[0].Page2[0].Line7_AlienNumber[0]', kind: 'text', value: a.a_number })
  }

  // ── Page 3: identity continued ─────────────────────────────────────────────
  ops.push({ field: 'form1[0].Page3[0].Line18a_CityTownOfBirth[0]', kind: 'text', value: '' /* not captured this cycle */ })
  ops.push({ field: 'form1[0].Page3[0].Line18c_CountryOfBirth[0]',  kind: 'text', value: a.country_of_birth })
  ops.push({ field: 'form1[0].Page3[0].Line19_DOB[0]',              kind: 'text', value: toUscisDate(a.dob) })

  // ── Page 3: passport (Line 20) ─────────────────────────────────────────────
  ops.push({ field: 'form1[0].Page3[0].Line20b_Passport[0]',        kind: 'text', value: a.passport_number })
  ops.push({ field: 'form1[0].Page3[0].Line20d_CountryOfIssuance[0]', kind: 'text', value: a.passport_country_of_issuance })
  ops.push({ field: 'form1[0].Page3[0].Line20e_ExpDate[0]',         kind: 'text', value: toUscisDate(a.passport_expiration_date) })

  // ── Page 3: entry (Lines 20a–24) ───────────────────────────────────────────
  if (a.i94_admission_number) {
    ops.push({ field: 'form1[0].Page3[0].Line20a_I94Number[0]', kind: 'text', value: a.i94_admission_number })
  }
  ops.push({ field: 'form1[0].Page3[0].Line21_DateOfLastEntry[0]', kind: 'text', value: toUscisDate(a.last_entry_date) })
  // Line 22 not in our subset (place of last arrival) — user fills if asked
  if (a.status_at_last_entry) {
    ops.push({ field: 'form1[0].Page3[0].Line23_StatusLastEntry[0]', kind: 'text', value: a.status_at_last_entry })
  }
  if (a.current_immigration_status) {
    ops.push({ field: 'form1[0].Page3[0].Line24_CurrentStatus[0]', kind: 'text', value: a.current_immigration_status })
  }

  // ── Page 3: Eligibility Category (Item 27) — THE critical TPS field ───────
  // The PDF splits this into three text boxes inside #area[1]:
  //   section_1 = letter ('a' or 'c')
  //   section_2 = first number ('12' or '19')
  //   section_3 = empty for TPS
  if (a.ead_category) {
    const [letter, number] = a.ead_category === 'a12' ? ['a', '12'] : ['c', '19']
    ops.push({ field: 'form1[0].Page3[0].#area[1].section_1[0]', kind: 'text', value: letter })
    ops.push({ field: 'form1[0].Page3[0].#area[1].section_2[0]', kind: 'text', value: number })
    ops.push({ field: 'form1[0].Page3[0].#area[1].section_3[0]', kind: 'text', value: '' })
  }

  // ── Page 4: applicant contact (Part 3) ─────────────────────────────────────
  // I-765 phone field has maxLength=10 (digits only). Real users type with
  // dashes/parens/spaces; strip to digits-only so pdf-lib accepts the value.
  const phoneDigitsOnly = (a.daytime_phone || '').replace(/\D/g, '').slice(0, 10)
  ops.push({ field: 'form1[0].Page4[0].Pt3Line3_DaytimePhoneNumber1[0]', kind: 'text', value: phoneDigitsOnly })
  ops.push({ field: 'form1[0].Page4[0].Pt3Line5_Email[0]',                kind: 'text', value: a.email })

  return ops
}
