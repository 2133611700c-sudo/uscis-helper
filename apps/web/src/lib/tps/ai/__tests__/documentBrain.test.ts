/**
 * documentBrain tests — DS.1 / TPS AI Document Brain V1.
 *
 * No live DeepSeek calls — every test injects a stub chatFn. This makes
 * the suite fast, deterministic, and free.
 *
 * Locked guards:
 *   1. Brain refuses to run when TPS_AI_BRAIN_ENABLED is unset and no
 *      stub is provided (NOT_CONFIGURED).
 *   2. Brain rejects too-short input (EMPTY_INPUT).
 *   3. Brain parses fenced and bare JSON.
 *   4. Brain rejects non-JSON responses (INVALID_JSON).
 *   5. Brain rejects schema-violating JSON (SCHEMA_VIOLATION).
 *   6. Hardening: Cyrillic source value always produces Latin final_value
 *      via KMU-55, even if the Brain claimed something different.
 *   7. validateBrainField rejects Cyrillic-leaked final_value.
 *   8. validateBrainField rejects bad dates / shapes.
 *   9. Name fields trigger nameNormalizer review when mixed-script.
 */

import { describe, it, expect } from 'vitest'

import {
  runBrain,
  validateBrainField,
  extractJsonObject,
  DocumentBrainResultSchema,
  type DocumentBrainField,
} from '../documentBrain'

const makeStub = (response: string) => async () => ({ content: response })

describe('runBrain — gating', () => {
  it('refuses when brain not enabled and without stub', async () => {
    // Defensively clear both env vars — gate now keys off DEEPSEEK_API_KEY.
    const prevFlag = process.env.TPS_AI_BRAIN_ENABLED
    const prevKey = process.env.DEEPSEEK_API_KEY
    delete process.env.TPS_AI_BRAIN_ENABLED
    delete process.env.DEEPSEEK_API_KEY
    try {
      const out = await runBrain({ raw_text: 'long enough text input here' })
      expect(out.ok).toBe(false)
      if (!out.ok) expect(out.error_code).toBe('NOT_CONFIGURED')
    } finally {
      if (prevFlag !== undefined) process.env.TPS_AI_BRAIN_ENABLED = prevFlag
      if (prevKey !== undefined) process.env.DEEPSEEK_API_KEY = prevKey
    }
  })

  it('refuses too-short input even with stub', async () => {
    const out = await runBrain({
      raw_text: 'short',
      chatFn: makeStub('{"document_type":"unknown","document_type_confidence":0.5}'),
    })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error_code).toBe('EMPTY_INPUT')
  })
})

describe('runBrain — parsing', () => {
  it('parses bare JSON response', async () => {
    const out = await runBrain({
      raw_text: 'P<UKRSHEVCHENKO<<TARAS<<<<<<<<<<<<<<<<<<<<<<<<<',
      chatFn: makeStub(
        JSON.stringify({
          document_type: 'international_passport',
          document_type_confidence: 0.95,
          fields: {
            family_name: {
              source_value: 'SHEVCHENKO',
              final_value: 'Shevchenko',
              confidence: 0.95,
              source_line: 'P<UKR SHEVCHENKO<<TARAS',
              requires_review: false,
            },
          },
          warnings: [],
          needs_manual_review: false,
        }),
      ),
    })
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.result.document_type).toBe('international_passport')
      expect(out.result.fields.family_name?.final_value).toBe('Shevchenko')
    }
  })

  it('parses fenced JSON response', async () => {
    const fenced = '```json\n{"document_type":"unknown","document_type_confidence":0.4,"fields":{},"warnings":["no_match"],"needs_manual_review":true}\n```'
    const out = await runBrain({
      raw_text: 'some random document text without identifying features',
      chatFn: makeStub(fenced),
    })
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.result.document_type).toBe('unknown')
      expect(out.result.warnings).toContain('no_match')
    }
  })

  it('rejects non-JSON response', async () => {
    const out = await runBrain({
      raw_text: 'long enough document text here',
      chatFn: makeStub('Sorry, I cannot process this document.'),
    })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error_code).toBe('INVALID_JSON')
  })

  it('rejects schema-violating JSON', async () => {
    const out = await runBrain({
      raw_text: 'long enough document text here',
      chatFn: makeStub('{"document_type":"banana","document_type_confidence":2.0}'),
    })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error_code).toBe('SCHEMA_VIOLATION')
  })
})

describe('runBrain — hardening / KMU-55 enforcement', () => {
  it('overrides Brain-claimed final_value with KMU-55 from source_value', async () => {
    // The Brain claims final_value: "Shevсhenko" (with Cyrillic с).
    // Our hardening must overwrite it with the deterministic KMU-55 form.
    const out = await runBrain({
      raw_text: 'Шевченко Тарас Григорович паспорт громадянина',
      chatFn: makeStub(
        JSON.stringify({
          document_type: 'ukrainian_internal_passport',
          document_type_confidence: 0.9,
          fields: {
            family_name: {
              source_value: 'Шевченко',
              // Deliberately wrong final — has a Cyrillic с in the middle.
              final_value: 'Shevсhenko',
              confidence: 0.92,
              source_line: 'Прізвище Шевченко',
              requires_review: false,
            },
          },
          warnings: [],
          needs_manual_review: false,
        }),
      ),
    })
    expect(out.ok).toBe(true)
    if (out.ok) {
      // KMU-55 output is pure Latin, no Cyrillic in final.
      expect(out.result.fields.family_name?.final_value).toBe('Shevchenko')
      // The disagreement triggered requires_review.
      expect(out.result.fields.family_name?.requires_review).toBe(true)
    }
  })

  it('flags low-confidence fields as requires_review even if Brain said false', async () => {
    const out = await runBrain({
      raw_text: 'passport text with low quality scan blah blah blah',
      chatFn: makeStub(
        JSON.stringify({
          document_type: 'international_passport',
          document_type_confidence: 0.8,
          fields: {
            given_name: {
              source_value: 'TARAS',
              final_value: 'Taras',
              confidence: 0.5, // below 0.7 threshold
              source_line: 'TARAS',
              requires_review: false,
            },
          },
          warnings: [],
          needs_manual_review: false,
        }),
      ),
    })
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.result.fields.given_name?.requires_review).toBe(true)
    }
  })
})

describe('validateBrainField — deterministic rules', () => {
  const baseField = (final_value: string, source_value = final_value): DocumentBrainField => ({
    source_value,
    final_value,
    confidence: 0.95,
    source_line: null,
    requires_review: false,
  })

  it('rejects final_value with residual Cyrillic', () => {
    const res = validateBrainField('family_name', baseField('Шевченко'))
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/cyrillic/i)
  })

  it('accepts a valid DOB MM/DD/YYYY', () => {
    const res = validateBrainField('dob', baseField('07/12/1985'))
    expect(res.ok).toBe(true)
  })

  it('rejects a DOB in the future', () => {
    const future = new Date(Date.now() + 365 * 86_400_000)
    const mm = String(future.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(future.getUTCDate()).padStart(2, '0')
    const yyyy = future.getUTCFullYear()
    const res = validateBrainField('dob', baseField(`${mm}/${dd}/${yyyy}`))
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/future/i)
  })

  it('rejects A-number with non-digit length out of range', () => {
    const res = validateBrainField('a_number', baseField('12345'))
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/a_number/i)
  })

  it('accepts a valid EAD category', () => {
    const res = validateBrainField('ead_category_on_card', baseField('c19'))
    expect(res.ok).toBe(true)
  })

  it('rejects mangled EAD category', () => {
    const res = validateBrainField('ead_category_on_card', baseField('CCCC'))
    expect(res.ok).toBe(false)
  })

  it('rejects sex outside M/F/X', () => {
    const res = validateBrainField('sex', baseField('Q'))
    expect(res.ok).toBe(false)
  })
})

describe('extractJsonObject', () => {
  it('extracts from fenced ```json block', () => {
    const out = extractJsonObject('preamble\n```json\n{"a":1}\n```\nafter')
    expect(out).toEqual({ a: 1 })
  })

  it('extracts first balanced object from mixed text', () => {
    const out = extractJsonObject('Sure! {"a":2,"b":{"c":3}} done.')
    expect(out).toEqual({ a: 2, b: { c: 3 } })
  })

  it('returns null on no object', () => {
    const out = extractJsonObject('no JSON here at all')
    expect(out).toBeNull()
  })

  it('handles strings with braces inside', () => {
    const out = extractJsonObject('{"text":"hello { world }","n":7}')
    expect(out).toEqual({ text: 'hello { world }', n: 7 })
  })
})

describe('schema export sanity', () => {
  it('rejects extra unknown document_type', () => {
    const r = DocumentBrainResultSchema.safeParse({
      document_type: 'not_a_real_type',
      document_type_confidence: 0.5,
    })
    expect(r.success).toBe(false)
  })

  it('accepts minimal valid shape', () => {
    const r = DocumentBrainResultSchema.safeParse({
      document_type: 'unknown',
      document_type_confidence: 0.1,
    })
    expect(r.success).toBe(true)
  })
})
