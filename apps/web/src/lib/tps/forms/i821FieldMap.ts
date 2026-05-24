/**
 * I-821 field map — Application for Temporary Protected Status.
 *
 * Source PDF: apps/web/public/uscis/tps/i-821.pdf
 * Edition: 01/20/25 (verified 2026-05-10 against uscis.gov page + PDF footer)
 * Total fields: 511 (per field_inventory_i821.json)
 *
 * We map the SUBSET of fields needed for a single-adult applicant on the
 * initial or re-registration path.
 *
 * FIELD CLASSIFICATION (per TPS_FIELD_COVERAGE_CLOSEOUT_V1):
 *   MAPPED (this file):
 *     Part 1  — filing type, TPS country, concurrent EAD
 *     Part 2  — identity, address, A-number, DOB, sex, SSN, marital status,
 *               city/country of birth, passport, I-94, status at entry,
 *               port of entry, authorized stay, other names (first 2)
 *     Part 3  — biographic (ethnicity, race, eye/hair color)
 *     Part 7  — all yes/no background questions (defaults to No; user reviews)
 *     Part 8  — phone, email (contact)
 *   NOT MAPPED (intentionally manual):
 *     Part 2  — height/weight (Pt2Line3/4; cosmetic, user fills in Adobe)
 *     Part 4  — spouse information (conditional, user fills)
 *     Part 5  — prior spouse information (conditional, user fills)
 *     Part 6  — co-applicant children (conditional, user fills)
 *     Part 7  — text fields (trip dates, prior TPS dates) — user fills
 *     Part 8  — signature/date — user signs in ink
 *     Part 9  — interpreter — N/A if user self-prepares
 *     Part 10 — preparer — N/A if user self-prepares
 *
 * The user signs the blank signature line themselves before mailing.
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
import { toUscisDate, normalizeCountryOfBirth } from '../answers'

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

  // ── Part 2 — Item 7: A-Number (Alien Registration Number, if any) ────────
  // OCR'd from an EAD card; user can also type. 9 digits, no 'A' prefix.
  // Inventory field name: form1[0].Page02[0].Part2_Item7_AlienNumber[0]
  if (a.a_number) {
    ops.push({
      field: 'form1[0].Page02[0].Part2_Item7_AlienNumber[0]',
      kind: 'text',
      value: a.a_number,
    })
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

  // ── Part 2 — Item 9: Social Security Number (if applicant has one) ──────────
  if (a.ssn) {
    ops.push({
      field: 'form1[0].Page02[0].Part2_Item9_SocialSecurityNumber[0]',
      kind: 'text',
      value: a.ssn,
    })
  }

  // ── Part 2 — Item 11: Date of Birth (second AcroForm instance on Page02) ────
  // The I-821 PDF has two AcroForm field instances for DOB on Page 2 — Item 10
  // ([0]) and Item 11 ([0] and [1]). Both carry the same date. Item 11's two
  // instances appear to be linked left/right cells that split MM/DD and YYYY
  // on some printer layouts. Writing the full MM/DD/YYYY to both is safe —
  // the prefiller gracefully skips any cell that rejects a value longer than
  // its maxLength.
  ops.push({ field: 'form1[0].Page02[0].Part2_Item11_DateOfBirth[0]', kind: 'text', value: toUscisDate(a.dob) })
  ops.push({ field: 'form1[0].Page02[0].Part2_Item11_DateOfBirth[1]', kind: 'text', value: toUscisDate(a.dob) })

  // ── Part 2 — Item 13: city of birth ────────────────────────────────────────
  ops.push({ field: 'form1[0].Page02[0].Part2_Item13_CityOrTown[0]', kind: 'text', value: a.city_of_birth ?? '' })

  // ── Part 2 — Item 14: country of birth ────────────────────────────────────
  // Normalize: Ukrainian passports show oblast/city as "place of birth";
  // USCIS asks for COUNTRY. normalizeCountryOfBirth converts "Vinnytska Obl. / Ukr" → "Ukraine".
  ops.push({ field: 'form1[0].Page02[0].Part2_Item14_CountryofBirth[0]', kind: 'text', value: normalizeCountryOfBirth(a.country_of_birth, a.country_of_nationality) })

  // ── Part 2 — Item 17: marital status ──────────────────────────────────────
  // Seven checkboxes [0]-[6]: single, married, divorced, widowed,
  // legally_separated, annulled, other. At most one is checked.
  const maritalMap: Record<string, number> = {
    single: 0, married: 1, divorced: 2, widowed: 3,
    legally_separated: 4, annulled: 5, other: 6,
  }
  for (let i = 0; i < 7; i++) {
    ops.push({
      field: `form1[0].Page02[0].Part2_Item17_MaritalStatus[${i}]`,
      kind: 'checkbox',
      value: a.marital_status !== undefined && maritalMap[a.marital_status] === i,
    })
  }

  // ── Part 2 — Items 15/16: Other names (aliases / prior names) ────────────────
  // First two other-name slots have AcroForm cells. Map from other_names[0/1].
  // Fields: Item15a=FamilyName, Item15b=GivenName, Item15c=MiddleName, Item15d=other-name type
  // Fields: Item16a=FamilyName, Item16b=GivenName, Item16c=MiddleName, Item16d=other-name type
  if (a.other_names && a.other_names.length > 0) {
    const n0 = a.other_names[0]
    ops.push({ field: 'form1[0].Page02[0].Part2_Item15a[0]', kind: 'text', value: n0.family })
    ops.push({ field: 'form1[0].Page02[0].Part2_Item15b[0]', kind: 'text', value: n0.given })
    ops.push({ field: 'form1[0].Page02[0].Part2_Item15c[0]', kind: 'text', value: n0.middle ?? '' })
  }
  if (a.other_names && a.other_names.length > 1) {
    const n1 = a.other_names[1]
    ops.push({ field: 'form1[0].Page02[0].Part2_Item16a[0]', kind: 'text', value: n1.family })
    ops.push({ field: 'form1[0].Page02[0].Part2_Item16b[0]', kind: 'text', value: n1.given })
    ops.push({ field: 'form1[0].Page02[0].Part2_Item16c[0]', kind: 'text', value: n1.middle ?? '' })
  }

  // ── Part 2 — Item 20: Port of entry ─────────────────────────────────────────
  // Accepts either split fields (port_of_entry_city/state) or combined place_of_last_entry
  const poeCity = a.port_of_entry_city || (a.place_of_last_entry?.split(',')[0]?.trim() ?? '')
  const poeState = a.port_of_entry_state || (a.place_of_last_entry?.split(',')[1]?.trim() ?? '')
  if (poeCity) {
    ops.push({ field: 'form1[0].Page03[0].Part2_Item20_CityOrTown[0]', kind: 'text', value: poeCity })
  }
  if (poeState) {
    ops.push({ field: 'form1[0].Page03[0].Part2_Item20_State[0]', kind: 'choice', value: poeState })
  }

  // ── Part 2 — Item 21: Authorized period of stay ──────────────────────────────
  if (a.authorized_stay) {
    ops.push({ field: 'form1[0].Page03[0].Part2_Item21_AuthorizedPdofStay[0]', kind: 'text', value: a.authorized_stay })
  }

  // ── Part 2 — Item 18: date of last arrival (Page03) ────────────────────────
  // The PDF AcroForm field is misleadingly named "P2_Line7_DateOfBirth" but it
  // is physically above Item 19 (immigration status) at Y≈618 on page 3, which
  // corresponds to "Date of your last arrival to the United States" on the form.
  if (a.last_entry_date) {
    ops.push({
      field: 'form1[0].Page03[0].P2_Line7_DateOfBirth[0]',
      kind: 'text',
      value: toUscisDate(a.last_entry_date),
    })
  }

  // ── Part 2 — Item 19: immigration status at last entry (Page03) ────────────
  // I-765 Line 23 already maps this; I-821 Part 2 Item 19 is the same data.
  if (a.status_at_last_entry) {
    ops.push({
      field: 'form1[0].Page03[0].Part2_Item19_ImmigrationStatus[0]',
      kind: 'text',
      value: a.status_at_last_entry,
    })
  }

  // ── Part 2 — Item 22: passport (Page03) ───────────────────────────────────
  ops.push({ field: 'form1[0].Page03[0].Part2_Item22_Passport[0]', kind: 'text', value: a.passport_number })
  // Item 22 line 2 = I-94 admission number
  if (a.i94_admission_number) {
    ops.push({ field: 'form1[0].Page03[0].Part2_Item22_I94[0]', kind: 'text', value: a.i94_admission_number })
  }

  // ── Part 2 — Item 24: country of issuance + passport expiration ──────────
  ops.push({ field: 'form1[0].Page03[0].Part2_Item24_CountryofIssuance[0]', kind: 'text', value: a.passport_country_of_issuance })
  ops.push({ field: 'form1[0].Page03[0].Part2_Item24_PassportExpiration[0]', kind: 'text', value: toUscisDate(a.passport_expiration_date) })

  // ── Part 3 — Biographic Information (Pages 03-04) ────────────────────────────
  // Ethnicity: [0]=Yes Hispanic/Latino, [1]=No not Hispanic/Latino
  const ethnicityIdx = a.ethnicity === 'hispanic' ? 0 : a.ethnicity === 'not_hispanic' ? 1 : -1
  for (let i = 0; i < 2; i++) {
    ops.push({ field: `form1[0].Page03[0].Part3_Item1_Ethnicity[${i}]`, kind: 'checkbox', value: i === ethnicityIdx })
  }
  // Race (one or more may be checked)
  ops.push({ field: 'form1[0].Page03[0].Part3_Item2_RaceW[0]', kind: 'checkbox', value: a.race_white ?? false })
  ops.push({ field: 'form1[0].Page03[0].Part3_Item2_RaceA[0]', kind: 'checkbox', value: a.race_asian ?? false })
  ops.push({ field: 'form1[0].Page03[0].Part3_Item2_RaceB[0]', kind: 'checkbox', value: a.race_black ?? false })
  ops.push({ field: 'form1[0].Page03[0].Part3_Item2_RaceI[0]', kind: 'checkbox', value: a.race_american_indian ?? false })
  ops.push({ field: 'form1[0].Page03[0].Part3_Item2_RaceH[0]', kind: 'checkbox', value: a.race_pacific_islander ?? false })

  // Eye color: [0]=Black [1]=Blue [2]=Brown [3]=Gray [4]=Green [5]=Hazel [6]=Maroon [7]=Pink [8]=Unknown
  const eyeColorOrder = ['black', 'blue', 'brown', 'gray', 'green', 'hazel', 'maroon', 'pink', 'unknown'] as const
  const eyeIdx = a.eye_color !== undefined ? eyeColorOrder.indexOf(a.eye_color) : -1
  for (let i = 0; i < 9; i++) {
    ops.push({ field: `form1[0].Page04[0].Page04[0].Part3_Item5_Eyecolor[${i}]`, kind: 'checkbox', value: i === eyeIdx })
  }
  // Hair color: [0]=Bald [1]=Black [2]=Blonde [3]=Brown [4]=Gray [5]=Red [6]=Sandy [7]=White [8]=Unknown
  const hairColorOrder = ['bald', 'black', 'blonde', 'brown', 'gray', 'red', 'sandy', 'white', 'unknown'] as const
  const hairIdx = a.hair_color !== undefined ? hairColorOrder.indexOf(a.hair_color) : -1
  for (let i = 0; i < 9; i++) {
    ops.push({ field: `form1[0].Page04[0].Page04[0].Part3_Item6_Haircolor[${i}]`, kind: 'checkbox', value: i === hairIdx })
  }

  // ── Part 7 — Background declaration yes/no questions ─────────────────────────
  // Default: all false (No). User must review and confirm before generation.
  // The PacketCompletenessChecker enforces part7_reviewed=true before allowing
  // ZIP download. This satisfies the field_provenance requirement: no silent
  // defaults — user explicitly sees and confirms each answer.
  //
  // Field pattern: _YN[0]=Yes, _YN[1]=No (or _YND for Yes/No/Don't Know)
  // We write: [0]=value, [1]=!value
  type YNQ = [string, boolean]  // [field_prefix, answer_value]
  const part7Questions: YNQ[] = [
    // Page 7
    ['form1[0].Page07[0].Part7_Item4a_YN', !!a.part7_4a],
    ['form1[0].Page07[0].Part7_Item4b_YN', !!a.part7_4b],
    ['form1[0].Page07[0].Part7_Item4c_YN', !!a.part7_4c],
    // Page 8
    ['form1[0].Page08[0].Part7_Item5a_YN', !!a.part7_5a],
    ['form1[0].Page08[0].Part7_Item5b_YN', !!a.part7_5b],
    ['form1[0].Page08[0].Part7_Item5c_YN', !!a.part7_5c],
    ['form1[0].Page08[0].Part7_Item7a_YN', !!a.part7_7a],
    ['form1[0].Page08[0].Part7_Item7b_YN', !!a.part7_7b],
    ['form1[0].Page08[0].Part7_Item7c_YN', !!a.part7_7c],
    ['form1[0].Page08[0].Part7_Item8_YN',  !!a.part7_8],
    ['form1[0].Page08[0].Part7_Item9a_YN', !!a.part7_9a],
    ['form1[0].Page08[0].Part7_Item9b_YN', !!a.part7_9b],
    ['form1[0].Page08[0].Part7_Item9c_YN', !!a.part7_9c],
    ['form1[0].Page08[0].Part7_Item9d_YN', !!a.part7_9d],
    ['form1[0].Page08[0].Part7_Item9e_YN', !!a.part7_9e],
    ['form1[0].Page08[0].Part7_Item11a_YN', !!a.part7_11a],
    ['form1[0].Page08[0].Part7_Item11b_YN', !!a.part7_11b],
    ['form1[0].Page08[0].Part7_Item11c_YN', !!a.part7_11c],
    ['form1[0].Page08[0].Part7_Item11d_YN', !!a.part7_11d],
    ['form1[0].Page08[0].Part7_Item12a_YN', !!a.part7_12a],
    ['form1[0].Page08[0].Part7_Item12b_YN', !!a.part7_12b],
    ['form1[0].Page08[0].Part7_Item12c_YN', !!a.part7_12c],
    ['form1[0].Page08[0].Part7_Item12d_YN', !!a.part7_12d],
    ['form1[0].Page08[0].Part7_Item13a_YN', !!a.part7_13a],
    ['form1[0].Page08[0].Part7_Item13b_YN', !!a.part7_13b],
    ['form1[0].Page08[0].Part7_Item13c_YN', !!a.part7_13c],
    // Page 9
    ['form1[0].Page09[0].Part7_Item17_YN',  !!a.part7_17],
    ['form1[0].Page09[0].Part7_Item18a_YN', !!a.part7_18a],
    ['form1[0].Page09[0].Part7_Item18b_YN', !!a.part7_18b],
    ['form1[0].Page09[0].Part7_Item18c_YN', !!a.part7_18c],
  ]
  for (const [prefix, yes] of part7Questions) {
    ops.push({ field: `${prefix}[0]`, kind: 'checkbox', value: yes })   // Yes
    ops.push({ field: `${prefix}[1]`, kind: 'checkbox', value: !yes })  // No
  }

  // ── Part 8 — Contact information (Page 11) ──────────────────────────────────
  // Phone maxLength = 10 (digits only). Strip non-digits before writing.
  const phoneDigitsOnly = (a.daytime_phone || '').replace(/\D/g, '').slice(0, 10)
  ops.push({ field: 'form1[0].Page11[0].Part8_Item3_DayPhone[0]', kind: 'text', value: phoneDigitsOnly })
  // Mobile phone — copy from daytime if no separate mobile
  ops.push({ field: 'form1[0].Page11[0].Part8_Item4_MobilePhone[0]', kind: 'text', value: phoneDigitsOnly })
  ops.push({ field: 'form1[0].Page11[0].Part8_Item5_Email[0]',    kind: 'text', value: a.email })

  // ── Part 8: English proficiency statement ──────────────────────────────────
  // [0]=Yes I can read/understand English, [1]=No
  const eng = a.english_proficiency ?? false
  ops.push({ field: 'form1[0].Page10[0].Part8_Item1_AppStmt[0]', kind: 'checkbox', value: eng })
  ops.push({ field: 'form1[0].Page10[0].Part8_Item1_AppStmt[1]', kind: 'checkbox', value: !eng })

  // ── Part 8 — Signature + Date (Page 11) ─────────────────────────────────────
  // If electronic signature provided, fill the signature text field with /s/ format
  // and set the date. If paper mode, leave blank for handwritten signature.
  if (a._signature_mode === 'screen' && a._signature_name) {
    ops.push({ field: 'form1[0].Page11[0].Part8_Item6a_Signature[0]', kind: 'text', value: `/s/ ${a._signature_name}` })
    ops.push({ field: 'form1[0].Page11[0].Part8_Item6b_DateofSignature[0]', kind: 'text', value: a._signature_date || new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) })
  }

  return ops
}
