import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getCanonicalMode, type CanonicalProduct } from '../continuityMode'

const PRODUCTS: CanonicalProduct[] = ['tps', 'reparole', 'ead', 'translation']
const CANONICAL_ENV_KEYS = [
  'CANONICAL_MODE_TPS',
  'CANONICAL_MODE_REPAROLE',
  'CANONICAL_MODE_EAD',
  'CANONICAL_MODE_TRANSLATION',
  'CANONICAL_MODES',
  'CANONICAL_CONTINUITY_MODE',
]

describe('getCanonicalMode', () => {
  let saved: Record<string, string | undefined>

  beforeEach(() => {
    saved = {}
    for (const k of CANONICAL_ENV_KEYS) {
      saved[k] = process.env[k]
      delete process.env[k]
    }
  })

  afterEach(() => {
    for (const k of CANONICAL_ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it('defaults to shadow for all products when no env is set', () => {
    for (const p of PRODUCTS) {
      expect(getCanonicalMode(p)).toBe('shadow')
    }
  })

  it('CANONICAL_MODE_TPS=enforce isolates to tps; others stay shadow', () => {
    process.env.CANONICAL_MODE_TPS = 'enforce'
    expect(getCanonicalMode('tps')).toBe('enforce')
    expect(getCanonicalMode('reparole')).toBe('shadow')
    expect(getCanonicalMode('ead')).toBe('shadow')
    expect(getCanonicalMode('translation')).toBe('shadow')
  })

  it('resolves per-product from CANONICAL_MODES JSON', () => {
    process.env.CANONICAL_MODES = JSON.stringify({
      tps: 'enforce',
      ead: 'enforce',
      reparole: 'enforce',
      translation: 'shadow',
    })
    expect(getCanonicalMode('tps')).toBe('enforce')
    expect(getCanonicalMode('ead')).toBe('enforce')
    expect(getCanonicalMode('reparole')).toBe('enforce')
    expect(getCanonicalMode('translation')).toBe('shadow')
  })

  it('product-scoped env beats JSON beats legacy global', () => {
    // legacy global says off, JSON says shadow, scoped says enforce → enforce
    process.env.CANONICAL_CONTINUITY_MODE = 'off'
    process.env.CANONICAL_MODES = JSON.stringify({ tps: 'shadow' })
    process.env.CANONICAL_MODE_TPS = 'enforce'
    expect(getCanonicalMode('tps')).toBe('enforce')

    // remove scoped → JSON wins over legacy global
    delete process.env.CANONICAL_MODE_TPS
    expect(getCanonicalMode('tps')).toBe('shadow')

    // remove JSON → legacy global wins
    delete process.env.CANONICAL_MODES
    expect(getCanonicalMode('tps')).toBe('off')
  })

  it('legacy CANONICAL_CONTINUITY_MODE=enforce applies to tps/reparole/ead but NOT translation (hard guard)', () => {
    process.env.CANONICAL_CONTINUITY_MODE = 'enforce'
    expect(getCanonicalMode('tps')).toBe('enforce')
    expect(getCanonicalMode('reparole')).toBe('enforce')
    expect(getCanonicalMode('ead')).toBe('enforce')
    expect(getCanonicalMode('translation')).toBe('shadow')
  })

  it('explicit CANONICAL_MODE_TRANSLATION=enforce allows translation enforce (explicit opt-in)', () => {
    process.env.CANONICAL_MODE_TRANSLATION = 'enforce'
    expect(getCanonicalMode('translation')).toBe('enforce')
  })

  it('explicit CANONICAL_MODES.translation=enforce allows translation enforce', () => {
    process.env.CANONICAL_MODES = JSON.stringify({ translation: 'enforce' })
    expect(getCanonicalMode('translation')).toBe('enforce')
  })

  it('legacy global non-enforce values pass through to translation', () => {
    process.env.CANONICAL_CONTINUITY_MODE = 'off'
    expect(getCanonicalMode('translation')).toBe('off')
  })

  it('falls through to shadow on malformed scoped value', () => {
    process.env.CANONICAL_MODE_TPS = 'banana'
    expect(getCanonicalMode('tps')).toBe('shadow')
  })

  it('falls through safely on malformed JSON', () => {
    process.env.CANONICAL_MODES = '{ not valid json'
    expect(getCanonicalMode('tps')).toBe('shadow')
  })

  it('ignores malformed JSON value and falls to legacy global', () => {
    process.env.CANONICAL_MODES = JSON.stringify({ tps: 'banana' })
    process.env.CANONICAL_CONTINUITY_MODE = 'enforce'
    expect(getCanonicalMode('tps')).toBe('enforce')
  })

  it('normalizes case/whitespace on scoped values', () => {
    process.env.CANONICAL_MODE_EAD = '  ENFORCE  '
    expect(getCanonicalMode('ead')).toBe('enforce')
  })
})
