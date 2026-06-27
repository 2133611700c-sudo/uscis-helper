/**
 * forensics.ts — behavior-neutral runtime forensic logger (Stage-1 measurement layer).
 *
 * PURPOSE: capture, for ONE document read, the exact provenance needed to separate
 *   (a) byte-repeat stability   — same SHA → same result?
 *   (b) rotation invariance     — different physical orientation → same canonical result?
 *   (c) page-context stability  — single page vs multipage → compatible identity fields?
 * without which every downstream conclusion is a guess.
 *
 * CONTRACT (hard):
 *  - Gated by FORENSIC_LOG_ENABLED (default OFF). When OFF: NOTHING here runs — no extra
 *    Gemini calls, no retries changed, no timing-sensitive control flow, no PII written.
 *  - Full raw values (PII) are written ONLY to a gitignored local artifact:
 *      qa-private/runtime-forensics/<run_id>.json
 *  - console/server logs get ONLY a PII-free digest: run_id, source_sha256, dims, orientation,
 *    model, stage names, latency, field NAMES, and HASHED values — never raw names/photos/keys.
 *  - Every fs / hashing op is fail-open: a forensic error must NEVER break or alter the read.
 */
import { createHash } from 'crypto'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

export const isForensicEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env.FORENSIC_LOG_ENABLED === '1'

/** Short, stable, PII-free fingerprint of a value (for safe console correlation). */
export const hashShort = (s: string | null | undefined): string | null =>
  s == null ? null : createHash('sha256').update(String(s)).digest('hex').slice(0, 12)

export const sha256Hex = (b: Buffer | string): string =>
  createHash('sha256').update(b).digest('hex')

export interface ForensicAttempt {
  n: number
  model: string
  selected: boolean
  reason?: string          // retry/fallback reason or error class
  http_status?: number
  candidate_hash?: string  // hash of the raw candidate text (never the text)
  ms?: number
}

export interface ForensicField {
  field: string
  raw_value: string | null      // raw Cyrillic from the reader (PII — artifact only)
  language_route?: string | null
  normalizers?: string[]
  final_value: string | null    // normalized English (PII — artifact only)
  review_required: boolean
  review_reasons?: string[]
}

export interface ForensicRecord {
  run_id: string
  timestamp: string
  doc_type_id: string
  source_sha256: string | null
  source_dimensions?: { width: number; height: number } | null
  exif_orientation?: number | null
  preprocess?: { rotation_applied?: number | null; output_dimensions?: { width: number; height: number } | null }
  orientation_applied_cw: number          // content/auto-orient correction (0 if none/disabled)
  reader: {
    provider: string | null
    requested_model: string | null
    actual_model: string | null
    fallback_used: boolean
    temperature: number
    attempts: ForensicAttempt[]
    status?: string | null
    error?: string | null
    ms?: number | null
  }
  fields: ForensicField[]
}

const ARTIFACT_DIR = resolve(process.cwd(), '../../qa-private/runtime-forensics')

/** PII-free console digest: hashed values + names/dims/model only. */
export function safeDigest(r: ForensicRecord) {
  return {
    run_id: r.run_id,
    doc_type_id: r.doc_type_id,
    source_sha256_16: r.source_sha256?.slice(0, 16) ?? null,
    source_dimensions: r.source_dimensions ?? null,
    exif_orientation: r.exif_orientation ?? null,
    preprocess: r.preprocess ?? null,
    orientation_applied_cw: r.orientation_applied_cw,
    model: r.reader.actual_model,
    fallback_used: r.reader.fallback_used,
    attempts: r.reader.attempts.map((a) => ({ n: a.n, model: a.model, selected: a.selected, reason: a.reason, http_status: a.http_status, candidate_hash: a.candidate_hash })),
    latency_ms: r.reader.ms ?? null,
    fields: r.fields.map((f) => ({
      field: f.field,
      raw_hash: hashShort(f.raw_value),     // hashed, never raw
      final_hash: hashShort(f.final_value), // hashed, never raw
      language_route: f.language_route ?? null,
      normalizers: f.normalizers ?? [],
      review_required: f.review_required,
    })),
  }
}

/**
 * Persist the full record to the gitignored artifact (PII allowed there) and emit a
 * PII-free digest to the console. Fail-open: any error is swallowed (read is unaffected).
 * Caller MUST gate on isForensicEnabled() — this function assumes the flag is ON.
 */
export function emitForensic(record: ForensicRecord): void {
  try {
    mkdirSync(ARTIFACT_DIR, { recursive: true })
    const safeRunId = record.run_id.replace(/[^a-zA-Z0-9_.-]/g, '_')
    writeFileSync(resolve(ARTIFACT_DIR, `${safeRunId}.json`), JSON.stringify(record, null, 2), 'utf8')
  } catch (e) {
    // fail-open: never let forensic IO break the read
    try { console.warn('[forensic] artifact write failed (non-fatal):', (e as Error)?.message) } catch { /* noop */ }
  }
  try { console.info('[forensic]', JSON.stringify(safeDigest(record))) } catch { /* noop */ }
}
