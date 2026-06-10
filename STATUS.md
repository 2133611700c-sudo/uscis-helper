# STATUS (2026-06-10 — P0-A guard SHADOW mode (measurement-first); enforce = owner-flip)
- DECIDED (A/B data): no scanner-style greyscale/B&W preprocessing — it collapses handwritten Cyrillic (3/3→0/3); send original color. Geometric crop/deskew = future measured candidate only.
- Bench coverage 4/5 UA classes (+Soviet bilingual: same review-gated misread pattern). Finding B corrected: birth cert IS protected via always_review+route override (not the spec flag). Intl-passport GT MISSING (owner).
- Finding A fully closed: ALL 5 upload paths (translation/EAD/TPS×2/reparole) now downscale >3.8MB photos client-side via shared lib/upload/downscaleImage. No more 413 on large phone photos anywhere.
- FIXED bench finding A: translate wizard now downscales >3.8MB photos client-side before upload (was HTTP 413 at edge). Flagship only; reparole/ead/tps follow-up.
- GT pipeline bench run (live prod): printed Cyrillic reliable (military 4/4); handwritten partial but always-review holds. Findings: 413>4MB, birth-cert handwritten:false mislabel, sex-not-in-spec. EXPLORATORY (1/class).
- Debt closed: BUG C + BUG D tests (+10). NEW finding: RU-spelling guard misses composite full_names without ё/э/ы/ъ — pinned + flagged for owner.
- CI infra: bumped GitHub Actions to Node-24 majors (checkout v6 / setup-node v6 / cache v5 / pnpm-action-setup v6) — clears 2026-06-16 Node-20 deprecation.
- CI fix (content-guard): reworded a 'certified translation' comment in applyOcrFieldSafety.ts (Rule 4 product-claim). No logic change.

## P0-A hardening (2026-06-10, CODE — walked enforce back to shadow)
- **CORRECTION to 816cb64:** that commit shipped the confirmed-value guard ALWAYS-ON/enforcing straight to prod (auto-deploy) with zero block-rate data — a measurement-first violation. This commit reverts it to **SHADOW mode by default**: the guard validates + logs `would_block` but does NOT block → **prod output byte-identical**. Owner flips `CONFIRMED_VALUE_GUARD_MODE=enforce` AFTER reviewing shadow logs.
- ONE env knob, three modes (no flag sprawl): `shadow` (default) | `enforce` | `off` (emergency kill-switch, loudly logged). Collapsed the separate EMERGENCY_GUARD_BYPASS into `off`.
- `403 → 422` for the guard block (content invalid ≠ auth failure; verified frontend just alerts the error string, no breakage).
- PII-free structured log on every would_block/block: `{field, criticality, reason, doc_type}` — no values.
- Added `CERTIFIED_DOC_INCIDENT.md` runbook (kill-switch steps, interim refund policy, SEV levels).
- Contract additions: DeepSeek-never-writes-finalValue (C3 contract); P0-A.1-vs-P0-A.2 scoping (A.2 = MRZ anchor cross-check, NOT full gazetteer re-run); Tier-0≠legal-evidence warning (ADR-019); N<30-binding-in-runner-code (GT criteria).
- tsc 0; **3016 passed | 4 skipped | 0 failed**.

## P0 Design Lock + P0-A (2026-06-10, CODE + 5 contract docs)
- **P0-A output door (now SHADOW-default):** `generate-pdf` runs `validateConfirmedValue` on EVERY release value (not behind OCR_FIELD_SAFETY_ENABLED) — Cyrillic/control/over-length/bad-date in a certified English PDF is a legal defect. Fixed Agent-A keying bug (it keyed on a `confirmed` flag the client never sends; now keys on real release values).
- **classifyCriticality reconciled** to CRITICAL_FIELDS_CONTRACT: added validity DATES (issue/expiry/marriage), issuing_authority, ead_category/class_of_admission, nationality. Previously fell through to `optional` (real gap).
- **Observability (P1 start):** PII-free `[ADR018] fallback_model_used` log (ids+counts only).
- **5 design-lock contracts created:** CRITICAL_FIELDS_CONTRACT, C3_USER_CORRECTION_CONTRACT, PAYMENT_REFUND_LEGACY_GATE_CONTRACT, GT_BENCHMARK_EXIT_CRITERIA (docs/architecture/), ADR-019-audit-trail-persistence (docs/adr/).
- tsc 0; **3011 passed | 4 skipped | 0 failed** (+14: confirmedValueGuard tests).
- **OWNER DECISIONS PENDING (marked in docs):** refund/legacy policy, audit-trail PII tier+retention, manual-override path, GT sample sourcing (need docs from different real people), military rank criticality.
- **NOT done (owner-gated/blocked):** GT benchmark runner (Agent B hit spend limit), audit-trail persistence code (ADR only), canary (blocked on GT Tier-1 sample), Vision bbox ADR-020 (research gathered).

# STATUS (2026-06-10 — ADR-018 model matrix LOCKED: fallback-model reads of Cyrillic docs force review)

## ADR-018 Model Matrix DONE (2026-06-10, CODE + ADR)
- **ADR-018 created** (`docs/adr/ADR-018-model-matrix.md`): iron matrix — gemini-3.1-pro-preview = THE reader; flash = fallback-only; Vision = technical eye; DeepSeek = prose + sanitized TPS text-structuring (never sees image, final_value always overwritten from source); D2/C3/validators/PDF = code, no AI.
- **Safety gap CLOSED:** provider chain silently fell back pro→flash on timeout/5xx — gemini-2.5-flash is DISQUALIFIED on certificate docs (read a different person, 2026-06-02). Now: `documentFieldReader.ts` forces `review_required=true` + `fallback_model_used` on EVERY field when `spec.script !== 'latin'` AND `read.model !== primaryGeminiModel()`. Deterministic, no flag.
- Latin US forms (us_ead/us_i94/us_i797) exempt — flash never disqualified on Latin print.
- `primaryGeminiModel()` exported from geminiVisionProvider.
- New tests: `fallbackModelReview.test.ts` (5). Three existing test mocks updated to report primary model.
- tsc 0; **2997 passed | 4 skipped | 0 failed** (was 2992, +5).

# STATUS (2026-06-10 — housekeeping: Vercel dead flags removed, branches cleaned, 0 open PRs)

## Housekeeping DONE (2026-06-10)
- 7 dead Vercel prod env flags removed: ONE_BRAIN_CORE_ENABLED, ONE_CORE_TPS_ENABLED, ONE_CORE_REPAROLE_ENABLED (+NEXT_PUBLIC), ONE_CORE_EAD_ENABLED (+NEXT_PUBLIC), CENTRAL_BRAIN_TRANSLATION.
- 68 stale local git branches deleted. Only `main` remains.
- All GitHub PRs closed (0 open). Canary docs applied to main.

# STATUS (2026-06-10 — payment ordering bug FIXED in generate-pdf/route.ts)

## Payment ordering bug FIXED (2026-06-10)
- **Bug:** Stripe charge (402) fired before review gate (403) — user could be charged for blocked PDF.
- **Fix:** Pre-payment 400 `fields_require_review` check inserted before Stripe block in `generate-pdf/route.ts`.
- **Applies to:** all users (owner included — certification is legal not financial).
- **tsc:** 0 errors. Tests: 2992 passed | 4 skipped | 0 failed.
- **Prod:** deployed via Vercel on push to main.

# STATUS (2026-06-10 — PR cleanup done; Phase 3 DONE: CanonicalField.finalValue + C3 as only writer)

## Phase 3 DONE (2026-06-09, CODE — CanonicalField.finalValue + C3 as only writer)
- **finalValue added to CanonicalField** (`apps/web/src/lib/canonical/types.ts`): `undefined` = C3 not run, `null` = rejected, `string` = accepted.
- **C3 is now the only writer** (`applyOcrFieldSafety.ts`): accept path sets `finalValue=string`, reject/block path sets `finalValue=null`.
- **3 adapters updated** (finalValue-first pattern, backward compat):
  - `translationAdapter.ts` (`canonicalToFieldOut`): `finalValue !== undefined ? finalValue : normalizedValue ?? rawValue`
  - `tpsAdapter.ts` (`canonicalFieldToTpsField`): same pattern for `normalized_value`
  - `eadAdapter.ts` (`getValue` helper): same pattern
- **pdf.ts updated** (`planTranslationRows`): `final_value !== undefined ? final_value : normalized_value`
- **D2 verified**: does NOT write `CanonicalField.finalValue` — writes `normalizedValue` only (D2's DECISION struct's internal `finalValue` is a different concept).
- **Tests:** 2992 passed | 4 skipped | 0 failed (18 new Phase 3 contract tests).
- **tsc:** 0 errors.
- **Backward compat:** flag OFF → `finalValue=undefined` → all adapters fall back to `normalizedValue` → byte-identical to Phase 2.
- **Prod untouched.** No env changes. `OCR_FIELD_SAFETY_ENABLED` stays OFF in prod.
- **Payment ordering bug noted** (review gate 403 fires after payment gate 402 in `generate-pdf/route.ts`) — separate issue, not fixed here.
- **Proof:** `docs/reports/PHASE_3_FINAL_VALUE_C3_WRITER_PROOF.md`
- **Next:** Owner choice — enable `OCR_FIELD_SAFETY_ENABLED` canary OR PR cleanup (dead env flags) first.

# STATUS (2026-06-10 — PASS_PROD_MODEL_SMOKE: prod on gemini-3.1-pro-preview, Phase 3 UNBLOCKED)

## PROD MODEL FLIP + SMOKE: PASS (2026-06-10)
- **GEMINI_MODEL flipped:** removed dirty `"gemini-2.5-flash\n"` → set clean `gemini-3.1-pro-preview` (no embedded \n).
- **Redeploy:** Vercel build OK, SHA `203b572` (main is current), aliased `messenginfo.com`.
- **Healthz:** `{"status":"ok","sha":"203b572","environment":"production"}` — OK.
- **Model smoke (live Gemini call):** `model: gemini-3.1-pro-preview` confirmed in `/api/translation/vision-extract` response at 4554ms. No 5xx, no timeout, no fallback to flash.
- **Result: PASS_PROD_MODEL_SMOKE.** Phase 3 is UNBLOCKED.
- Report: `docs/reports/PROD_GEMINI_MODEL_FLIP_SMOKE_2026-06-10.md`

## PR-F DONE (2026-06-10, CODE — Core read timeouts raised for pro-model)
- readDocument `timeoutMs` 20s→40s in all 4 product routes; reparole/EAD `maxDuration` 30→60.
- Reason: PR104 audit timeout_status CONFLICT — pro observed 28s, 20s cap silently degraded pro→flash.
- Unblocks owner action: flip prod `GEMINI_MODEL` → `gemini-3.1-pro-preview` (clean value, no \n). **DONE.**

## Phase 2.2–2.6 DONE (2026-06-09, CODE — All One-Core flag gates removed, GPT deleted)
- **Phase 2.2:** TPS OCR (`apps/web/src/app/api/tps/ocr/extract/route.ts`) — `ONE_BRAIN_CORE_ENABLED` flag gate removed. Core B1 is now the unconditional default for UA identity docs.
- **Phase 2.2a:** documentRegistry (`apps/web/src/lib/docintel/documentRegistry.ts`) — added `us_ead`, `us_i94`, `us_i797` specs with `script: 'latin'` (EAD route can now look up these doc types).
- **Phase 2.3:** ReParole OCR (`apps/web/src/app/api/reparole/ocr/extract/route.ts`) — `ONE_CORE_REPAROLE_ENABLED` server-side flag gate removed. Route always runs Core.
- **Phase 2.4:** EAD OCR (`apps/web/src/app/api/ead/ocr/extract/route.ts`) — `ONE_CORE_EAD_ENABLED` server-side flag gate removed. Route always runs Core.
- **Phase 2.5:** `/api/ocr/extract` — no live callers confirmed; DeepSeek text-parse path retained per ADR-017.
- **Phase 2.6:** `attemptOpenAIVision` (gpt-4o-mini) removed from `/api/ocr/extract`; `openaiReader` (gpt-4o) removed from `lib/engine/models.ts`. GPT fully gone per ADR-017.
- **Wizard cleanup:** `ReparoleWizardV2.tsx` — `REPAROLE_CORE_ENABLED` constant removed; `useCoreRoute = CORE_COVERED_SLOTS.has(id)` (always Core for passport/booklet). `EADWizard.tsx` — `EAD_CORE_ENABLED` constant removed; upload step always present (8-step flow).
- Tests: 2974 passed | 4 skipped | 0 failed. tsc: 0 errors.
- Prod untouched. All One-Core flags were already ON in prod; behavior unchanged.
- **Next: Phase 3 — explicit `final_value` + C3 as single writer. Or KNOWLEDGE_BRAIN_ENABLED canary (owner GT-gated).**

## Phase 2.1 DONE (2026-06-09, CODE — Translation Core unconditional)
- `ONE_BRAIN_CORE_ENABLED` flag gate removed from Translation vision-extract route. Core B2 is now the unconditional default.
- Dead `CENTRAL_BRAIN_TRANSLATION` consensus block (~40 lines) removed. Dead imports removed (`analyze`, `deepseekProseTranslator`, `DOC_TYPES`).
- `degradedFromBrain` variable and all ternaries removed. Response `status`: Core = `ok:core-b2`; legacy fallback = `ok:legacy-reader`.
- Legacy reader (with preprocessing) stays as fallback for Core errors / 0 fields.
- tsc 0; 2975/4 (0 regressions). Prod untouched (ONE_BRAIN_CORE_ENABLED=1 was already ON in prod → behavior unchanged).
- Phase 2.0b: `gemini-2.0-flash` was already removed from fallback chain in a prior session. Only appears in comments.
- **Next: Phase 2.2 — TPS → Core default for UA-identity docs (booklet/birth/military).**

## Phase 2.1a DONE (2026-06-09, CODE — Translator hard-case unbypass)
- **Translator birth/marriage** (`auto:false`, incident RC-1 STILL TRUE in prod) now route through vision-extract + review gate when `NEXT_PUBLIC_HARD_CASE_AUTOREAD_ENABLED=1` (default OFF).
- Flag OFF: byte-identical to current behaviour. No vision call, no gate, manual specialist path unchanged.
- Flag ON + 0 fields: falls through to manual (no gate breakage — hardCaseHasFields=false).
- Flag ON + fields: `hardCaseHasFields=true → needsReviewGate=true` → all fields review_required, payment blocked until all confirmed.
- `autoread?: boolean` on DocTypeMeta (separate from `auto`, does NOT change `auto:false`). `hardCaseHasFields` state cleared on `resetAll`.
- Files: `TranslateWizard.tsx`; new test `hardCaseAutoread.test.ts` (14 pure-logic tests).
- tsc 0; full suite 2975/4 (was 2961, +14 new, 0 regressions). Prod untouched. No PII. Branch feat/one-brain-gemini-core (PR #104).
- **Next code step: Phase 2.0b — remove deprecated `gemini-2.0-flash` (HTTP 404) from geminiVisionProvider fallback chain.**

## Phase 2.0 DONE (2026-06-09, CODE — rawCyrillic threaded + D2 sees Cyrillic + 4 bug fixes)
- **GAP A FIXED:** rawCyrillic now threads ExtractedDocField → FieldCandidate.rawCyrillic → CanonicalField.rawCyrillic. `docintelToCandidate` sets `rawCyrillic: f.raw_cyrillic`. `canonicalToFieldOut` prefers `f.rawCyrillic` over cyrillicMap.
- **GAP B FIXED:** `applyKnowledge()` feeds D2 with `f.rawCyrillic ?? f.normalizedValue ?? f.rawValue`. D2 Cyrillic rules (gazetteer, RU/UA spelling, normalizeName, patronymicReconcile) now fire on ORIGINAL Cyrillic text. Phase 1 `knowledgeBrain` at arbitration now receives Cyrillic and is effectively at the right level.
- **Bug A FIXED:** ISO YYYY-MM-DD dates accepted without false review (`date.iso_to_uscis`); already-USCIS MM/DD/YYYY pass-through.
- **Bug B FIXED:** `sourceBasis` in `KnowledgeNormalizeCtx` distinguishes MRZ/EAD/I-94 controlling Latin (evidence 0.99) from derived KMU-55 Latin (0.6).
- **Bug C FIXED:** `documentFieldReader.ts` emits review field (`canonical_value_unresolved`) instead of silent drop when `toCanonicalValue()` returns null but `r.cyrillic` non-empty.
- tsc 0; full suite 2961/4 (was 2937; +24 new tests, 0 regressions). Proof: PHASE_2_0_CYRILLIC_D2_DOOR_PROOF.md.
- **Prod untouched. KNOWLEDGE_BRAIN_ENABLED default OFF. cyrillicMap kept as fallback. No PII.**
- GAP C (flag consolidation SMART_NORMALIZE vs KNOWLEDGE_BRAIN → ONE flag) = Phase 2.0b (future).
- GAP D (explicit final_value + C3 single writer) = Phase 3 (future).
- **Next code step: Phase 2.1a — Translator hard-case unbypass (auto:false → Core + review + C3).**


## ⚠️ SELF-CHECK CORRECTION (2026-06-09, agent): Core flags ARE present in prod
- My earlier claim "Gemini-Core is parked behind flags nobody flips / Knowledge canary is a no-op until Phase 2" was **WRONG** — my `vercel env ls` grep pattern missed `ONE_CORE_*`. Full check: **ONE_BRAIN_CORE_ENABLED, ONE_CORE_TPS_ENABLED, ONE_CORE_REPAROLE_ENABLED, ONE_CORE_EAD_ENABLED (+NEXT_PUBLIC twins), CENTRAL_BRAIN_TRANSLATION, DOCAI_ENABLED are ALL PRESENT in prod** (values unverified by `ls`; P2 checkpoint 06-03 records owner-verified ON). ⇒ the Core arbitration path is LIVE for all 4 products; `KNOWLEDGE_BRAIN_ENABLED=1` in prod would fire IMMEDIATELY on live traffic (not a no-op). Phase 2 reframed: not "flip Core on" but "harden the already-live Core + retire legacy fallbacks". Extra care on any dictionary flag.
- Also confirmed (self-check): `convertDateToUSCIS` does NOT accept ISO `yyyy-mm-dd` → my Phase-1 D2 date rule flags correctly-read ISO dates as `date_unparsed` (false review noise — fix in 2.0); my "preserve Latin" rule wrongly treats derived KMU-55 Latin as controlling Latin (controlling must be SOURCE-based: mrz/ead/i94 — not script-based); `documentFieldReader.ts:71` silently DROPS a field when `toCanonicalValue` returns null (read-but-unparseable fields vanish with their raw_cyrillic — violates candidate≠final spirit; fix in 2.0).

## ARCHITECTURE DECISION ADR-017 + Phase 1 brick #1 (2026-06-09)
- Owner mandate: recognition via Gemini (all keys/models); DeepSeek retained fully; GPT removed; HTR parked; "сделай как должно быть". Decided (ADR-017): core = ONE Gemini brain + deterministic knowledge truth + review gate, NOT multi-reader consensus (consensus fixes none of the incident root causes; with GPT out + HTR dead it is a committee of one). Plan: docs/reports/ONE_BRAIN_GEMINI_BUILD_PLAN.md.
- **Phase 1.1+1.2 DONE (code):** `knowledgeNormalize.ts` rebuilt per AI-risk review as a D2 **authority layer** (NOT auto-replace): returns a DECISION {action accept/preserve/suggest/review/block, finalValue, candidateValue, ruleId, reasonCodes, provenance}. `arbitrateDocument(candidates, knowledge?)` applies it — accept/preserve→final; **conflict (suggest/review/block)→keep read value + suggestedValue + review, never silent override**. Flag `KNOWLEDGE_BRAIN_ENABLED` (default OFF → byte-identical, proven by canonical suite 329). 12 conflict-case tests (Russian-on-UA→review, clean UA→accept, gazetteer exact→accept/fuzzy→suggest, patronymic fragment→review, MRZ→preserve, unknown authority→review). tsc 0; full suite 2931/4. ADR-017 §D2 contract added.
- **Phase 1.3 DONE (code):** ONE shared helper `canonical/core/knowledgeBrain.ts` (isKnowledgeBrainEnabled / buildKnowledgeContext / applyKnowledgeBrainIfEnabled) — wired translation/tps/reparole/ead at the arbitration seam (1-line diff each, no route-local dictionary logic, no four forks). OFF deep-equals bare arbitration; ON=conflict→review. 18 helper/normalize tests; full suite 2937/4; tsc 0. Legacy /api/ocr/extract + generate-pdf are NOT arbitration seams (no D2 fork). Proof: docs/reports/KNOWLEDGE_BRAIN_PHASE_1_3_WIRING_PROOF.md.
- **BINDING CONTRACT recorded (ADR-017, owner-approved 2026-06-09) → Phase 2 unblocked.** D2 annotates only (never writes final_value); **C3 is the single writer of `final_value`** (accept_final→final_value=normalized_value, else null; D5 confirmation re-runs C3); **D6/PDF reads only final_value**, critical null→block; one criticality taxonomy for D2+C3; adapters must not drop suggested/rule_id/provenance/reason_codes/evidence_strength/review_required. Primary risk now = downstream bypass; defense = final_value=null until C3/confirmation. Phase order: 1.4 fixtures → 2 Core-default (one product at a time) → 3 explicit final_value + C3 final writer → 4 Knowledge canary (after Core-default) → ReaderResult/crop later.
- **Phase 1.4 DONE (real-doc proof, flag ON, real Gemini).** Safety holds on real Soviet + handwritten birth certs: D2 provenance on every field, conflict→review+suggestedValue (patronymic.fragment / authority.unknown), no silent override, no Cyrillic leaks. **FINDING:** D2's Cyrillic rules (gazetteer / RU-spelling / normalizeName) are bypassed live — docintel KMU-55-transliterates to Latin BEFORE arbitration (Cyrillic in a separate cyrillicMap; FieldCandidate has no rawCyrillic). Safe but accuracy value not yet delivered. → Phase 2.0 prerequisite: thread rawCyrillic to D2.
- **KNOWLEDGE INVENTORY + AUDIT SYNTHESIS DONE (2026-06-09)** — read live data inventory + 4 prior audits. TWO critical findings: (1) a dictionary-in-path layer ALREADY exists at the RIGHT place (raw Cyrillic) — `SMART_NORMALIZE_ENABLED` P2.1-P2.3 (Door A toCanonicalValue→snapCity; Door B documentFieldReader patronymic/authority). My Phase-1 knowledgeBrain at arbitration is at the WRONG layer (post-KMU-55 Latin) and DUPLICATES it → Phase 2.0 reframed as RECONCILE-to-one-layer (keep my KnowledgeDecision contract, apply at Door A/B, retire arbitration duplication). (2) Dominant real failure = `wrong_person_selected` (model reads a DIFFERENT identity; 2.5-pro false-confidence) — NOT a dictionary problem; defended by always-review policy + model choice + reshoot. Coverage: gazetteer/settlements = SEED (35/458 vs ~28-30k). Bug: deprecated gemini-2.0-flash (404) in fallback chain. HARD GATE: any dict layer in prod FORBIDDEN until owner GT + OFF/ON delta. Report: docs/reports/KNOWLEDGE_INVENTORY_AUDIT_SYNTHESIS_2026-06-09.md.
- **CYRILLIC CONSTITUTION assembled (docs/architecture/ONE_BRAIN_CYRILLIC_CONSTITUTION.md)** — owner's iron constitution mapped node-by-node to real code. Traced the Cyrillic highway: Gemini reads `VisionFieldRead.cyrillic`; `documentFieldReader.ts:70` runs `toCanonicalValue` IN the read loop → `value`=KMU-55 Latin + `raw_cyrillic` kept alongside (`:76`); `docintelToCandidate` (translationAdapter:50) DROPS raw_cyrillic (FieldCandidate.value=Latin; Cyrillic only in a side cyrillicMap for display). GAP A = raw_cyrillic dropped from Core record; GAP B = D2 partial at toCanonicalValue (city/oblast on Cyrillic) but name=bare KMU-55 no RU/UA check; GAP C = 3 D2 sites/2 flags (Door A toCanonicalValue + Door B documentFieldReader post-pass SMART_NORMALIZE + my arbitration knowledgeBrain); GAP D = no final_value, C3 post-adapter on Latin. documentFieldReader IS the one shared door (all 4 products).
- Realization: D2=ONE layer at the one door on raw_cyrillic (upgrade toCanonicalValue+Door B to KnowledgeDecision, retire arbitration dup, one flag); carry rawCyrillic+decision FORWARD into FieldCandidate/CanonicalField; final_value + C3 single writer; PDF reads final_value only.
- **PRODUCT READINESS COMPARISON done (docs/reports/PRODUCT_READINESS_COMPARISON_2026-06-09.md):** 4 products = 4 stages of one migration. Pipeline alignment to Constitution: Reparole 85% (reference: Gemini-Core+MRZ, no ungated fallback) > EAD 80% (cleanest arch, but US-doc registry specs UNPROVEN + no scorable fixtures, thinnest UX) > Translator 60% (3 branches) > TPS 40% (default = Vision/DocAI + rule modules; Gemini only passport/booklet). **FLAGSHIP PARADOX: Translator birth/marriage are `auto:false` → vision-extract NEVER called → manual ticket (incident RC-1, STILL TRUE)** — the most polished product is worst on exactly the docs where Cyrillic matters; the now-proven safety stack makes auto-read safe → added Phase 2.1a (unbypass). TPS convergence narrowed to UA-docs only (keep deterministic US-form modules). Added 2.2a EAD registry proof.
- Next: Phase 2.0 reconcile D2 to the one door on raw_cyrillic + carry forward; then 2.1a flagship unbypass. Branch feat/one-brain-gemini-core (PR #104). No prod/keys/PII change.

## P0 FIX: vision-extract 502 root-caused + fixed (the original "0 results" incident)
- RUNTIME PROOF (preview): ead no-fields probe → HTTP 200 (was 502 on prod); blank birth-cert → 200 all-review, no fabrication. PR #99.
- Root cause: route returned HTTP 502 whenever it recognized ZERO fields (final return `status: ok ? 200 : 502`). NOT a crash/timeout/provider issue — direct-origin probe returned the full valid JSON body with a 502 status; Cloudflare masked it as "error code: 502". Affects real hard-case docs that read 0 fields. Fix: return 200 with ok:false+status+error+review_required (matches the route's other non-fatal returns). tsc 0; suite 2919/4. See docs/reports/VISION_EXTRACT_502_TRIAGE_2026-06-06.md.
- C3 merged but canary BLOCKED by this 502 (now fixed, PR open). OCR_FIELD_SAFETY_ENABLED remains OFF. Re-run canary only AFTER this fix merges. ReaderResult/OneBrain HOLD.

## OCR field-safety canary = DEGRADED (rolled back); pre-existing vision-extract 502 found
- Canary run 2026-06-06: enabled OCR_FIELD_SAFETY_ENABLED=1 + redeploy → route proof blocked by a 502 on the Translation model-read path. 502 REPRODUCES with flag OFF (two redeploys, commit 0d3d82b) → pre-existing, flag-independent; the safety gate never ran. Rolled back to OFF (proven-safe baseline). See docs/reports/OCR_FIELD_SAFETY_CANARY_RESULT.md.
- prod==main==0d3d82b, healthz ok, flag ABSENT/OFF. NEW finding (out of C3 scope, NOT proven for real uploads): vision-extract returns 502 on synthetic gate-reaching requests — needs separate triage. C3 stays code-ready/prod OFF. D0/ReaderResult/OneBrain HOLD until a real-document canary is clean.

## C3 MERGED to main — global OCR field safety code-ready; canary = owner
- Stack #94→#95→#96 MERGED (origin/main 0d3d82b). Guard wired into all 4 flows behind `OCR_FIELD_SAFETY_ENABLED` (ABSENT/OFF in prod — verified vercel env ls). tsc 0; full suite 2913. Flag-ON proof: docs/reports/C3_OCR_FIELD_SAFETY_PROOF.md. Canary runbook: docs/reports/OCR_FIELD_SAFETY_CANARY_RUNBOOK.md.
- Prod deploy of 0d3d82b catching up through the 3 stacked merges (flag OFF = byte-identical). D0/ReaderResult/OneBrain HELD until owner canary. No model/provider/prod-env change.

## C3 wiring COMPLETE — guard wired into all 4 flows behind OFF flag
- `OCR_FIELD_SAFETY_ENABLED` (default OFF). Wired: Translation public (vision-extract), TPS merge (tps/ocr/extract), legacy boundary (/api/ocr/extract), PDF/payment (generate-pdf via hasUnresolvedCriticalForOutput).
- candidate≠final enforced; zero-recognition≠success; unsafe critical → candidate-only+review/manual; PDF blocks unresolved critical. tsc 0; documentSafety 28 tests; full suite 2913 passed (incl. flag-ON proof). OFF=byte-identical. Prod flag NOT enabled; D0/ReaderResult/OneBrain HELD.

## ✅ Containment guard built (ocrFieldSafetyGate) — pure, tested, NOT yet wired
- `lib/documentSafety/ocrFieldSafetyGate.ts`: one global guard, PII-free by construction (no value in/out),
  enforces the 10-rule contract (candidate≠final; zero-recognition≠success; source/stale/hard-case/legacy/low-conf
  → not final). + `hasUnresolvedCriticalForOutput` (shared PDF/payment gate). tsc 0; 18 guard tests; full suite
  2893 passed. Pure/unwired → prod byte-identical. **Next: wire into Translation/TPS/legacy/PDF behind
  `OCR_FIELD_SAFETY_ENABLED` (default OFF), per-flow + tests.** D0/ReaderResult/OneBrain still HELD.
<!-- P0 docs PII-scrubbed: incident identity values replaced by placeholders -->

## ⛔ Global OCR / Recognition = INCIDENT / NOT TRUSTED (2026-06-06)
Owner uploaded a birth cert → translator gave **0 results**; TPS showed a wrong/flagged patronymic (a truncated patronymic suffix)
+ many blank fields. Prior narrow PASS verdicts were per-endpoint, NOT global. **All next brain layers FROZEN**
(D0 prod / ReaderResult / OneBrain / HTR / 2nd provider / SMART / model work).
**P0 forensic audit COMPLETE (docs-only, no code changed):**
- `docs/reports/P0_OCR_FLOW_INVENTORY.md` — 6 reader paths, 4 safety regimes (Gemini-gated / DeepSeek-ungated /
  TPS-legacy-modules-ungated / gpt-4o-mini-ungated).
- `docs/reports/P0_FIELD_LIFECYCLE_MAP.md` — per-field origin/flag/final/PDF trace; where safety is lost.
- `docs/reports/P0_ROOT_CAUSE_ANALYSIS.md` — RC-1 birth `auto:false`→0 results; RC-2 wrong value shown AS value
  (candidate≠final not enforced — "a truncated patronymic"); RC-3 six paths/four regimes; RC-4 TPS multi-doc; RC-5 core→legacy fallback ungated.
- `docs/architecture/GLOBAL_OCR_FIELD_SAFETY_CONTRACT.md` — 10 binding rules.
- `docs/reports/P0_OCR_SAFETY_TEST_PLAN.md` — RED-first regression tests.
Ruled out: NOT my D0 (flag absent in prod), NOT the gates (keep values), NOT a crash (0 errors), NOT Supabase.
**Next phase:** adopt the contract → build shared `ocrFieldSafetyGate` + RED tests → only then resume D0/ReaderResult/OneBrain.

# STATUS (2026-06-05 — honest, no overclaiming)

## D0 quality/reshoot — IMPLEMENTED behind flag OFF (first real brick)
- `lib/docintel/quality/documentImageQuality.ts`: image metrics → ACCEPT / DEGRADED_REVIEW / RESHOOT_REQUIRED
  + reshoot messages. Flag `QUALITY_GATE_ENABLED` default OFF → prod byte-identical. Inert hook in translation
  vision-extract route. Blur is NEVER a fabrication signal. tsc 0; D0 16 tests; full suite 2875 passed.
- NOT enabled in prod. Next (Gate 2) = ReaderResult interface. Enabling D0 in prod = separate owner decision.

## Agent rails in place (operating contract + phase gates + D0 start pack)
- Refined: Gemini-first guardrails hardened — "Gemini-first ≠ fan-out", "HTR research ≠ implementation",
  and a Gemini top-version benchmark must precede ANY non-Gemini provider discussion.
- `docs/architecture/AGENT_OPERATING_CONTRACT.md` = the law (live vs target, autonomy boundaries, evidence
  contract, phase-gate order). `docs/reports/RECOGNITION_PHASE_GATES_CHECKLIST.md` = Gates 0–6.
- Next CODE step = D0 quality/reshoot (`docs/reports/NEXT_PROMPT_B_D0_QUALITY_RESHOOT.md`), flag default OFF,
  ONLY after clean 24–48h monitor + owner "start D0". HTR/2nd provider/OneBrain stay gated.

## Reader strategy = GEMINI-FIRST (locked 2026-06-05)
- Near-term reader work stays within the Gemini family (top versions/benchmarks). A second reader = a
  provider-agnostic DISABLED slot — GPT-4o/Claude NOT near-term; HTR research-only. No fan-out until ROI proven.
  All gated on GT breadth from different people + owner decision. (Roadmap docs corrected via follow-up PR.)

## Recognition structure roadmap accepted (docs-only; build = next, phased)
- Truth map + target D0–D6 + 10-phase build plan + 5 next-prompts written (see CHANGELOG / OWNER_QUEUE).
- Order: monitoring closeout → D0 quality → ReaderResult contract → OneBrain shadow → D2/D3/D4 → Auditor;
  HTR/GPT-4o research only AFTER GT from different people. Still a safety wrapper, NOT a full brain.

## Wave D monitoring ACTIVE (PASS_RUNTIME_VERIFIED reached; PR #86 merged)
- Read-only healthz workflow `.github/workflows/prod-safety-monitor.yml` (every 6h, no secrets, self-no-ops
  after 2026-06-07 — delete after window) + manual runbook `docs/reports/PROD_SAFETY_MONITORING_24H_RUNBOOK.md`.
- Watch 24–48h: 5xx, document_class_metric count, review_rate (incl. printed-birth-cert false positives),
  self-consistency latency/cost, UI/PDF block. Rollback: SELF_CONSISTENCY first, keep ANTI_FAB (owner-confirm).
- No new architecture (HTR/OneBrain/GPT-4o/SMART/L2-WIRE parked). Next real unblock = GT from different people.

## Translation hardening — NOW IN PROD (verified 2026-06-05 01:43)

- ✅ **Live in prod**: PR #84 merged; `origin/main` = `2d2a391`; review-gate commit `e298d97` is an ancestor
  of main; prod `healthz` sha = `2d2a391` == main. The fix that was "local only" last entry IS now deployed.
- (history) Public Translation Wizard false-readiness gap CLOSED:
  - OCR `review_required` fields now block payment and PDF download
  - user can explicitly confirm unchanged flagged OCR values
  - `/api/translation/generate-pdf` now rejects unresolved OCR review fields from the legacy public wizard payload
- Local proof:
  - Typecheck PASS
  - Vitest PASS
  - Build PASS
  - Live local browser run on `/en/services/translate-document/start` with real booklet fixture:
    - `reviewBadgesBefore=4`
    - `confirmButtonsBefore=4`
    - `payDisabledBefore=true`
    - `reviewBadgesAfter=0`
    - `confirmButtonsAfter=0`
    - `payDisabledAfter=false`
- Evidence: `docs/reports/TRANSLATION_REVIEW_HARDENING_2026-06-04.md`
- Independent re-verify (agent, raw): tsc 0 errors; full suite **2859 passed / 4 skipped** (matches claim);
  server gate logic + wizard block + tests read and correct. Build NOT re-run by agent (tsc+suite = proxy).

## Production Safety Gates — PASS_RUNTIME_VERIFIED (2026-06-05, prod==main==7c6068c)

| Gate | Env (prod) | Firing proven | Evidence |
|------|-----|-----------------|----------|
| ANTI_FABRICATION_GATE | **present** (`vercel env ls`, set 2h ago) | **YES — prod + local agree** | owner prod-HTTP: 8/10 review=true, ALL identity protected (corroborated by logs, 0 errors); agent local real-model: 5/5 identity forced, reasons attached, values unchanged. Field-for-field match. |
| SELF_CONSISTENCY_GATE | **present** (set 1h ago) | **YES (runtime, local real-model)** | `self_consistency=mismatch` (2 reads disagreed on identity) → forced review. |
| DOCUMENT_CLASS_METRICS | **present — RUNTIME VERIFIED =1** | **YES** | multiple `[document_class_metric]` on real prod `POST /vision-extract` 200 (01:01–01:03, 02:01–02:02) |
| (extraction path) | — | **HEALTHY** | all vision-extract / tps-ocr 200; **0 error/fatal**. No regression. |
| SMART_NORMALIZE | **absent** | N/A | DO_NOT_ENABLE ✅ |

> Gate firing is now **prod-runtime-observed** (owner's controlled hard-case upload) AND independently
> reproduced by the agent's local real-model proof — the two agree field-for-field. Remaining honesty note:
> env `ls` shows presence not the literal `=1` value (metric proves its own flag `=1`; the two gate flags are
> presence + set-time + the observed firing). This is a **safety wrapper working in prod**, NOT a full OneBrain.
> Full report: `docs/reports/POST_RUNTIME_GATE_VERIFICATION.md`. **Next: monitor 24–48h.**

## What is NOT live (do not claim otherwise)

- HTR: dead (auth 401)
- GPT-4o second reader: code exists, not in live path
- consensus.ts: dormant (gated by ONE_BRAIN_CORE)
- OneBrain/decideField: PARKED, 0 callers
- Quality signal to readDocument: not threaded

## Accuracy (measured, owner GT, N=6/1 person)

- Printed: 60-83% (live-door-scorable fields only)
- Hard-case: 25% (1/4 identity). Model Russianizes Ukrainian.
- false_negative_review mode C = 0

## Decisions (ADR-016)

- Hard-case UA = human review by policy
- PII = internal-only forever (CLOSED)
- OneBrain = PARKED until GT≥50

## Next owner action

ONE CONTROLLED UPLOAD of a hard-case document through messenginfo.com UI.
This is the ONLY way to change status from ENABLED_BY_ENV to RUNTIME_VERIFIED.

## 2026-06-04 — TARGET SCHEME FILE VERIFICATION

- Report added: `docs/reports/TARGET_RECOGNITION_SCHEME_FILE_VERIFICATION_2026-06-04.md`
- Verified file-by-file against the requested D0..D6 + Auditor scheme.
- Verdict: the scheme exists as documentation and as parked `engine/*` / `central-brain/*` code, but the live product spine is still `docintel/documentFieldReader.ts` + `geminiVisionProvider.ts` + `canonical/core/arbitration.ts`.
- Confirmed mismatch to the exact target:
  - `consensus.ts` exists but is not the live default Chief Engineer.
  - `models.ts` contains Gemini/GPT-4o/Vision readers, but not as the active multi-reader production fanout.
  - `htr.ts` exists, but HTR is not proven live and not the active reader path.
  - D0 preprocess is real, but it does not cut documents into line crops as claimed in the target scheme.
  - D2 KMU-55 is live; gazetteer/patronymic are real but partly flag-sensitive, not universally "inside the brain by default".
- Current truth:
  - target scheme documented = PASS
  - most building blocks present in repo = PASS
  - project already matches the exact target scheme in live runtime = FAIL

## 2026-06-04 — LATEST AUDIT / INVENTORY RECONCILIATION

- Report added: `docs/reports/LATEST_AUDIT_INVENTORY_RECONCILIATION_2026-06-04.md`
- Verified latest report layer against current code.
- Current trustworthy layer:
  - `TARGET_RECOGNITION_SCHEME_FILE_VERIFICATION_2026-06-04.md`
  - `ARCHITECTURE_INVENTORY_VERDICT.md`
  - `BASELINE_MATRIX.md`
  - `GT_ACCURACY_VERIFICATION.md`
  - `ACCURACY_OFFON_RESULTS.md`
  - `LIVE_DOOR_SCORABLE_COVERAGE.md`
  - `RECOGNITION_ROADMAP_FROM_CURRENT_TO_TARGET.md`
- Partially stale snapshots:
  - `PROJECT_ARCHITECTURE_VERDICT.md`
  - `DOCUMENT_CLASS_EXTRACTION_MATRIX.md`
  - parts of `KNOWLEDGE_CORE_INVENTORY.md`
- Strongest stale point confirmed by code:
  - older reports saying `ua_military_id` is absent are now false; registry entry exists in `docintel/documentRegistry.ts`
- Reconfirmed live truth:
  - default runtime spine is still `readDocument()` -> Gemini provider -> arbitration/gates
  - exact target multi-reader consensus runtime is still not live

## 2026-06-04 — CRITICAL LIVE-DOOR RE-VERIFY

- Report added: `docs/reports/CRITICAL_REVERIFY_LIVE_DOOR_2026-06-04.md`
- Correction to earlier over-broad audit wording:
  - `snapCity` IS already wired into the live door, but behind `SMART_NORMALIZE_ENABLED`
  - patronymic reconcile IS already wired into the live door, but behind `SMART_NORMALIZE_ENABLED`
  - authority resolve IS already wired into the live door, but behind `SMART_NORMALIZE_ENABLED`
  - anti-fabrication and self-consistency ARE already wired into `readDocument`, but behind flags
  - `garbageGuard` is runtime-used in UI/review surfaces, but NOT server-side in `readDocument`
- Strong corrected truth:
  - "not wired at all" was too rough for several D2 / gate components
  - more exact status = wired, but flag-gated and OFF by default

## 2026-06-04 — PROJECT UNDERSTANDING MASTER

- Report added: `docs/reports/PROJECT_UNDERSTANDING_MASTER_2026-06-04.md`
- Full-project understanding pass completed across:
  - startup truth docs (`AGENTS.md`, `STATUS.md`, `HANDOFF.md`, `SOURCE_OF_TRUTH.md`, `CHANGELOG.md`)
  - accepted ADRs
  - top-level repo structure
  - `apps/web/src/lib/*`
  - product OCR routes
- Strongest verified understanding:
  - this repo contains **three architectural eras at once**
    1. legacy TPS/product-specific pipelines
    2. current shared live `docintel` + `canonical/core` spine
    3. parked / target `central-brain` + `engine/consensus` layer
  - project understanding must distinguish these planes instead of flattening them into one claim
  - TPS merge brain (`lib/tps/centralBrain.ts`) is a separate live plane, not dead code
