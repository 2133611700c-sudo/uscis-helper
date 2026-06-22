/**
 * noCyrillicLeak.test.ts — HARD GUARD: transliterateKMU55 must NEVER emit a raw
 * Cyrillic char (U+0400–U+04FF), even for Russian-only letters Ё/Э/Ы/ъ. This is the
 * defense-in-depth that a wholesale-file integration once silently reverted, causing
 * a real Cyrillic leak in a certified legal translation. tsx-script runner (mirrors
 * the package's other tests). Run via `pnpm --filter @uscis-helper/knowledge test`.
 */
import { transliterateKMU55, transliterateRussian } from '../transliterate'

const CY = /[Ѐ-ӿ]/
let pass = 0, fail = 0
function check(name: string, cond: boolean) {
  if (cond) pass++
  else { fail++; console.error('  FAIL', name) }
}

// Every Russian-only letter + real names/words that contain them.
const cases = [
  'СОЛОВЬЁВ', 'ЭДУАРД', 'ИЛЬЁВИЧ', 'город Подъездный', 'Объезд', 'Сырьё',
  'ЁЛКА', 'эхо', 'мышь', 'подъезд', 'Эдуардович', 'Соловьёва',
]
for (const s of cases) {
  const k = transliterateKMU55(s)
  check(`KMU-55 no Cyrillic leak: ${s} -> ${k}`, !CY.test(k))
  const r = transliterateRussian(s)
  check(`RU no Cyrillic leak: ${s} -> ${r}`, !CY.test(r))
}
// Spot-check the documented expected outputs (BGN/PCGN-ish via KMU fallback).
check('СОЛОВЬЁВ -> SOLOVYEV', transliterateKMU55('СОЛОВЬЁВ') === 'SOLOVYEV')
check('ЭДУАРД -> EDUARD', transliterateKMU55('ЭДУАРД') === 'EDUARD')

console.log(`=== no-Cyrillic-leak: ${pass} passed, ${fail} failed ===`)
if (fail) process.exit(1)
