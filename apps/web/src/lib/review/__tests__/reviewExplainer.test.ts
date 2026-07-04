/**
 * reviewExplainer — blueprint #5. FICTIONAL data only; fetch injected.
 * Pins: deterministic glossary is the base (free, offline); DeepSeek is strict-flag prose
 * only over keys+codes (key ≠ permission, L3); fail-open null; no values ever sent.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  explainReviewReasons,
  deepseekComposeReviewSummary,
  isDeepseekReviewExplainerEnabled,
} from '../reviewExplainer'

describe('explainReviewReasons — deterministic, free, offline', () => {
  it('known codes map to reviewer instructions; unknown codes get the generic line', () => {
    const out = explainReviewReasons([
      { field: 'dob', reasons: ['critic:dob_in_future', 'some_new_code'] },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].explanations.some((e) => e.includes('birth date is in the future'))).toBe(true)
    expect(out[0].explanations.some((e) => e.includes('Flagged for review'))).toBe(true)
  })

  it('fields without reasons are dropped; duplicate explanations dedupe', () => {
    const out = explainReviewReasons([
      { field: 'given_name', reasons: [] },
      { field: 'family_name', reasons: ['unknown_a', 'unknown_b'] },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].field).toBe('family_name')
    expect(out[0].explanations).toHaveLength(1) // both unknown → one generic line
  })
})

describe('deepseekComposeReviewSummary — strict flag, prose-only, fail-open', () => {
  const FIELDS = [{ field: 'dob', reasons: ['zoom_mismatch'] }]

  it("flag absent/'true' → null without calling (key ≠ permission)", async () => {
    const f = vi.fn()
    expect(await deepseekComposeReviewSummary(FIELDS, f as never, { DEEPSEEK_API_KEY: 'k' })).toBeNull()
    expect(
      await deepseekComposeReviewSummary(FIELDS, f as never, { DEEPSEEK_API_KEY: 'k', DEEPSEEK_REVIEW_EXPLAINER: 'true' }),
    ).toBeNull()
    expect(f).not.toHaveBeenCalled()
    expect(isDeepseekReviewExplainerEnabled({ DEEPSEEK_REVIEW_EXPLAINER: '1' })).toBe(true)
  })

  it("flag '1' + key → sends ONLY keys+codes; returns the prose", async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Check the date region first.' } }] }),
    })
    const v = await deepseekComposeReviewSummary(FIELDS, f as never, {
      DEEPSEEK_REVIEW_EXPLAINER: '1', DEEPSEEK_API_KEY: 'k',
    })
    expect(v).toBe('Check the date region first.')
    const body = (f.mock.calls[0][1] as { body: string }).body
    expect(body).toContain('zoom_mismatch')
    expect(body).toContain('dob') // nested-JSON escaped as \"dob\" — key present either way
  })

  it('provider error / empty payload → null (deterministic glossary remains the truth)', async () => {
    const down = vi.fn().mockRejectedValue(new Error('down'))
    expect(
      await deepseekComposeReviewSummary(FIELDS, down as never, { DEEPSEEK_REVIEW_EXPLAINER: '1', DEEPSEEK_API_KEY: 'k' }),
    ).toBeNull()
    const f = vi.fn()
    expect(
      await deepseekComposeReviewSummary([], f as never, { DEEPSEEK_REVIEW_EXPLAINER: '1', DEEPSEEK_API_KEY: 'k' }),
    ).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })
})
