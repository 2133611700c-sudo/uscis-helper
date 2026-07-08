/**
 * handwrittenFieldRoute — the FIELD-FIRST handwriting route (ADR-026), OFF by default.
 *
 * ROUTE BY FIELD RENDERING for HANDWRITTEN doc classes:
 *   1. LOCALIZE (read-quality is NOT the LLM's job here): Gemini returns the BOUNDING BOXES of the
 *      handwritten name fields. The LLM is good at LOCALIZATION even when it cannot READ cursive.
 *   2. READ: crop each box at NATIVE resolution + contrast → the key-free HTR sidecar (raxtemur).
 *   3. EMIT three SEPARATED layers per field so you can see WHERE it breaks:
 *        read_quality  = { raw_htr_text, htr_confidence }   (what the reader saw)
 *        normalization = normalized_value                    (codex applies downstream)
 *        review        = review_required + review_reason     (raxtemur can't abstain → always gated)
 *
 * Gated by HTR_SIDECAR_URL (sidecar reader) — UNSET in prod → disabled, byte-identical. Localization also
 * needs a Gemini key; absent → disabled. Everything fail-open (any error → [] → the LLM full-page read stands).
 */
import { isHtrSidecarEnabled, readHandwrittenFieldsViaSidecar, type HtrFieldBox } from '../providers/htrSidecarProvider'
import { isLlmCropReaderEnabled, readHandwrittenFieldsViaLlmCrops, resolveLlmCropProvider } from '../providers/llmCropReader'

const GEMINI_URL = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
const LOCALIZER_MODEL = process.env.HTR_LOCALIZER_MODEL || 'gemini-2.5-pro'

function geminiKey(): string {
  return (process.env.GEMINI_API_KEY_PAY || process.env.GEMINI_API_KEY || '').trim()
}

/**
 * NON-LLM field-box TEMPLATES (normalized 0-1 [left,top,right,bottom]) per doc class. These are standardized
 * government forms, so the handwritten name fields sit at roughly fixed relative positions. A template removes
 * the Gemini-localizer dependency (the LLM bbox call is itself an availability risk — it 503s). Derived from
 * the verified boxes on the reference upright scan; combined with the orientation step + a review gate.
 * (Framing varies between photos → this is a deterministic BASELINE, not pixel-perfect; reads stay review-gated.)
 */
export const FIELD_BOX_TEMPLATES: Record<string, Record<string, [number, number, number, number]>> = {
  ua_birth_certificate: {
    family_name: [0.2326, 0.2277, 0.5451, 0.2923],
    given_name: [0.1308, 0.2923, 0.2447, 0.3617],
    // Tightened on 2026-06-25 to remove the given-name overlap that produced
    // "гей Сергеевич" instead of "Сергеевич" on the real handwritten birth cert.
    patronymic: [0.2641, 0.2923, 0.4482, 0.3617],
    // Added 2026-07-06: father's own given-name+patronymic line (right page, "Отец/Батько" row).
    // Verified live: raxtemur reads both cleanly (given-name conf 0.98, patronymic legible) once
    // fed the fully content-orient-corrected buffer (see contentOrientCw fix). Concatenated into
    // father_full_name by HTR_COMBINE_FIELDS below — surname is assumed shared with the child
    // (verified true on the reference document; a mismatch would surface as a review flag, never
    // silently, since this field stays review-gated regardless).
    father_given_name: [0.5499, 0.2584, 0.6662, 0.3004],
    father_patronymic: [0.6904, 0.2584, 0.9205, 0.3036],
    // Mother's row (item 2, 2026-07-06): the 3 earlier attempts (see prior note, replaced here)
    // tried a father-style TWO-box split (given / patronymic separately) — live-verified this
    // split makes it WORSE (both words individually garbled) vs a SINGLE combined box over both
    // words (stable ~0.95 confidence across repeat reads, missing only the trailing letter of the
    // patronymic — a truncation the raxtemur model exhibits at crop-line ends, not a framing
    // defect: widening the box did not recover it). Kept as ONE box for this reason, unlike the
    // father's two separate boxes. mother_full_name's surname token is borrowed from
    // child_family_name (HTR_COMBINE_FIELDS below) rather than read from her own row — her own
    // surname crop live-tested less reliable (one-letter substitution, ~0.9 confidence) than the
    // already owner-verified child surname. No real names in this comment — fictional-data policy.
    mother_given_patronymic: [0.5499, 0.3924, 0.9932, 0.4231],
  },
  ua_internal_passport_booklet: {
    // Frozen from qa-private/htr-poc/stable_bench.py on the real booklet image.
    family_name: [0.2815, 0.6076, 0.6820, 0.6323],
    given_name: [0.2815, 0.6388, 0.6820, 0.6682],
  },
}

function templateFor(docTypeId: string | undefined): Record<string, [number, number, number, number]> | null {
  if (!docTypeId) return null
  for (const [key, tmpl] of Object.entries(FIELD_BOX_TEMPLATES)) if (docTypeId.includes(key)) return tmpl
  return null
}

/** Maps the localizer's semantic label → docintel field key. */
const LABEL_TO_FIELD: Record<string, string> = {
  surname: 'family_name', family_name: 'family_name', last_name: 'family_name',
  given: 'given_name', given_name: 'given_name', first_name: 'given_name', name: 'given_name',
  patronymic: 'patronymic', middle_name: 'patronymic',
}

export interface HandwrittenFieldResult {
  field: string
  /** read_quality layer — exactly what the HTR reader saw + its calibrated confidence */
  raw_htr_text: string
  htr_confidence: number
  /** normalization layer — value to hand downstream (codex normalizes; here = raw_htr_text) */
  normalized_value: string
  /** review layer — raxtemur cannot abstain, so a handwritten critical field is ALWAYS review-gated */
  review_required: boolean
  review_reason: string
}

/**
 * Localize handwritten name-field boxes. Priority: (1) HTR_FIELD_BOXES env override; (2) NON-LLM per-doc-class
 * TEMPLATE (deterministic, no availability risk); (3) Gemini bbox (general fallback). Returns PIXEL boxes on
 * the original. [] on any failure.
 */
export async function localizeHandwrittenFields(
  originalBuffer: Buffer,
  mime: string,
  docTypeId?: string,
): Promise<HtrFieldBox[]> {
  let sharp: typeof import('sharp')
  try { sharp = (await import('sharp')).default as unknown as typeof import('sharp') } catch { return [] }
  const meta0 = await sharp(originalBuffer).metadata().catch(() => null)
  const W0 = meta0?.width ?? 0, H0 = meta0?.height ?? 0

  // (1) explicit override (native pixels) — per-doc config or a Gemini-independent proof.
  const fixed = (process.env.HTR_FIELD_BOXES || '').trim()
  if (fixed) {
    try {
      const obj = JSON.parse(fixed) as Record<string, number[]>
      const out: HtrFieldBox[] = []
      for (const [field, b] of Object.entries(obj)) {
        if (Array.isArray(b) && b.length === 4 && b.every((n) => typeof n === 'number')) {
          out.push({ field, box: [b[0], b[1], b[2], b[3]] as [number, number, number, number] })
        }
      }
      if (out.length) return out
    } catch { /* fall through */ }
  }

  // (2) NON-LLM template (deterministic, no Gemini dependency) — scale normalized 0-1 boxes to the image.
  const tmpl = templateFor(docTypeId)
  if (tmpl && W0 && H0) {
    const out: HtrFieldBox[] = []
    for (const [field, [l, t, r, b]] of Object.entries(tmpl)) {
      out.push({ field, box: [Math.round(l * W0), Math.round(t * H0), Math.round(r * W0), Math.round(b * H0)] })
    }
    if (out.length) return out
  }

  // (3) Gemini bbox fallback (general docs without a template).
  const key = geminiKey()
  if (!key) return []
  const meta = meta0
  const W = meta?.width ?? 0, H = meta?.height ?? 0
  if (!W || !H) return []
  const b64 = originalBuffer.toString('base64')
  const prompt =
    'This is a Ukrainian/Soviet certificate with HANDWRITTEN name values. Find the bounding box of each ' +
    'handwritten PERSON-NAME value (surname, given name, patronymic of the child/holder). You do NOT need to ' +
    'read the cursive — only locate the box tightly around the handwritten value (exclude printed labels). ' +
    'Return ONLY strict JSON: {"fields":[{"label":"surname|given|patronymic","box":[ymin,xmin,ymax,xmax]}]} ' +
    'with box integers normalized 0-1000. Max 4 fields.'
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 30_000)
  try {
    const r = await fetch(GEMINI_URL(LOCALIZER_MODEL, key), {
      method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: b64 } }] }],
        generationConfig: { temperature: 0, response_mime_type: 'application/json', maxOutputTokens: 2048 },
      }),
    })
    if (!r.ok) return []
    const j = await r.json()
    const txt = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).filter(Boolean).join('') ?? '{}'
    let parsed: { fields?: { label?: string; box?: number[] }[] }
    try { parsed = JSON.parse(txt) } catch { return [] }
    const out: HtrFieldBox[] = []
    for (const f of parsed.fields ?? []) {
      const field = LABEL_TO_FIELD[(f.label || '').toLowerCase()]
      const b = f.box
      if (!field || !Array.isArray(b) || b.length !== 4 || b.some((n) => typeof n !== 'number')) continue
      const [ymin, xmin, ymax, xmax] = b
      // normalized 0-1000 → pixels [left, top, right, bottom]
      const left = Math.round((xmin / 1000) * W), top = Math.round((ymin / 1000) * H)
      const right = Math.round((xmax / 1000) * W), bottom = Math.round((ymax / 1000) * H)
      if (right > left && bottom > top) out.push({ field, box: [left, top, right, bottom] })
    }
    return out.slice(0, 4)
  } catch { return [] } finally { clearTimeout(t) }
}

/**
 * Run the full field-first handwriting route. Disabled ([]) unless the HTR sidecar is configured.
 * Localize → native-res crop → HTR read → 3-layer review-gated result. Fail-open everywhere.
 *
 * @param contentOrientCw ROOT-CAUSE FIX (2026-07-06, found while testing birth_cert_handwritten_01.jpg
 *   with the sidecar live): EXIF-only normalization is NOT enough — this document's EXIF tag is wrong
 *   (documented elsewhere in this codebase), so the OLD "EXIF-bake only" buffer left the crop content
 *   sideways. Live A/B on the ALREADY-SHIPPED family_name/given_name/patronymic template boxes: EXIF-only
 *   buffer → raxtemur reads garbled/wrong text; the SAME boxes against the fully content-orient-corrected
 *   buffer → all three fields read back EXACT matches to direct visual inspection. `documentFieldReader.ts`
 *   already computes this correction (`orientToUpright()`'s `applied` cw) for the main LLM read but never
 *   passed it here — the crop route silently re-derived its own (EXIF-only) orientation, discarding it.
 *   Callers pass the SAME `applied` value already computed upstream; 0 (the default) is byte-identical
 *   to the pre-fix behavior (EXIF-bake only), so documents where EXIF alone is already correct — the
 *   common case — are unaffected.
 */
export async function readHandwrittenRoute(
  originalBuffer: Buffer,
  mime: string,
  docTypeId?: string,
  contentOrientCw = 0,
): Promise<HandwrittenFieldResult[]> {
  // TRANSPORT selection (One-Brain v2 crop-reader): the proven native-res crop route has two
  // transports — the HTR sidecar (preferred when hosted) and the primary-LLM crop reader
  // (HANDWRITING_CROP_LLM='gemini' — runs TODAY without new infra; closes the app-vs-API
  // downscale root cause). Both feed the SAME review-gated contract; neither can auto-release.
  const transport: 'htr' | 'llm' | null =
    isHtrSidecarEnabled() ? 'htr' : isLlmCropReaderEnabled() ? 'llm' : null
  if (!transport) return []
  const llmProvider = resolveLlmCropProvider()
  // EXIF-NORMALIZE ONCE (Step-5b fix), THEN apply the same content-orient correction the main read
  // already used (see contentOrientCw doc above) — both the dimension read (box scaling) and
  // sharp.extract() must see/apply the SAME final orientation, so coordinates and pixels share one system.
  let buf = originalBuffer
  try {
    const sharp = (await import('sharp')).default
    let s = sharp(originalBuffer, { failOn: 'error' }).rotate()
    if (contentOrientCw) s = sharp(await s.toBuffer()).rotate(contentOrientCw)
    buf = await s.toBuffer()
  } catch { buf = originalBuffer }
  const boxes = await localizeHandwrittenFields(buf, mime, docTypeId)
  if (boxes.length === 0) return []
  const reads = transport === 'htr'
    ? await readHandwrittenFieldsViaSidecar(buf, boxes)
    : await readHandwrittenFieldsViaLlmCrops(buf, boxes, fetch, llmProvider ?? 'gemini')
  return reads.map((r) => ({
    field: r.field,
    raw_htr_text: r.text,
    htr_confidence: r.confidence,
    normalized_value: r.text, // codex normalization happens downstream (D2); kept separate here
    review_required: true, // neither transport may auto-final a handwritten critical value (L6/ADR-026)
    review_reason: transport === 'htr' ? 'handwritten_htr_read' : 'handwritten_llm_crop_read',
  }))
}
