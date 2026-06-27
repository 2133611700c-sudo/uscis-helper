import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PRIMARY_READER, FALLBACK_MODELS, SANCTIONED_CHAIN, DEPRECATED_MODELS,
  isPrimaryReader, isSanctionedModel, acceptanceModelVerdict, assertPrimaryReader, isDisqualifiedFor,
  isHandwrittenFamily, MODEL_PROFILES,
} from '../modelMatrix'
import { primaryGeminiModel } from '../providers/geminiVisionProvider'

const __dir = dirname(fileURLToPath(import.meta.url))
const PROVIDER_SRC = readFileSync(resolve(__dir, '../providers/geminiVisionProvider.ts'), 'utf8')

describe('modelMatrix — the ADR-018 law in code', () => {
  it('primary reader is the stable gemini-2.5-pro; no removed preview is still sanctioned', () => {
    expect(PRIMARY_READER).toBe('gemini-2.5-pro')
    expect(isPrimaryReader('gemini-2.5-pro')).toBe(true)
    expect(isPrimaryReader('gemini-3.5-flash')).toBe(false)
    expect((SANCTIONED_CHAIN as readonly string[])).not.toContain('unsupported-legacy-preview')
  })

  it('the live provider default model MATCHES the matrix primary', () => {
    // primaryGeminiModel() reads GEMINI_MODEL (unset in test) → must default to PRIMARY_READER.
    delete process.env.GEMINI_MODEL
    expect(primaryGeminiModel()).toBe(PRIMARY_READER)
  })

  it('acceptanceModelVerdict: ONLY the primary read is acceptance-valid', () => {
    expect(acceptanceModelVerdict(PRIMARY_READER)).toEqual({ valid: true })
    expect(acceptanceModelVerdict('unsupported-legacy-preview')).toEqual({ valid: false, reason: 'unsanctioned_model' })
    expect(acceptanceModelVerdict('gemini-3.5-flash')).toEqual({ valid: false, reason: 'fallback_model_not_acceptance_valid' })
    expect(acceptanceModelVerdict('gemini-2.5-flash')).toEqual({ valid: false, reason: 'fallback_model_not_acceptance_valid' })
    expect(acceptanceModelVerdict('some-random-model')).toEqual({ valid: false, reason: 'unsanctioned_model' })
    expect(acceptanceModelVerdict(null)).toEqual({ valid: false, reason: 'no_model' })
  })

  it('assertPrimaryReader throws on any non-primary model', () => {
    expect(() => assertPrimaryReader(PRIMARY_READER)).not.toThrow()
    expect(() => assertPrimaryReader('gemini-3.5-flash')).toThrow(/model_matrix_violation/)
    expect(() => assertPrimaryReader(null)).toThrow(/model_matrix_violation/)
  })

  it('2.5-flash AND 2.5-pro are DISQUALIFIED for certificate doc classes (fabricate a different person on handwriting)', () => {
    expect(isDisqualifiedFor('gemini-2.5-flash', 'ua_birth_certificate')).toBe(true)
    expect(isDisqualifiedFor('gemini-2.5-flash', 'ua_marriage_certificate')).toBe(true)
    expect(isDisqualifiedFor('gemini-2.5-flash', 'ua_internal_passport_booklet')).toBe(false)
    // 2.5-pro is GA + accurate on PRINTED docs, but fabricates on handwritten certs (live bench 2026-06-23).
    expect(isDisqualifiedFor('gemini-2.5-pro', 'ua_birth_certificate')).toBe(true)
    expect(isDisqualifiedFor('gemini-2.5-pro', 'ua_death_certificate')).toBe(true)
    expect(isDisqualifiedFor('gemini-2.5-pro', 'ua_internal_passport_booklet')).toBe(false) // OK for printed
    // PRIMARY is now gemini-2.5-pro → it IS disqualified for handwritten certs, so those are force-reviewed
    // (no LLM acceptance on handwriting; reader = raxtemur per ADR-026). Printed docs stay acceptance-valid.
    expect(isDisqualifiedFor(PRIMARY_READER, 'ua_birth_certificate')).toBe(true)
    expect(isDisqualifiedFor(PRIMARY_READER, 'ua_internal_passport_booklet')).toBe(false)
  })

  it('sanctioned chain = primary (2.5-pro) + the two flash fallbacks; preview removed', () => {
    expect([...SANCTIONED_CHAIN]).toEqual(['gemini-2.5-pro', 'gemini-3.5-flash', 'gemini-2.5-flash'])
    expect([...FALLBACK_MODELS].every((m) => isSanctionedModel(m))).toBe(true)
    expect(isSanctionedModel('unsupported-legacy-preview')).toBe(false)
  })

  it('handwritten doc families are flagged for mandatory human review (any model)', () => {
    expect(isHandwrittenFamily('ua_birth_certificate')).toBe(true)
    expect(isHandwrittenFamily('ua_marriage_certificate')).toBe(true)
    expect(isHandwrittenFamily('ua_internal_passport_booklet')).toBe(false) // printed identity page
    expect(isHandwrittenFamily(null)).toBe(false)
  })

  it('MODEL_PROFILES inventory covers every sanctioned model with a tested verdict', () => {
    for (const m of SANCTIONED_CHAIN) {
      expect(MODEL_PROFILES[m], `missing profile for ${m}`).toBeTruthy()
      expect(MODEL_PROFILES[m].tested).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
    expect(MODEL_PROFILES[PRIMARY_READER].role).toBe('primary')
    expect(MODEL_PROFILES['gemini-2.5-pro'].role).toBe('primary') // 2.5-pro IS the primary now
    expect(MODEL_PROFILES['unsupported-legacy-preview']).toBeUndefined()
  })
})

describe('GUARD: the provider source obeys the matrix (no drift, no deprecated model)', () => {
  it("provider's primary default is the matrix PRIMARY_READER constant (no drift, no dead preview literal)", () => {
    // Stronger than a literal check: the provider must DEFAULT to the imported PRIMARY_READER constant
    // (so it can never drift), and must NOT hardcode the removed preview literal anywhere.
    expect(PROVIDER_SRC).toContain('PRIMARY_READER')
    expect(PROVIDER_SRC).not.toContain(`legacy-preview-primary`)
    expect(primaryGeminiModel()).toBe(PRIMARY_READER)
  })

  it('provider SOURCES its fallbacks from the matrix and filters DISQUALIFIED (no hardcoded drift)', () => {
    // Stronger than the old literal-check: the provider must IMPORT the sanctioned
    // fallback list from modelMatrix (so it can never drift from this source of
    // truth) AND filter the chain by isDisqualifiedFor, so a model disqualified for
    // a doc class (e.g. gemini-2.5-flash on a birth certificate) can never read it.
    expect(PROVIDER_SRC).toContain('FALLBACK_MODELS')
    expect(PROVIDER_SRC).toContain('isDisqualifiedFor')
    // and it must NOT re-hardcode a fallback literal (that would reintroduce drift)
    for (const m of FALLBACK_MODELS) {
      const hardcoded = PROVIDER_SRC.split('\n').some((ln) => {
        const code = ln.replace(/\/\/.*$/, '')
        return code.includes(`'${m}'`)
      })
      expect(hardcoded, `provider must not hardcode '${m}' — import it from modelMatrix`).toBe(false)
    }
  })

  it('NO deprecated model appears as an ACTIVE chain member (only allowed in a comment)', () => {
    for (const dead of DEPRECATED_MODELS) {
      // The string may appear in a "removed/deprecated" comment, but never inside the
      // returned array literal. Assert it is not present on a non-comment code line.
      const offending = PROVIDER_SRC.split('\n').filter((ln) => {
        const code = ln.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')
        return code.includes(`'${dead}'`)
      })
      expect(offending, `deprecated model ${dead} used in active code:\n${offending.join('\n')}`).toEqual([])
    }
  })
})
