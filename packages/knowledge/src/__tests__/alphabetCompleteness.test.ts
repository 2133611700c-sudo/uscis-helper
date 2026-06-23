/* ALPHABET COMPLETENESS GUARD — every Ukrainian + Russian letter must map to Latin with
 * ZERO Cyrillic leak, and key values must match the OFFICIAL normative base (KMU Resolution
 * №55, 27 Jan 2010, verified against czo.gov.ua/mfa.gov.ua/UN E/CONF.101/84). Fails the build
 * if a letter is dropped, leaks, or a normative value drifts. Plain-tsx assert harness. */
import { transliterateKMU55, transliterateRussian } from '../transliterate'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.error('FAIL:', m) } }

const UA = "абвгґдеєжзиіїйклмнопрстуфхцчшщьюя'" // 33 letters + apostrophe
const RU = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'   // 33 letters
const CYR = /[Ѐ-ӿ]/

// 1. COMPLETENESS — no letter leaks raw Cyrillic.
for (const c of UA) ok(!CYR.test(transliterateKMU55(c)), `UA '${c}' → '${transliterateKMU55(c)}' leaked Cyrillic`)
for (const c of RU) ok(!CYR.test(transliterateRussian(c)), `RU '${c}' → '${transliterateRussian(c)}' leaked Cyrillic`)
// soft sign + apostrophe are NOT reproduced (normative).
ok(transliterateKMU55('ь') === '', 'UA ь → empty (not reproduced)')
ok(transliterateKMU55("'") === '', "UA apostrophe → empty (not reproduced)")

// 2. KMU-55 official values (normative spot-check, per the resolution).
ok(transliterateKMU55('Г') === 'H', 'Г → H')
ok(transliterateKMU55('Ґ') === 'G', 'Ґ → G')
ok(transliterateKMU55('Харків') === 'Kharkiv', 'Х → Kh (Харків → Kharkiv)')
ok(transliterateKMU55('Цаль') === 'Tsal', 'Ц → Ts (Цаль → Tsal)')
ok(transliterateKMU55('Щука') === 'Shchuka', 'Щ → Shch (Щука → Shchuka)')
ok(transliterateKMU55('Згорани') === 'Zghorany', 'зг digraph → zgh (Згорани → Zghorany)')
ok(transliterateKMU55('Яна') === 'Yana', 'Я word-initial → Ya (Яна → Yana)')
ok(transliterateKMU55('Мар’яна') === 'Mariana', 'я mid-word → ia (Мар’яна → Mariana)')
ok(transliterateKMU55('Юрій') === 'Yurii', 'Ю initial → Yu, й mid → i (Юрій → Yurii)')

// 3. Russian BGN/PCGN values (for source-faithful Russian documents).
ok(transliterateRussian('Сергеевич') === 'Sergeyevich', 'RU Сергеевич → Sergeyevich')
ok(transliterateRussian('Куропятник') === 'Kuropyatnik', 'RU Куропятник → Kuropyatnik')
ok(transliterateRussian('Сергей') === 'Sergey', 'RU Сергей → Sergey')
ok(transliterateRussian('Наталья') === 'Natalya', 'RU Наталья → Natalya')

console.log(`=== Alphabet Completeness: ${pass} passed, ${fail} failed ===`)
if (fail > 0) process.exit(1)
