/**
 * ruleAnchorClassifier.ts — PHASE 4 provider: DETERMINISTIC printed-anchor classifier.
 *
 * The cheapest, network-free tier of the "provider proposes" chain: given OCR/printed text (from any
 * OCR source) it matches the Phase-1 registry `printedAnchors` and proposes a doc-type CANDIDATE.
 * It never decides (the brain arbitrates) and never reads handwriting. Pure + fully testable.
 *
 * Doctrine: provider proposes · registry constrains. Country-scoping is honored (only allowed ids
 * are considered). Fail-closed: no anchor hit ⇒ 'unknown' with confidence 0.
 */
import { CANONICAL_DOCUMENT_REGISTRY as REG, type DocumentTypeId } from '../canonicalRegistry'

export interface RuleClassifierResult {
  docTypeId: DocumentTypeId | 'unknown'
  confidence: number
  candidates: Array<{ doc_type_id: DocumentTypeId; confidence: number }>
  matchedAnchors: string[] // which anchors matched (PII-safe: these are printed FORM strings, not values)
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Classify by printed anchors. `text` is the OCR'd printed text of the (oriented) document.
 * `allowed` restricts candidates (country-scoped from the funnel); default = all real types.
 */
export function classifyByAnchors(text: string, allowed?: DocumentTypeId[]): RuleClassifierResult {
  const hay = normalize(text)
  const ids = (allowed ?? (Object.keys(REG) as DocumentTypeId[])).filter((id) => {
    const e = REG[id]
    return e && e.family !== 'unknown' && e.family !== 'not_a_document' && e.printedAnchors.length > 0
  })

  const scored: Array<{ doc_type_id: DocumentTypeId; confidence: number; matched: string[] }> = []
  for (const id of ids) {
    const e = REG[id]
    const matched = e.printedAnchors.filter((a) => hay.includes(normalize(a)))
    if (matched.length === 0) continue
    // negative anchors veto a match
    const vetoed = e.negativeAnchors.some((a) => hay.includes(normalize(a)))
    if (vetoed) continue
    // confidence = fraction of this type's anchors seen, mildly boosted by absolute count
    const frac = matched.length / e.printedAnchors.length
    const confidence = Math.min(1, frac * 0.7 + Math.min(matched.length, 3) * 0.1)
    scored.push({ doc_type_id: id, confidence, matched })
  }
  scored.sort((a, b) => b.confidence - a.confidence)
  if (scored.length === 0) {
    return { docTypeId: 'unknown', confidence: 0, candidates: [], matchedAnchors: [] }
  }
  const top = scored[0]
  return {
    docTypeId: top.doc_type_id,
    confidence: top.confidence,
    candidates: scored.slice(0, 3).map((s) => ({ doc_type_id: s.doc_type_id, confidence: s.confidence })),
    matchedAnchors: top.matched,
  }
}
