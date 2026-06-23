/**
 * U-STAGE 6 — death-certificate + name-change-certificate FIELD LABEL coverage.
 * These two doc classes previously had only a doc-type entry; this test pins the
 * uk→en label coverage added to civil_registry_terms.json (v2.1.0).
 */
import terms from '../civil_registry_terms.json';

let pass = 0;
let fail = 0;
function assert(condition: boolean, desc: string, detail?: string) {
  if (condition) { pass++; }
  else { fail++; console.error(`FAIL: ${desc}${detail ? '\n  ' + detail : ''}`); }
}

const dt = (terms as { document_terms: Record<string, { en: string; field_hint?: string }> }).document_terms;

// ── version bumped (additive) ───────────────────────────────
assert((terms as { _version: string })._version === '2.2.0', 'civil_registry_terms version bumped to 2.2.0 (RU section added 2026-06-23)');

// ── doc-type entries (already-existing classes, now with field coverage) ──
assert(dt['СВІДОЦТВО ПРО СМЕРТЬ']?.en === 'Death Certificate', 'death certificate doc-type label');
assert(dt['СВІДОЦТВО ПРО ЗМІНУ ІМЕНІ']?.en === 'Name Change Certificate', 'name-change doc-type label');

// ── death-certificate fields ────────────────────────────────
assert(dt['ПРИЧИНА СМЕРТІ']?.en === 'Cause of Death', 'причина смерті → Cause of Death');
assert(dt['ПРИЧИНА СМЕРТІ']?.field_hint === 'cause_of_death', 'cause_of_death field_hint');
assert(dt['ДАТА СМЕРТІ']?.en === 'Date of Death', 'дата смерті → Date of Death');
assert(dt['МІСЦЕ СМЕРТІ']?.en === 'Place of Death', 'місце смерті → Place of Death');

// ── name-change fields: before ──────────────────────────────
assert(dt['ПРІЗВИЩЕ ДО ЗМІНИ']?.en === 'Surname before Change', 'прізвище до зміни');
assert(dt["ІМ'Я ДО ЗМІНИ"]?.en === 'Given Name before Change', "ім'я до зміни");
assert(dt['ПО БАТЬКОВІ ДО ЗМІНИ']?.en === 'Patronymic before Change', 'по батькові до зміни');
assert(dt['ПО БАТЬКОВІ ДО ЗМІНИ']?.field_hint === 'name_before_change', 'patronymic-before field_hint');

// ── name-change fields: after / new ─────────────────────────
assert(dt['ПРІЗВИЩЕ ПІСЛЯ ЗМІНИ']?.en === 'Surname after Change', 'прізвище після зміни');
assert(dt["ІМ'Я ПІСЛЯ ЗМІНИ"]?.en === 'Given Name after Change', "ім'я після зміни");
assert(dt['ПО БАТЬКОВІ ПІСЛЯ ЗМІНИ']?.en === 'Patronymic after Change', 'по батькові після зміни');
assert(dt['НОВЕ ПРІЗВИЩЕ']?.en === 'New Surname', 'нове прізвище → New Surname');
assert(dt["НОВЕ ІМ'Я"]?.en === 'New Given Name', "нове ім'я → New Given Name");

// ── HARD RULE: patronymic never "Middle Name" ───────────────
const patronymicEntries = [dt['ПО БАТЬКОВІ ДО ЗМІНИ'], dt['ПО БАТЬКОВІ ПІСЛЯ ЗМІНИ']];
assert(
  patronymicEntries.every((e) => !/middle name/i.test(e?.en ?? '')),
  'name-change patronymic labels never say "Middle Name"',
);

console.log(`\n=== Civil Registry Death/NameChange Tests: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
