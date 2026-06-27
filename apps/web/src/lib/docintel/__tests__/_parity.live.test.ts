/**
 * _parity.live.test.ts — Gemini-2.5-pro vs OpenAI(gpt-4.1) parity on the SAME bytes/schema (NOT committed).
 * Same preprocessed+oriented buffer, same doc spec, both providers; forensic artifacts written per
 * provider to gitignored qa-private/runtime-forensics/. Scored vs Tier-A GT separately afterward.
 * Run: set -a; . apps/web/.env.local; set +a; OPENAI_API_KEY='<key>' FORENSIC_LOG_ENABLED=1 \
 *      node_modules/.bin/vitest run --testTimeout=1800000 src/lib/docintel/__tests__/_parity.live.test.ts
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { readDocument } from '../documentFieldReader'
import { preprocessImage } from '../../ocr/image-preprocess'
import { defaultVisionProvider, primaryGeminiModel } from '../providers/geminiVisionProvider'
import { OpenAIVisionProvider } from '../providers/openaiVisionProvider'
import { getGeminiApiKey } from '../../gemini/apiKey'

const FIXTURE = resolve(process.cwd(), '../../test-fixtures/real-docs/birth_cert_handwritten_01.jpg')
const DOC = 'ua_birth_certificate'
const live = !!getGeminiApiKey() && !!process.env.OPENAI_API_KEY && process.env.FORENSIC_LOG_ENABLED === '1'

;(live ? describe : describe.skip)('PARITY (LIVE): gemini-2.5-pro vs openai gpt-4.1', () => {
  it('reads the same birth cert via both providers', async () => {
    const raw0 = readFileSync(FIXTURE)
    // FAIR READER PARITY: feed a genuinely-upright buffer to BOTH (this doc's EXIF tag is WRONG, so we
    // do NOT honour it). sharp.rotate(0) = explicit no-op rotate → keeps stored pixels (upright) + drops
    // the EXIF orientation tag. Run with CONTENT_ORIENT_ENABLED=0 so the (run-to-run unstable) detector
    // can't re-scramble — this isolates reader quality on a correctly-oriented handwritten cert.
    const raw = await (await import('sharp')).default(raw0).rotate(0).jpeg({ quality: 95 }).toBuffer()
    const pre = await preprocessImage(raw, 'image/jpeg')
    if (!pre.ok) throw new Error('preprocess failed: ' + pre.code)
    const providers: Array<{ id: string; p: any }> = [
      { id: 'gemini', p: defaultVisionProvider },
      { id: 'openai', p: new OpenAIVisionProvider({ model: process.env.OPENAI_VISION_MODEL || 'gpt-4.1' }) },
    ]
    for (const { id, p } of providers) {
      try {
        const r = await readDocument(pre.buffer, pre.mimeType, DOC, {
          provider: p, timeoutMs: 180_000, attemptsPerModel: 1, product: 'translation', originalBuffer: raw,
          forensic: { runId: `parity-${id}`, exifOrientation: pre.exifOrientation ?? null, outputDimensions: { width: pre.width, height: pre.height } },
        })
        console.info('[parity]', JSON.stringify({ provider: id, ok: r.ok, model: r.model, fields: r.fields?.length ?? 0 }))
      } catch (e) {
        console.error('[parity] threw', id, (e as Error)?.message)
      }
    }
    expect(true).toBe(true)
  }, 1_800_000)
})
