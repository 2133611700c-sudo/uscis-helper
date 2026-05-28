/**
 * docintel/documentRegistry — the canonical declaration of every supported
 * Ukrainian document type, its fields, and which product flows consume it.
 *
 * THIS is the permanent config the audit (DOCUMENT_RULE_COVERAGE_AUDIT.md §4.B)
 * said was missing: one place that declares what each document is and which
 * fields it carries. TPS / ReParole / EAD / Translation all read from here —
 * no parallel per-product document maps.
 *
 * Adding a document type or field = editing THIS file. The vision prompt, the
 * transliteration, and the downstream adapters are all driven by it.
 */

import type { DocTypeSpec } from './types'

export const DOCUMENT_TYPES: Record<string, DocTypeSpec> = {
  // ── Ukrainian internal passport booklet (handwritten identity page) ──
  ua_internal_passport_booklet: {
    id: 'ua_internal_passport_booklet',
    title_en: 'Ukrainian Internal Passport (Booklet)',
    script: 'cyrillic',
    consumers: ['tps', 'translation', 'reparole', 'ead'],
    vision_anchor: 'family_name',
    fields: [
      { field: 'family_name', label_uk: 'Прізвище', kind: 'name', handwritten: true, required: true },
      { field: 'given_name', label_uk: "Ім'я", kind: 'name', handwritten: true, required: true },
      { field: 'middle_name', label_uk: 'По батькові', kind: 'name', handwritten: true, required: false },
      { field: 'dob', label_uk: 'Дата народження', kind: 'date', handwritten: true, required: true },
      { field: 'city_of_birth', label_uk: 'Місце народження', kind: 'place_city', handwritten: true, required: false },
      { field: 'province_of_birth', label_uk: 'Місце народження (область)', kind: 'place_oblast', handwritten: true, required: false },
    ],
  },

  // ── Ukrainian international passport (printed + MRZ) ──
  ua_international_passport: {
    id: 'ua_international_passport',
    title_en: 'Ukrainian International Passport',
    script: 'mixed',
    consumers: ['tps', 'translation', 'reparole', 'ead'],
    vision_anchor: 'passport_number',
    fields: [
      { field: 'family_name', label_uk: 'Прізвище / Surname', kind: 'name', handwritten: false, required: true },
      { field: 'given_name', label_uk: "Ім'я / Given name", kind: 'name', handwritten: false, required: true },
      { field: 'passport_number', label_uk: 'Номер документа', kind: 'doc_number', handwritten: false, required: true },
      { field: 'dob', label_uk: 'Дата народження', kind: 'date', handwritten: false, required: true },
      { field: 'passport_expiration_date', label_uk: 'Дійсний до', kind: 'date', handwritten: false, required: false },
    ],
  },

  // ── Ukrainian birth certificate (mostly printed; Soviet-era variants exist) ──
  ua_birth_certificate: {
    id: 'ua_birth_certificate',
    title_en: 'Ukrainian Birth Certificate',
    script: 'cyrillic',
    consumers: ['translation', 'reparole', 'tps'],
    vision_anchor: 'child_family_name',
    fields: [
      { field: 'child_family_name', label_uk: 'Прізвище', kind: 'name', handwritten: false, required: true },
      { field: 'child_given_name', label_uk: "Ім'я", kind: 'name', handwritten: false, required: true },
      { field: 'child_patronymic', label_uk: 'По батькові', kind: 'name', handwritten: false, required: false },
      { field: 'dob', label_uk: 'Дата народження', kind: 'date', handwritten: false, required: true },
      { field: 'place_of_birth_city', label_uk: 'Місце народження', kind: 'place_city', handwritten: false, required: false },
      { field: 'father_full_name', label_uk: 'Батько', kind: 'name', handwritten: false, required: false },
      { field: 'mother_full_name', label_uk: 'Мати', kind: 'name', handwritten: false, required: false },
      { field: 'act_record_number', label_uk: 'Актовий запис №', kind: 'doc_number', handwritten: false, required: false },
      { field: 'issuing_authority', label_uk: 'Орган реєстрації', kind: 'agency', handwritten: false, required: false },
      { field: 'date_of_issue', label_uk: 'Дата видачі', kind: 'date', handwritten: false, required: false },
    ],
  },

  // ── Ukrainian marriage certificate ──
  ua_marriage_certificate: {
    id: 'ua_marriage_certificate',
    title_en: 'Ukrainian Marriage Certificate',
    script: 'cyrillic',
    consumers: ['translation', 'reparole'],
    vision_anchor: 'spouse_1_full_name',
    fields: [
      { field: 'spouse_1_full_name', label_uk: 'Він', kind: 'name', handwritten: false, required: true },
      { field: 'spouse_2_full_name', label_uk: 'Вона', kind: 'name', handwritten: false, required: true },
      { field: 'date_of_marriage', label_uk: 'Дата шлюбу', kind: 'date', handwritten: false, required: true },
      { field: 'act_record_number', label_uk: 'Актовий запис №', kind: 'doc_number', handwritten: false, required: false },
      { field: 'issuing_authority', label_uk: 'Орган реєстрації', kind: 'agency', handwritten: false, required: false },
      { field: 'date_of_issue', label_uk: 'Дата видачі', kind: 'date', handwritten: false, required: false },
    ],
  },

  // ── Ukrainian divorce certificate ──
  ua_divorce_certificate: {
    id: 'ua_divorce_certificate',
    title_en: 'Ukrainian Divorce Certificate',
    script: 'cyrillic',
    consumers: ['translation'],
    vision_anchor: 'spouse_1_full_name',
    fields: [
      { field: 'spouse_1_full_name', label_uk: 'Він', kind: 'name', handwritten: false, required: true },
      { field: 'spouse_2_full_name', label_uk: 'Вона', kind: 'name', handwritten: false, required: true },
      { field: 'date_of_divorce', label_uk: 'Дата розірвання', kind: 'date', handwritten: false, required: true },
      { field: 'act_record_number', label_uk: 'Актовий запис №', kind: 'doc_number', handwritten: false, required: false },
      { field: 'issuing_authority', label_uk: 'Орган реєстрації', kind: 'agency', handwritten: false, required: false },
    ],
  },

  // ── Ukrainian ID card (credit-card format, printed) ──
  ua_id_card: {
    id: 'ua_id_card',
    title_en: 'Ukrainian ID Card',
    script: 'mixed',
    consumers: ['tps', 'translation'],
    vision_anchor: 'family_name',
    fields: [
      { field: 'family_name', label_uk: 'Прізвище', kind: 'name', handwritten: false, required: true },
      { field: 'given_name', label_uk: "Ім'я", kind: 'name', handwritten: false, required: true },
      { field: 'middle_name', label_uk: 'По батькові', kind: 'name', handwritten: false, required: false },
      { field: 'dob', label_uk: 'Дата народження', kind: 'date', handwritten: false, required: true },
      { field: 'doc_number', label_uk: 'Номер', kind: 'doc_number', handwritten: false, required: false },
    ],
  },
}

export function getDocTypeSpec(id: string): DocTypeSpec | null {
  return DOCUMENT_TYPES[id] ?? null
}

/** All document type ids a given product consumes. */
export function docTypesForConsumer(consumer: string): string[] {
  return Object.values(DOCUMENT_TYPES)
    .filter((d) => d.consumers.includes(consumer as any))
    .map((d) => d.id)
}
