/**
 * U-STAGE 6 — document-number / series FORMAT validator tests.
 * Conservative contract: malformed → { valid:false } (review), never false-accept.
 */
import {
  validateDocNumber,
  DOC_NUMBER_FORMATS,
  US_SERVICE_CENTER_PREFIXES,
  lookupEadCategory,
  EAD_CATEGORY_MEANINGS,
} from '../docNumberFormats';

let pass = 0;
let fail = 0;
function assert(condition: boolean, desc: string, detail?: string) {
  if (condition) { pass++; }
  else { fail++; console.error(`FAIL: ${desc}${detail ? '\n  ' + detail : ''}`); }
}

// ── UA international passport: 2 letters + 6 digits ──────────
assert(validateDocNumber('ua_intl_passport', 'FU262473').valid === true, 'UA passport FU262473 valid');
assert(validateDocNumber('ua_intl_passport', 'fu262473').normalized === 'FU262473', 'UA passport uppercased');
assert(validateDocNumber('ua_intl_passport', 'F U262473').normalized === 'FU262473', 'UA passport strips spaces');
assert(validateDocNumber('ua_intl_passport', 'FU26247').valid === false, 'UA passport 5 digits rejected');
assert(validateDocNumber('ua_intl_passport', 'F1262473').valid === false, 'UA passport letter+digit prefix rejected');
assert(validateDocNumber('ua_intl_passport', 'FU2624733').valid === false, 'UA passport 7 digits rejected');

// ── UA ID card record number: 9 digits ──────────────────────
assert(validateDocNumber('ua_id_card_record', '123456789').valid === true, 'UA ID record 9 digits valid');
assert(validateDocNumber('ua_id_card_record', '12345678').valid === false, 'UA ID record 8 digits rejected');
assert(validateDocNumber('ua_id_card_record', '1234567890').valid === false, 'UA ID record 10 digits rejected');
assert(validateDocNumber('ua_id_card_record', '12345678A').valid === false, 'UA ID record with letter rejected');

// ── UA certificate series: Roman + "-" + 2 Cyr + " №" + digits ──
assert(validateDocNumber('ua_certificate_series', 'III-АМ № 428069').valid === true, 'UA cert series valid');
assert(validateDocNumber('ua_certificate_series', 'III-АМ №428069').normalized === 'III-АМ № 428069', 'UA cert series normalizes № spacing');
assert(validateDocNumber('ua_certificate_series', 'I-БК № 12').valid === true, 'UA cert series short valid');
assert(validateDocNumber('ua_certificate_series', 'III-AM № 428069').valid === false, 'UA cert series Latin letters rejected');
assert(validateDocNumber('ua_certificate_series', 'III АМ № 428069').valid === false, 'UA cert series missing dash rejected');
assert(validateDocNumber('ua_certificate_series', 'III-АМ 428069').valid === false, 'UA cert series missing № rejected');

// ── UA military ticket: 2 Cyrillic + 6 digits ───────────────
assert(validateDocNumber('ua_military_ticket', 'СО 845621').valid === true, 'UA military ticket valid');
assert(validateDocNumber('ua_military_ticket', 'СО845621').normalized === 'СО 845621', 'UA military ticket normalizes space');
assert(validateDocNumber('ua_military_ticket', 'SO 845621').valid === false, 'UA military ticket Latin rejected');
assert(validateDocNumber('ua_military_ticket', 'СО 84562').valid === false, 'UA military ticket 5 digits rejected');

// ── US A-Number: "A" + 9 digits ─────────────────────────────
assert(validateDocNumber('us_a_number', 'A123456789').valid === true, 'US A-Number valid');
assert(validateDocNumber('us_a_number', 'a123456789').normalized === 'A123456789', 'US A-Number uppercased');
assert(validateDocNumber('us_a_number', 'A12345').valid === false, 'US A-Number short rejected');
assert(validateDocNumber('us_a_number', '123456789').valid === false, 'US A-Number missing A rejected');
assert(validateDocNumber('us_a_number', 'A1234567890').valid === false, 'US A-Number 10 digits rejected');

// ── US EAD card: 3 letters + 10 digits + service-center prefix ──
assert(validateDocNumber('us_ead_card', 'SRC2290012345').valid === true, 'US EAD card SRC valid');
assert(validateDocNumber('us_ead_card', 'ioe2290012345').normalized === 'IOE2290012345', 'US EAD card IOE uppercased');
assert(validateDocNumber('us_ead_card', 'ZZZ2290012345').valid === false, 'US EAD card unknown prefix rejected');
assert(validateDocNumber('us_ead_card', 'ZZZ2290012345').reason?.startsWith('unknown_service_center_prefix') === true, 'US EAD card prefix reason');
assert(validateDocNumber('us_ead_card', 'SRC229001234').valid === false, 'US EAD card 9 digits rejected');

// ── US EAD category: letter + 2 digits ──────────────────────
assert(validateDocNumber('us_ead_category', 'C08').valid === true, 'US EAD category C08 valid');
assert(validateDocNumber('us_ead_category', 'C19').valid === true, 'US EAD category C19 valid');
assert(validateDocNumber('us_ead_category', 'A12').valid === true, 'US EAD category A12 valid');
assert(validateDocNumber('us_ead_category', 'c08').normalized === 'C08', 'US EAD category uppercased');
assert(validateDocNumber('us_ead_category', 'C8').valid === false, 'US EAD category 1 digit rejected');
assert(validateDocNumber('us_ead_category', 'C088').valid === false, 'US EAD category 3 digits rejected');

// ── US I-94 admission number: 11 chars ──────────────────────
assert(validateDocNumber('us_i94', '12345678901').valid === true, 'US I-94 11 digits valid');
assert(validateDocNumber('us_i94', '1234567890A').valid === true, 'US I-94 10 digits + trailing letter valid');
assert(validateDocNumber('us_i94', '1234567890').valid === false, 'US I-94 10 digits rejected');
assert(validateDocNumber('us_i94', '123456789012').valid === false, 'US I-94 12 digits rejected');
assert(validateDocNumber('us_i94', '12345678A01').valid === false, 'US I-94 letter mid rejected');

// ── US I-797 receipt: 3-letter prefix + 10 digits ───────────
assert(validateDocNumber('us_i797_receipt', 'EAC2290012345').valid === true, 'US I-797 EAC valid');
assert(validateDocNumber('us_i797_receipt', 'WAC2290012345').valid === true, 'US I-797 WAC valid');
assert(validateDocNumber('us_i797_receipt', 'MSC2290012345').valid === true, 'US I-797 MSC valid');
assert(validateDocNumber('us_i797_receipt', 'XYZ2290012345').valid === false, 'US I-797 unknown prefix rejected');
assert(validateDocNumber('us_i797_receipt', 'EAC229001234').valid === false, 'US I-797 9 digits rejected');

// ── Defensive: empty / null / unknown kind never throw ──────
assert(validateDocNumber('us_a_number', '').valid === false, 'empty → invalid');
assert(validateDocNumber('us_a_number', null).valid === false, 'null → invalid (no throw)');
assert(validateDocNumber('us_a_number', undefined).valid === false, 'undefined → invalid (no throw)');
// @ts-expect-error testing unknown kind at runtime
assert(validateDocNumber('not_a_kind', 'X').valid === false, 'unknown kind → invalid');

// ── exports present ─────────────────────────────────────────
assert(typeof DOC_NUMBER_FORMATS.ua_intl_passport.test === 'function', 'DOC_NUMBER_FORMATS exported');
assert(US_SERVICE_CENTER_PREFIXES.includes('IOE'), 'US_SERVICE_CENTER_PREFIXES includes IOE');

// ── EAD category meaning map (display data only) ────────────
assert(lookupEadCategory('C08') === 'asylum application pending', 'EAD C08 → asylum pending');
assert(lookupEadCategory('c19') === 'TPS pending', 'EAD C19 → TPS pending (case-insensitive)');
assert(lookupEadCategory('A12') === 'TPS approved', 'EAD A12 → TPS approved');
assert(lookupEadCategory('C09') === 'adjustment of status (AOS) pending', 'EAD C09 → AOS pending');
assert(lookupEadCategory('Z99') === null, 'EAD unknown → null');
assert(lookupEadCategory(null) === null, 'EAD null → null (no throw)');
assert(EAD_CATEGORY_MEANINGS.C08 === 'asylum application pending', 'EAD_CATEGORY_MEANINGS exported');

console.log(`\n=== docNumberFormats Tests: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
