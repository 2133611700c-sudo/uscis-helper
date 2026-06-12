/**
 * sourceScriptGate.test.ts — owner-locked rule (2026-06-10):
 *   "Visible source controls transliteration. Document context only helps.
 *    Ambiguity blocks final."
 *
 * A name whose source script is NOT visually confirmed (no distinctive UA letter
 * і/ї/є/ґ and no distinctive RU letter ы/э/ё/ъ) must go to review and must NOT be
 * finalized by C3 until the script is confirmed — reason_code source_script_ambiguous.
 * Old Soviet/bilingual docs legitimately mix scripts, so we never guess the
 * document's language. Synthetic example names only (privacy rule).
 */
import { describe, it, expect } from 'vitest'
import { isNameSourceScriptAmbiguous } from '../transliterationPolicy'
import { applyOcrFieldSafety } from '@/lib/documentSafety/applyOcrFieldSafety'

const RU_ON = { RU_TRANSLIT_ENABLED: '1' }
const RU_OFF = { RU_TRANSLIT_ENABLED: '0' }

describe('isNameSourceScriptAmbiguous — visible source script must be confirmed', () => {
  it('no distinctive letter (Иван) → ambiguous (cannot tell UA from RU by letters)', () => {
    expect(isNameSourceScriptAmbiguous('Иван', RU_ON)).toBe(true)
    expect(isNameSourceScriptAmbiguous('Наталья', RU_ON)).toBe(true) // ь/я shared
  })
  it('distinctive UA letter (Іван, і) → NOT ambiguous → KMU-55', () => {
    expect(isNameSourceScriptAmbiguous('Іван', RU_ON)).toBe(false)
  })
  it('distinctive RU letter (Эдуард, э) → NOT ambiguous → BGN/PCGN', () => {
    expect(isNameSourceScriptAmbiguous('Эдуард', RU_ON)).toBe(false)
  })
  it('feature OFF → never raises the gate (legacy KMU-55-for-all)', () => {
    expect(isNameSourceScriptAmbiguous('Иван', RU_OFF)).toBe(false)
  })
  it('empty input → not ambiguous (nothing to review)', () => {
    expect(isNameSourceScriptAmbiguous('', RU_ON)).toBe(false)
  })
})

describe('ambiguous source does NOT final (owner gate #7)', () => {
  it('a review-required ambiguous name field gets finalValue = null at the C3 door', () => {
    // The reader sets review_required=true + reason source_script_ambiguous; C3
    // (applyOcrFieldSafety) must then refuse to write a finalValue for it.
    const res = applyOcrFieldSafety(
      [
        {
          field: 'given_name',
          value: 'Ivan', // best-effort KMU-55 candidate — must NOT be finalized
          raw_cyrillic: 'Иван',
          review_required: true,
          review_reasons: ['source_script_ambiguous'],
        },
      ] as never[],
      { flow: 'translation_public', document_class: 'birth_certificate_soviet_bilingual' },
    )
    const f = (res.fields as Array<{ field: string; finalValue?: string | null }>).find(
      (x) => x.field === 'given_name',
    )
    expect(f?.finalValue ?? null).toBeNull() // ambiguity blocks final
  })

  it('a CONFIRMED-script applicant name with a strong source anchor IS allowed to finalize', () => {
    // Іван has the distinctive UA letter → not ambiguous. With a strong source
    // anchor (owner gate #4: passport/MRZ controls applicant identity) and a
    // non-hard-case class, it finalizes — proving the gate is specific to
    // ambiguity, not a blanket block on names.
    const res = applyOcrFieldSafety(
      [{ field: 'given_name', value: 'Ivan', raw_cyrillic: 'Іван', review_required: false }] as never[],
      { flow: 'translation_public', document_class: 'passport', strong_source_anchor: true },
    )
    const f = (res.fields as Array<{ field: string; finalValue?: string | null }>).find(
      (x) => x.field === 'given_name',
    )
    expect(f?.finalValue).toBe('Ivan')
  })
})
