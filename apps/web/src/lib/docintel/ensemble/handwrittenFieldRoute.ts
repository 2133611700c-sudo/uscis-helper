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
const FIELD_BOX_TEMPLATES: Record<string, Record<string, [number, number, number, number]>> = {
  ua_birth_certificate: {
    family_name: [0.2326, 0.2277, 0.5451, 0.2923],
    given_name: [0.1308, 0.2923, 0.2447, 0.3617],
    // Tightened on 2026-06-25 to remove the given-name overlap that produced
    // "гей Сергеевич" instead of "Сергеевич" on the real handwritten birth cert.
    patronymic: [0.2641, 0.2923, 0.4482, 0.3617],
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
 */
export async function readHandwrittenRoute(
  originalBuffer: Buffer,
  mime: string,
  docTypeId?: string,
): Promise<HandwrittenFieldResult[]> {
  if (!isHtrSidecarEnabled()) return []
  const boxes = await localizeHandwrittenFields(originalBuffer, mime, docTypeId)
  if (boxes.length === 0) return []
  const reads = await readHandwrittenFieldsViaSidecar(originalBuffer, boxes)
  return reads.map((r) => ({
    field: r.field,
    raw_htr_text: r.text,
    htr_confidence: r.confidence,
    normalized_value: r.text, // codex normalization happens downstream (D2); kept separate here
    review_required: true, // raxtemur cannot abstain → a handwritten critical value is never auto-final
    review_reason: 'handwritten_htr_read',
  }))
}
