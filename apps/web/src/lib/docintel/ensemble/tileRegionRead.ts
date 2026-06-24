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
 * crop reader read father "Соловьяк Андрей Богданович", series "II-БК № 530174", office.
 *
 * Additive + fail-open: only EMPTY fields are pursued; a confidently-read field is never touched;
 * any error leaves the base read intact. Behind HIRES_TILE_RECOVER_ENABLED (default OFF). The crop
 * reader is injected (unit-testable with no Gemini/sharp); a real Gemini impl lives alongside.
 */
import type { ExtractedDocField } from '../types'
import { withOcrCostMetrics, computeCacheKeySha, sha256Hex, estCostUsdMicros } from '@/lib/v1/ocrCostMetrics'
import { normalizeForCompare } from '../selfConsistency'

// ADR-026: native-res field crop + contrast-stretch reads handwritten Cyrillic exactly; downscaling a
// region crop destroys the cursive signal. The old 1600 cap shrank a ~2200px half-tile of a 4128px cert
// (verified: native-res crop of that exact cert reads the surname at CER 0.000; a downscaled crop fails).
// Keep crops at native resolution up to this cap (raised from 1600), and contrast-stretch before reading.
const TILE_MAX_DIMENSION = Math.max(1600, Number(process.env.OCR_TILE_MAX_DIMENSION) || 3000)

const GEMINI_URL = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`

/**
 * Single-sample Gemini targeted crop reader. Aggressive prompt: NAME each wanted field and demand a
 * best-effort letter-by-letter read, NEVER empty for a present field — this is what recovered the
 * parents/series on the hi-res crop where the standard prompt gave up. Returns key→cyrillic for the
 * fields it read. Fail-open: {} on any error. ONE Gemini call.
 *
 * A single temperature-0 sample is still NON-DETERMINISTIC on dense handwriting (proven live: the
 * same crop gave 0/4/7 across runs). geminiReadFieldsFromCrop wraps this in K-sample majority voting.
 */
export async function geminiReadFieldsFromCropOnce(
  cropBuffer: Buffer,
  fields: Array<{ key: string; label: string }>,
  apiKey: string,
  model: string,
  timeoutMs = 60_000,
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
      'e.g. {"father_full_name":"Соловьяк Андрей Богданович"}. Omit keys not present in this crop.'
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
      () => fetch(GEMINI_URL(model, apiKey), { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json' }, body }),
    )
    let res
    for (let attempt = 1; ; attempt++) {
      try { res = await call(); break } catch (e) {
        const err = e as { cause?: { code?: string }; message?: string }
        if (attempt >= 3) { if (process.env.TILE_DEBUG === '1') console.warn('[tile_debug] crop call failed after retries:', err?.cause?.code ?? err?.message); return {} }
        await new Promise((r) => setTimeout(r, 1500 * attempt))
      }
    }
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

/** One single-sample crop read (injected → the voting wrapper is unit-testable without Gemini). */
export type SingleCropSampler = (
  crop: Buffer,
  fields: Array<{ key: string; label: string }>,
) => Promise<Record<string, string>>

/** K-sample vote count: env TILE_VOTE_RUNS, default 3, clamped 1..5. =1 ⇒ today's single-read behavior. */
export function tileVoteRuns(env: Record<string, string | undefined> = process.env): number {
  const k = Number(env.TILE_VOTE_RUNS)
  return Number.isFinite(k) && k >= 1 ? Math.min(5, Math.floor(k)) : 3
}

/**
 * Majority-fold K crop samples (research-backed self-consistency: temp-0 multi-sample + majority
 * vote stabilizes a flaky VLM read). For each requested field: normalize-then-count the non-empty
 * readings; a value WINS only on a STRICT majority of `runs` (bestCount*2 > runs ⇒ ≥2/3, ≥3/5). The
 * winning field emits the most-frequent EXACT raw string (preserves Cyrillic casing for downstream
 * C3/transliteration). No majority ⇒ the field is OMITTED (stays empty, held for review) — a lone
 * flaky read never wins. Pure.
 */
export function foldMajority(
  samples: Array<Record<string, string>>,
  fields: Array<{ key: string }>,
  runs: number,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const { key } of fields) {
    // token (normalized) → { count, raw-string histogram }
    const byToken = new Map<string, { count: number; raws: Map<string, number> }>()
    for (const s of samples) {
      const v = (s?.[key] ?? '').trim()
      if (!v) continue
      const token = normalizeForCompare(v)
      if (!token) continue
      const e = byToken.get(token) ?? { count: 0, raws: new Map<string, number>() }
      e.count += 1
      e.raws.set(v, (e.raws.get(v) ?? 0) + 1)
      byToken.set(token, e)
    }
    let bestToken: string | null = null, bestCount = 0
    for (const [token, e] of byToken) if (e.count > bestCount) { bestCount = e.count; bestToken = token }
    if (bestToken === null || bestCount * 2 <= runs) continue // no strict majority ⇒ omit (held)
    // emit the most-frequent EXACT raw string of the winning token (tie → first seen).
    const raws = byToken.get(bestToken)!.raws
    let bestRaw = '', bestRawCount = 0
    for (const [raw, c] of raws) if (c > bestRawCount) { bestRawCount = c; bestRaw = raw }
    out[key] = bestRaw
  }
  return out
}

/**
 * Production targeted crop reader with K-sample MAJORITY VOTING (drop-in for the old single reader:
 * same positional signature; the caller in documentFieldReader.ts is unchanged). Reads the crop
 * `runs` times (default tileVoteRuns()) and majority-folds. A failed sample is skipped (no vote),
 * never aborts. opts.sampler is injectable for tests. runs=1 ⇒ byte-identical to a single read.
 */
export async function geminiReadFieldsFromCrop(
  cropBuffer: Buffer,
  fields: Array<{ key: string; label: string }>,
  apiKey: string,
  model: string,
  timeoutMs = 60_000,
  opts: { runs?: number; sampler?: SingleCropSampler } = {},
): Promise<Record<string, string>> {
  if (fields.length === 0) return {}
  const runs = opts.runs ?? tileVoteRuns()
  const sampler: SingleCropSampler =
    opts.sampler ?? ((crop, flds) => geminiReadFieldsFromCropOnce(crop, flds, apiKey, model, timeoutMs))
  if (runs <= 1) return sampler(cropBuffer, fields)
  const samples: Array<Record<string, string>> = []
  for (let i = 0; i < runs; i++) {
    try { samples.push(await sampler(cropBuffer, fields)) } catch { samples.push({}) }
    // COST: early-exit once every field's outcome is already decided (a strict majority is
    // reached, or the remaining samples can no longer change it). In the common stable case the
    // first 2 reads agree ⇒ stop at 2 instead of `runs` — Gemini is expensive (owner: it eats a lot).
    if (votingSettled(samples, fields, runs)) break
  }
  return foldMajority(samples, fields, runs)
}

/** True when no remaining sample can change any field's majority outcome (used for cost early-exit). */
export function votingSettled(
  samples: Array<Record<string, string>>,
  fields: Array<{ key: string }>,
  runs: number,
): boolean {
  const remaining = runs - samples.length
  if (remaining <= 0) return true
  for (const { key } of fields) {
    const counts = new Map<string, number>()
    for (const s of samples) { const v = (s?.[key] ?? '').trim(); if (!v) continue; const t = normalizeForCompare(v); if (t) counts.set(t, (counts.get(t) ?? 0) + 1) }
    let best = 0; for (const c of counts.values()) if (c > best) best = c
    const won = best * 2 > runs
    const cannotWin = (best + remaining) * 2 <= runs // even the leader can't reach a strict majority
    if (!won && !cannotWin) return false // this field is still undecided
  }
  return true
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
        // Native resolution preserved up to TILE_MAX_DIMENSION (only downscale if truly huge; still
        // upscale tiny tiles). NEVER binarize (ADR-026: Otsu/Sauvola destroy faded-ink strokes).
        .resize(TILE_MAX_DIMENSION, TILE_MAX_DIMENSION, { fit: 'inside', withoutEnlargement: false })
        .normalise()           // contrast-stretch — proven lift on faded handwritten ink (ADR-026)
        .sharpen({ sigma: 1 })
        .jpeg({ quality: 92 })
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
