import { describe, it, expect } from 'vitest'
import { eligibilityCategory } from '../eadCategory'
describe('I-765 eligibility category — rules, never guessed', () => {
  it('tps → (a)(12)/(c)(19)', () => expect(eligibilityCategory('tps')?.code).toMatch(/c\)\(19\)/))
  it('parole_u4u → (c)(11)', () => expect(eligibilityCategory('parole_u4u')?.code).toBe('(c)(11)'))
  it('asylum_pending → (c)(8)', () => expect(eligibilityCategory('asylum_pending')?.code).toBe('(c)(8)'))
  it('unknown/absent → null (no guess)', () => { expect(eligibilityCategory('')).toBeNull(); expect(eligibilityCategory('made_up')).toBeNull() })
})
