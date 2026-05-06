'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Download, ChevronRight } from 'lucide-react'
import { generateTranslationDoc, hasCyrillic, transliterateCyrillic } from '@/lib/translation/generateTranslationHTML'
import {
  DOCS,
  DocDef,
  FieldDef,
  SourceLang,
  DocEra,
  EraVariant,
} from '@/lib/translation/docDefinitions'
import { useTranslationHistory } from '@/lib/translation/useTranslationHistory'

// ─── Local types ──────────────────────────────────────────────────────────────

type Group = 'personal' | 'document' | 'authority'

/** Infer display group from field key when explicit group is absent. */
function inferGroup(key: string): Group {
  if (/issuing_authority|court_name|institution|employer_name|bank_name/.test(key)) return 'authority'
  if (
    /document_number|issue_date|expiry_date|date_of_marriage|date_of_divorce|date_of_death|decision_date|effective_date|registration_date|graduation_date|graduation_year|vaccination_date|treatment_dates|employment_start|employment_end|statement_period|document_type|record_type|case_number|parties|order_summary|powers_granted|property_address|property_description|account|opening_balance|closing_balance|categories|lot_number|rank|service_branch|degree_title|field_of_study|position|address|nationality_field|registry_book_number/.test(key)
  ) return 'document'
  return 'personal'
}

// ─── Source languages ─────────────────────────────────────────────────────────

const LANGS_TOP3: { id: SourceLang; label: string; flag: string }[] = [
  { id: 'uk', label: 'Українська', flag: '🇺🇦' },
  { id: 'ru', label: 'Русский', flag: '🇷🇺' },
  { id: 'es', label: 'Español', flag: '🇪🇸' },
]
const LANGS_MORE: { id: SourceLang; label: string; flag: string }[] = [
  { id: 'en', label: 'English', flag: '🇺🇸' },
  { id: 'pl', label: 'Polski', flag: '🇵🇱' },
  { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { id: 'fr', label: 'Français', flag: '🇫🇷' },
  { id: 'ar', label: 'العربية', flag: '🇸🇦' },
  { id: 'zh', label: '中文', flag: '🇨🇳' },
  { id: 'ko', label: '한국어', flag: '🇰🇷' },
  { id: 'pt', label: 'Português', flag: '🇧🇷' },
]

// Target language options (for the "Translate TO" selector)
const LANGS_TARGET_TOP: { id: SourceLang; label: string; flag: string }[] = [
  { id: 'en', label: 'English', flag: '🇺🇸' },
  { id: 'uk', label: 'Українська', flag: '🇺🇦' },
  { id: 'ru', label: 'Русский', flag: '🇷🇺' },
]
const LANGS_TARGET_MORE: { id: SourceLang; label: string; flag: string }[] = [
  { id: 'es', label: 'Español', flag: '🇪🇸' },
  { id: 'pl', label: 'Polski', flag: '🇵🇱' },
  { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { id: 'fr', label: 'Français', flag: '🇫🇷' },
  { id: 'ko', label: '한국어', flag: '🇰🇷' },
  { id: 'zh', label: '中文', flag: '🇨🇳' },
  { id: 'pt', label: 'Português', flag: '🇧🇷' },
]

// Certification statement template in the target language.
// Used in file2 (self-certification) and file1 (translation draft header).
function getCertStatement(
  srcLabel: string,
  targetLabel: string,
  docLabel: string,
  lang: SourceLang,
): string {
  const s: Partial<Record<SourceLang, string>> = {
    en: `I, the undersigned, hereby certify that I am competent to translate from <strong>${srcLabel}</strong> into <strong>${targetLabel}</strong>, and that the attached translation of the <strong>${docLabel}</strong> is accurate and complete to the best of my knowledge and ability.`,
    uk: `Я, нижчепідписаний(-а), засвідчую, що маю достатні знання для перекладу з <strong>${srcLabel}</strong> на <strong>${targetLabel}</strong>, і що наданий переклад документа «<strong>${docLabel}</strong>» є повним та точним відповідно до моїх знань та можливостей.`,
    ru: `Я, нижеподписавшийся(-аяся), настоящим удостоверяю, что обладаю достаточными знаниями для перевода с <strong>${srcLabel}</strong> на <strong>${targetLabel}</strong>, и что данный перевод документа «<strong>${docLabel}</strong>» является полным и точным в меру моих знаний и способностей.`,
    es: `Yo, el/la abajo firmante, certifico que soy competente para traducir del <strong>${srcLabel}</strong> al <strong>${targetLabel}</strong>, y que la presente traducción del documento <strong>${docLabel}</strong> es completa y exacta.`,
    de: `Ich, der/die Unterzeichnete, bezeuge, dass ich befähigt bin, von <strong>${srcLabel}</strong> ins <strong>${targetLabel}</strong> zu übersetzen, und dass die vorliegende Übersetzung des Dokuments <strong>${docLabel}</strong> vollständig und korrekt ist.`,
    fr: `Je, soussigné(e), certifie être compétent(e) pour traduire du <strong>${srcLabel}</strong> vers le <strong>${targetLabel}</strong>, et que la traduction ci-jointe du document <strong>${docLabel}</strong> est complète et exacte.`,
    ko: `본인은 <strong>${srcLabel}</strong>에서 <strong>${targetLabel}</strong>으로 번역할 능력이 있으며, <strong>${docLabel}</strong> 문서의 번역이 본인의 능력 범위 내에서 정확하고 완전함을 증명합니다.`,
    zh: `本人特此证明具有将<strong>${srcLabel}</strong>翻译成<strong>${targetLabel}</strong>的能力，所附<strong>${docLabel}</strong>文件的翻译在本人知识范围内准确完整。`,
    pl: `Ja, niżej podpisany(-a), niniejszym poświadczam, że jestem kompetentny(-a) do tłumaczenia z języka <strong>${srcLabel}</strong> na język <strong>${targetLabel}</strong>, oraz że dołączone tłumaczenie dokumentu <strong>${docLabel}</strong> jest pełne i dokładne.`,
  }
  return s[lang] ?? s.en!
}

// DOCS imported from @/lib/translation/docDefinitions — see that file for all 20 document types.

// (inline DOCS removed — imported from @/lib/translation/docDefinitions)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _DOCS_REMOVED = [
  {
    id: '__placeholder__', popular: false, prodId: '__placeholder__',
    label: { uk: 'Паспорт', ru: 'Паспорт', en: 'Passport', es: 'Pasaporte', pl: 'Paszport', de: 'Reisepass', fr: 'Passeport', ar: 'جواز سفر', zh: '护照', ko: '여권', pt: 'Passaporte' },
    color: 'linear-gradient(150deg,#1e40af 0%,#3b82f6 100%)',
    icon: '<svg viewBox="0 0 30 38" width="30" height="38" fill="none"><rect x="1" y="1" width="28" height="36" rx="2" fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.9)" stroke-width="1.5"/><line x1="6" y1="1" x2="6" y2="37" stroke="rgba(255,255,255,.3)" stroke-width="1"/><circle cx="17" cy="13" r="4.5" stroke="rgba(255,255,255,.95)" stroke-width="1.4" fill="rgba(255,255,255,.18)"/><path d="M9 22c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="rgba(255,255,255,.9)" stroke-width="1.4" stroke-linecap="round" fill="none"/><rect x="8" y="25" width="14" height="1.5" rx=".75" fill="rgba(255,255,255,.65)"/><rect x="2" y="28.5" width="26" height="1.5" rx=".75" fill="rgba(255,255,255,.55)"/><rect x="2" y="31.5" width="26" height="1.5" rx=".75" fill="rgba(255,255,255,.55)"/><rect x="2" y="34.5" width="20" height="1.5" rx=".75" fill="rgba(255,255,255,.4)"/></svg>',
    fields: [
      { key: 'full_name', en: 'Last Name', orig: { uk: 'Прізвище', ru: 'Фамилия', es: 'Apellido', pl: 'Nazwisko', de: 'Nachname', fr: 'Nom de famille', ar: 'اللقب', zh: '姓', ko: '성', pt: 'Sobrenome', en: 'Last Name' }, required: true, group: 'personal', placeholder: { uk: 'ШЕВЧЕНКО', ru: 'ШЕВЧЕНКО', en: 'SHEVCHENKO' } },
      { key: 'given_names', en: 'Given Names', orig: { uk: "Ім'я та по батькові", ru: 'Имя и отчество', es: 'Nombres', pl: 'Imię i imię ojca', de: 'Vornamen', fr: 'Prénoms', ar: 'الاسم الأول', zh: '名', ko: '이름', pt: 'Nomes', en: 'Given Names' }, required: true, group: 'personal', placeholder: { uk: 'ТАРАС ГРИГОРОВИЧ', ru: 'ТАРАС ГРИГОРОВИЧ', en: 'TARAS' } },
      { key: 'sex', en: 'Sex', orig: { uk: 'Стать', ru: 'Пол', es: 'Sexo', pl: 'Płeć', de: 'Geschlecht', fr: 'Sexe', ar: 'الجنس', zh: '性别', ko: '성별', pt: 'Sexo', en: 'Sex' }, required: true, group: 'personal', type: 'radio', options: [{ val: 'M', label: { uk: 'Чоловіча / M', ru: 'Мужской / M', es: 'Masculino / M', en: 'Male / M' } }, { val: 'F', label: { uk: 'Жіноча / F', ru: 'Женский / F', es: 'Femenino / F', en: 'Female / F' } }] },
      { key: 'date_of_birth', en: 'Date of Birth', orig: { uk: 'Дата народження', ru: 'Дата рождения', es: 'Fecha de nacimiento', pl: 'Data urodzenia', de: 'Geburtsdatum', fr: 'Date de naissance', ar: 'تاريخ الميلاد', zh: '出生日期', ko: '생년월일', pt: 'Data de nascimento', en: 'Date of Birth' }, required: true, group: 'personal', type: 'date' },
      { key: 'place_of_birth', en: 'Place of Birth', orig: { uk: 'Місце народження', ru: 'Место рождения', es: 'Lugar de nacimiento', pl: 'Miejsce urodzenia', de: 'Geburtsort', fr: 'Lieu de naissance', ar: 'مكان الولادة', zh: '出生地', ko: '출생지', pt: 'Local de nascimento', en: 'Place of Birth' }, required: true, group: 'personal', placeholder: { uk: 'м. Київ, Україна', ru: 'г. Киев, Украина', en: 'Kyiv, Ukraine' } },
      { key: 'nationality', en: 'Nationality', orig: { uk: 'Громадянство', ru: 'Гражданство', es: 'Nacionalidad', pl: 'Obywatelstwo', de: 'Staatsangehörigkeit', fr: 'Nationalité', ar: 'الجنسية', zh: '国籍', ko: '국적', pt: 'Nacionalidade', en: 'Nationality' }, required: true, group: 'personal', placeholder: { uk: 'Українець/ка', ru: 'Украинец', en: 'Ukrainian' } },
      { key: 'document_number', en: 'Passport Number', orig: { uk: 'Номер паспорта', ru: 'Номер паспорта', es: 'Número de pasaporte', pl: 'Numer paszportu', de: 'Passnummer', fr: 'Numéro de passeport', ar: 'رقم جواز السفر', zh: '护照号码', ko: '여권 번호', pt: 'Número do passaporte', en: 'Passport Number' }, required: true, group: 'document', placeholder: { uk: 'FN123456', ru: 'FN123456', en: 'FN123456' }, helpExample: { uk: 'Верхній правий кут головної сторінки', ru: 'Верхний правый угол главной страницы', en: 'Top right corner of the bio page' } },
      { key: 'issue_date', en: 'Date of Issue', orig: { uk: 'Дата видачі', ru: 'Дата выдачи', es: 'Fecha de emisión', pl: 'Data wydania', de: 'Ausstellungsdatum', fr: 'Date de délivrance', ar: 'تاريخ الإصدار', zh: '签发日期', ko: '발급일', pt: 'Data de emissão', en: 'Date of Issue' }, required: true, group: 'document', type: 'date' },
      { key: 'expiry_date', en: 'Date of Expiry', orig: { uk: 'Дата закінчення дії', ru: 'Срок действия', es: 'Fecha de vencimiento', pl: 'Data ważności', de: 'Ablaufdatum', fr: "Date d'expiration", ar: 'تاريخ الانتهاء', zh: '到期日期', ko: '만료일', pt: 'Data de validade', en: 'Date of Expiry' }, required: true, group: 'document', type: 'date' },
      { key: 'issuing_authority', en: 'Issuing Authority', orig: { uk: 'Орган видачі', ru: 'Орган выдачи', es: 'Autoridad emisora', pl: 'Organ wydający', de: 'Ausstellende Behörde', fr: 'Autorité de délivrance', ar: 'جهة الإصدار', zh: '签发机关', ko: '발급기관', pt: 'Autoridade emissora', en: 'Issuing Authority' }, required: true, group: 'authority', placeholder: { uk: 'ДМСУ 1234', ru: 'ГМСУ 1234', en: 'State Migration Service' } },
    ],
  },
  {
    id: 'birth_cert', popular: true, prodId: 'birth-certificate',
    label: { uk: 'Свідоцтво про народження', ru: 'Свидетельство о рождении', en: 'Birth Certificate', es: 'Acta de nacimiento', pl: 'Akt urodzenia', de: 'Geburtsurkunde', fr: 'Acte de naissance', ar: 'شهادة الميلاد', zh: '出生证明', ko: '출생증명서', pt: 'Certidão de nascimento' },
    color: 'linear-gradient(150deg,#92400e 0%,#f59e0b 100%)',
    icon: '<svg viewBox="0 0 28 34" width="28" height="34" fill="none"><rect x="1" y="1" width="26" height="32" rx="1.5" fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.85)" stroke-width="1.5"/><rect x="3.5" y="3.5" width="21" height="27" rx=".8" stroke="rgba(255,255,255,.38)" stroke-width=".8" stroke-dasharray="2.5 2"/><path d="M14 5l1.9 5.8h6.1l-4.9 3.6 1.9 5.8L14 17l-4.9 3.2 1.9-5.8-4.9-3.6H12z" fill="rgba(255,255,255,.95)"/><rect x="5" y="22" width="18" height="1.6" rx=".8" fill="rgba(255,255,255,.65)"/><rect x="6" y="25" width="16" height="1.3" rx=".65" fill="rgba(255,255,255,.48)"/><rect x="7" y="28" width="14" height="1.3" rx=".65" fill="rgba(255,255,255,.35)"/><circle cx="14" cy="31.5" r="1.5" stroke="rgba(255,255,255,.55)" stroke-width="1" fill="none"/></svg>',
    fields: [
      { key: 'full_name', en: "Child's Last Name", orig: { uk: 'Прізвище дитини', ru: 'Фамилия ребёнка', es: 'Apellido del niño', en: "Child's Last Name" }, required: true, group: 'personal', placeholder: { uk: 'ШЕВЧЕНКО', ru: 'ШЕВЧЕНКО', en: 'SHEVCHENKO' } },
      { key: 'given_names', en: "Child's First Name", orig: { uk: "Ім'я дитини", ru: 'Имя ребёнка', es: 'Nombre del niño', en: "Child's First Name" }, required: true, group: 'personal', placeholder: { uk: 'ТАРАС', ru: 'ТАРАС', en: 'TARAS' } },
      { key: 'date_of_birth', en: "Child's Date of Birth", orig: { uk: 'Дата народження дитини', ru: 'Дата рождения ребёнка', es: 'Fecha de nacimiento', en: 'Date of Birth' }, required: true, group: 'personal', type: 'date' },
      { key: 'place_of_birth', en: 'Place of Birth', orig: { uk: 'Місце народження', ru: 'Место рождения', es: 'Lugar de nacimiento', en: 'Place of Birth' }, required: true, group: 'personal', placeholder: { uk: 'м. Київ', ru: 'г. Киев', en: 'Kyiv' } },
      { key: 'father_name', en: "Father's Name", orig: { uk: "Ім'я батька", ru: 'Имя отца', es: 'Nombre del padre', en: "Father's Name" }, required: false, group: 'personal', placeholder: { uk: 'ГРИГОРІЙ ІВАНОВИЧ ШЕВЧЕНКО', ru: 'ГРИГОРИЙ ИВАНОВИЧ', en: 'HRYHORIY IVANOVYCH SHEVCHENKO' } },
      { key: 'mother_name', en: "Mother's Name", orig: { uk: "Ім'я матері", ru: 'Имя матери', es: 'Nombre de la madre', en: "Mother's Name" }, required: false, group: 'personal', placeholder: { uk: 'ГАННА ПЕТРІВНА ШЕВЧЕНКО', ru: 'АННА ПЕТРОВНА', en: 'HANNA PETRIVNA SHEVCHENKO' } },
      { key: 'document_number', en: 'Certificate Number', orig: { uk: 'Номер свідоцтва', ru: 'Номер свидетельства', es: 'Número de certificado', en: 'Certificate Number' }, required: true, group: 'document', placeholder: { uk: 'І-КВ №123456', ru: 'І-КВ №123456', en: 'I-KV No.123456' } },
      { key: 'issue_date', en: 'Date of Issue', orig: { uk: 'Дата видачі', ru: 'Дата выдачи', es: 'Fecha de emisión', en: 'Date of Issue' }, required: true, group: 'document', type: 'date' },
      { key: 'issuing_authority', en: 'Registry Office', orig: { uk: 'Орган РАЦС', ru: 'Орган ЗАГС', es: 'Registro Civil', en: 'Registry Office' }, required: true, group: 'authority', placeholder: { uk: 'Шевченківський РАЦС м. Київ', ru: 'Шевченковский ЗАГС г. Киев', en: 'Civil Registry, Kyiv' } },
    ],
  },
  {
    id: 'marriage_cert', popular: true, prodId: 'marriage-certificate',
    label: { uk: 'Свідоцтво про шлюб', ru: 'Свидетельство о браке', en: 'Marriage Certificate', es: 'Acta de matrimonio', pl: 'Akt małżeństwa', de: 'Heiratsurkunde', fr: 'Acte de mariage', ar: 'عقد الزواج', zh: '结婚证', ko: '결혼증명서', pt: 'Certidão de casamento' },
    color: 'linear-gradient(150deg,#881337 0%,#f472b6 100%)',
    icon: '<svg viewBox="0 0 28 34" width="28" height="34" fill="none"><rect x="1" y="1" width="26" height="32" rx="1.5" fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.85)" stroke-width="1.5"/><rect x="3.5" y="3.5" width="21" height="27" rx=".8" stroke="rgba(255,255,255,.38)" stroke-width=".8" stroke-dasharray="2.5 2"/><circle cx="10.5" cy="13" r="4.5" stroke="rgba(255,255,255,.95)" stroke-width="1.8" fill="none"/><circle cx="17.5" cy="13" r="4.5" stroke="rgba(255,255,255,.95)" stroke-width="1.8" fill="rgba(255,255,255,.14)"/><rect x="5" y="22" width="18" height="1.6" rx=".8" fill="rgba(255,255,255,.65)"/><rect x="6" y="25" width="16" height="1.3" rx=".65" fill="rgba(255,255,255,.48)"/><rect x="7" y="28" width="14" height="1.3" rx=".65" fill="rgba(255,255,255,.35)"/></svg>',
    fields: [
      { key: 'spouse1_name', en: "Husband's Last Name", orig: { uk: 'Прізвище чоловіка', ru: 'Фамилия мужа', es: 'Apellido del esposo', en: "Husband's Last Name" }, required: true, group: 'personal', placeholder: { uk: 'ШЕВЧЕНКО', ru: 'ШЕВЧЕНКО', en: 'SHEVCHENKO' } },
      { key: 'given_names', en: "Husband's Full Name", orig: { uk: "Ім'я та по батькові чоловіка", ru: 'Имя и отчество мужа', es: 'Nombre completo del esposo', en: "Husband's Full Name" }, required: true, group: 'personal', placeholder: { uk: 'ТАРАС ГРИГОРОВИЧ', ru: 'ТАРАС ГРИГОРОВИЧ', en: 'TARAS HRYHOROVYCH' } },
      { key: 'spouse2_name', en: "Wife's Last Name", orig: { uk: 'Прізвище дружини', ru: 'Фамилия жены', es: 'Apellido de la esposa', en: "Wife's Last Name" }, required: true, group: 'personal', placeholder: { uk: 'ФРАНКО', ru: 'ФРАНКО', en: 'FRANKO' } },
      { key: 'mother_name', en: "Wife's Full Name", orig: { uk: "Ім'я та по батькові дружини", ru: 'Имя и отчество жены', es: 'Nombre completo de la esposa', en: "Wife's Full Name" }, required: true, group: 'personal', placeholder: { uk: 'ЛЕСЯ ПЕТРІВНА', ru: 'ЛЕСЯ ПЕТРОВНА', en: 'LESIA PETRIVNA' } },
      { key: 'date_of_marriage', en: 'Date of Marriage', orig: { uk: 'Дата реєстрації шлюбу', ru: 'Дата регистрации брака', es: 'Fecha de matrimonio', en: 'Date of Marriage' }, required: true, group: 'document', type: 'date' },
      { key: 'document_number', en: 'Certificate Number', orig: { uk: 'Номер свідоцтва', ru: 'Номер свидетельства', es: 'Número de certificado', en: 'Certificate Number' }, required: true, group: 'document', placeholder: { uk: 'КВ №654321', ru: 'КВ №654321', en: 'KV No.654321' } },
      { key: 'issue_date', en: 'Date of Issue', orig: { uk: 'Дата видачі', ru: 'Дата выдачи', es: 'Fecha de emisión', en: 'Date of Issue' }, required: true, group: 'document', type: 'date' },
      { key: 'issuing_authority', en: 'Registry Office', orig: { uk: 'Орган РАЦС', ru: 'Орган ЗАГС', es: 'Registro Civil', en: 'Registry Office' }, required: true, group: 'authority', placeholder: { uk: 'Печерський РАЦС м. Київ', ru: 'Печерский ЗАГС г. Киев', en: 'Civil Registry, Kyiv' } },
    ],
  },
  {
    id: 'divorce_cert', popular: false, prodId: 'divorce-certificate',
    label: { uk: 'Свідоцтво про розлучення', ru: 'Свидетельство о расторжении', en: 'Divorce Certificate', es: 'Acta de divorcio', pl: 'Akt rozwodowy', de: 'Scheidungsurkunde', fr: 'Acte de divorce', ar: 'وثيقة الطلاق', zh: '离婚证', ko: '이혼증명서', pt: 'Certidão de divórcio' },
    color: 'linear-gradient(150deg,#1f2937 0%,#6b7280 100%)',
    icon: '<svg viewBox="0 0 28 34" width="28" height="34" fill="none"><rect x="1" y="1" width="26" height="32" rx="1.5" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.72)" stroke-width="1.5"/><rect x="7" y="6.5" width="10" height="4" rx="1.2" fill="rgba(255,255,255,.82)" transform="rotate(-38 12 8.5)"/><line x1="13" y1="14" x2="18.5" y2="20.5" stroke="rgba(255,255,255,.82)" stroke-width="2.5" stroke-linecap="round"/><rect x="14" y="17" width="8.5" height="4" rx="1.2" fill="rgba(255,255,255,.75)" transform="rotate(-38 18.25 19)"/><rect x="5" y="24" width="18" height="1.5" rx=".75" fill="rgba(255,255,255,.55)"/><rect x="6" y="27" width="16" height="1.3" rx=".65" fill="rgba(255,255,255,.4)"/><rect x="7" y="30" width="14" height="1.3" rx=".65" fill="rgba(255,255,255,.3)"/></svg>',
    fields: [
      { key: 'spouse1_name', en: "First Person's Last Name", orig: { uk: 'Прізвище першої особи', ru: 'Фамилия первого лица', es: 'Apellido 1', en: "First Person's Last Name" }, required: true, group: 'personal', placeholder: { uk: 'ШЕВЧЕНКО', ru: 'ШЕВЧЕНКО', en: 'SHEVCHENKO' } },
      { key: 'given_names', en: "First Person's Full Name", orig: { uk: "Ім'я та по батькові", ru: 'Имя и отчество', es: 'Nombre completo 1', en: "First Person's Full Name" }, required: true, group: 'personal', placeholder: { uk: 'ТАРАС ГРИГОРОВИЧ', ru: 'ТАРАС ГРИГОРОВИЧ', en: 'TARAS HRYHOROVYCH' } },
      { key: 'spouse2_name', en: "Second Person's Last Name", orig: { uk: 'Прізвище другої особи', ru: 'Фамилия второго лица', es: 'Apellido 2', en: "Second Person's Last Name" }, required: true, group: 'personal', placeholder: { uk: 'ФРАНКО', ru: 'ФРАНКО', en: 'FRANKO' } },
      { key: 'mother_name', en: "Second Person's Full Name", orig: { uk: "Ім'я та по батькові", ru: 'Имя и отчество', es: 'Nombre completo 2', en: "Second Person's Full Name" }, required: true, group: 'personal', placeholder: { uk: 'ЛЕСЯ ПЕТРІВНА', ru: 'ЛЕСЯ ПЕТРОВНА', en: 'LESIA PETRIVNA' } },
      { key: 'date_of_divorce', en: 'Date of Divorce', orig: { uk: 'Дата розірвання шлюбу', ru: 'Дата расторжения брака', es: 'Fecha de divorcio', en: 'Date of Divorce' }, required: true, group: 'document', type: 'date' },
      { key: 'document_number', en: 'Certificate Number', orig: { uk: 'Номер свідоцтва', ru: 'Номер свидетельства', es: 'Número de certificado', en: 'Certificate Number' }, required: true, group: 'document', placeholder: { uk: 'КВ №789012', ru: 'КВ №789012', en: 'KV No.789012' } },
      { key: 'issuing_authority', en: 'Registry Office / Court', orig: { uk: 'Орган РАЦС', ru: 'Орган ЗАГС', es: 'Registro Civil', en: 'Registry Office / Court' }, required: true, group: 'authority', placeholder: { uk: 'Дарницький РАЦС м. Київ', ru: 'Дарницкий ЗАГС г. Киев', en: 'Civil Registry, Kyiv' } },
    ],
  },
  {
    id: 'diploma', popular: false, prodId: 'diploma-transcript',
    label: { uk: 'Диплом / Атестат', ru: 'Диплом / Аттестат', en: 'Diploma / Degree', es: 'Diploma / Título', pl: 'Dyplom', de: 'Diplom', fr: 'Diplôme', ar: 'شهادة', zh: '文凭', ko: '졸업증명서', pt: 'Diploma' },
    color: 'linear-gradient(150deg,#4c1d95 0%,#a78bfa 100%)',
    icon: '<svg viewBox="0 0 32 28" width="32" height="28" fill="none"><rect x="1" y="5" width="30" height="18" rx="1" fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.82)" stroke-width="1.5"/><ellipse cx="16" cy="5" rx="15" ry="3" fill="rgba(255,255,255,.22)" stroke="rgba(255,255,255,.78)" stroke-width="1.3"/><ellipse cx="16" cy="23" rx="15" ry="3" fill="rgba(255,255,255,.22)" stroke="rgba(255,255,255,.78)" stroke-width="1.3"/><circle cx="16" cy="14" r="4" fill="rgba(255,255,255,.22)" stroke="rgba(255,255,255,.9)" stroke-width="1.4"/><path d="M13.5 14l2 2 4-4" stroke="rgba(255,255,255,1)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    fields: [
      { key: 'full_name', en: 'Last Name', orig: { uk: 'Прізвище', ru: 'Фамилия', es: 'Apellido', en: 'Last Name' }, required: true, group: 'personal', placeholder: { uk: 'ШЕВЧЕНКО', ru: 'ШЕВЧЕНКО', en: 'SHEVCHENKO' } },
      { key: 'given_names', en: 'Given Names', orig: { uk: "Ім'я та по батькові", ru: 'Имя и отчество', es: 'Nombres', en: 'Given Names' }, required: true, group: 'personal', placeholder: { uk: 'ТАРАС ГРИГОРОВИЧ', ru: 'ТАРАС ГРИГОРОВИЧ', en: 'TARAS HRYHOROVYCH' } },
      { key: 'date_of_birth', en: 'Date of Birth', orig: { uk: 'Дата народження', ru: 'Дата рождения', es: 'Fecha de nacimiento', en: 'Date of Birth' }, required: true, group: 'personal', type: 'date' },
      { key: 'degree_title', en: 'Degree / Qualification', orig: { uk: 'Ступінь / Кваліфікація', ru: 'Степень / Квалификация', es: 'Título', en: 'Degree / Qualification' }, required: true, group: 'document', placeholder: { uk: 'Бакалавр', ru: 'Бакалавр', en: "Bachelor's Degree" } },
      { key: 'institution', en: 'Institution', orig: { uk: 'Навчальний заклад', ru: 'Учебное заведение', es: 'Institución', en: 'Institution' }, required: true, group: 'authority', placeholder: { uk: 'КНУ імені Тараса Шевченка', ru: 'КНУ имени Тараса Шевченко', en: 'Taras Shevchenko National University' } },
      { key: 'document_number', en: 'Diploma Number', orig: { uk: 'Номер диплома', ru: 'Номер диплома', es: 'Número de diploma', en: 'Diploma Number' }, required: true, group: 'document', placeholder: { uk: 'КВ №98765', ru: 'КВ №98765', en: 'KV No.98765' } },
      { key: 'issue_date', en: 'Date of Issue', orig: { uk: 'Дата видачі', ru: 'Дата выдачи', es: 'Fecha de emisión', en: 'Date of Issue' }, required: true, group: 'document', type: 'date' },
    ],
  },
  {
    id: 'driving_license', popular: false, prodId: 'driver-license',
    label: { uk: 'Водійські права', ru: 'Водительское удостоверение', en: "Driver's License", es: 'Licencia de conducir', pl: 'Prawo jazdy', de: 'Führerschein', fr: 'Permis de conduire', ar: 'رخصة القيادة', zh: '驾照', ko: '운전면허증', pt: 'Carteira de motorista' },
    color: 'linear-gradient(150deg,#064e3b 0%,#34d399 100%)',
    icon: '<svg viewBox="0 0 34 22" width="33" height="21" fill="none"><rect x="1" y="1" width="32" height="20" rx="2" fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.88)" stroke-width="1.5"/><rect x="3" y="3" width="9" height="10.5" rx="1" fill="rgba(255,255,255,.2)" stroke="rgba(255,255,255,.62)" stroke-width=".9"/><circle cx="7.5" cy="6.5" r="2.2" fill="rgba(255,255,255,.82)"/><path d="M3 13.5c0-2.2 2-4 4.5-4s4.5 1.8 4.5 4" fill="rgba(255,255,255,.48)"/><rect x="14" y="4" width="15" height="1.7" rx=".85" fill="rgba(255,255,255,.72)"/><rect x="14" y="7.5" width="11" height="1.4" rx=".7" fill="rgba(255,255,255,.52)"/><rect x="14" y="10.5" width="13" height="1.4" rx=".7" fill="rgba(255,255,255,.52)"/><path d="M5 18.5c0-.8.6-1.5 1.5-1.5h21c.8 0 1.5.7 1.5 1.5H5z" fill="rgba(255,255,255,.32)" stroke="rgba(255,255,255,.58)" stroke-width=".8"/><circle cx="9.5" cy="19.5" r="1.4" fill="rgba(255,255,255,.88)"/><circle cx="24" cy="19.5" r="1.4" fill="rgba(255,255,255,.88)"/><rect x="12" y="17.2" width="10" height="1" rx=".5" fill="rgba(255,255,255,.3)"/></svg>',
    fields: [
      { key: 'full_name', en: 'Last Name', orig: { uk: 'Прізвище', ru: 'Фамилия', es: 'Apellido', en: 'Last Name' }, required: true, group: 'personal', placeholder: { uk: 'ШЕВЧЕНКО', ru: 'ШЕВЧЕНКО', en: 'SHEVCHENKO' } },
      { key: 'given_names', en: 'Given Names', orig: { uk: "Ім'я та по батькові", ru: 'Имя и отчество', es: 'Nombres', en: 'Given Names' }, required: true, group: 'personal', placeholder: { uk: 'ТАРАС ГРИГОРОВИЧ', ru: 'ТАРАС ГРИГОРОВИЧ', en: 'TARAS HRYHOROVYCH' } },
      { key: 'date_of_birth', en: 'Date of Birth', orig: { uk: 'Дата народження', ru: 'Дата рождения', es: 'Fecha de nacimiento', en: 'Date of Birth' }, required: true, group: 'personal', type: 'date' },
      { key: 'document_number', en: 'License Number', orig: { uk: 'Номер посвідчення', ru: 'Номер удостоверения', es: 'Número de licencia', en: 'License Number' }, required: true, group: 'document', placeholder: { uk: 'АА 123456', ru: 'АА 123456', en: 'AA 123456' }, helpExample: { uk: 'Поле 5 на лицьовому боці посвідчення', ru: 'Поле 5 на лицевой стороне', en: 'Field 5 on the front of the license' } },
      { key: 'issue_date', en: 'Date of Issue', orig: { uk: 'Дата видачі', ru: 'Дата выдачи', es: 'Fecha de emisión', en: 'Date of Issue' }, required: true, group: 'document', type: 'date' },
      { key: 'expiry_date', en: 'Date of Expiry', orig: { uk: 'Термін дії', ru: 'Срок действия', es: 'Fecha de vencimiento', en: 'Date of Expiry' }, required: true, group: 'document', type: 'date' },
      { key: 'issuing_authority', en: 'Issuing Authority', orig: { uk: 'Орган видачі', ru: 'Орган выдачи', es: 'Autoridad emisora', en: 'Issuing Authority' }, required: true, group: 'authority', placeholder: { uk: 'ТСЦ 8044', ru: 'ТСЦ 8044', en: 'Regional Service Centre 8044' } },
    ],
  },
  {
    id: 'military_id', popular: false, prodId: 'military-document',
    label: { uk: 'Військовий квиток', ru: 'Военный билет', en: 'Military ID', es: 'Identificación militar', pl: 'Książeczka wojskowa', de: 'Militärausweis', fr: 'Livret militaire', ar: 'هوية عسكرية', zh: '军人证', ko: '군인신분증', pt: 'Carteira militar' },
    color: 'linear-gradient(150deg,#14532d 0%,#4ade80 100%)',
    icon: '<svg viewBox="0 0 28 32" width="28" height="32" fill="none"><path d="M14 1.5L2.5 6.5v9.5c0 7.5 4.8 12.8 11.5 14.5C20.7 28.8 25.5 23.5 25.5 16V6.5L14 1.5z" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.9)" stroke-width="1.5" stroke-linejoin="round"/><path d="M14 8.5l1.9 5.6h5.9l-4.8 3.4 1.8 5.6L14 19.9l-4.8 3.2 1.8-5.6-4.8-3.4H12z" fill="rgba(255,255,255,.95)"/></svg>',
    fields: [
      { key: 'full_name', en: 'Last Name', orig: { uk: 'Прізвище', ru: 'Фамилия', es: 'Apellido', en: 'Last Name' }, required: true, group: 'personal', placeholder: { uk: 'ШЕВЧЕНКО', ru: 'ШЕВЧЕНКО', en: 'SHEVCHENKO' } },
      { key: 'given_names', en: 'Given Names', orig: { uk: "Ім'я та по батькові", ru: 'Имя и отчество', es: 'Nombres', en: 'Given Names' }, required: true, group: 'personal', placeholder: { uk: 'ТАРАС ГРИГОРОВИЧ', ru: 'ТАРАС ГРИГОРОВИЧ', en: 'TARAS HRYHOROVYCH' } },
      { key: 'date_of_birth', en: 'Date of Birth', orig: { uk: 'Дата народження', ru: 'Дата рождения', es: 'Fecha de nacimiento', en: 'Date of Birth' }, required: true, group: 'personal', type: 'date' },
      { key: 'document_number', en: 'Military ID Number', orig: { uk: 'Номер квитка', ru: 'Номер билета', es: 'Número de ID', en: 'Military ID Number' }, required: true, group: 'document', placeholder: { uk: 'АА 123456', ru: 'АА 123456', en: 'AA 123456' } },
      { key: 'issue_date', en: 'Date of Issue', orig: { uk: 'Дата видачі', ru: 'Дата выдачи', es: 'Fecha de emisión', en: 'Date of Issue' }, required: true, group: 'document', type: 'date' },
      { key: 'issuing_authority', en: 'Issuing Authority', orig: { uk: 'Орган видачі', ru: 'Орган выдачи', es: 'Autoridad emisora', en: 'Issuing Authority' }, required: true, group: 'authority', placeholder: { uk: 'ВЧ А0000, Київ', ru: 'в/ч А0000, Киев', en: 'Military Unit A0000, Kyiv' } },
    ],
  },
  {
    id: 'medical_record', popular: false, prodId: 'medical-record',
    label: { uk: 'Медична довідка', ru: 'Медицинская справка', en: 'Medical Record', es: 'Registro médico', pl: 'Zaświadczenie lekarskie', de: 'Ärztliches Attest', fr: 'Certificat médical', ar: 'سجل طبي', zh: '医疗记录', ko: '의료기록', pt: 'Registro médico' },
    color: 'linear-gradient(150deg,#0c4a6e 0%,#38bdf8 100%)',
    icon: '<svg viewBox="0 0 26 32" width="26" height="32" fill="none"><rect x="1" y="5" width="24" height="26" rx="2" fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.88)" stroke-width="1.5"/><rect x="8" y="2" width="10" height="6.5" rx="2.5" fill="rgba(255,255,255,.28)" stroke="rgba(255,255,255,.82)" stroke-width="1.3"/><rect x="11" y="11.5" width="4" height="11" rx="2" fill="rgba(255,255,255,.95)"/><rect x="7.5" y="15" width="11" height="4" rx="2" fill="rgba(255,255,255,.95)"/><rect x="4" y="25.5" width="18" height="1.5" rx=".75" fill="rgba(255,255,255,.48)"/><rect x="4" y="28.5" width="14" height="1.3" rx=".65" fill="rgba(255,255,255,.35)"/></svg>',
    fields: [
      { key: 'full_name', en: 'Last Name', orig: { uk: 'Прізвище', ru: 'Фамилия', es: 'Apellido', en: 'Last Name' }, required: true, group: 'personal', placeholder: { uk: 'ШЕВЧЕНКО', ru: 'ШЕВЧЕНКО', en: 'SHEVCHENKO' } },
      { key: 'given_names', en: 'Given Names', orig: { uk: "Ім'я та по батькові", ru: 'Имя и отчество', es: 'Nombres', en: 'Given Names' }, required: true, group: 'personal', placeholder: { uk: 'ТАРАС ГРИГОРОВИЧ', ru: 'ТАРАС ГРИГОРОВИЧ', en: 'TARAS HRYHOROVYCH' } },
      { key: 'date_of_birth', en: 'Date of Birth', orig: { uk: 'Дата народження', ru: 'Дата рождения', es: 'Fecha de nacimiento', en: 'Date of Birth' }, required: true, group: 'personal', type: 'date' },
      { key: 'document_number', en: 'Record / Reference Number', orig: { uk: 'Тип довідки', ru: 'Тип справки', es: 'Tipo de registro', en: 'Record Type / Number' }, required: true, group: 'document', placeholder: { uk: 'Медична довідка / №123', ru: 'Медицинская справка / №123', en: 'Medical Certificate / No.123' } },
      { key: 'issue_date', en: 'Date of Issue', orig: { uk: 'Дата видачі', ru: 'Дата выдачи', es: 'Fecha de emisión', en: 'Date of Issue' }, required: true, group: 'document', type: 'date' },
      { key: 'issuing_authority', en: 'Medical Facility', orig: { uk: 'Медичний заклад', ru: 'Медицинское учреждение', es: 'Establecimiento médico', en: 'Medical Facility' }, required: true, group: 'authority', placeholder: { uk: 'КМЛ №1, Київ', ru: 'КМБ №1, Киев', en: 'City Hospital No.1, Kyiv' } },
    ],
  },
  {
    id: 'death_cert', popular: false, prodId: 'death-certificate',
    label: { uk: 'Свідоцтво про смерть', ru: 'Свидетельство о смерти', en: 'Death Certificate', es: 'Certificado de defunción', pl: 'Akt zgonu', de: 'Sterbeurkunde', fr: 'Acte de décès', ar: 'شهادة الوفاة', zh: '死亡证明', ko: '사망증명서', pt: 'Certidão de óbito' },
    color: 'linear-gradient(150deg,#1c1917 0%,#57534e 100%)',
    icon: '<svg viewBox="0 0 28 34" width="28" height="34" fill="none"><rect x="1" y="1" width="26" height="32" rx="1.5" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.72)" stroke-width="1.5"/><rect x="3.5" y="3.5" width="21" height="27" rx=".8" stroke="rgba(255,255,255,.3)" stroke-width=".8" stroke-dasharray="2.5 2"/><path d="M14 7v8M10 11h8" stroke="rgba(255,255,255,.9)" stroke-width="2.2" stroke-linecap="round"/><rect x="5" y="22" width="18" height="1.5" rx=".75" fill="rgba(255,255,255,.55)"/><rect x="6" y="25" width="16" height="1.3" rx=".65" fill="rgba(255,255,255,.4)"/><rect x="7" y="28" width="14" height="1.3" rx=".65" fill="rgba(255,255,255,.3)"/></svg>',
    fields: [
      { key: 'full_name', en: "Deceased's Last Name", orig: { uk: 'Прізвище померлого/ої', ru: 'Фамилия умершего/ей', es: 'Apellido del fallecido', en: "Deceased's Last Name" }, required: true, group: 'personal', placeholder: { uk: 'ШЕВЧЕНКО', ru: 'ШЕВЧЕНКО', en: 'SHEVCHENKO' } },
      { key: 'given_names', en: "Deceased's Given Names", orig: { uk: "Ім'я та по батькові", ru: 'Имя и отчество', es: 'Nombres del fallecido', en: "Given Names" }, required: true, group: 'personal', placeholder: { uk: 'ТАРАС ГРИГОРОВИЧ', ru: 'ТАРАС ГРИГОРОВИЧ', en: 'TARAS HRYHOROVYCH' } },
      { key: 'date_of_birth', en: 'Date of Birth', orig: { uk: 'Дата народження', ru: 'Дата рождения', es: 'Fecha de nacimiento', en: 'Date of Birth' }, required: false, group: 'personal', type: 'date' },
      { key: 'date_of_death', en: 'Date of Death', orig: { uk: 'Дата смерті', ru: 'Дата смерти', es: 'Fecha de defunción', en: 'Date of Death' }, required: true, group: 'document', type: 'date' },
      { key: 'place_of_death', en: 'Place of Death', orig: { uk: 'Місце смерті', ru: 'Место смерти', es: 'Lugar de defunción', en: 'Place of Death' }, required: true, group: 'document', placeholder: { uk: 'м. Київ, Україна', ru: 'г. Киев, Украина', en: 'Kyiv, Ukraine' } },
      { key: 'document_number', en: 'Certificate Number', orig: { uk: 'Номер свідоцтва', ru: 'Номер свидетельства', es: 'Número de certificado', en: 'Certificate Number' }, required: true, group: 'document', placeholder: { uk: 'І-КВ №123456', ru: 'І-КВ №123456', en: 'I-KV No.123456' } },
      { key: 'issue_date', en: 'Date of Issue', orig: { uk: 'Дата видачі', ru: 'Дата выдачи', es: 'Fecha de emisión', en: 'Date of Issue' }, required: true, group: 'document', type: 'date' },
      { key: 'issuing_authority', en: 'Registry Office', orig: { uk: 'Орган РАЦС', ru: 'Орган ЗАГС', es: 'Registro Civil', en: 'Registry Office' }, required: true, group: 'authority', placeholder: { uk: 'Шевченківський РАЦС м. Київ', ru: 'Шевченковский ЗАГС г. Киев', en: 'Civil Registry, Kyiv' } },
    ],
  },
  {
    id: 'adoption_cert', popular: false, prodId: 'adoption-certificate',
    label: { uk: 'Свідоцтво про усиновлення', ru: 'Свидетельство об усыновлении', en: 'Adoption Certificate', es: 'Certificado de adopción', pl: 'Akt adopcji', de: 'Adoptionsurkunde', fr: "Acte d'adoption", ar: 'شهادة التبني', zh: '收养证书', ko: '입양증명서', pt: 'Certidão de adoção' },
    color: 'linear-gradient(150deg,#701a75 0%,#e879f9 100%)',
    icon: '<svg viewBox="0 0 28 34" width="28" height="34" fill="none"><rect x="1" y="1" width="26" height="32" rx="1.5" fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.85)" stroke-width="1.5"/><path d="M14 8c-3.3 0-6 2.5-6 5.5S10.7 19 14 19s6-2.5 6-5.5S17.3 8 14 8z" fill="rgba(255,255,255,.85)"/><path d="M10 17.5C7 18.8 5 21.5 5 24.5h18c0-3-2-5.7-5-7" stroke="rgba(255,255,255,.85)" stroke-width="1.5" stroke-linecap="round" fill="none"/><path d="M10.5 10.5l1.5 1.5 3.5-3.5" stroke="rgba(255,255,255,.4)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    fields: [
      { key: 'child_name', en: "Child's Last Name (after adoption)", orig: { uk: 'Прізвище дитини (після усиновлення)', ru: 'Фамилия ребёнка (после усыновления)', es: 'Apellido del niño (después)', en: "Child's Last Name (after adoption)" }, required: true, group: 'personal', placeholder: { uk: 'ШЕВЧЕНКО', ru: 'ШЕВЧЕНКО', en: 'SHEVCHENKO' } },
      { key: 'given_names', en: "Child's Given Names", orig: { uk: "Ім'я дитини", ru: 'Имя ребёнка', es: 'Nombres del niño', en: "Child's Given Names" }, required: true, group: 'personal', placeholder: { uk: 'ТАРАС', ru: 'ТАРАС', en: 'TARAS' } },
      { key: 'date_of_birth', en: "Child's Date of Birth", orig: { uk: 'Дата народження дитини', ru: 'Дата рождения ребёнка', es: 'Fecha de nacimiento', en: 'Date of Birth' }, required: true, group: 'personal', type: 'date' },
      { key: 'father_name', en: "Adoptive Parent 1 — Full Name", orig: { uk: "Усиновлювач 1 — ПІБ", ru: 'Усыновитель 1 — ФИО', es: 'Padre adoptivo 1', en: "Adoptive Parent 1" }, required: true, group: 'personal', placeholder: { uk: 'ГРИГОРІЙ ІВАНОВИЧ ШЕВЧЕНКО', ru: 'ГРИГОРИЙ ИВАНОВИЧ', en: 'HRYHORIY IVANOVYCH SHEVCHENKO' } },
      { key: 'mother_name', en: "Adoptive Parent 2 — Full Name (if applicable)", orig: { uk: "Усиновлювач 2 — ПІБ (якщо є)", ru: 'Усыновитель 2 — ФИО (если есть)', es: 'Madre adoptiva 2 (si aplica)', en: "Adoptive Parent 2 (if applicable)" }, required: false, group: 'personal', placeholder: { uk: 'ГАННА ПЕТРІВНА ШЕВЧЕНКО', ru: 'АННА ПЕТРОВНА', en: 'HANNA PETRIVNA SHEVCHENKO' } },
      { key: 'document_number', en: 'Certificate / Court Decision Number', orig: { uk: 'Номер свідоцтва / рішення суду', ru: 'Номер свидетельства / решения суда', es: 'Número de certificado', en: 'Certificate Number' }, required: true, group: 'document', placeholder: { uk: 'І-КВ №123456', ru: 'І-КВ №123456', en: 'I-KV No.123456' } },
      { key: 'issue_date', en: 'Date of Issue', orig: { uk: 'Дата видачі', ru: 'Дата выдачи', es: 'Fecha de emisión', en: 'Date of Issue' }, required: true, group: 'document', type: 'date' },
      { key: 'issuing_authority', en: 'Issuing Authority / Court', orig: { uk: 'Орган / Суд', ru: 'Орган / Суд', es: 'Autoridad / Tribunal', en: 'Issuing Authority / Court' }, required: true, group: 'authority', placeholder: { uk: 'Шевченківський районний суд м. Київ', ru: 'Шевченковский районный суд', en: 'Shevchenko District Court, Kyiv' } },
    ],
  },
  {
    id: 'name_change_cert', popular: false, prodId: 'name-change-certificate',
    label: { uk: 'Свідоцтво про зміну імені', ru: 'Свидетельство о смене имени', en: 'Name Change Certificate', es: 'Certificado de cambio de nombre', pl: 'Akt zmiany imienia', de: 'Namensänderungsurkunde', fr: 'Acte de changement de nom', ar: 'شهادة تغيير الاسم', zh: '改名证书', ko: '개명증명서', pt: 'Certidão de mudança de nome' },
    color: 'linear-gradient(150deg,#7c3aed 0%,#c4b5fd 100%)',
    icon: '<svg viewBox="0 0 28 34" width="28" height="34" fill="none"><rect x="1" y="1" width="26" height="32" rx="1.5" fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.85)" stroke-width="1.5"/><path d="M7 10h14M7 14h10M7 18h12" stroke="rgba(255,255,255,.7)" stroke-width="1.5" stroke-linecap="round"/><path d="M19 22l2 2-2 2M21 24H15" stroke="rgba(255,255,255,.9)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    fields: [
      { key: 'full_name', en: 'Former Last Name', orig: { uk: 'Колишнє прізвище', ru: 'Прежняя фамилия', es: 'Apellido anterior', en: 'Former Last Name' }, required: true, group: 'personal', placeholder: { uk: 'ФРАНКО', ru: 'ФРАНКО', en: 'FRANKO' } },
      { key: 'given_names', en: 'Former Given Names', orig: { uk: "Колишнє ім'я та по батькові", ru: 'Прежнее имя и отчество', es: 'Nombres anteriores', en: 'Former Given Names' }, required: true, group: 'personal', placeholder: { uk: 'ТАРАС ГРИГОРОВИЧ', ru: 'ТАРАС ГРИГОРОВИЧ', en: 'TARAS HRYHOROVYCH' } },
      { key: 'spouse1_name', en: 'New Last Name', orig: { uk: 'Нове прізвище', ru: 'Новая фамилия', es: 'Nuevo apellido', en: 'New Last Name' }, required: true, group: 'personal', placeholder: { uk: 'ШЕВЧЕНКО', ru: 'ШЕВЧЕНКО', en: 'SHEVCHENKO' } },
      { key: 'spouse2_name', en: 'New Given Names', orig: { uk: "Нове ім'я та по батькові", ru: 'Новое имя и отчество', es: 'Nuevos nombres', en: 'New Given Names' }, required: true, group: 'personal', placeholder: { uk: 'ТАРАС ГРИГОРОВИЧ', ru: 'ТАРАС ГРИГОРОВИЧ', en: 'TARAS HRYHOROVYCH' } },
      { key: 'date_of_birth', en: 'Date of Birth', orig: { uk: 'Дата народження', ru: 'Дата рождения', es: 'Fecha de nacimiento', en: 'Date of Birth' }, required: true, group: 'personal', type: 'date' },
      { key: 'document_number', en: 'Certificate / Decision Number', orig: { uk: 'Номер свідоцтва / рішення', ru: 'Номер свидетельства / решения', es: 'Número de certificado', en: 'Certificate Number' }, required: true, group: 'document', placeholder: { uk: 'І-КВ №123456', ru: 'І-КВ №123456', en: 'I-KV No.123456' } },
      { key: 'issue_date', en: 'Date of Issue', orig: { uk: 'Дата видачі', ru: 'Дата выдачи', es: 'Fecha de emisión', en: 'Date of Issue' }, required: true, group: 'document', type: 'date' },
      { key: 'issuing_authority', en: 'Issuing Authority', orig: { uk: 'Орган РАЦС', ru: 'Орган ЗАГС', es: 'Registro Civil', en: 'Registry Office' }, required: true, group: 'authority', placeholder: { uk: 'Шевченківський РАЦС м. Київ', ru: 'Шевченковский ЗАГС г. Киев', en: 'Civil Registry, Kyiv' } },
    ],
  },
  {
    id: 'police_record', popular: false, prodId: 'police-record',
    label: { uk: 'Довідка про несудимість', ru: 'Справка о несудимости', en: 'Police / Criminal Record', es: 'Antecedentes penales', pl: 'Zaświadczenie o niekaralności', de: 'Führungszeugnis', fr: 'Casier judiciaire', ar: 'سجل الشرطة', zh: '无犯罪记录', ko: '범죄경력조회', pt: 'Registro criminal' },
    color: 'linear-gradient(150deg,#1e3a5f 0%,#3b82f6 100%)',
    icon: '<svg viewBox="0 0 28 34" width="28" height="34" fill="none"><path d="M14 2L3 7v10c0 7.5 4.8 12.8 11 14.5C20.2 29.8 25 24.5 25 17V7L14 2z" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.88)" stroke-width="1.5" stroke-linejoin="round"/><path d="M9.5 16l3 3 6-6" stroke="rgba(255,255,255,.95)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    fields: [
      { key: 'full_name', en: 'Last Name', orig: { uk: 'Прізвище', ru: 'Фамилия', es: 'Apellido', en: 'Last Name' }, required: true, group: 'personal', placeholder: { uk: 'ШЕВЧЕНКО', ru: 'ШЕВЧЕНКО', en: 'SHEVCHENKO' } },
      { key: 'given_names', en: 'Given Names', orig: { uk: "Ім'я та по батькові", ru: 'Имя и отчество', es: 'Nombres', en: 'Given Names' }, required: true, group: 'personal', placeholder: { uk: 'ТАРАС ГРИГОРОВИЧ', ru: 'ТАРАС ГРИГОРОВИЧ', en: 'TARAS HRYHOROVYCH' } },
      { key: 'date_of_birth', en: 'Date of Birth', orig: { uk: 'Дата народження', ru: 'Дата рождения', es: 'Fecha de nacimiento', en: 'Date of Birth' }, required: true, group: 'personal', type: 'date' },
      { key: 'document_number', en: 'Record Type (e.g. No Criminal Record)', orig: { uk: 'Тип довідки (наприклад: відсутність судимостей)', ru: 'Тип справки (напр.: отсутствие судимостей)', es: 'Tipo de registro', en: 'Record Type' }, required: true, group: 'document', placeholder: { uk: 'Відомості про несудимість', ru: 'Сведения о несудимости', en: 'No Criminal Record' } },
      { key: 'issue_date', en: 'Date of Issue', orig: { uk: 'Дата видачі', ru: 'Дата выдачи', es: 'Fecha de emisión', en: 'Date of Issue' }, required: true, group: 'document', type: 'date' },
      { key: 'issuing_authority', en: 'Issuing Authority (Police / Ministry)', orig: { uk: 'Орган видачі (Поліція / МВС)', ru: 'Орган выдачи (Полиция / МВД)', es: 'Autoridad emisora', en: 'Issuing Authority' }, required: true, group: 'authority', placeholder: { uk: 'Інформаційний центр МВС України', ru: 'Информационный центр МВД Украины', en: 'Information Center, Ministry of Internal Affairs of Ukraine' } },
    ],
  },
  {
    id: 'property_doc', popular: false, prodId: 'property-document',
    label: { uk: 'Документ на нерухомість', ru: 'Документ на недвижимость', en: 'Property Document', es: 'Documento de propiedad', pl: 'Dokument własności', de: 'Eigentumsnachweis', fr: 'Titre de propriété', ar: 'وثيقة ملكية', zh: '房产证明', ko: '부동산증명서', pt: 'Documento de propriedade' },
    color: 'linear-gradient(150deg,#1a3a1a 0%,#4ade80 100%)',
    icon: '<svg viewBox="0 0 30 32" width="30" height="32" fill="none"><path d="M15 3L2 12h4v17h8v-8h2v8h8V12h4L15 3z" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.88)" stroke-width="1.5" stroke-linejoin="round"/><rect x="11" y="19" width="8" height="10" rx="1" stroke="rgba(255,255,255,.5)" stroke-width=".8" fill="none"/><circle cx="15" cy="22.5" r="1" fill="rgba(255,255,255,.7)"/></svg>',
    fields: [
      { key: 'full_name', en: "Owner's Last Name", orig: { uk: 'Прізвище власника', ru: 'Фамилия владельца', es: 'Apellido del propietario', en: "Owner's Last Name" }, required: true, group: 'personal', placeholder: { uk: 'ШЕВЧЕНКО', ru: 'ШЕВЧЕНКО', en: 'SHEVCHENKO' } },
      { key: 'given_names', en: "Owner's Given Names", orig: { uk: "Ім'я та по батькові власника", ru: 'Имя и отчество владельца', es: 'Nombres del propietario', en: "Owner's Given Names" }, required: true, group: 'personal', placeholder: { uk: 'ТАРАС ГРИГОРОВИЧ', ru: 'ТАРАС ГРИГОРОВИЧ', en: 'TARAS HRYHOROVYCH' } },
      { key: 'document_number', en: 'Document / Registration Number', orig: { uk: 'Номер документа / реєстраційний номер', ru: 'Номер документа / регистрационный номер', es: 'Número de documento', en: 'Document / Registration Number' }, required: true, group: 'document', placeholder: { uk: 'КВ №123456', ru: 'КВ №123456', en: 'KV No.123456' } },
      { key: 'spouse1_name', en: 'Property Address', orig: { uk: 'Адреса нерухомості', ru: 'Адрес недвижимости', es: 'Dirección de la propiedad', en: 'Property Address' }, required: true, group: 'document', placeholder: { uk: 'вул. Хрещатик 1, кв. 10, Київ', ru: 'ул. Крещатик 1, кв. 10, Киев', en: '1 Khreshchatyk St, Apt 10, Kyiv' } },
      { key: 'issue_date', en: 'Date of Registration / Issue', orig: { uk: 'Дата реєстрації / видачі', ru: 'Дата регистрации / выдачи', es: 'Fecha de registro', en: 'Date of Registration / Issue' }, required: true, group: 'document', type: 'date' },
      { key: 'issuing_authority', en: 'Issuing Authority (Registry / Notary)', orig: { uk: 'Орган видачі (Реєстр / Нотаріус)', ru: 'Орган выдачи (Реестр / Нотариус)', es: 'Autoridad emisora', en: 'Issuing Authority' }, required: true, group: 'authority', placeholder: { uk: 'Держреєстр речових прав, Київ', ru: 'Государственный реестр прав', en: 'State Registry of Real Property Rights, Kyiv' } },
    ],
  },
  {
    id: 'employment_record', popular: false, prodId: 'employment-record',
    label: { uk: 'Трудова довідка / книжка', ru: 'Трудовая справка / книжка', en: 'Employment Record', es: 'Registro de empleo', pl: 'Zaświadczenie o zatrudnieniu', de: 'Arbeitsbescheinigung', fr: "Attestation d'emploi", ar: 'سجل العمل', zh: '劳动记录', ko: '재직증명서', pt: 'Registro de emprego' },
    color: 'linear-gradient(150deg,#1e3a5f 0%,#f59e0b 100%)',
    icon: '<svg viewBox="0 0 30 28" width="30" height="28" fill="none"><rect x="1" y="7" width="28" height="20" rx="1.5" fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.88)" stroke-width="1.5"/><rect x="10" y="3" width="10" height="7" rx="1.5" fill="rgba(255,255,255,.22)" stroke="rgba(255,255,255,.82)" stroke-width="1.3"/><rect x="5" y="13" width="20" height="1.5" rx=".75" fill="rgba(255,255,255,.65)"/><rect x="5" y="16.5" width="16" height="1.3" rx=".65" fill="rgba(255,255,255,.48)"/><rect x="5" y="19.5" width="18" height="1.3" rx=".65" fill="rgba(255,255,255,.48)"/><rect x="5" y="22.5" width="12" height="1.3" rx=".65" fill="rgba(255,255,255,.35)"/></svg>',
    fields: [
      { key: 'full_name', en: "Employee's Last Name", orig: { uk: 'Прізвище працівника', ru: 'Фамилия работника', es: 'Apellido del empleado', en: "Employee's Last Name" }, required: true, group: 'personal', placeholder: { uk: 'ШЕВЧЕНКО', ru: 'ШЕВЧЕНКО', en: 'SHEVCHENKO' } },
      { key: 'given_names', en: "Employee's Given Names", orig: { uk: "Ім'я та по батькові", ru: 'Имя и отчество', es: 'Nombres del empleado', en: "Employee's Given Names" }, required: true, group: 'personal', placeholder: { uk: 'ТАРАС ГРИГОРОВИЧ', ru: 'ТАРАС ГРИГОРОВИЧ', en: 'TARAS HRYHOROVYCH' } },
      { key: 'date_of_birth', en: 'Date of Birth', orig: { uk: 'Дата народження', ru: 'Дата рождения', es: 'Fecha de nacimiento', en: 'Date of Birth' }, required: false, group: 'personal', type: 'date' },
      { key: 'document_number', en: 'Position / Job Title', orig: { uk: 'Посада / Назва роботи', ru: 'Должность / Название работы', es: 'Cargo / Puesto de trabajo', en: 'Position / Job Title' }, required: true, group: 'document', placeholder: { uk: 'Інженер-програміст', ru: 'Инженер-программист', en: 'Software Engineer' } },
      { key: 'spouse1_name', en: 'Employer / Organization Name', orig: { uk: 'Назва роботодавця / організації', ru: 'Название работодателя / организации', es: 'Nombre del empleador', en: 'Employer Name' }, required: true, group: 'document', placeholder: { uk: 'ТОВ "Технології"', ru: 'ООО "Технологии"', en: 'Technology LLC' } },
      { key: 'issue_date', en: 'Date of Issue', orig: { uk: 'Дата видачі', ru: 'Дата выдачи', es: 'Fecha de emisión', en: 'Date of Issue' }, required: true, group: 'document', type: 'date' },
      { key: 'issuing_authority', en: 'Issuing Authority (HR / Employer)', orig: { uk: 'Орган видачі (Відділ кадрів)', ru: 'Орган выдачи (Отдел кадров)', es: 'Autoridad emisora', en: 'Issuing Authority (HR Department)' }, required: true, group: 'authority', placeholder: { uk: 'Відділ кадрів, ТОВ "Технології"', ru: 'Отдел кадров, ООО "Технологии"', en: 'HR Department, Technology LLC' } },
    ],
  },
]

// ─── OCR field-name → docDef field-key mapping ────────────────────────────────
// Maps field names returned by /api/ocr/extract to the canonical field keys used
// in docDefinitions.ts / fieldValues state.

const OCR_TO_FIELD: Record<string, string> = {
  // Passport fields
  surname: 'full_name',
  given_names: 'given_names',
  nationality: 'nationality',
  date_of_birth: 'date_of_birth',
  place_of_birth: 'place_of_birth',
  passport_number: 'document_number',
  issue_date: 'issue_date',
  expiry_date: 'expiry_date',
  issuing_country: 'issuing_authority',
  // Birth cert / generic
  full_name: 'full_name',
  father_name: 'father_name',
  mother_name: 'mother_name',
  registration_number: 'document_number',
  issuing_authority: 'issuing_authority',
  // Drivers license
  last_name: 'full_name',
  first_name: 'given_names',
  license_number: 'document_number',
  // Generic
  document_number: 'document_number',
}

/** Map wizard docId → OCR doc_type accepted by /api/ocr/extract */
function docIdToOcrType(id: string): string {
  if (id.startsWith('passport')) return 'passport'
  if (id === 'birth_cert') return 'birth_cert'
  if (id === 'driving_license') return 'drivers_license'
  return 'other'
}

// ─── UI strings ───────────────────────────────────────────────────────────────

const UI: Record<string, Record<string, string>> = {
  en: {
    popular: 'Popular documents',
    other: 'Other documents',
    stepLang: 'Language',
    stepFile: 'File',
    stepFields: 'Fields',
    stepReview: 'Review',
    stepConfirm: 'Confirm',
    stepDownload: 'Download',
    back: 'Back',
    next: 'Continue',
    skip: 'Skip',
    langTitle: 'What language is your document in?',
    langTop3: 'Most common',
    langOther: 'Other languages',
    uploadTitle: 'Upload your document — AI fills the fields',
    uploadHint: 'Take a photo or upload a scan — AI will automatically fill in all fields. You can review and correct before downloading.',
    uploadCameraBtn: '📷 Take photo',
    uploadFileBtn: '📁 Upload file',
    uploadSkip: 'Skip — enter fields manually',
    uploadRemove: 'Remove',
    uploadSelected: 'File selected:',
    ocrAnalyzing: 'AI is reading your document…',
    ocrSuccess: 'fields filled automatically by AI',
    ocrNone: 'Could not read the document — please fill in manually.',
    historyTitle: 'Recent translations',
    historyRedownload: 'Re-download',
    historyDelete: 'Remove',
    fieldsTitle: 'Enter fields from your document',
    fieldsHint: 'Copy exactly as written. Fields marked * are required.',
    grpPersonal: 'Personal information',
    grpDocument: 'Document details',
    grpAuthority: 'Issuing authority',
    whereToFind: 'Where to find?',
    reviewTitle: 'Review your entries',
    reviewHint: 'Check that all values are correct before downloading.',
    confirmTitle: 'Confirm before downloading',
    confirm1: 'I am the lawful owner or authorized representative for this document',
    confirm2: 'All data has been verified and matches the original document',
    confirm3: 'I understand this is a draft translation for personal use, not a notarized or attorney-prepared document',
    disclaimer: 'This translation draft is provided for self-help USCIS filing. This service is not legal advice, an attorney, or an immigration consultant. USCIS generally requires a complete English translation with a signed self-certification statement per 8 CFR 103.2(b)(3).',
    paymentTitle: 'Complete your order',
    paymentDisabled: 'Payment is disabled. Service is in test mode — download for free.',
    paymentPrice: 'Planned price after launch: $15 / document.',
    paymentContinue: 'Continue test without payment',
    download: 'Download Translation Draft (.html)',
    downloaded: '✓ Download started.',
    downloadedHint: 'Open in browser → File → Print → Save as PDF. Sign the certification block by hand before submitting.',
    downloadAgain: 'Download again',
    anotherDoc: '+ Another document',
    certWarn: 'Without a signed Certification Template, USCIS may reject your translation.',
    next1: 'Print all 4 files',
    next2: 'Sign the Certification Template — handwritten signature required',
    next3: 'Include signed template with translation draft and original document',
    next4: 'Mail the complete package to USCIS',
    nextTitle: 'What to do next:',
    fillRequired: 'Fill in all required fields (*) to continue.',
    fillConfirm: 'Check all three boxes to continue.',
    emailLabel: 'Send to your email',
    emailPlaceholder: 'your@email.com',
    emailBtn: 'Send to email',
    emailSending: 'Sending…',
    emailSent: '✓ Sent! Check your inbox.',
    emailError: 'Failed to send. Try again.',
    filesReady: 'Files are ready',
    enNotice: 'All files are in English as required by USCIS.',
    file1Label: 'Translation draft',
    file1Note: 'HTML · print/PDF',
    file2Label: 'Self-Certification Template',
    file2Note: 'HTML · you sign by hand ⚠',
    file3Label: 'Filing checklist',
    file3Note: 'HTML',
    file4Label: 'Filing instructions',
    file4Note: 'HTML',
    dlAll: 'Download all files',
    reviewAsk: 'Did this draft help you?',
    reviewBtn: 'Leave a review',
    priceBadge: 'Planned price after launch:',
    wyg1: 'Translation draft (HTML, printable)',
    wyg2: 'Self-Certification Template (you sign)',
    wyg3: 'USCIS filing checklist',
    wyg4: 'Filing instructions',
  },
  uk: {
    popular: 'Популярні документи',
    other: 'Інші документи',
    stepLang: 'Мова',
    stepFile: 'Файл',
    stepFields: 'Поля',
    stepReview: 'Перевірка',
    stepConfirm: 'Підтвердження',
    stepDownload: 'Завантаження',
    back: 'Назад',
    next: 'Продовжити',
    skip: 'Пропустити',
    langTitle: 'Яка мова вашого документа?',
    langTop3: 'Найпопулярніші',
    langOther: 'Інші мови:',
    uploadTitle: 'Завантажте документ — ШІ заповнить поля',
    uploadHint: 'Зробіть фото або завантажте скан — ШІ автоматично заповнить усі поля. Ви зможете перевірити та виправити перед завантаженням.',
    uploadCameraBtn: '📷 Зробити фото',
    uploadFileBtn: '📁 Завантажити файл',
    uploadSkip: 'Пропустити — ввести поля вручну',
    uploadRemove: 'Видалити',
    uploadSelected: 'Вибраний файл:',
    ocrAnalyzing: 'ШІ читає ваш документ…',
    ocrSuccess: 'полів заповнено автоматично',
    ocrNone: 'Не вдалось прочитати документ — заповніть вручну.',
    historyTitle: 'Нещодавні переклади',
    historyRedownload: 'Завантажити знову',
    historyDelete: 'Видалити',
    fieldsTitle: 'Введіть поля з вашого документа',
    fieldsHint: 'Копіюйте точно як написано. Поля зі * обов\'язкові.',
    grpPersonal: 'Особисті дані',
    grpDocument: 'Відомості про документ',
    grpAuthority: 'Орган видачі',
    whereToFind: 'Де знайти?',
    reviewTitle: 'Перевірте введені дані',
    reviewHint: 'Перевірте, що всі значення правильні перед завантаженням.',
    confirmTitle: 'Підтвердіть перед завантаженням',
    confirm1: 'Я є законним власником або уповноваженим представником',
    confirm2: 'Дані перевірені і відповідають оригіналу',
    confirm3: 'Я розумію, що це чернетка, а не нотаріально завірений переклад',
    disclaimer: 'Ця чернетка надається для самостійного заповнення форм USCIS. Сервіс не є юридичною консультацією, адвокатом або імміграційним консультантом. USCIS зазвичай вимагає повний переклад англійською з підписаним шаблоном самопідтвердження (8 CFR 103.2(b)(3)).',
    paymentTitle: 'Оформлення замовлення',
    paymentDisabled: 'Оплата вимкнена. Сервіс у тестовому режимі — скачайте безкоштовно.',
    paymentPrice: 'Запланована ціна після запуску: $15 / документ.',
    paymentContinue: 'Продовжити тест без оплати',
    download: 'Завантажити чернетку перекладу (.html)',
    downloaded: '✓ Завантаження розпочато.',
    downloadedHint: 'Відкрийте у браузері → Файл → Друк → Зберегти як PDF. Підпишіть блок підтвердження від руки.',
    downloadAgain: 'Завантажити ще раз',
    anotherDoc: '+ Ще один документ',
    certWarn: 'Без підписаного Шаблону підтвердження переклад можуть не прийняти в USCIS.',
    next1: 'Роздрукуйте всі 4 файли',
    next2: 'Підпишіть Шаблон підтвердження — від руки',
    next3: 'Вкладіть підписаний шаблон із чернеткою та оригіналом',
    next4: 'Відправте пакет до USCIS',
    nextTitle: 'Що робити далі:',
    fillRequired: 'Заповніть всі обов\'язкові поля (*) щоб продовжити.',
    fillConfirm: 'Позначте всі три пункти щоб продовжити.',
    emailLabel: 'Надіслати на пошту',
    emailPlaceholder: 'ваша@пошта.com',
    emailBtn: 'Надіслати на пошту',
    emailSending: 'Надсилаємо…',
    emailSent: '✓ Надіслано! Перевірте вхідні.',
    emailError: 'Помилка. Спробуйте ще раз.',
    filesReady: 'Файли готові',
    enNotice: 'Всі файли англійською відповідно до вимог USCIS.',
    file1Label: 'Чернетка перекладу',
    file1Note: 'HTML · друк/PDF',
    file2Label: 'Шаблон самопідтвердження',
    file2Note: 'HTML · ви підписуєте вручну ⚠',
    file3Label: 'Контрольний список',
    file3Note: 'HTML',
    file4Label: 'Інструкції з подання',
    file4Note: 'HTML',
    dlAll: 'Завантажити всі файли',
    reviewAsk: 'Ця чернетка вам допомогла?',
    reviewBtn: 'Залишити відгук',
    priceBadge: 'Запланована ціна після запуску:',
    wyg1: 'Чернетка перекладу (HTML, друкується)',
    wyg2: 'Шаблон самопідтвердження (ви підписуєте)',
    wyg3: 'Контрольний список для USCIS',
    wyg4: 'Інструкції з подання',
  },
  ru: {
    popular: 'Популярные документы',
    other: 'Другие документы',
    stepLang: 'Язык',
    stepFile: 'Файл',
    stepFields: 'Поля',
    stepReview: 'Проверка',
    stepConfirm: 'Подтверждение',
    stepDownload: 'Загрузка',
    back: 'Назад',
    next: 'Продолжить',
    skip: 'Пропустить',
    langTitle: 'На каком языке ваш документ?',
    langTop3: 'Наиболее популярные',
    langOther: 'Другие языки:',
    uploadTitle: 'Загрузите документ — ИИ заполнит поля',
    uploadHint: 'Сделайте фото или загрузите скан — ИИ автоматически заполнит все поля. Вы сможете проверить и исправить перед скачиванием.',
    uploadCameraBtn: '📷 Сделать фото',
    uploadFileBtn: '📁 Загрузить файл',
    uploadSkip: 'Пропустить — ввести поля вручную',
    uploadRemove: 'Удалить',
    uploadSelected: 'Выбранный файл:',
    ocrAnalyzing: 'ИИ читает ваш документ…',
    ocrSuccess: 'полей заполнено автоматически',
    ocrNone: 'Не удалось прочитать документ — заполните вручную.',
    historyTitle: 'Недавние переводы',
    historyRedownload: 'Скачать снова',
    historyDelete: 'Удалить',
    fieldsTitle: 'Введите поля из вашего документа',
    fieldsHint: 'Копируйте точно как написано. Поля со * обязательны.',
    grpPersonal: 'Личные данные',
    grpDocument: 'Сведения о документе',
    grpAuthority: 'Орган выдачи',
    whereToFind: 'Где найти?',
    reviewTitle: 'Проверьте введённые данные',
    reviewHint: 'Убедитесь, что все значения верны перед загрузкой.',
    confirmTitle: 'Подтвердите перед загрузкой',
    confirm1: 'Я являюсь законным владельцем или уполномоченным представителем',
    confirm2: 'Данные проверены и соответствуют оригиналу',
    confirm3: 'Я понимаю, что это черновик, а не нотариально заверенный перевод',
    disclaimer: 'Этот черновик предоставляется для самостоятельного заполнения форм USCIS. Сервис не является юридической консультацией, адвокатом или иммиграционным консультантом. USCIS обычно требует полный перевод на английский с подписанным шаблоном самоподтверждения (8 CFR 103.2(b)(3)).',
    paymentTitle: 'Оформление заказа',
    paymentDisabled: 'Оплата временно отключена. Сервис в тестовом режиме — скачайте бесплатно.',
    paymentPrice: 'Запланированная цена после запуска: $15 / документ.',
    paymentContinue: 'Продолжить тест без оплаты',
    download: 'Скачать черновик перевода (.html)',
    downloaded: '✓ Загрузка началась.',
    downloadedHint: 'Откройте в браузере → Файл → Печать → Сохранить как PDF. Подпишите блок подтверждения от руки.',
    downloadAgain: 'Скачать ещё раз',
    anotherDoc: '+ Ещё один документ',
    certWarn: 'Без подписанного Шаблона подтверждения перевод могут не принять в USCIS.',
    next1: 'Распечатайте все 4 файла',
    next2: 'Подпишите Шаблон подтверждения — от руки',
    next3: 'Вложите подписанный шаблон с черновиком и оригиналом',
    next4: 'Отправьте пакет в USCIS',
    nextTitle: 'Что делать дальше:',
    fillRequired: 'Заполните все обязательные поля (*) для продолжения.',
    fillConfirm: 'Отметьте все три пункта для продолжения.',
    emailLabel: 'Отправить на почту',
    emailPlaceholder: 'ваша@почта.com',
    emailBtn: 'Отправить на почту',
    emailSending: 'Отправляем…',
    emailSent: '✓ Отправлено! Проверьте входящие.',
    emailError: 'Ошибка. Попробуйте ещё раз.',
    filesReady: 'Файлы готовы',
    enNotice: 'Все файлы на английском согласно требованиям USCIS.',
    file1Label: 'Черновик перевода',
    file1Note: 'HTML · печать/PDF',
    file2Label: 'Шаблон самоподтверждения',
    file2Note: 'HTML · вы подписываете вручную ⚠',
    file3Label: 'Контрольный список',
    file3Note: 'HTML',
    file4Label: 'Инструкции по подаче',
    file4Note: 'HTML',
    dlAll: 'Скачать все файлы',
    reviewAsk: 'Этот черновик вам помог?',
    reviewBtn: 'Оставить отзыв',
    priceBadge: 'Запланированная цена после запуска:',
    wyg1: 'Черновик перевода (HTML, для печати)',
    wyg2: 'Шаблон самоподтверждения (вы подписываете)',
    wyg3: 'Контрольный список для USCIS',
    wyg4: 'Инструкции по подаче',
  },
  es: {
    popular: 'Documentos populares',
    other: 'Otros documentos',
    stepLang: 'Idioma',
    stepFile: 'Archivo',
    stepFields: 'Campos',
    stepReview: 'Revisión',
    stepConfirm: 'Confirmación',
    stepDownload: 'Descarga',
    back: 'Atrás',
    next: 'Continuar',
    skip: 'Omitir',
    langTitle: '¿En qué idioma está su documento?',
    langTop3: 'Más populares',
    langOther: 'Otros idiomas:',
    uploadTitle: 'Suba su documento — IA completará los campos',
    uploadHint: 'Tome una foto o suba un escaneo — la IA completará todos los campos automáticamente. Podrá revisar y corregir antes de descargar.',
    uploadCameraBtn: '📷 Tomar foto',
    uploadFileBtn: '📁 Subir archivo',
    uploadSkip: 'Omitir — ingresar campos manualmente',
    uploadRemove: 'Eliminar',
    uploadSelected: 'Archivo seleccionado:',
    ocrAnalyzing: 'IA está leyendo su documento…',
    ocrSuccess: 'campos completados automáticamente',
    ocrNone: 'No se pudo leer el documento — ingrese los campos manualmente.',
    historyTitle: 'Traducciones recientes',
    historyRedownload: 'Descargar de nuevo',
    historyDelete: 'Eliminar',
    fieldsTitle: 'Ingrese los campos de su documento',
    fieldsHint: 'Copie exactamente como está escrito. Los campos con * son obligatorios.',
    grpPersonal: 'Datos personales',
    grpDocument: 'Detalles del documento',
    grpAuthority: 'Autoridad emisora',
    whereToFind: '¿Dónde encontrar?',
    reviewTitle: 'Revise sus entradas',
    reviewHint: 'Verifique que todos los valores sean correctos antes de descargar.',
    confirmTitle: 'Confirmar antes de descargar',
    confirm1: 'Soy el propietario legal o representante autorizado de este documento',
    confirm2: 'Los datos han sido verificados y coinciden con el original',
    confirm3: 'Entiendo que esto es un borrador, no una traducción notariada',
    disclaimer: 'Este borrador se proporciona para el llenado de formularios USCIS por cuenta propia. Este servicio no es asesoramiento legal, abogado o consultor de inmigración. USCIS generalmente requiere una traducción completa al inglés con una declaración de auto-certificación firmada (8 CFR 103.2(b)(3)).',
    paymentTitle: 'Complete su pedido',
    paymentDisabled: 'Pago desactivado. Servicio en modo de prueba — descargue gratis.',
    paymentPrice: 'Precio planificado después del lanzamiento: $15 / documento.',
    paymentContinue: 'Continuar prueba sin pago',
    download: 'Descargar borrador de traducción (.html)',
    downloaded: '✓ Descarga iniciada.',
    downloadedHint: 'Abra en el navegador → Archivo → Imprimir → Guardar como PDF. Firme el bloque de certificación a mano.',
    downloadAgain: 'Descargar de nuevo',
    anotherDoc: '+ Otro documento',
    certWarn: 'Sin una Plantilla de certificación firmada, USCIS puede rechazar su traducción.',
    next1: 'Imprima los 4 archivos',
    next2: 'Firme la Plantilla de certificación — firma manuscrita requerida',
    next3: 'Incluya la plantilla firmada con el borrador y el documento original',
    next4: 'Envíe el paquete completo a USCIS',
    nextTitle: 'Qué hacer a continuación:',
    fillRequired: 'Complete todos los campos obligatorios (*) para continuar.',
    fillConfirm: 'Marque las tres casillas para continuar.',
    emailLabel: 'Enviar a su correo',
    emailPlaceholder: 'su@correo.com',
    emailBtn: 'Enviar por correo',
    emailSending: 'Enviando…',
    emailSent: '✓ ¡Enviado! Revise su bandeja de entrada.',
    emailError: 'Error al enviar. Inténtelo de nuevo.',
    filesReady: 'Archivos listos',
    enNotice: 'Todos los archivos están en inglés según los requisitos de USCIS.',
    file1Label: 'Borrador de traducción',
    file1Note: 'HTML · imprimir/PDF',
    file2Label: 'Plantilla de auto-certificación',
    file2Note: 'HTML · usted firma a mano ⚠',
    file3Label: 'Lista de verificación',
    file3Note: 'HTML',
    file4Label: 'Instrucciones de presentación',
    file4Note: 'HTML',
    dlAll: 'Descargar todos los archivos',
    reviewAsk: '¿Le ayudó este borrador?',
    reviewBtn: 'Dejar una reseña',
    priceBadge: 'Precio planificado después del lanzamiento:',
    wyg1: 'Borrador de traducción (HTML, imprimible)',
    wyg2: 'Plantilla de auto-certificación (usted firma)',
    wyg3: 'Lista de verificación para USCIS',
    wyg4: 'Instrucciones de presentación',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function t(locale: string, key: string): string {
  return (UI[locale] ?? UI.en)[key] ?? (UI.en[key] ?? key)
}

function origLabel(field: FieldDef, srcLang: string): string {
  return (field.orig as Record<string, string>)[srcLang] ?? field.orig.en ?? field.en
}

/** Format ISO date "YYYY-MM-DD" → "DD.MM.YYYY" for display; return as-is if not a date */
function formatFieldValue(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-')
    return `${d}.${m}.${y}`
  }
  return value
}

// ─── generateTranslationFiles removed — now using generateTranslationDoc() from generateTranslationHTML.ts ──

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _generateTranslationFiles_REMOVED(
  doc: DocDef,
  fieldValues: Record<string, string>,
  srcLang: SourceLang,
  targetLang: SourceLang = 'en',
  extraFields: FieldDef[] = [],
  eraNote?: string,
): [string, string, string, string] {
  const now = new Date().toLocaleDateString('en-US')
  const allLangs = [...LANGS_TOP3, ...LANGS_MORE, ...LANGS_TARGET_TOP, ...LANGS_TARGET_MORE]
  const srcLangLabel = allLangs.find((l) => l.id === srcLang)?.label ?? srcLang
  const targetLangLabel = allLangs.find((l) => l.id === targetLang)?.label ?? targetLang

  // Document title in target language; fall back to English
  const docLabelTarget = (doc.label as Record<string, string>)[targetLang] ?? doc.label.en ?? doc.id
  const docLabelSrc = (doc.label as Record<string, string>)[srcLang] ?? doc.label.en ?? doc.id

  const allFields = [...doc.fields, ...extraFields]
  const rows = allFields.map((f) => {
    const v = fieldValues[f.key] || ''
    // Field label in the source language (as it appears on the original document)
    const srcLabel = (f.orig as Record<string, string>)[srcLang] ?? f.orig.en ?? f.en
    // Field label in the target language (for the translated output column)
    const tgtLabel = (f.orig as Record<string, string>)[targetLang] ?? f.orig.en ?? f.en
    // Value in target language: transliterate Cyrillic → Latin only when target is English
    const tgtValue = (targetLang === 'en' && v && hasCyrillic(v))
      ? transliterateCyrillic(v)
      : v
    return `<tr>
      <td style="padding:6px 12px;border:1px solid #ddd;background:#f9f9f9;color:#555">${srcLabel}</td>
      <td style="padding:6px 12px;border:1px solid #ddd;background:#f9f9f9;font-weight:600">${v || '—'}</td>
      <td style="padding:6px 12px;border:1px solid #ddd;color:#555">${tgtLabel}</td>
      <td style="padding:6px 12px;border:1px solid #ddd;font-weight:700">${tgtValue || '—'}</td>
    </tr>`
  }).join('')

  const certStatement = getCertStatement(srcLangLabel, targetLangLabel, docLabelTarget, targetLang)

  const file1 = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Translation Draft — ${docLabelTarget}</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#111}h1{font-size:20px;margin-bottom:6px}table{border-collapse:collapse;width:100%;margin-top:16px}th{background:#1e40af;color:#fff;padding:8px 12px;text-align:left;font-size:13px}td{font-size:13px}@media print{body{margin:0;padding:10px}}</style>
</head><body>
<h1>TRANSLATION DRAFT — ${docLabelTarget.toUpperCase()}</h1>
<p style="font-size:13px;color:#555"><strong>Source:</strong> ${srcLangLabel} (${docLabelSrc}) &nbsp;→&nbsp; <strong>Target:</strong> ${targetLangLabel} (${docLabelTarget}) &nbsp;|&nbsp; <strong>Prepared:</strong> ${now}</p>
<p style="font-size:12px;background:#fef3c7;border:1px solid #f59e0b;padding:8px 12px;border-radius:4px">⚠ Self-prepared translation draft. A signed certification statement must accompany this document.</p>
${eraNote ? `<p style="font-size:12px;background:#eff6ff;border:1px solid #93c5fd;padding:8px 12px;border-radius:4px">📝 Translator note: ${eraNote}</p>` : ''}
<table><thead><tr><th>Field (${srcLangLabel})</th><th>${srcLangLabel} Value</th><th>Field (${targetLangLabel})</th><th>${targetLangLabel} Value</th></tr></thead><tbody>${rows}</tbody></table>
<p style="font-size:11px;color:#999;margin-top:20px">Generated by Messenginfo.com</p>
</body></html>`

  const applicantName = (fieldValues['full_name'] ?? fieldValues['child_name'] ?? '').trim()

  const file2 = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Self-Certification Template</title>
<style>body{font-family:Arial,sans-serif;max-width:750px;margin:40px auto;padding:20px;line-height:1.8;color:#111}h1{font-size:18px}.sig-line{border-top:2px solid #000;margin-top:44px;width:320px;padding-top:6px;font-size:12px;color:#555}@media print{body{margin:0;padding:10px}}</style>
</head><body>
<h1>TRANSLATOR SELF-CERTIFICATION STATEMENT</h1>
<p>${certStatement}</p>
<p>I understand that any false statements made herein are punishable by law (18 U.S.C. § 1001).</p>
<p><strong>Document type:</strong> ${docLabelTarget}<br>
<strong>Applicant:</strong> ${applicantName || '___________________________'}<br>
<strong>Date of certification:</strong> ${now}</p>
<div class="sig-line">Translator's Signature (HANDWRITTEN — do not type)</div>
<p style="margin-top:14px">Printed name: ___________________________<br>Date: ___________________________<br>Phone or email: ___________________________</p>
<p style="font-size:12px;color:#777;margin-top:28px;border-top:1px solid #eee;padding-top:10px">Per 8 CFR 103.2(b)(3). This service is not an attorney, notary, or immigration consultant.</p>
</body></html>`

  const file3 = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>USCIS Filing Checklist</title>
<style>body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;padding:20px;color:#111}h1{font-size:18px}.item{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #eee;align-items:flex-start}.box{width:20px;height:20px;border:2px solid #333;flex-shrink:0;border-radius:3px;margin-top:1px}@media print{body{margin:0;padding:10px}}</style>
</head><body>
<h1>USCIS FILING CHECKLIST — ${docLabelTarget.toUpperCase()}</h1>
<p style="font-size:13px;color:#555">Date: ${now}</p>
<div class="item"><div class="box"></div><div>Translation draft — printed, legible, all fields visible</div></div>
<div class="item"><div class="box"></div><div><strong>Certification statement — SIGNED BY HAND</strong> (date + printed name required)</div></div>
<div class="item"><div class="box"></div><div>Copy of original document attached (front and back if applicable)</div></div>
<div class="item"><div class="box"></div><div>Original document not cropped — all edges and text visible</div></div>
<div class="item"><div class="box"></div><div>All required fields on the main USCIS form completed</div></div>
<div class="item"><div class="box"></div><div>Correct USCIS filing fee included (check or money order payable to "U.S. Department of Homeland Security")</div></div>
<div class="item"><div class="box"></div><div>Return envelope or correct mailing address verified at uscis.gov/forms</div></div>
<p style="font-size:12px;color:#888;margin-top:20px;padding-top:12px;border-top:1px solid #eee">Translation templates built from official USCIS guidance. If USCIS requests corrections to the template format itself, report at messenginfo.com.</p>
</body></html>`

  const file4 = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Filing Instructions</title>
<style>body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;padding:20px;line-height:1.8;color:#111}h1{font-size:18px}h2{font-size:15px;color:#1e40af;margin-top:24px;border-bottom:2px solid #e0e7ff;padding-bottom:4px}@media print{body{margin:0;padding:10px}}</style>
</head><body>
<h1>FILING INSTRUCTIONS — ${docLabelTarget.toUpperCase()}</h1>
<p style="font-size:13px;color:#555">Prepared: ${now}</p>
<h2>Step 1 — Print all files</h2>
<p>Print all 4 documents on white paper, black ink, at 100% scale. Do not scale to fit — USCIS may reject reduced-size documents.</p>
<h2>Step 2 — Sign the certification statement</h2>
<p><strong>Handwrite</strong> your signature on the Translator Certification page. Add your printed name, the date, and your contact information. Electronic signatures are not accepted by USCIS.</p>
<h2>Step 3 — Assemble the packet</h2>
<p>Order: (1) Signed certification → (2) Translation draft → (3) Copy of original ${docLabelTarget}. Paperclip or staple supporting document groups separately — do not staple to the main USCIS form.</p>
<h2>Step 4 — Mail to USCIS</h2>
<p>Use USPS Priority Mail with tracking. Always verify the current USCIS lockbox address at <strong>uscis.gov/forms</strong> before mailing — addresses change by state and form type. Keep your tracking number.</p>
<h2>Template correction policy</h2>
<p>Translation templates are built from official USCIS guidance (8 CFR 103.2(b)(3)). If a USCIS officer returns your translation requesting corrections to the <em>template format itself</em> — not your personal data — report it at messenginfo.com.</p>
</body></html>`

  return [file1, file2, file3, file4]
}

function downloadHtmlFile(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Step indicator (6 steps) ─────────────────────────────────────────────────

function StepIndicator({ step, locale }: { step: number; locale: string }) {
  const steps = [
    t(locale, 'stepLang'),
    t(locale, 'stepFile'),
    t(locale, 'stepFields'),
    t(locale, 'stepReview'),
    t(locale, 'stepConfirm'),
    t(locale, 'stepDownload'),
  ]
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
      {steps.map((label, i) => {
        const idx = i + 1
        const done = step > idx
        const active = step === idx
        return (
          <div key={idx} className="flex items-center gap-1 flex-shrink-0">
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold transition-all
              ${done ? 'bg-green-500 text-white' : active ? 'bg-blue-600 text-white ring-2 ring-blue-200' : 'bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)]'}`}>
              {done ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="10" height="10"><polyline points="20 6 9 17 4 12" /></svg>
              ) : idx}
            </div>
            <span className={`text-[11px] font-semibold whitespace-nowrap
              ${done ? 'text-green-600' : active ? 'text-blue-600' : 'text-[var(--text-2)]'}`}>{label}</span>
            {i < steps.length - 1 && <div className={`w-4 h-0.5 mx-1 ${done ? 'bg-green-400' : 'bg-[var(--border)]'}`} />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Doc card ─────────────────────────────────────────────────────────────────

function DocCard({ doc, locale, selected, onSelect }: {
  doc: DocDef; locale: string
  selected: boolean; onSelect: () => void
}) {
  const label = (doc.label as Record<string, string>)[locale] ?? doc.label.en
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 text-center cursor-pointer transition-all duration-150 min-h-[132px]
        ${selected
          ? 'border-blue-600 bg-blue-50 shadow-md -translate-y-0.5'
          : 'border-[var(--border)] bg-[var(--surface-1)] hover:border-blue-400 hover:-translate-y-0.5 hover:shadow-md'}`}
    >
      {selected && (
        <span className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow z-10">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" width="10" height="10"><polyline points="20 6 9 17 4 12" /></svg>
        </span>
      )}
      <div className="w-16 h-[72px] rounded-[9px] flex items-center justify-center flex-shrink-0 relative overflow-hidden"
        style={{ background: doc.color }}>
        <div className="absolute inset-1.5 rounded-[5px] border border-white/20 bg-white/10" />
        <div className="absolute top-0 right-0 border-solid border-[0_12px_12px_0] border-[transparent_rgba(255,255,255,.22)_transparent_transparent]" />
        <span className="relative z-10 text-white" dangerouslySetInnerHTML={{ __html: doc.icon }} />
      </div>
      <span className="text-[14px] font-bold text-[var(--text-1)] leading-tight max-w-[110px] hyphens-auto word-break-all">{label}</span>
    </button>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

interface TranslationWizardProps {
  locale: string
  returnUrl?: string | null
  fromSource?: string | null
}

export function TranslationWizard({ locale, returnUrl, fromSource }: TranslationWizardProps) {
  const ui = UI[locale] ?? UI.en

  // Wizard state
  // steps: 0=DocGrid, 1=Lang, 2=Upload, 3=Fields, 4=Review, 5=Confirm, 6=Payment+Download
  const [step, setStep] = useState(0)
  const [docId, setDocId] = useState<string | null>(null)
  const [docEra, setDocEra] = useState<DocEra | null>(null)
  const [srcLang, setSrcLang] = useState<SourceLang>('uk')
  const [targetLang, setTargetLang] = useState<SourceLang>('en')
  const [showMoreTargetLangs, setShowMoreTargetLangs] = useState(false)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})

  // Smart target: if user picks same as source, flip to the opposite default
  useEffect(() => {
    if (srcLang === targetLang) {
      setTargetLang(srcLang === 'en' ? 'uk' : 'en')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcLang])

  // When era changes, initialize any new extra field keys to '' so they appear in the form
  useEffect(() => {
    const extraFields = doc?.eraVariants?.find((e) => e.id === docEra)?.extraFields ?? []
    if (extraFields.length > 0) {
      setFieldValues((prev) => {
        const patch: Record<string, string> = {}
        extraFields.forEach((f) => { if (!(f.key in prev)) patch[f.key] = '' })
        return Object.keys(patch).length > 0 ? { ...prev, ...patch } : prev
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docEra])
  const [checks, setChecks] = useState([false, false, false])
  const [downloaded, setDownloaded] = useState(false)
  const [generatedFiles, setGeneratedFiles] = useState<string[]>([])
  const [helpOpen, setHelpOpen] = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [showMoreLangs, setShowMoreLangs] = useState(false)

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // OCR state
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrFilledCount, setOcrFilledCount] = useState(0)

  // Order history (Stage 13D)
  const { history, saveEntry, removeEntry } = useTranslationHistory()

  const doc = DOCS.find((d) => d.id === docId)
  // Merge era extra fields (e.g. Soviet nationality field) when an era is selected
  const docEraObj: EraVariant | null = doc?.eraVariants?.find((e) => e.id === docEra) ?? null
  const fields: FieldDef[] = [
    ...(doc?.fields ?? []),
    ...(docEraObj?.extraFields ?? []),
  ]

  const requiredFilled = fields.filter((f) => f.required).every((f) => (fieldValues[f.key] ?? '').trim().length > 0)
  const allChecked = checks.every(Boolean)

  function selectDoc(id: string) {
    setDocId(id)
    setDocEra(null)
    const d = DOCS.find((x) => x.id === id)
    setFieldValues(Object.fromEntries((d?.fields ?? []).map((f) => [f.key, ''])))
    setChecks([false, false, false])
    setDownloaded(false)
    setUploadedFile(null)
    setUploadedPreview(null)
    setStep(1)
    window.scrollTo(0, 0)
  }

  function goBack() {
    if (step === 1) { setStep(0); setDocId(null); window.scrollTo(0, 0); return }
    setStep((s) => Math.max(0, s - 1))
    window.scrollTo(0, 0)
  }

  function goNext() {
    setStep((s) => s + 1)
    window.scrollTo(0, 0)
  }

  function handleFileSelect(file: File) {
    setUploadedFile(file)
    setOcrFilledCount(0)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setUploadedPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setUploadedPreview(null)
    }
  }

  /** Stage 13A: upload file → OCR API → pre-fill fieldValues → advance to Step 3 */
  async function handleOcrExtract(file: File) {
    setOcrLoading(true)
    try {
      // Convert file to base64 (strip data-URL prefix)
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const result = (e.target?.result as string) ?? ''
          resolve(result.includes(',') ? result.split(',')[1] : result)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const ocrType = docIdToOcrType(docId ?? '')
      const res = await fetch('/api/ocr/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_type: ocrType, image_base64: base64 }),
      })
      const data = (await res.json()) as {
        ok: boolean
        mode?: string
        extractedFields?: Record<string, string | null>
        confidence?: number
      }

      if (data.ok && data.extractedFields) {
        const newValues: Record<string, string> = {}
        let filled = 0
        for (const [ocrKey, ocrValue] of Object.entries(data.extractedFields)) {
          if (!ocrValue) continue
          const fieldKey = OCR_TO_FIELD[ocrKey]
          if (fieldKey) {
            newValues[fieldKey] = ocrValue
            filled++
          }
        }
        if (filled > 0) {
          setFieldValues((prev) => ({ ...prev, ...newValues }))
          setOcrFilledCount(filled)
        }
      }
    } catch {
      // Silent fail — user will fill manually
    } finally {
      setOcrLoading(false)
      goNext()
    }
  }

  function handleDownload() {
    if (!doc) return
    const files = generateTranslationDoc(doc, fields, fieldValues, srcLang, targetLang, docEraObj?.noteForTranslator)
    setGeneratedFiles(Array.from(files))
    // Download all 4 with stagger
    const names = ['translation-draft', 'translator-certification', 'uscis-checklist', 'filing-instructions']
    files.forEach((html, i) => {
      setTimeout(() => downloadHtmlFile(html, `${names[i]}.html`), i * 350)
    })
    setDownloaded(true)
    // Stage 13D: save to order history
    const docLabel = (doc.label as Record<string, string>)[locale] ?? doc.label.en
    saveEntry({ docId: doc.id, docLabel, srcLang, targetLang, docEra, fieldValues })
  }

  function handleDownloadSingle(idx: number) {
    const names = ['translation-draft', 'translator-certification', 'uscis-checklist', 'filing-instructions']
    const files = generatedFiles.length === 4 ? generatedFiles : (doc ? Array.from(generateTranslationDoc(doc, fields, fieldValues, srcLang, targetLang, docEraObj?.noteForTranslator)) : [])
    if (!files[idx]) return
    downloadHtmlFile(files[idx], `${names[idx]}.html`)
  }

  async function handleSendEmail() {
    if (!doc || !emailInput.trim() || emailSending || emailSent) return
    setEmailSending(true)
    setEmailError(null)
    try {
      const res = await fetch('/api/translation/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.trim(),
          prodId: doc.prodId,
          fieldValues,
          srcLang,
          docLabel: (doc.label as Record<string, string>)[locale] ?? doc.label.en,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setEmailSent(true)
      } else {
        setEmailError(data.error ?? ui.emailError)
      }
    } catch {
      setEmailError(ui.emailError)
    } finally {
      setEmailSending(false)
    }
  }

  function reset() {
    setStep(0); setDocId(null); setDocEra(null); setSrcLang('uk'); setTargetLang('en')
    setFieldValues({}); setChecks([false, false, false]); setDownloaded(false)
    setUploadedFile(null); setUploadedPreview(null)
    window.scrollTo(0, 0)
  }

  // Return banner
  const returnBannerText = fromSource === 're-parole-u4u'
    ? (locale === 'uk' ? 'Перекласти документ для заявки Re-Parole'
      : locale === 'ru' ? 'Перевести документ для заявки Re-Parole'
      : locale === 'es' ? 'Traducir un documento para su solicitud Re-Parole'
      : 'Translate a document for your Re-Parole application')
    : null
  const returnLabel = fromSource === 're-parole-u4u'
    ? (locale === 'uk' ? '← Re-Parole заявка'
      : locale === 'ru' ? '← Re-Parole заявка'
      : locale === 'es' ? '← Solicitud Re-Parole'
      : '← Back to Re-Parole')
    : (returnUrl ? '← Go back' : null)

  /** Stage 13D: Restore a history entry and fast-forward to Step 6 download */
  function reDownloadFromHistory(entry: (typeof history)[0]) {
    const d = DOCS.find((x) => x.id === entry.docId)
    if (!d) return
    setDocId(entry.docId)
    setDocEra(entry.docEra as DocEra | null)
    setSrcLang(entry.srcLang as SourceLang)
    setTargetLang(entry.targetLang as SourceLang)
    setFieldValues(entry.fieldValues)
    setChecks([true, true, true])
    setDownloaded(false)
    setGeneratedFiles([])
    setStep(6)
    window.scrollTo(0, 0)
  }

  // ── STEP 0: Document grid ──────────────────────────────────────────────────
  if (step === 0) {
    const popular = DOCS.filter((d) => d.popular)
    const other = DOCS.filter((d) => !d.popular)
    return (
      <div className="space-y-4">
        {returnUrl && returnLabel && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
            <ArrowLeft className="h-4 w-4 text-blue-700 shrink-0" />
            <p className="text-sm text-blue-800 flex-1">{returnBannerText}</p>
            <a href={returnUrl} className="text-sm font-semibold text-blue-700 hover:text-blue-900 whitespace-nowrap">{returnLabel}</a>
          </div>
        )}
        {/* Stage 13D: Recent translations history */}
        {history.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-5 shadow-sm">
            <p className="text-xs font-bold text-[var(--text-2)] uppercase tracking-wider mb-3">{ui.historyTitle}</p>
            <div className="flex flex-col gap-2">
              {history.map((entry) => {
                const savedDate = new Date(entry.savedAt).toLocaleDateString(locale === 'uk' ? 'uk-UA' : locale === 'ru' ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric' })
                const langFlag = [...LANGS_TOP3, ...LANGS_MORE].find((l) => l.id === entry.srcLang)?.flag ?? '🌐'
                return (
                  <div key={entry.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
                    <span className="text-xl shrink-0">{langFlag}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-[var(--text-1)] truncate">{entry.docLabel}</p>
                      <p className="text-[12px] text-[var(--text-2)]">{entry.srcLang.toUpperCase()} → {entry.targetLang.toUpperCase()} · {savedDate}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => reDownloadFromHistory(entry)}
                      className="text-[13px] font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap shrink-0 transition-colors">
                      {ui.historyRedownload}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.id)}
                      className="text-[12px] text-[var(--text-3)] hover:text-red-600 shrink-0 transition-colors ml-1">
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-5 shadow-sm">
          <p className="text-xs font-bold text-[var(--text-2)] uppercase tracking-wider mb-3">{ui.popular}</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {popular.map((d) => (
              <DocCard key={d.id} doc={d} locale={locale} selected={docId === d.id} onSelect={() => selectDoc(d.id)} />
            ))}
          </div>
          <p className="text-xs font-bold text-[var(--text-2)] uppercase tracking-wider mt-5 mb-3">{ui.other}</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {other.map((d) => (
              <DocCard key={d.id} doc={d} locale={locale} selected={docId === d.id} onSelect={() => selectDoc(d.id)} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── STEP 1: Source language ────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <StepIndicator step={1} locale={locale} />
        <button type="button" onClick={goBack} className="flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-blue-600 transition-colors">
          <ArrowLeft className="w-4 h-4" />{ui.back}
        </button>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-5 shadow-sm">

          {/* ── Era / Country selector (only for docs with era variants) ───── */}
          {doc?.eraVariants && doc.eraVariants.length > 0 && (
            <div className="mb-6 pb-5 border-b border-[var(--border)]">
              <p className="text-xs font-bold text-[var(--text-2)] uppercase tracking-wider mb-3">
                {locale === 'uk' ? 'Країна та період документа' : locale === 'ru' ? 'Страна и период документа' : 'Document country & period'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDocEra(null)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-[1.5px] text-[13px] font-semibold transition-all
                    ${!docEra ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-[var(--border)] text-[var(--text-1)] hover:border-blue-400'}`}>
                  🌐 {locale === 'uk' ? 'Будь-яка' : locale === 'ru' ? 'Любая' : 'Any'}
                </button>
                {doc.eraVariants.map((era) => (
                  <button
                    key={era.id}
                    type="button"
                    onClick={() => {
                      setDocEra(era.id)
                      setSrcLang(era.srcLang)
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-[1.5px] text-[13px] font-semibold transition-all
                      ${docEra === era.id ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-[var(--border)] text-[var(--text-1)] hover:border-blue-400'}`}>
                    <span>{era.flag}</span>
                    <span>{(era.label as Record<string, string>)[locale] ?? era.label.en}</span>
                  </button>
                ))}
              </div>
              {docEraObj?.noteForTranslator && (
                <div className="mt-3 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  📝 {docEraObj.noteForTranslator}
                </div>
              )}
            </div>
          )}

          <h2 className="text-xl font-bold text-[var(--text-1)] mb-5">{ui.langTitle}</h2>
          <p className="text-xs font-bold text-[var(--text-2)] uppercase tracking-wider mb-3">{ui.langTop3}</p>
          <div className="grid grid-cols-3 gap-2.5 mb-4">
            {LANGS_TOP3.map((l) => (
              <button key={l.id} type="button" onClick={() => setSrcLang(l.id)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-[1.5px] text-center cursor-pointer transition-all
                  ${srcLang === l.id ? 'border-blue-600 bg-blue-50' : 'border-[var(--border)] bg-[var(--surface-1)] hover:border-blue-400'}`}>
                <span className="text-2xl leading-none">{l.flag}</span>
                <span className="text-[13px] font-bold text-[var(--text-1)]">{l.label}</span>
                {srcLang === l.id && (
                  <span className="text-blue-600">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12" /></svg>
                  </span>
                )}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setShowMoreLangs(!showMoreLangs)}
            className="text-sm text-blue-600 font-medium flex items-center gap-1 mb-2">
            {ui.langOther} <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showMoreLangs ? 'rotate-90' : ''}`} />
          </button>
          {showMoreLangs && (
            <div className="flex flex-col gap-2 mt-2">
              {LANGS_MORE.map((l) => (
                <button key={l.id} type="button" onClick={() => setSrcLang(l.id as SourceLang)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border-[1.5px] transition-all
                    ${srcLang === l.id ? 'border-blue-600 bg-blue-50' : 'border-[var(--border)] bg-[var(--surface-1)] hover:border-blue-400'}`}>
                  <span className="text-xl">{l.flag}</span>
                  <span className="text-[14px] font-semibold text-[var(--text-1)]">{l.label}</span>
                  {srcLang === l.id && (
                    <span className="ml-auto text-blue-600">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12" /></svg>
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* ── Target language ──────────────────────────────────────── */}
          <div className="mt-6 pt-5 border-t border-[var(--border)]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">→</span>
              <p className="text-xs font-bold text-[var(--text-2)] uppercase tracking-wider">
                {locale === 'uk' ? 'Перекласти на:' : locale === 'ru' ? 'Перевести на:' : 'Translate to:'}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2.5 mb-3">
              {LANGS_TARGET_TOP.map((l) => {
                const isDisabled = l.id === srcLang
                return (
                  <button key={l.id} type="button"
                    onClick={() => !isDisabled && setTargetLang(l.id)}
                    disabled={isDisabled}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-[1.5px] text-center transition-all
                      ${isDisabled ? 'opacity-30 cursor-not-allowed border-[var(--border)] bg-[var(--surface-2)]'
                        : targetLang === l.id
                          ? 'border-green-600 bg-green-50'
                          : 'border-[var(--border)] bg-[var(--surface-1)] hover:border-green-400 cursor-pointer'}`}>
                    <span className="text-2xl leading-none">{l.flag}</span>
                    <span className="text-[13px] font-bold text-[var(--text-1)]">{l.label}</span>
                    {targetLang === l.id && !isDisabled && (
                      <span className="text-green-600">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12" /></svg>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <button type="button" onClick={() => setShowMoreTargetLangs(!showMoreTargetLangs)}
              className="text-sm text-green-700 font-medium flex items-center gap-1 mb-2">
              {locale === 'uk' ? 'Інші мови' : locale === 'ru' ? 'Другие языки' : 'More languages'} <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showMoreTargetLangs ? 'rotate-90' : ''}`} />
            </button>
            {showMoreTargetLangs && (
              <div className="flex flex-col gap-2 mt-2">
                {LANGS_TARGET_MORE.map((l) => {
                  const isDisabled = l.id === srcLang
                  return (
                    <button key={l.id} type="button"
                      onClick={() => !isDisabled && setTargetLang(l.id as SourceLang)}
                      disabled={isDisabled}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border-[1.5px] transition-all
                        ${isDisabled ? 'opacity-30 cursor-not-allowed border-[var(--border)]'
                          : targetLang === l.id
                            ? 'border-green-600 bg-green-50'
                            : 'border-[var(--border)] bg-[var(--surface-1)] hover:border-green-400'}`}>
                      <span className="text-xl">{l.flag}</span>
                      <span className="text-[14px] font-semibold text-[var(--text-1)]">{l.label}</span>
                      {targetLang === l.id && !isDisabled && (
                        <span className="ml-auto text-green-600">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12" /></svg>
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Direction summary pill */}
        <div className="flex items-center justify-center gap-3 py-2 px-4 rounded-xl bg-blue-50 border border-blue-200 text-sm font-semibold text-blue-800">
          <span>{[...LANGS_TOP3, ...LANGS_MORE].find((l) => l.id === srcLang)?.flag ?? '🌐'} {[...LANGS_TOP3, ...LANGS_MORE].find((l) => l.id === srcLang)?.label ?? srcLang}</span>
          <span>→</span>
          <span>{LANGS_TARGET_TOP.find((l) => l.id === targetLang)?.flag ?? LANGS_TARGET_MORE.find((l) => l.id === targetLang)?.flag ?? '🌐'} {LANGS_TARGET_TOP.find((l) => l.id === targetLang)?.label ?? LANGS_TARGET_MORE.find((l) => l.id === targetLang)?.label ?? targetLang}</span>
        </div>

        <button type="button" onClick={goNext}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors">
          {ui.next}
        </button>
      </div>
    )
  }

  // ── STEP 2: Upload ─────────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <StepIndicator step={2} locale={locale} />
        <button type="button" onClick={goBack} className="flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-blue-600 transition-colors">
          <ArrowLeft className="w-4 h-4" />{ui.back}
        </button>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-5 shadow-sm">
          <h2 className="text-xl font-bold text-[var(--text-1)] mb-1">{ui.uploadTitle}</h2>
          <p className="text-sm text-[var(--text-2)] mb-5">{ui.uploadHint}</p>

          {/* Hidden file inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*,.pdf,.heic"
            capture="environment"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.heic"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
          />

          {!uploadedFile ? (
            <div className="flex flex-col gap-3">
              {/* Camera button */}
              <button type="button" onClick={() => cameraInputRef.current?.click()}
                className="flex items-center gap-3 w-full rounded-xl border-[1.5px] border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 hover:border-blue-400 transition-all text-left">
                <span className="text-3xl leading-none">📷</span>
                <div>
                  <p className="text-[14px] font-bold text-[var(--text-1)]">{ui.uploadCameraBtn}</p>
                  <p className="text-[12px] text-[var(--text-2)]">JPG, PNG, HEIC</p>
                </div>
              </button>
              {/* File picker button */}
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-3 w-full rounded-xl border-[1.5px] border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 hover:border-blue-400 transition-all text-left">
                <span className="text-3xl leading-none">📁</span>
                <div>
                  <p className="text-[14px] font-bold text-[var(--text-1)]">{ui.uploadFileBtn}</p>
                  <p className="text-[12px] text-[var(--text-2)]">JPG, PNG, PDF, HEIC · max 10 MB</p>
                </div>
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              {uploadedPreview ? (
                <img src={uploadedPreview} alt="document preview" className="w-full max-h-48 object-contain rounded-lg mb-3" />
              ) : (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">📄</span>
                  <span className="text-sm font-semibold text-[var(--text-1)] truncate">{uploadedFile.name}</span>
                </div>
              )}
              <p className="text-xs text-green-700 mb-2">
                <span className="font-bold">{ui.uploadSelected}</span> {uploadedFile.name}
              </p>
              <button type="button" onClick={() => { setUploadedFile(null); setUploadedPreview(null) }}
                className="text-xs text-red-600 hover:text-red-800 font-medium transition-colors">
                {ui.uploadRemove}
              </button>
            </div>
          )}
        </div>

        {/* Skip or Continue (with OCR) */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={ocrLoading}
            onClick={() => uploadedFile ? handleOcrExtract(uploadedFile) : goNext()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {ocrLoading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {ui.ocrAnalyzing}
              </>
            ) : (
              <>{uploadedFile ? ui.next : ui.uploadSkip} →</>
            )}
          </button>
        </div>
      </div>
    )
  }

  // ── STEP 3: Fields ─────────────────────────────────────────────────────────
  if (step === 3) {
    const groups: { id: Group; label: string }[] = [
      { id: 'personal', label: ui.grpPersonal },
      { id: 'document', label: ui.grpDocument },
      { id: 'authority', label: ui.grpAuthority },
    ]
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <StepIndicator step={3} locale={locale} />
        <button type="button" onClick={goBack} className="flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-blue-600 transition-colors">
          <ArrowLeft className="w-4 h-4" />{ui.back}
        </button>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-5 shadow-sm">
          <h2 className="text-xl font-bold text-[var(--text-1)] mb-1">{ui.fieldsTitle}</h2>
          <p className="text-sm text-[var(--text-2)] mb-3">{ui.fieldsHint}</p>

          {/* OCR auto-fill banner */}
          {ocrFilledCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 mb-5">
              <span className="text-xl">✨</span>
              <p className="text-sm font-semibold text-emerald-800">
                <span className="text-emerald-600 font-bold">{ocrFilledCount}</span> {ui.ocrSuccess}
              </p>
            </div>
          )}

          {groups.map(({ id: grp, label: grpLabel }) => {
            const grpFields = fields.filter((f) => (f.group ?? inferGroup(f.key)) === grp)
            if (grpFields.length === 0) return null
            return (
              <div key={grp} className="mb-6">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider pb-2 border-b-2 border-blue-200 mb-4">
                  {grpLabel}
                </p>
                <div className="flex flex-col gap-4">
                  {grpFields.map((field) => (
                    <div key={field.key} className="flex flex-col gap-1.5">
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-bold text-[var(--text-1)]">
                          {origLabel(field, srcLang)}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                          <span className="ml-1.5 text-[12px] font-normal text-[var(--text-2)]">/ {field.en}</span>
                        </span>
                      </label>

                      {/* Radio → chips */}
                      {field.type === 'radio' && field.options ? (
                        <div className="flex gap-2 flex-wrap">
                          {field.options.map((opt) => {
                            const optLabel = opt.label[srcLang] ?? opt.label.en
                            const selected = fieldValues[field.key] === opt.val
                            return (
                              <button
                                key={opt.val}
                                type="button"
                                onClick={() => setFieldValues((v) => ({ ...v, [field.key]: opt.val }))}
                                className={`px-4 py-2 rounded-full border-[1.5px] text-[14px] font-semibold transition-all
                                  ${selected
                                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                                    : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-1)] hover:border-blue-400'}`}
                              >
                                {selected && <span className="mr-1.5">✓</span>}{optLabel}
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        /* Text / date input */
                        <input
                          type={field.type === 'date' ? 'date' : 'text'}
                          value={fieldValues[field.key] ?? ''}
                          onChange={(e) => setFieldValues((v) => ({ ...v, [field.key]: e.target.value }))}
                          // Always use English (Latin) placeholder — guides users to enter transliterated values
                          placeholder={field.placeholder?.en ?? field.placeholder?.[srcLang] ?? ''}
                          className="w-full px-3.5 py-3 border-[1.5px] border-[var(--border)] rounded-lg bg-[var(--surface-1)] text-[15px] text-[var(--text-1)] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-[var(--text-2)]"
                        />
                      )}

                      {field.helpExample && (
                        <div>
                          <button type="button" onClick={() => setHelpOpen(helpOpen === field.key ? null : field.key)}
                            className="text-[12px] text-blue-600 flex items-center gap-1">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            {ui.whereToFind}
                          </button>
                          {helpOpen === field.key && (
                            <div className="mt-1.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-[12px] text-blue-800">
                              {field.helpExample[srcLang] ?? field.helpExample.en}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        {!requiredFilled && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 border border-amber-200">{ui.fillRequired}</p>
        )}
        <button type="button" onClick={goNext} disabled={!requiredFilled}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed">
          {ui.next}
        </button>
      </div>
    )
  }

  // ── STEP 4: Review ─────────────────────────────────────────────────────────
  if (step === 4) {
    const srcFlag = [...LANGS_TOP3, ...LANGS_MORE].find((l) => l.id === srcLang)?.flag ?? '🌐'
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <StepIndicator step={4} locale={locale} />
        <button type="button" onClick={goBack} className="flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-blue-600 transition-colors">
          <ArrowLeft className="w-4 h-4" />{ui.back}
        </button>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-5 shadow-sm">
          <h2 className="text-xl font-bold text-[var(--text-1)] mb-1">{ui.reviewTitle}</h2>
          <p className="text-sm text-[var(--text-2)] mb-5">{ui.reviewHint}</p>
          <div className="flex flex-col gap-3">
            {fields.filter((f) => (fieldValues[f.key] ?? '').trim()).map((field) => (
              <div key={field.key} className="rounded-xl border border-[var(--border)] overflow-hidden">
                <div className="px-3.5 py-2 bg-[var(--surface-2)] border-b border-[var(--border)] flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--text-2)]">{srcFlag} {origLabel(field, srcLang)}</span>
                  <ChevronRight className="w-3 h-3 text-[var(--text-2)]" />
                  <span className="text-xs font-bold text-blue-600">{field.en}</span>
                </div>
                <div className="px-3.5 py-2.5">
                  <p className="text-[15px] font-semibold text-[var(--text-1)]">{formatFieldValue(fieldValues[field.key] ?? '')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <button type="button" onClick={goNext}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors">
          {ui.next}
        </button>
      </div>
    )
  }

  // ── STEP 5: Confirm ────────────────────────────────────────────────────────
  if (step === 5) {
    const confirmTexts = [ui.confirm1, ui.confirm2, ui.confirm3]
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <StepIndicator step={5} locale={locale} />
        <button type="button" onClick={goBack} className="flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-blue-600 transition-colors">
          <ArrowLeft className="w-4 h-4" />{ui.back}
        </button>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-5 shadow-sm">
          <h2 className="text-xl font-bold text-[var(--text-1)] mb-4">{ui.confirmTitle}</h2>
          <div className="flex flex-col gap-3 mb-5">
            {confirmTexts.map((text, i) => (
              <label key={i} className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={checks[i]}
                  onChange={(e) => setChecks((prev) => { const n = [...prev]; n[i] = e.target.checked; return n })}
                  className="mt-0.5 h-4 w-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm leading-relaxed text-[var(--text-1)]">{text}</span>
              </label>
            ))}
          </div>
          <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm font-medium text-amber-800">
            {ui.disclaimer}
          </p>
        </div>
        {!allChecked && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 border border-amber-200">{ui.fillConfirm}</p>
        )}
        <button type="button" onClick={goNext} disabled={!allChecked}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed">
          {ui.next}
        </button>
      </div>
    )
  }

  // ── STEP 6: Payment placeholder + Download ─────────────────────────────────
  if (step === 6) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <StepIndicator step={6} locale={locale} />
        {!downloaded && (
          <button type="button" onClick={goBack} className="flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-blue-600 transition-colors">
            <ArrowLeft className="w-4 h-4" />{ui.back}
          </button>
        )}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-5 shadow-sm">
          <h2 className="text-xl font-bold text-[var(--text-1)] mb-4">{ui.paymentTitle}</h2>

          {!downloaded ? (
            <>
              {/* Price card */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[13px] text-[var(--text-2)] mb-0.5">
                      {[...LANGS_TOP3, ...LANGS_MORE].find((l) => l.id === srcLang)?.flag ?? '🌐'}
                      {' '}→ EN · {(doc?.label as Record<string, string> | undefined)?.[locale] ?? doc?.label.en}
                    </p>
                    <p className="text-[11px] text-[var(--text-3)]">{ui.priceBadge} $15</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] text-[var(--text-2)] line-through">$15.00</p>
                    <p className="text-[16px] font-bold text-green-600">FREE</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {([ui.wyg1, ui.wyg2, ui.wyg3, ui.wyg4] as string[]).map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-[13px] text-[var(--text-2)]">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14" className="text-green-500 shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* Test mode banner */}
              <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border)] px-4 py-3 mb-4">
                <p className="text-[13px] text-[var(--text-2)]">🧪 {ui.paymentDisabled}</p>
              </div>

              <button type="button" onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors">
                <Download className="h-5 w-5" />
                {ui.paymentContinue}
              </button>
            </>
          ) : (
            <div className="space-y-4">
              {/* Success header */}
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-center">
                <p className="text-[15px] font-bold text-green-800">✅ {ui.filesReady}</p>
              </div>

              {/* USCIS English notice */}
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-[12px] text-blue-700 text-center">
                {ui.enNotice}
              </div>

              {/* 4 file items */}
              <div className="flex flex-col gap-2">
                {[
                  { label: ui.file1Label, note: ui.file1Note, warn: false },
                  { label: ui.file2Label, note: ui.file2Note, warn: true },
                  { label: ui.file3Label, note: ui.file3Note, warn: false },
                  { label: ui.file4Label, note: ui.file4Note, warn: false },
                ].map((f, i) => (
                  <button key={i} type="button" onClick={() => handleDownloadSingle(i)}
                    className={`flex items-center gap-3 w-full rounded-xl border px-4 py-3 text-left transition-all hover:shadow-sm active:scale-[.98]
                      ${f.warn ? 'border-amber-300 bg-amber-50 hover:bg-amber-100' : 'border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-1)]'}`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${f.warn ? 'bg-amber-200 text-amber-800' : 'bg-blue-100 text-blue-700'}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[14px] font-bold ${f.warn ? 'text-amber-800' : 'text-[var(--text-1)]'}`}>{f.label}</p>
                      <p className={`text-[12px] ${f.warn ? 'text-amber-600' : 'text-[var(--text-2)]'}`}>{f.note}</p>
                    </div>
                    <div className={`shrink-0 ${f.warn ? 'text-amber-600' : 'text-blue-500'}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </div>
                  </button>
                ))}
              </div>

              {/* Download all */}
              <button type="button" onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-blue-600 text-blue-600 px-5 py-2.5 text-[14px] font-bold hover:bg-blue-50 transition-colors">
                <Download className="h-4 w-4" />{ui.dlAll}
              </button>

              {/* Next steps */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                <p className="text-[13px] font-bold text-[var(--text-1)] mb-3">{ui.nextTitle}</p>
                <div className="flex flex-col gap-2">
                  {[ui.next1, ui.next2, ui.next3, ui.next4].map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                      <p className="text-[13px] text-[var(--text-2)] leading-relaxed pt-0.5">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cert warning */}
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
                <p className="text-[13px] font-bold text-amber-800">⚠ {ui.certWarn}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 flex-wrap">
                <button type="button" onClick={reset}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-1)] transition-colors">
                  {ui.anotherDoc}
                </button>
                {returnUrl && returnLabel && (
                  <a href={returnUrl}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
                    <ArrowLeft className="h-4 w-4" />{returnLabel}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
