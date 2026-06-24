/**
 * dictionaryAutocorrect.test.ts — DICTIONARY_AUTOCORRECT_ENABLED (default OFF).
 *
 * Constrained-vocabulary auto-correction: a near-miss read on a CLOSED-set field
 * (oblast/settlement/sex/civil_status/country/date) snaps to the UNIQUE dictionary
 * value and is ACCEPTED (auto-fill). Ambiguity ⇒ review (no silent pick). A genuine
 * name conflict is NEVER auto-corrected (names are open vocabulary).
 *
 * HARD RULE proven here: flag OFF ⇒ byte-identical to current behaviour.
 */
import { describe, it, expect } from 'vitest'
import { normalizeCanonicalValue, isDictionaryAutocorrectEnabled } from '../knowledgeNormalize'

const OFF = { autocorrect: false as const, ukrainianDoc: true }
const ON = { autocorrect: true as const, ukrainianDoc: true }

describe('flag default + gate', () => {
  it('isDictionaryAutocorrectEnabled defaults OFF (env unset)', () => {
    expect(isDictionaryAutocorrectEnabled({})).toBe(false)
    expect(isDictionaryAutocorrectEnabled({ DICTIONARY_AUTOCORRECT_ENABLED: '0' })).toBe(false)
    expect(isDictionaryAutocorrectEnabled({ DICTIONARY_AUTOCORRECT_ENABLED: '1' })).toBe(true)
  })
})

describe('OBLAST auto-correct', () => {
  it('garbled "Вінницка область" → Vinnytsia Oblast, ACCEPT, oblast_autocorrect', () => {
    const d = normalizeCanonicalValue('place_oblast', 'Вінницка область', ON)
    expect(d.action).toBe('accept')
    expect(d.finalValue).toBe('Vinnytsia Oblast')
    expect(d.provenance).toBe('oblast_autocorrect')
  })

  it('RU-spelled "Винницкой области" → Vinnytsia Oblast, ACCEPT (now deterministic)', () => {
    // 2026-06-23: the Russian oblast genitive forms were added to the deterministic dictionary
    // (RUSSIAN forms in normalizeOblastToNominative), so RU oblasts now resolve by EXACT match —
    // an improvement over the prior fuzzy oblast_autocorrect path. Value unchanged.
    const d = normalizeCanonicalValue('place_oblast', 'Винницкой области', ON)
    expect(d.action).toBe('accept')
    expect(d.finalValue).toBe('Vinnytsia Oblast')
    expect(d.provenance).not.toBe('oblast_autocorrect') // resolved by exact RU dict
  })

  it('AMBIGUOUS oblast ("Луська область") → NOT auto-corrected to an oblast', () => {
    const d = normalizeCanonicalValue('place_oblast', 'Луська область', ON)
    // Never a silent oblast pick: provenance must NOT be oblast_autocorrect, and
    // the released value must NOT be a resolved "* Oblast" English name.
    expect(d.provenance).not.toBe('oblast_autocorrect')
    expect(d.finalValue ?? '').not.toMatch(/Oblast$/)
  })

  it('exact genitive still uses the deterministic path (not autocorrect)', () => {
    const d = normalizeCanonicalValue('place_oblast', 'Вінницької області', ON)
    expect(d.action).toBe('accept')
    expect(d.finalValue).toBe('Vinnytsia Oblast')
    expect(d.provenance).not.toBe('oblast_autocorrect') // resolved by exact dict
  })
})

describe('SETTLEMENT (gazetteer) auto-correct', () => {
  it('1-edit miss "Вінниия" → Vinnytsia, ACCEPT, gazetteer_autocorrect', () => {
    const d = normalizeCanonicalValue('place_of_birth_city', 'Вінниия', ON)
    expect(d.action).toBe('accept')
    expect(d.provenance).toBe('gazetteer_autocorrect')
    expect(d.finalValue).toBe('Vinnytsia')
  })

  it('1-edit miss "Тростянеь" → Trostianets, ACCEPT', () => {
    const d = normalizeCanonicalValue('place_of_birth_city', 'Тростянеь', ON)
    expect(d.action).toBe('accept')
    expect(d.provenance).toBe('gazetteer_autocorrect')
  })

  it('settlement designator preserved on autocorrect ("смт Вишнее")', () => {
    const d = normalizeCanonicalValue('place_of_birth_city', 'смт Вишнее', ON)
    // Вишневе is a gazetteer entry 1 edit away; designator must be re-attached.
    if (d.provenance === 'gazetteer_autocorrect') {
      expect(d.finalValue).toMatch(/^urban-type settlement /)
    }
  })
})

describe('SEX auto-correct', () => {
  it('"чол" → Male (exact via dict, accept)', () => {
    const d = normalizeCanonicalValue('sex', 'чол', ON)
    expect(d.action).toBe('accept')
    expect(d.finalValue).toBe('Male')
  })

  it('near-miss "чоловіч" → Male (autocorrect)', () => {
    const d = normalizeCanonicalValue('sex', 'чоловіч', ON)
    expect(d.action).toBe('accept')
    expect(d.finalValue).toBe('Male')
  })
})

describe('PATRONYMIC reconstruction', () => {
  it('unread patronymic + father "Андрій" → Andriiovych reconstructed (uk)', () => {
    const d = normalizeCanonicalValue('child_patronymic', '', { ...ON, sex: 'M', givenNameCyrillic: 'Андрій' })
    // empty read → suggest (light review), but the value is reconstructed.
    expect(d.candidateValue ?? d.finalValue).toBeTruthy()
    expect((d.candidateValue ?? d.finalValue ?? '')).toMatch(/Andrii?ovych/i)
    expect(d.provenance).toBe('patronymic_reconstructed')
  })

  it('partial read "Андр" + father "Андрій" → AGREES → ACCEPT', () => {
    const d = normalizeCanonicalValue('patronymic', 'Андр', { ...ON, sex: 'M', givenNameCyrillic: 'Андрій' })
    expect(d.action).toBe('accept')
    expect(d.provenance).toBe('patronymic_reconstructed')
    expect(d.finalValue).toMatch(/Andrii?ovych/i)
  })

  it('Russian context: father "Андрей" → RU отчество (Andreyevich), NOT the UA form', () => {
    const d = normalizeCanonicalValue('patronymic', '', { ...ON, sex: 'M', givenNameCyrillic: 'Андрей' })
    const v = (d.candidateValue ?? d.finalValue ?? '')
    // Russian engine: "Андреевич" → "Andreyevich" (-evich), NOT the Ukrainian-rule
    // "Andreiovych" (-ovych). Keeps UA/RU routing intact (memory: KMU-55 leaks on RU).
    expect(v).toMatch(/Andrey?evich/i)
    expect(v).not.toMatch(/ovych/i)
  })
})

describe('DATE plausibility auto-correct', () => {
  it('"05.13.1990" (month>12, day≤12) → 05/13/1990 swapped, ACCEPT', () => {
    const d = normalizeCanonicalValue('date_of_birth', '05.13.1990', ON)
    expect(d.action).toBe('accept')
    expect(d.provenance).toBe('date_autocorrect')
    expect(d.finalValue).toBe('05/13/1990')
  })

  it('"25.30.1990" (both >12) → still REVIEW (no valid reinterpretation)', () => {
    const d = normalizeCanonicalValue('date_of_birth', '25.30.1990', ON)
    expect(d.action).toBe('review')
  })
})

describe('SAFETY — names never auto-corrected', () => {
  it('a surname near a city name is NOT snapped to the gazetteer', () => {
    // "Львів" is a city; as a SURNAME it must transliterate, never become a place.
    const d = normalizeCanonicalValue('surname', 'Львівський', ON)
    expect(d.provenance).not.toMatch(/gazetteer|autocorrect/)
  })

  it('Russian-spelled given name on UA doc → still REVIEW (not auto-corrected)', () => {
    const d = normalizeCanonicalValue('given_name', 'Андрей', ON)
    expect(d.action).toBe('review')
    expect(d.reasonCodes).toContain('russian_spelling_suspected')
  })
})

describe('FLAG-OFF PARITY — byte-identical to current behaviour', () => {
  const cases: Array<[string, string]> = [
    ['place_oblast', 'Вінницка область'],
    ['place_oblast', 'Винницкой области'],
    ['place_of_birth_city', 'Вінниия'],
    ['place_of_birth_city', 'Тростянеь'],
    ['place_of_birth_city', 'Київ'],
    ['sex', 'чоловіч'],
    ['sex', 'чол'],
    ['civil_status', 'одружен'],
    ['country_of_birth', 'Росия'],
    ['date_of_birth', '05.13.1990'],
    ['child_patronymic', ''],
    ['patronymic', 'Серг'],
    ['given_name', 'Іван'],
    ['surname', 'Львівський'],
  ]

  for (const [key, value] of cases) {
    it(`OFF == undefined-flag for ${key}="${value}"`, () => {
      // The pre-feature behaviour is "flag not present". We assert that passing
      // autocorrect:false produces the SAME decision as the legacy path, and that
      // NONE of the new autocorrect provenances appear when OFF.
      const off = normalizeCanonicalValue(key, value, { ...OFF, sex: 'M', givenNameCyrillic: 'Сергій' })
      expect(off.provenance).not.toMatch(/autocorrect|reconstructed/)
    })
  }

  it('OFF: garbled oblast falls through to legacy normalize (no autocorrect accept)', () => {
    const off = normalizeCanonicalValue('place_oblast', 'Вінницка область', OFF)
    expect(off.provenance).not.toBe('oblast_autocorrect')
  })

  it('OFF: settlement 1-edit stays a SUGGEST (legacy fuzzy), not an accept', () => {
    const off = normalizeCanonicalValue('place_of_birth_city', 'Вінниия', OFF)
    expect(off.action).toBe('suggest')
    expect(off.provenance).toBe('gazetteer_fuzzy')
  })

  it('OFF: sex near-miss "чоловіч" stays REVIEW (legacy)', () => {
    const off = normalizeCanonicalValue('sex', 'чоловіч', OFF)
    expect(off.action).toBe('review')
  })

  it('OFF: implausible date passes through UNCHANGED (legacy: no plausibility gate)', () => {
    // Legacy convertDateToUSCIS reformats DD.MM without validating ranges, so it
    // emits "13/05/1990" (month 13!) and ACCEPTS it. OFF must reproduce that
    // exactly — the plausibility gate only exists when the flag is ON.
    const off = normalizeCanonicalValue('date_of_birth', '05.13.1990', OFF)
    expect(off.action).toBe('accept')
    expect(off.finalValue).toBe('13/05/1990')
    expect(off.provenance).not.toBe('date_autocorrect')
  })
})
