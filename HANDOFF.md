# HANDOFF (2026-06-09 — SELF-CHECK CORRECTION + Cyrillic Constitution)
**SELF-CHECK (owner asked "re-verify your own logic"): found and corrected my own errors.** (1) **FACT:** full `vercel env ls` (my earlier grep missed `ONE_CORE_*`) — ONE_BRAIN_CORE / ONE_CORE_TPS / ONE_CORE_REPAROLE / ONE_CORE_EAD (+NEXT_PUBLIC twins) + CENTRAL_BRAIN_TRANSLATION + DOCAI_ENABLED are **ALL PRESENT in prod** → the Core arbitration path is LIVE for all 4 products NOW; `KNOWLEDGE_BRAIN_ENABLED=1` in prod would fire IMMEDIATELY (my "no-op until Phase 2" claim was wrong; "Core parked behind unflipped flags" narrative corrected — Phase 2 = harden the LIVE Core + retire legacy fallbacks). (2) **4 design bugs in my Phase-1 D2** (inert — flag OFF): ISO dates → `date_unparsed` false review (convertDateToUSCIS rejects yyyy-mm-dd); derived KMU-55 Latin misclassified as "controlling Latin" (controlling must be SOURCE-based mrz/ead/i94, not script-based); `documentFieldReader.ts:71` silently DROPS fields when toCanonicalValue→null (raw_cyrillic lost, no candidate/review); RU-spelling-on-UA rule wrong for Soviet bilingual docs (RU may be as-written; GT_LANGUAGE_INTENT: value=as-written). All fixed in Phase 2.0 design. See STATUS self-check block.

## (prev) Cyrillic Constitution assembled + mapped to real code
**Per owner ("analyze the whole Cyrillic highway + assemble into ONE product schema"), traced raw_cyrillic through the real code and wrote `docs/architecture/ONE_BRAIN_CYRILLIC_CONSTITUTION.md`** (the canonical architecture). Findings (code-grounded): Gemini reads `VisionFieldRead.cyrillic` (model does NOT transliterate); `documentFieldReader.ts:70` calls `toCanonicalValue` INSIDE the read loop → `ExtractedDocField.value` is KMU-55 **Latin**, `raw_cyrillic` kept alongside (`:76`); `docintelToCandidate` (`translationAdapter.ts:50`) **drops raw_cyrillic** (FieldCandidate.value=Latin; Cyrillic only in a side `cyrillicMap` for DISPLAY). So the Core/D2/C3/audit see Latin. **GAPS:** A=raw_cyrillic dropped from Core record; B=D2 partial at toCanonicalValue (city/oblast on Cyrillic ✓, but name=bare KMU-55, no RU/UA check, no decision); C=THREE D2 sites / TWO flags (Door A `toCanonicalValue` + Door B `documentFieldReader` post-pass `reconcilePatronymicFields`/`resolveAuthorityFields` under SMART_NORMALIZE + my arbitration `knowledgeNormalize` under KNOWLEDGE_BRAIN); D=no `final_value`, C3 runs post-adapter on Latin. `documentFieldReader` IS the one shared door (comment: "all 4 products inherit via this one door"; anti-fab/self-consistency already centralize there). **REALIZATION (unified):** D2 = ONE layer at the one door on `raw_cyrillic` (upgrade `toCanonicalValue`+Door B to emit `KnowledgeDecision`, add RU/UA detect + name gazetteer, retire my arbitration dup, ONE flag); carry `rawCyrillic`+decision FORWARD into FieldCandidate/CanonicalField (kill the side cyrillicMap); add `final_value` + C3 single writer; PDF reads `final_value` only. **Next: Phase 2.0 reconcile D2 to the one door on raw_cyrillic + carry forward** (this fixes GAP A+C and the Phase-1.4 bypass at once). Constitution doc is the canonical reference now. Prod untouched (03eb30f); flags OFF; ReaderResult/OneBrain HOLD; no keys/PII. Branch feat/one-brain-gemini-core (PR #104).

---

## (prev) Knowledge inventory + audit synthesis
**Per owner ("inventory the dictionaries + read the audits FIRST"), read the live data inventory + 4 prior audits. TWO critical findings reframe Phase 2.0:**
1. **A dictionary-in-path layer ALREADY EXISTS at the right place (raw Cyrillic).** `SMART_NORMALIZE_ENABLED` P2.1-P2.3 (2026-06-03): Door A `transliterationPolicy.toCanonicalValue`→`dictionaryBridge.normalizeCity`→`snapCity` (dictionaryBridge.ts:106); Door B `documentFieldReader.ts:94` post-passes `patronymicReconcile`+`authorityResolve`. Tests 25/25. My Phase-1 `knowledgeNormalize` (arbitration level, post-KMU-55 Latin) DUPLICATES it at the WRONG layer — that's exactly the fragmentation the rebuild fights. **→ Phase 2.0 = RECONCILE to ONE layer at Door A/B (raw Cyrillic), keep my better `KnowledgeDecision` contract, fold in the P2 primitives, ONE flag, retire the arbitration duplication.** (Supersedes "thread rawCyrillic into FieldCandidate".)
2. **Dominant real failure = `wrong_person_selected`** (FAILED_CYRILLIC_GROUND_TRUTH 06-02): the model reads a COMPLETELY DIFFERENT identity on birth certs; gemini-2.5-pro returned review_required=FALSE while wrong (false confidence). **No dictionary fixes this** — defended by always-review hard-case policy (already wired) + model selection (flash-image, not 2.5-pro) + reshoot. D2's value is on correctly-read text only.
**Also:** gazetteer/settlements = SEED (35/458 vs ~28-30k KOATUU); deprecated `gemini-2.0-flash` (404) still in fallback chain (small bug, 2.0b); civil_registry_terms.json + GLOBAL_BLOCKLIST orphaned. **HARD GATE (P2 checkpoint):** enabling ANY dictionary layer (SMART_NORMALIZE or KNOWLEDGE_BRAIN) in prod is FORBIDDEN until owner ground-truth + OFF/ON per-field accuracy delta. Per-class model selection is also GT-gated. **Next: Phase 2.0 RECONCILE (one dict layer at raw-Cyrillic place) + 2.0b model-id fix.** Report: docs/reports/KNOWLEDGE_INVENTORY_AUDIT_SYNTHESIS_2026-06-09.md. Prod untouched (03eb30f); all dict flags OFF; ReaderResult/OneBrain HOLD; no keys/PII. Branch feat/one-brain-gemini-core (PR #104).

---

## (prev) Phase 1.4 real-doc proof — Cyrillic-bypass finding
**Phase 1.4 DONE (CODE proof, temp harness run+deleted).** Ran real Soviet + handwritten birth certs through readDocument (real Gemini gemini-3.1-pro-preview) → `applyKnowledgeBrainIfEnabled` (flag ON), SANITIZED output (no PII). Safety PASS: D2 provenance on every field; conflict→review+suggestedValue (child_patronymic→patronymic.fragment, issuing_authority/date_of_issue→authority.unknown); NO silent override; no Cyrillic leaks in accepted finals. **FINDING (why 1.4 matters):** D2's Cyrillic-dependent rules (gazetteer city snap, Russian-spelling-on-UA detect, normalizeName-on-Cyrillic) are BYPASSED on the live pipeline because the docintel reader KMU-55-transliterates Cyrillic→Latin BEFORE arbitration (`translationAdapter`: candidate.value = KMU-55 Latin; raw Cyrillic kept in a separate cyrillicMap; FieldCandidate has NO rawCyrillic). So D2 currently sees Latin → emits conservative review, not its real normalization. SAFE (nothing silently finalized) but the accuracy value is not yet delivered. **→ Phase 2.0 prerequisite added: thread `rawCyrillic` into FieldCandidate so D2's Cyrillic rules fire; eventual clean state = D2 is the single transliteration authority (remove duplicate read-time KMU-55).** Then Phase 2 Core-default per product. Plan updated. Prod untouched (03eb30f); flags OFF; ReaderResult/OneBrain HOLD; no keys/PII. Branch feat/one-brain-gemini-core (PR #104).

---

## (prev) BINDING CONTRACT recorded in ADR-017; Phase 2 unblocked
**Owner approved the D2/C3/final_value contract (APPROVE_CONTRACT_BEFORE_PHASE_2). Recorded in ADR-017 + plan (docs-only) — this is the gate that unblocks Phase 2.** The binding contract: (1) D2 = annotation/authority only, never writes `final_value`; (2) **C3 = the single writer of `final_value`** — accept_final→final_value=normalized_value, else null; a D5 user confirmation re-runs C3 (so confirmed fields CAN become final, via C3, never bypassing it); (3) **D6/PDF reads only `final_value`**, a CRITICAL final_value=null blocks (admin/optional null does not); (4) D5 reads normalized+suggested+reasons, crop later via ReaderResult/Vision bbox (not a blocker); (5) ONE criticality taxonomy for D2+C3; (6) adapters MUST NOT drop suggested_value/rule_id/provenance/reason_codes/evidence_strength/review_required; (7) phase order 1.4→2→3→4, ReaderResult/crop later. **Primary risk is now downstream bypass; the structural defense is `final_value=null until C3/confirmation`.** `final_value` is NOT yet a field on CanonicalField — Phase 3 adds it; until then the de-facto gate is normalized_value + review_required. **Next: Phase 1.4 (real-fixture local proof, flag ON), then Phase 2 Core-default ONE product at a time, built to this contract.** Prod untouched (03eb30f); KNOWLEDGE_BRAIN_ENABLED default OFF; ReaderResult/OneBrain runtime HOLD; no keys/PII. Branch feat/one-brain-gemini-core (PR #104).

---

## (prev) Phase 1.3 — shared helper wiring
**Phase 1.3 DONE (CODE).** Per owner directive "wire through ONE shared helper, not four forks": created `canonical/core/knowledgeBrain.ts` (`isKnowledgeBrainEnabled` / `buildKnowledgeContext` / `applyKnowledgeBrainIfEnabled`). Wired all 4 Core arbitration callers (translation/tps/reparole/ead) through it — 1-line diff each, NO route-local dictionary logic, NO direct dictionary imports in routes. OFF deep-equals bare `arbitrateDocument` (proven); ON = D2 authority (conflict→keep read value + suggestedValue + review). 18 helper/normalize tests; canonical 329/329 unchanged; full suite **2937/4**; tsc 0. Legacy `/api/ocr/extract` + `generate-pdf` are NOT arbitration seams → no D2 fork added (legacy retires in Phase 2; PDF inherits D2 + keeps the C3 gate). Proof: docs/reports/KNOWLEDGE_BRAIN_PHASE_1_3_WIRING_PROOF.md. **Next: Phase 1.4 real-fixture local proof (flag ON), then Phase 2 consolidation + GPT removal + retire legacy fork.** Prod untouched (03eb30f), KNOWLEDGE_BRAIN_ENABLED default OFF, no keys/PII, ReaderResult/OneBrain runtime HOLD.

---

## (prev) Phase 1.2 — D2 authority contract
**Owner pivoted to a full rebuild ("сделай как должно быть"): recognition via Gemini (all keys/models), DeepSeek retained fully, GPT removed, HTR parked.** As mentor I answered the core architecture question: the owner's "consensus of 3 readers" org-chart is 70% right (pipeline stages D0→D6 + Auditor) but wrong in the center — consensus voting fixes none of the incident root causes (502 / candidate≠final / six regimes) and, with GPT excluded + HTR dead, it is a committee of one. Decided ADR-017: **one Gemini brain + deterministic knowledge truth (D2 elevated, can override the reader) + review gate**, one shared pipeline for all products. Real cause of "3 weeks → 0 result" = FRAGMENTATION (4 products, 4 recognition regimes, Gemini-Core parked behind flags nobody flips), not lack of consensus.
**Phase 1.1+1.2 landed (CODE).** AI-risk review (owner) correctly caught the danger: "dictionary may override reader" must NOT be a silent auto-replace (else Gemini hallucination → dictionary hallucination). Rebuilt as a managed AUTHORITY LAYER: `knowledgeNormalize.ts` returns a DECISION `{action accept/preserve/suggest/review/block, finalValue, candidateValue, ruleId, reasonCodes, provenance, evidenceStrength}` — never a silent value. `arbitrateDocument(candidates, knowledge?)` applies it: accept/preserve→deterministic final; **CONFLICT (suggest/review/block)→keep the READ value, surface `suggestedValue`, force review — a critical identity field is never silently finalized from D2.** Flag `isKnowledgeBrainEnabled()` (`KNOWLEDGE_BRAIN_ENABLED`, default OFF → byte-identical, proven: canonical suite 329/329 unchanged). `CanonicalField.knowledgeRule/knowledgeProvenance` added for the Phase-4 audit log. 12 conflict-case tests (Russian-on-UA→review, clean UA→accept, gazetteer exact→accept, gazetteer fuzzy→suggest, patronymic fragment→review, MRZ Latin→preserve, unknown authority→review, arbitration OFF=identical/ON=conflict→review). tsc 0; full suite **2931/4**. ADR-017 updated with the binding §D2 authority contract.
**Next (Phase 1.3–1.4):** gate the wiring in each caller — `arbitrateDocument(c, isKnowledgeBrainEnabled() ? { documentClass, isHistorical, ukrainianDoc } : undefined)` in translation/tps/reparole/ead routes + readDocumentCore (OFF=identical); then 1.4 real-fixture proof with flag ON. Then Phase 2 consolidation + remove GPT + retire legacy `/api/ocr/extract`. Plan: docs/reports/ONE_BRAIN_GEMINI_BUILD_PLAN.md. Branch `feat/one-brain-gemini-core`. Keys/prod owner-managed; prod untouched (03eb30f). Owner verdict ACCEPT_PHASE_1_ONLY honored: flag OFF, no prod, ReaderResult/OneBrain runtime HOLD.

---

# HANDOFF (2026-06-06 — OCR INCIDENT; P0 forensic audit done, code frozen)
**P0 vision-extract 502 FIXED.** RUNTIME-PROVEN on preview: ead no-fields → 200 (prod=502); blank birth-cert → 200 all-review. PR #99. Root cause = `route.ts` final return `status: ok ? 200 : 502` → any zero-field read returned HTTP 502 (the original "translator 0 results/HTTP 502" incident). Proved via direct-origin probe: full valid JSON body returned WITH a 502 status, no crash, gate ran; Cloudflare masked it. Fix: return 200 + review_required on no-fields path. tsc 0; suite 2919/4; new source-level guard test. Branch fix/vision-extract-502-triage, PR open. OCR_FIELD_SAFETY_ENABLED untouched/OFF. Next: owner merges → re-run OCR field-safety canary (blocker gone). ReaderResult/OneBrain HOLD. Evidence: docs/reports/VISION_EXTRACT_502_TRIAGE_2026-06-06.md.

**OCR field-safety canary = DEGRADED, rolled back.** Enabled flag+redeploy; every Translation request reaching the model-read path → 502; the SAME 502 reproduces with flag OFF (commit 0d3d82b) → pre-existing/flag-independent, gate never ran. Rolled back to OFF (verified ABSENT). prod==main==0d3d82b, healthz ok; anti-fab/self-consistency/SMART/D0 untouched; no PII (synthetic inputs). NEW (separate from C3, not proven for real uploads): vision-extract 502 on synthetic gate-reaching requests — triage ticket. Next: owner uploads ONE real hard-case doc with flag ON per OCR_FIELD_SAFETY_CANARY_RUNBOOK.md (only path that exercises the gate on real content + payment-gated PDF). Full evidence: docs/reports/OCR_FIELD_SAFETY_CANARY_RESULT.md. D0/ReaderResult/OneBrain HOLD.

**C3 MERGED:** stack #94→#95→#96 in main (0d3d82b). All 4 flows wired behind OCR_FIELD_SAFETY_ENABLED (absent/OFF in prod). tsc 0; suite 2913; flag-ON proof + canary runbook written. Prod deploy of 0d3d82b catching up (flag OFF=byte-identical). Owner: enable canary per OCR_FIELD_SAFETY_CANARY_RUNBOOK.md (agent will not flip prod flag). D0/ReaderResult/OneBrain HELD until canary stable.

**C3 FULL + flag-ON proof:** all 4 flows wired (Translation/TPS/legacy/PDF) behind OCR_FIELD_SAFETY_ENABLED=OFF; c3FlowSafety.proof.test proves flag-ON outcomes per flow. tsc 0; documentSafety 38 tests; full suite 2913. OFF=byte-identical. Owner: merge #94→#95→#96, browser-proof flag ON, canary.

**C3 wiring COMPLETE:** guard wired into all 4 flows (Translation public, TPS merge, legacy boundary, PDF/payment) behind `OCR_FIELD_SAFETY_ENABLED` (OFF=byte-identical). tsc 0; 28 documentSafety tests; full suite 2903. candidate≠final, zero-recognition≠success enforced when ON. Prod flag NOT enabled; D0/ReaderResult/OneBrain HELD. Owner enables after browser proof.

**C3 wiring (increment 1):** guard wired into Translation public (`vision-extract`) behind `OCR_FIELD_SAFETY_ENABLED` (OFF=byte-identical). Helper `applyOcrFieldSafety` reusable. tsc 0; 28 documentSafety tests; full suite 2903 passed. Remaining C3 (same helper): TPS merge, legacy boundary, PDF/payment. Prod flag NOT enabled; D0/ReaderResult/OneBrain HELD.

**Containment guard built (C1+C2):** `documentSafety/ocrFieldSafetyGate.ts` (pure, PII-free, 10-rule contract)
+ `hasUnresolvedCriticalForOutput`. tsc 0; 18 tests; full suite 2893 passed; pure/unwired = byte-identical. NOT
wired into flows yet (C3, behind `OCR_FIELD_SAFETY_ENABLED` OFF, per-flow + tests). D0/ReaderResult/OneBrain HELD.

(STATUS bug-label genericized too.)
(P0 docs PII-scrubbed: incident identity values → placeholders.)

**P0 forensic audit complete (docs-only).** Global OCR = NOT TRUSTED after the birth-cert incident. Mapped 6
reader paths / 4 safety regimes; root causes: RC-1 public translator birth `auto:false`→0 results; RC-2 wrong
value shown AS value (candidate≠final not enforced — "Yovych" truncated patronymic, DOB month); RC-3 six paths
four regimes (Gemini-gated vs DeepSeek vs TPS-legacy-modules vs gpt-4o-mini, all ungated except docintel); RC-4
TPS multi-doc aggregation (blank fields need other docs); RC-5 TPS core→legacy fallback re-introduces ungated reads.
Ruled out: my D0 (flag absent), the gates (keep values), a crash (0 errors), Supabase. Docs: P0_OCR_FLOW_INVENTORY,
P0_FIELD_LIFECYCLE_MAP, P0_ROOT_CAUSE_ANALYSIS, GLOBAL_OCR_FIELD_SAFETY_CONTRACT, P0_OCR_SAFETY_TEST_PLAN.
**FROZEN:** D0 prod / ReaderResult / OneBrain / HTR / 2nd provider / SMART / model work.
**Next phase:** adopt contract → shared `ocrFieldSafetyGate` + RED tests → then resume. No code changed in P0.

---

# HANDOFF (2026-06-05 — D0 quality/reshoot built behind flag OFF)

**D0 done (first real brick):** PR #90 merged (rails in main). Implemented `lib/docintel/quality/documentImageQuality.ts`
(pure: metrics → ACCEPT/DEGRADED_REVIEW/RESHOOT_REQUIRED + reshoot keys), reusing existing preprocess metrics;
guarded inert hook in translation vision-extract route (flag `QUALITY_GATE_ENABLED` default OFF → byte-identical;
ON → reshoot before OCR). Blur never a fabrication signal. tsc 0; D0 16 tests; full suite 2875 passed. Report:
docs/reports/D0_QUALITY_RESHOOT_IMPLEMENTATION.md. **Not enabled in prod.** Next code = Gate 2 ReaderResult.
Enabling D0 in prod (canary) = separate owner decision after a local/browser proof. PR opened (docs-only PRs ended).



**Operating rails (this turn, docs-only):** PR #89 merged (Gemini-first in main). Created the project law:
`docs/architecture/AGENT_OPERATING_CONTRACT.md` (live vs target, may-do vs must-stop-and-ask, evidence
contract, phase order), `docs/reports/RECOGNITION_PHASE_GATES_CHECKLIST.md` (Gates 0–6), and the copy-paste
`docs/reports/NEXT_PROMPT_B_D0_QUALITY_RESHOOT.md`. **Next code step = D0 quality/reshoot, flag default OFF,
ONLY after a clean 24–48h monitor + owner "start D0".** HTR / second provider / OneBrain stay gated on GT from
different people + owner decision. Refined the contract: Gemini-first ≠ fan-out; HTR research ≠ implementation;
a Gemini top-version benchmark must precede any non-Gemini provider discussion. No code/flag/prod change.



**Gemini-first correction (this turn, docs-only follow-up PR):** removed near-term GPT-4o framing from all
roadmap docs. D1 near-term = Gemini family (top versions); second reader = provider-agnostic DISABLED slot
(GPT-4o/Claude NOT near-term); HTR research-only; no fan-out until ROI. Gated on GT breadth + owner decision.
PR #88 was already merged → this is a follow-up PR (NOT auto-merged per owner boundary). No code/flag/prod change.



**Recognition structure roadmap (docs-only, this turn):** PR #87 merged (monitoring baseline). Wrote truth map
(LIVE/PARKED/LEGACY/TARGET), target D0–D6 architecture, 10-phase build plan, and 5 copy-paste next-prompts —
see CHANGELOG. Build order: monitoring closeout → D0 quality → ReaderResult contract → OneBrain shadow → D2/D3/D4
→ Auditor; HTR/GPT-4o research only after GT from different people. No code/flag/prod change. Still a safety
wrapper, not a full brain. Next concrete agent step = Prompt B (D0 quality, flag default OFF) after monitoring is clean.



**Monitoring set up (this turn):** PR #86 merged (origin/main 08b183a). Read-only healthz workflow
`.github/workflows/prod-safety-monitor.yml` (every 6h, no secrets, self-no-ops after 2026-06-07 — delete after
window) + manual runbook `docs/reports/PROD_SAFETY_MONITORING_24H_RUNBOOK.md` (vercel logs/env, what-to-watch,
rollback policy: self-consistency first). No code/flag/env change. Next real unblock = GT from different people.

**Status: PASS_RUNTIME_VERIFIED.** prod == main == `7c6068c` (healthz ok, deploy READY). PRs #80–#85 merged.
Anti-fab gate firing is **prod-runtime-observed** (owner controlled hard-case upload: 8/10 review=true, ALL
identity protected; corroborated by logs — vision-extract 200 + metric, 0 errors) AND independently reproduced
by the agent's local real-model proof (5/5 identity forced, values unchanged, self_consistency mismatch) — the
two agree field-for-field. env flags present (`vercel env ls`); SMART absent. This is a **safety wrapper working
in prod**, NOT a full OneBrain (HTR/GPT-4o/consensus/OneBrain still NOT live, parked). **Next: monitor 24–48h**
(5xx, review_rate, self-consistency latency/cost, UI/PDF block, support). Rollback ready (env rm + redeploy,
self-consistency first if cost rises). Report: docs/reports/POST_RUNTIME_GATE_VERIFICATION.md.

--- prior (superseded) ---
Prod = `2d2a391` = origin/main (healthz verified). Review-gate fix (e298d97, PR #84) IS in prod. PRs #80–#84 merged.
Real extractions DID run in prod ~01:01–01:03 (3× vision-extract + 2× tps/ocr/extract, all 200, 0 errors in 3h)
→ `document_class_metric` emitted ×3 → **DOCUMENT_CLASS_METRICS runtime VERIFIED**; deployed safety code = no regression.
NOW CONFIRMED by agent (this turn): (1) env flags PRESENT in prod via `vercel env ls production` (CLI authed) —
ANTI_FABRICATION + SELF_CONSISTENCY + DOCUMENT_CLASS_METRICS present, SMART_NORMALIZE absent (ls shows presence
not the literal value); (2) gate FIRING proven on the identical readDocument code path locally (real Soviet birth
cert + gemini-3.1-pro + flags ON) → 5/5 identity forced review + reasons + values unchanged + self_consistency
mismatch caught. Report: docs/reports/POST_RUNTIME_GATE_VERIFICATION.md.
ONE residual (owner-only): a literal PROD HTTP hard-case extraction RESPONSE (needs a PII upload the agent won't do)
— flips gate from local-runtime-proven to prod-runtime-observed. Independent fix re-verify: tsc 0, suite 2859 passed.
See STATUS.md (Production Safety Gates table). Rollback: `vercel env rm ANTI_FABRICATION_GATE_ENABLED production --yes`

## 2026-06-04 — translation public wizard hardening

- Fixed the real public Translation Wizard gap:
  - unresolved OCR review fields could reach payment/download path in the legacy public flow
  - server `generate-pdf` did not reject unresolved OCR review fields from that payload
- Changed:
  - `apps/web/src/components/services/translation/TranslateWizard.tsx`
  - `apps/web/src/lib/translation/reviewGate.ts`
  - `apps/web/src/app/api/translation/generate-pdf/route.ts`
  - targeted tests for review gate + certifier UX
- Verified locally:
  - typecheck PASS
  - vitest PASS
  - build PASS
  - live local browser run proved `payDisabledBefore=true` with 4 OCR review flags, then `payDisabledAfter=false` after 4 explicit confirms
- Evidence: `docs/reports/TRANSLATION_REVIEW_HARDENING_2026-06-04.md`
- Exact next action:
  1. scoped commit these files
  2. deploy branch / merge
  3. rerun one production translation flow to move this fix from local-verified to prod-verified

## 2026-06-04 — target recognition scheme verification

- Added `docs/reports/TARGET_RECOGNITION_SCHEME_FILE_VERIFICATION_2026-06-04.md`.
- This is a file-by-file reconciliation of the requested D0..D6 + Auditor architecture versus the actual repository.
- Verified outcome:
  - D0 preprocess = real and live
  - parked consensus/HTR stack = real code, not the live default product spine
  - live spine = `documentFieldReader.ts` -> `geminiVisionProvider.ts` -> `arbitration.ts`
  - KMU-55 = live; gazetteer/patronymic = real but not universally active by default
  - review/PDF/audit pieces exist, but not yet as one exact shared runtime matching the target scheme
- Exact blocker:
  - the repo currently contains target docs, parked implementation, and live Gemini-core runtime at the same time
  - therefore "already exactly this scheme" is false
- Next action:
  - choose explicitly whether to migrate live runtime to the target scheme, or to revise the target scheme to match the proven live spine

## 2026-06-04 — latest audit / inventory reconciliation

- Added `docs/reports/LATEST_AUDIT_INVENTORY_RECONCILIATION_2026-06-04.md`.
- Purpose: separate fresh truth-layer reports from older partial snapshots that are now stale.
- Verified against code:
  - live reader remains `docintel/documentFieldReader.ts` with Gemini default provider
  - `ua_military_id` now exists in `docintel/documentRegistry.ts`
  - translation central-brain path remains gated, not the default spine
- Practical reading order now:
  - first trust `TARGET_RECOGNITION_SCHEME_FILE_VERIFICATION_2026-06-04.md`
  - then `ARCHITECTURE_INVENTORY_VERDICT.md`
  - then `BASELINE_MATRIX.md` and `ACCURACY_OFFON_RESULTS.md`
- Do not trust older `PROJECT_ARCHITECTURE_VERDICT.md` / `DOCUMENT_CLASS_EXTRACTION_MATRIX.md` as fully current without reconciliation.

## 2026-06-04 — critical live-door re-verify

- Added `docs/reports/CRITICAL_REVERIFY_LIVE_DOOR_2026-06-04.md`.
- Purpose: correct the overly coarse claim that several dictionary/gate pieces were "not yet in the brain".
- Verified from code:
  - `snapCity`, patronymic reconcile, authority resolve are already wired into the live `readDocument()` door
  - anti-fabrication and self-consistency are also already in `readDocument()`
  - all of the above are behavior-gated, not absent
  - `garbageGuard` is live in UI surfaces, but not server-side in `readDocument`
- Reading rule after this correction:
  - absent != flag-gated
  - parked != unreachable

## 2026-06-04 — project understanding master

- Added `docs/reports/PROJECT_UNDERSTANDING_MASTER_2026-06-04.md`.
- Purpose: establish one code-backed understanding of what this project actually is.
- Verified outcome:
  - this is not just an OCR subsystem; it is a multi-product USCIS workflow app
  - repo contains legacy TPS/product OCR, a current shared docintel/canonical spine, and a parked OneBrain/consensus target layer
  - accepted ADRs and current live code do not describe a single clean final architecture yet
- Practical implication:
  - future changes must be explicit about which architectural plane they touch
  - "brain", "core", and "central brain" are not interchangeable terms in this repo
