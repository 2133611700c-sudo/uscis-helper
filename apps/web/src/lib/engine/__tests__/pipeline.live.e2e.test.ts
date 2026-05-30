/**
 * pipeline.live.e2e.test.ts — LIVE integrated E2E of the REAL recognition pipeline
 * (preprocess → gemini-3.1-pro + Google Vision → word-aware presence → registry/
 * KMU-55 normalize) on a real document. Proves "the product works", not just units.
 *
 * GATED: runs only with LIVE_E2E=1 (real paid API calls). Run once locally:
 *   LIVE_E2E=1 pnpm --filter web test -- --run src/lib/engine/__tests__/pipeline.live.e2e.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { extractDocumentPresence } from '../presence'

const LIVE = process.env.LIVE_E2E === '1'
const ROOT = path.join(__dirname, '../../../../../..') // repo root
const FIX = path.join(ROOT, 'test-fixtures/real-docs/military_id_p1_kuropiatnyk.jpg')

describe.skipIf(!LIVE)('LIVE pipeline E2E (military ID, owner fixture)', () => {
  let gem = '', gv = ''
  beforeAll(() => {
    const env = fs.readFileSync(path.join(ROOT, 'apps/web/.env.local'), 'utf8')
    const get = (k: string) => (env.match(new RegExp('^' + k + '=(.*)$', 'm'))?.[1] || '').replace(/^["']|["']$/g, '').trim()
    gem = get('GEMINI_API_KEY_PAY') || get('GEMINI_API_KEY')
    gv = get('GOOGLE_CLOUD_VISION_API_KEY') || get('GOOGLE_VISION_API_KEY')
    if (!process.env.GEMINI_MODEL) process.env.GEMINI_MODEL = get('GEMINI_MODEL') || 'gemini-3.1-pro-preview'
  }, 30000)

  it('recognizes + normalizes real Cyrillic end-to-end through the live module', async () => {
    const buf = fs.readFileSync(FIX)
    const res = await extractDocumentPresence(buf, 'image/jpeg', 'ua_military_id', { geminiApiKey: gem, gvApiKey: gv })
    const byKey = Object.fromEntries(res.fields.map((f) => [f.field, f]))
    // eslint-disable-next-line no-console
    console.log('LIVE pipeline:', JSON.stringify(res.fields.map((f) => ({ k: f.field, latin: f.latin, read: f.can_read, src: f.source })), null, 1))

    expect(res.fields.length).toBeGreaterThan(4)
    expect(byKey['family_name']?.latin || '').toMatch(/kurop/i)             // KMU-55
    expect(byKey['place_of_birth']?.latin || '').toMatch(/trostian/i)        // registry settlement
    expect(byKey['place_of_birth']?.latin || '').toMatch(/urban-type settlement/i) // смт preserved
  }, 120000)
})
