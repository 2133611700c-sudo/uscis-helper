/**
 * orientationUncertainGate.test.ts — Step-5 fail-closed contract (deterministic, no live calls).
 * When content-orient is ON but detection is UNDECIDABLE (orientToUpright detected:false), the page
 * orientation is unknown → every CRITICAL field (handwritten OR required) must be review-gated with
 * 'orientation_uncertain'; the system must never silently finalize a possibly-rotated read.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Force content-orient ON + make the detector report UNDECIDABLE (detected:false, no rotation).
vi.mock('../orientation/detectOrientation', async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>)
  return {
    ...actual,
    isContentOrientEnabled: () => true,
    orientToUpright: async (buffer: Buffer) => ({ buffer, applied: 0, detected: false }),
  }
})

import { readDocument } from '../documentFieldReader'
import type { VisionProvider } from '../types'

const provider: VisionProvider = {
  name: 'mock',
  async readFields() {
    return {
      ok: true, model: 'gemini-2.5-pro', ms: 5,
      fields: [
        { field: 'child_family_name', cyrillic: 'Соловьяк', iso_date: null, can_read: true, confidence: 0.99, reason: '' },
        { field: 'child_given_name', cyrillic: 'Андрей', iso_date: null, can_read: true, confidence: 0.99, reason: '' },
        { field: 'child_patronymic', cyrillic: 'Богданович', iso_date: null, can_read: true, confidence: 0.99, reason: '' },
      ],
    } as any
  },
}

describe('Step-5 fail-closed: orientation undecidable → critical fields review-gated', () => {
  const prev = process.env.GEMINI_API_KEY_PAY
  beforeEach(() => { process.env.GEMINI_API_KEY_PAY = 'test-key-for-orient-branch' })
  afterEach(() => { if (prev === undefined) delete process.env.GEMINI_API_KEY_PAY; else process.env.GEMINI_API_KEY_PAY = prev })

  it('handwritten birth cert: undecidable orientation forces review + orientation_uncertain', async () => {
    const r = await readDocument(Buffer.from('img'), 'image/jpeg', 'ua_birth_certificate', { provider })
    expect(r.ok).toBe(true)
    const crit = r.fields.filter((f) => ['child_family_name', 'child_given_name', 'child_patronymic'].includes(f.field))
    expect(crit.length).toBeGreaterThan(0)
    for (const f of crit) {
      expect(f.review_required, `${f.field} must be review-gated`).toBe(true)
      expect(f.review_reasons ?? [], `${f.field} reason`).toContain('orientation_uncertain')
    }
  })
})
