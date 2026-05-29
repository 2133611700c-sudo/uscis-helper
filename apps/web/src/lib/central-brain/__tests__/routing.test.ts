import { describe, it, expect } from 'vitest'
import { analyze, brainHealth } from '../index'

describe('central brain — routing (Phase 5 Step 1, no product wired yet)', () => {
  it('health lists all 4 products with migration steps', () => {
    const h = brainHealth()
    expect(Object.keys(h.products).sort()).toEqual(['ead','reparole_u4u','tps','translation'])
    expect(h.migrated_count).toBe(0)
  })
  it('un-migrated product → delegated_to_legacy, never intercepts (TPS safe)', async () => {
    for (const p of ['tps','reparole_u4u','ead','translation'] as const) {
      const r = await analyze({ product: p, locale: 'ru', documents: [] })
      expect(r.productReadiness).toBe('delegated_to_legacy')
      expect(r.migrated).toBe(false)
    }
  })
  it('unknown product throws', async () => {
    await expect(analyze({ product: 'xx' as any, locale: 'ru', documents: [] })).rejects.toThrow()
  })
})
