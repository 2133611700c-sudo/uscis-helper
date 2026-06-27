/**
 * gemini/model.ts — normalize model names coming from env or caller input.
 *
 * Production env values occasionally arrive with trailing whitespace/newlines.
 * For Gemini model ids this is not harmless: it changes the REST URL and turns
 * the first request into a 404 before fallback logic can recover.
 *
 * Runtime must also reject any env value outside the sanctioned provider chain.
 * Otherwise a stale .env.local can silently drift away from the tested model
 * contract and re-enable dead or unsupported model ids.
 */

import { isSanctionedModel } from '../docintel/modelMatrix'

export function normalizeGeminiModel(
  value: string | null | undefined,
  fallback: string,
): string {
  const trimmed = value?.trim()
  if (!trimmed) return fallback
  return isSanctionedModel(trimmed) ? trimmed : fallback
}
