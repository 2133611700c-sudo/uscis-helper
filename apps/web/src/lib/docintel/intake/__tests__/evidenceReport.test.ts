/**
 * evidenceReport.test.ts — Phase 8 PII-free evidence report from trace + intake. Pure.
 */
import { describe, it, expect } from 'vitest'
import { buildEvidenceReport, assertEvidenceReportPiiFree } from '../evidenceReport'
import { analyzeIntake, type IntakeProviders } from '../documentIntakeBrain'

const providers = (): IntakeProviders => ({
  preflight: async () => ({ isDocument: true, mediaType: 'image', pageCount: 1, isFullPage: true, quality: 'ok', isDuplicate: false, provider: null, timingMs: 1 }),
  orient: async () => ({ rotationAppliedCw: 0, telemetryStatus: 'fallback_measured', provider: 'openai', measured: true, trusted: false, timingMs: 5 }),
  language: async () => ({ primary: 'mixed', scripts: ['cyrillic'], languageMode: 'bilingual', printedTextPresent: true, handwritingPresent: true, confidence: 1, provider: 'openai', measured: true, timingMs: 6 }),
  country: async () => ({ country: 'SU', issuingSystem: 'soviet_legacy', confidence: 1, evidence: 'cue', provider: 'openai', measured: true, timingMs: 6 }),
  classify: async () => ({ docTypeId: 'ua_birth_certificate_soviet', family: 'civil_record', candidates: [], confidence: 1, provider: 'openai', measured: true, timingMs: 7 }),
})

describe('buildEvidenceReport', () => {
  it('summarizes the funnel + timeline PII-free', async () => {
    const { result, trace } = await analyzeIntake(Buffer.from('x'), providers(), { traceId: 'ev-1' })
    const rep = buildEvidenceReport(result, trace)
    expect(rep.traceId).toBe('ev-1')
    expect(rep.status).toBe('needs_review')
    expect(rep.decisions.docTypeId).toBe('ua_birth_certificate_soviet')
    expect(rep.decisions.reader).toBe('civil_record_reader')
    expect(rep.decisions.needsHTR).toBe(false) // #1: handwriting force-reviewed, not HTR-host-dependent
    expect(rep.timeline.length).toBeGreaterThan(4)
    expect(rep.totalMs).toBeGreaterThan(0)
  })
  it('report is PII-free (no value-bearing keys)', async () => {
    const { result, trace } = await analyzeIntake(Buffer.from('x'), providers(), { traceId: 'ev-2' })
    const rep = buildEvidenceReport(result, trace)
    expect(assertEvidenceReportPiiFree(rep)).toEqual([])
    // the serialized report must not contain any raw-value key
    expect(JSON.stringify(rep)).not.toMatch(/rawValue|raw_cyrillic|finalValue|printed_title_seen/)
  })
})
