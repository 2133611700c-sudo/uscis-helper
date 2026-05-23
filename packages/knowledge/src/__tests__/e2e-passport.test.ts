/**
 * E2E TEST: Real passport images → Knowledge normalization → I-765 fields
 * Uses actual data from Sergii's internal passport (3 photos)
 */
import {
  normalizeName, normalizeDate, normalizeSex,
  normalizeAuthority, normalizePlace, validateOutput,
  type NormalizationContext, type ControllingSpelling,
} from '../normalize';

const controlling: ControllingSpelling[] = [
  { field: 'surname', latin_value: 'KUROPIATNYK', source: 'drivers_license' },
  { field: 'given_name', latin_value: 'SERHII', source: 'drivers_license' },
];

const ctx: NormalizationContext = {
  mode: 'uscis_normalized',
  controlling_spellings: controlling,
  is_historical_document: true,
};

const results = [
  validateOutput(normalizeName("Куроп'ятник", 'surname', 'internal_passport', ctx)),
  validateOutput(normalizeName('Сергій', 'given_name', 'internal_passport', ctx)),
  validateOutput(normalizeName('Сергійович', 'patronymic', 'internal_passport', ctx)),
  validateOutput(normalizeDate('25 червня 1986 року', 'dob', 'internal_passport')),
  validateOutput(normalizeSex('чоловіча', 'internal_passport')),
  validateOutput(normalizePlace('смт. Устинівка', 'city_of_birth', 'internal_passport', ctx)),
  validateOutput(normalizePlace('Вінницької області', 'province_of_birth', 'internal_passport', ctx)),
  validateOutput(normalizeAuthority('УМВС України в Кіровоградській обл.', 'internal_passport', ctx)),
  validateOutput(normalizeDate('5 грудня 2011', 'date_of_issue', 'internal_passport')),
];

let pass = 0, fail = 0;
function check(desc: string, actual: string, expected: string) {
  if (actual === expected) { pass++; console.log(`✅ ${desc}: "${actual}"`); }
  else { fail++; console.log(`❌ ${desc}: expected "${expected}", got "${actual}"`); }
}

console.log('\n=== E2E: Internal Passport → Knowledge → I-765 ===\n');

check('Surname (controlling DL)', results[0].normalized_value, 'KUROPIATNYK');
check('Given Name (controlling DL)', results[1].normalized_value, 'SERHII');
check('Patronymic (KMU-55)', results[2].normalized_value, 'Serhiiovych');
check('DOB → MM/DD/YYYY', results[3].normalized_value, '06/25/1986');
check('Sex → Male', results[4].normalized_value, 'Male');
check('Birth place (смт→settlement)', results[5].normalized_value, 'Ustynivka urban-type settlement');
check('Authority → UMVS', results[7].normalized_value, 'Regional Department of MIA');
check('Date of Issue', results[8].normalized_value, '12/05/2011');

console.log('\n--- I-765 Output ---');
console.log(`Line1a: ${results[0].normalized_value}`);
console.log(`Line1b: ${results[1].normalized_value}`);
console.log(`Line1c: ${results[2].normalized_value}`);
console.log(`Line19:  ${results[3].normalized_value}`);
console.log(`Line9:   ${results[4].normalized_value === 'Male' ? 'M' : 'F'}`);
console.log(`Line18a: ${results[5].normalized_value}`);
console.log(`Line18b: ${results[6].normalized_value}`);

// KEY: oblast genitive auto-converted to nominative by the robot
check('Oblast auto-nominative', results[6].normalized_value, 'Vinnytsia Oblast');

console.log('\n--- Safety ---');
check('Patronymic field = "patronymic"', results[2].field, 'patronymic');
check('No "Police" in historical issuer', results[7].normalized_value.includes('Police') ? 'FAIL' : 'PASS', 'PASS');
check('No "Militia" in output', results[7].normalized_value.includes('Militia') ? 'FAIL' : 'PASS', 'PASS');
check('Controlling spelling conflict flagged', String(results[0].controlling_spelling_conflict ?? false), 'false');

console.log(`\n=== E2E RESULT: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
