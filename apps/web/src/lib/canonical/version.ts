/**
 * canonical/version.ts — versioning constants for certification reproducibility.
 *
 * CERTIFICATION_REPRODUCIBILITY_CONTRACT:
 *   same base_canonical_hash + same override_set_hash + same renderer_version
 *   → same semantic output (PDF field values are identical)
 *
 * Bump RENDERER_VERSION when the translation renderer logic changes in a way that
 * would produce different field values / layout from the same canonical input.
 * Bump CANONICAL_SCHEMA_VERSION when the CanonicalField type shape changes
 * (new required fields, renamed fields, semantic changes to existing fields).
 *
 * Both constants are also exported from types.ts for backward compat.
 */

/** Semantic version of the CanonicalField type schema. */
export const CANONICAL_SCHEMA_VERSION = '1.0.0'

/**
 * Version of the translation renderer. Used to prove that two certification
 * records produced by the same base canonical + same overrides + same renderer
 * version are byte-for-byte reproducible.
 *
 * Format: semver. Bump minor on new field support, patch on formatting fixes,
 * major on breaking layout changes.
 */
export const RENDERER_VERSION = '1.0.0'
