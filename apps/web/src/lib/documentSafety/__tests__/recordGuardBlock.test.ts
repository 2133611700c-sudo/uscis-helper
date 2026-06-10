/**
 * recordGuardBlock.test.ts — the flag boundary. OFF (default) ⇒ no-op that resolves
 * without constructing a client (byte-identical, zero cost). Never throws.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { isGuardBlockMetricsEnabled, recordGuardBlock } from '../recordGuardBlock'

afterEach(() => { delete process.env.GUARD_BLOCK_METRICS_ENABLED })

describe('GUARD_BLOCK_METRICS_ENABLED gate', () => {
  it('OFF by default', () => {
    delete process.env.GUARD_BLOCK_METRICS_ENABLED
    expect(isGuardBlockMetricsEnabled()).toBe(false)
    expect(isGuardBlockMetricsEnabled({ GUARD_BLOCK_METRICS_ENABLED: '1' })).toBe(true)
  })

  it('recordGuardBlock resolves without throwing when OFF (no client constructed)', async () => {
    delete process.env.GUARD_BLOCK_METRICS_ENABLED
    await expect(
      recordGuardBlock({ gate: 'confirmed_value_guard', failureType: 'user_input_invalid', docType: 'ua_birth_certificate', sessionId: 's1' }),
    ).resolves.toBeUndefined()
  })
})
