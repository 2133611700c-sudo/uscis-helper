/**
 * offlineFieldLocalizer — deterministic, DeepSeek-free field→token localization (One-Brain
 * evidence entry seam). This is the missing producer of visual geometry: given the field
 * VALUES a semantic reader already decided and an OCR token layer (Google Vision words with
 * normalized bboxes), it finds WHERE each value sits on the page and emits EvidenceRegion[].
 *
 * It is EVIDENCE-ONLY (One-Brain §7): it never proposes or changes a field value, never votes
 * in arbitration — it only locates an already-chosen value among OCR tokens. Provider bbox
 * flows: Google Vision response → extractText (parser, existing) → OcrResult → THIS → regions.
 * The only billing-gated part is the network fetch; parse + localization are fully offline.
 *
 * Honesty (§3.6/§5): a single-token match → 'exact'; a contiguous multi-token run → 'combined'
 * (union bbox); a value that cannot be located → NO region (never a fabricated box). A
 * zero-area union is dropped. Coordinates stay normalized 0..1.
 */
import type { EvidenceRegion, NormalizedBox } from './EvidenceRegion'
import type { OcrResult, OcrWord, OcrPage } from '@/lib/ocr/types'

export interface FieldValueForLocate {
  /** docintel field key, e.g. 'family_name'. */
  key: string
  /** the value the semantic reader chose (raw Cyrillic or Latin — matched case/space-insensitively). */
  value: string | null | undefined
}

/** Collapse to a comparable token: lowercase, drop everything but letters/digits (any script). */
function norm(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

function unionTuple(words: OcrWord[]): NormalizedBox | null {
  if (words.length === 0) return null
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0
  for (const w of words) {
    const b = w.bbox
    x0 = Math.min(x0, b.x)
    y0 = Math.min(y0, b.y)
    x1 = Math.max(x1, b.x + b.width)
    y1 = Math.max(y1, b.y + b.height)
  }
  if (x1 <= x0 || y1 <= y0) return null // zero / inverted area → drop
  return [x0, y0, x1, y1]
}

/**
 * Locate one field value in a single page's word stream. Returns the shortest contiguous run
 * of words (in reading order) whose concatenated normalized text EQUALS the normalized value.
 * Contiguous run handles multi-word and multi-line values (words are page-ordered). Returns
 * null when the value is not found as a clean contiguous run (no fuzzy/partial — fail closed).
 */
function locateInPage(valueNorm: string, words: OcrWord[]): OcrWord[] | null {
  if (!valueNorm) return null
  const normed = words.map((w) => ({ w, n: norm(w.text) })).filter((t) => t.n.length > 0)
  for (let i = 0; i < normed.length; i++) {
    let acc = ''
    const run: OcrWord[] = []
    for (let j = i; j < normed.length; j++) {
      acc += normed[j].n
      run.push(normed[j].w)
      if (acc.length > valueNorm.length) break
      if (acc === valueNorm) return run
    }
  }
  return null
}

/**
 * Produce evidence regions for the given field values from an OCR token layer.
 * Deterministic; evidence-only; never fabricates. One region per located field (on the page it
 * was found). Values that cannot be located are simply omitted (the caller keeps them as
 * template/full_image/missing per the fallback policy).
 */
export function localizeFieldsInOcr(
  fields: FieldValueForLocate[],
  ocr: OcrResult,
): EvidenceRegion[] {
  const out: EvidenceRegion[] = []
  const pages: OcrPage[] = ocr.pages ?? []
  for (const f of fields) {
    const v = norm(f.value ?? '')
    if (!v) continue
    let located: { words: OcrWord[]; page: number } | null = null
    // search pages in order; first clean contiguous match wins (page-aware)
    for (let p = 0; p < pages.length; p++) {
      const hit = locateInPage(v, pages[p].words ?? [])
      if (hit) { located = { words: hit, page: p + 1 }; break }
    }
    // fallback: some providers only fill the flat `words` list (single page)
    if (!located && pages.length === 0 && Array.isArray(ocr.words)) {
      const hit = locateInPage(v, ocr.words)
      if (hit) located = { words: hit, page: 1 }
    }
    if (!located) continue // not found → no region (never fabricate)
    const bbox = unionTuple(located.words)
    if (!bbox) continue // zero-area → drop
    out.push({
      fieldKey: f.key,
      bbox,
      page: located.page,
      status: located.words.length === 1 ? 'exact' : 'combined',
      source: 'ocr_token',
    })
  }
  return out
}
