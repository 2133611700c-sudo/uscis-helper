/**
 * ONE BRAIN — Fork Registry (Execution Order, STEP 0, Level 1).
 *
 * The authoritative, machine-readable map of every recognition/normalization
 * decision plane ("fork") that currently exists. Every fork that is NOT yet the
 * single Decision Engine path must be registered here with a removal phase.
 *
 * Personally verified by call-site trace on HEAD ed918eb (file:line in `entryPoint`).
 * The guard test (oneBrainForkRegistry.guard.test.ts) keeps this honest:
 *  - every record is well-formed;
 *  - every entryPoint file still exists (a removed fork forces a status update);
 *  - all four products + the knowledge layer are represented.
 *
 * Pure data. No runtime behaviour. Shrink `currentStatus` toward READER_ADAPTER /
 * remove records as each fork collapses into the one Decision Engine (phases A–J).
 */

export type ForkStatus =
  | 'PRIMARY'          // the intended one-brain path (or facade-to-be)
  | 'READER_ADAPTER'   // already wrapped as a ReaderResult source behind the engine
  | 'LEGACY_ADAPTER'   // legacy plane, to be wrapped as a reader (still writes final today)
  | 'SHADOW'           // computed but not authoritative / flag-OFF
  | 'BYPASS_FORBIDDEN' // must never run; guarded

export type RemovalPhase = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'none'

export interface ForkRecord {
  id: string
  product: 'translation' | 'tps' | 'ead' | 'reparole' | 'knowledge'
  /** file:line of the fork's live entry (relative to apps/web). */
  entryPoint: string
  currentStatus: ForkStatus
  /** recognition providers this fork calls directly (empty = goes through readDocument). */
  directProviders: string[]
  /** one-brain hooks this fork bypasses today (empty = none). */
  bypassedHooks: string[]
  /** the adapter this fork becomes in the one-brain target (null = stays primary). */
  targetAdapter: string | null
  removalPhase: RemovalPhase
  owner: 'one-brain-migration'
  note?: string
}

export const ONE_BRAIN_FORKS: readonly ForkRecord[] = [
  // ── Translation ──────────────────────────────────────────────────────────────
  {
    id: 'translation.vision-extract.core',
    product: 'translation',
    entryPoint: 'src/app/api/translation/vision-extract/route.ts:368',
    currentStatus: 'PRIMARY',
    directProviders: [], // via readDocument (Gemini)
    bypassedHooks: [],
    targetAdapter: 'readDocument-facade',
    removalPhase: 'D',
    owner: 'one-brain-migration',
    note: 'LIVE wizard reader. Becomes the facade caller for the extracted orchestrator.',
  },
  {
    id: 'translation.vision-extract.legacy-fallback',
    product: 'translation',
    entryPoint: 'src/app/api/translation/vision-extract/route.ts:599',
    currentStatus: 'LEGACY_ADAPTER',
    directProviders: [],
    bypassedHooks: [],
    targetAdapter: 'reader-adapter',
    removalPhase: 'G',
    note: 'Second readDocument call (shorter timeout) — fold into one orchestrator path.',
    owner: 'one-brain-migration',
  },
  {
    id: 'translation.ocr-from-storage.dark',
    product: 'translation',
    entryPoint: 'src/app/api/translation/[sessionId]/ocr-from-storage/route.ts:273',
    currentStatus: 'SHADOW',
    directProviders: ['google_vision', 'deepseek_mapper'],
    bypassedHooks: ['decisionEngine'],
    targetAdapter: 'visionBboxLocator + deepseek-mapper(dependent)',
    removalPhase: 'E',
    note: 'Dark pipeline: Vision OCR → mapFieldsWithDeepSeek:273 → resolveOcrIds:341 (the ONLY bbox source). Not called by the live wizard. DeepSeek-over-Vision = ONE dependent chain, not a vote.',
    owner: 'one-brain-migration',
  },
  // ── TPS ──────────────────────────────────────────────────────────────────────
  {
    id: 'tps.core',
    product: 'tps',
    entryPoint: 'src/app/api/tps/ocr/extract/route.ts:318',
    currentStatus: 'PRIMARY',
    directProviders: [],
    bypassedHooks: [],
    targetAdapter: 'readDocument-facade',
    removalPhase: 'D',
    owner: 'one-brain-migration',
  },
  {
    id: 'tps.legacy-modules',
    product: 'tps',
    entryPoint: 'src/app/api/tps/ocr/extract/route.ts:402',
    currentStatus: 'LEGACY_ADAPTER',
    directProviders: [],
    bypassedHooks: ['decisionEngine', 'knowledgeBrain', 'review'],
    targetAdapter: 'LegacyTpsReader',
    removalPhase: 'G',
    note: 'if (moduleResult === null) block :402–875 — writes final fields directly. flow=tps_legacy (:1331).',
    owner: 'one-brain-migration',
  },
  {
    id: 'tps.deepseek-brain',
    product: 'tps',
    entryPoint: 'src/app/api/tps/ocr/extract/route.ts:936',
    currentStatus: 'LEGACY_ADAPTER',
    directProviders: ['deepseek_mapper'],
    bypassedHooks: ['decisionEngine'],
    targetAdapter: 'deepseek-mapper(dependent) + provider-privacy-gate',
    removalPhase: 'G',
    note: 'runBrain:936 (gated :930). isBrainEnabled = Boolean(DEEPSEEK_API_KEY) unless TPS_AI_BRAIN_ENABLED=0 → key≠consent; needs privacy gate.',
    owner: 'one-brain-migration',
  },
  {
    id: 'tps.dual-ocr-crossref',
    product: 'tps',
    entryPoint: 'src/app/api/tps/ocr/extract/route.ts:426',
    currentStatus: 'LEGACY_ADAPTER',
    directProviders: ['google_vision', 'document_ai', 'deepseek_mapper'],
    bypassedHooks: ['decisionEngine'],
    targetAdapter: 'docai-reader + dependent-crossref',
    removalPhase: 'G',
    note: 'DUAL_OCR_CROSSREF default ON (!== "false"); processDocAI:429/737 + runDualOcrCrossref:432/740. Maps patronymic→middle_name slot (keep fieldKind=patronymic).',
    owner: 'one-brain-migration',
  },
  // ── EAD / ReParole ─────────────────────────────────────────────────────────────
  {
    id: 'ead.core',
    product: 'ead',
    entryPoint: 'src/app/api/ead/ocr/extract/route.ts:175',
    currentStatus: 'PRIMARY',
    directProviders: [],
    bypassedHooks: [],
    targetAdapter: 'readDocument-facade',
    removalPhase: 'D',
    note: 'Clean: readDocument → applyKnowledgeBrainIfEnabled:202 → eadAdapter. No legacy fork found.',
    owner: 'one-brain-migration',
  },
  {
    id: 'reparole.core',
    product: 'reparole',
    entryPoint: 'src/app/api/reparole/ocr/extract/route.ts:192',
    currentStatus: 'PRIMARY',
    directProviders: [],
    bypassedHooks: [],
    targetAdapter: 'readDocument-facade',
    removalPhase: 'D',
    note: 'Clean for passport/booklet. NOTE: i94/ead/dl slots fall back to the TPS OCR path (out-of-spine) — track for full coverage.',
    owner: 'one-brain-migration',
  },
  // ── Knowledge / normalization layers ───────────────────────────────────────────
  {
    id: 'knowledge.brain',
    product: 'knowledge',
    entryPoint: 'src/lib/canonical/core/knowledgeNormalize.ts:100',
    currentStatus: 'PRIMARY',
    directProviders: [],
    bypassedHooks: [],
    targetAdapter: 'KnowledgeEvaluator(signal-only)',
    removalPhase: 'F',
    note: 'KNOWLEDGE_BRAIN_ENABLED !== "0" (default ON). On accept overwrites normalizedValue (arbitration.ts:290). snapCity caller #1 (knowledgeNormalize.ts:309).',
    owner: 'one-brain-migration',
  },
  {
    id: 'knowledge.smart-normalize',
    product: 'knowledge',
    entryPoint: 'src/lib/docintel/documentFieldReader.ts:377',
    currentStatus: 'SHADOW',
    directProviders: [],
    bypassedHooks: [],
    targetAdapter: 'KnowledgeEvaluator(signal-only)',
    removalPhase: 'F',
    note: 'SMART_NORMALIZE_ENABLED === "1" (default OFF). snapCity caller #2 (dictionaryBridge.ts:107). The two snapCity callers must converge to one.',
    owner: 'one-brain-migration',
  },
  {
    id: 'knowledge.dictionary-autocorrect',
    product: 'knowledge',
    entryPoint: 'src/lib/canonical/core/knowledgeNormalize.ts:117',
    currentStatus: 'SHADOW',
    directProviders: [],
    bypassedHooks: [],
    targetAdapter: 'KnowledgeEvaluator(signal-only)',
    removalPhase: 'F',
    note: 'DICTIONARY_AUTOCORRECT_ENABLED === "1" (default OFF).',
    owner: 'one-brain-migration',
  },
  {
    id: 'knowledge.clears-soft-review',
    product: 'knowledge',
    entryPoint: 'src/lib/canonical/core/arbitration.ts:46',
    currentStatus: 'SHADOW',
    directProviders: [],
    bypassedHooks: ['review'],
    targetAdapter: 'DecisionEngine-owned',
    removalPhase: 'F',
    note: 'DICTIONARY_CLEARS_SOFT_REVIEW === "1" (default OFF). Only place that retracts review — keep OFF until accept-path GT-proven.',
    owner: 'one-brain-migration',
  },
] as const

/** File (relative to apps/web) of a fork's entryPoint, without the :line. */
export function forkEntryFile(rec: ForkRecord): string {
  return rec.entryPoint.replace(/:\d+$/, '')
}
