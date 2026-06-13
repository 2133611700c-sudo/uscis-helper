/**
 * canonical/version.ts
 *
 * Version constants for canonical schema and renderer.
 * Bump CANONICAL_SCHEMA_VERSION when the CanonicalField type shape changes.
 * Bump RENDERER_VERSION when render logic changes that affects output semantics
 * (i.e., the same canonical input would produce different PDF field values).
 *
 * Both versions are recorded in certification records to enable reproducibility proofs:
 *   same base_canonical_hash + same override_set_hash + same renderer_version
 *   = same semantic output (PDF field values are identical)
 */

/** Semantic version of the CanonicalField type schema. */
export const CANONICAL_SCHEMA_VERSION = '1.0.0'

/** Version of the translation renderer. Bump when render output semantics change. */
export const RENDERER_VERSION = '1.0.0'
