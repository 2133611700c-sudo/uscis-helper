/* SEX-FROM-PATRONYMIC — deterministic, FREE recovery of sex when the document omits it (the patronymic
 * suffix encodes it). Closes the measured sex=MISS gap on birth certs + military IDs WITHOUT any LLM
 * call (cost-efficiency-first). Plain-tsx assert harness. */
import { sexFromPatronymic } from '../patronymic'

let pass = 0, fail = 0
const eq = (a: unknown, b: unknown, m: string) => { if (a === b) pass++; else { fail++; console.error(`FAIL: ${m} — got ${JSON.stringify(a)} want ${JSON.stringify(b)}`) } }

// MALE patronymics (UA + RU): -ович/-йович/-ьович/-евич/-ич
eq(sexFromPatronymic('Сергеевич'), 'M', 'RU Сергеевич → M (owner birth cert — was a sex MISS)')
eq(sexFromPatronymic('Леонидович'), 'M', 'RU Леонидович → M')
eq(sexFromPatronymic('Сергійович'), 'M', 'UA Сергійович → M')
eq(sexFromPatronymic('Кузьмич'), 'M', 'Кузьмич → M (-ич)')
eq(sexFromPatronymic('Львович'), 'M', 'Львович → M')

// FEMALE patronymics (UA + RU): -овна/-евна/-івна/-ївна/-ична/-инична (checked first — longer/more specific)
eq(sexFromPatronymic('Степановна'), 'F', 'RU Степановна → F')
eq(sexFromPatronymic('Сергеевна'), 'F', 'RU Сергеевна → F')
eq(sexFromPatronymic('Сергіївна'), 'F', 'UA Сергіївна → F')
eq(sexFromPatronymic('Ильинична'), 'F', 'RU Ильинична → F (-инична beats -ич)')
eq(sexFromPatronymic('Іллівна'), 'F', 'UA Іллівна → F')

// NOT a patronymic ⇒ null (never guess — leave for review)
eq(sexFromPatronymic('Куропятник'), null, 'surname → null')
eq(sexFromPatronymic('Иван'), null, 'given name → null')
eq(sexFromPatronymic(''), null, 'empty → null')
eq(sexFromPatronymic(null), null, 'null → null')
eq(sexFromPatronymic('ич'), null, 'bare fragment too short → null')

// case + apostrophe tolerant
eq(sexFromPatronymic('  СЕРГЕЕВИЧ  '), 'M', 'uppercase + spaces')

console.log(`=== Sex From Patronymic: ${pass} passed, ${fail} failed ===`)
if (fail > 0) process.exit(1)
