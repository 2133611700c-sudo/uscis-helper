/**
 * ocrCache — V1_COMPLETION OCR cache contract.
 *
 * Deterministic cache key so that re-running a benchmark after a prompt/preproc
 * change does NOT silently reuse a stale response, and unchanged inputs do not
 * re-pay the provider. Contract + key only — NO storage and NO network here.
 *
 * key = file_sha256 · provider · model_version · prompt_version · preprocessing_version
 */

export type OcrCacheKeyParts = {
  fileSha256: string
  provider: string
  modelVersion: string
  promptVersion: string
  preprocessingVersion: string
}

const SHA256_RE = /^[0-9a-f]{64}$/

/**
 * Build the immutable cache key. Throws if ANY part is missing/blank (a partial
 * key would collide across prompt/preproc versions) or the sha256 is malformed.
 */
export function buildOcrCacheKey(parts: OcrCacheKeyParts): string {
  const order: (keyof OcrCacheKeyParts)[] = [
    'fileSha256',
    'provider',
    'modelVersion',
    'promptVersion',
    'preprocessingVersion',
  ]
  for (const k of order) {
    if (!parts[k] || !String(parts[k]).trim()) {
      throw new Error(`ocr_cache_key_incomplete: missing ${k}`)
    }
  }
  if (!SHA256_RE.test(parts.fileSha256.toLowerCase())) {
    throw new Error('ocr_cache_key_invalid: fileSha256 must be a 64-hex sha256')
  }
  const norm = (s: string) => s.trim().replace(/[^A-Za-z0-9._-]/g, '_')
  return [
    parts.fileSha256.toLowerCase(),
    norm(parts.provider),
    norm(parts.modelVersion),
    norm(parts.promptVersion),
    norm(parts.preprocessingVersion),
  ].join(':')
}

/** A cached raw provider response. Immutable: writers must never overwrite a key. */
export type OcrCacheEntry = {
  key: string
  rawResponse: unknown
  createdAt: string
}

/**
 * Storage contract (implemented later against PRIVATE STAGING storage). Documented
 * invariants: immutable (put fails on existing key), no PII in logs, originals
 * never committed to git, a cache MISS is only filled after budget approval.
 */
export interface OcrCacheStore {
  get(key: string): Promise<OcrCacheEntry | null>
  /** MUST reject if `key` already exists (immutable). */
  putIfAbsent(entry: OcrCacheEntry): Promise<{ stored: boolean }>
}
