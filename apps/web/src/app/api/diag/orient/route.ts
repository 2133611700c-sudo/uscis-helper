/**
 * POST /api/diag/orient — BLIND auto-orientation diagnostic (test-only, flag-gated).
 *
 * Owner focus (2026-07-08): measure the auto-orientation function IN ISOLATION and BLIND:
 *   - NO doc-type hint (docTypeId undefined) → the detector is not told what the document is,
 *     so its handwritten/printed/backstop branches are not primed by a caller expectation.
 *   - NO orientation hint → nothing tells it the "right" answer before it decides.
 *   - NO content OCR → only orientation runs (cheap, fast, no reader-fabrication noise).
 *   - Fresh every call → the orientation provider call is a live no-op-cache pass-through today
 *     (see detectOrientation.ts cache comment), so repeated uploads genuinely re-run.
 *
 * Returns ONLY the orientation decision: the correction angle the system detected + applied to
 * make the document upright, plus the truthful telemetry (measured/trusted/provider/status).
 * PII-free by construction — no field values are read or returned.
 *
 * Gated behind DIAG_ORIENT_ENABLED=1 (set on Preview only); absent → 404, so it never exists in
 * production. This exercises the SAME orientToUpright() the real reader calls — no forked logic.
 */
import { NextRequest, NextResponse } from 'next/server'
import { orientToUpright, isContentOrientEnabled } from '@/lib/docintel/orientation/detectOrientation'
import { getGeminiApiKey } from '@/lib/gemini/apiKey'
import { primaryGeminiModel } from '@/lib/docintel/providers/geminiVisionProvider'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (process.env.DIAG_ORIENT_ENABLED !== '1') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, error: 'expected multipart/form-data with "file"' }, { status: 400 })
  }
  const file = form.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ ok: false, error: 'missing "file"' }, { status: 400 })
  }
  const buffer = Buffer.from(await file.arrayBuffer())

  if (!isContentOrientEnabled()) {
    return NextResponse.json({ ok: true, orientation_enabled: false, note: 'CONTENT_ORIENT_ENABLED is off' })
  }

  const started = Date.now()
  // BLIND: docTypeId intentionally omitted — the detector decides purely from pixels.
  const r = await orientToUpright(buffer, getGeminiApiKey(), primaryGeminiModel(), {})
  const t = r.orientationTelemetry
  return NextResponse.json({
    ok: true,
    orientation_enabled: true,
    elapsed_ms: Date.now() - started,
    // The correction the system applied to make the doc upright (0 = already upright, no rotation):
    applied_cw: r.applied,
    detected: r.detected,
    disambiguated_90: r.disambiguated90 ?? false,
    disambiguated_180: r.disambiguated180 ?? false,
    layout_backstop_used: r.layoutBackstopUsed ?? null,
    telemetry: {
      status: t.status,
      measured: t.measured,
      trusted: t.trusted,
      angle: t.angle,
      primary_provider: t.primaryProvider,
      primary_measured: t.primaryMeasured,
      fallback_provider: t.fallbackProvider,
      fallback_measured: t.fallbackMeasured,
      confidence: t.confidence,
    },
  })
}
