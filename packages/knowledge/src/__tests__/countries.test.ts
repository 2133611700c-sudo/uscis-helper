/**
 * Foreign country / foreign-place normalization tests
 * Covers: COUNTRIES map, lookupCountry, normalizeForeignPlace.
 *
 * Canonical foreign-place format: "Country" or "Country, City".
 * Embedded «місто/город/city» designator is DROPPED; city transliterated by
 * source script (established exonyms like Москва→Moscow win over translit).
 * A Ukrainian DOMESTIC place must return null (never mangled as foreign).
 */
import { COUNTRIES, lookupCountry, normalizeForeignPlace } from '../dictionary';

let pass = 0;
let fail = 0;

function assert(condition: boolean, desc: string, detail?: string) {
  if (condition) { pass++; }
  else { fail++; console.error(`FAIL: ${desc}${detail ? '\n  ' + detail : ''}`); }
}

const CYRILLIC = /[Ѐ-ӿҐґ]/;

// ── lookupCountry ────────────────────────────────────────
assert(lookupCountry('Канада') === 'Canada', 'lookupCountry: Канада → Canada');
assert(lookupCountry('канада') === 'Canada', 'lookupCountry: case-insensitive');
assert(lookupCountry('  США  ') === 'United States', 'lookupCountry: trims + США → United States');
assert(lookupCountry('Сполучені Штати') === 'United States', 'lookupCountry: Сполучені Штати → United States');
assert(lookupCountry('Російська Федерація') === 'Russia', 'lookupCountry: Російська Федерація → Russia');
assert(lookupCountry('Київ') === null, 'lookupCountry: a city is not a country → null');
assert(lookupCountry('') === null, 'lookupCountry: empty → null');
assert(lookupCountry(null) === null, 'lookupCountry: null → null (no throw)');
assert(COUNTRIES['німеччина'] === 'Germany', 'COUNTRIES map exposes Німеччина → Germany');

// ── normalizeForeignPlace: country + city, clean English ──
const toronto = normalizeForeignPlace('Канада, місто Торонто');
assert(toronto?.value === 'Canada, Toronto',
  'Канада, місто Торонто → "Canada, Toronto"', `got: ${toronto?.value}`);
assert(toronto?.isForeign === true, 'Торонто result flagged isForeign');
assert(!!toronto && !CYRILLIC.test(toronto.value),
  'Toronto result has NO Cyrillic', `got: ${toronto?.value}`);
assert(!!toronto && !/misto|місто/i.test(toronto.value),
  'Toronto result drops «місто» designator', `got: ${toronto?.value}`);

// ── country only ─────────────────────────────────────────
const usa = normalizeForeignPlace('США');
assert(usa?.value === 'United States', 'США → "United States"', `got: ${usa?.value}`);
assert(usa?.isForeign === true, 'США flagged isForeign');

// ── Russian-script city with «город» designator ──────────
const moscow = normalizeForeignPlace('Росія, город Москва');
assert(moscow?.value === 'Russia, Moscow',
  'Росія, город Москва → "Russia, Moscow"', `got: ${moscow?.value}`);
assert(!!moscow && !CYRILLIC.test(moscow.value),
  'Moscow result has NO Cyrillic', `got: ${moscow?.value}`);
assert(!!moscow && !/город/i.test(moscow.value),
  'Moscow result drops «город» designator', `got: ${moscow?.value}`);

// ── Ukrainian DOMESTIC places must NOT be treated as foreign ──
assert(normalizeForeignPlace('Київ') === null,
  'Київ (domestic) → null (not foreign)');
assert(normalizeForeignPlace('смт Вишневе') === null,
  'смт Вишневе (domestic) → null (not foreign)');
assert(normalizeForeignPlace('Вінницька область, м. Жмеринка') === null,
  'Ukrainian oblast+city → null (not foreign)');
assert(normalizeForeignPlace('') === null, 'empty → null');
assert(normalizeForeignPlace(null) === null, 'null → null (no throw)');

// ── city already Latin is not mangled ────────────────────
const latinCity = normalizeForeignPlace('Канада, Toronto');
assert(latinCity?.value === 'Canada, Toronto',
  'Канада, Toronto (Latin city) preserved', `got: ${latinCity?.value}`);

// ── RESULTS ──────────────────────────────────────────────
console.log(`\n=== Countries Tests: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
