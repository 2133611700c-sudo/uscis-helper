import type { ServiceData } from './types'

/**
 * Re-Parole U4U service data.
 *
 * VERIFIED 2026-05-03 from official USCIS sources (uscis.gov):
 *
 * I-131 EDITION:
 *   - Edition 01/20/25 is CURRENT (verified live uscis.gov/i-131 on 2026-05-04,
 *     USCIS page last reviewed 03/30/2026).
 *   - "02/27/26" was the Feb 27 2024 program announcement date — NOT a form edition.
 *     DO NOT use 02/27/26 anywhere in this codebase.
 *
 * PAPER FILING:
 *   - Part 2, Item 1.e — select even if applicant is inside the US.
 *   - Handwrite "Ukraine RE-PAROLE" at the top of the first page.
 *   - Source: USCIS U4U Re-Parole Guide (last reviewed 10/11/2024)
 *
 * ONLINE FILING (my.uscis.gov):
 *   - Application category: Box 10.C
 *   - Dropdown: "I am outside the United States, and I am applying for an Advance Parole Document"
 *   - Answer "Yes" to re-parole question.
 *   - Fee waiver (I-912) NOT available for online filing.
 *   - Source: USCIS Form I-131 page (last reviewed 03/30/2026)
 *
 * FILING WINDOW:
 *   - No earlier than 180 days (6 months) before current parole expires.
 *
 * U4U PROGRAM STATUS:
 *   - Form I-134A (sponsor intake): PAUSED since Jan 28, 2025 (Executive Order).
 *   - Form I-131 Re-Parole: ACTIVE — separate process, continues case-by-case.
 *   - DO NOT state "program resumed June 9, 2025" — not on USCIS.gov.
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
  verified_at: '2026-05-04',

  form: {
    id: 'I-131',
    // Edition verified live from uscis.gov/i-131 on 2026-05-04 (USCIS last reviewed 03/30/2026).
    // "02/27/26" was the Feb 27 2024 program announcement — NOT the form edition.
    edition: '01/20/25',
    // Paper filing: Part 2, Item 1.e — select even if inside the US.
    // Online filing: Box 10.C via my.uscis.gov.
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

  // Status: I-134A (sponsor intake) paused Jan 2025. I-131 Re-Parole = ACTIVE, separate process.
  // Do NOT reference "June 9 2025 court order resumed program" — not on USCIS.gov.
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

  filingMethods: {
    paper: {
      formPart: 'Part 2, Item 1.e',
      handwrite: 'Ukraine RE-PAROLE',
      handwritePosition: 'top of first page of Form I-131',
      feeWaiverAllowed: true,
      sourceNote: 'USCIS U4U Re-Parole Guide (last reviewed 10/11/2024)',
    },
    online: {
      portal: 'https://my.uscis.gov',
      applicationCategory: 'Box 10.C — Certain Ukrainians paroled on/after Feb 11, 2022',
      userDropdown: 'I am outside the United States, and I am applying for an Advance Parole Document',
      reParoleAnswer: 'Yes',
      feeWaiverAllowed: false,
      feeWaiverNoteKey: 'servicePages.re-parole-u4u.filing.online.noFeeWaiver',
      sourceNote: 'USCIS Form I-131 page (last reviewed 03/30/2026)',
    },
  },

  verifiedSources: [
    {
      id: 'i131',
      label: 'Form I-131',
      url: 'https://www.uscis.gov/i-131',
      uscisLastReviewed: '2026-03-30',
      messenginfoVerified: '2026-05-04',
    },
    {
      id: 'u4u-reparole',
      label: 'U4U Re-Parole Guide',
      url: 'https://www.uscis.gov/humanitarian/uniting-for-ukraine/re-parole-process-for-certain-ukrainian-citizens-and-their-immediate-family-members',
      uscisLastReviewed: '2024-10-11',
      messenginfoVerified: '2026-05-04',
    },
    {
      id: 'i765',
      label: 'Form I-765 (EAD)',
      url: 'https://www.uscis.gov/i-765',
      uscisLastReviewed: '2026-04-30',
      messenginfoVerified: '2026-05-04',
    },
    {
      id: 'g1055',
      label: 'G-1055 Fee Schedule',
      url: 'https://www.uscis.gov/g-1055',
      uscisLastReviewed: '2026-04-23',
      messenginfoVerified: '2026-05-04',
    },
    {
      id: 'i134a-alert',
      label: 'U4U I-134A Pause Notice',
      url: 'https://www.uscis.gov/newsroom/alerts/update-on-form-i-134a',
      uscisLastReviewed: '2025-01-28',
      messenginfoVerified: '2026-05-04',
    },
  ],
  messenginfoVerifiedOn: '2026-05-04',

  sources: [
    {
      label: 'USCIS · Form I-131',
      url: 'https://www.uscis.gov/i-131',
      last_verified: '2026-05-04',
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
