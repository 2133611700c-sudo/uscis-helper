/**
 * birthCertificate.mapping.ts — Canonical Field Mapping for the birth certificate.
 *
 * Closes the gap the PDF-readback spike exposed: the RECOGNIZER emits combined
 * fields (e.g. `child_full_name`), but the official schema / bureau template needs
 * canonical split fields (`child_surname`/`child_given_name`/`child_patronymic`).
 * This layer maps recognized → canonical, NEVER inventing — a split always carries
 * review_required (the split itself is uncertain, especially on handwriting).
 */

export interface MappedField {
  value: string
  reviewRequired: boolean
  reason?: string
}

/** Ukrainian/Russian full name order is Surname Given Patronymic. */
export function splitFullName(full: string): { surname: string; given: string; patronymic: string } {
  const p = (full ?? '').trim().split(/\s+/).filter(Boolean)
  return { surname: p[0] ?? '', given: p[1] ?? '', patronymic: p.slice(2).join(' ') }
}

const PASSTHROUGH = [
  'date_of_birth', 'place_of_birth', 'oblast_of_birth', 'father_full_name', 'mother_full_name',
  'act_record_number', 'place_of_registration', 'certificate_issuing_authority',
  'series_number', 'date_of_issue', 'unzr', 'rnokpp', 'head_of_authority',
] as const

/**
 * Map a recognizer's raw field values → the birth-certificate schema's canonical
 * keys. `recognized` keys come from engine/docTypes (ua_birth_certificate).
 */
export function mapBirthCertificate(recognized: Record<string, string>): Record<string, MappedField> {
  const out: Record<string, MappedField> = {}
  const put = (k: string, value: string | undefined, review: boolean, reason?: string) => {
    if (value && value.trim()) out[k] = { value: value.trim(), reviewRequired: review, reason }
  }

  // child name: a combined "child_full_name" is SPLIT (always review); else use the parts as-is.
  if (recognized.child_full_name) {
    const { surname, given, patronymic } = splitFullName(recognized.child_full_name)
    put('child_surname', surname, true, 'split_from_full_name')
    put('child_given_name', given, true, 'split_from_full_name')
    put('child_patronymic', patronymic, true, 'split_from_full_name')
  } else {
    put('child_surname', recognized.child_surname, false)
    put('child_given_name', recognized.child_given_name, false)
    put('child_patronymic', recognized.child_patronymic, false)
  }

  for (const k of PASSTHROUGH) put(k, recognized[k], false)
  return out
}
