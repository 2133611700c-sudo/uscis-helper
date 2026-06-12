import { registryCatalog } from '@uscis-helper/knowledge'

/**
 * Internal routing table for the (inactive) central-brain `analyze()` function.
 * NOTE: this is NOT a truthful claim about the production pipeline — analyze()
 * has no production callers. It is kept only so the dead module still type-checks
 * until Phase 2 quarantines it. The health endpoint no longer exposes it.
 */
export const MIGRATION_STATE: Record<string, { migrated: boolean; step: number; note: string }> = {
  translation: { migrated: true, step: 2, note: 'engine path (inactive — no production callers)' },
  reparole_u4u: { migrated: true, step: 3, note: 'engine path (inactive — no production callers)' },
  ead: { migrated: true, step: 4, note: 'engine path (inactive — no production callers)' },
  tps: { migrated: false, step: 5, note: 'never moved into engine wrapper' },
}

/**
 * Truthful runtime status for /api/central-brain/health.
 *
 * REALITY (verified 2026-06-12): the production document pipeline is
 * `docintel` + `canonical/core` (arbitration), reached from the four extract
 * routes. The `central-brain/engine` module — `analyze()` / engine consensus —
 * has NO production callers; it is inactive.
 *
 * This endpoint previously claimed `migrated: true / "full pipeline through
 * engine consensus"`. That was inaccurate (the engine never runs on a real
 * request) and is removed. Do not reintroduce migration claims here.
 */
export function brainHealth() {
  const glossary = registryCatalog()
  return {
    ok: true,
    active_core: 'docintel + canonical/core (arbitration)',
    central_brain_engine: 'inactive', // engine analyze() has no production callers
    legacy_paths_present: true, // tps modules still run for US-form slots and as fallback
    migrated_claim_removed: true,
    products: {
      translation: 'docintel/canonical via /api/translation/vision-extract',
      reparole_u4u: 'docintel/canonical via /api/reparole/ocr/extract',
      ead: 'docintel/canonical via /api/ead/ocr/extract',
      tps: 'tps modules (+ docintel/canonical fallback) via /api/tps/ocr/extract',
    },
    // D-GLOSSARY self-description — the knowledge registry the active core consults.
    glossary: {
      categories: glossary,
      total: glossary.reduce((a, c) => a + c.count, 0),
      provenance_complete: glossary.every((c) => c.withSource === c.count),
    },
  }
}
