/* cyrillicLeakFullBlock.test.ts — CRITICAL GUARD: sweep the ENTIRE U+0400–U+04FF block through
 * both transliterators + sanitizeCyrillicLeak and assert ZERO raw Cyrillic survives. Proves the
 * catch-all covers archaic/Serbian/Belarusian/extended letters + combining marks the curated
 * noCyrillicLeak.test.ts never reached. (Without the sanitizer, ~182/190 codepoints leak raw.) */
import { transliterateKMU55, transliterateRussian, sanitizeCyrillicLeak } from '../transliterate';

const CY = /[Ѐ-ӿ]/;
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };

// 1. SANITY — the RAW transliterators DO leak (so the test is meaningful). >180 each.
let rawKmuLeaks = 0, rawRuLeaks = 0;
for (let cp = 0x0400; cp <= 0x04ff; cp++) {
  const ch = String.fromCodePoint(cp);
  if (CY.test(transliterateKMU55(ch))) rawKmuLeaks++;
  if (CY.test(transliterateRussian(ch))) rawRuLeaks++;
}
ok(rawKmuLeaks > 150, `raw KMU-55 leaks expected >150, got ${rawKmuLeaks}`);
ok(rawRuLeaks > 150, `raw Russian leaks expected >150, got ${rawRuLeaks}`);

// 2. CRITICAL — sanitized output has ZERO raw Cyrillic across the WHOLE block.
for (let cp = 0x0400; cp <= 0x04ff; cp++) {
  const ch = String.fromCodePoint(cp);
  const k = sanitizeCyrillicLeak(transliterateKMU55(ch));
  const r = sanitizeCyrillicLeak(transliterateRussian(ch));
  ok(!CY.test(k), `KMU-55 leak at U+${cp.toString(16).toUpperCase().padStart(4, '0')} -> '${k}'`);
  ok(!CY.test(r), `Russian leak at U+${cp.toString(16).toUpperCase().padStart(4, '0')} -> '${r}'`);
}

// 3. Combining marks (U+0483–U+0489) + numero U+0482 must be STRIPPED, not leaked.
for (const cp of [0x0482, 0x0483, 0x0484, 0x0485, 0x0486, 0x0487, 0x0488, 0x0489]) {
  ok(sanitizeCyrillicLeak(transliterateKMU55(String.fromCodePoint(cp))) === '',
     `combining/numero U+${cp.toString(16)} not stripped`);
}

// 4. REGRESSION — sanitizer is a no-op on modern Latin output (normative UA/RU values unchanged).
const reg: [string, string][] = [
  ['Харків', 'Kharkiv'], ['Щука', 'Shchuka'], ['Згорани', 'Zghorany'], ['Юрій', 'Yurii'],
];
for (const [s, exp] of reg) {
  const got = sanitizeCyrillicLeak(transliterateKMU55(s));
  ok(got === exp, `regress ${s} -> '${got}', expected '${exp}'`);
  ok(!CY.test(got), `regress ${s} leaked Cyrillic: '${got}'`);
}

console.log(`=== full-block Cyrillic-leak: ${pass} passed, ${fail} failed (raw leaks KMU=${rawKmuLeaks} RU=${rawRuLeaks}) ===`);
if (fail > 0) process.exit(1);
