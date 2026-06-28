/**
 * Phase 6 — wire split fields into the runtime FieldOut flow (vision-extract seam).
 *
 * Proves applyContractSplitFlow is additive + flag-gated:
 *  - OFF → identity (same reference) → zero behaviour change;
 *  - ON  → original FieldOut rows untouched (raw evidence preserved) + split rows
 *          appended with raw_cyrillic + Latin value split in lockstep;
 *  - split rows are review_required=true, carry the split reason, and never
 *          overwrite an existing key (no loss / no duplication).
 *
 * Fictional data only. No OCR/model/HTR/PDF-layout touched.
 */
import { describe, it, expect } from 'vitest'
import { applyContractSplitFlow } from '../contractFieldFlow'
import type { FieldOut } from '@/lib/canonical/core/translationAdapter'

const OFF = {} as Record<string, string | undefined>
const ON = { UNIFIED_DOC_CONTRACT_SPLIT_ENABLED: '1' } as Record<string, string | undefined>

const FIELDS: FieldOut[] = [
  { field: 'child_family_name', value: 'Ivanenko', raw_cyrillic: 'Іваненко', confidence: 0.9, review_required: true, kind: 'name' },
  { field: 'certificate_series_number', value: 'II-BK 530174', raw_cyrillic: 'II-ВК 530174', confidence: 0.8, review_required: true, kind: 'doc_number' },
  { field: 'place_of_birth_city', value: 'смт Lisove, Trostianets district, Vinnytsia oblast, UkrSSR', raw_cyrillic: 'смт Лісове, Тростянецький район, Вінницька область, УРСР', confidence: 0.7, review_required: true, kind: 'place_city' },
  { field: 'issuing_authority', value: 'Trostianets Registry Office, Vinnytsia Oblast', raw_cyrillic: 'Тростянецький РАЦС, Вінницька область', confidence: 0.7, review_required: true, kind: 'agency' },
]

describe('Phase 6 — OFF identity', () => {
  it('returns the same array reference when the flag is OFF', () => {
    expect(applyContractSplitFlow(FIELDS, 'ua_birth_certificate', OFF)).toBe(FIELDS)
  })
  it('returns the same array for a non-birth docType even when ON', () => {
    expect(applyContractSplitFlow(FIELDS, 'ua_international_passport', ON)).toBe(FIELDS)
  })
})

describe('Phase 6 — ON additive', () => {
  const out = applyContractSplitFlow(FIELDS, 'ua_birth_certificate', ON)

  it('preserves every original row untouched (raw evidence kept)', () => {
    for (const orig of FIELDS) {
      const same = out.find((f) => f.field === orig.field)
      expect(same).toEqual(orig)
    }
    expect(out.length).toBeGreaterThan(FIELDS.length)
  })

  it('appends the expected split rows', () => {
    const added = out.slice(FIELDS.length).map((f) => f.field).sort()
    expect(added).toEqual([
      'document_number', 'document_series',
      'place_of_birth_district', 'place_of_birth_oblast', 'place_of_birth_republic', 'place_of_birth_settlement_type',
      'registry_office_oblast',
    ].sort())
  })

  it('splits Latin value AND Cyrillic raw in lockstep (raw/latin separation)', () => {
    const ser = out.find((f) => f.field === 'document_series')!
    expect(ser.value).toBe('II-BK')
    expect(ser.raw_cyrillic).toBe('II-ВК')
    const num = out.find((f) => f.field === 'document_number')!
    expect(num.value).toBe('530174')
    expect(num.raw_cyrillic).toBe('530174')
    const obl = out.find((f) => f.field === 'place_of_birth_oblast')!
    expect(obl.value).toBe('Vinnytsia oblast')
    expect(obl.raw_cyrillic).toBe('Вінницька область')
  })

  it('all split rows are review_required and tagged contract_split_field', () => {
    for (const f of out.slice(FIELDS.length)) {
      expect(f.review_required).toBe(true)
      expect(f.review_reasons).toContain('contract_split_field')
    }
  })

  it('never overwrites or duplicates an existing key', () => {
    const counts = new Map<string, number>()
    for (const f of out) counts.set(f.field, (counts.get(f.field) ?? 0) + 1)
    for (const [, n] of counts) expect(n).toBe(1)
  })
})
