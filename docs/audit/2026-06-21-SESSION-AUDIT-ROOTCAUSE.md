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

---

## RC1 — CORRECTED VERDICT (after the RC2 observability fix)

**The primary `gemini-3.1-pro-preview` IS the actual reader. There is NO 3.1→2.5 fallback.**
Evidence: staging-e2e run 27931589437 (branch translation/ru-and-model-matrix-fixes, deploy with
the RC2 fix) reported the REAL per-page reader for ALL 5 scenarios (ua_birth, ru_printed,
passport, ambiguous, handwritten) = `model=gemini-3.1-pro-preview`, 12/12 pass.

The earlier "model=gemini-2.5-flash" was 100% the fabricated env-default field (RC2), NOT a real
fallback. **RC1's original "primary 429s on a single image / falls to flash" verdict was WRONG —
it was inferred from a bogus signal.** The spend cap WAS a real blocker earlier (raw 429
RESOURCE_EXHAUSTED, fixed by the owner raising it); but once raised, the primary reads vision
fine at the current (low) volume. The "preview model can't serve production volume" risk (RC1
deeper root) is a SCALE concern for later, not a current defect — at e2e volume the primary works.

Lesson (recorded for the owner): a fabricated telemetry field caused a multi-hour misdiagnosis.
The fix (report the real reader) is the durable correction; the model-switch never happened.

### Budget note (owner-provided 2026-06-21)
AI Studio "Experimental" tier, monthly spend cap $30, used $20.54 (~$9.46 left), resets 1st PT.
Be economical with live Gemini calls. Durable scale fix = move to paid pay-as-you-go tier (higher
spend AND rate limits) — owner billing decision; not a code blocker today.

---

## PART 2 — ARCHITECTURE MAP (4 parallel agents, evidence-based, my reconciliation)

### Single brain (Agent 1)
- LIVE reader = `documentFieldReader.readDocument` (docintel). LIVE arbitration = `arbitrateDocument`
  via `applyKnowledgeBrainIfEnabled` (knowledgeBrain.ts:47-52). Wired on ALL 4 product routes
  (translation/tps/reparole/ead).
- DUPLICATION (code-only, benign): `vision-extract/route.ts` has TWO `buildCanonicalResult`
  blocks — Core (~:381) and a legacy fallback (~:550) reached ONLY when Core returns 0 fields or
  throws. Per request only ONE path runs (Core returns, OR falls through) → NO double DB write.
  `readDocumentCore` + direct `arbitration.ts` import = DEAD (test-only). Optional cleanup:
  hoist arbitration+wrap+persist out of the try/catch to one block. LOW priority (already correct).

### C3 safety (Agent 2) — NO ACTION NEEDED
- The safe accessor `fieldAccessor.getCanonicalValue` honors `finalValue===null ⇒ null` (no
  resurrection). All 4 adapters (tps/translation/reparole/ead) + both PDF render paths
  (`render`, `generate-pdf`) route through it and `.filter(value!==null)`. Re-Parole's former
  blind spot is FIXED (reParoleAdapter.ts:93-95). `independentCrossProductAudit.ts:309` actively
  detects a finalValue=null→released violation. **No confirmed C3 bypass on any release path.**

### Dictionaries / legacy (Agent 3, reconciled)
- LIVE translator path (vision-extract) = canonical `@uscis-helper/knowledge` ONLY. PROVEN today on
  the owner's real booklet (Kuropiatnyk/Serhii/смт→urban-type settlement/Vinnytsia Oblast).
- Legacy glossary (`lib/translation/glossary/*`, `ukraine_agency_abbreviations.json` ~56 entries,
  validators ~2574 lines) is imported only by routes `/api/translation/extract` +
  `/ocr-from-storage`, which have NO live fetch() caller (earlier caller-grep) → effectively DEAD.
  NOTE: Agent 3 labeled these routes "LIVE" by import, but did not verify callers; the caller-grep
  (0 fetch sites) governs — they are dead. `UNVERIFIED`: re-confirm no cron/server invokes them.
- 3 conflicts (ГУМВС/УМВС Department-vs-Directorate, РАЦС Registry-vs-Status) — canonical is the
  keeper per audit #195. Hygiene migration of ~26-47 niche abbreviations into knowledge is
  OPTIONAL (dead path); do it only when quarantining legacy, and migrate-before-delete.

### Branch / CI reality (Agent 4)
- Complete work (RU fix d1b4ec2, ADR-018 4784fc6, observability cd634be) lives on
  `translation/ru-and-model-matrix-fixes` (cd634be); the observability fix is ONLY there.
- PR #208 auto-closed by the 2026-06-20 PII-redaction history rewrite (one-time filter-repo, not
  an ongoing force-push bot). Current open PR = **#213** (feat→main, head diverged origin e1f9474
  vs local dcd4a0e). origin/feat LOST the RU+ADR-018+observability fixes in the rewrite.
- RECOMMENDATION: make `translation/ru-and-model-matrix-fixes` the canonical branch; open a clean
  PR → main from it; abandon/archive origin/feat. No history-rewrite fight needed.

## PART 3 — REMEDIATION PRIORITY (root-first, owner-decision marked)
1. **[OWNER DECISION] Consolidate to one branch + PR.** Make `translation/ru-and-model-matrix-fixes`
   canon; clean PR → main; close #213. Risk: merging to main = production deploy.
2. **[OWNER, account-side] Scale: move AI Studio off "Experimental" $30/mo tier** to paid
   pay-as-you-go (higher spend AND vision rate limits) before real volume. Not a code blocker now.
3. **[ENG, optional hygiene] Quarantine dead legacy translation subsystem** (migrate ~26 niche
   agency abbreviations + nominative-case logic into @uscis-helper/knowledge first, then delete
   dead routes/validators). SSoT cleanup; does not change live behavior.
4. **[ENG, optional] Collapse the duplicate buildCanonicalResult block** in vision-extract. Benign.

## VERDICT
Translator + dictionaries + single brain WORK on the live canonical path (primary model reading,
real-doc proven, C3 safe, zero Cyrillic leak). Remaining items are consolidation (owner decision)
and tech-debt hygiene — not correctness blockers.
