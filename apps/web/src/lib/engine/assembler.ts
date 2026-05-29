/**
 * engine/assembler.ts — D6: assemble the final bureau-style ENGLISH document
 * from the canonical EngineResult.
 *
 * Honesty rules baked in (v5 §31 / §6):
 *   - Fields the system could not read or that need confirmation are shown as
 *     a blank line `____` (for the human to fill) — never a guessed value.
 *   - Visual/ornamental elements are NOT translated; rendered as [placeholders].
 *   - NO "certified" / "USCIS-accepted" claim. The output is an AI-assisted
 *     DRAFT until a competent human signs the certification block.
 */

import type { EngineResult } from './orchestrator'

const LABELS: Record<string, string> = {
  child_full_name: 'Full name of child', date_of_birth: 'Date of birth',
  place_of_birth: 'Place of birth', oblast_of_birth: 'Region (Oblast)',
  father_full_name: 'Father', mother_full_name: 'Mother',
  place_of_registration: 'Place of registration', date_of_issue: 'Date of issue',
  act_record_number: 'Act record No.', series_number: 'Series / No.',
  husband_full_name: 'Husband', wife_full_name: 'Wife',
  date_of_marriage: 'Date of marriage', date_of_dissolution: 'Date of dissolution',
  husband_surname_after: 'Husband’s surname after', wife_surname_after: 'Wife’s surname after',
  family_name: 'Surname', given_name: 'Given name', patronymic: 'Patronymic', sex: 'Sex',
}

const TITLES: Record<string, string> = {
  ua_internal_passport_booklet: 'INTERNAL PASSPORT OF UKRAINE',
  ua_birth_certificate: 'BIRTH CERTIFICATE',
  ua_marriage_certificate: 'MARRIAGE CERTIFICATE',
  ua_divorce_certificate: 'CERTIFICATE OF DISSOLUTION OF MARRIAGE',
  ua_military_id: 'MILITARY SERVICE RECORD',
}

export interface AssembledDoc {
  title: string
  text: string                 // plain-text bureau-style draft
  unresolved: string[]         // field keys the human must still confirm/fill
  ready_to_certify: boolean    // true only when nothing is unresolved
}

export function assembleDocument(
  result: EngineResult,
  opts: { signerName?: string; signerAddress?: string } = {},
): AssembledDoc {
  const title = TITLES[result.doc_type_id] ?? 'UKRAINIAN OFFICIAL DOCUMENT'
  const unresolved: string[] = []
  const rows: string[] = []

  for (const f of result.fields) {
    const label = LABELS[f.field] ?? f.field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    if (f.can_read && f.latin && !f.review_required) {
      rows.push(`${label}: ${f.latin}`)
    } else if (f.can_read && f.latin && f.review_required) {
      rows.push(`${label}: ${f.latin}    [CONFIRM]`)
      unresolved.push(f.field)
    } else {
      rows.push(`${label}: ____________________    [enter from document]`)
      unresolved.push(f.field)
    }
  }

  const text = [
    `ENGLISH TRANSLATION OF A ${title} (UKRAINE)`,
    `AI-assisted draft — not certified until reviewed and signed by a competent human.`,
    ``,
    ...rows,
    ``,
    `[Coat of Arms of Ukraine]`,
    `[Official round seal — emblem and text not reproduced]`,
    `[Signature of the issuing officer]`,
    ``,
    `— — — — — — — — — — — — — — — — — — — — — —`,
    `TRANSLATOR’S CERTIFICATION (pursuant to 8 CFR §103.2(b)(3))`,
    `I, ${opts.signerName ?? '________________________'}, certify that I am competent to translate from`,
    `Ukrainian into English, and that the above translation is accurate and complete to the`,
    `best of my knowledge and belief.`,
    ``,
    `Signature: ____________________     Date: ____________`,
    opts.signerAddress ? `Address: ${opts.signerAddress}` : `Address: ____________________`,
  ].join('\n')

  return { title, text, unresolved, ready_to_certify: unresolved.length === 0 }
}
