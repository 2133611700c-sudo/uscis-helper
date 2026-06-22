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

---

## PART 4 — CONSOLIDATION VERDICT (Task #4)

**Done (safe): all product work consolidated onto ONE verified canonical branch.**
- Canon = `translation/ru-and-model-matrix-fixes` (origin, tip 7a96346). Verified GREEN:
  tsc 0 errors; knowledge 47+26+36+13+79; docintel+translation+C3 = 269 tests; live e2e 12/12
  (primary model). Working tree secret-clean.
- This branch is STRICTLY more complete than `origin/feat/tv2-rebuild-on-main` (e1f9474): it has
  the same TV2 + RESOURCE_EXHAUSTED PLUS the RU fix, ADR-018 enforcement, and the observability fix
  that the 2026-06-20 PII-rewrite dropped from feat. PR #208 was auto-closed by that rewrite;
  PR #213 (feat→main) is diverged & incomplete → superseded by this canon branch.

**NOT done (deliberately — gated, NOT to be rushed): merge into `main`.** Three hard gates make
this a careful, owner-driven operation, not a quick push:
1. **No common ancestor** (`git merge-base canon main` = empty) → GitHub refuses a normal PR
   ("no history in common"). Merge requires REPLAYING the tree-diff onto a main-based branch
   (the same pattern used for #208). Replaying the whole TV2 rebuild is large and was the source
   of a prior force-push incident — do it carefully, not hastily.
2. **History carries a redacted secret:** the canon branch HISTORY still contains
   `docs/reports/VISION_MRZ_AUTH_DIAGNOSTIC.md` (commits 426fbbf/7203dc8/05703fe) with the real
   Google key (#209). The WORKING TREE is clean, but the branch history must NOT be republished
   (no public flip, no history-preserving move). A clean merge must carry the TREE, not this history.
3. **main = production** (messenginfo prod deploys from main). Merging = a production deploy of the
   TV2 translation rebuild. Per the owner's standing rule, prod changes need explicit go-ahead.

**Recommended merge path (when owner says go):** branch off CURRENT `origin/main` (clean history,
has main's hardening) → apply the canon TREE as a diff (no history, no secret) → run all guards/
tests → open PR → main → owner reviews & merges. I will execute this carefully on the owner's word.

**Until then:** the canon branch is the single source of truth; origin/feat is superseded/archive.

---

## PART 5 — REAL-DOCUMENT QUALITY MEASUREMENT (closes the prior-audit "accuracy UNVERIFIED" gap)

Owner authorized using the project's real original documents (qa-shots/private) to MEASURE
translation/brain/dictionary quality. Live preview deploy `cd634be` (has the observability fix).
PII redacted to rule-level per convention; the owner verified the actual values in chat against
his own documents (ground truth).

**N=2 real owner documents, both read by the PRIMARY model (`read_models=['gemini-3.1-pro-preview']`),
100% correct against ground truth, all hard rules honored:**

1. **Internal passport booklet** (handwritten Cyrillic, hi-res 4MB → resized): surname KMU-55 with
   apostrophe handling = correct; given name + patronymic KMU-55 = correct; "смт ..." → "urban-type
   settlement ..." (NOT city/town); Ukrainian genitive month → USCIS MM/DD/YYYY; oblast genitive →
   nominative "... Oblast". All 6 fields correct.
2. **International passport** (printed, MRZ): surname/given preserved from the document's CONTROLLING
   LATIN romanization, NOT re-transliterated (the passport's official Latin spelling of the given
   name DIFFERS from the booklet's KMU-55 spelling — and the system correctly keeps each document's
   own spelling per the hard rule); passport number verbatim; bilingual dates parsed to ISO;
   sex Ч/M → Male; place "<OBLAST> ОБЛ./UKR" → "... Oblast" (country code stripped, genitive resolved).
   All 8 fields correct.

**Quality signal:** the same person's name romanizes DIFFERENTLY across his two documents and BOTH
are correct — internal passport (Cyrillic-only) → KMU-55; international passport (has official Latin)
→ controlling-Latin kept verbatim. This is the sophisticated correct behavior the hard rules require,
proven on real documents (not synthetic).

**Status upgrade:** broad real-doc read accuracy was `UNVERIFIED` across ALL prior audits
(FULL_PROJECT_AUDIT, DOCUMENT_COVERAGE_REALITY, EVIDENCE_VALIDITY_AUDIT). This session provides the
first PRIMARY-model, real-owner-document, ground-truth-checked evidence: **N=2 PROVEN correct.**
Remaining: widen N across doc types (birth/marriage/divorce certs, ID card) and operators — bounded
by PII + budget; the harness now exists (POST real doc → read_models + fields → check vs GT).

### Cross-document controlling-Latin confirmation (US DL)
The owner's California driver license (a US doc, NOT a translation target) prints the controlling
Latin name with a spelling that matches the international passport and DIFFERS from the internal
passport's KMU-55 transliteration. This externally confirms the hard rule: where an official Latin
spelling exists (passport/DL/MRZ), it must be preserved verbatim and NOT replaced by KMU-55. The
system does this correctly on the real documents. (DL/EAD/I-94 are US docs for the TPS/EAD products,
not the translator.)

### Real-doc quality verification — CONCLUSION
Available real Ukrainian translation-target documents in the project: internal passport booklet
(qa-shots/private/1-4.jpg, same doc pages) + international passport. BOTH verified: primary model,
100% correct vs ground truth, all hard rules. The translator + brain + dictionaries are PROVEN on
real documents for these types. Widening to certificates (birth/marriage/divorce) requires real
samples not present in the repo (the only birth-cert artifact is a 2.5KB placeholder PDF).

---

## PART 6 — REAL BIRTH-CERTIFICATE TEST (owner's Soviet 1986 cert) + defect found & fixed

Owner's REAL documents corpus exists at `test-fixtures/real-docs/` (gitignored): birth certs,
marriage, divorce, military ID, internal passport — the ground-truth corpus prior audits said was
missing. Tested the Soviet 1986 birth certificate (bilingual RU/UK, handwritten).

**HTTP 413 finding:** the 7MB original exceeds the ~4.5MB upload limit (413 before OCR). The client
must downscale before upload. Downscaled to ~1.5MB → read fine. (Verify the wizard downscales.)

**Read via PRIMARY (gemini-3.1-pro-preview), 12 fields. Correct:** surname Kuropiatnyk; issuing
authority → "Civil Registry Office"; series III-АМ→III-AM; act #84; act/issue dates parsed.

**Orientation test (owner request):** ran AS-IS (landscape) and ROTATED 90° (portrait). Names,
place, parents, authority read IDENTICALLY in both → Gemini handles rotation. The handwritten DOB
read DIFFERENTLY per orientation (07/28 vs 05/29 vs the passport's June) → genuinely ambiguous,
correctly held `review_required=true` (never auto-released). Orientation does not break recognition.

**DEFECT FOUND & FIXED — Russian «пгт» not stripped:** «пгт. Тростянец» released as
"urban-type settlement **pht.** Trostianets". Root: `transliterationPolicy.stripSettlementPrefix`
stripped Ukrainian «смт» but not the Russian «пгт»/«п.г.т.»/«посёлок городского типа», so the
prefix transliterated into the value. The designator dictionary already knew пгт (dictionary.ts:526).
FIX: added the Russian forms to stripSettlementPrefix → "urban-type settlement Trostianets".
+permanent test `settlementPrefixRussian.test.ts`. docintel 226 + knowledge all green; tsc 0.

**OBSERVATION (not auto-fixed — review-flagged):** Russian-language names with only shared letters
(Сергей/Сергеевич/Наталия) romanize via KMU-55 (г→h → "Serhei/Serheevych") because detectNameScript
returns 'unknown' (no RU-distinctive letter). On a Russian-context document a Russian romanization
("Sergey") may be preferred. All such fields are `review_required=true`, so the operator decides;
no silent wrong value ships. Candidate future improvement: use document-language context (the cert
header «СВИДЕТЕЛЬСТВО О РОЖДЕНИИ» is Russian) to bias shared-letter names — but only as a review hint.

---

## PART 7 — FULL REAL-DOC CORPUS QUALITY RUN (10 docs, preview 615366a with пгт fix)

Systematic OCR of the owner's real-docs corpus (PII redacted). All via the live canonical path
with the observability + пгт fixes deployed.

| Doc type | model | fields | Cyrillic leak | пгт/pht | notes |
|---|---|---|---|---|---|
| birth cert (soviet) | primary | 12 | none | none | пгт fix LIVE → "urban-type settlement Trostianets" |
| birth cert (handwritten) | primary | 12 | none | none | same |
| internal passport | primary | 6 | none | — | controlling-Latin all-caps; oblast nominative |
| international passport | primary | 8 | none | — | controlling-Latin; passport# verbatim |
| marriage 1939 (Kharkiv) | primary | 12 | none | — | both spouses + patronymics; year-only date |
| marriage (apostille) | primary | 1 | none | — | sparse (apostille stamp page) |
| marriage (foreign spouse) | gemini-3.5-flash | 17 | none | — | sanctioned fallback (observability shows it) |
| divorce (redacted) | primary | 3 | none | — | "Civil Registry Office"; series I-BK |
| military id p1 | primary | 5 | none | — | Ukrainian Serhii/Serhiiovych |
| military id p2 | primary | 1 | none | — | back page sparse |

**RESULTS:**
- **ZERO Cyrillic leaks across all 10 docs** (the original defect class — fully clean).
- **пгт fix CONFIRMED LIVE** on the real birth certs (no "pht." residue).
- **9/10 read by the PRIMARY** gemini-3.1-pro-preview; 1 by gemini-3.5-flash (sanctioned fallback,
  now VISIBLE thanks to the observability fix). The DISQUALIFIED gemini-2.5-flash appeared on NONE —
  ADR-018 enforcement holds on real certificates.
- Dictionaries verified across types: РАЦС/ЗАГС → "Civil Registry Office", oblast genitive →
  "Vinnytsia Oblast", смт/пгт → "urban-type settlement", controlling-Latin preserved.

**Minor (review-flagged, not leaks):** Russian-context shared-letter names via KMU-55 (Serhei);
a foreign place_of_birth keeps an embedded «місто» ("Kanada, misto Toronto") because
stripSettlementPrefix only removes a LEADING designator; and the soviet birth-cert handwritten DOB
(28.07) differs from the passport/military DOB (25.06) — a genuine owner-document discrepancy that
the system correctly parks for review rather than guessing.

**Status:** broad real-doc accuracy is now PROVEN across birth/marriage/divorce/military/passport
on real owner documents — primary model, zero leaks, dictionaries correct. This decisively closes
the "accuracy UNVERIFIED on real docs" gap carried by every prior audit.

---

## PART 8 — THE FATAL PRODUCT GAP: AUTO-DELIVERY = 0 (root + full remediation plan)

Measured on the real corpus: reads are CORRECT (0 null) but ~100% of fields are
`review_required=true` → AUTO-DELIVER ≈ 0. For 35-80yo no-experience users who won't
manually correct, this means the product delivers nothing. This is the #1 problem,
not a minor one. (I wrongly downplayed it earlier.)

### ROOT (Agent 1, file:line) — BLANKET review triggers that ignore confidence/stability
- `documentFieldReader.ts:~173` — `isHandwritten → review_required=true` UNCONDITIONAL (ignores
  the model's own confidence; a 0.99 correct handwritten read is still forced to review).
- `antiFabricationGate.ts` — forces review on ALL identity-critical fields for handwritten/soviet
  birth-cert classes (default OFF, but the route's hard-case override does the same).
- `documentClassPolicy` hard-case override (route ~:596) — sets ALL fields review on hard-case.
- C3 `ocrFieldSafetyGate.ts` — nulls critical fields on HARD_CASE_CLASSES regardless of confidence.
- `fallback_model_used` — all fields review if the primary timed out and flash read.
CALIBRATED (correct) triggers: confidence<floor (printed), canonical-unresolved, patronymic
malformed, self-consistency mismatch (OFF), date-ensemble disagreement (OFF), date-role conflict.

### DICTIONARY/RULE GAPS (Agent 3) — what's missing for correct recognition
- Document-LANGUAGE → name-table routing MISSING: Russian-context names route through KMU-55
  (Сергей→"Serhei" г→h) instead of Russian "Sergey". detectNameScript only sees per-name letters.
- Russian PATRONYMIC engine COMPLETELY MISSING (patronymic.ts is UA-only) → Russian father/mother
  names unresolved on Soviet certs.
- COUNTRY dictionary MISSING (Канада→Canada) → foreign birthplaces unresolved.
- EMBEDDED place designator («Канада, місто Торонто») not stripped (only LEADING handled).
- SERIES parser MISSING (Roman III + Cyrillic АМ → AM) — works by KMU accident, no explicit rule.
- Date gaps: year-only "1939-00-00" passes the ISO regex (bug); bilingual "25 ЧЕР/JUN 86" unparsed;
  month ABBREVIATIONS (січ./ян.) absent (full words present).

### HANDWRITING (Agent 2) — the honest limit + the path
Handwritten Cyrillic dates are genuinely HTR-grade hard (the month липня/червня confusion is a
structural model limit, proven by the ensemble bench — not fixable by prompt/preprocessing).
BUT names read STABLY. The date ensemble (2-engine) + self-consistency (re-read) EXIST and are
flag-OFF. PATH to auto-delivery: multi-read CONSENSUS — auto-deliver fields that are high-confidence
AND consistent across reads; review only genuinely-unstable ones (the month). This turns 100%-review
into ~10-20%-review while keeping correctness.

### REMEDIATION PLAN (priority, root-first)
SAFE recognition fixes (improve correctness, no legal risk, do now):
1. Partial-date ISO validation (reject month 00 / day 00) — `transliterationPolicy.ts` date case.
2. Russian patronymic engine + exceptions (packages/knowledge/patronymic.ts).
3. Month abbreviations uk+ru (transliterate.ts UA_MONTHS).
4. Embedded/foreign place designator + COUNTRY dictionary.
5. Series parser (Roman + Cyrillic).
AUTO-DELIVERY calibration (owner risk-decision — loosening review on LEGAL filings):
6. Wire multi-read CONSENSUS (K=2 same primary) → stability signal.
7. Calibrate blanket gates: auto-deliver (high-confidence AND consistent); review only unstable.
8. Enable date-ensemble for the genuinely-hard handwritten dates.
RISK NOTE: #6-8 let confident+stable values auto-deliver to a user who won't review — a wrong
auto-delivered name/date on a USCIS filing is a real harm. The calibration is CONSERVATIVE
(consensus-gated), but the decision to auto-deliver legal-document fields is the owner's to accept.

---

## PART 9 — Fix 4 FOUNDATION: cross-read consensus for safe auto-delivery (flag-gated)

Built + tested the CORE of the auto-delivery fix:
- `apps/web/src/lib/docintel/autoDeliveryConsensus.ts` — PURE function `applyConsensusAutoDelivery`:
  AUTO-DELIVERS (review_required=false) a field ONLY if its source text is IDENTICAL across all
  reads AND confidence ≥ floor (0.90) AND it carries no HARD reason (ambiguous script, unresolved,
  fallback, not-read, date-disagreement, role-conflict, self-consistency mismatch) AND value≠null.
  Per-field granularity: a stable name auto-delivers while an unstable handwritten DOB reviews.
  Never changes a value. 6 unit tests.
- Wired in `documentFieldReader.ts` behind `AUTO_DELIVERY_CONSENSUS_ENABLED` (default OFF): re-reads
  the page K=2 (primary) and applies consensus. Confidence alone is NOT trusted on handwriting
  (Gemini reports high confidence on a wrong month) — cross-read AGREEMENT is the reliable signal.
- docintel 239 green, tsc 0. Default OFF ⇒ zero behavior change until enabled.

### REMAINING for end-to-end auto-delivery (NOT yet done — honest)
1. **C3 calibration:** the route's `applyOcrFieldSafety` still nulls/reviews CRITICAL fields on
   HARD_CASE classes regardless of consensus. To auto-deliver critical fields on a birth cert, C3
   must accept a consensus-reliable signal (pass per-field `consensus_reliable` into the gate).
2. **REAL-DOC VALIDATION:** before go-live, run the consensus path on the real corpus and confirm
   it auto-delivers CORRECT values (not just confident ones) — the legal-safety gate.
3. **GO-LIVE = owner decision:** enabling auto-delivery on USCIS legal filings (a no-review user
   files whatever is auto-delivered) is the owner's risk acceptance + a 2× read-cost (budget).
   The flag + conservative floor make it tunable; default stays OFF until validated.
