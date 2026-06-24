# Critical audit — rules, instructions, dictionaries (2026-06-24)

Owner: "проверь все правила и инструкции как всё обновлено и работает и словари — максимально критично."
Method: 3 parallel critical agents (rule-drift, dictionary-state, guard/test-health) + objective test runs.

## Verdict in one line
**Dictionaries GREEN (550/0 + golden 79/0, tsc 0) with 3 real gaps; RULES had DRIFTED (ADR-026 not propagated
to the law layer — FIXED here for P0); one GUARD (`docReadingRulesSync`) is shallow/bypassable.**

## A. Rules / instructions — DRIFT (P0 fixed this commit)
ADR-026 + MODEL_INVENTORY were updated 2026-06-24 but the change did NOT propagate. Fixed now:
- **CLAUDE.md** MODELS section — added ADR-026 route-by-rendering correction; softened the false blanket
  "no model reads handwriting"; flagged `gemini-3.1-pro-preview` as an unstable preview. ✅
- **CONSTITUTION L1** — added the ADR-026 amendment note (route-by-rendering; handwriting reader verified but
  prod-wiring pending; preview is unstable). ✅
- **RULES_MASTER_INDEX** — split Reader into printed/LLM vs handwriting/raxtemur rows; corrected MODEL-LAW line;
  added ADR-026 to Key ADRs. ✅
- **modelMatrix.ts** — corrected the stale `gemini-3.1-pro-preview` profile ("best reader incl. handwriting" →
  not the handwriting reader, run-to-run unstable; raxtemur per ADR-026). ✅ (suite 4660 green, tsc 0)
- **STILL OPEN (needs build/decision, not just text):** modelMatrix.ts has NO raxtemur/route-by-rendering code
  (handwriting routing unbuilt — sidecar hosting pending); the LLM teaching surfaces (buildPrompt/docReadingRules)
  still teach "best-effort, never abstain", which contradicts ADR-026's gate posture for handwriting — but those
  are LLM prompts and the handwriting reader isn't an LLM, so leave until the reader is wired.

## B. Dictionaries / codex — GREEN, 3 real gaps
Tests 550/0 + goldenDictionaryVectors 79/0 standalone; tsc 0. Tables correct; `registry/registry.csv` fully
sourced (zakon.rada.gov.ua provenance). Gaps (prioritized):
1. **RU/UA routing (P1, matches project memory):** the knowledge `normalizeName` hardwires `transliterateKMU55`
   → a Russian name is mis-Russified (Сергеевич→Serheievych). The correct script router lives only in
   `apps/web/.../transliterationPolicy.ts romanizeBySourceScript` and is gated behind `RU_TRANSLIT_ENABLED` =
   OFF by default. The ё/э/ы single-letter leak is mitigated by `KMU_RU_FALLBACK`, but the whole-name wrong-table
   problem is unmitigated in-package + flag-off in the app. (Flipping the flag is a product decision — Russification-
   amplification risk; needs real-OCR validation.)
2. **"No Cyrillic leak" overstated (P2):** 182/190 non-standard Cyrillic codepoints (archaic/Serbian/Belarusian/
   extended) pass through raw; the guard + tests only cover the modern 33+33 letters. Low real-world incidence.
3. **CI gaps (P2):** `goldenDictionaryVectors` + `registry/mrz` (vitest) are NOT in `pnpm --filter knowledge test`
   → no regression protection unless run by hand / under the web suite.

## C. Guards / tests — green, one weak link
modelMatrix, registryHandwritten, oneDictionaryGuard, documentBrain.sharedRules, PII guard, tsc — all STRONG &
green. 24 skipped tests are all conditional infra/env gates (no unconditional skip hiding rot).
- **WEAK (P1): `docReadingRulesSync`** only probes the first/last 24 chars of each rule → the middle of a rule
  can be silently dropped/reworded/negated and the guard still passes. The "one source → both models" invariant
  is asserted but not truly enforced; real protection rests on hardcoded-sample tests that give NO coverage to
  newly-added rules. Recommended: replace the 24-char probe with token/clause-coverage + reconcile the legitimate
  drop set (`isImageOnlyRule`) against the actual clause-stripper output.

## Prioritized open fixes (not done this commit)
1. (P1) Harden `docReadingRulesSync` to token/clause coverage.
2. (P1, product decision) RU/UA routing: evaluate flipping `RU_TRANSLIT_ENABLED` with real-OCR validation, or move
   the router into the codex so `normalizeName` stops hardwiring KMU-55.
3. (P2) Add `goldenDictionaryVectors` (+ registry/mrz) to the knowledge `test` script.
4. (P2) Either build the ADR-026 handwriting reader + routing, or add a `// ADR-026 PENDING` banner in
   modelMatrix.ts so code and ADR-026 stop silently contradicting.
