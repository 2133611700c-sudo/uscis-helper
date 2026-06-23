/**
 * tileRegionRead — STAGE 4: recover EMPTY fields by re-reading the document in HIGH-RES TILES
 * with a TARGETED, aggressive crop reader.
 *
 * Root cause (proven live 2026-06-22, owner's Soviet birth cert): at full-page scale (preprocess
 * downscales the long side to 2048) a DENSE handwritten region — parents block, act/series line,
 * registration office — is only ~4-5 px/letter, so the main read honestly returns empty for
 * fields that ARE present. TWO things together recover them (both proven necessary): (1) a HIGH-RES
 * crop of the region (~2× per-letter), and (2) a TARGETED prompt that names the wanted fields and
 * says "best-effort letter-by-letter, do NOT return empty for a present field". The standard
 * full-page prompt on a tile stays conservative (it still answered can_read=false); the targeted
 * crop reader read father "Куропятник Сергей Леонидович", series "III-АМ № 428069", office.
 *
 * Additive + fail-open: only EMPTY fields are pursued; a confidently-read field is never touched;
 * any error leaves the base read intact. Behind HIRES_TILE_RECOVER_ENABLED (default OFF). The crop
 * reader is injected (unit-testable with no Gemini/sharp); a real Gemini impl lives alongside.
 */
import type { ExtractedDocField } from '../types'
import { withOcrCostMetrics, computeCacheKeySha, sha256Hex, estCostUsdMicros } from '@/lib/v1/ocrCostMetrics'

const GEMINI_URL = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`

/**
 * Real Gemini targeted crop reader (the production CropFieldReadFn). Aggressive prompt: NAME each
 * wanted field and demand a best-effort letter-by-letter read, NEVER empty for a present field —
 * this is what recovered the parents/series on the hi-res crop where the standard prompt gave up.
 * Returns key→cyrillic for the fields it read. Fail-open: '' / {} on any error.
 */
export async function geminiReadFieldsFromCrop(
  cropBuffer: Buffer,
  fields: Array<{ key: string; label: string }>,
  apiKey: string,
  model: string,
  timeoutMs = 30_000,
): Promise<Record<string, string>> {
  if (fields.length === 0) return {}
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const cropB64 = cropBuffer.toString('base64')
    const list = fields.map((f) => `- ${f.key} (${f.label})`).join('\n')
    const prompt =
      'This image is a HIGH-RESOLUTION CROP of part of a Ukrainian/Russian identity document, ' +
      'often HANDWRITTEN cursive on a printed form. Read ONLY these fields, letter by letter, ' +
      'best effort even if faded — do NOT return empty for a field that is visibly PRESENT in the ' +
      'crop (only omit a field that is genuinely not in this crop). Transcribe the Cyrillic EXACTLY ' +
      'as written (keep Russian ы/э/ё/ъ; do not Ukrainianize). Fields:\n' + list +
      '\nReturn ONLY JSON: an object mapping each field key you could read to its Cyrillic string, ' +
      'e.g. {"father_full_name":"Куропятник Сергей Леонидович"}. Omit keys not present in this crop.'
    const cacheKeySha = computeCacheKeySha({
      fileSha256: sha256Hex(cropB64), provider: 'gemini', model,
      promptVersion: 'tile_fields_v1', preprocVersion: 'tilecrop_v1',
    })
    // PLAIN-TEXT (no JSON mode): the preview/thinking model wraps/truncates JSON in JSON-mode
    // (proven in dateRegionRead.ts) — ask for JSON in the prompt and SALVAGE-parse the object from
    // the text. Retry once on a transient socket close (UND_ERR_SOCKET observed on this account).
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: cropB64 } }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 2048 },
    })
    const call = () => withOcrCostMetrics(
      { product: 'ocr', route: 'provider:gemini_tile_fields', provider: 'gemini', model, cacheKeySha, est_cost_usd_micros: estCostUsdMicros('gemini', model) },
      () => fetch(GEMINI_URL(model, apiKey), { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json', connection: 'close' }, body }),
    )
    let res
    try { res = await call() } catch { try { res = await call() } catch { return {} } }
    if (!res.ok) return {}
    const j = await res.json()
    const txt: string = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (process.env.TILE_DEBUG === '1') console.info('[tile_debug] finish=' + (j?.candidates?.[0]?.finishReason ?? '?') + ' raw=' + JSON.stringify(txt).slice(0, 400))
    const m = txt.match(/\{[\s\S]*\}/) // salvage the JSON object from any preamble
    let parsed: unknown
    try { parsed = JSON.parse(m ? m[0] : txt) } catch { return {} }
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, string> = {}
    const allowed = new Set(fields.map((f) => f.key))
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (allowed.has(k) && typeof v === 'string' && v.trim()) out[k] = v.trim()
    }
    return out
  } catch {
    return {}
  } finally {
    clearTimeout(timer)
  }
}

/** Targeted reader: read the named fields from ONE high-res crop. Returns key→cyrillic (only the
 *  ones it could read). Injected so the recovery logic is unit-testable without Gemini. */
export type CropFieldReadFn = (
  cropBuffer: Buffer,
  fields: Array<{ key: string; label: string }>,
) => Promise<Record<string, string>>

export interface TileRecoverResult {
  fields: ExtractedDocField[]
  diag: { emptyBefore: number; tiles: number; recovered: number; error?: string }
}

/** A field is "empty" when the model produced no usable value AND no raw cyrillic. */
export function isEmptyField(f: ExtractedDocField): boolean {
  return (f.value ?? '').trim() === '' && (f.raw_cyrillic ?? '').trim() === ''
}

export function isHiResTileRecoverEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.HIRES_TILE_RECOVER_ENABLED === '1'
}

/**
 * Recover empty fields by reading high-res tiles with a targeted crop reader.
 * `originalBuffer` MUST be the high-res, ALREADY-UPRIGHT image (the content-orientation stage runs
 * first; we do NOT apply EXIF here because EXIF is unreliable). `fieldLabels` maps each field key
 * to its human label (from the doc spec) so the crop prompt can name it.
 */
export async function recoverEmptyFieldsByTiles(opts: {
  baseFields: ExtractedDocField[]
  originalBuffer: Buffer
  fieldLabels: Record<string, string>
  cropRead: CropFieldReadFn
  criticalKeys?: Set<string>
}): Promise<TileRecoverResult> {
  const { baseFields, originalBuffer, fieldLabels, cropRead } = opts
  const out = baseFields.map((f) => ({ ...f }))
  const emptyKeys = new Set(
    out.filter((f) => isEmptyField(f) && (!opts.criticalKeys || opts.criticalKeys.has(f.field))).map((f) => f.field),
  )
  const diag: TileRecoverResult['diag'] = { emptyBefore: emptyKeys.size, tiles: 0, recovered: 0 }
  if (emptyKeys.size === 0) return { fields: out, diag }

  try {
    const sharp = (await import('sharp')).default
    const meta = await sharp(originalBuffer).metadata()
    const W = meta.width ?? 0, H = meta.height ?? 0
    if (!W || !H) { diag.error = 'no_dims'; return { fields: out, diag } }

    // Overlapping LEFT/RIGHT halves (side-by-side spreads: birth/marriage/death certs, booklet).
    // 8% overlap so a field on the seam isn't clipped. Native resolution preserved into the crop.
    const seam = Math.round(W * 0.5), ov = Math.round(W * 0.08)
    const tiles: Array<{ left: number; width: number }> = [
      { left: 0, width: Math.min(W, seam + ov) },
      { left: Math.max(0, seam - ov), width: W - Math.max(0, seam - ov) },
    ]

    for (const tile of tiles) {
      if (emptyKeys.size === 0) break
      const wanted = [...emptyKeys].map((k) => ({ key: k, label: fieldLabels[k] ?? k }))
      const crop = await sharp(originalBuffer)
        .extract({ left: tile.left, top: 0, width: tile.width, height: H })
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: false })
        .sharpen({ sigma: 1 })
        .jpeg({ quality: 88 })
        .toBuffer()
      diag.tiles++
      let got: Record<string, string> = {}
      try { got = await cropRead(crop, wanted) } catch { continue }
      for (const [key, cyr] of Object.entries(got)) {
        if (!emptyKeys.has(key) || !cyr || !cyr.trim()) continue
        const target = out.find((f) => f.field === key)
        if (!target) continue
        // FILL from the crop (base was empty). Recovered hard field → held for review, low conf,
        // reason tagged; the human confirms. Raw cyrillic only — downstream C3/transliteration own
        // the canonical value (L4/L5). Never overwrite a confidently-read base field.
        target.raw_cyrillic = cyr.trim()
        target.value = null
        target.confidence = 0.4
        target.review_required = true
        target.review_reasons = [...(target.review_reasons ?? []), 'hires_tile_recovered']
        emptyKeys.delete(key)
        diag.recovered++
      }
    }
    return { fields: out, diag }
  } catch (e) {
    diag.error = e instanceof Error ? e.message.slice(0, 60) : 'err'
    return { fields: out, diag }
  }
}
