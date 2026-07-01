/**
 * resolveEvidenceProvider — the route-level DI factory for the evidence-only provider.
 *
 * Strict, default-OFF, fail-open switch (One-Brain §7). After billing/credentials exist, the
 * ONLY action needed to turn on live provider geometry is `GOOGLE_VISION_EVIDENCE_ENABLED=1`
 * (plus Vision credentials) — no architecture change, no manual provider swap.
 *
 *   GOOGLE_VISION_EVIDENCE_ENABLED absent | "0" | "true" | anything-but-"1" → disabled
 *   GOOGLE_VISION_EVIDENCE_ENABLED === "1"                                  → google provider
 *
 * Kept in its OWN module (not evidenceProvider.ts) so importing the interface/disabled default
 * never pulls the Google provider into the graph — and to avoid a value import cycle
 * (googleVisionEvidenceProvider imports helpers from evidenceProvider).
 *
 * SAFETY:
 *  - Strict equality on "1" — a loosely-truthy "true"/"yes" NEVER enables the provider.
 *  - No Google client / credentials / network at import OR at resolve time: google-vision reads
 *    credentials lazily inside extractText, only when locateEvidence is actually invoked.
 *  - googleVisionEvidenceProvider is itself fail-open: missing creds / 403 billing / error →
 *    {status:'unavailable'} → semantic extraction continues and template fallback still applies.
 *    So even flag-ON-without-credentials never throws and never harms extraction.
 */
import type { EvidenceProvider } from './evidenceProvider'
import { disabledEvidenceProvider } from './evidenceProvider'
import { googleVisionEvidenceProvider } from './googleVisionEvidenceProvider'

export function isGoogleVisionEvidenceEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GOOGLE_VISION_EVIDENCE_ENABLED === '1'
}

export function resolveEvidenceProvider(env: NodeJS.ProcessEnv = process.env): EvidenceProvider {
  return isGoogleVisionEvidenceEnabled(env) ? googleVisionEvidenceProvider : disabledEvidenceProvider
}
