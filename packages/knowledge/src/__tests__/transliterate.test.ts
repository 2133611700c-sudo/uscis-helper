/**
 * Transliteration engine tests — KMU-55
 * Test cases from real documents + czo.gov.ua examples
 */
import { transliterateKMU55, convertDateToUSCIS } from '../transliterate';

const cases: [string, string, string][] = [
  // [input, expected, description]
  ['Дем\'яненко', 'Demianenko', 'Surname with apostrophe'],
  ['Іван', 'Ivan', 'Given name — Й non-initial'],
  ['Петрович', 'Petrovych', 'Patronymic — compound'],
  ['Вінниця', 'Vinnytsia', 'City — #CorrectUA'],
  ['Київ', 'Kyiv', 'Capital — #CorrectUA'],
  ['Одеса', 'Odesa', 'City — single s'],
  ['Запоріжжя', 'Zaporizhzhia', 'Double ж + я non-initial'],
  ['Харків', 'Kharkiv', 'Х = Kh'],
  ['Львів', 'Lviv', 'ь skipped'],
  ['Устинівка', 'Ustynivka', 'Birth place — smт'],
  ['Кіровоград', 'Kirovohrad', 'Historical city — Г=H'],
  ['Єнакієве', 'Yenakiieve', 'Є initial + Є non-initial'],
  ['Згурський', 'Zghurskyi', 'Special: ЗГ = Zgh'],
  ['Розгон', 'Rozghon', 'Special: ЗГ mid-word'],
  ['Житомир', 'Zhytomyr', 'Ж + и'],
  ['Олексій', 'Oleksii', 'й non-initial = i'],
  ['Йосипівка', 'Yosypivka', 'Й initial = Y'],
  ['Їжакевич', 'Yizhakevych', 'Ї initial = Yi'],
  ['Юлія', 'Yuliia', 'Ю initial + ї non-initial + я non-initial'],
  ['Миколаїв', 'Mykolaiv', '#CorrectUA — Ї non-initial'],
  ['Чернігів', 'Chernihiv', '#CorrectUA'],
  ['Луганськ', 'Luhansk', 'ь skipped'],
  ['Донецьк', 'Donetsk', 'ь skipped'],
  ['Богдан', 'Bohdan', 'Г = H not G'],
  // Edge cases added in self-check
  ['ДЕМ\'ЯНЕНКО', 'DEMIANENKO', 'ALL-CAPS input'],
  ['ІВАН', 'IVAN', 'ALL-CAPS name'],
  ['Івано-Франківськ', 'Ivano-Frankivsk', 'Hyphenated city name'],
  ['', '', 'Empty string'],
  ['Hello World', 'Hello World', 'Non-Cyrillic passthrough'],
  ['Мар\'їне', 'Marine', 'Apostrophe + Ї non-initial'],
];

let pass = 0;
let fail = 0;

for (const [input, expected, desc] of cases) {
  const result = transliterateKMU55(input);
  if (result === expected) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL: ${desc}\n  Input:    ${input}\n  Expected: ${expected}\n  Got:      ${result}\n`);
  }
}

// Date tests
const dateCases: [string, string | null, string][] = [
  ['01.01.1990', '01/01/1990', 'Dot format'],
  ['01 січня 1990 року', '01/01/1990', 'Ukrainian long format'],
  ['19 лютого 2003', '02/19/2003', 'February'],
  ['5 грудня 2011', '12/05/2011', 'December'],
  ['01 января 1990 года', '01/01/1990', 'Russian fallback'],

  // ── Month ABBREVIATIONS (with trailing dot) — Ukrainian ───────────────────
  ['10 січ. 1990', '01/10/1990', 'UA abbrev січ. → 01'],
  ['10 лют. 1990', '02/10/1990', 'UA abbrev лют. → 02'],
  ['10 бер. 1990', '03/10/1990', 'UA abbrev бер. → 03'],
  ['10 кв. 1990', '04/10/1990', 'UA abbrev кв. → 04'],
  ['10 трав. 1990', '05/10/1990', 'UA abbrev трав. → 05'],
  ['10 черв. 1990', '06/10/1990', 'UA abbrev черв. → 06'],
  ['10 лип. 1990', '07/10/1990', 'UA abbrev лип. → 07'],
  ['10 липн. 1990', '07/10/1990', 'UA abbrev липн. → 07'],
  ['10 серп. 1990', '08/10/1990', 'UA abbrev серп. → 08'],
  ['10 вер. 1990', '09/10/1990', 'UA abbrev вер. → 09'],
  ['10 жовт. 1990', '10/10/1990', 'UA abbrev жовт. → 10'],
  ['10 листоп. 1990', '11/10/1990', 'UA abbrev листоп. → 11'],
  ['10 лист. 1990', '11/10/1990', 'UA abbrev лист. → 11'],
  ['10 груд. 1990', '12/10/1990', 'UA abbrev груд. → 12'],

  // ── Month ABBREVIATIONS — Russian ─────────────────────────────────────────
  ['10 ян. 1990', '01/10/1990', 'RU abbrev ян. → 01'],
  ['10 февр. 1990', '02/10/1990', 'RU abbrev февр. → 02'],
  ['10 мар. 1990', '03/10/1990', 'RU abbrev мар. → 03'],
  ['10 апр. 1990', '04/10/1990', 'RU abbrev апр. → 04'],
  ['10 мая 1990', '05/10/1990', 'RU full мая → 05 (still works)'],
  ['10 июн. 1990', '06/10/1990', 'RU abbrev июн. → 06'],
  ['10 июл. 1990', '07/10/1990', 'RU abbrev июл. → 07'],
  ['10 авг. 1990', '08/10/1990', 'RU abbrev авг. → 08'],
  ['10 сент. 1990', '09/10/1990', 'RU abbrev сент. → 09'],
  ['10 окт. 1990', '10/10/1990', 'RU abbrev окт. → 10'],
  ['10 нояб. 1990', '11/10/1990', 'RU abbrev нояб. → 11'],
  ['10 дек. 1990', '12/10/1990', 'RU abbrev дек. → 12'],

  // ── Abbreviations WITHOUT the dot also resolve ────────────────────────────
  ['10 черв 1990', '06/10/1990', 'UA abbrev without dot'],

  // ── Substring-collision guards: full words must NOT be over-matched ───────
  ['10 марта 1990', '03/10/1990', 'Full word марта → 03 (not confused by мар)'],
  ['10 мая 1990', '05/10/1990', 'Full word мая → 05'],

  // ── Bilingual passport dates "25 ЧЕР/JUN 86" ──────────────────────────────
  ['25 ЧЕР/JUN 86', '06/25/1986', 'Bilingual ЧЕР/JUN, year 86 → 1986'],
  ['01 СІЧ/JAN 90', '01/01/1990', 'Bilingual СІЧ/JAN'],
  ['07 ГРУ/DEC 05', '12/07/2005', 'Bilingual ГРУ/DEC, year 05 → 2005'],
  ['15 МАР/MAR 99', '03/15/1999', 'Bilingual RU МАР/MAR'],
  ['25 чер / jun 86', '06/25/1986', 'Bilingual lowercase + spaces around slash'],
  ['12 ТРА/MAY 2010', '05/12/2010', 'Bilingual with 4-digit year'],

  // ── Bilingual DISAGREEMENT → null (review, never guess) ───────────────────
  ['25 ЧЕР/JAN 86', null, 'Bilingual month disagreement → null'],
  ['25 ЖОВ/SEP 86', null, 'Bilingual ЖОВ(Oct) vs SEP → null'],
  ['25 ЧЕР/XXX 86', null, 'Bilingual unknown Latin code → null'],
  ['25 ЗЗЗ/JUN 86', null, 'Bilingual unknown Cyrillic code → null'],
];

for (const [input, expected, desc] of dateCases) {
  const result = convertDateToUSCIS(input);
  if (result === expected) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL DATE: ${desc}\n  Input:    ${input}\n  Expected: ${expected}\n  Got:      ${result}\n`);
  }
}

console.log(`\n=== KMU-55 Tests: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
