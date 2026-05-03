import type { ServiceData } from './types'

/**
 * Re-Parole U4U service data.
 *
 * VERIFIED 2026-05-03 from official USCIS sources (uscis.gov):
 *
 * I-131 EDITION:
 *   - Edition 02/27/26 is CURRENT as of April 1, 2026 (01/20/25 no longer accepted)
 *
 * PAPER FILING ITEM:
 *   - Part 2, Item 1.e: "I am outside the United States, and I am applying for
 *     Advance Parole Document" — select EVEN IF applicant is inside the US.
 *   - Old Item 10.C was under streamlined process (eliminated June 2025). INCORRECT NOW.
 *   - Source: uscis.gov/humanitarian/uniting-for-ukraine/re-parole-process...
 *
 * ONLINE FILING:
 *   - Select "I am outside the United States applying for Advance Parole Document"
 *     in dropdown + answer "Yes" to re-parole question.
 *
 * TOP OF FORM:
 *   - Handwrite "Ukraine RE-PAROLE" at the top of the paper form.
 *
 * FILING WINDOW:
 *   - No earlier than 180 days (6 months) before current parole expires.
 *
 * U4U PROGRAM STATUS:
 *   - Paused: Jan 27, 2025
 *   - Admin hold: Feb 14, 2025
 *   - Resumed: June 9, 2025 (federal court order)
 *   - Now: case-by-case only; streamlined process eliminated June 2025.
 *
 * FEE STRUCTURE (effective Oct 16, 2025):
 *   - Two separate fees: I-131 filing fee + parole grant fee (on conditional approval).
 *   - NEVER hardcode dollar amounts. Always link to uscis.gov/feecalculator + uscis.gov/g-1055.
 *
 * MEDICAL ATTESTATION:
 *   - Required: proof of vaccinations + TB/IGRA test where applicable.
 *   - Follow current USCIS instructions for medical requirements.
 *
 * EAD (FORM I-765):
 *   - DO NOT file I-765 for (c)(11) before I-131 is approved and USCIS authorizes EAD.
 *   - Category for re-parolees: (c)(11), Part 2 Item 27.
 *
 * FEE WAIVER:
 *   - Form I-912 available for paper filing only.
 *   - Verify eligibility at uscis.gov/i-912.
 *
 * PROCESSING TIMES:
 *   - Vary significantly. Check uscis.gov/processing-times.
 *   - Do NOT hardcode fixed month estimates in user-facing text.
 */
export const reParoleU4UData: ServiceData = {
  slug: 're-parole-u4u',
  full_data: true,
  verification_status: 'verified',
  verified_at: '2026-05-03',

  form: {
    id: 'I-131',
    edition: '02/27/26',
    // was 10.C under old streamlined process (eliminated June 2025)
    // correct item per USCIS.gov (verified 2026-05-03): Part 2, Item 1.e
    item_for_u4u: '1.e',
    item_label:
      'I am outside the United States, and I am applying for Advance Parole Document (select even if you are inside the US — per USCIS re-parole instructions)',
    top_of_form_text: 'Ukraine RE-PAROLE',
  },

  ead: {
    form: 'I-765',
    category: '(c)(11)',
    part: '2',
  },

  filing: {
    window_days: 180,
    window_description:
      'Submit no earlier than 180 days (6 months) before current parole expires',
    methods: ['online', 'mail'],
    online_url: 'https://my.uscis.gov',
    addresses_url: 'https://www.uscis.gov/i-131-addresses',
    processing_times_url: 'https://egov.uscis.gov/processing-times/',
  },

  fees: {
    calculator_url: 'https://www.uscis.gov/feecalculator',
    schedule_url: 'https://www.uscis.gov/g-1055',
    fee_waiver_url: 'https://www.uscis.gov/i-912',
    note_key: 'services.re-parole-u4u.fees.note',
  },

  // Status warning: U4U paused Jan 2025, resumed June 9 2025 (federal court), now case-by-case
  statusWarningKey: 'servicePages.re-parole-u4u.statusWarning',
  // Fee notice: two-fee structure — filing fee + parole grant fee (Oct 2025)
  feeNoticeKey: 'servicePages.re-parole-u4u.feeNotice',
  // Processing time: varies — link to uscis.gov/processing-times
  processingWarningKey: 'servicePages.re-parole-u4u.processingWarning',
  // Medical attestation: vaccines + TB IGRA test
  medicalNoteKey: 'servicePages.re-parole-u4u.medicalNote',
  // EAD warning: do NOT file I-765 before I-131 approval
  eadWarningKey: 'servicePages.re-parole-u4u.eadWarning',
  // Fee waiver: Form I-912 for paper filing
  feeWaiverNoteKey: 'servicePages.re-parole-u4u.feeWaiverNote',

  sources: [
    {
      label: 'USCIS · Form I-131',
      url: 'https://www.uscis.gov/i-131',
      last_verified: '2026-05-03',
    },
    {
      label: 'USCIS · Re-Parole Process for Certain Ukrainian Citizens',
      url: 'https://www.uscis.gov/humanitarian/uniting-for-ukraine/re-parole-process-for-certain-ukrainian-citizens-and-their-immediate-family-members',
      last_verified: '2026-05-03',
    },
    {
      label: 'USCIS · Forms Updates',
      url: 'https://www.uscis.gov/forms/forms-updates',
      last_verified: '2026-05-03',
    },
    {
      label: 'USCIS · Fee Calculator',
      url: 'https://www.uscis.gov/feecalculator',
      last_verified: '2026-05-03',
    },
    {
      label: 'USCIS · G-1055 Fee Schedule',
      url: 'https://www.uscis.gov/g-1055',
      last_verified: '2026-05-03',
    },
    {
      label: 'USCIS · Form I-912 Fee Waiver',
      url: 'https://www.uscis.gov/i-912',
      last_verified: '2026-05-03',
    },
    {
      label: 'CBP · I-94 Lookup',
      url: 'https://i94.cbp.dhs.gov/',
      last_verified: '2026-05-03',
    },
  ],
}

export const SERVICE_DATA: Record<string, ServiceData> = {
  're-parole-u4u': reParoleU4UData,
}

export function getServiceData(slug: string): ServiceData | undefined {
  return SERVICE_DATA[slug]
}
