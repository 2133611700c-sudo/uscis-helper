/**
 * liveRunner.test.ts — live benchmark orchestration (fixtures; no real doc/key).
 * Proves: fake fixtures score; missing readers → BLOCKED; a failing reader is skipped.
 */
import { describe, it, expect } from 'vitest'
import { runLiveBenchmark } from '../benchmark/liveRunner'
import type { DocintelField } from '../benchmark/mappers'
import type { Td3ParseResult } from '@/lib/translation/identity/mrzParser'

const TRUTH = {
  document_id: 'd1',
  document_type: 'international_passport',
  family_name_latin: 'Kovalenko',
  given_name_latin: 'Serhii',
  passport_number: 'EK123456',
  dob: '1985-07-12',
}

const geminiFixture: DocintelField[] = [
  { field: 'surname', raw_cyrillic: 'Коваленко', value: 'Kovalenko', review_required: false },
  { field: 'given_names', raw_cyrillic: 'Сергій', value: 'Serhii', review_required: false },
]
const mrzFixture: Td3ParseResult = {
  checkDigitsValid: true, reviewRequired: false, documentType: 'P', issuingState: 'UKR',
  surname: 'KOVALENKO', givenNames: 'SERHII', documentNumber: 'EK123456', nationality: 'UKR',
  dateOfBirth: '12 July 1985', sex: 'Male', dateOfExpiry: '1 April 2030', personalNumber: null,
  checkResults: [{ field: 'document_number', valid: true }, { field: 'composite', valid: true }],
  errors: [], format: 'TD3',
}

describe('runLiveBenchmark', () => {
  it('scores with fake fixtures (gemini + mrz) → ok, PII-free summary', async () => {
    const r = await runLiveBenchmark(TRUTH, {
      gemini: async () => geminiFixture,
      mrz: async () => mrzFixture,
    })
    expect(r.status).toBe('ok')
    expect(r.ranReaders.sort()).toEqual(['gemini', 'mrz'])
    expect(r.report?.critical_wrong.mrz).toBe(0)
    expect(r.summary).toContain('mrz: critical_wrong=0')
    expect(r.summary).not.toContain('Kovalenko') // PII-free
  })

  it('no readers available → BLOCKED (never a false PASS)', async () => {
    const r = await runLiveBenchmark(TRUTH, {})
    expect(r.status).toBe('blocked')
    expect(r.report).toBeUndefined()
  })

  it('all callers return null → BLOCKED', async () => {
    const r = await runLiveBenchmark(TRUTH, { gemini: async () => null, mrz: async () => null })
    expect(r.status).toBe('blocked')
  })

  it('a failing reader is skipped, not fatal', async () => {
    const r = await runLiveBenchmark(TRUTH, {
      gemini: async () => { throw new Error('no api key') },
      mrz: async () => mrzFixture,
    })
    expect(r.status).toBe('ok')
    expect(r.ranReaders).toEqual(['mrz'])
  })
})
