/**
 * cropContract.test.ts — Step-6 single deterministic crop contract.
 * The runtime uses ONE frozen box per handwritten field (no best-of-3-after-GT selection).
 * This locks the recipe so research↔runtime can't silently diverge again:
 *   - exact frozen normalized coords (a change here is a deliberate, reviewed edit)
 *   - all boxes well-formed (0..1, left<right, top<bottom)
 *   - NO intra-document field-box overlap (the bug that produced "гей Сергеевич")
 */
import { describe, it, expect } from 'vitest'
import { FIELD_BOX_TEMPLATES } from '../handwrittenFieldRoute'

describe('Step-6: deterministic crop contract', () => {
  it('ua_birth_certificate boxes are FROZEN to the verified values', () => {
    expect(FIELD_BOX_TEMPLATES.ua_birth_certificate).toEqual({
      family_name: [0.2326, 0.2277, 0.5451, 0.2923],
      given_name: [0.1308, 0.2923, 0.2447, 0.3617],
      patronymic: [0.2641, 0.2923, 0.4482, 0.3617], // tightened 2026-06-25 (no given-name overlap)
    })
  })

  it('every box is well-formed: 0..1, left<right, top<bottom', () => {
    for (const [doc, fields] of Object.entries(FIELD_BOX_TEMPLATES)) {
      for (const [field, [l, t, r, b]] of Object.entries(fields)) {
        const where = `${doc}.${field}`
        for (const v of [l, t, r, b]) { expect(v, where).toBeGreaterThanOrEqual(0); expect(v, where).toBeLessThanOrEqual(1) }
        expect(r, `${where} left<right`).toBeGreaterThan(l)
        expect(b, `${where} top<bottom`).toBeGreaterThan(t)
      }
    }
  })

  it('no two field boxes in a document overlap (rectangles disjoint)', () => {
    const overlaps = (a: number[], c: number[]) =>
      a[0] < c[2] && c[0] < a[2] && a[1] < c[3] && c[1] < a[3]
    for (const [doc, fields] of Object.entries(FIELD_BOX_TEMPLATES)) {
      const entries = Object.entries(fields)
      for (let i = 0; i < entries.length; i++)
        for (let j = i + 1; j < entries.length; j++)
          expect(overlaps(entries[i][1], entries[j][1]), `${doc}: ${entries[i][0]} overlaps ${entries[j][0]}`).toBe(false)
    }
  })
})
