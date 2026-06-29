/**
 * evidenceAdapters — One-Brain STEP C: per-provider geometry → EvidenceRegion.
 *
 * Each recognition engine speaks its own native geometry dialect:
 *   - OCR providers (google_vision, …) emit OcrBoundingBox {x,y,width,height} (0..1).
 *   - The deterministic field-box templates emit [left,top,right,bottom] (0..1).
 *   - Gemini (the LLM reader) emits NO geometry at all — only field values.
 *
 * These adapters live at the reader boundary and normalize every dialect into the
 * single EvidenceRegion contract (§3.6) so downstream crop/render/review code never
 * special-cases the origin.
 *
 * HONESTY (§3.6, enforced by isHonestEvidence): an adapter may NEVER emit an
 * 'exact'/'combined' status without a real field-level bbox. OCR token boxes are the
 * only true field-level geometry here and use the constructor in EvidenceRegion; this
 * module's own constructors only ever produce 'approximate' (template) or 'full_image'
 * (Gemini) regions, both of which are honest by construction. `assertHonest` is the
 * guard path that proves it.
 */
import {
  type EvidenceRegion,
  type NormalizedBox,
  fromTemplateBox,
  fullImageRegion,
  isHonestEvidence,
} from './EvidenceRegion'
import { FIELD_BOX_TEMPLATES } from '../ensemble/handwrittenFieldRoute'

/**
 * Convert an OCR provider's native bbox {x,y,width,height} (0..1, top-left origin)
 * into the EvidenceRegion tuple convention [x0,y0,x1,y1].
 * x1 = x + width, y1 = y + height.
 */
export function bboxFromOcrBox(b: {
  x: number
  y: number
  width: number
  height: number
}): NormalizedBox {
  return [b.x, b.y, b.x + b.width, b.y + b.height]
}

/**
 * Resolve the FIELD_BOX_TEMPLATES entry for a docTypeId. Templates are keyed by a
 * doc-class substring (e.g. 'ua_birth_certificate'), matching handwrittenFieldRoute's
 * own `includes` lookup so an id like 'ua_birth_certificate_soviet_v1' still resolves.
 * READ-ONLY: the imported map is never mutated.
 */
function templateForDocType(
  docTypeId: string,
): Record<string, [number, number, number, number]> | null {
  if (!docTypeId) return null
  for (const [key, tmpl] of Object.entries(FIELD_BOX_TEMPLATES)) {
    if (docTypeId.includes(key)) return tmpl
  }
  return null
}

/**
 * Template adapter: every field box for a doc class → an 'approximate' /
 * 'field_template' EvidenceRegion. Returns [] when the doc type has no template.
 * (Templates are right-area, not pixel-perfect → 'approximate', never 'exact'.)
 */
export function templateEvidenceForDocType(
  docTypeId: string,
  page = 1,
): EvidenceRegion[] {
  const tmpl = templateForDocType(docTypeId)
  if (!tmpl) return []
  const regions = Object.entries(tmpl).map(([fieldKey, box]) =>
    fromTemplateBox(fieldKey, box as NormalizedBox, page),
  )
  return regions.map(assertHonest)
}

/**
 * Gemini adapter: the LLM reader has no localization, so each field it returns a
 * value for gets a 'full_image' / 'model' region (bbox null). Never 'exact'.
 */
export function geminiEvidence(fieldKeys: string[], page = 1): EvidenceRegion[] {
  return fieldKeys.map((fieldKey) => assertHonest(fullImageRegion(fieldKey, page)))
}

/**
 * HONESTY GUARD path (§3.6). Returns the region unchanged, or throws if it lies
 * about its precision. Every region these adapters emit flows through here so a
 * future edit that fabricates an 'exact' bbox-less region fails loudly instead of
 * silently presenting a whole-page crop as a precise field location.
 */
export function assertHonest(r: EvidenceRegion): EvidenceRegion {
  if (!isHonestEvidence(r)) {
    throw new Error(
      `evidenceAdapters: dishonest EvidenceRegion for "${r.fieldKey}" ` +
        `(status=${r.status}, bbox=${r.bbox === null ? 'null' : 'set'})`,
    )
  }
  return r
}
