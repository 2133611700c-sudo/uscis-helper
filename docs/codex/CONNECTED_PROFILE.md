# CONNECTED PROFILE — turning the pipeline ON, in the right order

Everything is built behind flags (Constitution L10: ship OFF, prove byte-identical, flip after
measuring). This is the recommended way to CONNECT it all — split into FREE (enable now; no extra
Gemini call; proven by unit tests) and PAID (enable when the Gemini budget allows a live measurement).

Set these as environment variables (Vercel prod env, or `.env.local` for local testing). A flag absent
or `=0` keeps today's safe default.

## TIER 1 — FREE deterministic layers (enable NOW; $0; unit-proven)
These make Gemini do LESS (the whole point). They change only deterministic post-processing — no extra
model call. Their ON behavior is covered by passing unit tests (no live Gemini needed to trust them).
```
DOC_READING_RULES_ENABLED=1        # per-doc rules → Gemini+DeepSeek prompts (already default ON)
SMART_NORMALIZE_ENABLED=1          # patronymic reconcile + SEX-FROM-PATRONYMIC + authority resolve
DOC_SCRIPT_ROUTING_ENABLED=1       # Russian-doc names → Russian table (Сергей→Sergey, not Serhei)
RU_TRANSLIT_ENABLED=1              # Russian BGN/PCGN table for distinctive-RU names
DICTIONARY_AUTOCORRECT_ENABLED=1   # snap a near-miss to the UNIQUE closed-set entry (oblast/sex/…)
CROSS_DOC_RECONCILE_ENABLED=1      # fill a held field from a STRONGER sibling doc + FREE-FIRST knownValues
```
Proven by: dictionaryAutocorrect, transliterationPolicy.ukRuSeparation, patronymicReconcile,
sexFromPatronymic, crossDocSession, applyKnownValues, russianGlossary, referenceValidation.

## TIER 2 — PAID Gemini-call stages (enable when budget allows a LIVE measure; 429→BLOCKED)
These add Gemini calls. Order is FREE-FIRST: tile recovery only fires for fields still empty after
Tier 1. Voting uses early-exit (stops at majority). Measure the lift with `stability-audit.mjs`
(multi-run, BLOCKED-not-faked) before trusting in prod.
```
CONTENT_ORIENT_ENABLED=1           # content-orientation detect+correct (grid, K-vote)  [+1–3 calls/doc when sideways]
ORIENT_VOTE_RUNS=2                 # orientation vote (early-exit; 2 is the cheap default)
HIRES_TILE_RECOVER_ENABLED=1       # recover empty CRITICAL fields from hi-res tiles      [+crop calls only when empties remain]
TILE_VOTE_RUNS=2                   # tile vote (early-exit)
```
Optional (more cost, measure first): SELF_CONSISTENCY_GATE_ENABLED, AUTO_DELIVERY_CONSENSUS_ENABLED,
ANTI_FABRICATION_GATE_ENABLED, OCR_FIELD_SAFETY_ENABLED.

## Why it isn't all default-ON in code
- L10 safe-change: a prod default that changes output (RU routing, normalization) must be measured on
  real docs FIRST; flipping it blind on a live immigration product is the failure mode we avoid.
- The Tier-2 paid stages literally cannot be measured right now — the monthly Gemini spend cap ($35) is
  near, and a live read currently deadlines. So Tier 2 stays gated until the budget resets; Tier 1 is
  free and safe to connect immediately.

## How to verify after connecting (free)
`pnpm --filter web run test` (full suite green) + `node apps/web/scripts/gt-pipeline-bench.mjs --dry`
(scoring logic, $0). Live: `node apps/web/scripts/stability-audit.mjs` ONLY when budget allows
(primary-only, 429→BLOCKED, watch the spend).
