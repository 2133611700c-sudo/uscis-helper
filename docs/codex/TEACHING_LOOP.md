# TEACHING LOOP — how Claude (mentor) teaches Gemini + DeepSeek, cheaply

The canonical, COST-CHEAP process for turning something Claude learns into knowledge the models use.
Principle: the whole pipeline exists to MINIMIZE expensive LLM calls — do max work deterministically
(free); teach the models from ONE source; verify before trusting; never fake a number.

## The loop (free-first)
1. **MENTOR READ (Claude, free).** Claude reads the REAL document with its own eyes (Read tool),
   field by field, by all rules. Records the ground truth. This is the reference — "I go through it
   myself first, then my understanding becomes bigger." (e.g. the Russian birth cert: Куропятник /
   Сергей / Сергеевич, 25 июня 1986, пгт Тростянец, Винницкой области, III-АМ № 428069.)
2. **ENCODE ONCE in the ONE codex.** Put the learning where it belongs, with a SOURCE cite:
   - a reading/translation behavior → a rule in `docReadingRules.ts` (constant or per-doc `rules[]`);
   - a term/place/name fact → `packages/knowledge` (civil_registry_terms.json / dictionary.ts / …);
   - the expected output → a GOLDEN VECTOR test (`packages/knowledge/src/__tests__/*.test.ts`).
   Never a parallel copy (Constitution L2). Add a row to `RULE_REGISTRY.md`.
3. **AUTO-TEACH BOTH MODELS.** The rule flows from that one source to Gemini (`readingRulesPromptBlock`,
   default ON) AND DeepSeek (`textRulesForDeepSeek`). `docReadingRulesSync.test.ts` proves nothing is
   silently dropped. No per-model duplication, no fine-tuning.
4. **MEASURE — FREE first.** Run the deterministic golden vectors + the reference-validation +
   `gt-pipeline-bench.mjs --dry` (scoring logic, $0). These catch most regressions for $0.
5. **MEASURE — LIVE only when needed + budget allows.** ONE primary-only Gemini read via
   `gt-pipeline-bench.mjs` (live) or `stability-audit.mjs` (multi-run). Rules: primary model only
   (ADR-018); 429/fallback → BLOCKED, NEVER a faked number; cap calls; watch the monthly spend.
   Record the per-field before/after lift in RULE_REGISTRY.
6. **STABILITY, not single runs.** A single passing read is NOT proof (the owner's rule). Use
   `stability-audit.mjs` (N runs, majority-vs-GT, variance) when measuring a behavior that can swing.

## Cost ordering — fill/fix a field FREE before any paid call
When a field is empty/uncertain, prefer FREE deterministic sources BEFORE spending a Gemini call:
1. cross-document reconciliation (a stronger sibling doc's value — `crossDocReconcile`, $0);
2. MRZ check-digit math (`mrz.ts`), controlling Latin (passport) — $0;
3. patronymic→sex and patronymic↔given-name derivation, dictionaries (terms/places/oblasts) — $0;
4. ONLY if all fail AND the field is critical → ONE small Gemini crop read (hi-res tile, early-exit voting).

## Harnesses (already built — this is the "rule-acceptance" toolkit)
- `apps/web/scripts/gt-pipeline-bench.mjs` — per-field verdict vs owner GT (`--dry` free; live paid).
- `apps/web/scripts/stability-audit.mjs` — N-run variance + majority-vs-GT (BLOCKED-not-faked).
- `packages/knowledge` golden vectors + `referenceValidation.test` + `russianGlossary.test` — $0 truth.
- `docReadingRulesSync.test` — one-source-→-both-models guard.

## Rejected (see ADR-025): heavy LLM infra (DSPy/Langfuse/LangGraph/Guidance/fine-tuning/RAG/MT-swap) —
they multiply paid calls or add dependencies; opposite of deterministic-first / LLM-minimal.
