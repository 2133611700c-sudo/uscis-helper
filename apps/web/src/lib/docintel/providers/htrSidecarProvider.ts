/**
 * htrSidecarProvider — the FIELD-FIRST handwriting reader (ADR-026), wired but OFF by default.
 *
 * The proven recipe (native-res field crop → contrast-stretch → raxtemur/trocr-base-ru) cannot run on
 * Vercel/Node (Python/torch), so the reader lives in a sidecar service (qa-private/htr-poc/ocr_api.py:
 * POST /read, returns {text, confidence}). This module is the TS client + the field-first crop loop.
 *
 * ROUTE BY FIELD RENDERING: for a HANDWRITTEN doc class, instead of trusting the full-page LLM read of a
 * cursive field, we crop each field at NATIVE resolution from the original upload and send THAT to the HTR
 * sidecar. raxtemur cannot abstain (emits text on blank) → its reads are returned with `confidence` and are
 * ALWAYS review-gated; this never auto-delivers a critical handwritten field.
 *
 * Gated by HTR_SIDECAR_URL: absent → disabled (no behaviour change). Present → the field-first path is live.
 */

export interface HtrFieldBox {
  /** docintel field key, e.g. 'family_name' */
  field: string
  /** native-resolution pixel box on the ORIGINAL upload: [left, top, right, bottom] */
  box: [number, number, number, number]
}

export interface HtrFieldRead {
  field: string
  text: string
  confidence: number
}

export function isHtrSidecarEnabled(): boolean {
  return !!(process.env.HTR_SIDECAR_URL || '').trim()
}

function sidecarUrl(): string {
  return (process.env.HTR_SIDECAR_URL || '').trim().replace(/\/+$/, '')
}

/** Read ONE native-res field crop (PNG/JPEG bytes) via the sidecar. null on any failure (fail-safe). */
export async function readFieldCrop(cropBytes: Buffer, timeoutMs = 20000): Promise<HtrFieldRead | null> {
  if (!isHtrSidecarEnabled()) return null
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(cropBytes)], { type: 'image/png' }), 'crop.png')
    const r = await fetch(`${sidecarUrl()}/read`, { method: 'POST', body: form, signal: ctrl.signal })
    if (!r.ok) return null
    const j = (await r.json()) as { text?: string; confidence?: number }
    if (typeof j?.text !== 'string') return null
    return { field: '', text: j.text.trim(), confidence: typeof j.confidence === 'number' ? j.confidence : 0 }
  } catch {
    return null // sidecar down / timeout / network → fail-safe (pipeline keeps the LLM read + review)
  } finally {
    clearTimeout(t)
  }
}

/**
 * FIELD-FIRST handwriting read: crop each field at NATIVE resolution from the original upload (contrast-
 * stretch, no downscale, no binarize — the verified recipe) and read it via the HTR sidecar. Returns the
 * per-field reads (always to be review-gated by the caller). Disabled (empty) when HTR_SIDECAR_URL is unset.
 */
export async function readHandwrittenFieldsViaSidecar(
  originalBuffer: Buffer,
  boxes: HtrFieldBox[],
): Promise<HtrFieldRead[]> {
  if (!isHtrSidecarEnabled() || boxes.length === 0) return []
  let sharp: typeof import('sharp')
  try {
    sharp = (await import('sharp')).default as unknown as typeof import('sharp')
  } catch {
    return [] // sharp unavailable → fail-safe
  }
  const out: HtrFieldRead[] = []
  for (const b of boxes) {
    const [l, t, rr, bb] = b.box
    const width = Math.max(1, Math.round(rr - l))
    const height = Math.max(1, Math.round(bb - t))
    try {
      // native resolution from the ORIGINAL (never the downscaled page); contrast-stretch only.
      const crop = await sharp(originalBuffer)
        .extract({ left: Math.max(0, Math.round(l)), top: Math.max(0, Math.round(t)), width, height })
        .normalise() // 2/98-style contrast-stretch; NO binarize (ADR-026)
        .png()
        .toBuffer()
      const read = await readFieldCrop(crop)
      if (read) out.push({ ...read, field: b.field })
    } catch {
      // skip this field on crop/read failure; the LLM read + review path remains
    }
  }
  return out
}
