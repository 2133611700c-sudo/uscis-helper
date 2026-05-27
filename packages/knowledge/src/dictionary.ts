/**
 * Ukraine Terminology Dictionary v1.2 — TypeScript module
 * Sources: mvs.gov.ua, dmsu.gov.ua, czo.gov.ua, KMU Resolution No.55
 * 
 * Every entity supports 3 output modes:
 *   official_en        — legal accuracy (certified translations)
 *   normalized_uscis_en — USCIS-friendly (form fills, USCIS correspondence)
 *   plain_en_alias     — human explanation only (UI tooltips, never in docs)
 */

export type OutputMode = 'legal_formal' | 'uscis_normalized' | 'plain';

export interface AuthorityEntry {
  uk: string;
  official_en: string;
  normalized_uscis_en: string;
  plain_en_alias: string;
  historical_mode?: boolean;
  do_not_use?: string[];
  valid_from?: string;
  valid_until?: string;
}

export interface GeoCorrection {
  wrong: string;
  correct: string;
  historical_preserve?: string; // keep this form for old documents
  renamed_year?: number;
}

export interface FieldLabel {
  uk: string;
  en: string;
  do_not_use?: string[];
  critical?: boolean;
}

// ── AUTHORITIES ──────────────────────────────────────────────

export const AUTHORITIES: Record<string, AuthorityEntry> = {
  MVS: {
    uk: 'Міністерство внутрішніх справ України',
    official_en: 'Ministry of Internal Affairs of Ukraine',
    normalized_uscis_en: 'Ministry of Internal Affairs of Ukraine',
    plain_en_alias: 'Ukrainian Interior Ministry',
    do_not_use: ['Ministry of Interior of Ukraine', 'Ministry of Interior Affairs'],
  },
  MFA: {
    uk: 'Міністерство закордонних справ України',
    official_en: 'Ministry of Foreign Affairs of Ukraine',
    normalized_uscis_en: 'Ministry of Foreign Affairs of Ukraine',
    plain_en_alias: 'Ukrainian Foreign Ministry',
  },
  MINJUST: {
    uk: 'Міністерство юстиції України',
    official_en: 'Ministry of Justice of Ukraine',
    normalized_uscis_en: 'Ministry of Justice of Ukraine',
    plain_en_alias: 'Ukrainian Justice Ministry',
  },
  DMS: {
    uk: 'Державна міграційна служба України',
    official_en: 'State Migration Service of Ukraine',
    normalized_uscis_en: 'State Migration Service of Ukraine',
    plain_en_alias: 'Ukrainian Migration Service',
  },
  NPU: {
    uk: 'Національна поліція України',
    official_en: 'National Police of Ukraine',
    normalized_uscis_en: 'National Police of Ukraine',
    plain_en_alias: 'Ukrainian National Police',
    valid_from: '2015-07-04',
  },
  MILITSIYA: {
    uk: 'Міліція',
    official_en: 'Militsiya',
    normalized_uscis_en: 'Militsiya',
    plain_en_alias: 'militia police (historical)',
    historical_mode: true,
    valid_until: '2015-11-07',
    do_not_use: ['Police', 'Militia', 'National Police'],
  },
  SBGSU: {
    uk: 'Державна прикордонна служба України',
    official_en: 'State Border Guard Service of Ukraine',
    normalized_uscis_en: 'State Border Guard Service of Ukraine',
    plain_en_alias: 'Ukrainian Border Guard',
  },
  CIVIL_REGISTRY: {
    uk: 'ЗАГС / РАЦС / ДРАЦС',
    official_en: 'civil status registration authority',
    normalized_uscis_en: 'Civil Registry Office',
    plain_en_alias: 'civil registry',
    historical_mode: true,
  },
  DAI: {
    uk: 'Державна автомобільна інспекція',
    official_en: 'State Automobile Inspectorate',
    normalized_uscis_en: 'State Automobile Inspectorate',
    plain_en_alias: 'traffic police (historical)',
    historical_mode: true,
    do_not_use: ['Traffic Police', 'Road Police'],
  },
  UMVS: {
    uk: 'Управління МВС',
    official_en: 'Regional Department of the Ministry of Internal Affairs of Ukraine',
    normalized_uscis_en: 'Regional Department of MIA',
    plain_en_alias: 'regional MIA office',
    historical_mode: true,
  },
  GUMVS: {
    uk: 'Головне управління МВС',
    official_en: 'Main Department of the Ministry of Internal Affairs of Ukraine',
    normalized_uscis_en: 'Main Department of MIA',
    plain_en_alias: 'main MIA directorate',
    historical_mode: true,
  },
};

// Patterns to match authority text from OCR (lowercase matching)
export const AUTHORITY_PATTERNS: [RegExp, string][] = [
  [/міліці[яії]/i, 'MILITSIYA'],
  [/національн[аоіїє]\s*поліці/i, 'NPU'],
  [/поліці[яії]/i, 'NPU'],
  [/(загс|рацс|драцс|реєстрац.*цивільн)/i, 'CIVIL_REGISTRY'],
  [/даі|автомобільн.*інспекці/i, 'DAI'],
  [/гумвс|головн.*управлінн.*мвс/i, 'GUMVS'],
  [/умвс|управлінн.*мвс/i, 'UMVS'],
  [/мвс|внутрішн.*справ/i, 'MVS'],
  [/міграційн.*служб/i, 'DMS'],
  [/прикордонн/i, 'SBGSU'],
  [/закордонн.*справ/i, 'MFA'],
  [/юстиці/i, 'MINJUST'],
];

// ── GEOGRAPHY CORRECTIONS ────────────────────────────────────

export const GEO_CORRECTIONS: GeoCorrection[] = [
  { wrong: 'Kiev', correct: 'Kyiv' },
  { wrong: 'Kharkov', correct: 'Kharkiv' },
  { wrong: 'Odessa', correct: 'Odesa' },
  { wrong: 'Lvov', correct: 'Lviv' },
  { wrong: 'Zaporozhye', correct: 'Zaporizhzhia' },
  { wrong: 'Vinnitsa', correct: 'Vinnytsia' },
  { wrong: 'Vinnica', correct: 'Vinnytsia' },
  { wrong: 'Zhitomir', correct: 'Zhytomyr' },
  { wrong: 'Nikolaev', correct: 'Mykolaiv' },
  { wrong: 'Chernigov', correct: 'Chernihiv' },
  { wrong: 'Lugansk', correct: 'Luhansk' },
  { wrong: 'Ustinovka', correct: 'Ustynivka' },
  // Renamed cities — preserve historical form for old documents
  { wrong: 'Dnepropetrovsk', correct: 'Dnipro', historical_preserve: 'Dnipropetrovsk', renamed_year: 2016 },
  { wrong: 'Kirovograd', correct: 'Kropyvnytskyi', historical_preserve: 'Kirovohrad', renamed_year: 2016 },
];

// ── SETTLEMENT TYPES ─────────────────────────────────────────

export const SETTLEMENT_TYPES: Record<string, { en: string; warning?: string }> = {
  // Cities
  'м.': { en: 'city' },
  'м': { en: 'city' },
  'місто': { en: 'city' },

  // Urban-type settlements (phased out Jan 24, 2024 — but still on old documents)
  'смт': { en: 'urban-type settlement', warning: 'NEVER translate as city or town. Official category abolished Jan 2024 but appears on pre-2024 documents.' },
  'смт.': { en: 'urban-type settlement', warning: 'NEVER translate as city or town' },
  'селище міського типу': { en: 'urban-type settlement', warning: 'NEVER translate as city or town' },
  'п.г.т.': { en: 'urban-type settlement', warning: 'Russian abbreviation (посёлок городского типа)' },
  'пгт': { en: 'urban-type settlement', warning: 'Russian abbreviation' },

  // Villages and settlements
  'с.': { en: 'village' },
  'село': { en: 'village' },
  'с-ще': { en: 'settlement' },
  'селище': { en: 'settlement' },
  'хут.': { en: 'hamlet' },
  'хутір': { en: 'hamlet' },

  // Administrative divisions
  'р-н': { en: 'district' },
  'район': { en: 'district' },
  'обл.': { en: 'Oblast' },
  'область': { en: 'Oblast' },
  'окр.': { en: 'district' },
  'округ': { en: 'district' },
  'громада': { en: 'hromada', warning: 'Post-2020 decentralization administrative unit' },
};

// ── FIELD LABELS ─────────────────────────────────────────────

export const FIELD_LABELS: Record<string, FieldLabel> = {
  surname: { uk: 'Прізвище', en: 'Surname' },
  given_name: { uk: "Ім'я", en: 'Given Name' },
  patronymic: {
    uk: 'По батькові',
    en: 'Patronymic',
    do_not_use: ['Middle Name'],
    critical: true,
  },
  date_of_birth: { uk: 'Дата народження', en: 'Date of Birth' },
  place_of_birth: { uk: 'Місце народження', en: 'Place of Birth' },
  sex: { uk: 'Стать', en: 'Sex' },
  citizenship: { uk: 'Громадянство', en: 'Citizenship' },
  issuing_authority: { uk: 'Орган, що видав', en: 'Issuing Authority' },
  date_of_issue: { uk: 'Дата видачі', en: 'Date of Issue' },
  date_of_expiry: { uk: 'Дійсний до', en: 'Date of Expiry' },
  series: { uk: 'Серія', en: 'Series' },
  number: { uk: 'Номер', en: 'Number' },
};

// ── SEX MAPPING ──────────────────────────────────────────────

export const SEX_MAP: Record<string, string> = {
  'Ч': 'Male', 'ч': 'Male', 'чоловіча': 'Male', 'чол': 'Male',
  'М': 'Male', 'м': 'Male', 'мужской': 'Male', 'муж': 'Male',
  'Ж': 'Female', 'ж': 'Female', 'жіноча': 'Female', 'жін': 'Female',
  'F': 'Female', 'f': 'Female', 'женский': 'Female', 'жен': 'Female',
};

// ── DO-NOT-USE GLOBAL BLOCKLIST ──────────────────────────────

export const GLOBAL_BLOCKLIST = new Set([
  'Ministry of Interior of Ukraine',
  'Militia',
  'Middle Name',  // for patronymic context
]);


// ── OBLAST GENITIVE → NOMINATIVE MAP ─────────────────────────
// Ukrainian documents use genitive case ("Вінницької області").
// USCIS forms need nominative. Robot must convert automatically.

export const OBLAST_GENITIVE_TO_NOMINATIVE: Record<string, string> = {
  'вінницької': 'Вінницька',
  'волинської': 'Волинська',
  'дніпропетровської': 'Дніпропетровська',
  'донецької': 'Донецька',
  'житомирської': 'Житомирська',
  'закарпатської': 'Закарпатська',
  'запорізької': 'Запорізька',
  'івано-франківської': 'Івано-Франківська',
  'київської': 'Київська',
  'кіровоградської': 'Кіровоградська',
  'луганської': 'Луганська',
  'львівської': 'Львівська',
  'миколаївської': 'Миколаївська',
  'одеської': 'Одеська',
  'полтавської': 'Полтавська',
  'рівненської': 'Рівненська',
  'сумської': 'Сумська',
  'тернопільської': 'Тернопільська',
  'харківської': 'Харківська',
  'херсонської': 'Херсонська',
  'хмельницької': 'Хмельницька',
  'черкаської': 'Черкаська',
  'чернівецької': 'Чернівецька',
  'чернігівської': 'Чернігівська',
};

/**
 * Convert a genitive-case oblast phrase to nominative + DMS-verified English.
 * "Вінницької області" → "Vinnytsia Oblast"
 * "Кіровоградській обл." → "Kirovohrad Oblast"
 * Robot calls this automatically — no human intervention needed.
 */
export function normalizeOblastToNominative(raw: string): { nominative_uk: string; transliterated: string } | null {
  // Strip oblast/obl suffix before lookup. Must match full words:
  // "область", "обл.", "обл" — but NOT strip "обл" as a prefix of "область".
  // Pattern: обл(?:асть|асті|\.?) covers all three forms safely.
  const lower = raw.toLowerCase().replace(/\s*(областей?|обл(?:асть|асті|\.?))\s*/gi, '').trim();

  // DMS-verified English names for oblasts (from dmsu.gov.ua/en-home/contacts.html)
  const DMS_ENGLISH: Record<string, string> = {
    'вінницької': 'Vinnytsia', 'вінницька': 'Vinnytsia',
    'волинської': 'Volyn', 'волинська': 'Volyn',
    'дніпропетровської': 'Dnipropetrovsk', 'дніпропетровська': 'Dnipropetrovsk',
    'донецької': 'Donetsk', 'донецька': 'Donetsk',
    'житомирської': 'Zhytomyr', 'житомирська': 'Zhytomyr',
    'закарпатської': 'Zakarpattia', 'закарпатська': 'Zakarpattia',
    'запорізької': 'Zaporizhzhia', 'запорізька': 'Zaporizhzhia',
    'івано-франківської': 'Ivano-Frankivsk', 'івано-франківська': 'Ivano-Frankivsk',
    'київської': 'Kyiv', 'київська': 'Kyiv',
    'кіровоградської': 'Kirovohrad', 'кіровоградська': 'Kirovohrad',
    'кіровоградській': 'Kirovohrad',
    'луганської': 'Luhansk', 'луганська': 'Luhansk',
    'львівської': 'Lviv', 'львівська': 'Lviv',
    'миколаївської': 'Mykolaiv', 'миколаївська': 'Mykolaiv',
    'одеської': 'Odesa', 'одеська': 'Odesa',
    'полтавської': 'Poltava', 'полтавська': 'Poltava',
    'рівненської': 'Rivne', 'рівненська': 'Rivne',
    'сумської': 'Sumy', 'сумська': 'Sumy',
    'тернопільської': 'Ternopil', 'тернопільська': 'Ternopil',
    'харківської': 'Kharkiv', 'харківська': 'Kharkiv',
    'херсонської': 'Kherson', 'херсонська': 'Kherson',
    'хмельницької': 'Khmelnytskyi', 'хмельницька': 'Khmelnytskyi',
    'черкаської': 'Cherkasy', 'черкаська': 'Cherkasy',
    'чернівецької': 'Chernivtsi', 'чернівецька': 'Chernivtsi',
    'чернігівської': 'Chernihiv', 'чернігівська': 'Chernihiv',
  };

  const englishName = DMS_ENGLISH[lower];
  if (englishName) {
    const nom = OBLAST_GENITIVE_TO_NOMINATIVE[lower] ?? lower;
    return { nominative_uk: `${nom} область`, transliterated: `${englishName} Oblast` };
  }
  return null;
}
