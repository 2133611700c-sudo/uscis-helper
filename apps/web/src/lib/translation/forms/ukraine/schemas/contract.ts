/**
 * contract.ts — applies the official Field Contract uniformly to civil-status
 * schemas (КМУ №1025): every field gets canGuess=false + a sourceRule, the schema
 * gets era variants + sourceId, and the two official issuing fields the КМУ-1025
 * ОПИС requires on EVERY certificate (issuing authority + head of authority) are
 * ensured. DRY — so we don't hand-edit every field across five schemas.
 */
import type { OfficialFormSchema, FormFieldSpec, DocumentVariant } from './types'

export const CIVIL_VARIANTS: DocumentVariant[] = [
  { id: 'modern_ua_2010_plus', description: 'Modern certificate under KMU No.1025 (Ukrainian text only)', languageProfile: 'uk_only', active: true },
  { id: 'legacy_soviet_bilingual', description: 'Legacy Soviet/UkrSSR bilingual certificate (UA/RU duplicated text)', languageProfile: 'uk_ru_bilingual', active: true, reviewRequired: true },
]

const ruleBase = (docType: string) => 'ua_kmu_1025_2010.' + docType.replace('ua_', '').replace('_certificate', '')

export function applyCivilContract(s: OfficialFormSchema): OfficialFormSchema {
  const base = ruleBase(s.docType)
  const fields: FormFieldSpec[] = s.fields.map((f) => ({ ...f, canGuess: f.canGuess ?? false, sourceRule: f.sourceRule ?? `${base}.${f.key}` }))
  const has = (k: string) => fields.some((f) => f.key === k)

  if (!has('issuing_authority') && !has('certificate_issuing_authority')) {
    fields.push({ key: 'certificate_issuing_authority', sourceLabelUk: 'Орган державної реєстрації актів цивільного стану, що видав свідоцтво', sourceLabelEn: 'Authority that issued the certificate', required: false, fieldGroup: 'issuing', expectedScript: 'cyrillic', translationRule: 'glossary_authority', lockedEntity: false, evidenceRequired: true, canGuess: false, sourceRule: `${base}.certificate_issuing_authority`, reviewRequiredIf: ['agency_not_in_glossary'] })
  }
  if (!has('head_of_authority')) {
    fields.push({ key: 'head_of_authority', sourceLabelUk: 'Керівник органу державної реєстрації актів цивільного стану', sourceLabelEn: 'Head of the registration authority', required: false, fieldGroup: 'signatures', expectedScript: 'cyrillic', translationRule: 'transliterate_kmu55', lockedEntity: true, evidenceRequired: true, canGuess: false, sourceRule: `${base}.head_of_authority`, reviewRequiredIf: ['signature_only', 'illegible'] })
  }
  return { ...s, sourceId: s.sourceId ?? 'ua_kmu_1025_2010', variants: s.variants ?? CIVIL_VARIANTS, fields }
}
