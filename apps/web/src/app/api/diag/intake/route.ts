/**
 * POST /api/diag/intake — PHASE 3 live proof: the DocumentIntakeBrain end-to-end (test-only).
 *
 * Runs the ordered funnel (orient → language → country → family/type → reader-route) with REAL
 * providers on an uploaded image, no human type hint. Returns the DocumentIntakeResult + a PII-safe
 * trace. Recognition is NOT run — this proves the intake DECISION exists before any read.
 *
 * Gated behind DIAG_ORIENT_ENABLED=1 (preview only) → 404 in production. Uses the Vercel-side keys
 * inside the function; no key handled outside the deployment.
 */
import { NextRequest, NextResponse } from 'next/server'
import { orientToUpright, isContentOrientEnabled } from '@/lib/docintel/orientation/detectOrientation'
import { getGeminiApiKey } from '@/lib/gemini/apiKey'
import { primaryGeminiModel } from '@/lib/docintel/providers/geminiVisionProvider'
import { detectLanguage, detectCountry } from '@/lib/docintel/detectLanguageCountry'
import { classifyDocumentType } from '@/lib/docintel/detectDocumentType'
import { analyzeIntake, type IntakeProviders } from '@/lib/docintel/intake/documentIntakeBrain'
import { toSafeLog } from '@/lib/docintel/intake/contracts'
import { summarizeTrace } from '@/lib/docintel/intake/trace'
import type { DocumentTypeId, CountryCode, IssuingSystem, LanguageCode, ScriptCode } from '@/lib/docintel/intake/canonicalRegistry'

export const dynamic = 'force-dynamic'
export const maxDuration = 90

// docintel-registry id → canonical intake id (differ only for US forms + passport variants).
const DOCINTEL_TO_CANONICAL: Record<string, DocumentTypeId> = {
  ua_birth_certificate_soviet: 'ua_birth_certificate_soviet',
  ua_birth_certificate: 'ua_birth_certificate_modern',
  ua_marriage_certificate: 'ua_marriage_certificate',
  us_i94: 'i94', us_ead: 'ead_card', us_i797: 'i797_notice',
  ua_international_passport: 'passport', ua_internal_passport_booklet: 'passport',
}
const mapLang = (l: string): LanguageCode => (['uk', 'ru', 'en', 'es', 'mixed'].includes(l) ? (l as LanguageCode) : 'unknown')
const mapCountry = (c: string): CountryCode => (['UA', 'US', 'SU'].includes(c) ? (c as CountryCode) : 'UNKNOWN')
const issuingFor = (c: CountryCode): IssuingSystem => (c === 'SU' ? 'soviet_legacy' : c === 'UA' ? 'ukraine_modern' : 'unknown')
const mapScripts = (s: string[]): ScriptCode[] => s.filter((x): x is ScriptCode => ['latin', 'cyrillic', 'mixed', 'unknown'].includes(x))

export async function POST(req: NextRequest) {
  if (process.env.DIAG_ORIENT_ENABLED !== '1') return NextResponse.json({ error: 'not found' }, { status: 404 })
  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ ok: false, error: 'multipart required' }, { status: 400 }) }
  const file = form.get('file')
  if (!file || typeof file === 'string') return NextResponse.json({ ok: false, error: 'missing file' }, { status: 400 })
  const buffer = Buffer.from(new Uint8Array(await file.arrayBuffer()))

  const apiKey = (process.env.OPENAI_API_KEY || '').trim()
  if (!apiKey) return NextResponse.json({ ok: false, error: 'no OPENAI_API_KEY' }, { status: 500 })
  const model = process.env.OPENAI_VISION_MODEL || 'gpt-4.1'
  const visionCall = async (prompt: string, img: Buffer): Promise<string | null> => {
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 60_000)
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, temperature: 0, response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img.toString('base64')}`, detail: 'high' } }] }] }),
      })
      if (!res.ok) return null
      return (await res.json())?.choices?.[0]?.message?.content ?? null
    } finally { clearTimeout(timer) }
  }

  // Real providers wired from the proven detect nodes. Orientation runs FIRST inside orient().
  const providers: IntakeProviders = {
    preflight: async () => ({ isDocument: true, mediaType: 'image', pageCount: 1, isFullPage: true, quality: 'ok', isDuplicate: false, provider: null, timingMs: 0 }),
    orient: async (buf) => {
      if (!isContentOrientEnabled()) return { rotationAppliedCw: null, telemetryStatus: 'disabled', provider: null, measured: false, trusted: false }
      const o = await orientToUpright(buf, getGeminiApiKey(), primaryGeminiModel(), {})
      const t = o.orientationTelemetry
      return { rotationAppliedCw: o.applied, telemetryStatus: t.status, provider: (t.primaryProvider ?? t.fallbackProvider) as never, measured: t.measured, trusted: t.trusted, timingMs: t.confidence == null ? 0 : 0 }
    },
    language: async (buf) => {
      const l = await detectLanguage(buf, visionCall)
      return { primary: mapLang(l.language), scripts: mapScripts(l.scripts_seen), languageMode: l.language === 'mixed' ? 'bilingual' : 'monolingual', printedTextPresent: null, handwritingPresent: null, confidence: l.confidence, provider: 'openai', measured: l.measured }
    },
    country: async (buf) => {
      const c = await detectCountry(buf, visionCall)
      const cc = mapCountry(c.country)
      return { country: cc, issuingSystem: issuingFor(cc), confidence: c.confidence, evidence: c.evidence ? 'printed-cue' : null, provider: 'openai', measured: c.measured }
    },
    classify: async (buf) => {
      const d = await classifyDocumentType(buf, visionCall)
      const canonical: DocumentTypeId = DOCINTEL_TO_CANONICAL[d.doc_type_id] ?? 'unknown'
      return { docTypeId: canonical, family: 'unknown', candidates: d.candidates.map((c) => ({ doc_type_id: (DOCINTEL_TO_CANONICAL[c.doc_type_id] ?? 'unknown') as DocumentTypeId, confidence: c.confidence })), confidence: d.confidence, provider: 'openai', measured: d.measured }
    },
  }

  const started = Date.now()
  const { result, trace } = await analyzeIntake(buffer, providers, { traceId: 'diag-intake' })
  return NextResponse.json({
    ok: true, model, elapsed_ms: Date.now() - started,
    intake: toSafeLog(result),
    trace_summary: summarizeTrace(trace),
  })
}
