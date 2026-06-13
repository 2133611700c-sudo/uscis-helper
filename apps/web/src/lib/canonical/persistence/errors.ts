/**
 * canonical/persistence/errors.ts
 *
 * Typed error codes for canonical API routes.
 * All error bodies are PII-free and machine-parseable.
 *
 * HTTP status mapping:
 *   422 — CANONICAL_ID_REQUIRED, body malformed / required field missing
 *   409 — OVERRIDE_VERSION_CONFLICT, CANONICAL_NOT_READY
 *   404 — CANONICAL_NOT_FOUND
 *   403 — CANONICAL_SESSION_MISMATCH
 *   412 — CANONICAL_HASH_MISMATCH (when client sent If-Match / expected_hash)
 *   503 — CANONICAL_STORAGE_UNAVAILABLE (infrastructure failure only, never for bad client data)
 */

export type CanonicalErrorCode =
  | 'CANONICAL_ID_REQUIRED'
  | 'CANONICAL_NOT_FOUND'
  | 'CANONICAL_SESSION_MISMATCH'
  | 'CANONICAL_HASH_MISMATCH'
  | 'OVERRIDE_VERSION_CONFLICT'
  | 'CANONICAL_NOT_READY'
  | 'CANONICAL_STORAGE_UNAVAILABLE'

/** Typed error response body — PII-free, machine-parseable. */
export interface CanonicalErrorBody {
  error: CanonicalErrorCode
  /** PII-free context, e.g. "expected version 5, found 6". Never include field values. */
  detail?: string
}

/** Convenience: build a typed error body object. */
export function canonicalError(
  code: CanonicalErrorCode,
  detail?: string
): CanonicalErrorBody {
  const body: CanonicalErrorBody = { error: code }
  if (detail !== undefined) body.detail = detail
  return body
}
