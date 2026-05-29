/**
 * glossary-wiring.test.ts — G2 integration: the LIVE normalize() path now calls
 * the D-GLOSSARY registry (settlement type preserved, oblast official EN, era-gated
 * authority), with the legacy gazetteer/dictionary as fallback.
 */
import { describe, it, expect } from 'vitest'
import { normalize } from '../orchestrator'
import type { DocFieldSpec } from '../docTypes'
import type { ConsensusField } from '../consensus'

const cf = (value: string): ConsensusField => ({
  field: 'x', value, can_read: true, confidence: 0.9, review_required: false, reason: 'test', candidates: [],
})
const spec = (key: string, kind: DocFieldSpec['kind']): DocFieldSpec => ({
  key, label_uk: [], kind, cls: 'closed', handwritten: true,
})

describe('G2 — normalize() wired to Glossary Registry', () => {
  it('place_city keeps the settlement TYPE (смт → urban-type settlement) and city', () => {
    const r = normalize(spec('place_of_birth', 'place_city'), cf('смт Тростянець'), { sex: 'M' })
    expect(r.latin).toContain('Trostianets')
    expect(r.latin.toLowerCase()).toContain('urban-type settlement')
    expect(r.source).toContain('registry:settlement')
  })

  it('place_oblast → official DMS English from registry', () => {
    const r = normalize(spec('oblast_of_birth', 'place_oblast'), cf('Вінницької'), { sex: 'M' })
    expect(r.latin).toBe('Vinnytsia Oblast')
    expect(r.source).toContain('registry:oblast')
  })

  it('authority is era-gated: 1986 document keeps Militsiya, not Police', () => {
    const r = normalize(spec('issuing_authority', 'text'), cf('міліція'), { sex: 'M', documentDate: '1986' })
    expect(r.latin).toBe('Militsiya')
    expect(r.latin).not.toMatch(/police/i)
    expect(r.review).toBe(true) // historical_lock → human verifies
  })

  it('unknown place falls back without crashing (gazetteer/raw), never throws', () => {
    const r = normalize(spec('place_of_birth', 'place_city'), cf('Неведомівка'), { sex: 'M' })
    expect(typeof r.latin).toBe('string')
  })
})
