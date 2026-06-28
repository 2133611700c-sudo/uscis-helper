/**
 * Phase 7 — normalize/translate the split fields via the knowledge codex.
 *
 * Proves:
 *  - flag UNIFIED_DOC_CONTRACT_NORMALIZE_ENABLED defaults OFF → identity;
 *  - ON normalizes ONLY the split rows through packages/knowledge (no parallel dict);
 *  - strict layering: raw_cyrillic (RAW) untouched; value = NORMALIZED/TRANSLATED;
 *  - district/oblast are PRESERVED, not collapsed or abbreviated;
 *  - settlement type → designator (смт = "urban-type settlement", NEVER city);
 *  - no guessing: locked fields (series/number/republic) stay verbatim + review.
 *
 * Fictional data only.
 */
import { describe, it, expect } from 'vitest'
import { applyContractSplitFlow, normalizeContractSplitFields } from '../contractFieldFlow'
import type { FieldOut } from '@/lib/canonical/core/translationAdapter'

const SPLIT_ON = { UNIFIED_DOC_CONTRACT_SPLIT_ENABLED: '1' } as Record<string, string | undefined>
const NORM_OFF = {} as Record<string, string | undefined>
const NORM_ON = { UNIFIED_DOC_CONTRACT_NORMALIZE_ENABLED: '1' } as Record<string, string | undefined>

// A birth-cert field set with Cyrillic raw on the mergeable fields.
const BASE: FieldOut[] = [
  { field: 'place_of_birth_city', value: '', raw_cyrillic: 'смт Лісове, Тростянецький район, Вінницька область, УРСР', confidence: 0.7, review_required: true, kind: 'place_city' },
  { field: 'issuing_authority', value: '', raw_cyrillic: 'Тростянецький РАЦС, Вінницька область', confidence: 0.7, review_required: true, kind: 'agency' },
  { field: 'certificate_series_number', value: 'II-BK 530174', raw_cyrillic: 'II-ВК 530174', confidence: 0.8, review_required: true, kind: 'doc_number' },
]
const SPLIT = applyContractSplitFlow(BASE, 'ua_birth_certificate', SPLIT_ON)

describe('Phase 7 — flag default + OFF identity', () => {
  it('UNIFIED_DOC_CONTRACT_NORMALIZE_ENABLED OFF → identity (same reference)', () => {
    expect(normalizeContractSplitFields(SPLIT, NORM_OFF)).toBe(SPLIT)
  })
})

describe('Phase 7 — ON normalizes split rows via knowledge', () => {
  const out = normalizeContractSplitFields(SPLIT, NORM_ON)
  const get = (k: string) => out.find((f) => f.field === k)!

  it('oblast → genitive→nominative DMS English, raw preserved (district/oblast NOT collapsed)', () => {
    const obl = get('place_of_birth_oblast')
    expect(obl.raw_cyrillic).toBe('Вінницька область') // RAW untouched
    expect(obl.value).toMatch(/Vinnytsia Oblast/i)     // NORMALIZED/TRANSLATED
  })

  it('settlement type → designator, NEVER "city"/"town"', () => {
    const t = get('place_of_birth_settlement_type')
    expect(t.value?.toLowerCase()).not.toMatch(/\b(city|town)\b/)
    expect(t.value?.toLowerCase()).toMatch(/settlement|смт|urban/)
  })

  it('non-split rows are left untouched', () => {
    for (const f of BASE) {
      const same = out.find((x) => x.field === f.field)!
      expect(same.value).toBe(f.value)
      expect(same.raw_cyrillic).toBe(f.raw_cyrillic)
    }
  })

  it('locked fields (series/number) are NOT guessed/translated — verbatim + review', () => {
    const ser = get('document_series')
    expect(ser.value).toBe('II-BK')          // verbatim, not translated
    expect(ser.raw_cyrillic).toBe('II-ВК')   // raw preserved
    expect(ser.review_required).toBe(true)
  })

  it('every split row stays review_required (best-effort structural + normalized)', () => {
    for (const f of out.filter((x) => x.review_reasons?.includes('contract_split_field'))) {
      expect(f.review_required).toBe(true)
    }
  })
})
