/**
 * documentLanguageRouting.test.ts — a shared-letter surname (no і/ї/є/ґ, no ы/э/ё/ъ) is
 * AMBIGUOUS on a Soviet/bilingual certificate (name could be Russian) but NOT ambiguous on
 * a modern Ukrainian-issued ID document (the name is the citizen's official Ukrainian form).
 * This lifts auto-delivery on the most common case (passports/ID) while keeping the safe
 * review gate on certificates.
 */
import { describe, it, expect } from 'vitest'
import { isNameSourceScriptAmbiguous } from '@/lib/docintel/transliterationPolicy'
const env = { SOURCE_SCRIPT_REVIEW_ENABLED: undefined } as Record<string, string | undefined>

describe('document-language routing for the source-script ambiguity gate', () => {
  it('shared-letter surname on a Ukrainian ID doc → NOT ambiguous (Ukrainian)', () => {
    expect(isNameSourceScriptAmbiguous("Куроп'ятник", env, 'ua_internal_passport_booklet')).toBe(false)
    expect(isNameSourceScriptAmbiguous('Петренко', env, 'ua_international_passport')).toBe(false)
    expect(isNameSourceScriptAmbiguous('Петренко', env, 'ua_id_card')).toBe(false)
    expect(isNameSourceScriptAmbiguous('Петренко', env, 'ua_military_id')).toBe(false)
  })
  it('shared-letter surname on a Soviet/bilingual CERTIFICATE → STILL ambiguous (could be Russian)', () => {
    expect(isNameSourceScriptAmbiguous("Куроп'ятник", env, 'ua_birth_certificate')).toBe(true)
    expect(isNameSourceScriptAmbiguous('Петрова', env, 'ua_marriage_certificate')).toBe(true)
  })
  it('no docTypeId → safe default (ambiguous) unchanged', () => {
    expect(isNameSourceScriptAmbiguous('Петренко', env)).toBe(true)
  })
  it('distinctive UA name → never ambiguous regardless of doc', () => {
    expect(isNameSourceScriptAmbiguous('Сергій', env, 'ua_birth_certificate')).toBe(false) // has і
  })
})
