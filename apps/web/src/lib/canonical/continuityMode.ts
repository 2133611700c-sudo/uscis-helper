export type CanonicalMode = 'off' | 'shadow' | 'enforce'
export type CanonicalProduct = 'tps' | 'reparole' | 'ead' | 'translation'

const ENV_KEY: Record<CanonicalProduct, string> = {
  tps: 'CANONICAL_MODE_TPS',
  reparole: 'CANONICAL_MODE_REPAROLE',
  ead: 'CANONICAL_MODE_EAD',
  translation: 'CANONICAL_MODE_TRANSLATION',
}

function normalize(v: string | undefined | null): CanonicalMode | undefined {
  const s = (v ?? '').trim().toLowerCase()
  return s === 'off' || s === 'shadow' || s === 'enforce' ? (s as CanonicalMode) : undefined
}

/**
 * Resolve the canonical-continuity mode for a SINGLE product.
 * Precedence: product-scoped env (CANONICAL_MODE_<PRODUCT>) → CANONICAL_MODES JSON
 * → legacy global CANONICAL_CONTINUITY_MODE (back-compat) → 'shadow' default.
 * HARD GUARD: translation can never resolve to 'enforce' via the legacy global flag
 * (operator-flow continuity is not built); only an explicit CANONICAL_MODE_TRANSLATION
 * / CANONICAL_MODES.translation may set it, and even then callers should keep it shadow
 * until the operator pipeline carries canonical to the final PDF.
 */
export function getCanonicalMode(product: CanonicalProduct): CanonicalMode {
  const scoped = normalize(process.env[ENV_KEY[product]])
  if (scoped) return scoped

  const json = process.env.CANONICAL_MODES
  if (json) {
    try {
      const parsed = JSON.parse(json) as Record<string, string>
      const m = normalize(parsed?.[product])
      if (m) return m
    } catch { /* ignore malformed JSON, fall through */ }
  }

  const legacyGlobal = normalize(process.env.CANONICAL_CONTINUITY_MODE)
  if (legacyGlobal) {
    // Never let the legacy global push translation into enforce.
    if (product === 'translation' && legacyGlobal === 'enforce') return 'shadow'
    return legacyGlobal
  }

  return 'shadow'
}
