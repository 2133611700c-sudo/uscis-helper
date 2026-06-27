/**
 * _forensic_baseline.live.test.ts — Stage-1 instrumented BASELINE runner (NOT committed).
 *
 * Runs the REAL reader path (preprocessImage → readDocument) on the owner's real handwritten
 * birth cert at multiple PHYSICAL orientations, FORENSIC_LOG_ENABLED, writing one artifact per
 * run to gitignored qa-private/runtime-forensics/. This separates:
 *   - byte-repeat stability (same rotation, N repeats → same canonical result?)
 *   - rotation invariance   (0/90/180/270 → same canonical result after preprocessing?)
 *
 * Stage-0 freeze: orientation code is UNCHANGED — this captures CURRENT behavior as the baseline.
 * Real PII doc is read for live measurement only (gitignored); forensic console output is PII-free.
 *
 * Controlled by env:  ROTATIONS="0,90,180,270"  REPEATS="3"
 * Run: set -a; . apps/web/.env.local; set +a;  FORENSIC_LOG_ENABLED=1 ROTATIONS=0 REPEATS=2 \
 *      node_modules/.bin/vitest run src/lib/docintel/__tests__/_forensic_baseline.live.test.ts
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { readDocument } from '../documentFieldReader'
import { preprocessImage } from '../../ocr/image-preprocess'
import { getGeminiApiKey } from '../../gemini/apiKey'

const FIXTURE = resolve(process.cwd(), '../../test-fixtures/real-docs/birth_cert_handwritten_01.jpg')
const DOC_TYPE = 'ua_birth_certificate'
const ROTATIONS = (process.env.ROTATIONS || '0').split(',').map((s) => Number(s.trim())).filter((n) => [0, 90, 180, 270].includes(n))
const REPEATS = Math.max(1, Number(process.env.REPEATS) || 2)
const live = getGeminiApiKey() && process.env.FORENSIC_LOG_ENABLED === '1'

;(live ? describe : describe.skip)('Stage-1 forensic baseline (LIVE, paid Gemini)', () => {
  it(`runs birth cert × rotations[${ROTATIONS.join(',')}] × ${REPEATS} repeats`, async () => {
    const sharp = (await import('sharp')).default
    // Clean upright base: bake the EXIF rotation in + strip the tag, so synthetic rotations are
    // NOT confounded by a residual EXIF orientation (the birth cert carries EXIF=6).
    const base = await sharp(readFileSync(FIXTURE)).rotate().jpeg({ quality: 95 }).toBuffer()
    for (const rot of ROTATIONS) {
      const rawBytes = rot === 0 ? base : await sharp(base).rotate(rot).jpeg({ quality: 92 }).toBuffer()
      for (let n = 1; n <= REPEATS; n++) {
        const pre = await preprocessImage(rawBytes, 'image/jpeg')
        if (!pre.ok) { console.error('[baseline] preprocess failed', rot, pre.code); continue }
        const runId = `baseline-rot${rot}-r${n}`
        try {
          const r = await readDocument(pre.buffer, pre.mimeType, DOC_TYPE, {
            timeoutMs: Number(process.env.READER_TIMEOUT_MS) || 180_000, attemptsPerModel: 1, product: 'translation', originalBuffer: rawBytes,
            forensic: { runId, sourceSha256: null, exifOrientation: pre.exifOrientation ?? null, outputDimensions: { width: pre.width, height: pre.height } },
          })
          console.info('[baseline]', JSON.stringify({ runId, ok: r.ok, model: r.model, fields: r.fields?.length ?? 0 }))
        } catch (e) {
          console.error('[baseline] read threw (continuing)', runId, (e as Error)?.message)
        }
      }
    }
    expect(true).toBe(true)
  }, 1_800_000)
})
