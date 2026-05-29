import { describe, it, expect } from 'vitest'
import { analyze, brainHealth } from '../index'
import type { NamedReader } from '../../engine/consensus'

// two independent fake readers that AGREE (consensus accepts; open names → review)
const fake = (name: string): NamedReader => ({
  name,
  read: async (_img, _mime, fields) => Object.fromEntries(fields.map((f) => [f,
    { cyrillic: f.includes('date') ? '25 лютого 2011' : f.includes('number') ? '294' : 'Заставний Андрій', can_read: true, confidence: 0.9 }])),
})

const doc = { docTypeId: 'ua_marriage_certificate', image: Buffer.from('x'), mime: 'image/jpeg' }

describe('central brain — Translation migrated (Phase 5 Step 2)', () => {
  it('health: translation migrated, count 1', () => {
    const h = brainHealth()
    expect(h.products.translation.migrated).toBe(true)
    expect(h.migrated_count).toBe(1)
  })
  it('translation runs through consensus engine → recognized fields + official source', async () => {
    const r = await analyze({ product: 'translation', locale: 'ru', documents: [doc] }, { readers: [fake('a'), fake('b')] })
    expect(r.migrated).toBe(true)
    expect(r.recognizedFields.length).toBeGreaterThan(0)
    expect(r.officialSourcesUsed).toContain('КМУ №1025 (10.11.2010)')
    expect(['ready', 'needs_review', 'incomplete']).toContain(r.productReadiness)
  })
  it('translation REJECTS a single reader (no single-AI truth-source)', async () => {
    await expect(analyze({ product: 'translation', locale: 'ru', documents: [doc] }, { readers: [fake('a')] })).rejects.toThrow(/single reader|≥2/)
  })
  it('un-migrated products → delegated_to_legacy (TPS untouched)', async () => {
    for (const p of ['tps', 'reparole_u4u', 'ead'] as const) {
      const r = await analyze({ product: p, locale: 'ru', documents: [] })
      expect(r.productReadiness).toBe('delegated_to_legacy')
    }
  })
})
