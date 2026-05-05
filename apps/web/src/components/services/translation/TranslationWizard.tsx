'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Download, ChevronRight } from 'lucide-react'
import { downloadTranslationTemplate } from '@/lib/translation/generateTranslationHTML'

// ─── Types ────────────────────────────────────────────────────────────────────

type DocId =
  | 'passport' | 'birth_cert' | 'marriage_cert' | 'divorce_cert'
  | 'diploma' | 'driving_license' | 'military_id' | 'medical_record'

type SourceLang = 'uk' | 'ru' | 'es' | 'pl' | 'de' | 'fr' | 'ar' | 'zh' | 'ko' | 'pt' | 'en'

type Group = 'personal' | 'document' | 'authority'

interface FieldDef {
  key: string
  en: string
  orig: Record<string, string>
  required: boolean
  type?: 'text' | 'date' | 'radio'
  group: Group
  options?: { val: string; label: Record<string, string> }[]
  helpExample?: Record<string, string>
  placeholder?: Record<string, string>
}

interface DocDef {
  id: DocId
  popular: boolean
  label: Record<string, string>
  icon: string
  color: string
  prodId: string
  fields: FieldDef[]
}

// ─── Source languages ─────────────────────────────────────────────────────────

const LANGS_TOP3: { id: SourceLang; label: string; flag: string }[] = [
  { id: 'uk', label: 'Українська', flag: '🇺🇦' },
  { id: 'ru', label: 'Русский', flag: '🇷🇺' },
  { id: 'es', label: 'Español', flag: '🇪🇸' },
]
const LANGS_MORE: { id: SourceLang; label: string; flag: string }[] = [
  { id: 'pl', label: 'Polski', flag: '🇵🇱' },
  { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { id: 'fr', label: 'Français', flag: '🇫🇷' },
  { id: 'ar', label: 'العربية', flag: '🇸🇦' },
  { id: 'zh', label: '中文', flag: '🇨🇳' },
  { id: 'ko', label: '한국어', flag: '🇰🇷' },
  { id: 'pt', label: 'Português', flag: '🇧🇷' },
]

// ─── Document definitions ─────────────────────────────────────────────────────

const DOCS: DocDef[] = [
  {
    id: 'passport', popular: true, prodId: 'passport',
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
    id: 'medical_record', popular: false, prodId: 'other-document',
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
]

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
    uploadTitle: 'Upload your document (optional)',
    uploadHint: 'Photo or scan — used for reference only. Not required to download.',
    uploadCameraBtn: '📷 Take photo',
    uploadFileBtn: '📁 Upload file',
    uploadSkip: 'Skip — enter fields manually',
    uploadRemove: 'Remove',
    uploadSelected: 'File selected:',
    fieldsTitle: 'Enter fields from your document',
    fieldsHint: 'Copy exactly as written. Fields marked * are required.',
    grpPersonal: 'Personal information',
    grpDocument: 'Document details',
    grpAuthority: 'Issuing authority',
    whereToFind: 'Where to find?',
    reviewTitle: 'Review your entries',
    reviewHint: 'Check that all values are correct before downloading.',
    confirmTitle: 'Confirm before downloading',
    confirm1: 'I entered the fields from my actual document — not from memory.',
    confirm2: 'I understand this is a draft template. I will complete the certification block and sign it myself.',
    confirm3: 'I understand Messenginfo does not certify translations. I am the translator of record.',
    disclaimer: '⚠ AI draft only. Messenginfo does not certify translations. You review, complete the certification block, and sign it yourself before submitting to USCIS (8 CFR 103.2(b)(3)).',
    paymentTitle: 'Complete your order',
    paymentDisabled: 'Payment is currently disabled in this prototype.',
    paymentPrice: 'Planned price after launch: $15 / document.',
    paymentContinue: 'Continue without payment (test mode)',
    download: 'Download Translation Draft (.html)',
    downloaded: '✓ Download started.',
    downloadedHint: 'Open in browser → File → Print → Save as PDF. Sign the certification block by hand before submitting.',
    downloadAgain: 'Download again',
    anotherDoc: '← Translate another document',
    certWarn: 'Without a signed certification template, USCIS may reject your translation.',
    next1: 'Print all files',
    next2: 'Sign the Certification Template — handwritten signature required',
    next3: 'Include signed template with translation draft and original document',
    next4: 'Mail the complete package to USCIS',
    fillRequired: 'Fill in all required fields (*) to continue.',
    fillConfirm: 'Check all three boxes to continue.',
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
    uploadTitle: 'Завантажте документ (опційно)',
    uploadHint: 'Фото або скан — тільки для довідки. Не обов\'язково для завантаження.',
    uploadCameraBtn: '📷 Зробити фото',
    uploadFileBtn: '📁 Завантажити файл',
    uploadSkip: 'Пропустити — ввести поля вручну',
    uploadRemove: 'Видалити',
    uploadSelected: 'Вибраний файл:',
    fieldsTitle: 'Введіть поля з вашого документа',
    fieldsHint: 'Копіюйте точно як написано. Поля зі * обов\'язкові.',
    grpPersonal: 'Особисті дані',
    grpDocument: 'Відомості про документ',
    grpAuthority: 'Орган видачі',
    whereToFind: 'Де знайти?',
    reviewTitle: 'Перевірте введені дані',
    reviewHint: 'Перевірте, що всі значення правильні перед завантаженням.',
    confirmTitle: 'Підтвердіть перед завантаженням',
    confirm1: 'Я ввів(ла) поля з оригінального документа — не по пам\'яті.',
    confirm2: 'Я розумію, що це чернетка. Я самостійно заповню блок підтвердження і підпишу.',
    confirm3: 'Я розумію, що Messenginfo не засвідчує переклади. Я є перекладачем відповідно до запису.',
    disclaimer: '⚠ Лише чернетка. Messenginfo не засвідчує переклади. Ви самостійно перевіряєте, заповнюєте блок підтвердження та підписуєте перед подачею до USCIS (8 CFR 103.2(b)(3)).',
    paymentTitle: 'Оформлення замовлення',
    paymentDisabled: 'Оплата наразі вимкнена в цьому прототипі.',
    paymentPrice: 'Планова ціна після запуску: $15 / документ.',
    paymentContinue: 'Продовжити без оплати (тестовий режим)',
    download: 'Завантажити чернетку перекладу (.html)',
    downloaded: '✓ Завантаження розпочато.',
    downloadedHint: 'Відкрийте у браузері → Файл → Друк → Зберегти як PDF. Підпишіть блок підтвердження від руки.',
    downloadAgain: 'Завантажити ще раз',
    anotherDoc: '← Перекласти інший документ',
    certWarn: 'Без підписаного шаблону підтвердження USCIS може відхилити ваш переклад.',
    next1: 'Роздрукуйте всі файли',
    next2: 'Підпишіть шаблон підтвердження — від руки',
    next3: 'Додайте підписаний шаблон разом із чернеткою та оригіналом',
    next4: 'Відправте пакет документів до USCIS',
    fillRequired: 'Заповніть всі обов\'язкові поля (*) щоб продовжити.',
    fillConfirm: 'Позначте всі три пункти щоб продовжити.',
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
    uploadTitle: 'Загрузите документ (необязательно)',
    uploadHint: 'Фото или скан — только для справки. Не обязательно для загрузки.',
    uploadCameraBtn: '📷 Сделать фото',
    uploadFileBtn: '📁 Загрузить файл',
    uploadSkip: 'Пропустить — ввести поля вручную',
    uploadRemove: 'Удалить',
    uploadSelected: 'Выбранный файл:',
    fieldsTitle: 'Введите поля из вашего документа',
    fieldsHint: 'Копируйте точно как написано. Поля со * обязательны.',
    grpPersonal: 'Личные данные',
    grpDocument: 'Сведения о документе',
    grpAuthority: 'Орган выдачи',
    whereToFind: 'Где найти?',
    reviewTitle: 'Проверьте введённые данные',
    reviewHint: 'Убедитесь, что все значения верны перед загрузкой.',
    confirmTitle: 'Подтвердите перед загрузкой',
    confirm1: 'Я ввёл(а) поля из оригинального документа — не по памяти.',
    confirm2: 'Я понимаю, что это черновик. Я самостоятельно заполню блок подтверждения и подпишу.',
    confirm3: 'Я понимаю, что Messenginfo не заверяет переводы. Я являюсь переводчиком по записи.',
    disclaimer: '⚠ Только черновик. Messenginfo не заверяет переводы. Вы самостоятельно проверяете, заполняете блок подтверждения и подписываете перед подачей в USCIS (8 CFR 103.2(b)(3)).',
    paymentTitle: 'Оформление заказа',
    paymentDisabled: 'Оплата временно отключена в этом прототипе.',
    paymentPrice: 'Плановая цена после запуска: $15 / документ.',
    paymentContinue: 'Продолжить без оплаты (тестовый режим)',
    download: 'Скачать черновик перевода (.html)',
    downloaded: '✓ Загрузка началась.',
    downloadedHint: 'Откройте в браузере → Файл → Печать → Сохранить как PDF. Подпишите блок подтверждения от руки.',
    downloadAgain: 'Скачать ещё раз',
    anotherDoc: '← Перевести другой документ',
    certWarn: 'Без подписанного шаблона подтверждения USCIS может отклонить ваш перевод.',
    next1: 'Распечатайте все файлы',
    next2: 'Подпишите шаблон подтверждения — от руки',
    next3: 'Вложите подписанный шаблон вместе с черновиком и оригиналом',
    next4: 'Отправьте пакет документов в USCIS',
    fillRequired: 'Заполните все обязательные поля (*) для продолжения.',
    fillConfirm: 'Отметьте все три пункта для продолжения.',
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
    uploadTitle: 'Suba su documento (opcional)',
    uploadHint: 'Foto o escaneo — solo de referencia. No es necesario para descargar.',
    uploadCameraBtn: '📷 Tomar foto',
    uploadFileBtn: '📁 Subir archivo',
    uploadSkip: 'Omitir — ingresar campos manualmente',
    uploadRemove: 'Eliminar',
    uploadSelected: 'Archivo seleccionado:',
    fieldsTitle: 'Ingrese los campos de su documento',
    fieldsHint: 'Copie exactamente como está escrito. Los campos con * son obligatorios.',
    grpPersonal: 'Datos personales',
    grpDocument: 'Detalles del documento',
    grpAuthority: 'Autoridad emisora',
    whereToFind: '¿Dónde encontrar?',
    reviewTitle: 'Revise sus entradas',
    reviewHint: 'Verifique que todos los valores sean correctos antes de descargar.',
    confirmTitle: 'Confirmar antes de descargar',
    confirm1: 'Ingresé los campos de mi documento real — no de memoria.',
    confirm2: 'Entiendo que esto es un borrador. Completaré el bloque de certificación y lo firmaré yo mismo.',
    confirm3: 'Entiendo que Messenginfo no certifica traducciones. Yo soy el traductor de registro.',
    disclaimer: '⚠ Solo borrador. Messenginfo no certifica traducciones. Usted revisa, completa el bloque de certificación y lo firma antes de presentar a USCIS (8 CFR 103.2(b)(3)).',
    paymentTitle: 'Complete su pedido',
    paymentDisabled: 'El pago está actualmente deshabilitado en este prototipo.',
    paymentPrice: 'Precio planificado después del lanzamiento: $15 / documento.',
    paymentContinue: 'Continuar sin pago (modo de prueba)',
    download: 'Descargar borrador de traducción (.html)',
    downloaded: '✓ Descarga iniciada.',
    downloadedHint: 'Abra en el navegador → Archivo → Imprimir → Guardar como PDF. Firme el bloque de certificación a mano.',
    downloadAgain: 'Descargar de nuevo',
    anotherDoc: '← Traducir otro documento',
    certWarn: 'Sin una plantilla de certificación firmada, USCIS puede rechazar su traducción.',
    next1: 'Imprima todos los archivos',
    next2: 'Firme la plantilla de certificación — firma manuscrita requerida',
    next3: 'Incluya la plantilla firmada con el borrador y el documento original',
    next4: 'Envíe el paquete completo a USCIS',
    fillRequired: 'Complete todos los campos obligatorios (*) para continuar.',
    fillConfirm: 'Marque las tres casillas para continuar.',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function t(locale: string, key: string): string {
  return (UI[locale] ?? UI.en)[key] ?? (UI.en[key] ?? key)
}

function origLabel(field: FieldDef, srcLang: string): string {
  return field.orig[srcLang] ?? field.orig.en ?? field.en
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
  const label = doc.label[locale] ?? doc.label.en
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
  const [docId, setDocId] = useState<DocId | null>(null)
  const [srcLang, setSrcLang] = useState<SourceLang>('uk')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [checks, setChecks] = useState([false, false, false])
  const [downloaded, setDownloaded] = useState(false)
  const [helpOpen, setHelpOpen] = useState<string | null>(null)
  const [showMoreLangs, setShowMoreLangs] = useState(false)

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const doc = DOCS.find((d) => d.id === docId)
  const fields = doc?.fields ?? []

  const requiredFilled = fields.filter((f) => f.required).every((f) => (fieldValues[f.key] ?? '').trim().length > 0)
  const allChecked = checks.every(Boolean)

  function selectDoc(id: DocId) {
    setDocId(id)
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
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setUploadedPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setUploadedPreview(null)
    }
  }

  function handleDownload() {
    if (!doc) return
    downloadTranslationTemplate(doc.prodId as any, fieldValues, srcLang)
    setDownloaded(true)
  }

  function reset() {
    setStep(0); setDocId(null); setSrcLang('uk')
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

        {/* Skip or Continue */}
        <div className="flex flex-col gap-2">
          <button type="button" onClick={goNext}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors">
            {uploadedFile ? ui.next : ui.uploadSkip} →
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
          <p className="text-sm text-[var(--text-2)] mb-5">{ui.fieldsHint}</p>
          {groups.map(({ id: grp, label: grpLabel }) => {
            const grpFields = fields.filter((f) => f.group === grp)
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
                          placeholder={field.placeholder?.[srcLang] ?? field.placeholder?.en ?? ''}
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
                  <p className="text-[15px] font-semibold text-[var(--text-1)]">{fieldValues[field.key]}</p>
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
              {/* Order summary */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-[var(--text-2)] mb-0.5">
                    {[...LANGS_TOP3, ...LANGS_MORE].find((l) => l.id === srcLang)?.flag ?? '🌐'}
                    {' '}→ EN
                  </p>
                  <p className="text-[15px] font-bold text-[var(--text-1)]">{doc?.label[locale] ?? doc?.label.en}</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] text-[var(--text-2)] line-through">$15.00</p>
                  <p className="text-[15px] font-bold text-green-600">FREE</p>
                </div>
              </div>

              {/* Payment disabled banner */}
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-4 mb-5">
                <p className="text-[14px] font-bold text-amber-800">🚧 {ui.paymentDisabled}</p>
                <p className="mt-1 text-[13px] text-amber-700">{ui.paymentPrice}</p>
              </div>

              <button type="button" onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors">
                <Download className="h-5 w-5" />
                {ui.paymentContinue}
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                <p className="text-sm font-bold text-green-800">{ui.downloaded}</p>
                <p className="mt-1 text-sm text-green-700">{ui.downloadedHint}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-2">⚠ {ui.certWarn}</p>
                <ol className="text-sm text-amber-800 flex flex-col gap-1.5 list-decimal list-inside">
                  <li>{ui.next1}</li>
                  <li>{ui.next2}</li>
                  <li>{ui.next3}</li>
                  <li>{ui.next4}</li>
                </ol>
              </div>
              <div className="flex gap-3 flex-wrap">
                <button type="button" onClick={handleDownload}
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors">
                  <Download className="h-4 w-4" />{ui.downloadAgain}
                </button>
                <button type="button" onClick={reset}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors">
                  {ui.anotherDoc}
                </button>
              </div>
              {returnUrl && returnLabel && (
                <a href={returnUrl}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900 transition-colors">
                  <ArrowLeft className="h-4 w-4" />{returnLabel}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
