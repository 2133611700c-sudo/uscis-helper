/**
 * Central Brain — single entry point for all products. Phase 5 migration:
 * products not yet migrated return `delegated_to_legacy` (their existing pipeline
 * stays untouched — TPS never breaks). Migrated products run through the shared
 * recognition engine (apps/web/src/lib/engine).
 */
import { MIGRATION_STATE, brainHealth } from './health'
import type { BrainRequest, BrainResult } from './types'
export { brainHealth }
export type { BrainRequest, BrainResult, Product } from './types'

export async function analyze(req: BrainRequest): Promise<BrainResult> {
  const state = MIGRATION_STATE[req.product]
  if (!state) throw new Error(`unknown product: ${req.product}`)
  if (!state.migrated) {
    // SAFE: do not intercept un-migrated products — their legacy flow runs as-is.
    return {
      product: req.product, migrated: false, docTypes: req.documents.map((d) => d.docTypeId),
      recognizedFields: [], reviewRequiredFields: [], missingRequiredFields: [],
      productReadiness: 'delegated_to_legacy', officialSourcesUsed: [], auditId: null,
      riskFlags: [`product not migrated (step ${state.step}): ${state.note}`],
    }
  }
  // (migrated products will run the engine here — wired per-product in Phase 5)
  throw new Error(`migrated product ${req.product} has no engine adapter wired yet`)
}
