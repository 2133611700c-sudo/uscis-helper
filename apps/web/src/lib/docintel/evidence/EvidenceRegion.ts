/**
 * EvidenceRegion — the ONE evidence contract (One-Brain Convergence §3.6).
 *
 * A single normalized type describing WHERE a field's value was found on the page,
 * and HOW certain that location is. It unifies every localization source the
 * pipeline has (OCR tokens, deterministic field-box templates, the LLM reader, and
 * "nothing found") behind one shape so downstream crop/render/review code never has
 * to special-case the origin.
 *
 * HONESTY RULE (§3.6): a region whose bbox is not a real, field-level box
 * (full_image / missing / zone_fallback) MUST NOT claim status 'exact'. An
 * 'exact' status is a promise that `bbox` tightly bounds the field. Lying here
 * would let a whole-page crop be presented to a human reviewer as a precise field
 * location. `isHonestEvidence` enforces this invariant; the adapters below can
 * only ever construct honest regions.
 *
 * Bbox convention: normalized 0..1 [x0, y0, x1, y1] (top-left origin), which is
 * exactly how FIELD_BOX_TEMPLATES are stored ([left, top, right, bottom]).
 */

/** Normalized bounding box, 0..1, top-left origin: [x0, y0, x1, y1]. */
export type NormalizedBox = [number, number, number, number]

/**
 * How trustworthy/precise the region's location is:
 *  - 'exact'         — bbox tightly bounds the field (e.g. a single OCR token span).
 *  - 'combined'      — bbox is the union of several token boxes for one field.
 *  - 'approximate'   — bbox from a deterministic field template (right area, not pixel-perfect).
 *  - 'zone_fallback' — bbox is a coarse page zone, not the field itself.
 *  - 'full_image'    — no bbox; the value came from a reader with no localization (LLM).
 *  - 'missing'       — the field was not located at all.
 */
export type EvidenceStatus =
  | 'exact'
  | 'combined'
  | 'approximate'
  | 'zone_fallback'
  | 'full_image'
  | 'missing'

/** What produced the region. */
export type EvidenceSource = 'ocr_token' | 'field_template' | 'model' | 'none'

export interface EvidenceRegion {
  /** docintel field key this region locates (e.g. 'family_name'). */
  fieldKey: string
  /** Normalized 0..1 [x0,y0,x1,y1], or null when there is no field-level box. */
  bbox: NormalizedBox | null
  /** 1-based page number. */
  page: number
  status: EvidenceStatus
  source: EvidenceSource
  /** Optional path to a saved crop of this region. */
  cropPath?: string | null
}

/**
 * HONESTY GUARD (§3.6). Returns false for any region that lies about its precision:
 *  - a full_image / missing / zone_fallback region claiming 'exact';
 *  - a 'missing' region that nonetheless carries a bbox;
 *  - a 'full_image' region that nonetheless carries a bbox;
 *  - an 'exact' / 'combined' / 'approximate' region with no bbox to back the claim.
 */
export function isHonestEvidence(r: EvidenceRegion): boolean {
  // A bbox-less region must never claim 'exact' precision (the core §3.6 invariant:
  // full_image / missing / zone_fallback can never be 'exact').
  if (r.bbox === null && r.status === 'exact') {
    return false
  }
  // full_image and missing assert "no field-level box" → bbox must be null.
  if ((r.status === 'full_image' || r.status === 'missing') && r.bbox !== null) {
    return false
  }
  // A field-level precision claim requires an actual bbox.
  if ((r.status === 'exact' || r.status === 'combined' || r.status === 'approximate') && r.bbox === null) {
    return false
  }
  return true
}

/**
 * Build a region from a deterministic FIELD_BOX_TEMPLATES entry.
 * Templates are normalized 0..1 [left, top, right, bottom] === [x0, y0, x1, y1].
 * Status is 'approximate' (template area, not pixel-perfect); source 'field_template'.
 */
export function fromTemplateBox(fieldKey: string, box: NormalizedBox, page = 1): EvidenceRegion {
  return {
    fieldKey,
    bbox: [box[0], box[1], box[2], box[3]],
    page,
    status: 'approximate',
    source: 'field_template',
    cropPath: null,
  }
}

/**
 * Build a region for a value read by the LLM, which has no bounding box.
 * Status 'full_image', source 'model', bbox null.
 */
export function fullImageRegion(fieldKey: string, page = 1): EvidenceRegion {
  return {
    fieldKey,
    bbox: null,
    page,
    status: 'full_image',
    source: 'model',
    cropPath: null,
  }
}

/**
 * Build a region for a field that was not located at all.
 * Status 'missing', source 'none', bbox null.
 */
export function missingRegion(fieldKey: string, page = 1): EvidenceRegion {
  return {
    fieldKey,
    bbox: null,
    page,
    status: 'missing',
    source: 'none',
    cropPath: null,
  }
}
