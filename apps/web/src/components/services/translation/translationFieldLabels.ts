/**
 * translationFieldLabels — the Ukrainian label for every docintel field the
 * translation wizard can receive. FULL registry coverage is pinned by a test:
 * the review table previously filtered through a 6-key booklet-only map and
 * SILENTLY DROPPED everything else (passport number/expiry — the owner's
 * "нет дат" report; 9 of 10 birth-cert fields; military doc_number). A field
 * with no label must FALL BACK to its key in the UI — never vanish.
 */
export const UKR_LABEL_BY_FIELD: Record<string, string> = {
  // booklet / shared identity
  family_name: 'Прізвище',
  given_name: "Ім'я",
  middle_name: 'По батькові',
  patronymic: 'По батькові',
  dob: 'Дата народження',
  date_of_birth: 'Дата народження',
  city_of_birth: 'Місце народження',
  province_of_birth: 'Область',
  // international passport
  passport_number: 'Номер паспорта',
  passport_expiration_date: 'Дата закінчення строку дії',
  // birth certificate (full spec)
  child_family_name: 'Прізвище дитини',
  child_given_name: "Ім'я дитини",
  child_patronymic: 'По батькові дитини',
  place_of_birth_city: 'Місце народження',
  father_full_name: 'Батько',
  mother_full_name: 'Мати',
  act_record_number: 'Актовий запис №',
  issuing_authority: 'Орган реєстрації',
  date_of_issue: 'Дата видачі',
  // marriage / divorce
  spouse_1_full_name: 'Він (прізвище, імʼя)',
  spouse_2_full_name: 'Вона (прізвище, імʼя)',
  date_of_marriage: 'Дата реєстрації шлюбу',
  date_of_divorce: 'Дата розірвання шлюбу',
  // id card / military
  doc_number: 'Номер документа',
}

/** Label for a field — NEVER drops: unknown keys fall back to the raw key. */
export function ukrLabelFor(field: string): string {
  return UKR_LABEL_BY_FIELD[field] ?? field
}
