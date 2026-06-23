/* REFERENCE VALIDATION — pin the codex against AUTHORITATIVE external references, so we never drift
 * from the standards a USCIS certified translation is judged by. Values verified live 2026-06-23 vs:
 *   - KMU-55 official table — czo.gov.ua/en/translit (Cabinet Resolution №55, 2010); cross-checked
 *     translit-ua (dchaplinsky, KMU-55) + anyascii.
 *   - Russian BGN/PCGN (1947) — en.wikipedia.org/wiki/BGN/PCGN_romanization_of_Russian (NOT GOST 7.79:
 *     owner-approved BGN/PCGN; passport/ICAO match is honored separately by L7 controlling-Latin).
 *   - Oblast English names — modern UKRAINIAN romanization (GeoNames / DMS): Kyiv (NOT Kiev), Odesa
 *     (NOT Odessa), Kharkiv (NOT Kharkov), Lviv (NOT Lvov). A Russified place spelling = a real defect.
 * "Don't trust — verify": each value below was confirmed against the live function output before pinning.
 * Plain-tsx assert harness. A mismatch here is a genuine standards drift to fix. */
import { transliterateKMU55, transliterateRussian } from '../transliterate'
import { normalizeOblastToNominative } from '../dictionary'

let pass = 0, fail = 0
const eq = (a: unknown, b: unknown, m: string) => { if (a === b) pass++; else { fail++; console.error(`FAIL: ${m} — got ${JSON.stringify(a)} want ${JSON.stringify(b)}`) } }

// 1. KMU-55 official distinctive mappings (the ones that differ between romanization systems).
eq(transliterateKMU55('Щукін'), 'Shchukin', 'KMU-55 Щ→Shch')
eq(transliterateKMU55('Згурський'), 'Zghurskyi', 'KMU-55 зг→zgh (special digraph, NOT zh)')
eq(transliterateKMU55('Гончар'), 'Honchar', 'KMU-55 Г→H')
eq(transliterateKMU55('Ґалаґан'), 'Galagan', 'KMU-55 Ґ→G')
eq(transliterateKMU55('Хміль'), 'Khmil', 'KMU-55 Х→Kh')
eq(transliterateKMU55('Церква'), 'Tserkva', 'KMU-55 Ц→Ts')
eq(transliterateKMU55('Євген'), 'Yevhen', 'KMU-55 Є→Ye (word-initial)')
eq(transliterateKMU55('Її'), 'Yii', 'KMU-55 Ї→Yi (word-initial)')

// 2. Russian BGN/PCGN distinctive mappings (NOT GOST 7.79 — GOST would give ёлкин→yolkin, й→j, etc.).
eq(transliterateRussian('Ёлкин'), 'Yelkin', 'RU BGN/PCGN ё→ye (word-initial)')
eq(transliterateRussian('Чайковский'), 'Chaykovskiy', 'RU BGN/PCGN ч→ch, й→y, -ий→iy')
eq(transliterateRussian('Цой'), 'Tsoy', 'RU BGN/PCGN ц→ts')
eq(transliterateRussian('Хомяков'), 'Khomyakov', 'RU BGN/PCGN х→kh, я→ya')
eq(transliterateRussian('Щербаков'), 'Shcherbakov', 'RU BGN/PCGN щ→shch')
eq(transliterateRussian('Юрий'), 'Yuriy', 'RU BGN/PCGN ю→yu, -ий→iy')
// owner's real Russian birth cert (source-faithful).
eq(transliterateRussian('Сергеевич'), 'Sergeyevich', 'RU Сергеевич')
eq(transliterateRussian('Куропятник'), 'Kuropyatnik', 'RU Куропятник')

// 3. Oblast English names — modern UKRAINIAN form (a Russified spelling would be a certified-translation defect).
eq(normalizeOblastToNominative('Київська область')?.transliterated, 'Kyiv Oblast', 'Kyiv (NOT Kiev)')
eq(normalizeOblastToNominative('Одеська область')?.transliterated, 'Odesa Oblast', 'Odesa (NOT Odessa)')
eq(normalizeOblastToNominative('Харківська область')?.transliterated, 'Kharkiv Oblast', 'Kharkiv (NOT Kharkov)')
eq(normalizeOblastToNominative('Львівська область')?.transliterated, 'Lviv Oblast', 'Lviv (NOT Lvov)')
// same place named in RUSSIAN still gets the modern Ukrainian English form.
eq(normalizeOblastToNominative('Винницкой области')?.transliterated, 'Vinnytsia Oblast', 'RU Винницкой → Vinnytsia (NOT Vinnitsa)')

// 4. ROUND-TRIP DETERMINISM — the same input must transliterate identically every call (a translator must be a pure function).
for (const w of ['Куроп’ятник', 'Сергеевич', 'Згурський', 'Naталья'.replace('Na', 'На')]) {
  const a = transliterateKMU55(w), b = transliterateKMU55(w), c = transliterateKMU55(w)
  eq(a === b && b === c, true, `deterministic KMU-55 "${w}" (${a}/${b}/${c})`)
  const ra = transliterateRussian(w), rb = transliterateRussian(w)
  eq(ra === rb, true, `deterministic RU "${w}" (${ra}/${rb})`)
}

console.log(`=== Reference Validation: ${pass} passed, ${fail} failed ===`)
if (fail > 0) process.exit(1)
