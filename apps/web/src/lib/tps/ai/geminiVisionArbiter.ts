/**
 * geminiVisionArbiter — reads HANDWRITTEN Ukrainian booklet identity fields
 * directly from the IMAGE (pixels), recovering Cyrillic that the
 * Vision→DeepSeek-text path mangles ("Yovych"→Сергійович, "Prostianets"→Тростянець).
 *
 * ARCHITECTURE (proven 2026-05-27, v5 §13): Gemini reads the CYRILLIC; the
 * deterministic KMU-55 transliterator produces the Latin. NEVER trust the LLM's
 * own transliteration (it returned "Troshchianets" for Тростянець in the proof).
 *
 * Guardrails:
 *  - Candidate-only output (review_required=true always); Central Brain + Review Gate decide.
 *  - Gated by env TPS_GEMINI_VISION_ARBITER_ENABLED (caller checks); never auto-final.
 *  - Parallel-safe, per-call timeout, 503/429 retry with model fallback (free tier flaps).
 *  - Free tier trains on data → PAID tier required for real client PII (caller's responsibility).
 */

import type { TpsExtractedField } from '@/lib/tps/types'
import { transliterateKMU55 } from '@uscis-helper/knowledge'
import { normalizeProvince } from '@/lib/tps/dictionaryBridge'

export interface VisionFieldRead {
  /** TPS field name (family_name, given_name, middle_name, dob, city_of_birth, province_of_birth). */
  field: string
  cyrillic: string
  iso_date?: string | null
  can_read: boolean
  confidence: number
  reason: string
}

export interface VisionArbiterResult {
  ok: boolean
  fields: VisionFieldRead[]
  model: string | null
  ms: number
  error?: string
}

// Free-tier flaps with 503; gemini-2.0-flash free quota can be 0. Try in order.
const MODEL_FALLBACK = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'] as const

const PROMPT = `You are reading a HANDWRITTEN Ukrainian internal passport booklet identity page (паспорт громадянина України). The IMAGE is the ground truth — read only what is visibly written. Do NOT guess, do NOT infer typical names.

Return a JSON object with these keys, reading each from the handwritten text:
- family_name (Прізвище)
- given_name (Ім'я)
- patronymic (По батькові)
- date_of_birth (Дата народження)
- place_of_birth_city (Місце народження — city/settlement only)
- province_of_birth (oblast, if present)

For each key return an object:
{ "cyrillic": "<exact full word as written, in Cyrillic; for date_of_birth the raw text>",
  "iso_date": "<YYYY-MM-DD, ONLY for date_of_birth, else omit>",
  "can_read": <true|false>,
  "confidence": <0.0-1.0>,
  "reason": "<short>" }

Rules:
- Read the FULL word, every letter. Never return only a suffix (never "ович" alone).
- Handwritten Ukrainian "Т" and "П" look similar; pick the letter that forms a REAL Ukrainian name/city.
- If a field is not clearly legible, set can_read=false and cyrillic="".
- Do NOT transliterate to Latin yourself. Return Cyrillic only (except iso_date).
- Output ONLY the JSON object.`

const FIELD_MAP: Record<string, string> = {
  family_name: 'family_name',
  given_name: 'given_name',
  patronymic: 'middle_name',
  date_of_birth: 'dob',
  place_of_birth_city: 'city_of_birth',
  province_of_birth: 'province_of_birth',
}

async function callGemini(
  model: string,
  apiKey: string,
  imageB64: string,
  mimeType: string,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; json: any }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: imageB64 } }] }],
          generationConfig: { temperature: 0, response_mime_type: 'application/json' },
        }),
      },
    )
    const json = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, json }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Read booklet identity fields from the image. Returns Cyrillic candidates;
 * transliteration is done by visionReadsToFields (KMU-55), NOT here.
 */
export async function readBookletViaVision(
  imageBuffer: Buffer,
  mimeType: string,
  opts: { timeoutMs?: number; attemptsPerModel?: number } = {},
): Promise<VisionArbiterResult> {
  const t0 = Date.now()
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { ok: false, fields: [], model: null, ms: 0, error: 'GEMINI_API_KEY not set' }

  const timeoutMs = opts.timeoutMs ?? 8000
  const attempts = opts.attemptsPerModel ?? 2
  const imageB64 = imageBuffer.toString('base64')
  let lastErr = 'unknown'

  for (const model of MODEL_FALLBACK) {
    for (let a = 0; a < attempts; a++) {
      try {
        const { ok, status, json } = await callGemini(model, apiKey, imageB64, mimeType, timeoutMs)
        if (ok) {
          const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
          let parsed: Record<string, any>
          try {
            parsed = JSON.parse(text)
          } catch {
            lastErr = 'invalid JSON from model'
            continue
          }
          const fields: VisionFieldRead[] = []
          for (const [geminiKey, tpsField] of Object.entries(FIELD_MAP)) {
            const v = parsed[geminiKey]
            if (!v || typeof v !== 'object') continue
            fields.push({
              field: tpsField,
              cyrillic: typeof v.cyrillic === 'string' ? v.cyrillic.trim() : '',
              iso_date: typeof v.iso_date === 'string' ? v.iso_date.trim() : null,
              can_read: v.can_read === true,
              confidence: typeof v.confidence === 'number' ? v.confidence : 0,
              reason: typeof v.reason === 'string' ? v.reason : '',
            })
          }
          return { ok: true, fields, model, ms: Date.now() - t0 }
        }
        // 503 high-demand / 429 quota → retry / next model
        lastErr = `HTTP ${status}`
        if (status === 503 || status === 429) {
          await new Promise((r) => setTimeout(r, 1500))
          continue
        }
        // other error: try next model
        break
      } catch (e: any) {
        lastErr = e?.name === 'AbortError' ? 'timeout' : (e?.message ?? 'fetch error')
      }
    }
  }
  return { ok: false, fields: [], model: null, ms: Date.now() - t0, error: lastErr }
}

/**
 * Convert Cyrillic vision reads into TPS candidate fields.
 * Names/places → KMU-55 transliteration (deterministic). DOB → ISO from model.
 * Every field is review_required=true (handwritten Cyrillic, candidate-only).
 */
export function visionReadsToFields(
  reads: VisionFieldRead[],
  documentId: string,
): TpsExtractedField[] {
  const out: TpsExtractedField[] = []
  for (const r of reads) {
    if (!r.can_read) continue

    let value: string | null = null
    if (r.field === 'dob') {
      value = r.iso_date && /^\d{4}-\d{2}-\d{2}$/.test(r.iso_date) ? r.iso_date : null
    } else if (r.field === 'province_of_birth') {
      // Oblast → nominative + "Oblast" via knowledge (e.g. Вінницька область → Vinnytsia Oblast).
      value = r.cyrillic ? (normalizeProvince(r.cyrillic).value || transliterateKMU55(r.cyrillic)) : null
    } else {
      // Names + city: KMU-55 ONLY — never the LLM's own transliteration (it returned "Troshchianets").
      value = r.cyrillic ? transliterateKMU55(r.cyrillic) : null
    }
    if (!value) continue

    out.push({
      field: r.field,
      raw_value: r.cyrillic || value,
      normalized_value: value,
      confidence: Math.max(0, Math.min(1, r.confidence)),
      // Reuse existing source enum to avoid drift-gate churn; provenance via source_zone.
      extraction_source: 'dual_ocr_crossref',
      review_required: true, // handwritten Cyrillic is ALWAYS user-confirmed
      source_document_id: documentId,
      source_zone: 'gemini_vision',
      bbox: null,
      language_layer: 'cyrillic',
      ocr_word_ids: [],
      passes: ['gemini_vision_read'],
      failures: [],
      user_corrected: false,
    })
  }
  return out
}
