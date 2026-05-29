/** Which products are migrated onto the central brain (Phase 5 migration order). */
export const MIGRATION_STATE: Record<string, { migrated: boolean; step: number; note: string }> = {
  translation: { migrated: true,  step: 2, note: 'MIGRATED — runs through engine consensus (anti-hallucination); replaces single-Gemini path' },
  reparole_u4u: { migrated: false, step: 3, note: 'standalone OCR path; needs brain adapter' },
  ead: { migrated: false, step: 4, note: 'HTML-only; needs brain + I-765 eligibility rules' },
  tps: { migrated: false, step: 5, note: 'has its own brain; move into common wrapper LAST, behavior-preserving' },
}
export function brainHealth() {
  return { ok: true, spine: 'apps/web/src/lib/engine (29 tests)', products: MIGRATION_STATE,
    migrated_count: Object.values(MIGRATION_STATE).filter((p) => p.migrated).length }
}
