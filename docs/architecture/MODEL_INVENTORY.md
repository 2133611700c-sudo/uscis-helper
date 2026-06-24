# MODEL INVENTORY — which model does what, where it works, what it must NOT do

**Authoritative source in code:** `apps/web/src/lib/docintel/modelMatrix.ts` (`MODEL_PROFILES`, `SANCTIONED_CHAIN`,
`DISQUALIFIED`, `HANDWRITTEN_DOC_FAMILIES`). This doc mirrors it for humans. The law is ADR-018.
**Last full live bench against the real documents: 2026-06-23.**

> **THE ONE-LINE TRUTH about handwriting:** **No model reads handwritten certificates without errors.**
> Printed docs (passport, military ID, EAD, I-94) read correctly. Handwritten birth/marriage/death
> certificates are ALWAYS human-reviewed — the GA flash/pro-2.5 models FABRICATE a different, fake
> person on them; the historically-best reader (preview) is currently unavailable.

## The matrix (live-tested 2026-06-23)

| Model | Tier | Role | Availability NOW | Reads well | FABRICATES / forbidden | Function |
|---|---|---|---|---|---|---|
| **gemini-3.1-pro-preview** | preview | **PRIMARY** | ❌ unreliable — 503 + 429 RESOURCE_EXHAUSTED (no capacity guarantee) | Best reader of the owner's Cyrillic incl. handwriting (historically); ONLY acceptance-valid model | not proven error-free on handwriting (→ still human-reviewed); main failure is AVAILABILITY | D1 reader — the only read that counts as a product/acceptance result |
| **gemini-2.5-pro** | GA | fallback (preferred) | ✅ reliable (0 retries) — but raise `maxOutputTokens` or it returns EMPTY (MAX_TOKENS) | PRINTED docs: correct person, 95–100% stable, accurate names/dates | ❌ **fabricates a different person on HANDWRITING** → DISQUALIFIED for certificate family | preferred availability fallback for PRINTED docs (force-reviewed); never acceptance |
| **gemini-3.5-flash** | GA | fallback | ⚠️ intermittent 503 (~1/4 reads landed) | printed identity blocks when it lands | availability (503); fallback only | availability fallback #2; date-box detector (`GEMINI_DATEBOX_MODEL`) |
| **gemini-2.5-flash** | GA | fallback (last resort) | ✅ available | printed identity blocks | ❌❌ **fabricates TWO different fake people across temps on HANDWRITING** → DISQUALIFIED for certs; hallucinates peripheral fields even on printed | last-resort availability fallback for PRINTED only; force-reviewed; never acceptance |
| **gemini-2.5-flash-lite** | GA | not in chain | ✅ printed / ❌ 503 on handwriting | clean printed identity blocks only | handwriting (503); fabricates secondary fields; weakest | not used in production chain |
| gemini-2.0-flash(-lite), gemini-3-pro-preview | — | DEPRECATED | 404 | — | never use | removed |

## Roles by pipeline stage (unchanged laws)
- **D1 reader (vision):** the model above. Acceptance ONLY on `gemini-3.1-pro-preview` (ADR-018). A fallback
  read of a non-Latin doc is force-reviewed (`fallback_model_used`) and is NEVER a quality number.
- **D3 prose translator:** DeepSeek V3 — prose ONLY, never identity/date/number, output overwritten from
  source value, locked tokens untouched (CONSTITUTION L3).
- **Proofreader / technical eye:** Google Vision (DOCUMENT_TEXT_DETECTION) — printed zones / MRZ signal only,
  NEVER a final reader.
- **C3 safety gate:** deterministic code — single writer of `final_value`, nulls uncertain criticals.

## The two config facts that matter (verified 2026-06-23)
1. **Availability:** the primary is a PREVIEW with no capacity guarantee → 503/429. The provider now retries it
   with exponential backoff + jitter (`GEMINI_PRIMARY_RETRY_MAX` / `_RETRY_BASE_MS` / `_RETRY_CAP_MS`) before
   falling back. The GA `gemini-2.5-pro` is the reliable printed-doc fallback.
2. **Token budget:** thinking models spend OUTPUT tokens on reasoning before emitting JSON; at 8192 a dense page
   hit `MAX_TOKENS` → EMPTY read. Raised to `max(8192, GEMINI_MAX_OUTPUT_TOKENS || 16384)` in the provider.
   (2.5-pro went 0→100% on the passport once raised — and this very likely also recovers empty primary reads.)

## Handwriting policy (mandatory)
`HANDWRITTEN_DOC_FAMILIES` = birth, marriage, divorce, death, name-change, certificate. For these, the read is
ALWAYS human-reviewed regardless of model — no GA model is safe, and even the primary is not proven error-free.
Never report a handwriting read as auto-delivered/acceptance.

**Trap test 2026-06-24 (handwriting-trap-bench.mjs, child surname on the real birth cert, temp 0):** NO model
read it correctly (0/5 match GT). TWO failure modes, and the danger is the first:
- **WRONG-STABLE** (gpt-4.1, gemini-2.5-pro, gemini-2.5-flash): returns the SAME wrong person on every run →
  **consensus / majority-vote / self-consistency CANNOT catch it** (all reads agree on the fabrication).
- **FABRICATES-DIFFERENT** (gpt-5.4, gpt-5.5): a different fake person each run (voting *would* flag it).
All models PASSED the blank-control (none invented a name on a blank image — the misread is anchored to real
ink, not hallucinated from void). A targeted name-region CROP did NOT rescue any model. None obeyed
"empty-beats-wrong" — every model emitted a name instead of admitting illegibility.
**Consequence (hard rule):** a handwritten CRITICAL field must NOT be auto-delivered even when multiple reads
or multiple models AGREE — agreement does not imply correctness here. Human review (or a real HTR engine) only.

## How to re-bench (when a quiet Gemini window allows)
`cd apps/web && BENCH_MODELS="gemini-2.5-pro,gemini-3.5-flash,gemini-2.5-flash" node scripts/gemini-model-bench.mjs`
(writes the FULL report — with real reads — to gitignored `qa-private/reports/`, prints a PII-free verdict matrix).
