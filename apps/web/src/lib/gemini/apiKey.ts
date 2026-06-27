/**
 * gemini/apiKey.ts — resolve the Gemini API key from env, tolerant of the NAME.
 *
 * The owner rotates the Vercel key under different variable names over time
 * (GEMINI_API_KEY_PAY, GEMINI_API_KEY2, GEMINI_API_KEY_066, ...). To stop the
 * "key set but app can't see it" failure, we accept ANY `GEMINI_API_KEY*` that has
 * a value. A suffixed name is preferred over the bare `GEMINI_API_KEY` (the bare
 * one is often an old/dead key); explicit known names win first.
 */
import { createHash } from 'crypto'

export function getGeminiApiKey(env: NodeJS.ProcessEnv = process.env): string {
  return resolveGeminiKey(env).key
}

/** Which env var supplied the key + a NON-reversible fingerprint — for forensic provenance.
 *  The raw key is never returned here for logging; only alias + sha256(key)[:12]. */
export function getGeminiKeyProvenance(env: NodeJS.ProcessEnv = process.env): {
  alias: string | null
  fingerprint: string | null
  google_api_key_conflict: boolean
} {
  const { key, alias } = resolveGeminiKey(env)
  let fingerprint: string | null = null
  if (key) { try { fingerprint = createHash('sha256').update(key).digest('hex').slice(0, 12) } catch { fingerprint = null } }
  // The Google SDK auto-reads GOOGLE_API_KEY/GOOGLE_GENAI_API_KEY with priority over GEMINI_API_KEY.
  // This code passes the key EXPLICITLY in the request URL, so there is no auto-read — but flag the
  // presence of a conflicting var so a future SDK migration can't silently route to another project.
  const google_api_key_conflict = !!(env.GOOGLE_API_KEY || env.GOOGLE_GENAI_API_KEY)
  return { alias, fingerprint, google_api_key_conflict }
}

function resolveGeminiKey(env: NodeJS.ProcessEnv): { key: string; alias: string | null } {
  // 1) explicit known names, highest priority
  if (env.GEMINI_API_KEY_PAY) return { key: env.GEMINI_API_KEY_PAY, alias: 'GEMINI_API_KEY_PAY' }
  if (env.GEMINI_API_KEY2) return { key: env.GEMINI_API_KEY2, alias: 'GEMINI_API_KEY2' }
  if (env.GEMINI_API_KEY_066) return { key: env.GEMINI_API_KEY_066, alias: 'GEMINI_API_KEY_066' }
  // 2) any other suffixed GEMINI_API_KEY* (a freshly-renamed key)
  for (const [k, v] of Object.entries(env)) {
    if (k !== 'GEMINI_API_KEY' && /^GEMINI_API_KEY[0-9A-Z_]+$/.test(k) && v) return { key: v, alias: k }
  }
  // 3) the bare name, last (may be stale)
  if (env.GEMINI_API_KEY) return { key: env.GEMINI_API_KEY, alias: 'GEMINI_API_KEY' }
  return { key: '', alias: null }
}
