/**
 * evidenceReport.ts — PHASE 8: build a PII-free evidence report from a OneBrainTrace + intake result.
 *
 * Every document processing request must be explainable WITHOUT exposing PII. This turns the trace
 * (spans) + the intake decisions into a compact, machine- and human-readable report using only
 * status/decision/timing/reasonCodes/evidence-ids — never raw document values. Pure + deterministic.
 */
import type { OneBrainTrace } from './trace'
import { summarizeTrace } from './trace'
import { toSafeLog, type DocumentIntakeResult } from './contracts'

export interface EvidenceReport {
  traceId: string
  status: DocumentIntakeResult['status']
  /** ordered PII-free per-stage lines (name: status duration [provider] decision reasons). */
  timeline: string[]
  /** the decision funnel, PII-redacted. */
  decisions: {
    orientationCw: number | null
    language: string
    country: string
    family: string
    docTypeId: string
    reader: string
    needsHTR: boolean
    needsHumanReview: boolean
  }
  reasonCodes: string[]
  totalMs: number
}

export function buildEvidenceReport(result: DocumentIntakeResult, trace: OneBrainTrace): EvidenceReport {
  const total = trace.spans.reduce((s, sp) => s + (sp.endMs != null ? sp.endMs - sp.startMs : 0), 0)
  return {
    traceId: trace.traceId,
    status: result.status,
    timeline: summarizeTrace(trace),
    decisions: {
      orientationCw: result.orientation.rotationAppliedCw,
      language: result.language.primary,
      country: result.country.country,
      family: result.family.family,
      docTypeId: result.docType.docTypeId,
      reader: result.route.reader,
      needsHTR: result.route.needsHTR,
      needsHumanReview: result.route.needsHumanReview,
    },
    reasonCodes: result.review.reasonCodes,
    totalMs: total,
  }
}

/** Assert a report is safe to persist/log: contains no value-bearing keys. Returns violations. */
export function assertEvidenceReportPiiFree(report: EvidenceReport): string[] {
  const serialized = JSON.stringify(toSafeLog(report))
  const violations: string[] = []
  // toSafeLog would have redacted known value keys; this is a belt-and-braces check that the
  // report shape itself declares no raw-value fields (structural — the type has none).
  if (/"rawValue"|"raw_cyrillic"|"finalValue"|"printed_title_seen"/.test(serialized)) {
    violations.push('evidence report contains a value-bearing key')
  }
  return violations
}
