/**
 * deskew — applyDeskew threshold behavior (pure logic; below the threshold NO
 * image processing runs and the SAME buffer reference is returned).
 */

import { describe, it, expect } from 'vitest'
import { applyDeskew } from '../deskew'

describe('applyDeskew', () => {
  it('returns the same buffer reference below the 0.3° threshold', async () => {
    const buf = Buffer.from('not-really-an-image')
    const out = await applyDeskew(buf, 0.1)
    expect(out).toBe(buf) // same reference — no sharp call
  })

  it('returns the same buffer reference at exactly-below threshold (0.29°)', async () => {
    const buf = Buffer.from('x')
    expect(await applyDeskew(buf, 0.29)).toBe(buf)
    expect(await applyDeskew(buf, -0.29)).toBe(buf)
  })

  it('returns the same buffer reference for 0°', async () => {
    const buf = Buffer.from('y')
    expect(await applyDeskew(buf, 0)).toBe(buf)
  })
})
