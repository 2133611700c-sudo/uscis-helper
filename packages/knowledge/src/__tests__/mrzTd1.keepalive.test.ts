/**
 * TD1 (ID-card, 3×30) MRZ KEEP-ALIVE test — ONE-BRAIN v2 Phase 6.
 *
 * findTd1Lines is RESERVED (see src/DEPRECATED.ts, wireTarget "ID-card MRZ
 * (TD1) documents") with no apps/web consumer yet. This test keeps the whole
 * findTd1Lines → parseMrz TD1 path from rotting until it is wired.
 *
 * FICTIONAL data only: person and document are invented; the issuing state is
 * "UTO" (Utopia — the ICAO 9303 documentation example state). Check digits are
 * computed with the module's OWN checkDigit so the vector is valid by
 * construction, and review_required must therefore be false.
 */
import { findTd1Lines, parseMrz, checkDigit } from '../mrz';

let pass = 0;
let fail = 0;
function assert(condition: boolean, desc: string, detail?: string) {
  if (condition) { pass++; }
  else { fail++; console.error(`FAIL: ${desc}${detail ? '\n  ' + detail : ''}`); }
}

// ── Build a valid FICTIONAL TD1 (3 lines × 30 chars) ─────────────────────────
// Line 1: doc code "I<" + issuing "UTO" + doc number(9) + check + optional filler
const DOC_NO = 'AB1234567';
const line1 = ('I<UTO' + DOC_NO + checkDigit(DOC_NO)).padEnd(30, '<');

// Line 2: DOB(6)+check + sex + expiry(6)+check + nationality(3) + filler + composite
const DOB = '900415';    // 1990-04-15 (fictional)
const EXP = '300101';    // 2030-01-01
const l2NoComposite = (
  DOB + checkDigit(DOB) + 'F' + EXP + checkDigit(EXP) + 'UTO'
).padEnd(29, '<');
// TD1 composite (line 2 char 30) over l1[6..30] + l2[1..7] + l2[9..15] + l2[19..29]
const compositeInput =
  line1.slice(5, 30) + l2NoComposite.slice(0, 7) + l2NoComposite.slice(8, 15) + l2NoComposite.slice(18, 29);
const line2 = l2NoComposite + checkDigit(compositeInput);

// Line 3: surname<<given (FICTIONAL person)
const line3 = 'TESTOVA<<MARIYA'.padEnd(30, '<');

assert(line1.length === 30, 'line1 is 30 chars', `got ${line1.length}`);
assert(line2.length === 30, 'line2 is 30 chars', `got ${line2.length}`);
assert(line3.length === 30, 'line3 is 30 chars', `got ${line3.length}`);

// ── findTd1Lines locates the triple inside noisy OCR text ────────────────────
const ocrText = `ID CARD SPECIMEN\nsome ocr noise line\n${line1}\n${line2}\n${line3}\ntrailing noise`;
const found = findTd1Lines(ocrText);
assert(found !== null, 'findTd1Lines finds the 3 TD1 lines');
if (found) {
  assert(found[0] === line1, 'line 1 recovered verbatim', `got ${found[0]}`);
  assert(found[1] === line2, 'line 2 recovered verbatim', `got ${found[1]}`);
  assert(found[2] === line3, 'line 3 recovered verbatim', `got ${found[2]}`);
}

// ── parseMrz routes to TD1 and parses names/DOB/number ───────────────────────
const r = parseMrz(ocrText);
assert(r.ok === true, 'parseMrz ok on TD1');
assert(r.format === 'TD1', 'format is TD1', `got ${r.format}`);
assert(r.surname === 'TESTOVA', 'surname parsed', `got "${r.surname}"`);
assert(r.given_names === 'MARIYA', 'given names parsed', `got "${r.given_names}"`);
assert(r.passport_no === DOC_NO, 'document number parsed', `got "${r.passport_no}"`);
assert(r.nationality === 'UTO', 'nationality parsed', `got "${r.nationality}"`);
assert(r.date_of_birth === '1990-04-15', 'DOB parsed to ISO', `got ${r.date_of_birth}`);
assert(r.sex === 'F', 'sex parsed', `got "${r.sex}"`);
assert(r.expiry === '2030-01-01', 'expiry parsed to ISO', `got ${r.expiry}`);
assert(r.checks.passport_no && r.checks.dob && r.checks.expiry && r.checks.composite,
  'all check digits valid', JSON.stringify(r.checks));
assert(r.review_required === false, 'valid vector ⇒ review_required=false');

// ── Corrupted digit MUST flip review_required (never silently trusted) ───────
const badLine2 = line2.slice(0, 3) + (line2[3] === '9' ? '8' : '9') + line2.slice(4);
const bad = parseMrz(`${line1}\n${badLine2}\n${line3}`);
assert(bad.review_required === true, 'corrupted DOB digit ⇒ review_required=true');

console.log(`\n=== mrzTd1.keepalive Tests: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
