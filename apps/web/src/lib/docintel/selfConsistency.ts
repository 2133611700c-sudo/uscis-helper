/**
 * docintel/selfConsistency — self-consistency as an INSTABILITY DETECTOR.
 * Design: docs/reports/SELF_CONSISTENCY_DESIGN.md.
 *
 * NOT a majority vote. NOT a "pick the right answer". Re-reading the same image and
 * comparing the extracted IDENTITY tells us whether the model is STABLE on this
 * (handwritten) document. Disagreement ⇒ force review. Agreement ≠ correctness —
 * it NEVER lowers review and NEVER claims the value is right.
 *
 * The identity tuple is built from the RAW model read (Cyrillic) BEFORE any
 * KMU-55 / gazetteer / dictionary normalization — otherwise a "smart" normalizer
 * could collapse two different model reads to the same string and hide instability.
 */

import crypto from 'node:crypto'
import { isIdentityCriticalField } from './antiFabricationGate'
import type { ExtractedDocField, VisionFieldRead } from './types'

/** Substrings of the identity tuple used for the instability hash (design §3). */
const IDENTITY_TUPLE_SUBSTRINGS = [
  'family_name',
  'given_name',
  'patronymic',
  'middle_name',
  'date_of_birth',
  'dob',
  'place_of_birth',
  'place_city',
] as const

function isTupleField(fieldId: string): boolean {
  const f = (fieldId ?? '').toLowerCase()
  return IDENTITY_TUPLE_SUBSTRINGS.some((s) => f.includes(s))
}

/** Compare-only normalization. Deliberately NOT KMU/dictionary. */
export function normalizeForCompare(s: string): string {
  return (s ?? '')
    .normalize('NFC')
    .replace(/[’'`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('uk')
}

/**
 * Deterministic identity hash from a RAW vision read. Returns the hash and the
 * count of non-empty identity tuple fields (for the sparse-tuple guard).
 */
export function identityHash(rawFields: VisionFieldRead[]): { hash: string; count: number } {
  const entries: string[] = []
  for (const r of rawFields) {
    if (!r || !isTupleField(r.field)) continue
    const raw = (r.cyrillic || r.iso_date || '').toString()
    const norm = normalizeForCompare(raw)
    if (!norm) continue
    entries.push(`${r.field.toLowerCase()}=${norm}`)
  }
  entries.sort()
  const hash = crypto.createHash('sha256').update(entries.join('|')).digest('hex')
  return { hash, count: entries.length }
}

export type SelfConsistencyStatus = 'agree' | 'mismatch' | 'incomplete' | 'insufficient_identity_fields'

const REASON_BY_STATUS: Record<Exclude<SelfConsistencyStatus, 'agree'>, string> = {
  mismatch: 'self_consistency_identity_mismatch',
  incomplete: 'self_consistency_incomplete',
  insufficient_identity_fields: 'insufficient_identity_fields',
}

/**
 * Decide the status from the first read's tuple count and the other reads' hashes.
 * - <2 identity fields → insufficient_identity_fields (cannot self-verify).
 * - any later read errored (null) → incomplete.
 * - any later hash differs from the first → mismatch.
 * - all present and equal → agree.
 */
export function decideStatus(
  first: { hash: string; count: number },
  others: Array<{ hash: string; count: number } | null>,
): SelfConsistencyStatus {
  if (first.count < 2) return 'insufficient_identity_fields'
  if (others.some((o) => o === null)) return 'incomplete'
  if (others.some((o) => o!.hash !== first.hash)) return 'mismatch'
  return 'agree'
}

/**
 * R5 — self-consistency VOTING (SELF_CONSISTENCY_VOTE_ENABLED, default OFF; consulted only
 * under the existing SELF_CONSISTENCY_GATE_ENABLED gate). Today self-consistency is an
 * INSTABILITY DETECTOR that only RAISES review on mismatch. When voting is enabled it reads
 * K runs and MAJORITY-PICKS the value per identity field (not just flags) — a tie or a field
 * with no strict majority keeps the primary read's value and is forced to review.
 *
 * Pure. `runs` = the primary read fields + the K-1 re-read field arrays. The raw source token
 * used for the vote is raw_cyrillic/iso_date (BEFORE normalization), mirroring the hash path.
 */
export function isSelfConsistencyVoteEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.SELF_CONSISTENCY_VOTE_ENABLED === '1'
}

/** A read of a single field in either the canonical or the raw provider shape. */
type VoteReadField = {
  field: string
  raw_cyrillic?: string | null
  cyrillic?: string | null
  iso_date?: string | null
  value?: string | null
}

/** Comparable raw token for one read of a field (raw Cyrillic preferred, then ISO date, then value). */
function rawTokenOf(f: VoteReadField): string {
  return normalizeForCompare((f.raw_cyrillic ?? f.cyrillic ?? f.iso_date ?? f.value ?? '').toString())
}

export interface VoteOutcome {
  /** field key → { token, count, total } for the winning token (audit/observability). */
  picked: Map<string, { token: string; count: number; total: number; majority: boolean }>
}

/**
 * Majority-pick per identity field across K reads. `reads[0]` is the primary read (whose field
 * objects are returned, value-preserved when it already holds the majority token); `reads[1..]`
 * are the re-reads. A field with a STRICT majority (> half the reads agreeing on a non-empty
 * token) is "majority": if the primary read's token already equals the winner, nothing changes;
 * if it differs, the field stays the primary value but is forced to review (we never fabricate a
 * value the primary read did not produce — we only DOWN-rank the disagreeing primary). No strict
 * majority → review. NEVER lowers review, NEVER invents a value absent from all reads.
 */
export function decideVote(
  primary: VoteReadField[],
  reReads: VoteReadField[][],
): VoteOutcome {
  const all = [primary, ...reReads]
  const total = all.length
  const picked = new Map<string, { token: string; count: number; total: number; majority: boolean }>()
  for (const pf of primary) {
    if (!isTupleField(pf.field)) continue
    const counts = new Map<string, number>()
    for (const read of all) {
      const rf = read.find((x) => x.field === pf.field)
      if (!rf) continue
      const tok = rawTokenOf(rf)
      if (!tok) continue
      counts.set(tok, (counts.get(tok) ?? 0) + 1)
    }
    let bestTok = ''
    let bestN = 0
    for (const [tok, n] of counts) {
      if (n > bestN) { bestN = n; bestTok = tok }
    }
    const majority = bestN * 2 > total // strict majority of the K reads
    picked.set(pf.field, { token: bestTok, count: bestN, total, majority })
  }
  return picked.size ? { picked } : { picked }
}

/**
 * Apply a vote outcome to the canonical fields (pure). For each identity field:
 *   - strict majority AND the primary read's raw token equals the winner → field unchanged
 *     (value confirmed by the vote; review not lowered, not raised).
 *   - strict majority BUT primary read disagrees → keep the primary value, force review
 *     (reason self_consistency_vote_minority); we do NOT overwrite with a value the primary
 *     reader did not produce.
 *   - no strict majority → force review (reason self_consistency_vote_no_majority).
 * NEVER changes a value, NEVER lowers review.
 */
export function applyVoteOutcome(
  fields: ExtractedDocField[],
  outcome: VoteOutcome,
): ExtractedDocField[] {
  return fields.map((f) => {
    const v = outcome.picked.get(f.field)
    if (!v) return f
    const primaryTok = rawTokenOf(f)
    if (v.majority && primaryTok === v.token && primaryTok.length > 0) return f // confirmed
    const reason = v.majority ? 'self_consistency_vote_minority' : 'self_consistency_vote_no_majority'
    const reasons = Array.from(new Set([...(f.review_reasons ?? []), reason]))
    return { ...f, review_required: true, review_reasons: reasons }
  })
}

/**
 * Apply the outcome to the canonical fields. Pure. `agree` → unchanged. Otherwise
 * force review on identity-critical fields + append the reason. NEVER changes a
 * value, NEVER lowers a flag, NEVER claims correctness.
 */
export function applySelfConsistencyOutcome(
  fields: ExtractedDocField[],
  status: SelfConsistencyStatus,
): ExtractedDocField[] {
  if (status === 'agree') return fields
  const reason = REASON_BY_STATUS[status]
  return fields.map((f) => {
    if (!isIdentityCriticalField(f.field)) return f
    const reasons = Array.from(new Set([...(f.review_reasons ?? []), reason]))
    return { ...f, review_required: true, review_reasons: reasons }
  })
}
