/**
 * benchmark/passportTruth.ts — the owner's flat passport ground-truth schema +
 * criticality, and an adapter into the generic GroundTruth shape the scorer uses.
 *
 * Fields the owner fills by reading a real document (latin + cyrillic split):
 *   family_name_latin/cyrillic, given_name_latin/cyrillic, patronymic_latin/cyrillic,
 *   dob, sex, passport_number, expiry_date, citizenship,
 *   place_of_birth_raw/english, province.
 */
import type { GroundTruth } from '../benchmark'

/** Per-field criticality for the passport ground truth (drives the metric). */
export const PASSPORT_TRUTH_FIELDS: Record<string, { critical: boolean }> = {
  family_name_latin: { critical: true },
  given_name_latin: { critical: true },
  family_name_cyrillic: { critical: true },
  given_name_cyrillic: { critical: true },
  patronymic_cyrillic: { critical: true },
  patronymic_latin: { critical: true },
  dob: { critical: true },
  sex: { critical: false },
  passport_number: { critical: true },
  expiry_date: { critical: false }, // high, but not in the 6 critical legal IDs
  citizenship: { critical: false },
  place_of_birth_raw: { critical: false },
  place_of_birth_english: { critical: false },
  province: { critical: false },
}

export interface FlatPassportTruth {
  document_id?: string
  document_type?: string
  [field: string]: string | undefined
}

/**
 * Convert the owner's flat passport truth into the generic GroundTruth used by
 * `scoreAgainstTruth`. Only non-empty fields are scored (empty = "not on the
 * document", excluded so it neither rewards nor penalizes a reader).
 */
export function passportTruthToGroundTruth(flat: FlatPassportTruth): GroundTruth {
  const fields: GroundTruth['fields'] = {}
  for (const [key, meta] of Object.entries(PASSPORT_TRUTH_FIELDS)) {
    const v = (flat[key] ?? '').trim()
    if (v === '') continue
    fields[key] = { value: v, critical: meta.critical }
  }
  return {
    document_id: flat.document_id ?? 'unknown',
    doc_type: flat.document_type ?? 'passport',
    fields,
  }
}
