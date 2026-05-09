/**
 * Glossary Loader — Messenginfo Translation Engine v5.0
 * Loads only relevant glossary modules for a given document type.
 */
import { DocumentType } from '../types'

export interface GlossaryModule {
  passport_fields?: Record<string, string>
  admin_terms?: Record<string, string>
  agencies?: Record<string, string>
  abbreviations?: Record<string, string>
  months?: Record<string, string>
  sex_values?: Record<string, string>
  marital_status?: Record<string, string>
  forbidden_translations?: string[]
  historical_geography_lock?: Array<{ lock: string; note: string }>
}

// Inline glossary — mirrors UKRAINE_GLOSSARY.yaml
const FULL_GLOSSARY: GlossaryModule = {
  passport_fields: {
    "Паспорт громадянина України": "Passport of the Citizen of Ukraine",
    "Серія": "Series", "Номер": "Number",
    "Прізвище": "Surname", "Ім'я": "Given Name", "По батькові": "Patronymic",
    "Дата народження": "Date of Birth", "Місце народження": "Place of Birth",
    "Стать": "Sex", "Ким виданий": "Issued by",
    "Дата видачі": "Date of Issue", "Дата видачі паспорта": "Date of Issue",
    "Місце проживання": "Registration of Place of Residence",
    "Сімейний стан": "Marital Status", "Дійсний до": "Valid Until",
    "Громадянство": "Citizenship", "Особистий підпис": "Personal Signature",
    "Ідентифікаційний номер": "Identification Number",
  },
  admin_terms: {
    "область": "Oblast", "обл.": "Oblast",
    "район": "Raion / District", "р-н": "Raion / District",
    "місто": "city", "м.": "city", "міста": "city of",
    "селище міського типу": "urban-type settlement", "смт": "urban-type settlement",
    "село": "village", "с.": "village", "сел.": "village",
    "вулиця": "street", "вул.": "street",
    "проспект": "avenue", "просп.": "avenue",
    "будинок": "building / house no.", "буд.": "building / house no.",
    "корпус": "building block / block", "корп.": "building block / block",
    "квартира": "apartment", "кв.": "apartment",
    "провулок": "lane", "пров.": "lane",
  },
  agencies: {
    "МВС України": "Ministry of Internal Affairs of Ukraine",
    "ГУМВС України": "Main Directorate of the Ministry of Internal Affairs of Ukraine",
    "УМВС України": "Directorate / Department of the Ministry of Internal Affairs of Ukraine",
    "РВ УМВС": "District Department of the Directorate of the Ministry of Internal Affairs",
    "МВ УМВС": "City Department of the Directorate of the Ministry of Internal Affairs",
    "ДМС України": "State Migration Service of Ukraine",
    "УДМС": "Territorial Subdivision of the State Migration Service",
    "РАЦС": "Civil Registry Office",
    "ДРАЦС": "State Civil Registry Office",
    "Державна прикордонна служба": "State Border Guard Service of Ukraine",
    "Міністерство освіти і науки України": "Ministry of Education and Science of Ukraine",
    "Міністерство охорони здоров'я України": "Ministry of Health of Ukraine",
  },
  abbreviations: {
    "ім.": "named after", "б/н": "without number / no number assigned",
    "в/ч": "Military Unit", "№": "No.",
    "р.": "year", "рр.": "years",
    "проф.": "Professor", "доц.": "Associate Professor",
    "канд.": "Candidate", "д-р": "Doctor",
  },
  months: {
    "січня": "January", "лютого": "February", "березня": "March",
    "квітня": "April", "травня": "May", "червня": "June",
    "липня": "July", "серпня": "August", "вересня": "September",
    "жовтня": "October", "листопада": "November", "грудня": "December",
    // Russian forms for legacy documents
    "января": "January", "февраля": "February", "марта": "March",
    "апреля": "April", "мая": "May", "июня": "June",
    "июля": "July", "августа": "August", "сентября": "September",
    "октября": "October", "ноября": "November", "декабря": "December",
  },
  sex_values: {
    "Ч": "M", "Ж": "F", "чол.": "M", "жін.": "F",
    "Мужской": "M", "Женский": "F",
  },
  marital_status: {
    "одружений": "married (male)", "одружена": "married (female)",
    "неодружений": "single (male)", "неодружена": "single (female)",
    "розлучений": "divorced (male)", "розлучена": "divorced (female)",
    "вдівець": "widower", "вдова": "widow",
  },
  forbidden_translations: [
    "Police Department", "Round seal", "Uploaded image",
    "Bilingual Ukrainian/Russian", "Stamp", "Photo placeholder", "Scanner artifact",
  ],
  historical_geography_lock: [
    { lock: "Кіровоград", note: "Renamed to Kropyvnytskyi in 2016. Preserve as printed." },
    { lock: "Дніпропетровськ", note: "Renamed to Dnipro in 2016. Preserve as printed." },
    { lock: "Артемівськ", note: "Renamed to Bakhmut in 2016. Preserve as printed." },
    { lock: "Луганськ", note: "Transliterate as 'Luhansk'. Do not substitute." },
    { lock: "Дзержинськ", note: "Renamed to Toretsk in 2016. Preserve as printed." },
  ],
}

const DOC_TYPE_MODULES: Record<DocumentType, (keyof GlossaryModule)[]> = {
  ua_passport_booklet:    ['passport_fields', 'admin_terms', 'agencies', 'abbreviations', 'months', 'sex_values', 'marital_status', 'historical_geography_lock'],
  ua_passport_id_card:    ['passport_fields', 'admin_terms', 'agencies', 'months', 'sex_values'],
  ua_passport_biometric:  ['passport_fields', 'admin_terms', 'agencies', 'months', 'sex_values'],
  ua_birth_certificate:   ['admin_terms', 'agencies', 'months', 'sex_values', 'historical_geography_lock'],
  ua_marriage_certificate:['admin_terms', 'agencies', 'months', 'marital_status'],
  ua_death_certificate:   ['admin_terms', 'agencies', 'months'],
  ua_drivers_license:     ['admin_terms', 'months'],
  ua_diploma:             ['admin_terms', 'agencies', 'abbreviations', 'months'],
  ua_school_certificate:  ['admin_terms', 'agencies', 'months'],
  ua_military:            ['admin_terms', 'agencies', 'abbreviations', 'months'],
  other:                  ['admin_terms', 'agencies', 'abbreviations', 'months'],
}

export function loadGlossary(docType: DocumentType): GlossaryModule {
  const modules = DOC_TYPE_MODULES[docType] ?? DOC_TYPE_MODULES.other
  const result: GlossaryModule = { forbidden_translations: FULL_GLOSSARY.forbidden_translations }
  for (const mod of modules) {
    // @ts-expect-error dynamic key
    result[mod] = FULL_GLOSSARY[mod]
  }
  return result
}

export function lookupTerm(glossary: GlossaryModule, term: string): string | null {
  const sections: (keyof GlossaryModule)[] = [
    'passport_fields', 'admin_terms', 'agencies', 'abbreviations',
    'months', 'sex_values', 'marital_status',
  ]
  for (const section of sections) {
    const map = glossary[section] as Record<string, string> | undefined
    if (map && term in map) return map[term]
  }
  return null
}
