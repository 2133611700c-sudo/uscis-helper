# ADR-018 — Iron Model Matrix (which model does what, permanently)

Date: 2026-06-10
Last update: 2026-06-23 (corrected to the live model bench on the real documents)
Status: ACCEPTED (owner-directed)
Supersedes: model-choice ambiguity left open by ADR-017
Related: ADR-017 (one Gemini brain), ADR-011 (no single AI truth source), ADR-016 (hard-case human review)

> **Code source of truth:** `apps/web/src/lib/docintel/modelMatrix.ts` (`MODEL_PROFILES`, `SANCTIONED_CHAIN`,
> `DISQUALIFIED`, `HANDWRITTEN_DOC_FAMILIES`). **Human inventory:** `docs/architecture/MODEL_INVENTORY.md`.
> This ADR is the law; both of those mirror it. Last full live bench: 2026-06-23.

## Decision

One fixed matrix of model-to-operation assignments. This is the reference;
any deviation is a bug, not a tuning option.

### Models

| Model / service | Role | Status |
|---|---|---|
| **gemini-3.1-pro-preview** | THE document reader (D1) — the ONLY acceptance-valid reader, all products, all doc classes | PROD primary. **PREVIEW endpoint, NO capacity guarantee** ⇒ sporadic **503 UNAVAILABLE + 429 RESOURCE_EXHAUSTED** (availability is its main failure). Provider retries it with exponential backoff+jitter (`GEMINI_PRIMARY_RETRY_MAX` / `GEMINI_RETRY_BASE_MS` / `GEMINI_RETRY_CAP_MS`) BEFORE any fallback. Historically the best reader of Cyrillic incl. handwriting |
| gemini-2.5-pro | Fallback #1 (preferred availability fallback) | GA, reliably AVAILABLE (no 503/429 in the bench). Accurate + SAME person on PRINTED docs (95–100% stable). **DISQUALIFIED for the certificate family** (birth/marriage/divorce/death/name_change): FABRICATES a different, fake person on HANDWRITTEN certificates (confident + stable). Force-reviewed (`fallback_model_used`), NEVER an acceptance number. NOTE: thinking eats the output-token budget ⇒ `maxOutputTokens` must be high (`max(8192, GEMINI_MAX_OUTPUT_TOKENS\|\|16384)`) or it returns EMPTY (MAX_TOKENS) |
| gemini-3.5-flash | Fallback #2 (availability) | GA. Intermittent 503 in the current window; availability-only fallback. Also the date-box detector (`GEMINI_DATEBOX_MODEL`). Never primary; non-Latin read force-reviewed (`fallback_model_used`) |
| gemini-2.5-flash | Fallback #3 (last resort, availability) | GA. **DISQUALIFIED for the certificate family** — on a handwritten birth certificate it fabricated TWO different fake people across temperatures (re-confirmed 2026-06-23). Printed-only availability fallback; force-reviewed; never acceptance |
| gemini-2.5-flash-lite | — | NOT in the sanctioned chain. Printed-only; 503 on handwriting |
| gemini-2.0-flash(-lite) | — | DEPRECATED, HTTP 404, never use |
| gemini-3-pro-preview | — | DEPRECATED, 404 on generation calls (listed but unusable), never use |
| **Google Vision** (DOCUMENT_TEXT_DETECTION via SA) | Technical eye: raw OCR signal, presence confirmation, future bbox/crop. MRZ parsed by deterministic code | NEVER a final reader |
| **DeepSeek** | (a) prose translation (D3); (b) legacy TPS text-structuring gap-fill on Vision OCR *text* (never sees the image) | Its claimed `final_value` is NEVER trusted — deterministically overwritten from `source_value` via toWinAnsiSafe/KMU-55 (`documentBrain.ts` sanitizer). No Cyrillic decisions, no identity/date/number authority |
| GPT/OpenAI | — | REMOVED from codebase (Phase 2.6) |

All fallbacks (`gemini-2.5-pro`, `gemini-3.5-flash`, `gemini-2.5-flash`) are **AVAILABILITY-only**, force-reviewed
(`fallback_model_used`), and are **NEVER an acceptance/quality number**. Acceptance is valid ONLY on
`gemini-3.1-pro-preview`.

### Handwriting law (NEW, 2026-06-23)

NO model — not even the primary — is PROVEN to read HANDWRITTEN certificates without error. Handwritten
birth/marriage/divorce/death/name-change docs are **ALWAYS human-reviewed regardless of model**.
(Code: `HANDWRITTEN_DOC_FAMILIES` + `isHandwrittenFamily()` in `modelMatrix.ts`.)

### Token-budget fix (2026-06-23)

Thinking models spend OUTPUT tokens on reasoning before emitting JSON; at 8192 a dense page hits `MAX_TOKENS`
⇒ EMPTY read. Provider now uses `max(8192, GEMINI_MAX_OUTPUT_TOKENS || 16384)`. (Recovered 2.5-pro from empty,
and this very likely also recovers empty PRIMARY reads.)

### Operations

| Op | What runs it |
|---|---|
| D0 image quality | code (sharp / size checks) — no model |
| D1 document reading | gemini-3.1-pro-preview (provider chain, fallback ⇒ forced review on non-Latin) |
| D1 raw OCR / MRZ | Google Vision + deterministic MRZ parser |
| D1.5 raw_cyrillic preserve | code (adapter/Core, Phase 2.0) |
| D2 dictionaries / KMU-55 / gazetteer / patronymic / authority | deterministic code — no model |
| C3 final gate (`finalValue` single writer) | deterministic code (Phase 3) — no model |
| D3 prose translation | DeepSeek |
| D4 validators | deterministic code |
| D5 client review | UI + user confirmation (re-enters C3) |
| D6 PDF / payment | code (pdf-lib, Stripe) — reads `finalValue` only |
| Audit | provenance log — code |

## Enforcement in code (verified 2026-06-23)

1. `geminiVisionProvider.ts` — `primaryGeminiModel()` exported; sanctioned chain = `[primary, 2.5-pro, 3.5-flash, 2.5-flash]` (`SANCTIONED_CHAIN` in `modelMatrix.ts`). The primary is retried with exponential backoff+jitter before any fallback.
2. `documentFieldReader.ts` — **deterministic, flag-free guard**: `spec.script !== 'latin'` AND `read.model !== primaryGeminiModel()` ⇒ every field `review_required=true` + reason `fallback_model_used`. A fallback read of Cyrillic/mixed docs can never silently become a candidate-final.
3. Latin-only US forms (us_ead / us_i94 / us_i797) are exempt — flash was never disqualified on Latin print.
4. Tests: `docintel/__tests__/fallbackModelReview.test.ts` (5 cases incl. confidence-0.99-still-reviewed).
5. DeepSeek sanitizer: `tps/ai/documentBrain.ts` — `final_value` overwritten from `source_value`; Cyrillic in output = hard fail.

## Why

- Live bench 2026-06-23 (owner GT docs): `gemini-2.5-flash` fabricated TWO different fake people across temperatures on a handwritten birth certificate (re-confirming 2026-06-02/09); `gemini-2.5-pro` is accurate + same-person on PRINTED docs (95–100% stable) but fabricates a confident, stable, different fake person on the same handwritten certificate ⇒ both are DISQUALIFIED for the certificate family. The primary (`gemini-3.1-pro-preview`) is historically the best reader of Cyrillic incl. handwriting but is a PREVIEW with no capacity guarantee ⇒ its dominant failure is availability (503/429), now mitigated by retry-with-backoff before fallback.
- NEW LAW: no model — not even the primary — is proven to read handwritten certificates without error ⇒ always-review stays mandatory regardless of model.
- The fallback chain exists for availability but silently traded safety for it on exactly the doc classes where 2.5-pro / 2.5-flash are disqualified. This ADR makes the trade explicit: availability is kept (a fallback may still read), safety is kept (the read is force-reviewed and never released as an acceptance number).

## Not allowed without a new ADR + owner GT benchmark

- Promoting any flash or 2.5-pro model to primary for any doc class.
- Reporting any fallback read (incl. 2.5-pro) as an acceptance/quality number.
- Auto-delivering a handwritten certificate read without human review (any model).
- Letting DeepSeek see images or decide Cyrillic/names/dates/numbers.
- Using Google Vision output as a final field value.
- Removing the fallback forced-review guard.
