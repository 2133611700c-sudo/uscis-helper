/**
 * OCR/extraction metrics (Stage 2) — pure functions scoring Prediction[] vs
 * GroundTruthRecord[]. Adds the metrics missing today (document-exact, wrong-field
 * assignment, abstention precision/recall, per-rendering + per-template rollups,
 * bbox coverage, exact-crop rate) on top of the existing CER/field-exact taxonomy.
 *
 * HARD RULE: printed and handwriting are NEVER blended into one figure. perRendering()
 * returns two separate rollups; a single combined accuracy number is not provided.
 */
import type {
  GroundTruthRecord, Prediction, FieldVerdict, RollupCounts, AbstentionScore, EvidenceCoverage,
} from './types'

// ── channel-aware CER (Cyrillic-folded; never cross alphabets) ──────────────────
const CYR = /[^а-яёіїєґʼ'’-]/giu
const fold = (s: string | null | undefined): string => (s ?? '').toLowerCase().replace(CYR, '')

export function cer(pred: string | null, gt: string | null): number {
  const a = fold(pred), b = fold(gt)
  if (!b) return a ? 1 : 0
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]; dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return Math.round((dp[b.length] / b.length) * 1000) / 1000
}

const exactMatch = (pred: string | null, gt: string | null): boolean => fold(pred) === fold(gt) && fold(gt) !== ''

/** Per-field verdict. */
export function fieldVerdict(gt: GroundTruthRecord, pred: Prediction | undefined): FieldVerdict {
  const produced = pred ? !pred.abstained && (pred.value ?? '').trim() !== '' : false
  if (gt.expectedAbstention || gt.expectedCyrillic === null) {
    return produced ? 'FABRICATED' : 'CORRECT_ABSTAIN'
  }
  if (!produced) return 'MISS'
  return exactMatch(pred!.value, gt.expectedCyrillic) ? 'EXACT' : 'WRONG'
}

function rollup(gts: GroundTruthRecord[], byField: Map<string, Prediction>): RollupCounts {
  const c = { total: gts.length, exact: 0, wrong: 0, miss: 0, correctAbstain: 0, fabricated: 0 }
  let cerSum = 0, cerN = 0
  for (const gt of gts) {
    const v = fieldVerdict(gt, byField.get(`${gt.docId}::${gt.fieldId}`))
    if (v === 'EXACT') c.exact++
    else if (v === 'WRONG') c.wrong++
    else if (v === 'MISS') c.miss++
    else if (v === 'CORRECT_ABSTAIN') c.correctAbstain++
    else c.fabricated++
    if (gt.expectedCyrillic !== null && !gt.expectedAbstention) {
      const p = byField.get(`${gt.docId}::${gt.fieldId}`)
      cerSum += cer(p?.value ?? null, gt.expectedCyrillic); cerN++
    }
  }
  const denom = c.exact + c.wrong + c.miss
  return { ...c, fieldExactRate: denom ? round(c.exact / denom) : 0, meanCer: cerN ? round(cerSum / cerN) : 0 }
}

const round = (n: number) => Math.round(n * 1000) / 1000
const indexPreds = (preds: Prediction[]) => new Map(preds.map((p) => [`${p.docId}::${p.fieldId}`, p]))

/** Overall rollup across a (single-rendering) set. Caller must not blend renderings. */
export function scoreRollup(gts: GroundTruthRecord[], preds: Prediction[]): RollupCounts {
  return rollup(gts, indexPreds(preds))
}

/** document-exact: fraction of documents where every required field is EXACT. */
export function documentExact(gts: GroundTruthRecord[], preds: Prediction[]): number {
  const byDoc = new Map<string, GroundTruthRecord[]>()
  for (const gt of gts) byDoc.set(gt.docId, [...(byDoc.get(gt.docId) ?? []), gt])
  const idx = indexPreds(preds)
  let ok = 0
  for (const [, docGts] of byDoc) {
    const required = docGts.filter((g) => g.expectedCyrillic !== null && !g.expectedAbstention)
    if (required.length === 0) continue
    if (required.every((g) => fieldVerdict(g, idx.get(`${g.docId}::${g.fieldId}`)) === 'EXACT')) ok++
  }
  const docsWithRequired = [...byDoc.values()].filter((ds) => ds.some((g) => g.expectedCyrillic !== null && !g.expectedAbstention)).length
  return docsWithRequired ? round(ok / docsWithRequired) : 0
}

/**
 * wrong-field assignment: a produced value that does NOT match this field's GT but
 * DOES match another field's GT on the same document (the value was placed in the
 * wrong slot).
 */
export function wrongFieldAssignmentRate(gts: GroundTruthRecord[], preds: Prediction[]): number {
  const idx = indexPreds(preds)
  const gtByDoc = new Map<string, GroundTruthRecord[]>()
  for (const gt of gts) gtByDoc.set(gt.docId, [...(gtByDoc.get(gt.docId) ?? []), gt])
  let misassigned = 0, produced = 0
  for (const gt of gts) {
    const p = idx.get(`${gt.docId}::${gt.fieldId}`)
    if (!p || p.abstained || !(p.value ?? '').trim()) continue
    produced++
    if (exactMatch(p.value, gt.expectedCyrillic)) continue
    const others = (gtByDoc.get(gt.docId) ?? []).filter((g) => g.fieldId !== gt.fieldId)
    if (others.some((g) => exactMatch(p.value, g.expectedCyrillic))) misassigned++
  }
  return produced ? round(misassigned / produced) : 0
}

/** abstention precision/recall over fields that should abstain. */
export function abstentionScore(gts: GroundTruthRecord[], preds: Prediction[]): AbstentionScore {
  const idx = indexPreds(preds)
  let shouldAbstain = 0, didAbstain = 0, correctAbstain = 0
  for (const gt of gts) {
    const p = idx.get(`${gt.docId}::${gt.fieldId}`)
    const abstained = p ? p.abstained || (p.value ?? '').trim() === '' : true
    const should = gt.expectedAbstention || gt.expectedCyrillic === null
    if (should) shouldAbstain++
    if (abstained) didAbstain++
    if (should && abstained) correctAbstain++
  }
  return {
    precision: didAbstain ? round(correctAbstain / didAbstain) : 0,
    recall: shouldAbstain ? round(correctAbstain / shouldAbstain) : 0,
    shouldAbstain, didAbstain, correctAbstain,
  }
}

/** Per-rendering rollups — printed and handwriting kept SEPARATE (never blended). */
export function perRendering(gts: GroundTruthRecord[], preds: Prediction[]): { printed: RollupCounts; handwritten: RollupCounts } {
  const idx = indexPreds(preds)
  return {
    printed: rollup(gts.filter((g) => g.rendering === 'printed'), idx),
    handwritten: rollup(gts.filter((g) => g.rendering === 'handwritten'), idx),
  }
}

/** Per-template (documentFamily/template) rollups. */
export function perTemplate(gts: GroundTruthRecord[], preds: Prediction[]): Record<string, RollupCounts> {
  const idx = indexPreds(preds)
  const groups = new Map<string, GroundTruthRecord[]>()
  for (const gt of gts) {
    const k = gt.template ? `${gt.documentFamily}/${gt.template}` : gt.documentFamily
    groups.set(k, [...(groups.get(k) ?? []), gt])
  }
  const out: Record<string, RollupCounts> = {}
  for (const [k, g] of groups) out[k] = rollup(g, idx)
  return out
}

/** bbox coverage + exact-crop rate over non-abstained predictions. */
export function evidenceCoverage(preds: Prediction[]): EvidenceCoverage {
  const live = preds.filter((p) => !p.abstained && (p.value ?? '').trim() !== '')
  if (!live.length) return { bboxCoverage: 0, exactCropRate: 0 }
  const withBbox = live.filter((p) => p.hasBbox === true).length
  const exact = live.filter((p) => p.bboxStatus === 'exact').length
  return { bboxCoverage: round(withBbox / live.length), exactCropRate: round(exact / live.length) }
}
