/**
 * detectDocumentScript.test.ts — DOC-LEVEL script detector (plain tsx harness).
 *
 * The bug it fixes: an ambiguous-script NAME (e.g. «Сергей» — no ы/э/ё/ъ, no
 * і/ї/є/ґ) on a RUSSIAN-language document was romanized with Ukrainian KMU-55
 * ("Serhei") instead of Russian BGN/PCGN ("Sergey"), because detectNameScript on
 * the name alone returns 'unknown'. The DOCUMENT, though, is detectably Russian
 * from OTHER fields (a -еевич patronymic, Russian month/place forms). This detector
 * aggregates those signals so the caller can route correctly. Conservative: 'ru'
 * only on a clear one-sided signal; a conflicting (bilingual) set stays 'unknown'.
 * Synthetic example names only (privacy rule).
 */
import { detectDocumentScript } from '../transliterate';

let pass = 0;
let fail = 0;

function check(desc: string, got: string, expected: string) {
  if (got === expected) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL: ${desc}\n  Expected: ${expected}\n  Got:      ${got}\n`);
  }
}

// Russian birth-cert field set (Сергеевич patronymic + RU month + RU place) → ru
check(
  'RU cert field set → ru',
  detectDocumentScript([
    'Сергей', // ambiguous on its own
    'Сергеевич', // distinctive RU patronymic ending -еевич
    '15 января 1986 года', // RU month + RU "года"
    'город Тростянец, Сумской области', // RU place forms
  ]),
  'ru',
);

// Ukrainian birth-cert field set (Сергійович + UA month + UA place) → uk
check(
  'UA cert field set → uk',
  detectDocumentScript([
    'Сергій', // has і — distinctive UA letter
    'Сергійович', // distinctive UA patronymic ending -ійович
    '15 січня 1986 року', // UA month + UA "року"
    'місто Тростянець, Сумської області', // UA place forms
  ]),
  'uk',
);

check('single RU-only letter pins ru', detectDocumentScript(['Эдуард', 'Иванов', 'Москва']), 'ru'); // Эдуард has э
check('single UA-only letter pins uk', detectDocumentScript(['Їжакевич', 'Петров']), 'uk'); // Ї
check('RU patronymic alone → ru', detectDocumentScript(['Иванова', 'Алексеевна']), 'ru'); // -еевна
check(
  'conflicting bilingual signals → unknown',
  detectDocumentScript(['Сергеевич', 'місто Київ']),
  'unknown',
);
check('no signal (ambiguous tokens) → unknown', detectDocumentScript(['Сергей', 'Петров', 'Тростянец']), 'unknown');
check('empty set → unknown', detectDocumentScript([]), 'unknown');
check('blank/null set → unknown', detectDocumentScript(['', '   ', null, undefined]), 'unknown');
check('RU month word → ru', detectDocumentScript(['10 декабря 2020']), 'ru');
check('UA month word → uk', detectDocumentScript(['10 грудня 2020']), 'uk');

console.log(`\n=== detectDocumentScript Tests: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
