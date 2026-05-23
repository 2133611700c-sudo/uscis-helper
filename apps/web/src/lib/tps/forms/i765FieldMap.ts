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
import { toUscisDate, normalizeCountryOfBirth } from '../answers'

export interface I765Op {
  field: string
  kind: 'text' | 'checkbox' | 'choice'
  value: string | boolean
}

export function buildI765Ops(a: TPSAnswers): I765Op[] {
  const ops: I765Op[] = []

  // ── Page 1: Part 1 — Type of application ────────────────────────────────────
  // Three checkboxes: [0]=initial permission, [1]=replacement, [2]=renewal
  // i765_application_type defaults from filing_path but user must confirm/override.
  // Provenance: visible_default_confirmed_by_user — shown in UI before generation.
  const appType = a.i765_application_type
    ?? (a.filing_path === 'initial' ? 'initial' : 'renewal')
  ops.push({ field: 'form1[0].Page1[0].Part1_Checkbox[0]', kind: 'checkbox', value: appType === 'initial' })
  ops.push({ field: 'form1[0].Page1[0].Part1_Checkbox[1]', kind: 'checkbox', value: appType === 'replacement' })
  ops.push({ field: 'form1[0].Page1[0].Part1_Checkbox[2]', kind: 'checkbox', value: appType === 'renewal' })

  // ── Page 1: legal name (Line 1) ────────────────────────────────────────────
  ops.push({ field: 'form1[0].Page1[0].Line1a_FamilyName[0]', kind: 'text', value: a.family_name })
  ops.push({ field: 'form1[0].Page1[0].Line1b_GivenName[0]',  kind: 'text', value: a.given_name })
  ops.push({ field: 'form1[0].Page1[0].Line1c_MiddleName[0]', kind: 'text', value: a.middle_name ?? '' })

  // ── Page 2: US mailing address (Line 4) and physical address (Line 7) ──────
  //
  // I-765 address layout (Page 2):
  //   Line 4b : Mailing street number and name
  //   Line 5  : Mailing address continuation (Apt/Ste/Flr, City, State, Zip)
  //   Line 5 Checkbox [0] : Is mailing address same as physical? YES
  //   Line 5 Checkbox [1] : Is mailing address same as physical? NO
  //   Line 7  : Physical address (only when mailing ≠ physical)
  //
  // When mailing == physical → Line 4b + Line 5 = physical address; [0] checked.
  // When mailing ≠  physical → Line 4b + Line 5 = mailing address; [1] checked;
  //                            Line 7 = physical address.
  const useSeparateMailing = a.mailing_same_as_physical === false && !!a.mailing_street

  // Line 4b — mailing street (or physical when same)
  ops.push({
    field: 'form1[0].Page2[0].Line4b_StreetNumberName[0]',
    kind: 'text',
    value: useSeparateMailing ? (a.mailing_street ?? '') : a.us_address_street,
  })

  // Line 5 — mailing address continuation: unit type + unit number + city + state + zip
  // Resolve which address to use: mailing when separate, physical otherwise.
  const line5UnitType   = useSeparateMailing ? (a.mailing_unit_type   ?? null) : (a.us_address_unit_type   ?? null)
  const line5UnitNumber = useSeparateMailing ? (a.mailing_unit_number ?? '')   : (a.us_address_unit_number ?? '')
  const line5City       = useSeparateMailing ? (a.mailing_city        ?? '')   : a.us_address_city
  const line5State      = useSeparateMailing ? (a.mailing_state       ?? '')   : a.us_address_state
  const line5Zip        = useSeparateMailing ? (a.mailing_zip         ?? '')   : a.us_address_zip

  // Unit type checkboxes: [0]=Apt, [1]=Ste, [2]=Flr
  const line5UnitIdx = line5UnitType === 'apt' ? 0 : line5UnitType === 'ste' ? 1 : line5UnitType === 'flr' ? 2 : -1
  for (let i = 0; i < 3; i++) {
    ops.push({ field: `form1[0].Page2[0].Pt2Line5_Unit[${i}]`, kind: 'checkbox', value: i === line5UnitIdx })
  }
  ops.push({ field: 'form1[0].Page2[0].Pt2Line5_AptSteFlrNumber[0]', kind: 'text',   value: line5UnitNumber })
  ops.push({ field: 'form1[0].Page2[0].Pt2Line5_CityOrTown[0]',      kind: 'text',   value: line5City })
  ops.push({ field: 'form1[0].Page2[0].Pt2Line5_State[0]',           kind: 'choice', value: line5State })
  ops.push({ field: 'form1[0].Page2[0].Pt2Line5_ZipCode[0]',         kind: 'text',   value: line5Zip })

  // "Is your mailing address the same as your physical address?" checkbox
  // PDF appearance states: Checkbox[0] on-state = /N (No), Checkbox[1] on-state = /Y (Yes)
  // Verified via pypdf: Checkbox[0] AS=/N, Checkbox[1] appearances=[/Y, /Off]
  ops.push({ field: 'form1[0].Page2[0].Part2Line5_Checkbox[0]', kind: 'checkbox', value: useSeparateMailing })
  ops.push({ field: 'form1[0].Page2[0].Part2Line5_Checkbox[1]', kind: 'checkbox', value: !useSeparateMailing })

  // Line 7 — physical address (only populated when mailing ≠ physical)
  if (useSeparateMailing) {
    ops.push({
      field: 'form1[0].Page2[0].Pt2Line7_StreetNumberName[0]',
      kind: 'text',
      value: a.us_address_street,
    })
    const phyUnitIdx = a.us_address_unit_type === 'apt' ? 0 : a.us_address_unit_type === 'ste' ? 1 : a.us_address_unit_type === 'flr' ? 2 : -1
    for (let i = 0; i < 3; i++) {
      ops.push({ field: `form1[0].Page2[0].Pt2Line7_Unit[${i}]`, kind: 'checkbox', value: i === phyUnitIdx })
    }
    ops.push({ field: 'form1[0].Page2[0].Pt2Line7_AptSteFlrNumber[0]', kind: 'text',   value: a.us_address_unit_number ?? '' })
    ops.push({ field: 'form1[0].Page2[0].Pt2Line7_CityOrTown[0]',      kind: 'text',   value: a.us_address_city })
    ops.push({ field: 'form1[0].Page2[0].Pt2Line7_State[0]',           kind: 'choice', value: a.us_address_state })
    ops.push({ field: 'form1[0].Page2[0].Pt2Line7_ZipCode[0]',         kind: 'text',   value: a.us_address_zip })
  }

  // ── Page 2: Line 7 — A-Number (Alien Registration Number) ────────────────
  // Routed from EAD-card OCR (lib/tps/modules/ead.ts emits `a_number`).
  // Inventory field name: form1[0].Page2[0].Line7_AlienNumber[0]
  if (a.a_number) {
    ops.push({ field: 'form1[0].Page2[0].Line7_AlienNumber[0]', kind: 'text', value: a.a_number })
  }

  // ── Page 2: Line 9 — Gender ──────────────────────────────────────────────────
  // [0]=Male, [1]=Female (matches I-821 Part2_Item12_Sex ordering)
  ops.push({ field: 'form1[0].Page2[0].Line9_Checkbox[0]', kind: 'checkbox', value: a.sex === 'M' })
  ops.push({ field: 'form1[0].Page2[0].Line9_Checkbox[1]', kind: 'checkbox', value: a.sex === 'F' })

  // ── Page 2: Line 10 — Race ────────────────────────────────────────────────────
  // [0]=White [1]=Asian [2]=Black/African American [3]=American Indian/Alaska [4]=Pacific Islander
  ops.push({ field: 'form1[0].Page2[0].Line10_Checkbox[0]', kind: 'checkbox', value: a.race_white ?? false })
  ops.push({ field: 'form1[0].Page2[0].Line10_Checkbox[1]', kind: 'checkbox', value: a.race_asian ?? false })
  ops.push({ field: 'form1[0].Page2[0].Line10_Checkbox[2]', kind: 'checkbox', value: a.race_black ?? false })
  ops.push({ field: 'form1[0].Page2[0].Line10_Checkbox[3]', kind: 'checkbox', value: a.race_american_indian ?? false })

  // ── Page 2: Line 12b — Social Security Number (if applicant has one) ──────
  if (a.ssn) {
    ops.push({ field: 'form1[0].Page2[0].Line12b_SSN[0]', kind: 'text', value: a.ssn })
  }

  // ── Page 3: identity continued ─────────────────────────────────────────────
  ops.push({ field: 'form1[0].Page3[0].Line18a_CityTownOfBirth[0]', kind: 'text', value: a.city_of_birth ?? '' })
  ops.push({ field: 'form1[0].Page3[0].Line18c_CountryOfBirth[0]',  kind: 'text', value: normalizeCountryOfBirth(a.country_of_birth, a.country_of_nationality) })
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
  // Mobile phone — copy from daytime if no separate mobile provided
  ops.push({ field: 'form1[0].Page4[0].Pt3Line4_MobileNumber1[0]',       kind: 'text', value: phoneDigitsOnly })
  ops.push({ field: 'form1[0].Page4[0].Pt3Line5_Email[0]',                kind: 'text', value: a.email })

  // ── Page 4: English proficiency (Part 3, Item 1) ──────────────────────────
  // Checkbox [0]=Yes I can read/understand English, [1]=No
  // For TPS filers: default to 1.b (No) and leave language blank — user reviews.
  // If user explicitly set english_proficiency, use that.
  const speaksEnglish = a.english_proficiency ?? false
  ops.push({ field: 'form1[0].Page4[0].Pt3Line1Checkbox[0]', kind: 'checkbox', value: speaksEnglish })
  ops.push({ field: 'form1[0].Page4[0].Pt3Line1Checkbox[1]', kind: 'checkbox', value: !speaksEnglish })

  // ── Page 2: Country of Citizenship (Line 17) ──────────────────────────────
  // Line17a = country of citizenship, Line17b = country of nationality (if different)
  // For Ukrainian TPS: both are typically "Ukraine"
  ops.push({ field: 'form1[0].Page2[0].Line17a_CountryOfBirth[0]', kind: 'text', value: a.country_of_nationality ?? a.country_of_birth ?? '' })

  // ── Page 2: In Care Of Name (Line 4a) ─────────────────────────────────────
  if (a.us_address_in_care_of) {
    ops.push({ field: 'form1[0].Page2[0].Line4a_InCareofName[0]', kind: 'text', value: a.us_address_in_care_of })
  }

  // ── Page 3: Previously filed I-765? (Line 29) ────────────────────────────
  // [0]=Yes, [1]=No. For re-registration/renewal → Yes. For initial → No.
  const prevFiled = a.filing_path !== 'initial'
  ops.push({ field: 'form1[0].Page3[0].PtLine29_YesNo[0]', kind: 'checkbox', value: prevFiled })
  ops.push({ field: 'form1[0].Page3[0].PtLine29_YesNo[1]', kind: 'checkbox', value: !prevFiled })

  // ── Page 3: Place of last arrival (Line 22) ──────────────────────────────
  if (a.place_of_last_entry) {
    ops.push({ field: 'form1[0].Page3[0].place_entry[0]', kind: 'text', value: a.place_of_last_entry })
  }

  // ── Page 3: Province of birth (Line 18b) ─────────────────────────────────
  if (a.province_of_birth) {
    ops.push({ field: 'form1[0].Page3[0].Line18b_CityTownOfBirth[0]', kind: 'text', value: a.province_of_birth })
  }

  return ops
}
