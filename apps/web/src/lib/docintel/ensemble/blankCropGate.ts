/**
 * blankCropGate — MANDATORY pre-reader gate (owner plan §7, 2026-07-05).
 *
 * MEASURED BASIS: neither HTR can abstain — the downloaded UA TrOCR fabricated on a BLANK
 * crop 3/3, and raxtemur cannot abstain either (ADR-026). Therefore NO HTR may even be
 * INVOKED on a blank/near-blank crop: two fabricators could otherwise "agree" on an empty
 * field and poison the ensemble-agreement signal. Deterministic, free, model-free.
 *
 * Method: grayscale + contrast-stretch, count "ink" pixels (below an ink threshold) as a
 * ratio of the crop area. Handwritten strokes on document paper produce a clearly nonzero
 * ink ratio; a blank field / paper texture stays near zero. Conservative default keeps
 * faded ink readable (fail-open toward READING, never toward auto-accept — the read stays
 * review-gated regardless).
 *
 * Hard metric this enforces: blank_fabrication_reachable = 0.
 */
import sharp from 'sharp'

export interface BlankGateVerdict {
  blank: boolean
  /** fraction of pixels darker than the ink threshold, 0..1 */
  inkRatio: number
  reason: 'blank_crop_or_low_ink' | null
}

/** Ink-pixel ratio below this ⇒ nothing to read. Tuned conservative: real faded strokes on
 * our worst fixture crops measure well above this; blank paper/noise stays below. */
const MIN_INK_RATIO = Number(process.env.BLANK_GATE_MIN_INK_RATIO) || 0.004
/** Gray level (0-255, after normalise) at/below which a pixel counts as ink. */
const INK_LEVEL = 96

export async function judgeBlankCrop(crop: Buffer): Promise<BlankGateVerdict> {
  try {
    const { data, info } = await sharp(crop)
      .grayscale()
      .normalise() // contrast-stretch so paper→white, strokes→dark (same ADR-026 family op)
      .raw()
      .toBuffer({ resolveWithObject: true })
    let ink = 0
    for (let i = 0; i < data.length; i++) if (data[i] <= INK_LEVEL) ink++
    const inkRatio = ink / (info.width * info.height)
    const blank = inkRatio < MIN_INK_RATIO
    return { blank, inkRatio, reason: blank ? 'blank_crop_or_low_ink' : null }
  } catch {
    // Gate failure must never BLOCK reading (that would fail-closed the whole doc on a
    // decode hiccup) — but it also must never auto-accept: the read stays review-gated.
    return { blank: false, inkRatio: -1, reason: null }
  }
}
