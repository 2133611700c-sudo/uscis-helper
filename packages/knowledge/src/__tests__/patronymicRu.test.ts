/**
 * Russian patronymic (отчество) engine tests. Context: Soviet/Russian-era
 * documents (e.g. a 1986 Soviet birth certificate) carry parents' names in
 * Russian (Сергей Леонидович, Наталия Степановна). отчество is derived
 * deterministically from the father's given name + the child's sex.
 */
import {
  isValidPatronymicRu,
  generatePatronymicRu,
  reconcilePatronymicRu,
} from '../patronymic'

let pass = 0
let fail = 0
function check(desc: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) { pass++; console.log(`  ✓ ${desc}`) }
  else { fail++; console.log(`  ✗ ${desc}\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`) }
}

console.log('generatePatronymicRu — regular consonant stems')
check('Иван → M Иванович',         generatePatronymicRu('Иван', 'M'), 'Иванович')
check('Иван → F Ивановна',         generatePatronymicRu('Иван', 'F'), 'Ивановна')
check('Александр → M',             generatePatronymicRu('Александр', 'M'), 'Александрович')
check('Александр → F',             generatePatronymicRu('Александр', 'F'), 'Александровна')
check('Владимир → M',              generatePatronymicRu('Владимир', 'M'), 'Владимирович')
check('Степан → F Степановна',     generatePatronymicRu('Степан', 'F'), 'Степановна') // 1986 cert mother
check('Леонид → M Леонидович',     generatePatronymicRu('Леонид', 'M'), 'Леонидович') // 1986 cert father

console.log('generatePatronymicRu — -й ending → -евич / -евна')
check('Андрей → M Андреевич',      generatePatronymicRu('Андрей', 'M'), 'Андреевич')
check('Андрей → F Андреевна',      generatePatronymicRu('Андрей', 'F'), 'Андреевна')
check('Алексей → M Алексеевич',    generatePatronymicRu('Алексей', 'M'), 'Алексеевич')
check('Геннадий → M Геннадиевич',  generatePatronymicRu('Геннадий', 'M'), 'Геннадиевич')

console.log('generatePatronymicRu — -ь ending → -евич / -евна')
check('Игорь → M Игоревич',        generatePatronymicRu('Игорь', 'M'), 'Игоревич')
check('Игорь → F Игоревна',        generatePatronymicRu('Игорь', 'F'), 'Игоревна')

console.log('generatePatronymicRu — EXCEPTIONS_RU (irregular)')
check('Сергей → M Сергеевич',      generatePatronymicRu('Сергей', 'M'), 'Сергеевич')
check('Сергей → F Сергеевна',      generatePatronymicRu('Сергей', 'F'), 'Сергеевна')
check('Лев → M Львович',           generatePatronymicRu('Лев', 'M'), 'Львович')
check('Лев → F Львовна',           generatePatronymicRu('Лев', 'F'), 'Львовна')
check('Пётр → M Петрович',         generatePatronymicRu('Пётр', 'M'), 'Петрович')
check('Петр → M Петрович (no ё)',  generatePatronymicRu('Петр', 'M'), 'Петрович')
check('Пётр → F Петровна',         generatePatronymicRu('Пётр', 'F'), 'Петровна')
check('Никита → M Никитич',        generatePatronymicRu('Никита', 'M'), 'Никитич')
check('Никита → F Никитична',      generatePatronymicRu('Никита', 'F'), 'Никитична')
check('Фёдор → M Фёдорович',       generatePatronymicRu('Фёдор', 'M'), 'Фёдорович')
check('Федор → F Фёдоровна (no ё)',generatePatronymicRu('Федор', 'F'), 'Фёдоровна')
check('Илья → M Ильич',            generatePatronymicRu('Илья', 'M'), 'Ильич')
check('Илья → F Ильинична',        generatePatronymicRu('Илья', 'F'), 'Ильинична')
check('Кузьма → M Кузьмич',        generatePatronymicRu('Кузьма', 'M'), 'Кузьмич')
check('Кузьма → F Кузьминична',    generatePatronymicRu('Кузьма', 'F'), 'Кузьминична')
check('Фома → M Фомич',            generatePatronymicRu('Фома', 'M'), 'Фомич')
check('Фома → F Фоминична',        generatePatronymicRu('Фома', 'F'), 'Фоминична')
check('Лука → M Лукич',            generatePatronymicRu('Лука', 'M'), 'Лукич')
check('Лука → F Лукинична',        generatePatronymicRu('Лука', 'F'), 'Лукинична')
check('Яков → M Яковлевич',        generatePatronymicRu('Яков', 'M'), 'Яковлевич')
check('Яков → F Яковлевна',        generatePatronymicRu('Яков', 'F'), 'Яковлевна')

console.log('generatePatronymicRu — not safely derivable → null (we DON\'T guess)')
check('unknown -а vowel name → null', generatePatronymicRu('Авдула', 'M'), null)
check('empty → null',                 generatePatronymicRu('', 'M'), null)

console.log('isValidPatronymicRu — reject the OCR fragment bug')
check('Иванович valid (M)',     isValidPatronymicRu('Иванович', 'M'), true)
check('Андреевич valid (M)',    isValidPatronymicRu('Андреевич', 'M'), true)
check('Ивановна valid (F)',     isValidPatronymicRu('Ивановна', 'F'), true)
check('Никитична valid (F)',    isValidPatronymicRu('Никитична', 'F'), true)
check('"еевич" fragment rejected', isValidPatronymicRu('еевич', 'M'), false)
check('"евич" fragment rejected',  isValidPatronymicRu('евич', 'M'), false)
check('"овна" fragment rejected',  isValidPatronymicRu('овна', 'F'), false)
check('latin "ovich" rejected',    isValidPatronymicRu('Ivanovich', 'M'), false)
check('digits rejected',           isValidPatronymicRu('Иван0вич', 'M'), false)
check('empty rejected',            isValidPatronymicRu('', 'M'), false)

console.log('reconcilePatronymicRu — Chief Engineer entry point')
check('valid read kept, no review', reconcilePatronymicRu('Леонидович', 'Леонид', 'M'),
  { value: 'Леонидович', review_required: false })
check('fragment "евич" → reconstructed from given name',
  reconcilePatronymicRu('евич', 'Андрей', 'M'), { value: 'Андреевич', review_required: true })
check('no read + known name → reconstructed',
  reconcilePatronymicRu(null, 'Степан', 'F'), { value: 'Степановна', review_required: true })
check('exception read_valid wins over generate',
  reconcilePatronymicRu('Сергеевна', 'Сергей', 'F'), { value: 'Сергеевна', review_required: false })
check('nothing derivable → empty + review',
  reconcilePatronymicRu('ovich', '', 'M'), { value: '', review_required: true })

console.log(`\npatronymicRu: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
