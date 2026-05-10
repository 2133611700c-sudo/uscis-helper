/**
 * I-821 field map — Application for Temporary Protected Status.
 *
 * Source PDF: apps/web/public/uscis/tps/i-821.pdf
 * Edition: 01/20/25 (verified 2026-05-10 against uscis.gov page + PDF footer)
 * Total fields: 511 (per field_inventory_i821.json)
 *
 * We map the SUBSET of fields needed for a single-adult applicant on the
 * initial or re-registration path. Family/co-applicant fields (Parts 4-6),
 * eligibility yes/no Part 3, signature pages, and other complex sub-forms
 * are intentionally NOT mapped — that's a later cycle. The user signs the
 * blank signature line themselves before mailing.
 *
 * Field-name format is the literal AcroForm field name from the PDF:
 *   form1[0].Page02[0].Part2_Item1_FamilyName[0]
 *
 * Types:
 *   'text'      → setText(value)
 *   'date'      → setText(MM/DD/YYYY)
 *   'checkbox'  → check() if true
 *   'choice'    → select state from US 2-letter abbr (uses pdf-lib dropdown)
 */

import type { TPSAnswers } from '../answers'
import { toUscisDate } from '../answers'

export interface I821Op {
  field: string
  kind: 'text' | 'checkbox' | 'choice'
  value: string | boolean
}

export function buildI821Ops(a: TPSAnswers): I821Op[] {
  const ops: I821Op[] = []

  // ── Part 1 — Type of application ──────────────────────────────────────────
  // Field name pattern in inventory:
  //   form1[0].Page01[0].Part1_Item1_ApplicationType[0]  (initial)
  //   form1[0].Page01[0].Part1_Item1_ApplicationType[1]  (re-registration)
  // These are two separate checkboxes — exactly one is checked.
  ops.push({
    field: 'form1[0].Page01[0].Part1_Item1_ApplicationType[0]',
    kind: 'checkbox',
    value: a.filing_path === 'initial',
  })
  ops.push({
    field: 'form1[0].Page01[0].Part1_Item1_ApplicationType[1]',
    kind: 'checkbox',
    value: a.filing_path === 're_registration',
  })

  // Country of TPS designation — for Ukrainians applying, this is always 'Ukraine'
  ops.push({
    field: 'form1[0].Page01[0].Part1_TPScountry[0]',
    kind: 'text',
    value: a.country_of_nationality || 'Ukraine',
  })

  // ── Part 1 — Item 3: am I also filing I-765 concurrently? ─────────────────
  // [0] = Yes (filing concurrently), [1] = No (not filing concurrently / already have EAD)
  ops.push({
    field: 'form1[0].Page01[0].Part1_Item3_EADApp[0]',
    kind: 'checkbox',
    value: a.wants_ead === true,
  })
  ops.push({
    field: 'form1[0].Page01[0].Part1_Item3_EADApp[1]',
    kind: 'checkbox',
    value: a.wants_ead === false,
  })

  // ── Part 2 — Identity (Item 1: legal name) ─────────────────────────────────
  // I-821 places the legal-name fields on Page01.
  ops.push({ field: 'form1[0].Page01[0].Part2_Item1_FamilyName[0]', kind: 'text', value: a.family_name })
  ops.push({ field: 'form1[0].Page01[0].Part2_Item1_GivenName[0]',  kind: 'text', value: a.given_name })
  ops.push({ field: 'form1[0].Page01[0].Part2_Item1_MiddleName[0]', kind: 'text', value: a.middle_name ?? '' })

  // ── Part 2 — Item 4: US physical address (Page02) ──────────────────────────
  if (a.us_address_in_care_of) {
    ops.push({ field: 'form1[0].Page02[0].Part2_Item4_InCareofName[0]', kind: 'text', value: a.us_address_in_care_of })
  }
  ops.push({ field: 'form1[0].Page02[0].Part2_Item4_StreetNumberName[0]', kind: 'text', value: a.us_address_street })

  // Unit type checkboxes: [0]=Apt, [1]=Ste, [2]=Flr
  const unitIdx = a.us_address_unit_type === 'apt' ? 0 : a.us_address_unit_type === 'ste' ? 1 : a.us_address_unit_type === 'flr' ? 2 : -1
  for (let i = 0; i < 3; i++) {
    ops.push({ field: `form1[0].Page02[0].Part2_Item4_Unit[${i}]`, kind: 'checkbox', value: i === unitIdx })
  }
  if (a.us_address_unit_number) {
    ops.push({ field: 'form1[0].Page02[0].Part2_Item4_AptSteFlrNumber[0]', kind: 'text', value: a.us_address_unit_number })
  }
  ops.push({ field: 'form1[0].Page02[0].Part2_Item4_CityOrTown[0]', kind: 'text', value: a.us_address_city })
  ops.push({ field: 'form1[0].Page02[0].Part2_Item4_State[0]',     kind: 'choice', value: a.us_address_state })
  ops.push({ field: 'form1[0].Page02[0].Part2_Item4_ZipCode[0]',   kind: 'text', value: a.us_address_zip })

  // ── Part 2 — Item 5: is mailing same as physical? ──────────────────────────
  // [0] = Yes (same), [1] = No (different)
  ops.push({ field: 'form1[0].Page02[0].Part2_Item5_YN[0]', kind: 'checkbox', value: a.mailing_same_as_physical === true })
  ops.push({ field: 'form1[0].Page02[0].Part2_Item5_YN[1]', kind: 'checkbox', value: a.mailing_same_as_physical === false })

  // ── Part 2 — Item 6: mailing address (if different) ───────────────────────
  if (!a.mailing_same_as_physical) {
    if (a.mailing_in_care_of) {
      // (Not in our subset; ignored for now.)
    }
    ops.push({ field: 'form1[0].Page02[0].Part2_Item6_StreetNumberName[0]', kind: 'text', value: a.mailing_street ?? '' })
    const mUnitIdx = a.mailing_unit_type === 'apt' ? 0 : a.mailing_unit_type === 'ste' ? 1 : a.mailing_unit_type === 'flr' ? 2 : -1
    for (let i = 0; i < 3; i++) {
      ops.push({ field: `form1[0].Page02[0].Part2_Item6_Unit[${i}]`, kind: 'checkbox', value: i === mUnitIdx })
    }
    if (a.mailing_unit_number) {
      ops.push({ field: 'form1[0].Page02[0].Part2_Item6_AptSteFlrNumber[0]', kind: 'text', value: a.mailing_unit_number })
    }
    ops.push({ field: 'form1[0].Page02[0].Part2_Item6_CityOrTown[0]', kind: 'text', value: a.mailing_city ?? '' })
    ops.push({ field: 'form1[0].Page02[0].Part2_Item6_State[0]',     kind: 'choice', value: a.mailing_state ?? '' })
    ops.push({ field: 'form1[0].Page02[0].Part2_Item6_ZipCode[0]',   kind: 'text', value: a.mailing_zip ?? '' })
  }

  // ── Part 2 — Item 8 (USCIS online account number, if any) ─────────────────
  if (a.uscis_online_account) {
    ops.push({
      field: 'form1[0].Page02[0].#area[0].Part2_Item8_AcctIdentifier[0]',
      kind: 'text',
      value: a.uscis_online_account,
    })
  }

  // ── Part 2 — Item 10: applicant DOB ────────────────────────────────────────
  ops.push({ field: 'form1[0].Page02[0].Part2_Item10_DateOfBirth[0]', kind: 'text', value: toUscisDate(a.dob) })

  // ── Part 2 — Item 12: sex ──────────────────────────────────────────────────
  // [0] = Male, [1] = Female (per USCIS form ordering)
  ops.push({ field: 'form1[0].Page02[0].Part2_Item12_Sex[0]', kind: 'checkbox', value: a.sex === 'M' })
  ops.push({ field: 'form1[0].Page02[0].Part2_Item12_Sex[1]', kind: 'checkbox', value: a.sex === 'F' })

  // ── Part 2 — Item 13: city of birth ────────────────────────────────────────
  ops.push({ field: 'form1[0].Page02[0].Part2_Item13_CityOrTown[0]', kind: 'text', value: '' /* not captured this cycle */ })

  // ── Part 2 — Item 14: country of birth ────────────────────────────────────
  ops.push({ field: 'form1[0].Page02[0].Part2_Item14_CountryofBirth[0]', kind: 'text', value: a.country_of_birth })

  // ── Part 2 — Item 22: passport (Page03) ───────────────────────────────────
  ops.push({ field: 'form1[0].Page03[0].Part2_Item22_Passport[0]', kind: 'text', value: a.passport_number })
  // Item 22 line 2 = I-94 admission number
  if (a.i94_admission_number) {
    ops.push({ field: 'form1[0].Page03[0].Part2_Item22_I94[0]', kind: 'text', value: a.i94_admission_number })
  }

  // ── Part 2 — Item 24: country of issuance + passport expiration ──────────
  ops.push({ field: 'form1[0].Page03[0].Part2_Item24_CountryofIssuance[0]', kind: 'text', value: a.passport_country_of_issuance })
  ops.push({ field: 'form1[0].Page03[0].Part2_Item24_PassportExpiration[0]', kind: 'text', value: toUscisDate(a.passport_expiration_date) })

  return ops
}
