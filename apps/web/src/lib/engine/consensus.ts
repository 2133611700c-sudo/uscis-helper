/**
 * engine/consensus.ts — D1 Reader + Chief Engineer's hallucination guard.
 *
 * PROVEN PROBLEM (live, 2026-05-28): general vision LLMs do NOT fail gracefully
 * on handwritten Cyrillic — they fabricate a plausible but entirely fake value
 * with high confidence. Gemini Flash read a 1986 birth certificate as
 * "Хроменчук Олег"; GPT-4o read the SAME image as "Людмила Анатольевна". Two
 * different fakes. Only the PRINTED series number agreed.
 *
 * THE GUARD: never trust one model. Read each field with ≥2 independent models.
 *   - Models AGREE  → accept (high confidence). This is what happens on printed
 *     fields and clean handwriting.
 *   - Models DISAGREE → that is the signal that they are guessing → emit
 *     can_read=false, EMPTY value, review_required=true. The human types it
 *     (with the source crop + both candidates shown as hints). We NEVER show a
 *     confident fabrication.
 *
 * This module is pure + model-agnostic: the model read functions are injected,
 * so the agreement logic is unit-testable without network/keys.
 */

import { confusionDistance } from '@uscis-helper/knowledge'

export interface FieldRead {
  /** Exact text the model reported (Cyrillic, or '' if it couldn't read). */
  cyrillic: string
  can_read: boolean
  /** 0..1 model self-confidence (advisory only — a lying model reports 1.0). */
  confidence: number
}

/** A reader returns one FieldRead per requested field key. */
export type ModelReader = (
  image: Buffer,
  mime: string,
  fields: string[],
) => Promise<Record<string, FieldRead>>

export interface NamedReader {
  name: string
  read: ModelReader
}

export interface ConsensusField {
  field: string
  /** Accepted Cyrillic value, or '' when guarded/unread. */
  value: string
  /** True only when models agreed (or a single trusted printed read). */
  can_read: boolean
  /** 0..1 — derived from agreement, NOT from any single model's self-report. */
  confidence: number
  review_required: boolean
  /** machine reason for the audit log */
  reason: string
  /** every model's raw read — shown to the human as hints when guarded */
  candidates: Array<{ model: string; cyrillic: string; can_read: boolean; confidence: number }>
}

export interface ConsensusResult {
  fields: Record<string, ConsensusField>
  models: string[]
  agreed_count: number
  guarded_count: number
}

/** Normalize a Cyrillic reading for cross-model comparison. */
function norm(s: string): string {
  return (s ?? '')
    .toLocaleLowerCase('uk')
    .replace(/[^а-яіїєґ0-9]/giu, '') // keep Cyrillic letters + digits only
    .trim()
}

/**
 * Do two readings point at the same underlying value? Uses the
 * confusion-weighted distance so "Сергій"/"Сергей" (orthographic variants) or a
 * single handwriting confusion count as agreement, while "Хроменчук"/"Людмила"
 * (a fabrication) does not.
 */
export function readingsAgree(a: string, b: string, tol = 0.25): boolean {
  const x = norm(a)
  const y = norm(b)
  if (!x || !y) return false
  if (x === y) return true
  // Partial read of the SAME value: one reader (e.g. OCR) captured only a
  // fragment/prefix that the other contains → agreement, not disagreement.
  const [short, long] = x.length <= y.length ? [x, y] : [y, x]
  if (short.length >= 4 && long.includes(short)) return true
  // Number fields: same digit core ("294" vs "за№294", "№153243" vs "153243").
  const dx = x.replace(/\D/g, ''), dy = y.replace(/\D/g, '')
  if (dx.length >= 2 && dx === dy) return true
  const dist = confusionDistance(x, y)
  return dist / Math.max(x.length, y.length) <= tol
}

/** Largest mutually-agreeing cluster among readable candidates. */
function largestAgreementCluster(
  cands: Array<{ model: string; read: FieldRead }>,
  tol: number,
): Array<{ model: string; read: FieldRead }> {
  const readable = cands.filter((c) => c.read.can_read && norm(c.read.cyrillic))
  let best: Array<{ model: string; read: FieldRead }> = []
  for (const seed of readable) {
    const cluster = readable.filter((c) => readingsAgree(seed.read.cyrillic, c.read.cyrillic, tol))
    if (cluster.length > best.length) best = cluster
  }
  return best
}

/**
 * Reconcile one field across all model candidates.
 * `printedField` relaxes the guard: for a PRINTED field a single confident read
 * is trustworthy (it is not handwriting). Default false (handwriting-safe).
 */
export function reconcileField(
  field: string,
  cands: Array<{ model: string; read: FieldRead }>,
  opts: { printedField?: boolean; openName?: boolean; agreeTol?: number } = {},
): ConsensusField {
  const tol = opts.agreeTol ?? 0.25
  const candidates = cands.map((c) => ({
    model: c.model,
    cyrillic: c.read.cyrillic ?? '',
    can_read: !!c.read.can_read,
    confidence: c.read.confidence ?? 0,
  }))
  const readable = cands.filter((c) => c.read.can_read && norm(c.read.cyrillic))

  if (readable.length === 0) {
    return { field, value: '', can_read: false, confidence: 0, review_required: true, reason: 'no model could read this field', candidates }
  }

  const cluster = largestAgreementCluster(cands, tol)

  // ≥2 models agree → accept. Representative = highest self-confidence in cluster.
  if (cluster.length >= 2) {
    const rep = cluster.slice().sort((a, b) => b.read.confidence - a.read.confidence)[0]
    // SYSTEMATIC-ERROR GUARD (the "Тимофевич" case): models can agree on the
    // SAME wrong reading (shared training bias). For OPEN-SET fields — surnames,
    // given names, free authority text — agreement is NOT proof of truth, so we
    // keep the value as a SUGGESTION but still force human confirmation.
    // Closed/verifiable fields (dates, years, numbers, gazetteer cities,
    // generated patronymics) auto-accept on agreement.
    if (opts.openName) {
      return {
        field,
        value: rep.read.cyrillic,
        can_read: true,
        confidence: 0.6,
        review_required: true,
        reason: `${cluster.length} models agree, but open-set name — confirm (consensus does not catch shared/systematic misreads)`,
        candidates,
      }
    }
    return {
      field,
      value: rep.read.cyrillic,
      can_read: true,
      confidence: 0.9,
      review_required: false,
      reason: `${cluster.length} models agree`,
      candidates,
    }
  }

  // Exactly one model read it, others could not.
  if (readable.length === 1) {
    if (opts.printedField) {
      return { field, value: readable[0].read.cyrillic, can_read: true, confidence: 0.7, review_required: true, reason: 'single read of a PRINTED field — confirm', candidates }
    }
    return { field, value: '', can_read: false, confidence: 0, review_required: true, reason: 'only one model read a handwritten field — unconfirmed, needs human', candidates }
  }

  // Multiple models read it but they DISAGREE → hallucination guard fires.
  return {
    field,
    value: '',
    can_read: false,
    confidence: 0,
    review_required: true,
    reason: `HALLUCINATION GUARD: models disagree (${candidates.filter((c) => c.can_read).map((c) => `${c.model}:"${c.cyrillic}"`).join(' vs ')})`,
    candidates,
  }
}

/**
 * Read a document with every model in parallel, then reconcile each field
 * through the hallucination guard. `printedFields` lists fields that are
 * machine-printed on this doc type (series/number) where a single read is OK.
 */
export async function consensusRead(
  image: Buffer,
  mime: string,
  fields: string[],
  readers: NamedReader[],
  opts: { printedFields?: string[]; openNameFields?: string[]; agreeTol?: number } = {},
): Promise<ConsensusResult> {
  const printed = new Set(opts.printedFields ?? [])
  const openNames = new Set(opts.openNameFields ?? [])
  const settled = await Promise.allSettled(readers.map((r) => r.read(image, mime, fields)))
  const perModel: Array<{ name: string; reads: Record<string, FieldRead> }> = []
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled') perModel.push({ name: readers[i].name, reads: s.value })
    // a model that errored simply does not vote (never blocks)
  })

  const out: Record<string, ConsensusField> = {}
  let agreed = 0
  let guarded = 0
  for (const field of fields) {
    const cands = perModel.map((m) => ({ model: m.name, read: m.reads[field] ?? { cyrillic: '', can_read: false, confidence: 0 } }))
    const rec = reconcileField(field, cands, { printedField: printed.has(field), openName: openNames.has(field), agreeTol: opts.agreeTol })
    out[field] = rec
    if (rec.can_read) agreed++
    else guarded++
  }
  return { fields: out, models: perModel.map((m) => m.name), agreed_count: agreed, guarded_count: guarded }
}
