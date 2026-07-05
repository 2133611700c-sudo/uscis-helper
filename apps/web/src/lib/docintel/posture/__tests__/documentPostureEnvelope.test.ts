/**
 * documentPostureEnvelope — pure assembly of RECORDED signals, honest not_measured.
 * No network, no fs. FICTIONAL inputs only.
 */
import { describe, it, expect } from 'vitest'
import { buildPostureEnvelope, qualityStatusFromQualityResult } from '../documentPostureEnvelope'

describe('buildPostureEnvelope — honest not_measured (law: never claim unmeasured)', () => {
  it('empty inputs → everything not_measured/unknown, gate = not_measured', () => {
    const e = buildPostureEnvelope({})
    expect(e.orientation_status).toBe('not_measured')
    expect(e.orientation_source).toBe('not_measured')
    expect(e.orientation_confidence).toBe('unknown')
    expect(e.quality_status).toBe('not_measured')
    expect(e.document_fit).toBe('not_measured') // no fit detector exists — must stay honest
    expect(e.exif_orientation).toBe('unknown')
    expect(e.content_rotation_applied_cw).toBeNull() // content-orient did not run
    expect(e.posture_gate).toBe('not_measured')
  })

  it('document_fit is ALWAYS not_measured regardless of inputs (no detector yet)', () => {
    const e = buildPostureEnvelope({ contentOrientRan: true, contentRotationCw: 90, qualityStatus: 'ok' })
    expect(e.document_fit).toBe('not_measured')
  })
})

describe('buildPostureEnvelope — orientation sources', () => {
  it('content-orient ran + decided (rotation applied) → upright/content_orient, confidence NEVER high', () => {
    const e = buildPostureEnvelope({ contentOrientRan: true, contentRotationCw: 90 })
    expect(e.orientation_status).toBe('upright')
    expect(e.orientation_source).toBe('content_orient')
    expect(e.orientation_confidence).toBe('medium') // detector instability MEASURED → capped until Phase C matrix
    expect(e.content_rotation_applied_cw).toBe(90)
    expect(e.posture_gate).toBe('pass')
  })

  it('content-orient ran, no rotation needed → upright, cw=0 recorded (ran ≠ silent)', () => {
    const e = buildPostureEnvelope({ contentOrientRan: true, contentRotationCw: 0 })
    expect(e.orientation_status).toBe('upright')
    expect(e.content_rotation_applied_cw).toBe(0)
    expect(e.posture_gate).toBe('pass')
  })

  it('content-orient undecidable → uncertain/low + gate review_orientation_uncertain', () => {
    const e = buildPostureEnvelope({ contentOrientRan: true, orientationUncertain: true })
    expect(e.orientation_status).toBe('uncertain')
    expect(e.orientation_confidence).toBe('low')
    expect(e.posture_gate).toBe('review_orientation_uncertain')
  })

  it('EXIF-only rotation applied in preprocess → upright/exif/medium (EXIF can lie — never high)', () => {
    const e = buildPostureEnvelope({ exifOrientation: 6, preprocessRotationApplied: true })
    expect(e.orientation_status).toBe('upright')
    expect(e.orientation_source).toBe('exif')
    expect(e.orientation_confidence).toBe('medium')
    expect(e.exif_orientation).toBe('applied')
    expect(e.preprocess_rotation_applied).toBe(true)
  })

  it('EXIF tag captured but no rotation applied → present; explicit null → missing', () => {
    expect(buildPostureEnvelope({ exifOrientation: 1 }).exif_orientation).toBe('present')
    expect(buildPostureEnvelope({ exifOrientation: null }).exif_orientation).toBe('missing')
  })
})

describe('buildPostureEnvelope — quality + gate monotonicity (signal-only, adds review, never lifts)', () => {
  it('quality bad → review_quality_low even when orientation is upright', () => {
    const e = buildPostureEnvelope({ contentOrientRan: true, contentRotationCw: 0, qualityStatus: 'blurred' })
    expect(e.posture_gate).toBe('review_quality_low')
  })

  it('orientation uncertain WINS over quality (most safety-relevant signal first)', () => {
    const e = buildPostureEnvelope({ contentOrientRan: true, orientationUncertain: true, qualityStatus: 'blurred' })
    expect(e.posture_gate).toBe('review_orientation_uncertain')
  })

  it('quality ok + orientation not_measured → pass (quality WAS measured)', () => {
    const e = buildPostureEnvelope({ qualityStatus: 'ok' })
    expect(e.posture_gate).toBe('pass')
  })

  it('D0 verdict mapper: ACCEPT→ok; dominant signal names the reason; unattributable → degraded_other', () => {
    expect(qualityStatusFromQualityResult({ decision: 'ACCEPT', signals: [] })).toBe('ok')
    expect(qualityStatusFromQualityResult({
      decision: 'DEGRADED_REVIEW',
      signals: [{ name: 'blur', status: 'fail' }, { name: 'brightness', status: 'warning' }],
    })).toBe('blurred') // fail outranks warning
    expect(qualityStatusFromQualityResult({
      decision: 'DEGRADED_REVIEW',
      signals: [{ name: 'brightness', status: 'fail', reason: 'overexposed 250' }],
    })).toBe('too_bright')
    expect(qualityStatusFromQualityResult({
      decision: 'DEGRADED_REVIEW',
      signals: [{ name: 'brightness', status: 'warning', reason: 'mean 55 below warn 70' }],
    })).toBe('too_dark')
    expect(qualityStatusFromQualityResult({
      decision: 'RESHOOT_REQUIRED',
      signals: [{ name: 'resolution', status: 'fail' }],
    })).toBe('low_resolution')
    expect(qualityStatusFromQualityResult({
      decision: 'DEGRADED_REVIEW',
      signals: [{ name: 'contrast', status: 'warning' }],
    })).toBe('degraded_other') // never silently ok
  })

  it('measured degraded_other quality → review_quality_low gate (monotonic-up)', () => {
    expect(buildPostureEnvelope({ qualityStatus: 'degraded_other' }).posture_gate).toBe('review_quality_low')
  })

  it('gate values are the closed enum — no free-text verdicts', () => {
    const allowed = ['pass', 'review_orientation_uncertain', 'review_quality_low', 'review_document_partial', 'not_measured']
    for (const inputs of [
      {},
      { contentOrientRan: true, contentRotationCw: 180 },
      { contentOrientRan: true, orientationUncertain: true },
      { qualityStatus: 'too_dark' as const },
      { exifOrientation: 8, preprocessRotationApplied: true },
    ]) {
      expect(allowed).toContain(buildPostureEnvelope(inputs).posture_gate)
    }
  })
})
