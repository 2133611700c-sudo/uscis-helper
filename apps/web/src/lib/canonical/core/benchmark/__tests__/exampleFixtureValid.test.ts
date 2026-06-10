import { describe, it, expect } from 'vitest'
import { parseFixture } from '../groundTruthFixture'
import example from '../examples/birth_certificate.example.json'
describe('committed example fixture stays valid', () => {
  it('parses', () => { expect(parseFixture(example).ok).toBe(true) })
})
