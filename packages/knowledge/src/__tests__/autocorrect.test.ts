/**
 * autocorrect.test.ts — constrained-vocabulary auto-correction (D2).
 *
 * The matchers snap a near-miss read to the UNIQUE nearest closed-set entry. A
 * tight, unambiguous near-miss → unique=true (caller may auto-fill). An ambiguous
 * or far read → unique=false (caller keeps suggest/review). NEVER a silent pick.
 *
 * Plain-tsx runner (same style as the other knowledge tests — no vitest).
 */
import {
  autoCorrectOblast,
  autoCorrectSex,
  autoCorrectCivilStatus,
  autoCorrectCountry,
  autoCorrectDateParts,
} from '../autocorrect';

let pass = 0;
let fail = 0;
function assert(cond: boolean, desc: string, detail?: string) {
  if (cond) { pass++; }
  else { fail++; console.error(`FAIL: ${desc}${detail ? '\n  ' + detail : ''}`); }
}

// ── OBLAST (closed set of 24) ────────────────────────────────
{
  const m = autoCorrectOblast('Вінницка область');
  assert(m.unique && m.canonical === 'вінницької',
    'garbled UA nominative "Вінницка" → unique Vinnytsia', JSON.stringify(m));
}
{
  const m = autoCorrectOblast('Винницкой області');
  assert(m.unique && m.canonical === 'вінницької',
    'garbled RU genitive "Винницкой" → unique Vinnytsia', JSON.stringify(m));
}
{
  const m = autoCorrectOblast('Вінницької області');
  assert(m.reason === 'exact', 'exact genitive → reason=exact (not autocorrect)', JSON.stringify(m));
}
{
  const m = autoCorrectOblast('Квазіляндська область');
  assert(m.unique === false, 'gibberish oblast → not unique', JSON.stringify(m));
}

// ── SEX (closed set) ─────────────────────────────────────────
{
  const m = autoCorrectSex('чол');
  assert(m.value === 'Male', '"чол" → Male', JSON.stringify(m));
}
{
  const m = autoCorrectSex('чоловіч');
  assert(m.value === 'Male' && (m.unique || m.reason === 'exact'),
    '"чоловіч" (near-miss of чоловіча) → Male', JSON.stringify(m));
}
{
  const m = autoCorrectSex('zzz');
  assert(m.unique === false, 'sex garbage → not unique', JSON.stringify(m));
}

// ── CIVIL STATUS / COUNTRY (closed sets) ─────────────────────
{
  const m = autoCorrectCivilStatus('одружен');
  assert(m.value.includes('married'), '"одружен" → married', JSON.stringify(m));
}
{
  const m = autoCorrectCountry('Росия');
  assert(m.value === 'Russia', '"Росия" (RU misspelling) → Russia', JSON.stringify(m));
}

// ── DATE PLAUSIBILITY ────────────────────────────────────────
{
  const r = autoCorrectDateParts({ day: 5, month: 13, year: 1990 });
  assert(!!r && r.corrected && r.day === 13 && r.month === 5,
    'day≤12, month>12 → unique swap', JSON.stringify(r));
}
{
  const r = autoCorrectDateParts({ day: 25, month: 30, year: 1990 });
  assert(r === null, 'both >12 → null (review)', JSON.stringify(r));
}
{
  const r = autoCorrectDateParts({ day: 5, month: 7, year: 1990 });
  assert(!!r && r.corrected === false, 'valid date → unchanged, not corrected', JSON.stringify(r));
}
{
  const r = autoCorrectDateParts({ day: 25, month: 13, year: 1990 });
  assert(r === null, 'day>12 AND month>12 → null (no valid swap)', JSON.stringify(r));
}

console.log(`\n=== autocorrect: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
