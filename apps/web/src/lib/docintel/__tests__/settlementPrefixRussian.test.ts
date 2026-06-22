/**
 * settlementPrefixRussian.test.ts — regression for a real defect found on the owner's
 * 1986 Soviet birth certificate: «пгт. Тростянец» released as
 * "urban-type settlement pht. Trostianets" (the Russian settlement abbreviation
 * «пгт» was not stripped, so it leaked transliterated as "pht."). The designator
 * dictionary already knew пгт = urban-type settlement; only stripSettlementPrefix
 * lacked the Russian forms. Fixed in transliterationPolicy.stripSettlementPrefix.
 */
import { describe, it, expect } from 'vitest'
import { stripSettlementPrefix, toCanonicalValue } from '@/lib/docintel/transliterationPolicy'

const mk = (cy: string) => ({ field: 'place', cyrillic: cy, can_read: true, confidence: 0.9, reason: '', iso_date: null })

describe('settlement prefix — Russian forms (пгт) stripped like Ukrainian (смт)', () => {
  it('strips пгт / п.г.т. / посёлок городского типа', () => {
    expect(stripSettlementPrefix('пгт. Тростянец')).toBe('Тростянец')
    expect(stripSettlementPrefix('пгт Тростянец')).toBe('Тростянец')
    expect(stripSettlementPrefix('п.г.т. Вишневое')).toBe('Вишневое')
    expect(stripSettlementPrefix('посёлок городского типа Тростянец')).toBe('Тростянец')
    expect(stripSettlementPrefix('поселок городского типа Тростянец')).toBe('Тростянец')
  })
  it('Ukrainian смт still stripped (no regression)', () => {
    expect(stripSettlementPrefix('смт. Тростянець')).toBe('Тростянець')
    expect(stripSettlementPrefix('смт Вишневе')).toBe('Вишневе')
  })
  it('place_city value has NO "pht" residue and yields Trostianets', () => {
    const v = toCanonicalValue(mk('пгт. Тростянец') as never, 'place_city')
    expect(v).not.toMatch(/pht/i)
    expect(v).toMatch(/Trostianets/i)
  })
})
