# ONE BRAIN — Fork Registry (STEP 0)

**Verified personally by call-site trace on HEAD `ed918eb` (worktree `feat/one-brain-reader-result`).** Machine-readable source of truth: `apps/web/src/lib/contracts/oneBrainForkRegistry.ts` (guarded by `oneBrainForkRegistry.guard.test.ts` + `recognitionForkRatchet.test.ts`). Plan: `docs/ocr/ONE_BRAIN_CONVERGENCE.md`.

A "fork" = a recognition/normalization decision plane that is not yet the single Decision Engine path. Each must be registered with a removal phase; CI fails on a NEW unregistered bypass (Level 2) and on a stale registry record (Level 1).

## Decision planes (file:line evidence — personally grepped)

| id | product | entryPoint (file:line) | status | direct providers | bypasses | → adapter | phase |
|---|---|---|---|---|---|---|---|
| translation.vision-extract.core | translation | `vision-extract/route.ts:368` | PRIMARY | — (readDocument/Gemini) | — | facade | D |
| translation.vision-extract.legacy-fallback | translation | `vision-extract/route.ts:599` | LEGACY_ADAPTER | — | — | reader | G |
| translation.ocr-from-storage.dark | translation | `ocr-from-storage/route.ts:273,341` | SHADOW | google_vision, deepseek_mapper | decisionEngine | visionBboxLocator + dependent mapper | E |
| tps.core | tps | `tps/ocr/extract/route.ts:318` | PRIMARY | — | — | facade | D |
| tps.legacy-modules | tps | `tps/ocr/extract/route.ts:402–875` | LEGACY_ADAPTER | — | decisionEngine, knowledgeBrain, review | LegacyTpsReader | G |
| tps.deepseek-brain | tps | `tps/ocr/extract/route.ts:936` (gate :930) | LEGACY_ADAPTER | deepseek_mapper | decisionEngine | dependent mapper + privacy-gate | G |
| tps.dual-ocr-crossref | tps | `tps/ocr/extract/route.ts:426,734` | LEGACY_ADAPTER | google_vision, document_ai, deepseek | decisionEngine | docai-reader + dependent crossref | G |
| ead.core | ead | `ead/ocr/extract/route.ts:175` | PRIMARY | — | — | facade | D |
| reparole.core | reparole | `reparole/ocr/extract/route.ts:192` | PRIMARY | — | — | facade | D |
| knowledge.brain | knowledge | `knowledgeNormalize.ts:100` (snapCity :309) | PRIMARY (default ON) | — | — | KnowledgeEvaluator(signal) | F |
| knowledge.smart-normalize | knowledge | `documentFieldReader.ts:377` (snapCity `dictionaryBridge.ts:107`) | SHADOW (default OFF) | — | — | KnowledgeEvaluator(signal) | F |
| knowledge.dictionary-autocorrect | knowledge | `knowledgeNormalize.ts:117` | SHADOW (OFF) | — | — | KnowledgeEvaluator(signal) | F |
| knowledge.clears-soft-review | knowledge | `arbitration.ts:46` (used `vision-extract:485`) | SHADOW (OFF) | — | review | DecisionEngine-owned | F |

## Verified facts (personal grep, HEAD ed918eb)
- **Translation dual + fallback:** `readDocument` at `vision-extract:368` (live core) and `:599` (legacy fallback); `applyKnowledgeBrainIfEnabled` at `:415`/`:648`. bbox ONLY in `ocr-from-storage` (`mapFieldsWithDeepSeek:273` → `resolveOcrIds:341`); NOT in the live wizard path.
- **TPS 4 planes:** core `readDocument:318`; `if (moduleResult === null)` legacy `:402–875`; `DUAL_OCR_CROSSREF !== 'false'` (default ON) + `processDocAI:429/737` + `runDualOcrCrossref:432/740`; `runBrain:936` (gated `:930`); `flow: tps_core|tps_legacy` `:1331`.
- **EAD/ReParole:** `readDocument` at `ead:175`, `reparole:192` — clean spine.
- **Two snapCity callers** (must converge to ONE): `knowledgeNormalize.ts:309` + `dictionaryBridge.ts:107` (def `gazetteer.ts:159`).
- **Flag posture:** `KNOWLEDGE_BRAIN_ENABLED !== '0'` → **ON** (`knowledgeNormalize.ts:100`); `SMART_NORMALIZE_ENABLED === '1'` → OFF (`documentFieldReader.ts:377`, `dictionaryBridge.ts:106`); `DICTIONARY_AUTOCORRECT_ENABLED === '1'` → OFF (`knowledgeNormalize.ts:117`); `DICTIONARY_CLEARS_SOFT_REVIEW === '1'` → OFF (`arbitration.ts:46`, `vision-extract:485`).

## Guard (permanent)
- **Level 1** `oneBrainForkRegistry.guard.test.ts`: registry well-formed, ids unique, every entryPoint file exists, all products+knowledge covered, audited forks present, every non-PRIMARY fork has a target adapter + removal phase.
- **Level 2** `recognitionForkRatchet.test.ts`: freezes current second-recognition-plane callers (`runDualOcrCrossref`, `runBrain`, `mapFieldsWithDeepSeek`, `googleVisionProvider`); FAILS on any NEW caller; ratchets down as forks become readers.

## Branch / state
- Worktree branch `feat/one-brain-reader-result` (off `ed918eb`); main-tree + origin both at `ed918eb`. Clean. No runtime change. No push.
