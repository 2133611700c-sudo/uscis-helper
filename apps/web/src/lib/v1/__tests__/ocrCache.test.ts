import { describe, it, expect } from 'vitest'
import { buildOcrCacheKey } from '../ocrCache'

const SHA = 'a'.repeat(64)
const parts = {
  fileSha256: SHA,
  provider: 'gemini',
  modelVersion: 'gemini-3.1-pro-preview',
  promptVersion: 'p7',
  preprocessingVersion: 'pre2',
}

describe('buildOcrCacheKey', () => {
  it('builds a deterministic key from all five parts', () => {
    const k = buildOcrCacheKey(parts)
    expect(k).toBe(`${SHA}:gemini:gemini-3.1-pro-preview:p7:pre2`)
    expect(buildOcrCacheKey(parts)).toBe(k) // deterministic
  })

  it('changes when prompt_version changes (no stale reuse across prompt changes)', () => {
    const a = buildOcrCacheKey(parts)
    const b = buildOcrCacheKey({ ...parts, promptVersion: 'p8' })
    expect(a).not.toBe(b)
  })

  it('changes when preprocessing_version changes', () => {
    expect(buildOcrCacheKey(parts)).not.toBe(buildOcrCacheKey({ ...parts, preprocessingVersion: 'pre3' }))
  })

  it('throws if any part is missing (no partial keys)', () => {
    for (const k of ['provider', 'modelVersion', 'promptVersion', 'preprocessingVersion'] as const) {
      expect(() => buildOcrCacheKey({ ...parts, [k]: '' })).toThrow(/ocr_cache_key_incomplete/)
    }
  })

  it('throws on a malformed sha256', () => {
    expect(() => buildOcrCacheKey({ ...parts, fileSha256: 'deadbeef' })).toThrow(/ocr_cache_key_invalid/)
  })
})
