# CHANGELOG

## 2026-06-10 (bench: live GT pipeline measurement on real Cyrillic docs, infra+report, agent)
- NEW `apps/web/scripts/gt-pipeline-bench.mjs` — re-runnable; POSTs owner fixtures to PROD vision-extract (real gemini-3.1-pro-preview path), scores per-field vs owner GT, auto-downscales >4MB, doc-class-aware field map. Raw→gitignored qa-private; sanitized scorecard→docs/reports.
- Results (EXPLORATORY, 1 doc/class): military(printed) 4/4 readable exact; booklet(hw) family+given+dob ✓, patronymic missed; birth(hw) surname-cyr ✓, given/patronymic/dob wrong — ALL review-flagged (no silent bad output).
- 4 findings (GT_PIPELINE_BENCH_FINDINGS): (A) >4MB images 413 at edge before brain; (B) ua_birth_certificate fields mislabeled handwritten:false on the most dangerous class; (C) sex not in booklet/birth/military specs; (D) pro misses handwritten patronymic.
- No code/prod/env change. No PII in committed files.

## 2026-06-10 (test: close BUG C + BUG D debt; pin a real RU-spelling gap, CODE, agent)
- NEW `canonicalValueUnresolved.test.ts` (BUG C, 4): date with no iso_date + non-empty cyrillic → emitted review `canonical_value_unresolved`, not dropped; empty cyrillic → dropped.
- NEW `sovietBilingualTolerance.test.ts` (BUG D, 6): pins doc-origin distinction — `ukrainianDoc===false` skips the RU-spelling review; `!==false` flags `russian_spelling_suspected`.
- **GAP pinned (not hidden):** `looksRussianSpelled` matches a composite full_name against the SINGLE-name set, so a multi-word RU name without ё/э/ы/ъ (e.g. 'Сергей Иванович') is NOT flagged even on a UA doc. Single-token 'Сергей' IS caught. Tightening needs owner GT + rule change.
- tsc 0; 3026 passed / 4 skipped / 0 failed (+10).

## 2026-06-10 (ci: bump GitHub Actions to Node-24 majors, infra, agent)
- checkout v4→v6, setup-node v4→v6, cache v4→v5, pnpm/action-setup v4→v6 across all 8 workflows. Clears the Node.js-20 deprecation (forced to Node 24 on 2026-06-16). No `version:` inputs → action-setup v6 reads `packageManager: pnpm@10.33.2`. YAML validated.

## 2026-06-10 (ci: content-guard fix — reword 'certified translation' comment, agent)
- `applyOcrFieldSafety.ts` comment reworded ('certified translation' literal tripped Rule 4 product-claim guard in CI). No logic change. tsc 0.

## 2026-06-10 (P0-A hardening: revert enforce→shadow, 403→422, kill-switch, runbook, CODE, agent)
- **Walked back 816cb64's always-on enforce** (which auto-deployed to prod with no data) to SHADOW mode default. `CONFIRMED_VALUE_GUARD_MODE` = shadow|enforce|off (one knob, no flag sprawl). Shadow = validate+log `would_block`, do NOT block → prod byte-identical. Owner flips enforce after reviewing shadow logs.
- `generate-pdf/route.ts`: guard block 403 → 422 (content invalid ≠ auth; frontend verified to only alert error string). PII-free structured log `[confirmed_value_guard] would_block|block {field,criticality,reason,doc_type}`.
- NEW `docs/architecture/CERTIFIED_DOC_INCIDENT.md` — incident runbook, MODE=off kill-switch, interim post-charge refund policy.
- Contract sharpening: C3_USER_CORRECTION_CONTRACT (DeepSeek-never-final; P0-A.1 vs P0-A.2 = anchor-check not gazetteer re-run; shadow rollout); ADR-019 (Tier-0 hashes ≠ legal evidence, breach-liability note); GT_BENCHMARK_EXIT_CRITERIA (N<30 must be enforced in runner code).
- New guard tests updated for shadow-default + regression on the removed f.confirmed flag. tsc 0; 3016 passed / 4 skipped / 0 failed.

## 2026-06-10 (P0 design lock + P0-A output-door sanitation, CODE+5 docs, agent)
- NEW `apps/web/src/lib/documentSafety/confirmedValueGuard.ts` — deterministic release-value sanitation (Cyrillic/control/length/date).
- `generate-pdf/route.ts` — guard wired ALWAYS-ON (legal sanitation, not behind OCR_FIELD_SAFETY). Fixed dead-code bug from prior agent (keyed on never-sent `confirmed` flag → now validates real release values). Deliberate prod behavior change: defects blocked, legitimate Latin unaffected.
- `applyOcrFieldSafety.ts` classifyCriticality — added validity dates, issuing_authority, category, nationality (were silently `optional`). Reconciled to CRITICAL_FIELDS_CONTRACT.
- `documentFieldReader.ts` — PII-free fallback_model_used observability log.
- `translation/types.ts` — ExtractedField.final_value + confirmed.
- 5 design-lock contracts: CRITICAL_FIELDS_CONTRACT, C3_USER_CORRECTION_CONTRACT, PAYMENT_REFUND_LEGACY_GATE_CONTRACT, GT_BENCHMARK_EXIT_CRITERIA (docs/architecture/); ADR-019-audit-trail-persistence (docs/adr/).
- NEW test `confirmedValueGuard.test.ts` (14). tsc 0; 3011 passed / 4 skipped / 0 failed.

## 2026-06-10 (ADR-018 model matrix locked + fallback-model review guard, CODE+ADR, agent)
- `docs/adr/ADR-018-model-matrix.md` — iron model matrix per owner directive: pro-preview = reader, flash = fallback-only, Vision = technical eye, DeepSeek = prose (+sanitized TPS text gap-fill), D2/C3/PDF = code.
- `geminiVisionProvider.ts` — `primaryGeminiModel()` exported.
- `documentFieldReader.ts` — NEW deterministic guard (no flag): fallback-model read of any non-Latin doc ⇒ all fields `review_required=true` + `fallback_model_used`. Closes the silent pro→flash degradation hole (2.5-flash disqualified on certificates).
- New `fallbackModelReview.test.ts` (5 tests); 3 existing docintel test mocks updated to report primary model.
- tsc 0; 2997 passed | 4 skipped | 0 failed (+5).

## 2026-06-10 (housekeeping: Vercel dead flags removed + local branch cleanup, env+infra, agent)
- Removed 7 dead Vercel prod env flags (code no longer reads them after Phase 2): ONE_BRAIN_CORE_ENABLED, ONE_CORE_TPS_ENABLED, ONE_CORE_REPAROLE_ENABLED, NEXT_PUBLIC_ONE_CORE_REPAROLE_ENABLED, ONE_CORE_EAD_ENABLED, NEXT_PUBLIC_ONE_CORE_EAD_ENABLED, CENTRAL_BRAIN_TRANSLATION.
- Deleted 68 stale local git branches. Only `main` remains.
- Closed 10 stale/superseded GitHub PRs (#25, #43–#47, #66, #92, #93, #103) with explanation.
- No code or prod behavior change.

## 2026-06-10 (fix: pre-payment review check — block before Stripe if fields unresolved, CODE, agent)
- `apps/web/src/app/api/translation/generate-pdf/route.ts`: added pre-payment review check block before Stripe gate.
  - Filters `payload.fields` for `review_required === true`; returns 400 `fields_require_review` if any found.
  - Prevents charge-before-block ordering bug (user charged → PDF blocked 403).
- tsc: 0 errors. 2992 passed | 4 skipped | 0 failed (unchanged from Phase 3 baseline).

## 2026-06-10 (docs: OCR field safety canary full record applied to main, docs-only, agent)
- Added 3 canary report files from PRs #100, #101, #102 (squashed; shared state files already on main).
- `docs/reports/OCR_FIELD_SAFETY_CANARY_RESULT_AFTER_502_FIX.md` — canary re-run after 502 fix, DEGRADED-clean result.
- `docs/reports/OCR_FIELD_SAFETY_OWNER_PROOF_RESULT.md` — owner proof run result.
- `docs/reports/OCR_FIELD_SAFETY_FINAL_OWNER_PROOF.md` — canary closeout, precautionary rollback to OFF.
- PRs #100, #101, #102 closed after content applied.

## 2026-06-09 (Phase 3: CanonicalField.finalValue + C3 as only writer, CODE, agent)
- `apps/web/src/lib/canonical/types.ts`: added `finalValue?: string | null` to `CanonicalField` — 3-state contract: `undefined`=C3 not run, `null`=rejected, `string`=accepted (ADR-017 §C3).
- `apps/web/src/lib/documentSafety/applyOcrFieldSafety.ts`: added `finalValue` to `SafeField` interface; C3 accept path writes `finalValue=string`, reject/block path writes `finalValue=null`.
- `apps/web/src/lib/canonical/core/translationAdapter.ts`: `canonicalToFieldOut` — `value` uses finalValue-first pattern (backward compat: `undefined` falls back to `normalizedValue`).
- `apps/web/src/lib/canonical/core/tpsAdapter.ts`: `canonicalFieldToTpsField` — `normalized_value` uses same finalValue-first pattern.
- `apps/web/src/lib/canonical/core/eadAdapter.ts`: `getValue` helper — same finalValue-first pattern.
- `apps/web/src/lib/packet/pdf.ts`: `planTranslationRows` type + logic — `final_value !== undefined ? final_value : normalized_value`.
- `apps/web/src/lib/documentSafety/__tests__/finalValueContract.test.ts`: 18 new contract tests (all 3 states, all 3 adapters, D2 boundary).
- tsc 0 errors. 2992 passed | 4 skipped | 0 failed (was 2974).
- Prod untouched. `OCR_FIELD_SAFETY_ENABLED` stays OFF. No env changes.
- Proof: `docs/reports/PHASE_3_FINAL_VALUE_C3_WRITER_PROOF.md`

## 2026-06-10 (PASS_PROD_MODEL_SMOKE: prod model flipped to gemini-3.1-pro-preview, env-only, agent)
- **No code change.** Prod env-only operation.
- Removed dirty `GEMINI_MODEL="gemini-2.5-flash\n"` (embedded literal `\n` made flash the effective prod model since Phase 1).
- Set clean `GEMINI_MODEL=gemini-3.1-pro-preview` via `printf | vercel env add` (no trailing newline).
- Redeploy: Vercel build OK, SHA `203b572`, aliased `messenginfo.com`. Healthz OK.
- Live smoke confirmed: `POST /api/translation/vision-extract` (1×1 PNG, no PII) → `model: gemini-3.1-pro-preview`, 4554ms, no fallback.
- Result: `PASS_PROD_MODEL_SMOKE`. Phase 3 UNBLOCKED.
- Report: `docs/reports/PROD_GEMINI_MODEL_FLIP_SMOKE_2026-06-10.md`

## 2026-06-10 (Phase 2 split EXECUTED: PRs #104-#109 all merged, docs, agent)
- Sequential split-merge per PR104 audit OPTION B: #104 (1.3) -> #105 (2.0) -> #106 (2.1a) -> #107 (2.1) -> #108 (2.2-2.6 two-part label) -> #109 (PR-F timeouts). Green checks before every merge.
- Added docs/reports/PR104_PHASE2_INTEGRATION_AUDIT.md to main (was local-only) + execution outcome appended.
- Prod env untouched. Owner action unblocked: flip prod GEMINI_MODEL -> gemini-3.1-pro-preview (clean value).

## 2026-06-10 (PR-F: raise Core read timeouts for pro-model, CODE, agent)
- `timeoutMs: 20_000 → 40_000` for readDocument in 4 routes (translation/tps/reparole/ead) — gemini-3.1-pro-preview observed at 28s on handwritten birth cert; 20s cap silently degraded pro reads to flash (PR104 audit, timeout_status: CONFLICT).
- `maxDuration: 30 → 60` on reparole + EAD routes (translation/TPS already 60).
- Prerequisite for owner flipping prod GEMINI_MODEL → gemini-3.1-pro-preview. tsc 0.

## 2026-06-09 (Phases 2.2–2.6: All flag gates removed, GPT-4o deleted, wizard cleanup, CODE, agent)
- **Phase 2.2** `apps/web/src/app/api/tps/ocr/extract/route.ts`: removed `ONE_BRAIN_CORE_ENABLED` flag gate; Core B1 unconditional for UA identity docs. `coreStatus` initial value `'skipped_no_mapping'` (was `'off'`). Logs `[ONE_CORE_TPS]` → `[Core/TPS]`.
- **Phase 2.2a** `apps/web/src/lib/docintel/documentRegistry.ts`: added `us_ead`, `us_i94`, `us_i797` specs (script `latin`; consumers `ead`/`reparole`/`tps`).
- **Phase 2.3** `apps/web/src/app/api/reparole/ocr/extract/route.ts`: removed `ONE_CORE_REPAROLE_ENABLED` flag gate (was: if !flagOn → 503). Route always runs Core.
- **Phase 2.4** `apps/web/src/app/api/ead/ocr/extract/route.ts`: removed `ONE_CORE_EAD_ENABLED` flag gate (same pattern).
- **Phase 2.5** `apps/web/src/app/api/ocr/extract/route.ts`: removed OpenAI vision block, `ENABLE_OPENAI_VISION` flag, `image_base64` param. DeepSeek text-parse retained. No live callers confirmed.
- **Phase 2.6** `apps/web/src/lib/engine/models.ts`: removed `openaiReader()` (gpt-4o). GPT fully removed per ADR-017.
- **Wizard** `ReparoleWizardV2.tsx`: removed `REPAROLE_CORE_ENABLED`; `useCoreRoute = CORE_COVERED_SLOTS.has(id)`.
- **Wizard** `EADWizard.tsx`: removed `EAD_CORE_ENABLED`; STEPS always 8 with StepUpload.
- Tests updated (2 files): replaced flag-existence assertions with Phase 2.3/2.4 unconditional assertions.
- tsc 0 errors. 2974 passed | 4 skipped | 0 failed.

## 2026-06-09 (Phase 2.1: Translation Core unconditional + CENTRAL_BRAIN dead code removed, CODE, agent)
- `ONE_BRAIN_CORE_ENABLED` flag gate removed from `apps/web/src/app/api/translation/vision-extract/route.ts`. Core B2 is now the unconditional default path.
- Dead `CENTRAL_BRAIN_TRANSLATION` consensus block (~40 lines, `CENTRAL_BRAIN_TRANSLATION === 'on' && ONE_BRAIN_CORE_ENABLED !== '1'` condition) removed. Was unreachable when ONE_BRAIN_CORE_ENABLED=1 (already ON in prod).
- Dead imports removed: `analyze` (central-brain), `deepseekProseTranslator` (engine/translator), `DOC_TYPES` (engine/docTypes).
- `degradedFromBrain` variable removed. Response `status` field: Core emits `ok:core-b2` (unchanged); legacy fallback now emits `ok:legacy-reader` (was `ok:degraded-legacy`). `degraded`/`degraded_reason` response fields removed.
- Legacy reader (with D0 preprocessing + quality gate) stays as fallback for Core errors + 0-field fallthrough.
- Phase 2.0b confirmed already done: `gemini-2.0-flash` removed from fallback chain in prior session.
- tsc 0; 2975/4 (0 regressions, 0 new tests — code-only cleanup). Prod untouched (ONE_BRAIN_CORE_ENABLED=1 already ON → behavior unchanged). Branch feat/one-brain-gemini-core (PR #104).

## 2026-06-09 (Phase 2.1a: Translator hard-case unbypass, CODE, agent)
- **RC-1 unblocked (flag-gated):** birth/marriage docs (`auto:false`) now route through vision-extract + hard-case review gate when `NEXT_PUBLIC_HARD_CASE_AUTOREAD_ENABLED=1`. Default OFF = byte-identical.
- 3-way state machine: flag OFF → manual unchanged; flag ON + 0 fields → falls through to manual; flag ON + fields → `hardCaseHasFields=true`, `needsReviewGate=true`, all fields `review_required`, payment blocked until all confirmed.
- `autoread?: boolean` on DocTypeMeta (birth + marriage); `hardCaseHasFields` state (useState false, cleared on resetAll); `needsReviewGate = currentDocMeta?.auto || hardCaseHasFields`; `unresolvedReviewFields` and `canProceedToCertifiedOutput` use `needsReviewGate`.
- Screen 2 UI: autoread docs show gold "hard case" notice; manual docs show specialist notice. I18n keys: `s2_hard_case_note` (RU + EN).
- Files: `apps/web/src/components/services/translation/TranslateWizard.tsx`, new `apps/web/src/components/services/translation/__tests__/hardCaseAutoread.test.ts` (14 tests, pure logic, no React render).
- tsc 0; full suite 2975/4 (was 2961, +14 new, 0 regressions). Prod untouched. No model/provider/payment/PDF/PII change. Branch feat/one-brain-gemini-core (PR #104).

## 2026-06-09 (Phase 2.0: rawCyrillic threaded + D2 sees Cyrillic + 4 bug fixes, CODE, agent)
- **GAP A fixed:** rawCyrillic threads ExtractedDocField → FieldCandidate.rawCyrillic (new field) → CanonicalField.rawCyrillic (new field). No longer dropped by docintelToCandidate.
- **GAP B fixed:** `applyKnowledge()` in arbitration.ts now feeds D2 with `f.rawCyrillic ?? normalizedValue ?? rawValue`. D2 Cyrillic rules (gazetteer, RU/UA spelling, patronymicReconcile, normalizeName) now fire on original Cyrillic text instead of derived Latin.
- **Bug A fixed:** `knowledgeNormalize.ts` date handler: ISO YYYY-MM-DD → USCIS MM/DD/YYYY without false review; already-USCIS MM/DD/YYYY pass-through.
- **Bug B fixed:** `sourceBasis` field added to `KnowledgeNormalizeCtx`; derived KMU-55 Latin gets evidenceStrength 0.6 vs MRZ/EAD/I-94 controlling Latin (0.99).
- **Bug C fixed:** `documentFieldReader.ts` — emit review (canonical_value_unresolved) instead of silently dropping field when `toCanonicalValue()` returns null but `r.cyrillic` is non-empty.
- `canonicalToFieldOut`: prefers `f.rawCyrillic` over cyrillicMap (map kept for backward compat).
- Files changed: `canonical/core/types.ts`, `canonical/types.ts`, `canonical/core/translationAdapter.ts`, `canonical/core/arbitration.ts`, `docintel/documentFieldReader.ts`, `canonical/core/knowledgeNormalize.ts`.
- New test file: `canonical/core/__tests__/phase20CyrillicD2Door.test.ts` (24 tests).
- tsc 0; full suite 2961/4 (was 2937, +24 new, 0 regressions). Prod untouched. KNOWLEDGE_BRAIN_ENABLED default OFF. Branch feat/one-brain-gemini-core (PR #104).
- Proof: docs/reports/PHASE_2_0_CYRILLIC_D2_DOOR_PROOF.md.

## 2026-06-09 (product readiness comparison TPS/Translator/Reparole/EAD, docs-only, agent)
- read latest audits (PRODUCT_RUNTIME_ARCHITECTURE, ONE_BRAIN_FINAL_STATUS, ACTUAL_PRODUCT_CALL_GRAPH + session surface maps + zero-trust) and wrote PRODUCT_READINESS_COMPARISON_2026-06-09.md.
- alignment to Constitution: Reparole 85% (reference) > EAD 80% (clean arch; US-doc registry specs UNPROVEN, no scorable fixtures, thinnest UX) > Translator 60% (3 branches) > TPS 40% (default Vision/DocAI+rule modules).
- FLAGSHIP PARADOX: Translator birth/marriage `auto:false` → vision-extract never called → manual ticket (incident RC-1 STILL TRUE). Safety stack now proven → added Phase 2.1a "Translator hard-case unbypass" (flag-gated). TPS convergence narrowed to UA-docs (keep deterministic US-form modules + Vision/DocAI as the eye). Added 2.2a EAD registry proof + owner fixtures ask.
- priority: 2.0 → 2.1a → 2.2 → EAD proof → tabs. docs-only; no code/prod/env/keys/PII; flags OFF. Branch feat/one-brain-gemini-core (PR #104).

## 2026-06-09 (self-check: corrections to my own claims + 4 design bugs found, docs-only, agent)
- FACT CORRECTION: full `vercel env ls` (earlier grep missed ONE_CORE_*): ONE_BRAIN_CORE/ONE_CORE_TPS/ONE_CORE_REPAROLE/ONE_CORE_EAD (+NEXT_PUBLIC twins), CENTRAL_BRAIN_TRANSLATION, DOCAI_ENABLED are ALL PRESENT in prod → Core arbitration is LIVE for all 4 products; KNOWLEDGE_BRAIN_ENABLED=1 in prod would fire immediately (NOT a no-op as I claimed). "Core parked behind unflipped flags" narrative corrected; Phase 2 = harden live Core + retire legacy fallbacks, not "flip Core on".
- DESIGN BUGS found in my Phase-1 D2 (all fix-in-2.0, flag still OFF so inert): (1) convertDateToUSCIS rejects ISO yyyy-mm-dd → correctly-read dates flagged date_unparsed (false review noise, seen in 1.4 run); (2) "preserve Latin" conflates derived KMU-55 Latin with controlling Latin — controlling must be source-based (mrz/ead/i94), not script-based; (3) documentFieldReader.ts:71 silently DROPS fields when toCanonicalValue→null (raw_cyrillic lost, no candidate/review); (4) RU-spelling-on-UA framing wrong for Soviet bilingual docs (RU spelling may be literally as-written; review stays, but reason/era context must distinguish — GT_LANGUAGE_INTENT: value=as-written).
- docs-only; no code/prod change; flags OFF. Branch feat/one-brain-gemini-core (PR #104).

## 2026-06-09 (Cyrillic Constitution assembled + mapped to real code, docs-only, agent)
- per owner: analyzed the full Cyrillic data highway (read code, not docs) and assembled the owner's iron constitution into ONE product schema: docs/architecture/ONE_BRAIN_CYRILLIC_CONSTITUTION.md (canonical architecture).
- code-grounded trace: Gemini reads VisionFieldRead.cyrillic; documentFieldReader.ts:70 runs toCanonicalValue IN the read loop → ExtractedDocField.value = KMU-55 Latin, raw_cyrillic kept alongside (:76); docintelToCandidate (translationAdapter.ts:50) drops raw_cyrillic (FieldCandidate.value=Latin; Cyrillic only in side cyrillicMap for display). Core/D2/C3/audit see Latin.
- GAPS: A=raw_cyrillic dropped from Core record; B=D2 partial at toCanonicalValue (city/oblast on Cyrillic, but name=bare KMU-55 no RU/UA check, no KnowledgeDecision); C=3 D2 sites/2 flags (Door A toCanonicalValue + Door B documentFieldReader post-pass SMART_NORMALIZE + my arbitration knowledgeNormalize KNOWLEDGE_BRAIN); D=no final_value, C3 post-adapter on Latin. documentFieldReader = the one shared door (anti-fab/self-consistency already centralize there).
- realization (unified, supersedes "3rd layer"): D2 = ONE layer at the one door on raw_cyrillic (toCanonicalValue+Door B emit KnowledgeDecision, retire arbitration dup, one flag); carry rawCyrillic+decision forward into FieldCandidate/CanonicalField; final_value + C3 single writer; PDF reads final_value only.
- docs-only; no code/prod/env/keys/PII; flags OFF; ReaderResult/OneBrain HOLD. Branch feat/one-brain-gemini-core (PR #104).

## 2026-06-09 (knowledge inventory + audit synthesis — Phase 2.0 reconciled, docs-only, agent)
- per owner ("inventory the dictionaries + read audits first"): read live data inventory + 4 prior audits (KNOWLEDGE_CORE_INVENTORY 06-03, CYRILLIC_HANDLING_ARCHITECTURE 06-03, P2_DICTIONARY_IN_LIVE_PATH_CHECKPOINT 06-03, FAILED_CYRILLIC_GROUND_TRUTH 06-02).
- FINDING 1 (architecture): a dictionary-in-path layer ALREADY exists at the right place (raw Cyrillic) — SMART_NORMALIZE_ENABLED P2.1-P2.3 (Door A toCanonicalValue→snapCity; Door B documentFieldReader patronymic/authority, tests 25/25). My Phase-1 knowledgeBrain at arbitration duplicates it at the WRONG layer (post-KMU-55 Latin). → Phase 2.0 reframed: RECONCILE to ONE layer at Door A/B keeping my KnowledgeDecision contract; retire the arbitration duplication. Supersedes "thread rawCyrillic".
- FINDING 2 (risk): dominant real failure = wrong_person_selected (model reads a different identity; 2.5-pro false-confidence on birth certs) — NOT a dictionary problem; defended by always-review policy + model choice + reshoot.
- inventory: gazetteer/settlements = SEED (35/458 vs ~28-30k KOATUU); deprecated gemini-2.0-flash (404) still in fallback chain (bug → 2.0b); civil_registry_terms.json + GLOBAL_BLOCKLIST/FIELD_LABELS orphaned. HARD GATE: any dict layer in prod FORBIDDEN until owner GT + OFF/ON delta; per-class model selection GT-gated.
- docs-only; no code/prod/env/keys/PII; all dict flags OFF; ReaderResult/OneBrain HOLD. Report: KNOWLEDGE_INVENTORY_AUDIT_SYNTHESIS_2026-06-09.md. Branch feat/one-brain-gemini-core (PR #104).

## 2026-06-09 (Phase 1.4 — real-doc Knowledge Brain proof + Cyrillic-bypass finding, agent)
- ran real Soviet + handwritten birth certs through readDocument (real Gemini gemini-3.1-pro-preview) → applyKnowledgeBrainIfEnabled (KNOWLEDGE_BRAIN_ENABLED=1) via a temp harness (created→run→DELETED, suite count untouched). SANITIZED output only (field name + action/rule/provenance/booleans, NO values/PII).
- safety PASS: D2 provenance on every field; conflict→review+suggestedValue (child_patronymic→patronymic.fragment; issuing_authority/date_of_issue→authority.unknown); no silent override; no Cyrillic leaks in accepted finals.
- FINDING: D2's Cyrillic-dependent rules (gazetteer / RU-spelling / normalizeName-on-Cyrillic) are bypassed on the live pipeline — docintel KMU-55-transliterates to Latin BEFORE arbitration (translationAdapter candidate.value = KMU-55 Latin; Cyrillic in separate cyrillicMap; FieldCandidate has no rawCyrillic). Safe, but accuracy value not yet delivered. Added Phase 2.0 prerequisite (thread rawCyrillic to D2; eventual: D2 = single transliteration authority).
- docs/plan only; no product code change; no prod/env/keys/PII; flags OFF; ReaderResult/OneBrain HOLD. Branch feat/one-brain-gemini-core (PR #104).

## 2026-06-09 (binding D2/C3/final_value contract recorded in ADR-017 — Phase 2 gate, docs-only, agent)
- owner verdict APPROVE_CONTRACT_BEFORE_PHASE_2. Recorded the binding contract in ADR-017 §"BINDING CONTRACT — D2/C3/final_value" + restructured ONE_BRAIN_GEMINI_BUILD_PLAN.md phase order.
- contract: (1) D2 annotates only, never writes final_value; (2) C3 is the SINGLE writer of final_value (accept_final→final_value=normalized_value, else null; D5 confirmation re-runs C3 so confirmed fields can become final via C3, not by bypass); (3) D6/PDF reads only final_value, critical null→block (admin/optional null does not block); (4) D5 reads normalized+suggested+reasons, crop later via ReaderResult/Vision bbox (non-blocking); (5) ONE criticality taxonomy for D2+C3; (6) adapters must not drop suggested_value/rule_id/provenance/reason_codes/evidence_strength/review_required; (7) phase order 1.4→2(Core-default per product)→3(explicit final_value + C3 final writer)→4(Knowledge canary after Core-default)→ReaderResult/crop later.
- 2 mentor refinements added: D5 user-confirmation re-runs C3 (else confirmed fields could never be final); PDF block scoped to CRITICAL final_value=null only.
- primary risk reframed: downstream bypass, not Gemini. Defense = final_value=null until C3/confirmation. final_value is NOT yet on CanonicalField (Phase 3 adds it; until then gate = normalized_value + review_required).
- docs-only; no code/prod/env/keys/PII change; KNOWLEDGE_BRAIN_ENABLED default OFF; ReaderResult/OneBrain HOLD. Branch feat/one-brain-gemini-core (PR #104).

## 2026-06-09 (Phase 1.3 — wire Knowledge Brain through ONE shared helper, agent)
- owner directive: wire through one shared helper, not four route forks. Created `canonical/core/knowledgeBrain.ts`: isKnowledgeBrainEnabled / buildKnowledgeContext (central doc-class/ukrainianDoc/historical derivation) / applyKnowledgeBrainIfEnabled (arbitrate, apply D2 only when flag ON).
- wired all 4 Core arbitration callers (translation/tps/reparole/ead) via the helper — 1-line diff each; removed direct arbitrateDocument imports from routes; no route-local KMU/gazetteer/patronymic logic.
- OFF proof: applyKnowledgeBrainIfEnabled deep-equals arbitrateDocument(candidates) (knowledgeBrain.test.ts); canonical 329/329 unchanged; full suite 2937 passed/4 skipped; tsc 0. ON proof (vi.stubEnv): Russian-on-UA→review+suggestedValue (read kept), clean UA→accept, provenance present.
- legacy /api/ocr/extract + generate-pdf are NOT arbitration seams → intentionally not D2-forked (legacy retires Phase 2; PDF inherits D2 + C3 gate). 6 new tests (knowledgeBrain.test.ts).
- no prod/env/model/provider/SMART/D0/ReaderResult/OneBrain/HTR/GPT change; KNOWLEDGE_BRAIN_ENABLED default OFF; no PII (provenance = rule ids only); qa-private untouched. Branch feat/one-brain-gemini-core. Report: docs/reports/KNOWLEDGE_BRAIN_PHASE_1_3_WIRING_PROOF.md.

## 2026-06-09 (Phase 1.2 — D2 authority contract, safe no-silent-override, agent)
- owner AI-risk review (ACCEPT_PHASE_1_ONLY) correctly rejected "dictionary silently overrides reader": that just trades a Gemini hallucination for a dictionary one. Rebuilt knowledgeNormalize.ts as a managed AUTHORITY LAYER before any wiring.
- `knowledgeNormalize` now returns a DECISION {action: accept|preserve|suggest|review|block, finalValue, candidateValue, ruleId, reasonCodes, provenance, evidenceStrength} — never a silent value. `arbitrateDocument(candidates, knowledge?)`: accept/preserve→deterministic final; suggest/review/block→keep READ value, set `suggestedValue`, force review_required (critical identity never silently finalized from D2). `isKnowledgeBrainEnabled()` gates callers (KNOWLEDGE_BRAIN_ENABLED, default OFF). `CanonicalField.knowledgeRule/knowledgeProvenance` added (Phase-4 audit).
- conflict-case tests (12): Russian-spelling-on-UA→review (candidate offered, not silent "Sergey"); clean UA→accept (KMU-55); gazetteer exact→accept, fuzzy→suggest (never overwrite); patronymic fragment→review; MRZ Latin→preserve; unknown authority→review (do not invent); arbitration OFF=byte-identical / ON=conflict→review. tsc 0; canonical suite 329/329 (OFF identical proven); full suite 2931 passed / 4 skipped.
- ADR-017 updated with binding §D2 authority contract. No prod/env/keys/PII change (prod 03eb30f, flag OFF). ReaderResult/OneBrain runtime HOLD per owner verdict. Branch feat/one-brain-gemini-core.

## 2026-06-09 (REBUILD: ADR-017 ONE Gemini brain + Phase 1.1 dictionary-in-brain, agent)
- mentor verdict on owner's "consensus org-chart": 70% right (D0→D6 + Auditor pipeline) but center wrong — consensus voting fixes none of the incident root causes and is a committee of one (GPT out, HTR dead). Decided ADR-017: ONE Gemini brain + deterministic knowledge truth (D2 can override reader) + review gate; one shared pipeline for all products. Real cause of "3 weeks → 0" = fragmentation (4 products / 4 regimes / Core parked behind unflipped flags).
- scope locked by owner: Gemini = recognition (all keys/models); DeepSeek retained fully (prose/Mia/crossref); GPT removed; HTR parked; keys/prod owner-managed.
- 5 read-only surface-map agents run (Translator/TPS/Reparole/Knowledge/model-inventory): Gemini already primary reader (gemini-3.1-pro-preview→flash); TPS default=Google Vision+rules; knowledge layer strong but only partly wired to outputs (Translator path misses normalizePlace/oblast/patronymic — the accuracy gap).
- Phase 1.1 (CODE): `apps/web/src/lib/canonical/core/knowledgeNormalize.ts` — pure deterministic dictionary-in-brain (KMU-55/gazetteer/patronymic/oblast→nominative/authority on FINAL value; Latin/MRZ preserved; never-silent fuzzy→review). 8 tests RED→GREEN; tsc 0. Pure/unwired = byte-identical.
- docs: ADR-017-one-gemini-brain-not-consensus.md; ONE_BRAIN_GEMINI_BUILD_PLAN.md. Branch feat/one-brain-gemini-core off origin/main 03eb30f. No prod/env/keys/PII/qa-private change. SECURITY: owner pasted live Gemini+service-account keys in chat → flagged, must rotate; repo tracked files verified clean (only test placeholder 'key123').

## 2026-06-06 (P0 vision-extract 502 triage + fix, agent)
- runtime proof (preview deploy of fix branch): ead no-fields probe → HTTP 200 {ok:false,status:unknown_document_type,review_required:true} (identical request = 502 on prod); blank ua_birth_certificate → 200 all fields value:null+review_required (no 502, no fabrication). PR #99.
- root cause: /api/translation/vision-extract returned HTTP 502 on every zero-field read — final return was `status: ok ? 200 : 502`. Proved by hitting the Vercel origin directly (bypassing Cloudflare): full valid JSON body returned WITH status 502, server=Vercel, x-vercel-id present, no crash, safety gate ran. Through Cloudflare the body was masked as bare "error code: 502". 502 in ~0.5-1.3s ⇒ not a timeout (maxDuration=60). This is the original "translator 0 results" incident; affects real hard-case docs that read 0 fields.
- fix: final return → status 200 always; added review_required:true to the no-fields body (zero recognition never silent success). 400/413/415/429 unchanged. True unhandled exceptions still 500.
- tests: NEW visionExtract502.test.ts (6 source-level guards). tsc 0; full suite 2919 passed / 4 skipped (was 2913+6). C3 documentSafety green.
- no prod env/flag change; no model/provider; no PII (synthetic inputs); qa-private=0. Branch fix/vision-extract-502-triage, PR open. Re-run OCR field-safety canary only after merge; ReaderResult/OneBrain HOLD.

## 2026-06-06 (OCR field-safety canary — DEGRADED, rolled back, agent)
- canary: enabled OCR_FIELD_SAFETY_ENABLED=1 in prod + code-free redeploy (commit 0d3d82b). Route proof blocked: every Translation vision-extract request reaching the Gemini model-read path returned 502 (synthetic non-PII images, all sizes/docTypes). Early quality-guard path returned 200 (route healthy).
- disambiguation: rolled back flag to OFF + redeploy; identical probe STILL 502 → 502 is PRE-EXISTING and flag-independent (gate runs post-read, never executed; no exception/stack logged — gateway timeout signature).
- rollback: OCR_FIELD_SAFETY_ENABLED ABSENT/OFF (verified). prod==main==0d3d82b, healthz ok. anti-fab/self-consistency/SMART/D0/model/provider untouched. No PII (synthetic inputs). qa-private=0.
- docs: OCR_FIELD_SAFETY_CANARY_RESULT.md. NEW finding (out of C3 scope, NOT proven for real uploads): vision-extract read-path 502 on synthetic requests — separate triage. C3 code-ready/prod OFF; D0/ReaderResult/OneBrain HOLD.

## 2026-06-06 (C3 stack merged + proof + canary runbook, agent)
- merge: #94 (audit) → #95 (guard) → #96 (C3 wiring) all MERGED to main (0d3d82b). tsc 0; full suite 2913 passed / 4 skipped on merged main.
- verify: OCR_FIELD_SAFETY_ENABLED ABSENT (OFF) in prod (vercel env ls). prod deploy of 0d3d82b catching up through stacked merges (flag OFF = byte-identical).
- docs: C3_OCR_FIELD_SAFETY_PROOF.md (flag-ON logic proof per flow) + OCR_FIELD_SAFETY_CANARY_RUNBOOK.md (owner enable/rollback/checks/stop-conditions).
- no prod env/flag change; no model/provider/HTR/OneBrain/SMART; no PII; qa-private=0. Canary = owner step; D0/ReaderResult/OneBrain HELD.

## 2026-06-06 (C3 FULL verified + flag-ON proof, agent)
- verified all 4 flows wired (grep): translation vision-extract, tps/ocr/extract, legacy ocr/extract, generate-pdf — all behind OCR_FIELD_SAFETY_ENABLED (OFF).
- added c3FlowSafety.proof.test.ts: flag-ON logic proof per flow (hard-case→candidate; zero-recognition→manual; legacy/source-mismatch→not final; PDF gate blocks unresolved critical, admin passes).
- evidence: tsc 0; documentSafety 38 tests; full suite 2913 passed / 4 skipped. OFF byte-identical. Prod flag NOT enabled; no env/model/provider/HTR/OneBrain/SMART; no PII; qa-private=0.

## 2026-06-06 (C3 wiring COMPLETE: all 4 flows behind OFF flag, agent)
- wire: TPS merge (tps/ocr/extract — mergedModule.fields through guard, legacy untrusted, normalized_value→null for unsafe critical), legacy boundary (/api/ocr/extract — legacy_reader/candidate-only annotation), PDF/payment (generate-pdf — hasUnresolvedCriticalForOutput blocks unresolved critical; admin passes). Translation public wired earlier this branch.
- all behind OCR_FIELD_SAFETY_ENABLED (default OFF). evidence: tsc 0; documentSafety 28 tests; full suite 2903 passed / 4 skipped — OFF byte-identical, zero regression.
- prod flag NOT enabled; no env/model/provider/HTR/OneBrain/SMART change; no PII; qa-private=0. Report docs/reports/C3_OCR_FIELD_SAFETY_WIRING.md.

## 2026-06-06 (C3 wiring inc.1: global OCR field safety wired into Translation public, OFF flag, agent)
- feat: applyOcrFieldSafety helper (classifyCriticality + apply guard to field list) + isOcrFieldSafetyEnabled (OCR_FIELD_SAFETY_ENABLED default OFF).
- wire: /api/translation/vision-extract — guarded block; OFF=byte-identical; ON ⇒ unsafe critical (hard-case/source-mismatch/stale/low-conf/zero-recognition) → candidate-only + review/manual, never final value; response carries ocr_field_safety.
- fix: guard manual_required now set for candidate_only too (contract 2.5: unsafe critical needs human action).
- evidence: tsc 0; documentSafety 28 tests (RED→GREEN); full suite 2903 passed / 4 skipped (flag OFF, zero regression).
- remaining C3 (same helper, next): TPS merge, legacy boundary, PDF/payment. Report docs/reports/C3_OCR_FIELD_SAFETY_WIRING.md.
- prod flag NOT enabled; no env/model/provider/HTR/OneBrain/SMART change; no PII; qa-private=0.

## 2026-06-06 (containment: global OCR field safety guard — built+tested, not wired, agent)
- feat: `apps/web/src/lib/documentSafety/ocrFieldSafetyGate.ts` — single global guard enforcing GLOBAL_OCR_FIELD_SAFETY_CONTRACT (candidate≠final, zero-recognition≠success, source/stale/hard-case/legacy/low-conf→not final, review/manual monotonic). PII-free by construction (takes value_present booleans, never the value). + hasUnresolvedCriticalForOutput shared PDF/payment gate.
- evidence: tsc 0; 18 guard tests (RED→GREEN equiv, incl. no-PII assertion); full suite 2893 passed / 4 skipped — guard pure/unwired = byte-identical, zero regression.
- NOT wired into product flows yet (next C3 increment, behind OCR_FIELD_SAFETY_ENABLED default OFF, per-flow + tests). Report docs/reports/GLOBAL_OCR_FIELD_SAFETY_CONTAINMENT.md.
- no prod env/flag change; no model/provider/HTR/OneBrain/ReaderResult/SMART; no PII; qa-private=0.

- 2026-06-06: scrubbed incident-document identity values from P0 docs → generic placeholders (no PII in docs).
- 2026-06-06: also genericized the legacy "Yovych" bug-label in STATUS incident block.

## 2026-06-06 (P0 OCR forensic audit — docs-only, agent)
- OCR/recognition reclassified INCIDENT / NOT TRUSTED after owner birth-cert incident (translator 0 results; TPS wrong/flagged patronymic + blanks).
- Read-only forensic map: 6 reader paths / 4 safety regimes (Gemini-gated docintel; TPS-core gated; TPS-legacy-modules ungated; translation-session=DeepSeek ungated conf<0.70; translation-public=Gemini gated but skipped when docType auto:false; legacy /api/ocr/extract=gpt-4o-mini ungated, called by /api/ocr/translate).
- Root causes: RC-1 public translator birth auto:false → skip API → 0 results (config, not crash; commit fca0582); RC-2 candidate≠final not enforced → wrong value ("Yovych" truncated patronymic, DOB month) shown AS value with only a review flag; RC-3 six paths/four regimes (no global contract); RC-4 TPS multi-doc aggregation; RC-5 TPS core→legacy fallback ungated.
- Ruled out: D0 (QUALITY_GATE_ENABLED absent in prod), anti-fab/self-consistency gates (keep values), server crash (0 error/fatal/5xx), Supabase.
- Artifacts: docs/reports/P0_OCR_FLOW_INVENTORY.md, P0_FIELD_LIFECYCLE_MAP.md, P0_ROOT_CAUSE_ANALYSIS.md, P0_OCR_SAFETY_TEST_PLAN.md; docs/architecture/GLOBAL_OCR_FIELD_SAFETY_CONTRACT.md (10 rules).
- FROZEN until containment: D0 prod / ReaderResult / OneBrain / HTR / 2nd provider / SMART / model. No code/flag/env/prod change; no PII; qa-private=0.


## 2026-06-05 (D0 quality/reshoot — first real brick, behind flag OFF, agent)
- merge: PR #90 (operating contract) MERGED → origin/main 3d9d566 (rails locked in main).
- feat(D0): `lib/docintel/quality/documentImageQuality.ts` — pure decision module: image metrics
  (brightness/blurScore/resolution, reused from lib/ocr/image-preprocess) → ACCEPT / DEGRADED_REVIEW /
  RESHOOT_REQUIRED + signals + reshoot message keys (RU). Flag `QUALITY_GATE_ENABLED` default OFF.
- wiring: guarded inert block in app/api/translation/vision-extract/route.ts — flag OFF ⇒ byte-identical;
  flag ON ⇒ a too-blurry/dark/small photo returns a reshoot instruction before OCR.
- hard rule: blur is NEVER an anti-fabrication signal (test asserts no fabrication/identity text in output).
- evidence: tsc 0 errors; D0 tests 16 passed; full suite 2875 passed / 4 skipped (flag OFF = nothing broke).
  Report: docs/reports/D0_QUALITY_RESHOOT_IMPLEMENTATION.md.
- no prod flag enabled; no model/provider/HTR/OneBrain/SMART change; no prod env/deploy; no PII; qa-private=0.

## 2026-06-05 (operating contract refinements — Gemini-first guardrails, docs-only, agent)
- refine AGENT_OPERATING_CONTRACT §3: + "Gemini-first ≠ multi-provider fan-out", "HTR research ≠ HTR implementation".
- refine §6 + Phase Gate 6: Gemini top-version benchmark must precede ANY non-Gemini provider discussion.
- Phase Gate 0: + PR #89 Gemini-first merged. OWNER_QUEUE: + owner command before any non-Gemini provider discussion.
- Docs-only; no runtime/flag/env change; no PII; qa-private=0. Applied to the open agent-operating-contract PR.

## 2026-06-05 (agent operating contract + phase gates + D0 start pack — docs-only, agent)
- merge: PR #89 (Gemini-first correction) MERGED → origin/main 50ee030 (prod deploy catching up, docs-only).
- docs: created the project "rails" so future agents don't confuse live/target or jump to HTR/GPT/OneBrain:
  - `docs/architecture/AGENT_OPERATING_CONTRACT.md` — current live reality, target, forbidden confusions,
    agent autonomy (may-do-without-asking vs must-stop-and-ask), evidence contract, phase-gate rules, hard rules.
  - `docs/reports/RECOGNITION_PHASE_GATES_CHECKLIST.md` — Gates 0–6 with required evidence; no phase starts
    until prior is PASS; HTR/second provider only after GT from different people + owner decision.
  - `docs/reports/NEXT_PROMPT_B_D0_QUALITY_RESHOOT.md` — copy-paste D0 prompt (flag default OFF; blur never a
    fabrication signal; reshoot UI; tests) — NOT started (waits for clean monitor + owner "start D0").
- No runtime/flag/env change; no code; no PII; qa-private=0. Next code step = D0, owner-gated.

## 2026-06-05 (Gemini-first roadmap correction — docs-only, agent)
- correction (owner): reader strategy = GEMINI-FIRST. Removed all near-term GPT-4o framing from the roadmap docs.
  D1 near-term work stays within the Gemini family (top versions/benchmarks); a second reader is a
  provider-agnostic DISABLED slot (GPT-4o/Claude NOT near-term); HTR research-only — all gated on GT breadth +
  owner decision + cost/privacy/accuracy evidence; no multi-provider fan-out until ROI proven.
- files patched (docs-only): RECOGNITION_TARGET_ARCHITECTURE_D0_D6.md (D1 Gemini-first block), RECOGNITION_SYSTEM_TRUTH_MAP.md,
  RECOGNITION_BUILD_PLAN_PHASES.md (Phase 3 + Phase 10), NEXT_AGENT_PROMPTS_RECOGNITION_STRUCTURE.md (Prompt C),
  RECOGNITION_ROADMAP_FROM_CURRENT_TO_TARGET.md (target diagram, gap list, Wave E — removed "Wire GPT-4o").
- PR #88 already merged → this is a follow-up correction PR. No runtime/flag/env change; no PII; qa-private=0.

## 2026-06-05 (recognition structure roadmap — docs-only, agent)
- merge: PR #87 (monitoring) MERGED → origin/main 951d4f6 (monitoring baseline locked before architecture work).
- docs: read-only repo classification → 4 architecture docs (NO code/flag/prod change):
  - `docs/reports/RECOGNITION_SYSTEM_TRUTH_MAP.md` — LIVE (readDocument+Gemini+arbitration+gates+review/PDF, TPS centralBrain plane) / PARKED (decideField, consensus, htr — 0 callers) / LEGACY (central-brain+orchestrator dormant, engine/models+GPT-4o on legacy /api/ocr/extract, tps modules) / TARGET.
  - `docs/architecture/RECOGNITION_TARGET_ARCHITECTURE_D0_D6.md` — D0 quality → D1 readers(ReaderResult) → OneBrain → D2 knowledge(signal) → D3 translation → D4 validators → D5 review → D6 PDF → Auditor.
  - `docs/reports/RECOGNITION_BUILD_PLAN_PHASES.md` — 10 phases, each with objective/files/allowed/tests/stop/rollback/forbidden; D0 first (bad photo breaks everything), OneBrain shadow-first, HTR/GPT-4o research-only after GT breadth.
  - `docs/reports/NEXT_AGENT_PROMPTS_RECOGNITION_STRUCTURE.md` — 5 copy-paste prompts (A monitoring closeout, B D0, C ReaderResult, D OneBrain shadow, E Auditor).
- truth held: this is a safety wrapper, NOT a full brain; HTR/GPT-4o/consensus/OneBrain still not live (parked). No runtime/flag/env change; no PII; qa-private=0.

## 2026-06-05 (Wave D monitoring set up — agent)
- merge: PR #86 (docs-only FINALIZE) MERGED → origin/main 08b183a; PR #85 also merged. prod deploy in progress (healthz 7c6068c, behavior-identical docs change).
- monitor: added `.github/workflows/prod-safety-monitor.yml` — READ-ONLY public healthz check every 6h (+ workflow_dispatch), permissions contents:read, NO secrets, self-no-ops after 2026-06-07 (temporary — delete after window). Deeper Vercel-log/metric/review_rate checks need a VERCEL_TOKEN that is NOT a repo secret → manual runbook instead.
- monitor: added `docs/reports/PROD_SAFETY_MONITORING_24H_RUNBOOK.md` — manual `vercel`/curl commands + what-to-watch (5xx, metric count, review_rate incl. printed-birth-cert false positives, self-consistency latency/cost, UI/PDF block) + rollback policy (SELF_CONSISTENCY first, keep ANTI_FAB; never execute without owner confirm unless active harm).
- No runtime code/flag/env change; no PII; qa-private tracked=0. Next: monitor 24–48h, then GT from different people (no new architecture).

## 2026-06-05 (FINALIZE — PASS_RUNTIME_VERIFIED, agent)
- verify: prod == main == 7c6068c (healthz ok; latest prod deploy dpl_6rXpz READY); PR #85 merged.
- verify: anti-fab gate firing is now PROD-RUNTIME-OBSERVED — owner ran a controlled hard-case prod upload (ua_birth_certificate via /api/translation/vision-extract) → 8/10 review=true, ALL identity protected, admin fields free. Corroborated by runtime logs (2× vision-extract 200 at 02:01–02:02 + metric, 0 errors) and matches the agent's independent local real-model proof field-for-field.
- status: gate verification COMPLETE. Safety wrapper working in prod (Gemini reader + post-passes + anti-fab/self-consistency gates + UI review/PDF block). NOT a full OneBrain — HTR/GPT-4o/consensus/OneBrain still not live (parked). SMART_NORMALIZE absent/OFF.
- next: monitor 24–48h (5xx, review_rate, self-consistency latency/cost, UI/PDF block, support). Rollback ready (self-consistency first if cost rises). No new architecture/code.

## 2026-06-05 (post-runtime GATE verification — env + firing proven, agent)
- verify: `vercel env ls production` (CLI authed as owner) — ANTI_FABRICATION_GATE_ENABLED (2h), SELF_CONSISTENCY_GATE_ENABLED (1h), DOCUMENT_CLASS_METRICS_ENABLED (17h) all PRESENT in Production; SMART_NORMALIZE_ENABLED ABSENT. (ls shows presence+target, not the literal value.)
- verify: gate FIRING proven on the identical readDocument code path, locally, real model + real hard-case Soviet birth cert + flags ON → 5/5 identity fields review_required=true; reasons [handwritten_document, model_instability_risk, no_strong_identity_anchor, self_consistency_identity_mismatch]; values unchanged ON vs OFF; self_consistency status=mismatch (2 reads disagreed on identity) → forced review; non-identity act_record_number NOT forced (scoped). Raw → qa-private (gitignored); report docs/reports/POST_RUNTIME_GATE_VERIFICATION.md.
- residual (owner-only): a literal PROD HTTP hard-case extraction RESPONSE (needs PII upload agent won't do) — flips gate from local-runtime-proven to prod-runtime-observed.
- prod still 0 error/fatal (2h); no code change; no flag touched; no PII to prod; harness removed after run.

## 2026-06-05 (post-runtime re-verification, agent — raw evidence)
- verify: review-gate fix NOW IN PROD — PR #84 merged; origin/main=2d2a391; e298d97 ancestor of main; healthz sha=2d2a391==main. (Was feat-only/not-deployed in the prior entry.)
- verify: independent re-run of the fix — tsc 0 errors; full suite **2859 passed / 4 skipped** (exact match to claim); reviewGate.ts server block + generate-pdf wiring + TranslateWizard client block + new tests all read and correct.
- verify (runtime logs): real prod extractions ran ~01:01–01:03 — 3× POST /api/translation/vision-extract 200 each emitting `[document_class_metric]`, + 2× POST /api/tps/ocr/extract 200; **0 error/fatal in 3h**. → DOCUMENT_CLASS_METRICS = RUNTIME VERIFIED; deployed safety code = no regression.
- GAP (unchanged): env flag VALUES not readable (no Vercel env-list MCP tool) → owner `vercel env ls production`. Anti-fab/self-consistency FIRING not independently confirmable (gates emit no log; metric line truncated; owner's "8/10 review=true" is owner-observed). To prove the gate: capture one hard-case extraction RESPONSE, not logs.
- no code change; no flag touched; no PII upload performed by agent.

## 2026-06-05 (translation public wizard hardening — local runtime verified, agent)
- fix: closed the real public Translation Wizard false-readiness gap in the legacy contour:
  unresolved OCR `review_required` fields now block payment and final PDF download, and
  `/api/translation/generate-pdf` now rejects unresolved OCR review fields from the wizard payload.
- ux: added an explicit `Confirm` action for unchanged OCR-flagged values, so a user can
  human-confirm a correct value without faking an edit; editing or confirming clears the
  local review flag and re-enables the payment path only when all flagged fields are resolved.
- verify: `pnpm --filter web exec tsc --noEmit --pretty false` PASS; `pnpm --filter web test` PASS;
  `pnpm --filter web run build` PASS.
- live local proof on `/en/services/translate-document/start` with real booklet fixture:
  `reviewBadgesBefore=4`, `confirmButtonsBefore=4`, `payDisabledBefore=true`,
  then after explicit confirms `reviewBadgesAfter=0`, `confirmButtonsAfter=0`,
  `payDisabledAfter=false`.
- evidence: `docs/reports/TRANSLATION_REVIEW_HARDENING_2026-06-04.md`
- truth boundary: production still needs one post-deploy reverify for this exact fix.

## 2026-06-04 (target recognition scheme verification, agent)
- verify (read-only): added `docs/reports/TARGET_RECOGNITION_SCHEME_FILE_VERIFICATION_2026-06-04.md`
  to reconcile the requested D0..D6 + Auditor recognition scheme against the actual repository file-by-file.
- confirmed: the scheme exists as architecture docs and as parked `engine/*` + `central-brain/*` code.
- confirmed: the live default product spine is still `docintel/documentFieldReader.ts` + Gemini provider + canonical arbitration, not `consensus.ts` multi-reader control.
- confirmed: D0 preprocess is real; D1 Gemini reader is live; D2 KMU-55 is live; gazetteer/patronymic exist but are not universally active by default; review/PDF/audit pieces exist but are split.
- verdict: repo contains most target building blocks, but the project does NOT yet match the exact target scheme in live runtime. No behavior change; no flag change; no prod mutation.

## 2026-06-04 (latest audit / inventory reconciliation, agent)
- verify (read-only): added `docs/reports/LATEST_AUDIT_INVENTORY_RECONCILIATION_2026-06-04.md`
  to check the newest inventory / audit / matrix / verdict reports against current code.
- confirmed: the freshest truth-layer reports are mostly internally consistent and align with code:
  live spine = `readDocument()` + Gemini provider + arbitration/gates.
- confirmed: older snapshot reports are now partially stale; specifically, reports claiming `ua_military_id`
  absent are outdated because `docintel/documentRegistry.ts` now defines `ua_military_id`.
- clarified: `ROUTE_INVENTORY_2026-05-29.md` remains valid for payment/review-bypass risk, but it does not
  answer the newer "which brain is live" architecture question.
- no behavior change; no test run; no prod mutation.

## 2026-06-04 (critical live-door re-verify, agent)
- verify (read-only): added `docs/reports/CRITICAL_REVERIFY_LIVE_DOOR_2026-06-04.md`
  to correct earlier over-broad claims about what is "not wired" vs "wired behind flags".
- confirmed against code:
  - `snapCity`, patronymic reconcile, authority resolve are already wired into the live `readDocument()` path
  - anti-fabrication and self-consistency are already wired into `readDocument()`
  - `garbageGuard` is runtime-used in UI/review layers, but not server-side in the live reader
- corrected truth: several D2 / verification pieces are present in the live door already; the accurate
  distinction is default-OFF flag-gated behavior versus absent behavior. No behavior change; no prod mutation.

## 2026-06-04 (project understanding master, agent)
- verify (read-only): added `docs/reports/PROJECT_UNDERSTANDING_MASTER_2026-06-04.md`
  after a full-project understanding pass across startup docs, accepted ADRs, repo structure, `lib/*`, and
  product OCR routes.
- confirmed: the repo is best understood as three coexisting architecture layers:
  legacy TPS/product-specific OCR, current shared `docintel` + `canonical/core` live spine, and parked/target
  `central-brain` + `engine/consensus` direction.
- clarified: TPS merge brain (`lib/tps/centralBrain.ts`) is a separate live plane, not dead code.
- no behavior change; no test run; no prod mutation.

## 2026-06-05 (UX review chain — CODE-VERIFIED, agent)
- verify (read-only, Translation flagship): the review→correct→PDF safety chain is wired correctly in code:
  (a) `EvidenceReviewPage.tsx` surfaces review — "Needs review" label + ⚠ + "verify the value is correct",
  driven by `field.is_critical && field.review_required`; (b) `correct-field` route records a `user_corrections`
  row + updates `normalized_value` (user can fix); (c) `generate-pdf` route RETURNS `review_required` gate →
  **PDF is blocked while review is pending** (uncertain fields never flow silently into the PDF); (d) `render`
  route enforces "Final PDF fields must match the confirmed DB values" with a PII-safe source-to-final audit.
- So the gate→review_required→UI→PDF-block→confirmed-value chain is connected STRUCTURALLY. Still NOT proven in
  live runtime (no extraction processed). Roadmap Wave B updated to "code-verified, runtime pending".
- re-confirmed infra: healthz sha=73e7505 == main, ok @ 00:48; no new errors. No code change; no flag touched; no PII upload.

## 2026-06-05 (post-deploy verification, agent — raw evidence)
- verify: prod healthz sha=73e7505 == origin/main HEAD; PRs #80/#81/#82 MERGED; latest prod deploy dpl_7GbX READY. Code live.
- verify: 0 error/fatal runtime logs in 3h; 6h prod traffic = only /api/healthz 200 + /robots.txt. No regression.
- GAP: document_class_metric logs in 24h = 0 → no real extraction in prod → anti-fab/self-consistency runtime effect UNOBSERVED (gates emit no log; only visible in a real extraction response).
- GAP: flag env VALUES not independently readable via Vercel MCP (no env-list tool) — "ON" rests on owner action + code presence. Owner to confirm `vercel env ls production`.
- GAP: STATUS accuracy line overstated (US printed ~100% is raw API not product accuracy; UA printed 60-83% not what measured runs show). Flagged in STATUS POST-DEPLOY VERIFICATION block.
- verdict: DEGRADED (not broken) — infra green, safety-active claim unproven until one controlled hard-case extraction runs in prod. No code change; no flag touched; no PII upload performed.

## 2026-06-05
- ops: ANTI_FABRICATION_GATE_ENABLED=1 in production (hard-case identity → force review)
- ops: SELF_CONSISTENCY_GATE_ENABLED=1 in production (N=2 hash mismatch → force review)
- decision: PII history = INTERNAL-ONLY FOREVER (repo private, topic closed)
- decision: SMART_NORMALIZE = DO_NOT_ENABLE (dictionaries don't fix model reading)
- decision: OneBrain/decideField = PARKED (revisit at GT≥50 different people)

## 2026-06-04
- feat: PR #81 merged — anti-fab canary turnkey, ADR-016, military registry, patronymic fix
- feat: PR #80 merged — P2 dictionaries, anti-fab gate, self-consistency, class metric, GT workflow
- ops: DOCUMENT_CLASS_METRICS_ENABLED=1 in production
- GT: 6/30 VERIFIED_BY_OWNER (birth_cert x2, passport, i94, ead, military)
- accuracy: hard-case 25%, printed ~100%, false_negative_review=0 in mode C
