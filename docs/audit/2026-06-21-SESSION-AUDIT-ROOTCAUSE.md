# SESSION AUDIT + ROOT-CAUSE — 2026-06-21 (Translation / OCR brain)

> Evidence-only, incremental. Every claim has a `file:line`, a command, or a run id.
> `UNVERIFIED` is marked. No PII. Written as work proceeds (poetapno), per CLAUDE.md
> audit convention (mirrors docs/audit/2026-06-13-DOCUMENT_CORE_AND_PROJECT_STATE_AUDIT.md).

- **Author:** Claude (Opus 4.8), owning the project per owner directive 2026-06-21.
- **Scope:** today's translation/OCR work — what was planned vs done, root causes (model
  switch, deploy integrity, CI guards, branch chaos), and the remediation that makes the
  translator + dictionaries fully work.
- **Method:** git/gh, ripgrep, direct file reads, local tsc/vitest, live CI diag runs
  (gemini-quota-diag), Vercel MCP, real-document POST to live preview.

---

## RC1 — WHY Gemini switches `gemini-3.1-pro-preview` → `gemini-2.5-flash`

**Verdict: the configured PRIMARY reader is a rate-limited PREVIEW model that 429s on
vision (image) requests; the read falls through the chain to `gemini-2.5-flash`. Raising
the spend cap (budget) does NOT change rate limits — they are independent quotas.**

### The fallback algorithm (code, not guess)
- `apps/web/src/lib/docintel/providers/geminiVisionProvider.ts`
  - `modelFallback()` chain = `[gemini-3.1-pro-preview, gemini-3.5-flash, gemini-2.5-flash]`
    (PRIMARY first, from `modelMatrix.FALLBACK_MODELS`).
  - Loop (`for (const model of modelFallback())`): on HTTP `429/503` it waits 1500ms,
    retries the SAME model up to `attempts` times, then `break`s to the NEXT model.
  - The translation route passes `attemptsPerModel: 1` → PRIMARY gets exactly ONE shot,
    no in-loop retry, then immediate fallover.

### Empirical evidence
1. **Text probe (gemini-quota-diag run 27921949671 & 27931285729):** after the owner raised
   the spend cap, `gemini-3.1-pro-preview generateContent HTTP=200` on a tiny TEXT prompt.
   So the key is valid, the model exists, billing works, and the spend cap is no longer the
   blocker for text.
2. **Real single-page IMAGE via the live route:** POSTing the owner's real booklet
   (`qa-shots/private/booklet_test_resized.jpg`, ONE page = ONE request) to the live preview
   `/api/translation/vision-extract` returned `model=gemini-2.5-flash` every time (3 attempts).
   A single image request → the read did NOT come from primary → **primary 429'd on a single
   real IMAGE request** (and so did gemini-3.5-flash), only gemini-2.5-flash succeeded.
3. Contrast (1) vs (2): same model, same key, same minute — TEXT=200 but IMAGE→fallover. The
   differentiator is the IMAGE payload (an image costs ~thousands of "tokens" in Gemini's
   accounting). ⇒ the limit hit is a per-model VISION rate/throughput limit, not the spend cap.

### Exact metric (RPM vs TPM) — `UNVERIFIED`
A dedicated image-probe diag step (POST identical JPEG to all 3 models, capture the raw 429
body whose `quotaMetric` distinguishes requests-per-minute vs tokens-per-minute) was added but
FAILED on runner tooling (no ImageMagick/Pillow on the diag runner; runs 27931285729,
27931376815 erlored at step 4). The exact metric is a follow-up; it does not change the verdict.

### DEEPER ROOT (the interconnection the surface "RPM" hides)
`gemini-3.1-pro-preview` is a **PREVIEW** model. Preview models carry very low default rate
limits regardless of billing. ADR-018 (`modelMatrix.ts`) makes this model the **ONLY** valid
acceptance reader and force-reviews every fallback read. So the system is structurally caught:
the only model allowed to produce a clean (non-review) acceptance read is a preview model that
rate-limits on real vision volume. **Net: with the current model matrix the translator can
almost never produce a clean primary-acceptance read on real documents** — it either fails
closed or ships a force-reviewed flash read. This is the real root, not a transient 429.

### Fix options (for the north-star task; decision pending owner input)
- **(A) Owner raises the vision rate quota** for gemini-3.1-pro-preview in Google Cloud
  (Generative Language API → Quotas → requests/tokens per minute for that model). Same console
  as the spend cap, different field.
- **(B) Re-choose the primary** to a generally-available high-quality model with production
  rate limits (e.g. a GA `gemini-*-pro`), updating ADR-018 deliberately — preview models are
  not a safe sole acceptance reader for production.
- **(C) Engineering mitigations** within limits: downscale page images before the primary call
  (cuts image-token cost → helps if TPM), and sequence/throttle multi-page reads (helps if RPM).
- These are not mutually exclusive; (A) is the immediate unblock, (B) is the durable fix.

---

## RC2 — The `model` field the route returns is a LIE (env default, not the real reader)

**Verdict: the vision-extract core-b2 success response reported
`process.env.GEMINI_MODEL` (default `'gemini-2.5-flash'`) as `model`, NOT the model that
actually read the document. Every "model=gemini-2.5-flash" observed today is this default,
not evidence that 2.5-flash read anything. This invalidated my RC1 fallback diagnosis and
would mislead any ADR-018 acceptance gate.**

### Evidence
- Deployed preview healthz `sha=29cd5c7` (contains the disqualification fix 4784fc6) — verified
  via `GET <preview>/api/healthz`. So the code IS deployed; this was NOT a stale build.
- POST booklet image with `docTypeId=ua_birth_certificate` to that preview → `model=gemini-2.5-flash`
  even though `isDisqualifiedFor('gemini-2.5-flash','ua_birth_certificate')===true` (verified
  locally). A disqualified model "reading" a cert was impossible → the field had to be wrong.
- Root: `apps/web/src/app/api/translation/vision-extract/route.ts:425` (pre-fix) returned
  `model: normalizeGeminiModel(process.env.GEMINI_MODEL, 'gemini-2.5-flash')`. The ACTUAL reader
  model is `r.model` from `readDocument` (line 319), collected per page in `corePages` but
  DISCARDED. With `GEMINI_MODEL` unset in staging, the route always reports `gemini-2.5-flash`.

### Fix (applied, this session)
`route.ts`: compute `readModels = unique(corePages[*].r.model)` and return the ACTUAL
`model = readModels.join('+')` plus a `read_models[]` array; env default only if no page read.
tsc clean. This restores real observability so the true reader (possibly the primary
gemini-3.1-pro-preview) becomes visible, and ADR-018 gating can key off the real model.

### Consequence for RC1
RC1's "primary 429s on a single image" is now **UNVERIFIED** — it was inferred from the bogus
`model` field. After deploying the RC2 fix, a single re-POST will show the REAL reader. The
DEEPER RC1 root (preview model as sole acceptance reader) still stands as a design risk, but the
"it always falls to 2.5-flash" claim must be re-confirmed with the corrected field. **This is
exactly why the owner said find the root, not the surface: the surface signal was fabricated.**
