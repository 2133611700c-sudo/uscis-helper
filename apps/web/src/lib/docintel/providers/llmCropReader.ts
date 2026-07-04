/**
 * llmCropReader — LLM transport for the field-first handwriting route (One-Brain v2).
 *
 * ROOT CAUSE this exists for (owner Q&A 2026-07-04): "the app reads my document but the API
 * doesn't" — the API path sends the WHOLE page downscaled (image-preprocess cap; prod log:
 * "downscaled from 7.1MB"), crushing dense handwriting to a few px per letter, while in the
 * app the user zooms into a NATIVE-resolution fragment. ADR-026 proved handwriting reads on
 * native-res crops. The crop mechanics already exist (FIELD_BOX_TEMPLATES →
 * readHandwrittenRoute); the only consumer was the HTR sidecar (host never provisioned).
 * This adds a second TRANSPORT — the primary LLM reading each native-res crop — so the
 * proven route can run TODAY without new infrastructure.
 *
 * SAFETY (unchanged route contract):
 *  - Strict flag: HANDWRITING_CROP_LLM === 'gemini' (ONLY Gemini — GPT is owner-excluded on
 *    handwritten/certificate families; anything else, incl. 'true'/'1'/'openai', stays OFF).
 *  - Every read stays review_required=true (L6/ADR-026: a handwritten critical value is NEVER
 *    auto-final). This transport ADDS review candidates; it can never auto-release anything.
 *  - Same crop recipe as HTR: native-res extract + contrast normalise, NO downscale/binarize.
 *  - Fail-open everywhere: any error → [] (the full-page LLM read + review path remains).
 *  - Cost: ≤4 tiny crop calls per document, only for handwritten families, only flag-ON.
 */
import type { HtrFieldBox, HtrFieldRead } from './htrSidecarProvider'
import { PRIMARY_READER } from '../modelMatrix'

export function isLlmCropReaderEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.HANDWRITING_CROP_LLM === 'gemini'
}

/** Resolve ANY GEMINI_API_KEY* env (same owner-rotation convention as the vision provider). */
function resolveGeminiKey(env: Record<string, string | undefined> = process.env): string | null {
  for (const [k, v] of Object.entries(env)) {
    if (k.startsWith('GEMINI_API_KEY') && v && v.trim()) return v.trim()
  }
  return null
}

const CROP_PROMPT =
  'This image is a small cropped fragment of an official Ukrainian/Soviet document containing ' +
  'HANDWRITTEN Cyrillic text. Transcribe the handwriting EXACTLY as written, in the original ' +
  'Cyrillic script (Ukrainian or Russian). Do NOT transliterate, translate, correct or guess. ' +
  'If the fragment is blank or unreadable, return an empty string. ' +
  'Reply with ONLY this JSON: {"text": "<transcription or empty>"}'

/**
 * BLUEPRINT #4 — knowledge into the crop prompt, NON-PRIMING form.
 *
 * The hint tells the model WHAT KIND of content the crop holds (structural knowledge from
 * the field key), never WHAT VALUE to expect. Feeding lexicon values (names, gazetteer
 * settlements) into a generation prompt PRIMES fabrication — the exact failure mode this
 * pipeline exists to prevent — so dictionary VALUES stay on the VERIFY side
 * (fieldConsistencyCritic C4, knowledge signals). Enforced by test: the prompt builder
 * never emits lexicon entries.
 */
export function buildCropPrompt(field: string): string {
  const k = field.toLowerCase()
  let hint = ''
  if (/family|given|patronymic|name/.test(k)) {
    hint =
      ' The fragment is a PERSONAL NAME field. Transcribe it letter-by-letter exactly as inked;' +
      ' NEVER substitute a more common name, never fix an unusual spelling.'
  } else if (/dob|date/.test(k)) {
    hint =
      ' The fragment is a DATE field; the day, month or year may be written as Cyrillic words —' +
      ' transcribe the words as written, do not convert them to digits.'
  } else if (/place|city|oblast|raion|region|village/.test(k)) {
    hint =
      ' The fragment is a PLACE-NAME field (settlement/raion/oblast). Transcribe exactly as inked;' +
      ' do not modernize or normalize historical place names.'
  } else if (/number|series|seriya/.test(k)) {
    hint =
      ' The fragment is a DOCUMENT NUMBER/SERIES field; it may mix Cyrillic letters and digits —' +
      ' keep every character exactly, do not convert letters between alphabets.'
  }
  return CROP_PROMPT + hint
}

/**
 * LLM has no calibrated per-read confidence; this constant is a TRANSPORT detail only — the
 * route forces review_required=true on every crop read regardless, so this value can never
 * flip a decision. It sits above HTR_MIN_CONFIDENCE (0.5) so reads aren't silently dropped
 * by the merge filter, and far below any auto-accept threshold (auto-accept is impossible
 * here anyway by the review rule).
 */
const LLM_CROP_CONFIDENCE = 0.6

/**
 * Read handwritten field crops via the PRIMARY Gemini model (one tiny call per crop).
 * Same output contract as readHandwrittenFieldsViaSidecar. Fail-open: [] on any failure.
 */
export async function readHandwrittenFieldsViaLlmCrops(
  orientedBuffer: Buffer,
  boxes: HtrFieldBox[],
  fetchImpl: typeof fetch = fetch,
): Promise<HtrFieldRead[]> {
  if (!isLlmCropReaderEnabled() || boxes.length === 0) return []
  const apiKey = resolveGeminiKey()
  if (!apiKey) return []
  let sharp: typeof import('sharp')
  try {
    sharp = (await import('sharp')).default as unknown as typeof import('sharp')
  } catch {
    return []
  }
  const out: HtrFieldRead[] = []
  for (const b of boxes) {
    const [l, t, r, bt] = b.box
    const width = Math.max(1, Math.round(r - l))
    const height = Math.max(1, Math.round(bt - t))
    try {
      // ADR-026 recipe: native resolution from the oriented ORIGINAL; contrast-stretch only.
      const crop = await sharp(orientedBuffer)
        .extract({ left: Math.max(0, Math.round(l)), top: Math.max(0, Math.round(t)), width, height })
        .normalise()
        .png()
        .toBuffer()
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 20_000)
      let res: Response
      try {
        res = await fetchImpl(
          `https://generativelanguage.googleapis.com/v1beta/models/${PRIMARY_READER}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: buildCropPrompt(b.field) },
                  { inline_data: { mime_type: 'image/png', data: crop.toString('base64') } },
                ],
              }],
              // THINKING-MODEL TRAP (CLAUDE.md/MODELS): 2.5-pro burns output budget on
              // reasoning; a small cap → MAX_TOKENS → EMPTY read. Same fix as the main
              // provider: ≥8192. (First live run proved it: 512 → 2 of 3 crops empty.)
              generationConfig: { maxOutputTokens: 8192, temperature: 0 },
            }),
          },
        )
      } finally {
        clearTimeout(timer)
      }
      if (!res.ok) continue // 429/5xx/403 on one crop → skip it, keep the rest (fail-open)
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const rawText = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
      const m = rawText.match(/\{[\s\S]*\}/)
      if (!m) continue
      let text = ''
      try {
        text = String((JSON.parse(m[0]) as { text?: unknown }).text ?? '').trim()
      } catch {
        continue
      }
      if (!text) continue // blank/unreadable → no candidate (never fabricate an empty read)
      out.push({ field: b.field, text, confidence: LLM_CROP_CONFIDENCE })
    } catch {
      // crop/read failure on this field → skip; the full-page read + review path remains
    }
  }
  return out
}
