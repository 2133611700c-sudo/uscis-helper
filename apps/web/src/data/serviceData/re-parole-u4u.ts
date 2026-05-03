import type { ServiceData } from './types'

/**
 * Re-Parole U4U service data.
 *
 * VERIFIED 2026-05-02 from official USCIS sources:
 * - I-131 PDF (last-modified 2025-10-17): edition 01/20/25, Item 10.C
 *   ("Re-parole Process for certain Ukrainian Citizens...")
 * - USCIS Ukraine re-parole page: "Handwrite 'Ukraine RE-PAROLE' at the top
 *   of the form"; "no earlier than 180 days (6 months) before the expiration
 *   of their current period of parole"
 * - I-765 instructions (line 599): "Parole--(c)(11)" EAD category
 *
 * NOTE: USCIS forms-updates page lists a new edition dated February 2026
 * for Form I-129 (Nonimmigrant Worker Petition) — NOT for I-131.
 * I-131 has no edition update announced as of 2026-05-02.
 */
export const reParoleU4UData: ServiceData = {
  slug: 're-parole-u4u',
  full_data: true,
  verification_status: 'verified',
  verified_at: '2026-05-02',

  form: {
    id: 'I-131',
    edition: '01/20/25',
    item_for_u4u: '10.C',
    item_label:
      'Re-parole Process for certain Ukrainian Citizens and Their Immediate Family Members Paroled Into the United States on or After February 11, 2022',
    top_of_form_text: 'Ukraine RE-PAROLE',
  },

  ead: {
    form: 'I-765',
    category: '(c)(11)',
    part: '9',
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
    note_key: 'services.re-parole-u4u.fees.note',
  },

  sources: [
    {
      label: 'USCIS · Form I-131',
      url: 'https://www.uscis.gov/i-131',
      last_verified: '2026-05-02',
    },
    {
      label: 'USCIS · Re-Parole Process for Certain Ukrainian Citizens',
      url: 'https://www.uscis.gov/humanitarian/uniting-for-ukraine/re-parole-process-for-certain-ukrainian-citizens-and-their-immediate-family-members',
      last_verified: '2026-05-02',
    },
    {
      label: 'USCIS · Forms Updates',
      url: 'https://www.uscis.gov/forms/forms-updates',
      last_verified: '2026-05-02',
    },
    {
      label: 'CBP · I-94 Lookup',
      url: 'https://i94.cbp.dhs.gov/',
      last_verified: '2026-05-02',
    },
  ],
}

export const SERVICE_DATA: Record<string, ServiceData> = {
  're-parole-u4u': reParoleU4UData,
}

export function getServiceData(slug: string): ServiceData | undefined {
  return SERVICE_DATA[slug]
}
