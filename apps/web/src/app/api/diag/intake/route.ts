/**
 * POST /api/diag/intake — PHASE 3 live proof: the DocumentIntakeBrain end-to-end (test-only).
 *
 * Runs the ordered funnel (orient → language → country → family/type → reader-route) with REAL
 * providers on an uploaded image, no human type hint. Returns the DocumentIntakeResult + a PII-safe
 * trace. Recognition is NOT run — this proves the intake DECISION exists before any read.
 *
 * Gated behind DIAG_ORIENT_ENABLED=1 (preview only) → 404 in production. Uses the shared
 * buildRealIntakeProviders() so diag + the Translation shadow wire the SAME providers.
 */
import { NextRequest, NextResponse } from 'next/server'
import { analyzeIntake } from '@/lib/docintel/intake/documentIntakeBrain'
import { toSafeLog } from '@/lib/docintel/intake/contracts'
import { summarizeTrace } from '@/lib/docintel/intake/trace'
import { buildRealIntakeProviders } from '@/lib/docintel/intake/realProviders'

export const dynamic = 'force-dynamic'
export const maxDuration = 90

export async function POST(req: NextRequest) {
  if (process.env.DIAG_ORIENT_ENABLED !== '1') return NextResponse.json({ error: 'not found' }, { status: 404 })
  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ ok: false, error: 'multipart required' }, { status: 400 }) }
  const file = form.get('file')
  if (!file || typeof file === 'string') return NextResponse.json({ ok: false, error: 'missing file' }, { status: 400 })
  const buffer = Buffer.from(new Uint8Array(await file.arrayBuffer()))

  const providers = buildRealIntakeProviders()
  if (!providers) return NextResponse.json({ ok: false, error: 'no vision provider (OPENAI_API_KEY)' }, { status: 500 })

  const started = Date.now()
  const { result, trace } = await analyzeIntake(buffer, providers, { traceId: 'diag-intake' })
  return NextResponse.json({
    ok: true, model: process.env.OPENAI_VISION_MODEL || 'gpt-4.1', elapsed_ms: Date.now() - started,
    intake: toSafeLog(result),
    trace_summary: summarizeTrace(trace),
  })
}
