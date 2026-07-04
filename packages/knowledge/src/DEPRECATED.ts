/**
 * KNOWLEDGE EXPORT LEDGER — ONE-BRAIN v2 Phase 6 (machine-readable).
 *
 * Constitution: every export of the codex public index MUST have a non-test
 * consumer in apps/web OR an explicit entry here. Enforced by
 * apps/web/src/lib/__tests__/knowledgeExportLedger.guard.test.ts.
 *
 * NOTHING is deleted. Statuses:
 *  - RESERVED   — intentionally kept; `wireTarget` names where it will be wired.
 *  - DEPRECATED — superseded by a live codex path; kept exported (no deletion),
 *                 do not wire NEW consumers to it.
 *
 * Verified 2026-07-03 against apps/web/src non-test imports of
 * '@uscis-helper/knowledge'. If you wire an export, its entry becomes inert
 * (the guard accepts consumer OR ledger); remove the entry in the same PR to
 * keep this file honest.
 */

export interface KnowledgeExportLedgerEntry {
  status: 'RESERVED' | 'DEPRECATED'
  /** Where a RESERVED export is planned to be wired. */
  wireTarget?: string
  note: string
}

export const KNOWLEDGE_EXPORT_LEDGER: Record<string, KnowledgeExportLedgerEntry> = {
  // ── The ledger itself (consumed by the Phase 6 guard test only) ──────────
  KNOWLEDGE_EXPORT_LEDGER: {
    status: 'RESERVED',
    note: 'This ledger; consumed by knowledgeExportLedger.guard.test.ts (Phase 6 guard).',
  },

  // ── Phase 6b (owner decision): evaluator signals being wired in parallel ─
  // validateDocNumber + lookupEadCategory are ALREADY wired (knowledgeEvaluator.ts).
  DOC_NUMBER_FORMATS: {
    status: 'RESERVED',
    wireTarget: 'knowledgeEvaluator signals (Phase 6b in progress)',
    note: 'Format table behind validateDocNumber (already wired); table export follows in 6b.',
  },
  US_SERVICE_CENTER_PREFIXES: {
    status: 'RESERVED',
    wireTarget: 'knowledgeEvaluator signals (Phase 6b in progress)',
    note: 'USCIS receipt-number prefix table for doc-number provenance signals.',
  },
  EAD_CATEGORY_MEANINGS: {
    status: 'RESERVED',
    wireTarget: 'knowledgeEvaluator signals (Phase 6b in progress)',
    note: 'Display map behind lookupEadCategory (already wired); map export follows in 6b.',
  },
  classifyGarbage: {
    status: 'RESERVED',
    wireTarget: 'knowledgeEvaluator signals (Phase 6b in progress)',
    note: 'Reason-coded variant of live isGarbageValue; evaluator wants the reason code.',
  },
  isValidPatronymicRu: {
    status: 'RESERVED',
    wireTarget: 'knowledgeEvaluator signals (Phase 6b in progress)',
    note: 'RU patronymic validity check (UA twin isValidPatronymic is live).',
  },
  lookupCountry: {
    status: 'RESERVED',
    wireTarget: 'knowledgeEvaluator signals (Phase 6b in progress)',
    note: 'Country-name lookup; normalizeForeignPlace (live) covers current app use.',
  },

  // ── TPS Ukraine procedural requirements (owner decision) ─────────────────
  TPS_UKRAINE_ELIGIBILITY: {
    status: 'RESERVED',
    wireTarget: 'TPS filing-guidance UI',
    note: 'Eligibility rules for the filing-guidance surface.',
  },
  TPS_FILING_TYPES: {
    status: 'RESERVED',
    wireTarget: 'TPS filing-guidance UI',
    note: 'Initial vs re-registration filing-type catalog.',
  },
  TPS_FORMS: {
    status: 'RESERVED',
    wireTarget: 'TPS filing-guidance UI',
    note: 'Form catalog. NOT the live TPS_FORMS in apps/web/src/lib/services/tps/config.ts (same name, different module).',
  },
  TPS_FEES: {
    status: 'RESERVED',
    wireTarget: 'TPS filing-guidance UI',
    note: 'Fee schedule for the filing-guidance surface.',
  },
  EAD_CATEGORIES: {
    status: 'RESERVED',
    wireTarget: 'TPS filing-guidance UI',
    note: 'TPS-relevant EAD category list (guidance copy; distinct from EAD_CATEGORY_MEANINGS).',
  },
  SUBMISSION_RULES: {
    status: 'RESERVED',
    wireTarget: 'TPS filing-guidance UI',
    note: 'Packet submission rules for the filing-guidance surface.',
  },
  COMMON_MISTAKES: {
    status: 'RESERVED',
    wireTarget: 'TPS filing-guidance UI',
    note: 'Common filing mistakes for the filing-guidance surface.',
  },

  // ── Civil registry glossary (owner decision) ─────────────────────────────
  civilRegistryTerms: {
    status: 'RESERVED',
    wireTarget: 'translation certificate glossary',
    note: 'civil_registry_terms.json default export; registry path translateCivilRegistryTerm is live.',
  },

  // ── MRZ (TD1 path reserved; owner decision) ──────────────────────────────
  findTd1Lines: {
    status: 'RESERVED',
    wireTarget: 'ID-card MRZ (TD1) documents',
    note: 'TD1 3x30 line finder; kept alive by packages/knowledge/src/__tests__/mrzTd1.keepalive.test.ts.',
  },
  checkDigit: {
    status: 'RESERVED',
    wireTarget: 'ID-card MRZ (TD1) documents',
    note: 'ICAO 7-3-1 check-digit primitive; internal to parseMrz and exercised by the TD1 keep-alive test.',
  },
  findMrzLines: {
    status: 'DEPRECATED',
    note: 'Internal step of live parseMrz (TD3); no direct consumer — call parseMrz instead.',
  },

  // ── Registry lookup surface (registryLookup.ts) ──────────────────────────
  lookupRegistry: {
    status: 'RESERVED',
    wireTarget: 'translation glossary registry (generic category lookup)',
    note: 'Generic entry point; category-specific lookupAuthority/translateCivilRegistryTerm are live.',
  },
  lookupSettlement: {
    status: 'RESERVED',
    wireTarget: 'translation place-field settlement lookup (registry path)',
    note: 'Registry settlement lookup; gazetteer snapCity is the live place path today.',
  },
  normalizeSettlementType: {
    status: 'DEPRECATED',
    note: 'Superseded in apps/web by settlementDesignatorEn (live dictionary path).',
  },
  normalizeOblastRegistry: {
    status: 'DEPRECATED',
    note: 'Superseded by normalizeOblastToNominative (live dictionary path).',
  },
  translatePassportAuthority: {
    status: 'RESERVED',
    wireTarget: 'passport module authority rendering (registry path)',
    note: 'Passport-issuing-authority translation; lookupAuthority (live) covers current use.',
  },
  resolveAbbreviation: {
    status: 'RESERVED',
    wireTarget: 'translation certificate glossary (abbreviation expansion)',
    note: 'Era-gated abbreviation expander for certificate translation output.',
  },

  // ── Dictionary / data-table companions of LIVE functions ─────────────────
  AUTHORITY_PATTERNS: {
    status: 'RESERVED',
    note: 'Pattern table behind live AUTHORITIES/lookupAuthority; exported for codex introspection.',
  },
  OBLAST_GENITIVE_TO_NOMINATIVE: {
    status: 'RESERVED',
    note: 'Data table behind live normalizeOblastToNominative; exported for codex introspection.',
  },
  COUNTRIES: {
    status: 'RESERVED',
    note: 'Data table behind live normalizeForeignPlace and reserved lookupCountry.',
  },
  DOCUMENT_TYPES: {
    status: 'RESERVED',
    note: 'Document-type dictionary table; candidate knowledgeEvaluator signal.',
  },
  FIELD_LABELS: {
    status: 'RESERVED',
    note: 'Field-label dictionary table; candidate extraction/evaluator signal.',
  },
  AUTOCORRECT_THRESHOLD: {
    status: 'RESERVED',
    note: 'Threshold constant behind live autoCorrect* functions; exported so callers can display/gate it.',
  },
  GAZETTEER: {
    status: 'RESERVED',
    note: 'Gazetteer data behind live snapCity; exported for codex introspection.',
  },
  confusionDistance: {
    status: 'RESERVED',
    note: 'Cyrillic-confusion edit distance behind live snapCity; candidate evaluator signal.',
  },
  isKnownSettlement: {
    status: 'RESERVED',
    note: 'Gazetteer membership check; candidate knowledgeEvaluator signal.',
  },
  isKnownRaion: {
    status: 'RESERVED',
    note: 'Gazetteer raion membership check; candidate knowledgeEvaluator signal.',
  },

  // ── Misc reserved engine pieces ───────────────────────────────────────────
  reconcilePatronymicRu: {
    status: 'RESERVED',
    wireTarget: 'RU-document patronymic reconcile',
    note: 'RU mirror of live reconcilePatronymic; wire when RU doc modules land.',
  },
  sanitizeCyrillicLeak: {
    status: 'RESERVED',
    wireTarget: 'final-output Cyrillic-leak sanitizer',
    note: 'Output-side leak scrubber; covered by cyrillicLeakFullBlock.test.ts in the codex.',
  },
}
