import { describe, it, expect } from 'vitest'
import { analyze, brainHealth } from '../index'
import type { EngineResult } from '../../engine/orchestrator'

// fake recognizer (no real APIs) — returns a canonical EngineResult
const fakeRecognize = (..._a: any[]): Promise<EngineResult> => Promise.resolve({
  doc_type_id: 'ua_marriage_certificate', models: ['fake'], auto_accepted: 1, needs_human: 1,
  fields: [
    { field: 'husband_full_name', cyrillic: 'Заставний Андрій Іванович', latin: 'Zastavnyi Andrii Ivanovych', can_read: true, review_required: true, source: 'KMU-55', candidates: [] },
    { field: 'date_of_marriage', cyrillic: '25 лютого 2011', latin: '25 February 2011', can_read: true, review_required: false, source: 'date→EN', candidates: [] },
  ],
})
const doc = { docTypeId: 'ua_marriage_certificate', image: Buffer.from('x'), mime: 'image/jpeg' }

describe('central brain — routing + C3 wiring', () => {
  it('health: translation/reparole/ead migrated (3)', () => {
    const h = brainHealth()
    expect(h.migrated_count).toBe(3)
    expect(h.products.tps.migrated).toBe(false)
  })

  it('health: D-GLOSSARY catalog present with full provenance', () => {
    const h = brainHealth()
    expect(h.glossary.total).toBeGreaterThan(15)
    expect(h.glossary.provenance_complete).toBe(true) // every entry has a source_url
    expect(h.glossary.categories.length).toBeGreaterThan(5)
  })
  it('migrated product runs recognize → fields + auditId + official source', async () => {
    const r = await analyze({ product: 'translation', locale: 'ru', documents: [doc] }, { recognize: fakeRecognize })
    expect(r.migrated).toBe(true)
    expect(r.recognizedFields.length).toBe(2)
    expect(r.officialSourcesUsed).toContain('КМУ №1025 (10.11.2010)')
    expect(r.auditId).toMatch(/^aud_translation_/)
  })
  it('EAD: category from confirmed basis present; without basis NOT guessed', async () => {
    const withBasis = await analyze({ product: 'ead', locale: 'ru', userCorrections: { eligibility_basis: 'tps' }, documents: [doc] }, { recognize: fakeRecognize })
    expect(withBasis.recognizedFields.find(f => f.field === 'eligibility_category')!.can_read).toBe(true)
    const noBasis = await analyze({ product: 'ead', locale: 'ru', documents: [doc] }, { recognize: fakeRecognize })
    expect(noBasis.recognizedFields.find(f => f.field === 'eligibility_category')!.can_read).toBe(false)
  })
  it('migrated without recognize AND without keys → throws (no silent path)', async () => {
    await expect(analyze({ product: 'translation', locale: 'ru', documents: [doc] }, {})).rejects.toThrow(/geminiApiKey|gvApiKey|recognize/)
  })
  it('un-migrated (tps) → delegated_to_legacy', async () => {
    const r = await analyze({ product: 'tps', locale: 'ru', documents: [] })
    expect(r.productReadiness).toBe('delegated_to_legacy')
  })
  it('unknown product throws', async () => {
    await expect(analyze({ product: 'xx' as any, locale: 'ru', documents: [] })).rejects.toThrow()
  })
})
