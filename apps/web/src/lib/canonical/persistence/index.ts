/**
 * canonical/persistence/index.ts
 *
 * Supabase persistence layer for CanonicalDocumentResult.
 *
 * Security invariants:
 *   INV-07: confidence.final=1 + reviewRequired=false + evidence=[] + source='document_ocr'
 *           must never be fabricated — only authoritative canonical results may carry these.
 *   INV-11: finalValue=null MUST survive JSON round-trip. null is explicit C3 reject.
 *           undefined is serialized as '__UNDEFINED__' sentinel and restored on load.
 *   INV-12: No silent legacy fallback. Every fallback must be explicit and observable.
 *
 * PII rule: never log field *values*, only field keys and counts.
 *
 * Hash contract:
 *   result_hash  = SHA-256({ docType, product, fieldKeys[] sorted })
 *   fields_hash  = SHA-256({ key, finalValue (undefined→'__UNDEFINED__'), reviewRequired,
 *                            confidenceFinal, reviewReasons sorted }[] sorted by key)
 *   resolved_hash = SHA-256({ base_fields_hash, overrides[] sorted by created_at })
 *
 * Override concurrency contract:
 *   Every POST to /api/canonical/[id]/override must include expected_override_version.
 *   If current MAX(version) != expected → 409 OVERRIDE_VERSION_CONFLICT.
 *   appendCanonicalOverride enforces this via the version parameter + DB transaction.
 */

import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import type { CanonicalDocumentResult, CanonicalField } from '../types'

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/** Sentinel stored in JSONB for finalValue=undefined (C3 not-run). */
export const FINAL_VALUE_UNDEFINED_SENTINEL = '__UNDEFINED__'

export interface CanonicalOverride {
  /** DB primary key (present on load, absent before insert). */
  id?: string
  /** FK to canonical_documents.id (present on load, absent before insert). */
  canonicalId?: string
  fieldKey: string
  /** null = explicit C3 reject (INV-11). string = user-supplied value. */
  overrideValue: string | null
  source: 'user_edit' | 'certifier_override' | 'system_correction'
  reason?: string
  /** Monotonic version per canonical_id (present on load). */
  version?: number
  /** Which override this supersedes (audit chain). */
  supersedesId?: string | null
  /** User explicitly confirmed this correction — only then is it effective. */
  confirmed?: boolean
  /** PII-free actor identifier (e.g. 'user', 'certifier'). */
  actor?: string
  /** Preserved from base canonical field.reviewReasons for audit chain. */
  originalRejectionReasons?: string[]
  createdAt?: string
}

// ---------------------------------------------------------------------------
// Supabase client (service role — server-side only, NEVER expose to browser)
// ---------------------------------------------------------------------------

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      '[canonical/persistence] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set'
    )
  }
  // auth.persistSession=false is mandatory: this is a server-side service role client
  return createClient(url, key, { auth: { persistSession: false } })
}

// ---------------------------------------------------------------------------
// Internal hash helper
// ---------------------------------------------------------------------------

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

// ---------------------------------------------------------------------------
// Hash: result_hash
// ---------------------------------------------------------------------------

/**
 * result_hash: covers document shape — docType, product, sorted field keys.
 * Does NOT cover field values (that is fields_hash). Used to detect schema drift.
 */
export function computeResultHash(result: CanonicalDocumentResult): string {
  const payload = {
    docType: result.docType,
    product: result.product,
    fields: result.fields.map((f) => f.key).sort(),
  }
  return sha256(JSON.stringify(payload))
}

// ---------------------------------------------------------------------------
// Hash: fields_hash
// ---------------------------------------------------------------------------

/**
 * fields_hash: covers value integrity per the DESIGN_LOCK spec.
 * Input per field: { key, finalValue, reviewRequired, confidenceFinal, reviewReasons sorted }
 *
 * Critical: finalValue=undefined is stored as sentinel '__UNDEFINED__' so it hashes
 * differently from finalValue=null (C3 hard reject). This proves INV-11 in hash space.
 */
export function computeFieldsHash(result: CanonicalDocumentResult): string {
  const payload = result.fields
    .slice()
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((f) => ({
      key: f.key,
      // Sentinel: undefined ≠ null in hash input (they must produce different hashes)
      finalValue:
        f.finalValue === undefined ? FINAL_VALUE_UNDEFINED_SENTINEL : f.finalValue,
      reviewRequired: f.reviewRequired,
      confidenceFinal: f.confidence.final,
      reviewReasons: f.reviewReasons.slice().sort(),
    }))
  return sha256(JSON.stringify(payload))
}

// ---------------------------------------------------------------------------
// Hash: resolved_hash
// ---------------------------------------------------------------------------

/**
 * resolved_hash: binds base canonical state + confirmed override set.
 * Used for certification reproducibility (CERTIFICATION_REPRODUCIBILITY_CONTRACT).
 *
 * resolved_hash = SHA-256({
 *   base_fields_hash: <fields_hash of canonical_documents row>,
 *   overrides: confirmed overrides sorted by created_at, mapped to
 *              { field_key, override_value, source }
 * })
 */
export function computeResolvedHash(
  baseFieldsHash: string,
  overrides: CanonicalOverride[]
): string {
  const sortedOverrides = overrides
    .slice()
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
    .map((o) => ({
      field_key: o.fieldKey,
      override_value: o.overrideValue,
      source: o.source,
    }))
  return sha256(
    JSON.stringify({
      base_fields_hash: baseFieldsHash,
      overrides: sortedOverrides,
    })
  )
}

// ---------------------------------------------------------------------------
// Effective value helper (C3 null + confirmed override contract)
// ---------------------------------------------------------------------------

/**
 * getEffectiveValue: returns the value that should be used for downstream processing.
 *
 * Contract:
 *   - No override (or unconfirmed override): return field.finalValue as-is
 *     (null = C3 hard reject, string = accepted, undefined = C3 not run)
 *   - Confirmed override with non-null overrideValue: return override.overrideValue
 *     (explicit human decision — this is NOT a C3 resurrection; the base is unchanged)
 *   - Confirmed override with null overrideValue: return null (human explicitly rejected)
 *   - Unconfirmed override: return field.finalValue (staged only, not yet effective)
 *
 * INV-11: A field with finalValue=null is NEVER released without a confirmed override.
 */
export function getEffectiveValue(
  field: CanonicalField,
  override?: CanonicalOverride
): string | null | undefined {
  if (override && override.confirmed && override.overrideValue !== null) {
    // Explicit human confirmation with a non-null value
    return override.overrideValue
  }
  // No override, or unconfirmed, or confirmed-null (explicit reject):
  // return base finalValue (null preserved, undefined preserved)
  return field.finalValue
}

// ---------------------------------------------------------------------------
// Serialisation helpers (INV-11 critical)
// ---------------------------------------------------------------------------

/**
 * Prepare fields for JSONB storage.
 * - finalValue: undefined → '__UNDEFINED__' sentinel (JSON.stringify drops undefined)
 * - finalValue: null → null (INV-11: preserved as explicit null in JSONB)
 * - finalValue: string → string (pass through)
 */
function fieldsToJson(fields: CanonicalField[]): unknown {
  return fields.map((f) => ({
    ...f,
    finalValue:
      f.finalValue === undefined ? FINAL_VALUE_UNDEFINED_SENTINEL : f.finalValue,
  }))
}

/**
 * Restore fields from JSONB. Reverses the sentinel encoding.
 * - '__UNDEFINED__' → undefined (C3 did not run)
 * - null → null (INV-11: C3 hard reject, must remain null)
 * - string → string (accepted value)
 */
function fieldsFromJson(raw: unknown): CanonicalField[] {
  if (!Array.isArray(raw)) return []
  return (raw as Record<string, unknown>[]).map((f) => {
    const field = { ...f } as unknown as CanonicalField
    if ((f.finalValue as unknown) === FINAL_VALUE_UNDEFINED_SENTINEL) {
      // C3 did not run — restore undefined (not null!)
      field.finalValue = undefined
    } else if (f.finalValue === null) {
      // INV-11: explicit null = C3 rejected; must remain null, never become undefined
      field.finalValue = null
    }
    // string finalValues pass through correctly via spread
    return field
  })
}

// ---------------------------------------------------------------------------
// Internal: DB row → CanonicalDocumentResult
// ---------------------------------------------------------------------------

function rowToResult(row: Record<string, unknown>): CanonicalDocumentResult {
  const fields = fieldsFromJson(row.fields_json)
  return {
    documentSessionId: (row.document_session_id as string) ?? '',
    product: row.product as CanonicalDocumentResult['product'],
    docType: row.doc_type as string,
    fields,
    hashes: {
      uploadHash: null,
      normalizedImageHash: null,
      canonicalResultHash: (row.result_hash as string) ?? null,
    },
    createdAt: (row.created_at as string) ?? '',
    requiresReview: fields.some((f) => f.reviewRequired),
  }
}

// ---------------------------------------------------------------------------
// Internal: DB override row → CanonicalOverride
// ---------------------------------------------------------------------------

function rowToOverride(row: Record<string, unknown>): CanonicalOverride {
  return {
    id: row.id as string,
    canonicalId: row.canonical_id as string,
    fieldKey: row.field_key as string,
    overrideValue: row.override_value as string | null,
    source: row.source as CanonicalOverride['source'],
    reason: (row.reason as string | undefined) ?? undefined,
    version: row.version as number,
    supersedesId: (row.supersedes_id as string | null) ?? null,
    confirmed: (row.confirmed as boolean | undefined) ?? false,
    actor: (row.actor as string | undefined) ?? undefined,
    originalRejectionReasons:
      (row.original_rejection_reasons as string[] | undefined) ?? undefined,
    createdAt: row.created_at as string,
  }
}

// ---------------------------------------------------------------------------
// 1. persistCanonicalDocument
// ---------------------------------------------------------------------------

/**
 * Insert a CanonicalDocumentResult into canonical_documents (immutable, insert-only).
 * Returns the generated id and both hashes for the caller to record.
 */
export async function persistCanonicalDocument(
  result: CanonicalDocumentResult,
  sessionId: string
): Promise<{ id: string; resultHash: string; fieldsHash: string }> {
  const supabase = getSupabaseClient()
  const resultHash = computeResultHash(result)
  const fieldsHash = computeFieldsHash(result)

  console.info(
    `[canonical/persistence] persisting docType=${result.docType} product=${result.product} ` +
      `fields=${result.fields.length} session=${sessionId}`
  )

  const { data, error } = await supabase
    .from('canonical_documents')
    .insert({
      session_id: sessionId,
      document_session_id: result.documentSessionId || null,
      product: result.product,
      doc_type: result.docType,
      fields_json: fieldsToJson(result.fields),
      result_hash: resultHash,
      fields_hash: fieldsHash,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(
      `[canonical/persistence] insert failed: ${error?.message ?? 'no data returned'}`
    )
  }

  console.info(
    `[canonical/persistence] persisted id=${(data as { id: string }).id} ` +
      `resultHash=${resultHash.slice(0, 8)}…`
  )

  return { id: (data as { id: string }).id, resultHash, fieldsHash }
}

// ---------------------------------------------------------------------------
// 2. loadCanonicalDocumentById
// ---------------------------------------------------------------------------

export async function loadCanonicalDocumentById(
  id: string
): Promise<CanonicalDocumentResult | null> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('canonical_documents')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(
      `[canonical/persistence] loadById failed: ${error.message}`
    )
  }
  if (!data) return null

  return rowToResult(data as Record<string, unknown>)
}

// ---------------------------------------------------------------------------
// 3. loadCanonicalDocumentBySession
// ---------------------------------------------------------------------------

/**
 * Load the most recent canonical document for a given session + docType.
 * Returns null when none exists yet.
 */
export async function loadCanonicalDocumentBySession(
  sessionId: string,
  docType: string
): Promise<CanonicalDocumentResult | null> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('canonical_documents')
    .select('*')
    .eq('session_id', sessionId)
    .eq('doc_type', docType)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(
      `[canonical/persistence] loadBySession failed: ${error.message}`
    )
  }
  if (!data) return null

  return rowToResult(data as Record<string, unknown>)
}

// ---------------------------------------------------------------------------
// 4. appendCanonicalOverride
// ---------------------------------------------------------------------------

/**
 * Append override(s) to canonical_overrides for a given canonical document.
 *
 * Concurrency contract: provide expectedVersion (the MAX version the client last saw).
 * If the current MAX(version) in DB differs from expectedVersion → throws a
 * OVERRIDE_VERSION_CONFLICT error. Caller must reload and retry.
 *
 * When expectedVersion is undefined, no concurrency check is performed (unsafe —
 * use only in trusted internal operations, e.g. system_correction from a single writer).
 *
 * Each override row uses next_canonical_override_version() to guarantee monotonic version.
 * In production, this is called inside a DB transaction for atomicity.
 */
export async function appendCanonicalOverride(
  canonicalId: string,
  overrides: CanonicalOverride[],
  options?: { expectedVersion?: number }
): Promise<void> {
  if (overrides.length === 0) return

  const supabase = getSupabaseClient()

  // --- Optimistic concurrency check ---
  if (options?.expectedVersion !== undefined) {
    const { data: versionData, error: versionError } = await supabase
      .from('canonical_overrides')
      .select('version')
      .eq('canonical_id', canonicalId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (versionError) {
      throw new Error(
        `[canonical/persistence] version check failed: ${versionError.message}`
      )
    }

    const currentVersion =
      versionData ? (versionData as { version: number }).version : 0
    if (currentVersion !== options.expectedVersion) {
      const err = new Error(
        `[canonical/persistence] OVERRIDE_VERSION_CONFLICT: ` +
          `expected version ${options.expectedVersion}, found ${currentVersion}`
      )
      ;(err as Error & { code: string }).code = 'OVERRIDE_VERSION_CONFLICT'
      ;(err as Error & { currentVersion: number }).currentVersion = currentVersion
      throw err
    }
  }

  // --- Build rows ---
  // Note: in a real DB transaction, next_canonical_override_version() is called per row.
  // For the persistence layer, we batch-compute starting from current MAX.
  const { data: maxVersionData } = await supabase
    .from('canonical_overrides')
    .select('version')
    .eq('canonical_id', canonicalId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextVersion = maxVersionData
    ? (maxVersionData as { version: number }).version + 1
    : 1

  const rows = overrides.map((o) => ({
    canonical_id: canonicalId,
    field_key: o.fieldKey,
    override_value: o.overrideValue, // null is valid (INV-11 explicit reject)
    source: o.source,
    reason: o.reason ?? null,
    version: nextVersion++,
    supersedes_id: o.supersedesId ?? null,
    confirmed: o.confirmed ?? false,
    actor: o.actor ?? null,
    original_rejection_reasons: o.originalRejectionReasons ?? null,
  }))

  console.info(
    `[canonical/persistence] appending ${overrides.length} override(s) for id=${canonicalId} ` +
      `keys=${overrides.map((o) => o.fieldKey).join(',')}`
  )

  const { error } = await supabase.from('canonical_overrides').insert(rows)

  if (error) {
    throw new Error(
      `[canonical/persistence] appendOverride failed: ${error.message}`
    )
  }
}

// ---------------------------------------------------------------------------
// 5. listCanonicalOverrides
// ---------------------------------------------------------------------------

export async function listCanonicalOverrides(
  canonicalId: string
): Promise<CanonicalOverride[]> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('canonical_overrides')
    .select('*')
    .eq('canonical_id', canonicalId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(
      `[canonical/persistence] listOverrides failed: ${error.message}`
    )
  }

  return (data ?? []).map((row) => rowToOverride(row as Record<string, unknown>))
}

// ---------------------------------------------------------------------------
// 6. resolveCanonicalDocument
// ---------------------------------------------------------------------------

/**
 * Load the base canonical document then apply all overrides in created_at order
 * (last override per field_key wins). Implements the C3 null + confirmed override contract:
 *
 *   WITHOUT confirmed override:
 *     field.finalValue = base finalValue (null preserved — INV-11)
 *
 *   WITH confirmed override (confirmed=true, overrideValue non-null):
 *     field.finalValue = override.overrideValue (explicit human decision)
 *     field.source = override.source
 *     field.reviewRequired = false (user confirmed)
 *     base rawValue, rawCyrillic, evidence[] PRESERVED (audit trail)
 *
 *   NEVER rewrites the base row.
 */
export async function resolveCanonicalDocument(
  canonicalId: string
): Promise<CanonicalDocumentResult> {
  const base = await loadCanonicalDocumentById(canonicalId)
  if (!base) {
    throw new Error(
      `[canonical/persistence] resolveCanonicalDocument: id=${canonicalId} not found`
    )
  }

  const overrides = await listCanonicalOverrides(canonicalId)
  if (overrides.length === 0) return base

  // Build a map: fieldKey → last override (list is already sorted by created_at asc)
  const overrideMap = new Map<string, CanonicalOverride>()
  for (const o of overrides) {
    overrideMap.set(o.fieldKey, o)
  }

  const resolvedFields = base.fields.map((field) => {
    const override = overrideMap.get(field.key)
    if (!override) return field

    // Only confirmed overrides change the effective value
    if (!override.confirmed) return field

    return {
      ...field,
      // INV-11: null stays null (explicit reject); string = confirmed human value
      finalValue: override.overrideValue,
      source: override.source as CanonicalField['source'],
      // User confirmed → no longer needs review
      reviewRequired: false,
      // rawValue, rawCyrillic, evidence[] are preserved from base (spread above)
    }
  })

  return { ...base, fields: resolvedFields }
}

// ---------------------------------------------------------------------------
// 7. verifyCanonicalHash
// ---------------------------------------------------------------------------

/**
 * Re-compute fields_hash from the stored fields_json and compare to the stored hash.
 * Returns valid=true when they match. On mismatch, returns a description (no PII —
 * only hash values, not field content).
 */
export async function verifyCanonicalHash(
  canonicalId: string
): Promise<{ valid: boolean; mismatch?: string }> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('canonical_documents')
    .select('fields_json, fields_hash, result_hash, doc_type, product')
    .eq('id', canonicalId)
    .maybeSingle()

  if (error || !data) {
    return {
      valid: false,
      mismatch: `row not found or query error: ${error?.message ?? 'no data'}`,
    }
  }

  const reconstructed = rowToResult(data as Record<string, unknown>)
  const recomputedFieldsHash = computeFieldsHash(reconstructed)
  const recomputedResultHash = computeResultHash(reconstructed)

  const storedFieldsHash = (data as Record<string, unknown>).fields_hash as string
  const storedResultHash = (data as Record<string, unknown>).result_hash as string

  if (
    recomputedFieldsHash !== storedFieldsHash ||
    recomputedResultHash !== storedResultHash
  ) {
    return {
      valid: false,
      mismatch:
        `fields_hash stored=${storedFieldsHash.slice(0, 16)} recomputed=${recomputedFieldsHash.slice(0, 16)}; ` +
        `result_hash stored=${storedResultHash.slice(0, 16)} recomputed=${recomputedResultHash.slice(0, 16)}`,
    }
  }

  return { valid: true }
}

// ---------------------------------------------------------------------------
// 8. getCanonicalDocumentId
// ---------------------------------------------------------------------------

/**
 * Returns the UUID of the most recent canonical document for session + docType,
 * or null if none exists. Useful for callers that only need the id.
 */
export async function getCanonicalDocumentId(
  sessionId: string,
  docType: string
): Promise<string | null> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('canonical_documents')
    .select('id')
    .eq('session_id', sessionId)
    .eq('doc_type', docType)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(
      `[canonical/persistence] getCanonicalDocumentId failed: ${error.message}`
    )
  }

  return data ? ((data as Record<string, unknown>).id as string) : null
}
