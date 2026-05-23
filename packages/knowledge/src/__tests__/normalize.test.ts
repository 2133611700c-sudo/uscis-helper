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
    { field: 'surname', latin_value: 'REDACTED', source: 'drivers_license' },
    { field: 'given_name', latin_value: 'SERHII', source: 'drivers_license' },
  ],
};

const surname = normalizeName("REDACTED_NAME", 'surname', 'internal_passport', ctx_uscis);
assert(surname.normalized_value === 'REDACTED',
  'Controlling spelling wins for surname',
  `Got: ${surname.normalized_value}`);
assert(surname.rule_applied.includes('controlling_spelling'),
  'Rule shows controlling_spelling source');

const givenName = normalizeName('Сергій', 'given_name', 'internal_passport', ctx_uscis);
assert(givenName.normalized_value === 'SERHII',
  'Controlling spelling wins for given name',
  `Got: ${givenName.normalized_value}`);

// ── PATRONYMIC: KMU-55 (no controlling), NEVER MIDDLE NAME ──

const patronymic = normalizeName('Сергійович', 'patronymic', 'internal_passport',
  { mode: 'uscis_normalized' });
assert(patronymic.normalized_value === 'Serhiiovych',
  'Patronymic transliterates via KMU-55',
  `Got: ${patronymic.normalized_value}`);
assert(patronymic.field === 'patronymic',
  'Field is "patronymic" not "middle_name"');

// Validate blocklist catches "Middle Name" if somehow injected
const fakeMiddle = { ...patronymic, normalized_value: 'Middle Name: Serhiiovych' };
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
assert(zags_uscis.normalized_value === 'Civil Registry Office',
  'РАЦС uscis_normalized = "Civil Registry Office"',
  `Got: ${zags_uscis.normalized_value}`);

// ── GEOGRAPHY: USTYNIVKA, VINNYTSIA, KIROVOHRAD ─────────

const ustynivka = normalizePlace('смт. Устинівка', 'birth_locality',
  'internal_passport', { mode: 'uscis_normalized' });
assert(ustynivka.normalized_value === 'Ustynivka urban-type settlement',
  'смт Устинівка → "Ustynivka urban-type settlement"',
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

// Modern context: Kirovograd → Kropyvnytskyi
const kirovograd_modern = normalizePlace('Kirovograd', 'current_city',
  'user_input', { mode: 'uscis_normalized', is_historical_document: false });
assert(kirovograd_modern.normalized_value === 'Kropyvnytskyi',
  'Modern context: Kirovograd → Kropyvnytskyi',
  `Got: ${kirovograd_modern.normalized_value}`);

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

const date1 = normalizeDate('25 червня 1986 року', 'date_of_birth', 'passport');
assert(date1.normalized_value === '06/25/1986',
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

// ── RESULTS ──────────────────────────────────────────────

console.log(`\n=== Normalization Tests: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
