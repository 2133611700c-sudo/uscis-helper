/**
 * Birth Certificate (Свідоцтво про народження).
 * OFFICIAL SOURCE: КМУ №1025 (10.11.2010), verified against the /print text on
 * zakon.rada.gov.ua 2026-05-29 (see docs/official-forms/ukraine/EXTRACTED_OFFICIAL_2026-05-29.json).
 * Field order + the post-2019 УНЗР/РНОКПП additions (ред. КМУ №691 від 10.07.2019)
 * transcribed verbatim from the official ОПИС бланка. Blank: аркуш 180×250 мм,
 * блакитний папір; series "Х-ХХ № ХХХХХХ" (letter pair per oblast, e.g. АМ=Вінницька).
 */
import type { OfficialFormSchema, FormFieldSpec } from './types'

const S = 'ua_kmu_1025_2010.birth' // source_rule prefix

const N = (key: string, uk: string, en: string, group: string, required = true, extra: Partial<FormFieldSpec> = {}): FormFieldSpec => ({
  key, sourceLabelUk: uk, sourceLabelEn: en, required, fieldGroup: group,
  expectedScript: 'cyrillic', translationRule: 'transliterate_kmu55', lockedEntity: true, evidenceRequired: true,
  canGuess: false, sourceRule: `${S}.${key}`, ...extra,
})

export const birthCertificateSchema: OfficialFormSchema = {
  docType: 'ua_birth_certificate', titleEn: 'BIRTH CERTIFICATE',
  officialSource: { act: 'КМУ Resolution No. 1025, 10.11.2010', url: 'https://zakon.rada.gov.ua/laws/show/1025-2010-%D0%BF', authority: 'Cabinet of Ministers of Ukraine / Ministry of Justice', effectiveDate: '2010-11-10' },
  sourceId: 'ua_kmu_1025_2010',
  variants: [
    { id: 'modern_ua_2010_plus', description: 'Modern certificate under KMU No.1025 (Ukrainian text only)', languageProfile: 'uk_only', active: true },
    { id: 'post_2019_unzr_rnokpp', description: 'Modern form bearing УНЗР / РНОКПП (ред. КМУ №691 від 10.07.2019)', languageProfile: 'uk_only', active: true },
    { id: 'legacy_soviet_bilingual', description: 'Legacy Soviet/UkrSSR certificate, UA/RU bilingual duplicated text', languageProfile: 'uk_ru_bilingual', active: true, reviewRequired: true },
  ],
  fields: [
    N('child_surname', 'Прізвище', 'Surname', 'child', true, { sourceRule: `${S}.child_identity`, reviewRequiredIf: ['handwritten', 'split_from_full_name', 'bilingual_conflict'] }),
    N('child_given_name', "Ім'я", 'Given name', 'child', true, { sourceRule: `${S}.child_identity`, reviewRequiredIf: ['handwritten', 'split_from_full_name', 'bilingual_conflict'] }),
    N('child_patronymic', 'По батькові', 'Patronymic', 'child', false, { sourceRule: `${S}.child_identity`, reviewRequiredIf: ['handwritten', 'split_from_full_name'] }),
    { key: 'date_of_birth', sourceLabelUk: 'народився(лася)', sourceLabelEn: 'Date of birth', required: true, fieldGroup: 'child', expectedScript: 'mixed', translationRule: 'date_normalize', lockedEntity: true, evidenceRequired: true, canGuess: false, sourceRule: `${S}.date_of_birth` },
    { key: 'place_of_birth', sourceLabelUk: 'Місце народження', sourceLabelEn: 'Place of birth', required: true, fieldGroup: 'child', expectedScript: 'cyrillic', translationRule: 'place_gazetteer', lockedEntity: false, evidenceRequired: true, canGuess: false, sourceRule: `${S}.place_of_birth`, reviewRequiredIf: ['fuzzy_geography'] },
    { key: 'oblast_of_birth', sourceLabelUk: 'область', sourceLabelEn: 'Region (Oblast)', required: false, fieldGroup: 'child', expectedScript: 'cyrillic', translationRule: 'place_gazetteer', lockedEntity: false, evidenceRequired: true, canGuess: false, sourceRule: `${S}.place_of_birth` },
    N('father_full_name', 'Батько', 'Father', 'parents', false, { sourceRule: `${S}.parents`, reviewRequiredIf: ['handwritten'] }),
    N('mother_full_name', 'Мати', 'Mother', 'parents', false, { sourceRule: `${S}.parents`, reviewRequiredIf: ['handwritten'] }),
    { key: 'act_record_number', sourceLabelUk: 'складено актовий запис №', sourceLabelEn: 'Act record No.', required: true, fieldGroup: 'actRecord', expectedScript: 'numeric', translationRule: 'locked_verbatim', lockedEntity: true, evidenceRequired: true, canGuess: false, sourceRule: `${S}.act_record_number` },
    // КМУ-1025 distinguishes TWO issuing fields — place of registration AND the body that issued the certificate.
    { key: 'place_of_registration', sourceLabelUk: 'Місце державної реєстрації', sourceLabelEn: 'Place of state registration', required: true, fieldGroup: 'issuing', expectedScript: 'cyrillic', translationRule: 'glossary_authority', lockedEntity: false, evidenceRequired: true, canGuess: false, sourceRule: `${S}.registration_authority`, reviewRequiredIf: ['agency_not_in_glossary', 'legacy_organization'] },
    { key: 'certificate_issuing_authority', sourceLabelUk: 'Орган державної реєстрації актів цивільного стану, що видав свідоцтво', sourceLabelEn: 'Authority that issued the certificate', required: false, fieldGroup: 'issuing', expectedScript: 'cyrillic', translationRule: 'glossary_authority', lockedEntity: false, evidenceRequired: true, canGuess: false, sourceRule: `${S}.certificate_issuing_authority`, reviewRequiredIf: ['agency_not_in_glossary'] },
    { key: 'series_number', sourceLabelUk: 'Серія Х-ХХ № ХХХХХХ', sourceLabelEn: 'Series and No.', required: true, fieldGroup: 'issuing', expectedScript: 'mixed', translationRule: 'locked_verbatim', lockedEntity: true, evidenceRequired: true, canGuess: false, sourceRule: `${S}.series_number` },
    { key: 'date_of_issue', sourceLabelUk: 'Дата видачі', sourceLabelEn: 'Date of issue', required: false, fieldGroup: 'issuing', expectedScript: 'mixed', translationRule: 'date_normalize', lockedEntity: true, evidenceRequired: true, canGuess: false, sourceRule: `${S}.date_of_issue` },
    // Post-2019 additions (ред. КМУ №691 від 10.07.2019) — era-dependent, NOT on legacy/Soviet blanks.
    { key: 'unzr', sourceLabelUk: 'УНЗР', sourceLabelEn: 'Unique Demographic Registry Number (UNZR)', required: false, fieldGroup: 'issuing', expectedScript: 'numeric', translationRule: 'locked_verbatim', lockedEntity: true, evidenceRequired: true, canGuess: false, sourceRule: `${S}.unzr`, eraDependent: true, reviewRequiredIf: ['present_but_low_confidence'] },
    { key: 'rnokpp', sourceLabelUk: 'РНОКПП', sourceLabelEn: 'Taxpayer Registration No. (RNOKPP)', required: false, fieldGroup: 'issuing', expectedScript: 'numeric', translationRule: 'locked_verbatim', lockedEntity: true, evidenceRequired: true, canGuess: false, sourceRule: `${S}.rnokpp`, eraDependent: true },
    { key: 'head_of_authority', sourceLabelUk: 'Керівник органу державної реєстрації актів цивільного стану', sourceLabelEn: 'Head of the registration authority', required: false, fieldGroup: 'signatures', expectedScript: 'cyrillic', translationRule: 'transliterate_kmu55', lockedEntity: true, evidenceRequired: true, canGuess: false, sourceRule: `${S}.head_of_authority`, reviewRequiredIf: ['signature_only', 'illegible'] },
  ],
  layoutSections: ['header', 'personFields', 'actRecord', 'issuingAuthority', 'seals', 'signatures', 'certification'],
}
