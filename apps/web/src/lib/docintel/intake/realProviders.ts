/**
 * realProviders.ts — the SINGLE shared builder of real IntakeProviders for the DocumentIntakeBrain.
 *
 * One source of truth for wiring the proven detect nodes (orientation → language → country → type)
 * into the intake brain. Used by BOTH the /api/diag/intake proof endpoint AND the Translation
 * shadow wiring (Phase-7 shadow-then-flip). No duplication of provider logic.
 *
 * PII-safe: builds providers only; runs nothing here. Uses Vercel-side keys inside the function.
 * Providers are OpenAI-vision-based (OpenAI + Gemini are the vision-capable providers; DeepSeek is
 * text/reasoning-only). Outputs stay registry-enum-constrained downstream.
 */
import { orientToUpright, isContentOrientEnabled } from '@/lib/docintel/orientation/detectOrientation'
import { getGeminiApiKey } from '@/lib/gemini/apiKey'
import { primaryGeminiModel } from '@/lib/docintel/providers/geminiVisionProvider'
import { detectLanguage, detectCountry } from '@/lib/docintel/detectLanguageCountry'
import { classifyDocumentType } from '@/lib/docintel/detectDocumentType'
import type { IntakeProviders } from '@/lib/docintel/intake/documentIntakeBrain'
import type { DocumentTypeId, CountryCode, IssuingSystem, LanguageCode, ScriptCode } from '@/lib/docintel/intake/canonicalRegistry'

/** docintel-registry id → canonical intake id (differ only for US forms + passport variants). */
export const DOCINTEL_TO_CANONICAL: Record<string, DocumentTypeId> = {
  ua_birth_certificate_soviet: 'ua_birth_certificate_soviet',
  ua_birth_certificate: 'ua_birth_certificate_modern',
  ua_marriage_certificate: 'ua_marriage_certificate',
  us_i94: 'i94', us_ead: 'ead_card', us_i797: 'i797_notice',
  ua_international_passport: 'passport', ua_internal_passport_booklet: 'passport',
}
/** map a service's declared docintel docTypeId hint → canonical intake id (or null if unknown). */
export function declaredToCanonical(docTypeId: string | null | undefined): DocumentTypeId | null {
  if (!docTypeId) return null
  return DOCINTEL_TO_CANONICAL[docTypeId] ?? null
}

const mapLang = (l: string): LanguageCode => (['uk', 'ru', 'en', 'es', 'mixed'].includes(l) ? (l as LanguageCode) : 'unknown')
const mapCountry = (c: string): CountryCode => (['UA', 'US', 'SU'].includes(c) ? (c as CountryCode) : 'UNKNOWN')
const issuingFor = (c: CountryCode): IssuingSystem => (c === 'SU' ? 'soviet_legacy' : c === 'UA' ? 'ukraine_modern' : 'unknown')
const mapScripts = (s: string[]): ScriptCode[] => s.filter((x): x is ScriptCode => ['latin', 'cyrillic', 'mixed', 'unknown'].includes(x))

/** Build a strict-JSON OpenAI vision call (temperature 0, json_object) or null if no key. */
export function buildOpenAiVisionCall(env: Record<string, string | undefined> = process.env):
  ((prompt: string, img: Buffer) => Promise<string | null>) | null {
  const apiKey = (env.OPENAI_API_KEY || '').trim()
  if (!apiKey) return null
  const model = env.OPENAI_VISION_MODEL || 'gpt-4.1'
  return async (prompt, img) => {
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
}

/**
 * Build the real IntakeProviders, or null if no vision provider is available (no OPENAI key).
 * Orientation runs first inside orient(); all provider outputs map into the closed registry enums.
 */
export function buildRealIntakeProviders(env: Record<string, string | undefined> = process.env): IntakeProviders | null {
  const visionCall = buildOpenAiVisionCall(env)
  if (!visionCall) return null
  return {
    preflight: async () => ({ isDocument: true, mediaType: 'image', pageCount: 1, isFullPage: true, quality: 'ok', isDuplicate: false, provider: null, timingMs: 0 }),
    orient: async (buf) => {
      if (!isContentOrientEnabled()) return { rotationAppliedCw: null, telemetryStatus: 'disabled', provider: null, measured: false, trusted: false }
      const o = await orientToUpright(buf, getGeminiApiKey(), primaryGeminiModel(), {})
      const t = o.orientationTelemetry
      return { rotationAppliedCw: o.applied, telemetryStatus: t.status, provider: (t.primaryProvider ?? t.fallbackProvider) as never, measured: t.measured, trusted: t.trusted, timingMs: 0 }
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
}
