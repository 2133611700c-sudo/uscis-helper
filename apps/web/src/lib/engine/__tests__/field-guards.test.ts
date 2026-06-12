/**
 * field-guards.test.ts — audit #7/#8/#9: the "missing instruments" on the most
 * filing-critical fields (numbers, dates, sex).
 */
import { describe, it, expect } from 'vitest'
import { formatDateEn } from '../terminologist'
import { normalize } from '../orchestrator'
import type { DocFieldSpec } from '../docTypes'
import type { ConsensusField } from '../consensus'

const cf = (value: string): ConsensusField => ({ field: 'x', value, can_read: true, confidence: 0.9, review_required: false, reason: 't', candidates: [] })
const spec = (kind: DocFieldSpec['kind']): DocFieldSpec => ({ key: 'k', label_uk: [], kind, cls: 'closed', handwritten: true })

describe('#8 — date calendar validation', () => {
  it('rejects impossible calendar dates (32.02.1986)', () => {
    expect(formatDateEn('32.02.1986')).toBeNull()
    expect(formatDateEn('2011-13-05')).toBeNull()
    expect(formatDateEn('30.02.2000')).toBeNull()
  })
  it('accepts real dates incl. leap day', () => {
    expect(formatDateEn('01.01.1990')).toBe('1 January 1990')
    expect(formatDateEn('29.02.2000')).toBe('29 February 2000') // leap
    expect(formatDateEn('1990-01-01')).toBe('1 January 1990')
  })
  it('rejects Feb 29 on a non-leap year', () => {
    expect(formatDateEn('29.02.2001')).toBeNull()
  })
})

describe('#9 — sex never defaults to Male', () => {
  it('unreadable sex → empty + review (not Male)', () => {
    const r = normalize(spec('sex'), cf('???'), { sex: 'M' })
    expect(r.latin).toBe('')
    expect(r.review).toBe(true)
  })
  it('clear female/male map correctly', () => {
    expect(normalize(spec('sex'), cf('жін.'), { sex: 'F' }).latin).toBe('Female')
    expect(normalize(spec('sex'), cf('чол.'), { sex: 'M' }).latin).toBe('Male')
  })
})

describe('#7 — number homoglyph guard', () => {
  it('flags a Cyrillic homoglyph inside the digit run', () => {
    const r = normalize(spec('number'), cf('СО 84562З'), { sex: 'M' }) // trailing Cyrillic З for 3
    expect(r.review).toBe(true)
  })
  it('clean number with Cyrillic series prefix is not falsely flagged', () => {
    const r = normalize(spec('number'), cf('СО 845621'), { sex: 'M' })
    expect(r.review).toBe(false)
  })
})
