/**
 * knowledgeDictionaryLive — the D2 dictionary is now ON by default. These pin
 * the corrections from the owner's birth-certificate test so they can't regress:
 * oblast genitive→English nominative, ЗАГС→Civil Registry, Міліція→Militsiya.
 * Synthetic Ukrainian inputs only.
 */
import { describe, it, expect } from 'vitest'
import { applyKnowledgeBrainIfEnabled, buildKnowledgeContext } from '../knowledgeBrain'
import type { FieldCandidate } from '../types'

const c = (key: string, value: string): FieldCandidate =>
  ({ key, value, source: 'ai_vision', confidence: 0.9, provider: 'gemini' } as FieldCandidate)
const ctx = buildKnowledgeContext({ docTypeId: 'ua_birth_certificate', product: 'translation' })

describe('knowledge dictionary LIVE (default ON) — owner birth-cert examples', () => {
  it('oblast genitive → English nominative Oblast', () => {
    const out = applyKnowledgeBrainIfEnabled([c('oblast', 'Вінницької області')], ctx)
    const f = out.find((x) => x.key === 'oblast')!
    expect(f.normalizedValue).toContain('Vinnytsia')
    expect(f.normalizedValue).not.toMatch(/Vynnyts?kaia|Винниц/i) // not the Russified genitive
  })

  it('Kirovohrad oblast genitive → nominative', () => {
    const out = applyKnowledgeBrainIfEnabled([c('oblast', 'Кіровоградської області')], ctx)
    const f = out.find((x) => x.key === 'oblast')!
    expect(f.normalizedValue).toContain('Kirovohrad')
  })

  it('ЗАГС agency → Civil Registry (not raw transliteration)', () => {
    const out = applyKnowledgeBrainIfEnabled([c('issuing_authority', 'райвідділ ЗАГСу')], ctx)
    const f = out.find((x) => x.key === 'issuing_authority')!
    expect(f.normalizedValue).toMatch(/Civil Registry/i)
  })

  it('Міліція → Militsiya, never Police', () => {
    const out = applyKnowledgeBrainIfEnabled([c('issuing_authority', 'Міліція')], ctx)
    const f = out.find((x) => x.key === 'issuing_authority')!
    expect(f.normalizedValue).toBe('Militsiya')
    expect(f.normalizedValue).not.toMatch(/Police/i)
  })
})
