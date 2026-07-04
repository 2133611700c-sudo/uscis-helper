/**
 * ONE-BRAIN v2 Phase 2 — TPS hint→Core mapping behind the strict TPS_CORE_HINTS allowlist.
 * Byte-identical contract: with the env absent/empty, the mapper behaves EXACTLY as the
 * historical passport/booklet-only version; extended hints route to Core only when
 * explicitly listed; `dl` never maps (no docintel spec — L6, never guess).
 */
import { describe, it, expect } from 'vitest'
import { mapTpsHintToDocintelId, tpsCoreHintAllowlist } from '../tpsAdapter'

const env = (v?: string) => (v === undefined ? {} : { TPS_CORE_HINTS: v })

describe('mapTpsHintToDocintelId — strict per-hint allowlist', () => {
  it('base hints map unconditionally (unchanged historical behavior)', () => {
    expect(mapTpsHintToDocintelId('passport', env())).toBe('ua_international_passport')
    expect(mapTpsHintToDocintelId('booklet', env())).toBe('ua_internal_passport_booklet')
  })

  it('flag absent/empty → extended hints stay null (byte-identical: legacy runs)', () => {
    for (const h of ['i94', 'ead', 'ead_old', 'i797', 'military_id', 'birth_certificate']) {
      expect(mapTpsHintToDocintelId(h, env())).toBeNull()
      expect(mapTpsHintToDocintelId(h, env(''))).toBeNull()
    }
  })

  it('listed hints route to their EXISTING docintel specs', () => {
    const e = env('i94,i797,military_id')
    expect(mapTpsHintToDocintelId('i94', e)).toBe('us_i94')
    expect(mapTpsHintToDocintelId('i797', e)).toBe('us_i797')
    expect(mapTpsHintToDocintelId('military_id', e)).toBe('ua_military_id')
    // NOT listed → still legacy
    expect(mapTpsHintToDocintelId('ead', e)).toBeNull()
    expect(mapTpsHintToDocintelId('birth_certificate', e)).toBeNull()
  })

  it('ead_old (rereg previous EAD card) maps to us_ead when listed', () => {
    expect(mapTpsHintToDocintelId('ead_old', env('ead_old'))).toBe('us_ead')
  })

  it('dl NEVER maps — no docintel spec exists (never guess, L6)', () => {
    expect(mapTpsHintToDocintelId('dl', env('dl'))).toBeNull()
    expect(mapTpsHintToDocintelId('dl', env('dl,i94,ead'))).toBeNull()
  })

  it('unknown hints stay null regardless of the allowlist', () => {
    expect(mapTpsHintToDocintelId('tps_notice', env('tps_notice'))).toBeNull()
    expect(mapTpsHintToDocintelId('i797_or_ead', env('i797_or_ead'))).toBeNull()
  })

  it('allowlist parsing: whitespace tolerated, strict membership (no substrings)', () => {
    const list = tpsCoreHintAllowlist(env(' i94 , i797 '))
    expect(list.has('i94')).toBe(true)
    expect(list.has('i797')).toBe(true)
    expect(list.has('i7')).toBe(false)
    expect(mapTpsHintToDocintelId('i94', env(' i94 , i797 '))).toBe('us_i94')
  })
})
