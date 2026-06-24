/**
 * Normalization module tests — Phase 2
 * Covers: controlling spelling, historical issuers, geography,
 * Patronymic protection, Militsiya preservation, blocklist
 */
import {
  normalizeName, normalizeDate, normalizeSex,
  normalizeAuthority, normalizePlace, validateOutput,
  type NormalizationContext, type ControllingSpelling,
} from '../normalize';
import { normalizeOblastToNominative } from '../dictionary';

let pass = 0;
let fail = 0;

function assert(condition: boolean, desc: string, detail?: string) {
  if (condition) { pass++; }
  else { fail++; console.error(`FAIL: ${desc}${detail ? '\n  ' + detail : ''}`); }
}

// ── CONTROLLING SPELLING WINS OVER KMU-55 ────────────────

const ctx_uscis: NormalizationContext = {
  mode: 'uscis_normalized',
  controlling_spellings: [
    { field: 'surname', latin_value: 'IVANENKO', source: 'drivers_license' },
    { field: 'given_name', latin_value: 'IVAN', source: 'drivers_license' },
  ],
};

const surname = normalizeName("Іваненко", 'surname', 'internal_passport', ctx_uscis);
assert(surname.normalized_value === 'IVANENKO',
  'Controlling spelling wins for surname',
  `Got: ${surname.normalized_value}`);
assert(surname.rule_applied.includes('controlling_spelling'),
  'Rule shows controlling_spelling source');

const givenName = normalizeName('Іван', 'given_name', 'internal_passport', ctx_uscis);
assert(givenName.normalized_value === 'IVAN',
  'Controlling spelling wins for given name',
  `Got: ${givenName.normalized_value}`);

// ── PATRONYMIC: KMU-55 (no controlling), NEVER MIDDLE NAME ──

const patronymic = normalizeName('Петрович', 'patronymic', 'internal_passport',
  { mode: 'uscis_normalized' });
assert(patronymic.normalized_value === 'Petrovych',
  'Patronymic transliterates via KMU-55',
  `Got: ${patronymic.normalized_value}`);
assert(patronymic.field === 'patronymic',
  'Field is "patronymic" not "middle_name"');

// ── RU SOURCE-SCRIPT ROUTING: a name with a distinctive RU letter (ё/ы/э/ъ) → Russian table ──
// (verified outputs; KMU-55 would mis-Russify these). Safe: never touches UA/ambiguous names.
const ctx_plain: NormalizationContext = { mode: 'uscis_normalized' };
const ruCases: [string, string][] = [
  ['Чёрный', 'Chernyy'],   // KMU-55 gives Chyernyi (wrong)
  ['Мышкин', 'Myshkin'],   // KMU-55 gives Myshkyn (wrong)
  ['Соловьёв', 'Solovyev'],
  ['Рыжов', 'Ryzhov'],
];
for (const [cyr, exp] of ruCases) {
  const r = normalizeName(cyr, 'surname', 'birth_cert', ctx_plain);
  assert(r.normalized_value === exp, `RU surname ${cyr} → ${exp} (Russian table)`, `Got: ${r.normalized_value}`);
  assert(r.rule_applied === 'ru_transliteration', `RU surname ${cyr} tagged ru_transliteration`, `Got: ${r.rule_applied}`);
}
// ── UA REGRESSION: Ukrainian + ambiguous names stay KMU-55, byte-identical ──
const uaCases: [string, string][] = [
  ['Іваненко', 'Ivanenko'],
  ['Андрій', 'Andrii'],
  ['Сергійович', 'Serhiiovych'],
];
for (const [cyr, exp] of uaCases) {
  const r = normalizeName(cyr, 'surname', 'birth_cert', ctx_plain);
  assert(r.normalized_value === exp, `UA name ${cyr} stays KMU-55 → ${exp}`, `Got: ${r.normalized_value}`);
  assert(r.rule_applied === 'kmu55_transliteration', `UA name ${cyr} stays kmu55_transliteration`, `Got: ${r.rule_applied}`);
}

// Validate blocklist catches "Middle Name" if somehow injected
const fakeMiddle = { ...patronymic, normalized_value: 'Middle Name: Petrovych' };
const validated = validateOutput(fakeMiddle);
assert(validated.review_required === true,
  'Blocklist catches "Middle Name" in patronymic output');

// ── MILITSIYA STAYS MILITSIYA ────────────────────────────

const militsiya = normalizeAuthority(
  'Кіровським РВ УМВС України (міліція)',
  'internal_passport_2011',
  { mode: 'legal_formal' },
);
assert(militsiya.normalized_value === 'Militsiya',
  'Text with "міліція" → Militsiya, not Police',
  `Got: ${militsiya.normalized_value}`);

const police = normalizeAuthority(
  'Національна поліція України',
  'new_document_2020',
  { mode: 'legal_formal' },
);
assert(police.normalized_value === 'National Police of Ukraine',
  'Text with "поліція" → National Police',
  `Got: ${police.normalized_value}`);

// ── HISTORICAL ISSUER PRESERVATION ───────────────────────

const umvs = normalizeAuthority(
  'УМВС України в Кіровоградській обл.',
  'passport_2011',
  { mode: 'legal_formal' },
);
assert(umvs.normalized_value === 'Regional Department of the Ministry of Internal Affairs of Ukraine',
  'UMVS maps to historical MVS entry',
  `Got: ${umvs.normalized_value}`);
assert(!umvs.normalized_value.includes('Police'),
  'Historical UMVS must NOT contain "Police"');

const dai = normalizeAuthority(
  'ДАІ ГУ УМВСУ м. Кіровограді',
  'drivers_license_2011',
  { mode: 'legal_formal' },
);
assert(dai.normalized_value === 'State Automobile Inspectorate',
  'DAI maps correctly',
  `Got: ${dai.normalized_value}`);

// ── CIVIL REGISTRY: 3-LAYER NAMING ──────────────────────

const zags_formal = normalizeAuthority('ЗАГС м. Вінниця', 'birth_cert',
  { mode: 'legal_formal' });
assert(zags_formal.normalized_value === 'civil status registration authority',
  'ЗАГС legal_formal = "civil status registration authority"',
  `Got: ${zags_formal.normalized_value}`);

const zags_uscis = normalizeAuthority('РАЦС м. Вінниця', 'birth_cert',
  { mode: 'uscis_normalized' });
// Audit #195 canonical: registry-sourced rendering is "Civil Registry Office"
// (source_url zakon.rada.gov.ua/laws/show/1025-2010-п, КМУ №1025). Was the
// sourceless typo'd "Civil Registry Office (ZAHS)".
assert(zags_uscis.normalized_value === 'Civil Registry Office',
  'РАЦС uscis_normalized = "Civil Registry Office" (registry-sourced)',
  `Got: ${zags_uscis.normalized_value}`);

// ── GEOGRAPHY: USTYNIVKA, VINNYTSIA, KIROVOHRAD ─────────

const ustynivka = normalizePlace('смт. Устинівка', 'birth_locality',
  'internal_passport', { mode: 'uscis_normalized' });
assert(ustynivka.normalized_value === 'urban-type settlement Ustynivka',
  'смт Устинівка → "urban-type settlement Ustynivka"',
  `Got: ${ustynivka.normalized_value}`);

const vinnytsia = normalizePlace('Вінниця', 'birth_city',
  'document', { mode: 'uscis_normalized' });
assert(vinnytsia.normalized_value === 'Vinnytsia',
  'Вінниця → Vinnytsia (not Vinnitsa)',
  `Got: ${vinnytsia.normalized_value}`);

// Historical document: Kirovograd must NOT become Kropyvnytskyi
const kirovograd_hist = normalizePlace('Кіровоград', 'issuer_city',
  'passport_2011', { mode: 'uscis_normalized', is_historical_document: true });
assert(kirovograd_hist.normalized_value === 'Kirovohrad',
  'Historical doc: Кіровоград → Kirovohrad (NOT Kropyvnytskyi)',
  `Got: ${kirovograd_hist.normalized_value}`);
assert(kirovograd_hist.rule_applied.includes('historical') ||
       kirovograd_hist.rule_applied.includes('kmu55'),
  'Rule shows historical preservation or KMU-55');

// Renamed city: do NOT silently modernize — preserve the read + flag review with
// the modern name as a suggestion (we can't know the doc date; historical names
// must be preserved per CLAUDE.md). The operator decides.
const kirovograd_modern = normalizePlace('Kirovograd', 'current_city',
  'user_input', { mode: 'uscis_normalized', is_historical_document: false });
assert(kirovograd_modern.review_required === true &&
       (kirovograd_modern.review_reason ?? '').includes('Kropyvnytskyi'),
  'Renamed city: Kirovograd → REVIEW (suggest Kropyvnytskyi, never silent)',
  `Got: value=${kirovograd_modern.normalized_value} review=${kirovograd_modern.review_required} reason=${kirovograd_modern.review_reason}`);

// ── SETTLEMENT DESIGNATOR MUST BE A WHOLE TOKEN ──────────
// BUG (live real-OCR run): bare key «м» («м.»/«місто» → "city") matched ANY
// string starting with М via startsWith(). «МОРИНЦІ» (village Моринці) was
// split into «М» + «ОРИНЦІ» → "city ORYNTSI": leading М dropped + spurious
// "city" prefix. This corrupted every place starting with М.
// FIX: a designator must be a whole token (trailing dot or whitespace boundary);
// a place whose NAME begins with М/м is never split.

const place_m = (raw: string) =>
  normalizePlace(raw, 'birth_city', 'document', { mode: 'uscis_normalized' }).normalized_value;

// KMU-55 preserves case: all-caps OCR «МОРИНЦІ» → «MORYNTSI» (the reader path
// returns exactly this). The point of the assertion: NO "city" prefix, leading
// М preserved (was "city ORYNTSI").
assert(place_m('МОРИНЦІ') === 'MORYNTSI',
  'МОРИНЦІ → MORYNTSI (NO "city", leading М preserved)',
  `Got: ${place_m('МОРИНЦІ')}`);

assert(place_m('Миколаїв') === 'Mykolaiv',
  'Миколаїв → Mykolaiv (М preserved, not split)',
  `Got: ${place_m('Миколаїв')}`);

assert(place_m('Маріуполь') === 'Mariupol',
  'Маріуполь → Mariupol (М preserved)',
  `Got: ${place_m('Маріуполь')}`);

assert(place_m('Мелітополь') === 'Melitopol',
  'Мелітополь → Melitopol (М preserved)',
  `Got: ${place_m('Мелітополь')}`);

assert(place_m('Мукачево') === 'Mukachevo',
  'Мукачево → Mukachevo (М preserved)',
  `Got: ${place_m('Мукачево')}`);

// Legit «м.» designator with a separator STILL works (KMU-55: Оринці→Oryntsi)
assert(place_m('М. Оринці') === 'city Oryntsi',
  'М. Оринці → "city Oryntsi" (real «м.» designator with dot still parses)',
  `Got: ${place_m('М. Оринці')}`);

// Full-word «місто» designator with whitespace STILL works
assert(place_m('місто Львів') === 'city Lviv',
  'місто Львів → "city Lviv" (real «місто » designator still parses)',
  `Got: ${place_m('місто Львів')}`);

// «смт» must NOT regress to "city"/"town"
assert(place_m('смт Вишневе') === 'urban-type settlement Vyshneve',
  'смт Вишневе → "urban-type settlement Vyshneve" (no regression)',
  `Got: ${place_m('смт Вишневе')}`);

// ── CONTROLLING SPELLING CONFLICT ────────────────────────

const conflictCtx: NormalizationContext = {
  mode: 'uscis_normalized',
  controlling_spellings: [
    { field: 'birth_city', latin_value: 'VINNICA', source: 'prior_uscis' },
  ],
};
const vinnica_conflict = normalizePlace('Вінниця', 'birth_city',
  'document', conflictCtx);
assert(vinnica_conflict.review_required === true,
  'VINNICA vs Vinnytsia triggers review_required');
assert(vinnica_conflict.controlling_spelling_conflict === true,
  'controlling_spelling_conflict flag is set');

// ── DATES ────────────────────────────────────────────────

const date1 = normalizeDate('01 січня 1990 року', 'date_of_birth', 'passport');
assert(date1.normalized_value === '01/01/1990',
  'Ukrainian date → USCIS format',
  `Got: ${date1.normalized_value}`);

const date2 = normalizeDate('garbage', 'date_of_birth', 'passport');
assert(date2.review_required === true,
  'Unparseable date triggers review');

// ── SEX ──────────────────────────────────────────────────

const sex1 = normalizeSex('Ч', 'passport');
assert(sex1.normalized_value === 'Male', 'Ч → Male');

const sex2 = normalizeSex('жіноча', 'passport');
assert(sex2.normalized_value === 'Female', 'жіноча → Female');

// ── BLOCKLIST ────────────────────────────────────────────

const blocked = validateOutput({
  field: 'issuing_authority',
  raw_value: 'test',
  normalized_value: 'Ministry of Interior of Ukraine',
  source_document: 'test',
  rule_applied: 'test',
  confidence: 0.9,
  review_required: false,
});
assert(blocked.review_required === true,
  'Blocklist catches "Ministry of Interior of Ukraine"');
assert(blocked.confidence === 0,
  'Blocked term sets confidence to 0');

// ── normalizeOblastToNominative REGRESSION ───────────────
// BUG: old regex /\s*(області|обл\.?)\s*/gi stripped "обл" prefix
// from "область", leaving corrupted keys like "вінницькаасть".
// Fix: use /\s*(областей?|обл(?:асть|асті|\.?))\s*/gi

{
  const vinnytsia = normalizeOblastToNominative('Вінницька область');
  assert(vinnytsia !== null, 'normalizeOblastToNominative: nominative full form not null');
  assert(vinnytsia?.transliterated === 'Vinnytsia Oblast',
    'normalizeOblastToNominative: nominative → Vinnytsia Oblast',
    `got: ${vinnytsia?.transliterated}`);

  const vinnytsiaGen = normalizeOblastToNominative('Вінницької області');
  assert(vinnytsiaGen !== null, 'normalizeOblastToNominative: genitive full form not null');
  assert(vinnytsiaGen?.transliterated === 'Vinnytsia Oblast',
    'normalizeOblastToNominative: genitive → Vinnytsia Oblast',
    `got: ${vinnytsiaGen?.transliterated}`);

  const vinnytsiaAbbr = normalizeOblastToNominative('Вінницька обл.');
  assert(vinnytsiaAbbr !== null, 'normalizeOblastToNominative: abbreviated nominative not null');
  assert(vinnytsiaAbbr?.transliterated === 'Vinnytsia Oblast',
    'normalizeOblastToNominative: abbrev → Vinnytsia Oblast',
    `got: ${vinnytsiaAbbr?.transliterated}`);

  const kharkiv = normalizeOblastToNominative('Харківська область');
  assert(kharkiv !== null, 'normalizeOblastToNominative: Kharkiv oblast not null');
  assert(kharkiv?.transliterated === 'Kharkiv Oblast',
    'normalizeOblastToNominative: Харківська область → Kharkiv Oblast',
    `got: ${kharkiv?.transliterated}`);

  const foreign = normalizeOblastToNominative('SomewhereUnknown');
  assert(foreign === null, 'normalizeOblastToNominative: unknown returns null');

  const direct = normalizeOblastToNominative('вінницька область');
  assert(direct !== null, 'normalizeOblastToNominative: lowercase nominative not null (was corrupt before fix)');
}

// ── RESULTS ──────────────────────────────────────────────

console.log(`\n=== Normalization Tests: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
