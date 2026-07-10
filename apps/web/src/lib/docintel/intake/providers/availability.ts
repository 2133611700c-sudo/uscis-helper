/**
 * availability.ts — PHASE 4: honest provider availability (no silent passes).
 *
 * Reports whether each classifier/reader provider can actually run right now. A provider being
 * UNAVAILABLE or BLOCKED_EXTERNAL is reported as such — it is never treated as a pass, and a route
 * that requires it fails closed. Truth rule: availability is measured from env, not assumed.
 */
import type { ProviderId } from '../canonicalRegistry'

export type ProviderAvailability = 'available' | 'unavailable' | 'blocked_external' | 'runtime_unsafe'

export interface ProviderStatus {
  provider: ProviderId
  availability: ProviderAvailability
  reason: string
}

/**
 * Are Google Vision credentials present in this environment? Mirrors the env names accepted by
 * lib/canonical/vision/visionCredentials.ts (service-account JSON priority order, then API key).
 * Presence only — the live 403-vs-200 billing verdict is measured at call time, not here.
 */
function hasVisionCreds(env: Record<string, string | undefined>): boolean {
  return Boolean(
    (env.GOOGLE_VISION_SERVICE_ACCOUNT_JSON ||
      env.GOOGLE_CLOUD_CREDENTIALS ||
      env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
      env.GOOGLE_APPLICATION_CREDENTIALS ||
      env.GOOGLE_CLOUD_VISION_API_KEY ||
      env.GOOGLE_VISION_API_KEY ||
      '')
      .toString()
      .trim(),
  )
}

export function providerAvailability(env: Record<string, string | undefined> = process.env): ProviderStatus[] {
  const onVercel = env.VERCEL === '1'
  return [
    {
      provider: 'openai',
      availability: (env.OPENAI_API_KEY || '').trim() ? 'available' : 'unavailable',
      reason: (env.OPENAI_API_KEY || '').trim() ? 'OPENAI_API_KEY present' : 'no OPENAI_API_KEY',
    },
    {
      provider: 'gemini',
      availability: (env.GEMINI_API_KEY_PAY || env.GEMINI_API_KEY2 || env.GEMINI_API_KEY || '').trim() ? 'available' : 'unavailable',
      reason: 'gemini key presence',
    },
    {
      // Google Vision OCR availability is MEASURED from credential presence, not assumed.
      // History: verified HTTP 403 billing-off on 2026-06-22; RE-MEASURED 2026-07-08 → HTTP 200 +
      // OCR (billing paid). So it is NOT a standing external blocker — usable when credentials are
      // configured (same env names as lib/canonical/vision/visionCredentials.ts), else unavailable.
      provider: 'google_vision',
      availability: hasVisionCreds(env) ? 'available' : 'unavailable',
      reason: hasVisionCreds(env)
        ? 'google_vision credentials configured (billing paid, re-measured 2026-07-08)'
        : 'no Google Vision credentials in this environment',
    },
    {
      // tesseract worker script is not bundled on Vercel serverless → runtime-unsafe there.
      provider: 'tesseract',
      availability: onVercel ? 'runtime_unsafe' : 'available',
      reason: onVercel ? 'tesseract worker not bundled on Vercel serverless' : 'local runtime ok',
    },
    {
      // HTR is OUR OWN open model (raxtemur/trocr, open weights), self-hostable in-process
      // (onnxruntime-node, ~370MB quantized) or in our own container — NOT a third-party service.
      // So when not yet wired it is 'unavailable' (our own not-yet-built capability), NOT
      // 'blocked_external' (that word is reserved for a genuinely external dependency we do not
      // control and cannot unblock ourselves — currently no provider is in that state).
      provider: 'htr',
      availability: (env.HTR_ENDPOINT_URL || env.HTR_SIDECAR_URL || '').trim() ? 'available' : 'unavailable',
      reason: (env.HTR_ENDPOINT_URL || env.HTR_SIDECAR_URL || '').trim()
        ? 'self-hosted HTR endpoint configured'
        : 'self-hosted HTR (our own open model) not yet wired — our infra, not a third-party blocker',
    },
    { provider: 'rule', availability: 'available', reason: 'deterministic, no network' },
    {
      provider: 'deepseek',
      availability: (env.DEEPSEEK_API_KEY || '').trim() ? 'available' : 'unavailable',
      reason: 'deepseek key presence',
    },
  ]
}

/** Is a specific provider usable right now? (available only — blocked/unsafe/unavailable = no). */
export function isProviderUsable(id: ProviderId, env: Record<string, string | undefined> = process.env): boolean {
  return providerAvailability(env).find((p) => p.provider === id)?.availability === 'available'
}

/** Highest-priority USABLE provider from a registry providerPriority list, or null if none. */
export function firstUsableProvider(priority: ProviderId[], env: Record<string, string | undefined> = process.env): ProviderId | null {
  for (const p of priority) if (isProviderUsable(p, env)) return p
  return null
}
