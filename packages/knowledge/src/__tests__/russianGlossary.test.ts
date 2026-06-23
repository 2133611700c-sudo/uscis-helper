/* RUSSIAN GLOSSARY GUARD — Ukrainian/Soviet documents are often written in RUSSIAN. This pins the
 * RU→ENGLISH renderings the product must produce: Russian oblast/place → English (modern Ukrainian
 * form), Russian settlement designators, Russian civil-registry terms, and Russian name
 * transliteration (BGN/PCGN). Plain-tsx assert harness (same as alphabetCompleteness). */
import { normalizeOblastToNominative, settlementDesignatorEn } from '../dictionary'
import { transliterateRussian } from '../transliterate'
import civilRegistryTerms from '../civil_registry_terms.json'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.error('FAIL:', m) } }
const eq = (a: unknown, b: unknown, m: string) => ok(a === b, `${m} — got ${JSON.stringify(a)} want ${JSON.stringify(b)}`)
const CYR = /[Ѐ-ӿ]/

// 1. RUSSIAN OBLAST (genitive + nominative) → English (modern Ukrainian form, the place is in Ukraine).
eq(normalizeOblastToNominative('Винницкой области')?.transliterated, 'Vinnytsia Oblast', 'Винницкой области')
eq(normalizeOblastToNominative('Винницкая область')?.transliterated, 'Vinnytsia Oblast', 'Винницкая область')
eq(normalizeOblastToNominative('Харьковской области')?.transliterated, 'Kharkiv Oblast', 'Харьковской области')
eq(normalizeOblastToNominative('Сумская область')?.transliterated, 'Sumy Oblast', 'Сумская область')
eq(normalizeOblastToNominative('Кировоградской обл.')?.transliterated, 'Kirovohrad Oblast', 'Кировоградской обл.')
eq(normalizeOblastToNominative('Львовская область')?.transliterated, 'Lviv Oblast', 'Львовская область')
eq(normalizeOblastToNominative('Одесской области')?.transliterated, 'Odesa Oblast', 'Одесской области')

// 2. RUSSIAN settlement designators.
eq(settlementDesignatorEn('пгт Тростянец'), 'urban-type settlement', 'пгт')
eq(settlementDesignatorEn('посёлок городского типа Иваново'), 'urban-type settlement', 'посёлок городского типа')
eq(settlementDesignatorEn('деревня Малиновка'), 'village', 'деревня')
eq(settlementDesignatorEn('село Петрово'), 'village', 'село')
eq(settlementDesignatorEn('город Киев'), null, 'город stays bare')

// 3. RUSSIAN civil-registry terms (JSON glossary) → English.
const dt: Record<string, { en?: string; lang?: string }> = (civilRegistryTerms as any).document_terms
const ra: Record<string, { en?: string }> = (civilRegistryTerms as any).registry_agencies
const sa: Record<string, { en?: string }> = (civilRegistryTerms as any).soviet_abbreviations
eq(dt['СВИДЕТЕЛЬСТВО О РОЖДЕНИИ']?.en, 'Birth Certificate', 'СВИДЕТЕЛЬСТВО О РОЖДЕНИИ')
eq(dt['СВИДЕТЕЛЬСТВО О БРАКЕ']?.en, 'Marriage Certificate', 'СВИДЕТЕЛЬСТВО О БРАКЕ')
eq(dt['СВИДЕТЕЛЬСТВО О РАСТОРЖЕНИИ БРАКА']?.en, 'Divorce Certificate', 'СВИДЕТЕЛЬСТВО О РАСТОРЖЕНИИ БРАКА')
eq(dt['СВИДЕТЕЛЬСТВО О СМЕРТИ']?.en, 'Death Certificate', 'СВИДЕТЕЛЬСТВО О СМЕРТИ')
eq(dt['ОТЧЕСТВО']?.en, 'Patronymic', 'ОТЧЕСТВО → Patronymic (not Middle Name)')
eq(ra['ЗАГС']?.en, 'Civil Registry Office (ZAGS)', 'ЗАГС')
eq(sa['УССР']?.en, 'Ukrainian SSR', 'УССР')
eq(sa['СССР']?.en, 'USSR', 'СССР')
// every RU document term has a non-empty English value, no Cyrillic leak.
for (const [k, v] of Object.entries(dt)) if (v.lang === 'ru') {
  ok(!!v.en && v.en.trim() !== '' && !CYR.test(v.en), `RU term ${k} → "${v.en}" must be non-empty English`)
}

// 4. RUSSIAN name transliteration (BGN/PCGN) — the owner's Russian birth cert.
eq(transliterateRussian('Куропятник'), 'Kuropyatnik', 'Куропятник')
eq(transliterateRussian('Сергей'), 'Sergey', 'Сергей')
eq(transliterateRussian('Сергеевич'), 'Sergeyevich', 'Сергеевич')
eq(transliterateRussian('Наталья'), 'Natalya', 'Наталья')
eq(transliterateRussian('Леонидович'), 'Leonidovich', 'Леонидович')
eq(transliterateRussian('Степановна'), 'Stepanovna', 'Степановна')

// 5. GOLDEN RU→EN VECTOR — the owner's Russian birth certificate, end-to-end pieces.
eq(transliterateRussian('Тростянец'), 'Trostyanets', 'Тростянец (RU translit)')
eq(normalizeOblastToNominative('Винницкой области')?.transliterated, 'Vinnytsia Oblast', 'place oblast English')
eq(settlementDesignatorEn('пгт Тростянец'), 'urban-type settlement', 'place designator English')

console.log(`=== Russian Glossary: ${pass} passed, ${fail} failed ===`)
if (fail > 0) process.exit(1)
