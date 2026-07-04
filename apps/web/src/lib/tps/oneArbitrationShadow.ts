/**
 * tps/oneArbitrationShadow — ONE-BRAIN v2 Phase 3 (SHADOW ONLY).
 *
 * The TPS disease is SEVEN parallel writers finalizing fields outside the one
 * arbitration (legacy modules, dualOcrCrossref, DeepSeek brain-merge, R1B MRZ
 * override, contract firewall, postExtractNormalize, policy guards). The safe
 * collapse path is: first PROVE, on real traffic, that re-emitting the legacy
 * plane's output as FieldCandidates into THE one arbitration reproduces (or
 * safely tightens) today's final result — then flip. This module is that proof
 * instrument: a pure legacy→candidate emitter + a PII-FREE differ.
 *
 * Runs ONLY behind TPS_ONE_ARBITRATION_SHADOW === '1' (strict; default OFF →
 * never invoked → byte-identical). It never mutates the response and never
 * throws into the request path (route wraps it in try/catch). Field VALUES are
 * never logged — keys, flags and counts only.
 */
import type { TpsExtractedField, TpsModuleResult } from '@/lib/tps/types'
import type { FieldCandidate } from '@/lib/canonical/core/types'
import { applyKnowledgeBrainIfEnabled, buildKnowledgeContext } from '@/lib/canonical/core/knowledgeBrain'
import { canonicalToTpsModuleResult } from '@/lib/canonical/core/tpsAdapter'

export function isTpsOneArbitrationShadowEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.TPS_ONE_ARBITRATION_SHADOW === '1'
}

/**
 * Re-emit the finalized legacy plane's fields as observation-only FieldCandidates.
 * Provenance is preserved per field (`tps_legacy:<extraction_source>`), review flags
 * carried, Cyrillic layer carried as rawCyrillic. LAYOUT ONLY — no value is changed.
 */
export function legacyFieldsToCandidates(fields: TpsExtractedField[]): FieldCandidate[] {
  return fields.map((f) => ({
    key: f.field,
    value: f.normalized_value ?? f.raw_value ?? '',
    rawCyrillic: f.language_layer === 'cyrillic' ? f.raw_value ?? undefined : undefined,
    // The legacy planes read the physical document (rule modules over OCR); the closest
    // canonical source class is the generic document read. MRZ-derived fields keep 'mrz'
    // so arbitration's MRZ-authority rule sees them exactly as the live Core path would.
    source: f.source_zone?.startsWith('mrz') ? 'mrz' as const : 'document_ocr' as const,
    confidence: typeof f.confidence === 'number' ? f.confidence : null,
    provider: `tps_legacy:${f.extraction_source}`,
    reviewRequired: f.review_required === true,
    reviewReasons: f.review_required ? ['tps_legacy_review'] : [],
  }))
}

export interface OneArbitrationShadowDiff {
  doc_type_hint: string | null
  legacy_fields: number
  shadow_fields: number
  /** keys legacy produced that one-arbitration dropped (coverage loss — blocks flip). */
  missing_in_shadow: string[]
  /** keys one-arbitration added (usually none — candidates come FROM legacy). */
  added_in_shadow: string[]
  /** keys whose VALUE differs after arbitration (normalization delta — inspect before flip). */
  value_diff_keys: string[]
  /** keys where shadow is LESS reviewed than legacy (safety regression — blocks flip). */
  review_loosened_keys: string[]
  /** keys where shadow is MORE reviewed (acceptable: monotonic-up). */
  review_tightened_keys: string[]
}

/**
 * Run the legacy plane's finalized output through THE one arbitration and diff.
 * PURE (besides the knowledge flag read inside applyKnowledgeBrainIfEnabled — the
 * same flag posture the live Core path uses, which is exactly what a flip would run).
 */
export function runOneArbitrationShadow(
  legacy: TpsModuleResult,
  docTypeHint: string | null,
  documentId: string,
): OneArbitrationShadowDiff {
  const candidates = legacyFieldsToCandidates(legacy.fields ?? [])
  const canonicalFields = applyKnowledgeBrainIfEnabled(
    candidates,
    buildKnowledgeContext({ docTypeId: docTypeHint ?? 'unknown', product: 'tps' }),
  )
  const shadow = canonicalToTpsModuleResult(canonicalFields, docTypeHint ?? '', documentId)

  const legacyByKey = new Map((legacy.fields ?? []).map((f) => [f.field, f]))
  const shadowByKey = new Map(shadow.fields.map((f) => [f.field, f]))

  const missing_in_shadow = [...legacyByKey.keys()].filter((k) => !shadowByKey.has(k))
  const added_in_shadow = [...shadowByKey.keys()].filter((k) => !legacyByKey.has(k))
  const value_diff_keys: string[] = []
  const review_loosened_keys: string[] = []
  const review_tightened_keys: string[] = []
  for (const [k, lf] of legacyByKey) {
    const sf = shadowByKey.get(k)
    if (!sf) continue
    const lv = (lf.normalized_value ?? lf.raw_value ?? '').trim()
    const sv = (sf.normalized_value ?? sf.raw_value ?? '').trim()
    if (lv !== sv) value_diff_keys.push(k)
    const lr = lf.review_required === true
    const sr = sf.review_required === true
    if (lr && !sr) review_loosened_keys.push(k)
    if (!lr && sr) review_tightened_keys.push(k)
  }

  return {
    doc_type_hint: docTypeHint,
    legacy_fields: legacy.fields?.length ?? 0,
    shadow_fields: shadow.fields.length,
    missing_in_shadow,
    added_in_shadow,
    value_diff_keys,
    review_loosened_keys,
    review_tightened_keys,
  }
}
