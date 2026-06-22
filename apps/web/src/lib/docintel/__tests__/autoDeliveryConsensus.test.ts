import { describe, it, expect } from 'vitest'
import { applyConsensusAutoDelivery, snapshotOf, type ConsensusField } from '@/lib/docintel/autoDeliveryConsensus'

const F = (field: string, raw: string | null, value: string | null, confidence = 0.95, review_reasons?: string[]): ConsensusField =>
  ({ field, raw_cyrillic: raw, value, confidence, review_required: true, ...(review_reasons ? { review_reasons } : {}) })

describe('auto-delivery consensus (conservative: only lower review when verifiably reliable)', () => {
  it('AGREE + high conf + clean → auto-deliver (review_required=false)', () => {
    const fields = [F('family_name', 'Куроп’ятник', 'Kuropiatnyk', 0.97)]
    const others = [snapshotOf([{ field: 'family_name', raw_cyrillic: 'КУРОП’ЯТНИК' }])] // case-insensitive agree
    const r = applyConsensusAutoDelivery(fields, others)
    expect(r.fields[0].review_required).toBe(false)
    expect(r.auto_delivered).toBe(1)
  })
  it('DISAGREE across reads → stays review + cross_read_disagreement', () => {
    const fields = [F('dob', '28 июля 1986', '07/28/1986', 0.96)]
    const others = [snapshotOf([{ field: 'dob', raw_cyrillic: '25 червня 1986' }])] // month differs
    const r = applyConsensusAutoDelivery(fields, others)
    expect(r.fields[0].review_required).toBe(true)
    expect(r.fields[0].review_reasons).toContain('cross_read_disagreement')
  })
  it('LOW confidence → stays review even if agrees', () => {
    const fields = [F('patronymic', 'Сергійович', 'Serhiiovych', 0.70)]
    const others = [snapshotOf([{ field: 'patronymic', raw_cyrillic: 'Сергійович' }])]
    const r = applyConsensusAutoDelivery(fields, others)
    expect(r.fields[0].review_required).toBe(true)
    expect(r.fields[0].review_reasons).toContain('low_confidence')
  })
  it('HARD reason (source_script_ambiguous) → never auto-delivered even if agrees+confident', () => {
    const fields = [F('given_name', 'Петрова', 'Petrova', 0.99, ['source_script_ambiguous'])]
    const others = [snapshotOf([{ field: 'given_name', raw_cyrillic: 'Петрова' }])]
    const r = applyConsensusAutoDelivery(fields, others)
    expect(r.fields[0].review_required).toBe(true)
  })
  it('null value → review', () => {
    const fields = [F('dob', null, null, 0.0, ['not_read_manual_entry'])]
    const r = applyConsensusAutoDelivery(fields, [snapshotOf([{ field: 'dob', raw_cyrillic: null }])])
    expect(r.fields[0].review_required).toBe(true)
  })
  it('mixed doc: stable name auto-delivers, unstable date reviews (per-field granularity)', () => {
    const fields = [
      F('family_name', 'Куроп’ятник', 'Kuropiatnyk', 0.97),
      F('dob', '28 июля 1986', '07/28/1986', 0.96),
    ]
    const others = [snapshotOf([
      { field: 'family_name', raw_cyrillic: 'Куроп’ятник' },
      { field: 'dob', raw_cyrillic: '25 червня 1986' },
    ])]
    const r = applyConsensusAutoDelivery(fields, others)
    expect(r.fields.find((f) => f.field === 'family_name')!.review_required).toBe(false)
    expect(r.fields.find((f) => f.field === 'dob')!.review_required).toBe(true)
    expect(r.auto_delivered).toBe(1)
    expect(r.reviewed).toBe(1)
  })
})
