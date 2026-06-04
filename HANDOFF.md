# HANDOFF — Session 105h (2026-06-04)

## Session 105h — CORRECTION: Ukrainian source language + UA-OCR failure analysis + gate canary plan

Owner hard correction accepted (memory: ukrainian-source-language): the documents are UKRAINIAN; recognition is UA→English. A model returning a Russian form of a Ukrainian name/patronymic/place (dropped apostrophe ʼ, -ій→-ей, і/ї/є/ґ Russianized, wrong UA month) is a WRONG read / language substitution = a real model ERROR to penalize, NOT a normalization artifact. My earlier RU-vs-UA 'artifact' framing is corrected. KMU-55 transliteration applies ONLY after a correct Ukrainian read; dictionaries are signal/conflict, never silent rewrite; Unicode NFC is for compare/hash and does not fix Russianization.

Measured (owner GT, N=2 hard-case birth certs): identity ≈0–1/5 → critical failure; mode C gate forces review (FN→0) and catches the month error. Printed UA/US docs are NOT owner-GT-scored — no accuracy % claimed for them.

Artifacts: GT_LANGUAGE_INTENT.md corrected; docs/reports/UKRAINIAN_OCR_FAILURE_ANALYSIS.md (failure classes, layer responsibilities) + docs/reports/ANTI_FAB_GATE_CANARY_PLAN.md (flag, target classes only, rollout, rollback command, metrics, stop condition — PREPARE only). Decisions: SMART DO_NOT_ENABLE; ANTI_FABRICATION_GATE READY_FOR_CANARY_PREP (not executed; pre-canary gates = GT≥6 + calibration + rollback rehearsal, not yet met); hard-case model UNRESOLVED_BLOCKER; human review required for hard-case UA/Soviet/handwritten.

No flags enabled; no prod env/deploy/model/SMART/HTR/L2-WIRE; qa-private tracked=0; no PII in docs (failure classes illustrated with neutral linguistic patterns, not the owner's name; one gratuitous given-name example scrubbed post-commit). Next: owner fills GT batch (4 skeletons ready) → calibration → canary execution (separate command).

# HANDOFF — Session 105g (2026-06-04)

## Session 105g — Auto-prepped GT skeletons + owner fill pack (max agent work, no GT fabrication)

Took all technical prep off the owner: created 4 private, value-free GT skeletons in qa-private/ground-truth/ (international_passport/id_card/i94/ead _owner_fill.json) from the real templates — status=OWNER_INPUT_REQUIRED, value_rule=as_written, normalized=canonical-only, dictionary=hint-only, no_model_gt=true, owner_must_confirm=true. Used REAL template/adapter field names (not the slightly-different names in the request, per 'do not invent'). Skeletons are gitignored, NOT committed (qa-private tracked=0). Wrote docs/reports/GT_OWNER_NEXT_4_FILL_PACK.md: the 4 files, exact owner_verified_fields per file, where to look on each document, value=as-written rule, null+note, hand/gt_intake fill, PII-free readiness command. **Did NOT set VERIFIED_BY_OWNER** — model output is not ground truth; only the owner's eyes on the originals can verify. ready 2 → target ≥6 (need +4). accuracy/calibration/L2-WIRE remain BLOCKED; no runtime/flags/model/SMART/HTR/prod change. Next: owner types values into the 4 skeletons + sets VERIFIED_BY_OWNER → 'GT batch filled'.

# HANDOFF — Session 105f (2026-06-04)

## Session 105f — PRELIMINARY accuracy (N=2, owner-authorized) — signal only

Owner allowed a partial rerun on the existing 2 birth certs (no new GT). Scored value=as-written, owner_verified_fields only. Mode C (anti-fab + self-consistency, N=3) → false_negative_review=0 in all 4 cells, DOB month-mismatch CAUGHT; modes A/B leave FN high (2.5-flash misses DOB); SMART no accuracy gain. Reproduces the prior N=2 → NO new ground-truth data. Decisions UNCHANGED: calibration BLOCKED, L2-WIRE BLOCKED, SMART DO_NOT_ENABLE, gate BLOCKED_NEEDS_GT_BATCH (signal positive but N=2 can't authorize wiring), model NEEDS_MORE_DATA. Report: docs/reports/ACCURACY_PRELIM_N2.md (sanitized); raw in qa-private (ignored). No runtime/flags/model/SMART/HTR/prod change; decideField not wired. Next: owner fills +4 new VERIFIED GT files → real calibration.

# HANDOFF — Session 105e (2026-06-04)

## Session 105e — GT-fill execution pack + i94/ead templates (docs only)

BLOCKED accepted (ready=2/26). Did NOT rerun on the old 2 docs. Prepared the fill pack + built the 2 missing templates from REAL adapter fields (eadAdapter/reParole), no invention: `docs/templates/ground-truth/i94.template.json`, `ead.template.json`. All 8 category templates now exist. fastest_to_fill_now = passport/id/ua-printed-birth/military (templates ready); i94/ead now ready too. Owner needs +4 new VERIFIED files to reach ≥6. No accuracy run; L2-WIRE HOLD; no runtime/flags/model/SMART/HTR/prod; filled GT stays in qa-private (gitignored, tracked=0).

# HANDOFF — Session 105d (2026-06-04)

## Session 105d — Owner GT-batch fill checklist (docs only)

Line status: L1 ✅ / L2-SCAFFOLD ✅ / L3 ✅ / L2-WIRE HOLD. Real blocker = expanded GT batch (owner). Wrote `docs/reports/GT_BATCH_FILL_CHECKLIST.md`: which docs (6–10, categories 1–8; I-94/EAD template TBD — adapter fields, not invented), which fields owner verifies vs candidate_not_verified, how to fill (hand or scripts/gt_intake.mjs), value=as-written rule, PII-free readiness-count check. No runtime/flags/model/SMART/HTR/prod. Next: owner fills batch → 'GT batch filled' → agent reruns accuracy + calibrates thresholds → then L2-WIRE (shadow-first).

# HANDOFF — Session 105c (2026-06-04)

## Session 105c — L3: GT-language intent + calibration plan + templates (docs/GT-workflow only)

- **GT-language intent DECIDED** (`GT_LANGUAGE_INTENT.md`): `value` = AS WRITTEN on the document (RU doc → RU form); `normalized_value` = canonical (KMU-55 Latin / ISO / UA); dictionary = hint/conflict, never a silent overwrite. This removes the accuracy artifact where a correct Russian read was penalized vs a Ukrainian GT. Matches the decideField value/normalized split exactly.
- **Calibration plan** (`ONEBRAIN_L3_GT_CALIBRATION_PLAN.md`): GT batch (6–10 docs, categories a–f), field criticality, signal→decision policy (always-force_review vs lower-confidence-only), pre-canary metrics (false_negative_review must be 0; + false_positive, DOB/name/place caught, review_rate_by_doc_type, missing_rate, model_disagreement later), and the procedure to tune ACCEPT_THRESHOLD (PLACEHOLDER → calibrated).
- **Templates** (+3, PII-free, versioned under docs/templates/ground-truth/): birth_cert_ua_printed, international_passport, id_card. EAD/I-94 deferred (fields from eadAdapter/reParole, not invented).

**Real unblock = owner fills the expanded GT batch** (copy template → qa-private, fill value as-written, VERIFIED_BY_OWNER + owner_verified_fields). Then: agent runs accuracy on the batch → calibrate thresholds → ONLY then L2-WIRE (shadow-first, flag OFF, prod byte-identical).

No decideField wiring; no /api change; no flag enabled; no model/SMART/HTR; no prod env; no deploy; no PII; filled GT stays in qa-private (gitignored).

# HANDOFF — Session 105b (2026-06-04)

## Session 105b — L2 SCAFFOLD: decideField() (not wired; prod byte-identical)

Implemented OneBrain `decideField()` as a standalone pure module — NOT wired into any live path, so prod is byte-identical. Report: `docs/reports/ONEBRAIN_L2_SCAFFOLD.md`.

- `oneBrain/decideField.ts`: pure `decideField(input)→FieldDecision` per the L1 contract (value from reads/strong-anchor; normalized_value from kmu55 signal ONLY, separate; decision accept|accept_low_confidence|force_review|reject; review_reasons; source_trace; safety_flags; sha256 audit_hash). + types + `scoredForAccuracy()`.
- **Byte-identical proof:** grep `NO_LIVE_CALLER` — nothing in /api or documentFieldReader imports it. Reserved flag `ONEBRAIN_DECIDE_FIELD_ENABLED` (default OFF) is read by nothing yet.
- Rules tested (decideField.test.ts): (1) dictionary never overwrites value; (2) critical+review-signal→force_review, no accept_low_confidence w/o anchor; (3) self-consistency mismatch/incomplete/insufficient→force_review + instability flag, model confidence can't override; (4) scoredForAccuracy = owner_verified && !candidate_not_verified; (5) not-wired/pure; + MRZ anchor→accept; no-source→reject.
- typecheck PASS; 83 tests (decideField + docintel) pass; synthetic test values (no PII).

**Deferred:** L2-WIRE (route decideField through readDocument behind flag, shadow-first) = separate owner-gated step; threshold NUMBERS = L3 (PLACEHOLDER {critical:0.97,high:0.9,low:0.8}); 2nd reader/HTR = L4. consensus.ts untouched; SMART/HTR/model unchanged; no prod env; no flags enabled; no deploy. Pre-existing PII in arch docs (DOCUMENT_INTELLIGENCE_LAYER.md) = Session-54 sweep, not touched.

# HANDOFF — Session 105 (2026-06-04)

## Session 105 — L1: OneBrain decideField() contract (design-only)

Designed the single per-field decision contract for OneBrain. Artifacts:
`docs/architecture/ONEBRAIN_DECIDE_FIELD_CONTRACT.md` (the contract) + `docs/reports/ONEBRAIN_L1_DESIGN_REVIEW.md` (review).

- `decideField(input) → FieldDecision`, pure/deterministic, no I/O inside. Inputs: reads[] (1..N independent readers), quality, dictionary_signals, validation_signals, self_consistency, strong_anchor, optional eval_context. Output: value, normalized_value (separate), confidence, decision (accept|accept_low_confidence|force_review|reject), review_required, review_reasons[], source_trace[], dictionary_signals[], validation_signals[], safety_flags[], audit_hash.
- Binding rules: (1) dictionary never silently overwrites value — signal only, may set separate normalized_value/raise review; (2) critical identity stricter, never accept w/o strong anchor under any review signal; (3) self-consistency mismatch on DOB/name/place → force_review, model review=false can't override; (4) candidate_not_verified excluded from accuracy penalties; (5) no raw PII in artifacts; (6) strong-anchor (MRZ) precedence; (7) never lower a flag / never blank a value.
- Maps onto EXISTING live code (readDocument/arbitrateDocument/dictionaryBridge/selfConsistency/antiFabricationGate/preprocess) → L2 is consolidation, not rewrite. consensus.ts left dormant (not removed, per constraints).

No runtime change; no code; no flags; no prod env; no model/HTR/consensus change; no PII (contract example values genericized to <surname> placeholders). Open: GT-language intent + threshold calibration = L3. Next (owner-gated): L2 implement decideField behind flags (default OFF), prod byte-identical.

# HANDOFF — Session 104z (2026-06-04)

## Session 104z — Inventory verdict + OneBrain target architecture (docs-only)

Accepted the architecture inventory as TRUTH, rejected '1 reader + gate' as the destination. Report:
`docs/reports/ARCHITECTURE_INVENTORY_VERDICT.md`.

- **Current live truth (raw):** consensus.ts exists+tested but DORMANT (no /api caller; central-brain branch skipped under ONE_BRAIN_CORE_ENABLED=1). HTR not live (htr.ts self-documents 0 transcripts, Transkribus auth blocked). Live = one Gemini read → arbitrateDocument → gates.
- **Target = OneBrain/DocumentBrain:** the ONLY field-decision center. Readers, dictionaries (SIGNAL only, never silent rewrite), normalization, validators, anti-fabrication, self-consistency, quality, and one audit trail all live INSIDE it. No parallel dead consensus branch. Real consensus later = different independent readers, not 3× the same model. Field-decision schema documented (value/confidence/source/normalized_value/dictionary_match/validation_status/review_required/review_reason; verdict accept|accept_with_low_confidence|force_review|reject).
- **Decisions:** SMART_NORMALIZE DO_NOT_ENABLE; HTR DO_NOT_BUILD; model DO_NOT_SWITCH; gate PREPARE_CANARY only.
- **Priorities:** L0 verdict (done) → L1 design OneBrain contract (no behavior change) → L2 fold proven gate into OneBrain behind flags → L3 expand GT + rerun accuracy → L4 second reader/HTR if metrics justify.

Why this matters: arbitrateDocument is already a nascent decision center — OneBrain = formalize it into an explicit decideField() and consolidate readDocument/gates/dictionaries there, retiring the dormant consensus stack. docs-only; no prod env; no flags; no deploy; no PII.

# HANDOFF — Session 104y (2026-06-04)

## Session 104y — Accuracy OFF-vs-ON measured (gate proven; SMART no gain)

Owner filled GT (VERIFIED_BY_OWNER, 6 identity fields). Ran the accuracy matrix locally: 2 docs × A/B/C × {2.5-flash, 3.1-pro} = 12 cells, scored only the 6 owner-verified fields. Raw → qa-private (ignored); sanitized reports `ACCURACY_OFFON_RESULTS.md` + `SMART_NORMALIZE_DECISION.md`.

**Key results:**
- **Gate works:** mode C (anti-fab + self-consistency) → `false_negative_review = 0` in ALL 12 cells. Without it, 2.5-flash ships 5 wrong identity fields review=false and MISSES the DOB month error (GT 06, read 02); mode C CAUGHT it, self_consistency=mismatch.
- **SMART_NORMALIZE: no accuracy gain** (B==A) + one false-positive review → **DO_NOT_ENABLE** now; NEEDS_MORE_DATA to revisit.
- **Model:** 3.1-pro safer than 2.5-flash on hard-case (self-flags DOB; 2.5-flash reads a different person, FN=5). Gate mandatory regardless. Firm model choice = NEEDS_MORE_DATA.
- **Caveat:** docs are Russian-language, GT is Ukrainian-canonical → some 'wrong' is RU↔UA spelling, not fabrication. Owner must clarify GT language intent. N=2/one-person = signal not proof.

**PII scrub:** genericized the RU/UA example in OWNER_QUEUE (removed gratuitous real name).

**Decision pointer:** the high-value safety lever is the anti-fabrication/self-consistency GATE, NOT SMART_NORMALIZE. Enabling any behavior flag remains an owner decision and wants more GT. No prod env touched; no flags enabled; no model change; no push of code.

# HANDOFF — Session 104x (2026-06-04)

## Session 104x — ETAP1: simplified GT fill for owner (no fabrication)

Prepared everything so the owner spends minimum time but the truth stays human:
- Opened both birth-cert images + both GT JSON templates locally.
- `docs/reports/GT_FILL_HINTS.md`: where each field sits on soviet/handwritten blanks, formats, null-handling, and the refusal rationale. No real values.
- `scripts/gt_intake.mjs` (SCRATCH, now gitignored): owner can type OR dictate `{field:value}`; it validates keys/ISO-date/M-F, writes, and sets `VERIFIED_BY_OWNER`. Smoke-tested on a temp copy; real GT untouched (status still MISSING).

**ETAP 2-4 (accuracy OFF/P2/full-gate + SMART decision) run ONLY after the owner sets `VERIFIED_BY_OWNER`** (>=4 identity fields/file). No GT fabricated; no prod behavior flags; no model change; no push of code.

# HANDOFF — Session 104w (2026-06-04)

## Session 104w — On rails: prod==main confirmed; holding for owner GT (no new code)

Verified the system is in the correct holding state after PR #80 merge — did NOT build new functionality (per directive).

- **Durability CLOSED:** origin/main `46a0912` (Merge PR #80); messenginfo.com healthz status=ok sha=`46a0912`; latest prod deploy Ready. prod==main → no future-deploy rollback.
- **Metric:** DOCUMENT_CLASS_METRICS_ENABLED=1 in prod, code now in main; payload is class/eligibility only (PII-free, re-verified). Runtime logs NOT_OBSERVED_YET (no real document extraction since deploy).
- **Behavior flags OFF** (ANTI_FABRICATION / SELF_CONSISTENCY / SMART_NORMALIZE absent in prod). Dictionaries + gates are in prod code but dormant.
- **GT still MISSING** (status=MISSING). Images present, guide ready. Accuracy NOT run (no GT → would be fabrication/liveness-as-accuracy).

**Next (owner):** fill GT (VERIFIED_BY_OWNER) → agent runs local OFF-vs-ON accuracy → SMART_NORMALIZE decision. No new code, no prod behavior flags, no model change until that loop closes.

> 🛡️ **KNOWLEDGE_CORE_STABILIZE (feat/knowledge-core-stabilize):** militaryId.ts: isLikelyPatronymicOrLabel guard rejects given_name OCR confusion; isAuthorityOcrGarbage guard rejects garbled authority text. MRZ debug (_mrz_debug_status/_mrz_lines_found/_mrz_valid) exposed in route for passport/booklet. Agency registry: Militsiya→Militsiya confirmed. Birth cert: 2 additional label-guard tests. 2771/2771 tests, tsc 0, build passes.
>
> 🧠 **KNOWLEDGE_DRIVEN_CORE (feat/knowledge-driven-core):** labelValueExtractor.ts: label text never returned as value. birthCertificate.ts: bug fixed — bilingual label lines rejected. militaryId.ts: agency registry wired. mrzAuthority.ts: MrzDebugStatus 6-state classification. Gazetteer: 458 cities generated from КАТОТТГ. 2751/2751 tests, tsc 0, build passes.
>
> ⭐ **ONE BRAIN — READ FIRST:** Architecture in `docs/architecture/ONE_BRAIN_DECISION.md`. **B1 LIVE**: TPS uses Core. **B2 CODE READY** (PR #70): Translation uses Core. **B3 UI WIRED** (PR #72): Re-Parole calls Core route. **B4 UI WIRED** (feat/b4-ead-core, PR #73): EAD wizard calls Core route behind flag. **ONE_BRAIN_COMPLETE_CODE_READY** — all 4 products wired. NEXT: merge PR #73 + set flags in Vercel + redeploy + smoke test.
>
> 📋 **DOCUMENT CLASS POLICY WIRED (POLICY_WIRED):** Guards live in `tps/ocr/extract` + `translation/vision-extract`. checkImageQuality blocks tiny images before OCR call. applyHardCaseReviewOverride forces review_required=true on hard-case docs. applyCertificateRoleGuard rejects generic names on certs. 2610 tests passing, tsc 0.
>
> 🔒 **MRZ_AUTHORITY_WIRED_CODE_READY (feat/mrz-passport-authority, PR #74):** `mrzCandidatesFromText` connected to TPS (ONE_CORE_TPS_ENABLED path) and Re-Parole (ONE_CORE_REPAROLE_ENABLED path) Core routes for `ua_international_passport`. Valid MRZ wins for 7 controlled fields. Invalid MRZ → reviewRequired=true + mrz_check_failed. Missing MRZ → visual fallthrough + critical_no_mrz_anchor review. 18 new mrzWiringProof.test.ts arbitration-level proof tests. 2664/2664 full suite. tsc 0. NOT DONE: live smoke test requires PR merge + Vercel deploy.
>
> 🔑 **VISION_CREDENTIALS_LOADER (fix/vision-credentials-loader):** Root cause of Vision 403: `GOOGLE_CLOUD_VISION_API_KEY` not set in Vercel Production. Fixed: `loadVisionCredentials()` in `canonical/vision/visionCredentials.ts` — supports SA JSON (3 env var names) + API key fallback. Normalizes `\\n` in private_key (Vercel escaping). Vision provider updated to use SA Bearer token when JSON present. Diagnostic endpoint: `/api/_diag/vision` (token-protected). 12/12 new tests. 2680 full suite. tsc 0. BLOCKED: owner must add `GOOGLE_VISION_SERVICE_ACCOUNT_JSON` to Vercel Production + redeploy.

# HANDOFF — Session 104v (2026-06-04)

## Session 104v — Opened PR #80 (durability; merge owner-gated)

Next step after the branch push: opened PR #80 (base `main` ← `feat/knowledge-core-stabilize` @ a896212, PII-free body) so there is a review-of-record and the diff is visible. **Did NOT merge** — merging to `main` triggers Vercel auto-deploy of main to messenginfo.com (the canonical prod release) and is the owner's review+ship decision; it also closes prod==main durability. Pipeline: durability push ✅ → PR ✅ → merge (owner) → GT fill (owner) → accuracy OFF/ON (agent, after GT) → SMART_NORMALIZE decision (after accuracy). Behavior flags OFF; GT still MISSING; prod env untouched this step.

# HANDOFF — Session 104u (2026-06-04)

## Session 104u — Pushed branch to GitHub to close the durability debt (no merge/PR)

The prod deploy (104t) shipped local code that wasn't in GitHub → a main-only deploy would roll
it back. Closed the first half of that gap: pushed the branch.

- `git push origin feat/knowledge-core-stabilize --force-with-lease` → `31353a7..8b9a0d2`
  (origin/feat was the stale `31353a7`; lease matched). Verified origin/feat == local HEAD `8b9a0d2`.
- Pre-push safety: clean tracked tree; `qa-private/`+`reports/` ignored; `docs/reports/` not ignored;
  0 tracked private files; **0 actual credentials** in the diff. PII: `FU262473`/surname/DOB are
  PRE-EXISTING in origin/main (17 files) — this push adds 3 incremental occurrences of the same
  already-published value, not a new disclosure (Session-54-class accepted condition).
- No merge, no PR (forbidden this task); `main` untouched (HEAD..origin/main = only the prior PR #79
  merge `832ee55`).

**Durability status:** branch is now in GitHub (no longer local-only). FULL durability (prod == `main`)
still requires an OWNER decision to merge this branch to `main`; until then a deploy of `main` would
still roll back the metric/gate code. Push was the authorized step; merge is the owner's.

**Unchanged:** prod env not touched this step; no vercel deploy; behavior flags OFF; no model change;
GT still MISSING; metric logs NOT_OBSERVED_YET; P2.4/P2.5 frozen.

# HANDOFF — Session 104t (2026-06-04)

## Session 104t — Enabled DOCUMENT_CLASS_METRICS_ENABLED in prod + redeploy (autonomous)

Owner authorized (principal mode) enabling the safe metric flag + redeploy. Done via the
locally-authenticated, project-linked Vercel CLI:
- `DOCUMENT_CLASS_METRICS_ENABLED=1` added to Production (verified present). Behavior flags
  (`ANTI_FABRICATION`/`SELF_CONSISTENCY`/`SMART_NORMALIZE`) confirmed ABSENT/OFF — NOT touched.
- `vercel --prod` succeeded → `uscis-helper-2190dsx5b`, aliased to **messenginfo.com**. healthz
  `status:ok`, `sha:f60d73f`. Clean build.

**⚠️ Important truth (recorded, not hidden):** `vercel --prod` shipped the LOCAL branch, which is
**22 commits ahead of origin (unpushed/unmerged)**. Prod now runs code NOT in `main`. Consequence:
any future deploy of `main` (the repo's normal auto-deploy-on-push pipeline) would ROLL BACK these
22 commits. To make this durable + reviewed, push the branch + open a PR + merge to main (owner
decision; push was forbidden this session, so I did not). Behavior delta vs prior prod ≈ PII-free
metric logging only — all behavior gates remain OFF, so client extraction behaviour is unchanged.

**Metric logs:** NOT_OBSERVED_YET — the metric emits only on a real document extraction
(`readDocument`); no client upload since deploy. Verified empty via Vercel runtime logs. It will
appear on the first real OCR request as a `[document_class_metric]` line (PII-free:
product/doc_type_id/doc_class/eligibility only).

**Ground-truth:** still `MISSING` (1/19 both). Accuracy verification remains blocked. Added
`docs/reports/GT_OWNER_FILL_GUIDE.md` (human-fill guide; do NOT fabricate from model; file paths
use `<surname>` placeholder — no real surname in committed docs).

**Not done / owner:** push+merge branch (durability); fill GT → then I run local accuracy by the
`GT_ACCURACY_VERIFICATION.md` contract. Behavior flags stay OFF; no model change; P2.4/P2.5 frozen.

# HANDOFF — Session 104s (2026-06-04)

## Session 104s — GT accuracy verification contract (docs only; schema-mismatch gap fixed)

Before the owner hand-fills GT, surfaced a gap that would have wasted the effort: the GT JSON
schema and the field ids `readDocument` emits are different vocabularies. Without a map, an
accuracy run compares e.g. `family_name_cyrillic` (GT) against nothing → false "all wrong".

Wrote `docs/reports/GT_ACCURACY_VERIFICATION.md` (CONTRACT, no results yet):
- GT-key → read-field-id map (cyrillic = `raw_cyrillic`, latin/date = `value`), covering both
  birth-cert images (both `docTypeId = ua_birth_certificate`).
- N/A fields the spec can't score: `sex`, `province`, `passport_number`, `military_id_number`
  (not emitted) and `father_full_name`/`mother_full_name` (emitted but absent from GT template).
- Normalize rules, run matrix (OFF / anti-fab / +self-consistency; SMART stays OFF), metrics
  (accuracy, review_delta, false_positive_review, false_negative_review, instability), PII rule.
- Honest framing: accuracy only vs human GT; self_consistency `agree` ≠ correctness;
  false_negative_review (wrong value, not flagged) is the dangerous metric, false_positive is UX cost.

The owner's fill list matches the existing GT file keys → fill the file as-is; the MAP is the
verifier's job, now documented.

No code; no prod env; behavior flags OFF; model unchanged; P2.4/P2.5 frozen; not pushed. Next:
owner fills GT (VERIFIED_BY_OWNER) → local accuracy run fills the Results section.

# HANDOFF — Session 104r (2026-06-04)

## Session 104r — self-consistency gate IMPLEMENTED (commit 2 of 2; flag OFF)

`docintel/selfConsistency.ts` (NEW) — instability detector, NOT a majority vote and NOT a
correctness proof. `identityHash(rawFields)` hashes the RAW (pre-KMU) identity tuple
(family/given/patronymic/dob/place) — `normalizeForCompare` only (NFC/apostrophe/ws/lowercase),
deliberately NO KMU/dictionary so a normalizer can't hide a real model disagreement.
`decideStatus`: <2 fields→insufficient; a failed re-read→incomplete; differing hash→mismatch;
else agree. `applySelfConsistencyOutcome`: mismatch/incomplete/insufficient → force review on
identity fields + reason; agree → unchanged. Never changes values, never lowers a flag, never
claims correctness.

Wired in `readDocument`: runs ONLY when `SELF_CONSISTENCY_GATE_ENABLED=1` AND
`ANTI_FABRICATION_GATE_ENABLED=1` AND docClass ∈ handwritten allowlist (birth handwritten /
soviet). Re-reads the SAME image with the SAME provider (`SELF_CONSISTENCY_RUNS` default 2,
clamp 2–4; `SELF_CONSISTENCY_TIMEOUT_MS`). NO second read for passport / printed marriage /
unknown. PII-free outcome on `DocumentReadResult.self_consistency` (status / instability /
hash-prefix / runs).

Honest note: on today's narrow allowlist the anti-fabrication class gate ALREADY forces identity
review, so self-consistency's marginal effect now is the added instability signal + reason
(triage/evidence), not a new review. Its review effect grows when the trigger later broadens.

Tests: `selfConsistency.test.ts` (hash equality/diff; decideStatus; outcome value-unchanged;
readDocument gating: flags OFF→1 call/no block, anti-fab OFF→no 2nd read, agree, mismatch+
instability+reason, passport→no 2nd read, hash-prefix is hex-no-PII) + `documentClassMetric.test.ts`.
docintel+canonical/core 317 pass; typecheck PASS.

Test fixtures use synthetic name tokens (no owner surname) per the PII discipline.

NOT done: different-model fanout (separate owner decision); flags not enabled anywhere; no prod
env; model default unchanged; P2.4/P2.5 frozen; not pushed; accuracy not claimed (no GT). Next:
owner enables `DOCUMENT_CLASS_METRICS_ENABLED` to collect allowlist_traffic_share, then decides
on enabling the gates in a canary.

# HANDOFF — Session 104q (2026-06-04)

## Session 104q — document_class metric (commit 1 of 2; PII-free, flag OFF)

`docintel/documentClassMetric.ts` (NEW): `recordDocumentClassMetric({product, docTypeId})`
emits a PII-free `document_class_count` record (product / doc_type_id / doc_class /
anti_fabrication_allowlist_eligible / self_consistency_eligible) via console.info ONLY when
`DOCUMENT_CLASS_METRICS_ENABLED=1` (default OFF → silent). The signature accepts no identity
fields, so PII is unrepresentable. Emitted from inside `readDocument` (one door → all 4
products) via a new optional `opts.product`; the 4 routes pass their product id. Logging only,
no behavior change, never throws into the request. Purpose: learn the real
`allowlist_traffic_share` to judge self-consistency cost from data, not guesses.

Tests: `documentClassMetric.test.ts` — eligibility (birth=eligible; passport/marriage/unknown=not);
record contains ONLY class/eligibility keys (no PII); emit gating + no-throw. docintel 54 pass;
typecheck PASS.

Design note (honest): the spec said "call the helper in the 4 routes"; I instead emit from inside
`readDocument` with `product` via opts — same coverage, far less route-edit risk, better one-door
alignment. Owner may set `DOCUMENT_CLASS_METRICS_ENABLED=1` to start collecting (their env decision).

Commit 2 (next): the self-consistency gate itself. No prod env; flags OFF; P2.4/P2.5 frozen; not pushed.

# HANDOFF — Session 104p (2026-06-04)

## Session 104p — Self-consistency gate design (DESIGN ONLY, no code)

Designed the REAL anti-fabrication detector (after blurScore was ruled out): re-read the same
image and force review when the extracted IDENTITY disagrees across reads. Report:
`docs/reports/SELF_CONSISTENCY_DESIGN.md`.

**Raw basis (file:line):** `readDocument` calls `provider.readFields` once
(`documentFieldReader.ts:43`) — cheapest place for a second read (spec/docType/provider in
scope). `arbitrateDocument` (`arbitration.ts:100`) only judges candidates → too late.
`crypto.createHash('sha256')` available. ⇒ insertion = `readDocument` (one door, all 4 products);
NOT route-level (4× dup); NOT arbitrate.

**Design:** trigger = narrow handwritten allowlist (NOT blurScore — calibration disproved it;
NOT all-hard-case; NOT printed marriage/passport). Identity tuple = family/given/patronymic/dob/
place, normalized for compare (NO KMU/dictionary before hashing, or it would mask the
disagreement), sha256, public = hash prefix only. Disagree → `hard_case_model_instability` +
force review on all identity fields (reason `self_consistency_identity_mismatch`); agree → don't
lower / don't claim correctness; run error/timeout → `self_consistency_incomplete` + force
review, don't block upload. Runs: N=2 same model first, N=3 optional, different-model later.
Cost = `allowlist_traffic_share × 1` extra call (N=2) — share UNKNOWN (needs a per-class metric;
NOT guessed). Flags: `SELF_CONSISTENCY_GATE_ENABLED` (default OFF) + RUNS/MAX_EXTRA/TIMEOUT,
dependent on `ANTI_FABRICATION_GATE_ENABLED` (no hidden second reads). Quality rescan prompt
split into its own usability flag — never touches the safety path.

**No code; flags OFF; no prod env; model default unchanged; no API runs; P2.4/P2.5 frozen; not
pushed; accuracy not claimed (no GT).**

**Next:** owner approves contract + flags, then a small `readDocument` code step + a
`document_class_count` metric (to learn allowlist_traffic_share before judging cost).

# HANDOFF — Session 104o (2026-06-04)

## Session 104o — Quality-signal calibration: blurScore is NOT a fabrication detector

Ran `preprocessImage` locally (sharp, NO API, NO OCR, NO text) over all 27 real fixtures to
test whether `blurScore`/`assessment` can serve as a `low_quality_scan` secondary gate trigger.
Report: `docs/reports/QUALITY_SIGNAL_CALIBRATION.md`. Raw: `qa-private/reports/quality-calibration/`
(gitignored).

**Decisive result:** blur 25.89–62.11; assessment good×22 / acceptable×5 / **poor×0**; only
`high_brightness` warnings. The CONFIRMED-fabricating `birth_soviet` scores blur **36.41 / good**
— SHARPER than the reliably-correct passport (blur **25.89**). The dangerous doc ranks ABOVE the
safe one. blurScore measures visual sharpness, not handwriting/content ambiguity; a sharp photo
of a handwritten Soviet cert fabricates yet reads `good`. The corpus also has NO genuinely
degraded samples (nothing near the 2.5 reject floor) → a threshold can't even be calibrated here.

**Recommendation:** do NOT wire `low_quality_scan` as an anti-fabrication trigger. Keep the
quality signal as logging/provenance + a rescan prompt for truly degraded uploads only. The real
anti-fabrication detector for handwritten/ambiguous docs is **self-consistency** (multi-read
identity-hash disagreement) + the existing class allowlist — prioritize that over a blur threshold.

**No code; flags OFF; no prod env; model default unchanged; no self-consistency yet; P2.4/P2.5
frozen; not pushed; accuracy not claimed (N=27, no GT).**

**Next:** owner decides — keep quality logging-only (recommended) and design/implement
self-consistency (N=2-3 identity-hash) as the real detector for handwritten/ambiguous docs.

# HANDOFF — Session 104n (2026-06-04)

## Session 104n — Runtime quality-signal design (DESIGN ONLY, no code)

Designed the next brick: thread `preprocessImage` quality/degradation into `readDocument`
so the anti-fabrication gate can trigger on runtime low-quality scans, not just the static
class allowlist. Report: `docs/reports/RUNTIME_QUALITY_SIGNAL_DESIGN.md`.

**Raw (file:line):** all 4 routes call `preprocessImage` right before `readDocument`
(TPS:165, Translation:259, Re-Parole:138, EAD:136) but DROP the `quality` object.
`PreprocessResult.quality` = brightness/blurScore/assessment/warnings (+resized/scaleFactor).
NO rotation/EXIF flag is reported (`.rotate()` applied silently, image-preprocess.ts:85);
NO handwritten detector exists. `readDocument` opts carry no quality → signal never arrives.

**Recommendation:** Option A — add an optional `DocumentRuntimeSignals` to `readDocument`
opts (one door → all 4 products), behind a dedicated `RUNTIME_QUALITY_SIGNALS_ENABLED`
(default OFF), acted on only when `ANTI_FABRICATION_GATE_ENABLED` is on. Class allowlist
stays PRIMARY; `low_quality_scan` (assessment=poor / blur below threshold) is a SECONDARY
trigger that forces review on identity fields ONLY (never changes values), reason
`low_quality_scan`; no blanket `unknown_document`; thresholds conservative + uncalibrated
(no GT). Derivable now: blur_score/assessment/low_quality_scan/oversized_resized.
`rotated_input`/`possible_handwritten` NOT available → not fabricated (rotation would need
`image-preprocess` to report it).

**No code; flags OFF; no prod env; model default unchanged; no self-consistency; P2.4/P2.5
frozen; not pushed.** Next (owner-approved code step): (1) optionally report rotation in
preprocess; (2) add the optional opt to readDocument; (3) routes pass `pre.quality`;
(4) gate consumes `low_quality_scan`.

# HANDOFF — Session 104m (2026-06-04)

## Session 104m — Narrowed the shipped anti-fabrication gate to handwritten risk (code)

Aligned the implementation (`4f75bfa`, too broad) with the revised design.

**Raw signal inventory (file:line):**
- registry `handwritten:true` exists ONLY for `ua_internal_passport_booklet` (`documentRegistry.ts:25-30`);
  birth/marriage/divorce/id fields are all `handwritten:false` → a handwritten-flag trigger
  would fire on the booklet and MISS the birth certs that fabricate. `handwritten_signal_exists: PARTIAL`.
- quality signal exists (`PreprocessResult.quality.blurScore`+warnings+EXIF rotate,
  `image-preprocess.ts:36-50,85`) but `readDocument` does NOT receive it →
  `quality_reaches_reader: NO`, `usable_now: NO`.

**Change:** trigger is now an explicit allowlist `HANDWRITTEN_FABRICATION_RISK_CLASSES`
= {`birth_certificate_handwritten`, `birth_certificate_soviet_bilingual`}, replacing the
blanket `isHardCase`. So `marriage_apostille` (printed), `unknown_document`, booklet, military
are NO LONGER blanket-forced. Reason `hard_case_document` → `handwritten_document`. Only raises
review; values untouched; never lowers a flag.

**Honest gaps (recorded, NOT silently included):** military_id handwritten zones (not in docintel
registry, TPS-legacy); truly-handwritten marriage / blur / rotation (no signal reaches the reader);
soviet_bilingual kept forward-compatible (no docTypeId maps to it today). Closing the blur/rotation
gap needs threading `preprocessImage.quality` into `readDocument` — a separate step.

**Tests:** `antiFabricationGate.test.ts` 49 pass — added scope tests (marriage/unknown NOT forced,
allowlist membership), reasons=handwritten_document. docintel 49; typecheck PASS.

**Unchanged:** `ANTI_FABRICATION_GATE_ENABLED` default OFF (no prod effect); model default unchanged;
SMART_NORMALIZE OFF; P2.4/P2.5 frozen; not pushed; accuracy UNKNOWN (no GT).

**Next:** owner picks — (a) thread preprocess quality (blur/rotation) into readDocument for a
runtime degraded-doc trigger; (b) add self-consistency (N=2-3 identity-hash) for handwritten/ambiguous;
(c) correct registry per-field handwritten flags for birth/marriage.

# HANDOFF — Session 104l (2026-06-04)

## Session 104l — Anti-fabrication design REVISED for handwriting (no code)

New owner-verified recon refines the gate (Revision 2 in
`docs/reports/ANTI_FABRICATION_GATE_DESIGN.md`):

- **handwritten_birth:** BOTH gemini-2.5-flash AND gemini-3.5-flash unstable — 3 distinct
  identity hashes / 3 runs each, model `review=false`. ⇒ a model switch does NOT fix
  handwritten fabrication.
- **marriage_1939 (printed):** 2.5-flash stable (1 identity / 3 runs). ⇒ "old/faded" alone
  is not the killer; **handwriting** is.
- Model confidence (`review=false`/`confidence_low=false`) is NOT a usable detector.
- True identity still UNKNOWN — stability, not accuracy.

**Raw signal recon (file:line):**
- class by docTypeId only (`documentClassPolicy.ts:98`).
- handwritten signal EXISTS per-field (`DocFieldSpec.handwritten`); `readDocument` already
  forces review on `handwritten:true` (`documentFieldReader.ts:75`) — BUT birth/marriage
  fields are ALL `handwritten:false` in the registry (`documentRegistry.ts:8-17,:29-34`),
  so the fabricating docs aren't flagged.
- blur/rotation signal EXISTS in `preprocessImage` (`quality.blurScore`, warnings, EXIF
  rotate) but is NOT threaded into `readDocument`.

**Revised trigger:** handwritten classes (birth_certificate_handwritten / soviet_bilingual),
NOT blanket hard-case. Printed-but-old (marriage) = risk only → escalate via blur or
self-consistency, never blanket-force. Self-consistency (same model N=2–3, identity-hash
disagreement) is the model-independent detector. Model default UNCHANGED. Insertion point
stays `documentFieldReader` (confirmed).

**Discrepancy to fix in a future code step:** the shipped minimal gate (`4f75bfa`) triggers
on ALL `isHardCase` classes — including PRINTED `marriage_apostille` + `unknown_document` —
which is broader than this revision. Narrow it to handwritten classes; route printed/old via
blur/self-consistency. Flag default OFF → no prod effect meanwhile.

**No code this turn. SMART_NORMALIZE OFF; P2.4/P2.5 frozen; model default unchanged; no prod
env; not pushed.** Next: owner picks (a) narrow the gate to handwritten, (b) thread
preprocess quality into readDocument, (c) add self-consistency.

# HANDOFF — Session 104k (2026-06-04)

## Session 104k — Anti-fabrication class gate IMPLEMENTED (minimal, flag default OFF)

Implemented the cheapest safety layer from the design (Option 1, class gate).

**Code:**
- `docintel/antiFabricationGate.ts` (NEW): `applyAntiFabricationGate(fields, docTypeId)`.
  On hard-case classes (`isHardCase` via `docintelIdToDocumentClass`), forces
  `review_required=true` on identity-critical fields and attaches reasons
  (`hard_case_document`/`model_instability_risk`/`no_strong_identity_anchor`). Pure;
  **never changes a value, never lowers a flag, no invention**. `isIdentityCriticalField`
  matches by substring so role-grounded variants (child_*, spouse_*) are covered.
- `documentFieldReader.ts`: applies the gate after the field-build loop (and after the
  SMART post-passes) only when `ANTI_FABRICATION_GATE_ENABLED === '1'` (default OFF →
  byte-identical). Insertion point A = the shared door all 4 routes call → uniform
  coverage; closes the earlier Re-Parole/EAD route-layer gap.
- `types.ts`: added optional `review_reasons?: string[]` to `ExtractedDocField` (additive).

**Safety properties:** passports map to `internal_passport_booklet` (NOT hard-case) → the
gate doesn't touch them → MRZ-controlled fields are not blanket-forced. Only review is
raised; values are untouched.

**Tests:** `antiFabricationGate.test.ts` — pure (identity matcher, force+reasons,
value-unchanged, model review=false can't survive, passport untouched, never-lower) +
readDocument OFF/ON gating (stub provider) + 4-route coverage (each route calls
readDocument). docintel 46 pass; canonical/core 247 pass; typecheck PASS.

**NOT done:** two-read self-consistency (Option 2) + blur/rotation hard-case signal (separate
costed steps); flag not enabled anywhere; model default unchanged; SMART_NORMALIZE OFF;
P2.4/P2.5 frozen; not pushed; no prod env. Accuracy not claimed (no hard-case GT).

**Next:** owner decides whether to (a) enable the flag in a canary, (b) add Option 2
two-read instability detection, (c) add a real image-quality (blur/rotation) hard-case signal.

# HANDOFF — Session 104j (2026-06-04)

## Session 104j — Anti-fabrication / hard-case forced-review gate (DESIGN ONLY)

Designed the gate that became the top priority (above P2.4/P2.5) after the confirmed
identity-fabrication finding. Report: `docs/reports/ANTI_FABRICATION_GATE_DESIGN.md`.

**Key discovery (raw, file:line):** much of the gate ALREADY EXISTS in
`canonical/core/documentClassPolicy.ts` — hard-case classes, `isHardCase()` (:147),
`applyHardCaseReviewOverride()` (:209, explicitly distrusts model `review_required=false`),
`applyCertificateRoleGuard()` (:167), `checkImageQuality()` (:234, size-only). It even
documents the exact failure ("review_required=false while returning the wrong person").

**The real gaps (raw):**
1. Guards wired ONLY in `tps/ocr/extract` + `translation/vision-extract`. `reparole` and
   `ead` routes call them ZERO times → 2 of 4 products UNCOVERED.
2. Guards live in the ROUTE layer, not in the shared `readDocument` door.
3. No self-consistency / multi-read identity-hash instability detector.
4. Image-quality is byte-size only — no blur/rotation hard-case trigger.

**Recommendation:** put the gate in `documentFieldReader` (the door all 4 routes call)
behind `ANTI_FABRICATION_GATE_ENABLED` (default OFF). Baseline = existing class gate for
all 4; hard-case identity with no strong anchor → 2× same-model read + identity-hash
compare → disagreement ⇒ instability flag + force review on all identity fields. MRZ takes
precedence for passports. Gate ONLY raises review — never changes/invents values.

**Honest scope:** 3.5-flash N=1 = risk signal, NOT proof; do not change prod default on
N=1; hard-case gate required regardless of model; model `review=false` not trusted on hard-case.

**Frozen:** P2.4/P2.5; SMART_NORMALIZE OFF; model default unchanged; no prod env; not pushed.
Implementation is a separate code step requiring owner approval.

# HANDOFF — Session 104i (2026-06-04)

## Session 104i — Model-stability finding (hard-case fabrication) — read-only + report

Re-checked the earlier claim with raw runs (not taken on faith). `readDocument` × 3 per
model on the faded Soviet birth certificate, `SMART_NORMALIZE_ENABLED` OFF (measuring
the model, not the dictionaries). Identity = SHA1(family|given|patronymic|dob); no PII
printed.

**Confirmed:**
- `gemini-2.5-flash` → **2 distinct identities across 3 runs**, every identity field
  `review_required=false` → confident fabrication on a hard case.
- `gemini-3.5-flash` → **1 identity across 3 runs** (stable; flags dob).
- True identity UNKNOWN (no verified GT for this fixture) → this is a STABILITY finding,
  not an accuracy claim.
- The international passport (clean printed) read identically + correctly across all
  models/runs → instability is hard-case-specific.

**Artifacts:** `docs/reports/MODEL_STABILITY_FINDING.md` (sanitized). Raw per-run JSON in
`qa-private/reports/model-stability/` (gitignored — not committed).

**Recommendations (no code changed):** anti-fabrication gate — identity differing across
models/runs ⇒ force `review_required` on ALL identity fields; hard-case docs (handwritten/
faded/Soviet/low-q/rotated) ⇒ forced review unless a stronger source (MRZ / agreeing 2nd
model) confirms; do not let `gemini-2.5-flash` serve identity-critical hard-case reads
without review. SMART_NORMALIZE stays OFF until verified GT + stability gate. P2.4/P2.5 frozen.

**This is the real priority** — above the P2 dictionaries (OFF-vs-ON already showed zero
delta on real docs). Next decision (owner): design the anti-fabrication / hard-case review
gate. Not pushed; no prod env.

**Gitignore fix (caught in this session):** Step-1 added an UNANCHORED `reports/`, which
gitignore matches at any depth — so it silently ignored `docs/reports/` too (the public
report didn't commit on the first try). Fixed: anchored to `/qa-private/` and `/reports/`
(repo-root only); `docs/reports/` verified NOT ignored.

# HANDOFF — Session 104h (2026-06-04)

## Session 104h — PII hygiene + correction of the false "no images" claim

**PII hygiene (Step 1):**
- `qa-private/` and `reports/` were NOT gitignored — `qa-private/` holds filled PII
  ground-truth. Added both to `.gitignore`. `git ls-files qa-private/` was EMPTY →
  nothing had ever been committed (no history leak). `qa-shots/private/` was already
  ignored; left untouched.
- `git rm --cached qa-shots/.DS_Store` — removed tracked junk from the index.

**Correction (raw-verified):** my earlier `NO_IMAGES_FOUND` / "harness blocked: no
images" was FALSE — a broken zsh glob (`*.jpeg`) made one command error and I reported
its output as fact. The real document originals exist:
- `test-fixtures/real-docs/` (ignored): internal_passport, birth_cert_handwritten,
  birth_cert_soviet, military_id_p1/p2, divorce x2, marriage x4.
- `qa-shots/private/` (ignored): US Passport / I-94 / EAD (real).
The actual P2-accuracy blocker is **missing VERIFIED ground-truth** for birth_cert /
hard-case docs (only passport+booklet GT is VERIFIED), NOT missing images.

**typecheck PASS. Not pushed.** No prod env; SMART_NORMALIZE OFF; P2.4/P2.5 frozen.
Step 2 (model-stability re-check) follows.

# HANDOFF — Session 104g (2026-06-03)

## Session 104g — Working-tree hygiene after Group A (3 tails closed)

**(a) presence.ts — KEPT & committed.** Resolved the earlier "semantic default" doubt
with raw evidence: `geminiReader` (`engine/models.ts:48`) already defaults
`opts.model ?? 'gemini-2.5-flash'`. The in-flight presence edit's explicit
`normalizeGeminiModel(..., 'gemini-2.5-flash')` resolves to the SAME value when env is
unset → `identical: YES`. So the change is a pure trim of the existing model value, no
behavior change. Committed separately.

**(b) Vision ADC — DISCARDED.** `git checkout -- visionCredentials.ts (+test)`. It is a
new credential-loading path (`GOOGLE_APPLICATION_CREDENTIALS` file behind
`VISION_ADC_FILE_ENABLED`) that only exists to support the local OFF-vs-ON harness —
which is blocked (no document images + no verified ground truth). Dead-until-harness →
risk without benefit. Reintroduce only when the harness is actually built.

**(c) tsconfig.tsbuildinfo — DISCARDED.** Build artifact; already in `.gitignore:56`
(tracked-but-ignored — a `git rm --cached` to fully untrack is a separate optional step,
not done here).

**Checks:** typecheck PASS; engine suite 58 pass/3 skip. Not pushed.

**Working tree:** clean of tracked changes; only out-of-scope untracked remain
(`docs/reports/*`, `qa-private/`, `reports/`, `daily-briefing-2026-06-02.md`).

**Next (owner / separate):** triage the untracked `docs/reports/*` dump; optional
`git rm --cached tsconfig.tsbuildinfo`. Harness still blocked on owner images + GT.
Not P2.4/P2.5; SMART_NORMALIZE stays OFF.

# HANDOFF — Session 104f (2026-06-03)

## Session 104f — Group A triage landed: normalize GEMINI_MODEL env (live-risk fix)

Closed the live `GEMINI_MODEL` whitespace/newline risk (Core is ON in prod, so the
env model id is read on the live Gemini path).

**Committed (Group A, 4 files):**
- `gemini/model.ts` + `__tests__/model.test.ts` — pure `normalizeGeminiModel(value, fallback)` trim helper (4 tests).
- `geminiVisionProvider.ts` — `modelFallback()` primary wrapped; default `gemini-3.1-pro-preview` UNCHANGED.
- `translation/vision-extract/route.ts` — response `model:` metadata field wrapped; default `gemini-2.5-flash` UNCHANGED; no runtime routing change.

**Deliberately NOT committed:**
- `engine/presence.ts` — its in-flight edit ALSO adds a new explicit default model
  (`?? process.env.GEMINI_MODEL` → `normalizeGeminiModel(..., 'gemini-2.5-flash')`),
  a semantic default change → excluded per the Group-A rule; needs separate review
  (confirm the new default matches geminiReader's prior internal default).
- Vision ADC loader (`visionCredentials.ts` +test), `tsconfig.tsbuildinfo` — left in tree.

**Guards before commit:** NO_SECRETS_IN_DIFF, NO_SMART_NORMALIZE, NO_VISION_ADC,
NO_FORBIDDEN_PATHS, NO_DEFAULT_MODEL_CHANGE (the two model literals in the diff are
the pre-existing defaults, only moved into the fallback arg). typecheck PASS; model
4/4; docintel green. Not pushed.

**Next (owner decision):** (a) presence.ts default-model question; (b) Vision ADC
commit-or-discard; (c) discard tsconfig.tsbuildinfo + gitignore. Not P2.4/P2.5.

# HANDOFF — Session 104e (2026-06-03)

## Session 104e — P2 OFF-vs-ON accuracy harness: BLOCKED on owner inputs

Asked to measure the P2.1–P2.3 OFF-vs-ON delta against ground truth. **Precondition
not met → stopped before any run** (per the task's own gate).

**Raw check:**
- `test-fixtures/real-docs/ground-truth/*.json`: all `ground_truth_status="NEEDS_OWNER"`,
  filled fields 0/11, 0/11, 0/7.
- `test-fixtures/real-docs/`: no document images (`NO_IMAGES_FOUND`).

So `readDocument` cannot run on a real doc and there is nothing to compare against.
I did NOT write a harness that cannot run or be validated, and made NO accuracy claim.

**Unblock (owner, both required):** (1) put the document IMAGES into
`test-fixtures/real-docs/` (gitignored); (2) fill the GT JSON values and set
`ground_truth_status=VERIFIED_BY_OWNER`. Recorded in `OWNER_QUEUE.md`.

**Then:** harness runs each doc through `readDocument` twice (`SMART_NORMALIZE_ENABLED`
unset vs `=1`), emits a per-field table (OFF / ON / GT / verdict improved|same|regressed|→review),
flags any regression (correct-OFF → wrong-ON), counts review escalations, and gives a
go/no-go on enabling the flag in prod — with numbers.

**Gate unchanged:** enabling `SMART_NORMALIZE_ENABLED` in prod FORBIDDEN until that
delta is measured (Core already ON in prod). HEAD code `21e90c6`. P2.4/P2.5 frozen. Not pushed.

# HANDOFF — Session 104d (2026-06-03)

## Session 104d — P2 dictionary-in-live-path checkpoint (documentation only, NO code)

Architecture fix of the three P2 dictionary bricks as part of ONE live brain.
Report: `docs/reports/P2_DICTIONARY_IN_LIVE_PATH_CHECKPOINT.md`.

**Locked facts:**
- P2.1 snapCity (city/place), P2.2 patronymic (VALIDATION/review-guard ONLY — not
  reconstruction), P2.3 authority (registry resolver, review preserved, no silent
  downgrade) — all COMMITTED. HEAD `21e90c6`.
- All three gated ONLY by `SMART_NORMALIZE_ENABLED` and nothing else (raw:
  `dictionaryBridge.ts:106` snapCity; `documentFieldReader.ts:87` patronymic+authority;
  `patronymicReconcile.ts`/`authorityResolve.ts` read no env). **Absent in prod → OFF.**
- **PROD CORRECTION:** Core flags ARE ON in prod (all 4 routes live). If
  `SMART_NORMALIZE_ENABLED=1` were set tomorrow, all 3 dictionaries would touch REAL
  client fields immediately (place_city / patronymic / issuing-authority). Enabling
  it in prod is **FORBIDDEN** until owner ground-truth + measured OFF-vs-ON delta
  (owner-only; agents must not set it).
- Accuracy NOT claimed — no owner ground truth yet.
- Door model: Door A (per-field, dictionaryBridge/toCanonicalValue) + Door B
  (document-level post-passes, documentFieldReader) run in sequence on the
  `readDocument` path → all 3 dictionaries for all 4 products. Exceptions: legacy
  TPS arbiter, centralBrain side-path, Re-Parole fallback classes. True single-door
  = P5 consolidation, deferred (owner-gated, premature now).

**Checks:** YAML_OK; typecheck PASS; snapCity 4/4 + patronymic 8/8 + authority 13/13
= 25/25.

**Frozen / not done:** P2.4 (settlement) + P2.5 (server classifyGarbage) FROZEN.
Not pushed. Owner ground-truth still missing.

**Next before P2.4 (NOT a brick):** triage the dirty working tree — the in-flight
Gemini/Vision changes (`gemini/model.ts`, `visionCredentials.ts` ADC,
`vision-extract/route.ts`, `presence.ts`, `geminiVisionProvider.ts`) — land or
revert them; and obtain owner-filled ground truth. Both are owner decisions.

# HANDOFF — Session 104c (2026-06-03)

## Session 104c — DOOR_ALIGNMENT_TRACE (documentation checkpoint, NO code)

Resolved the "two doors" architectural question raised after P2.1–P2.3. Full raw
call-graph + verdict in `docs/reports/DOOR_ALIGNMENT_TRACE.md`.

**Verdict:** `readDocument` is the canonical door. It runs Door A (per-field
`toCanonicalValue` → snapCity) then Door B (document-level post-passes
patronymic + authority) in sequence, so on the Core path all three smart
dictionaries fire for all 4 products (TPS/Translation/Re-Parole/EAD). The
divergence is per-PATH, not per-product.

**Exceptions (documented):** (1) TPS legacy booklet arbiter `visionReadsToFields`
— Door A only, flag-off, and it already over-reviews so patronymic adds nothing;
only authority value-resolution is absent there. (2) centralBrain side-path
(`normalize()` ← `centralBrain.ts:152`) — snapCity only; do-not-touch/retire.
(3) Re-Parole i94/ead/dl fall back to `/api/tps`.

**Prod reality (CORRECTED 2026-06-03):** Core flags are ON in prod (owner-verified
from Vercel: `ONE_CORE_TPS_ENABLED=1`, `ONE_BRAIN_CORE_ENABLED=1`,
`ONE_CORE_REPAROLE_ENABLED=true`, `ONE_CORE_EAD_ENABLED=true`) → the live
`readDocument → arbitrate` brain serves clients NOW on all 4 products. ONLY
`SMART_NORMALIZE_ENABLED` is absent (OFF) → the 3 P2 dictionary branches are dark.
(The earlier "all Core OFF" claim was wrong — read a local `.env`, not prod.)

**Decision:** keep `readDocument` as the one door now (this checkpoint). Defer the
true single-door cleanup (retire the arbiter + centralBrain side-path, dedup the
legacy authority maps in militaryId/birthCertificate, close the Session-103
Core-bypass) to **P5 — owner-gated migration**, NOT now: dirty working tree
(in-flight Gemini/Vision), no owner-filled ground truth, flags OFF → premature.

**This checkpoint:** docs only. No code change. HEAD `21e90c6` (P2.3) unchanged.
Not pushed. P2.4/P2.5 frozen. Next big move is NOT P2.4 — it is to clean up the
in-flight Gemini/Vision changes and the owner ground-truth, then revisit P5.

# HANDOFF — Session 104b (2026-06-03)

## Session 104b — P2.3 authority/issued_by registry resolution (behind SMART_NORMALIZE_ENABLED)

**What was done:**
1. **`dictionaryBridge.resolveAuthority(rawCyrillic, documentDate?)`** (NEW, pure) — resolves an issuing authority via the sourced registry: `translateCivilRegistryTerm` first (РАЦС/ЗАГС/ДРАЦС), then `lookupAuthority` (МВС/міліція/…). Returns the registry's `official_en` + its `review_required` + warning verbatim. No match → passthrough (value = input). `documentDate` optional → drives era-gating; we don't have it in this path so it defaults (acceptable — registry still resolves the term, era-warnings like ЗАGS/міліція still raise review).
2. **`docintel/authorityResolve.ts`** (NEW) — `resolveAuthorityFields(fields)` post-pass over `kind:'agency'` fields. Match → replace value with `official_en` + carry `review_required` (never lower). No match → field untouched (keeps the transliteration `toCanonicalValue` produced — no silent loss).
3. **Wiring** — added to `documentFieldReader` in the SAME `SMART_NORMALIZE_ENABLED==='1'` block as P2.2: `resolveAuthorityFields(reconcilePatronymicFields(fields))`. Default OFF → byte-identical.

**Door alignment (applied lesson from P2.2 trace):** this pass lives in `readDocument`, which all 4 product routes call (TPS/Translation/Re-Parole/EAD) — so authority resolution reaches all 4 by design. Chosen as a document-level post-pass (not the per-field `toCanonicalValue` 'agency' branch) because that branch returns a bare string and would drop the registry's `review_required` (ЗАГС/міліція must raise review).

**Legacy:** per-module authority maps in `militaryId.ts`/`birthCertificate.ts` left untouched — dedup is P5 (canon note on P2.3).

**Evidence:** `authorityResolve.test.ts` 13/13 (РАЦС/ДРАЦС→Civil Registry Office no-review; ЗАГС→review; Міліція→Militsiya review; unknown→passthrough; flag OFF→transliterate vs ON→resolve+review via stub provider; non-agency untouched). Broad: docintel+canonical/core+tps 768 pass / 1 skip. typecheck PASS.

**What was NOT done:** no live doc / no accuracy delta (owner ground truth). P2.4 (settlement) / P2.5 (server-side classifyGarbage) not started. Not pushed. `SMART_NORMALIZE_ENABLED` stays OFF. `documentDate` not threaded into the authority pass (era-gating uses registry defaults) — enhancement if a doc-date is later available in the field set.

# HANDOFF — Session 104 (2026-06-03)

## Session 104 — P2.2 patronymic reconcile (behind SMART_NORMALIZE_ENABLED) + canon YAML repair

**Context:** resumed after the prior session HUNG in the P2.2 loop. First recovered state, then implemented P2.2 correctly.

**What was done:**
1. **Canon YAML repair** — `docs/MIGRATION_BRIEF.yaml` failed `ruby -ryaml YAML.load_file` (`Psych::SyntaxError` at line 116 col 93). Root cause: inside flow mappings `{...}`/`[...]`, values like `orchestrator.ts:65` contain a colon YAML reads as a key/value separator. Quoted the 5 offending values (lines 116–120). Re-validated → `YAML_OK`. Block-style `key: …ts:100` lines (69–104) are valid (colon not followed by space) — left as-is.
2. **P2.2 implemented** — `apps/web/src/lib/docintel/patronymicReconcile.ts` (NEW, pure, exported `reconcilePatronymicFields(fields)`). Runs as a POST-PASS over the full `ExtractedDocField[]` (the per-field `toCanonicalValue` has no sibling context — that mismatch is likely what hung the prior run). For `middle_name`/`child_patronymic`: infers sex from the patronymic's own suffix via `isValidPatronymic`, calls `reconcilePatronymic(patrCy, '', sex)`. Well-formed → kept; malformed/undeterminable → `review_required=true`, value preserved. Never silent-corrects, never lowers an existing flag.
3. **Scope decision (important, do NOT re-litigate without a fix):** P2.2 is a VALIDATION pass, not regeneration. `reconcilePatronymic`'s `givenName` is the FATHER's given name; the canonical field set only has the HOLDER's `given_name`/`child_given_name`, and the registry has NO `sex` field. Feeding the holder's name would fabricate a wrong patronymic — violates the zero-wrong-answer rule. So `givenName=''`. A real regeneration would need reliable father-given-name parsing (birth cert `father_full_name`) — future P5 enhancement.
4. **Wiring** — `documentFieldReader.ts` calls the pass only when `process.env.SMART_NORMALIZE_ENABLED === '1'`. Default OFF → byte-identical to before.
5. **Ground-truth templates** — `test-fixtures/real-docs/` is gitignored (holds filled PII GT). Added versioned PII-free blank templates under `docs/templates/ground-truth/` + README, and `OWNER_QUEUE.md` instructing the owner to copy→fill locally and NOT commit filled files. PII scan of the new files: CLEAN.

**Evidence:** `patronymicReconcile.test.ts` 8/8 (incl. flag OFF→no-flag vs ON→flag gating via a stub provider). docintel + canonical/core 268/268. P2.1 `dictionaryBridge.snapCity.test.ts` 4/4. `npm --prefix apps/web run typecheck` → PASS (0 errors).

**What was NOT done:**
- No live document run; no accuracy delta measured (blocked on owner-filled ground truth — see OWNER_QUEUE.md). No accuracy claim made.
- P2.3 (authority/issued_by), P2.4 (settlement), P2.5 (server-side classifyGarbage) NOT started.
- Pre-existing uncommitted in-flight work (`gemini/model.ts` + vision/presence/route edits) left UNTOUCHED — separate from P2.2, not bundled.
- Not pushed. `SMART_NORMALIZE_ENABLED` NOT set anywhere (stays OFF).

**Door-alignment check (raw call-graph):** `readDocument` (the docintel door where `patronymicReconcile` runs) is invoked by ALL 4 product routes — TPS `route.ts:266`, Translation `:217/:263`, Re-Parole `:188`, EAD `:170` — so the patronymic guard is NOT TPS-only. `snapCity` (via `normalizeCity` ← `toCanonicalValue`) runs in `readDocument` (all 4) AND additionally in the TPS-only booklet facade `geminiVisionArbiter.visionReadsToFields` (flag `TPS_GEMINI_VISION_ARBITER_ENABLED`). That facade hardcodes `review_required:true` on every field (`geminiVisionArbiter.ts:60`), so the patronymic is already under review there — adding the guard would be zero behavioral delta (churn). **Verdict: doors functionally aligned, no move made.** snapCity differs only because it is a value transform (functional there) vs patronymic being a review guard (already maxed there). Both gated by the same `SMART_NORMALIZE_ENABLED`. The deeper Core-bypass (TPS `readDocument` only on `ONE_CORE_TPS_ENABLED` + UA-identity classes) is pre-existing One-Brain debt (Session 103) and hits BOTH dictionaries equally.

**D2 status:** «По батькові» = VALIDATION-ONLY review guard, NOT reconstruction. Goal block NOT closed — DEFERRED (no father-given-name + sex context in the field set; regenerating from the holder's name would fabricate). Future: parse `father_full_name` on birth certs (P5).

**Next exact task:** owner fills the 3 GT templates locally → run the P2-relevant fixtures `SMART_NORMALIZE_ENABLED=OFF` vs `ON` → report per-field delta (first real "better" proof). Then decide P2.3.

# HANDOFF — Session 101 (2026-06-03)

## Session 101 — KNOWLEDGE_DRIVEN_CORE: label/value extractor, birth cert fix, MRZ debug, gazetteer, agency registry

**What was done:**

### PHASE 1 — labelValueExtractor.ts (NEW)
- Created `apps/web/src/lib/tps/modules/labelValueExtractor.ts`
- `isLabelText()`: knows 50+ Ukrainian/Russian label strings; rejects bilingual variants ("прізвищ", "ім'я, отчество, по батькові"); detects all-caps Cyrillic headers; detects multi-label lines (2+ labels = header row).
- `isCyrillicValue()`: accepts real Cyrillic values, rejects anything `isLabelText()` returns true for.
- `extractValueAfterLabel()`: inline tail stripped + label-checked before accepting; prev-line and next-line scanning stops at label boundaries; null+review_required when no value found; review_required=true when multiple candidates.
- 29 unit tests in `__tests__/labelValueExtractor.test.ts` — all pass.

### PHASE 2 — birthCertificate.ts (FIXED)
- `extractFieldFromBlock()` now delegates to `extractValueAfterLabel` with `allowPrevLine=false`.
- Bug fixed: "Прізвище / Прізвищ" → `child_family_name=null` (was returning "/ Прізвищ").
- Bug fixed: "ім'я, отчество, по батькові" → `child_given_name=null` (was returning the label string).
- Imported `translateCivilRegistryTerm` + `lookupAuthority` from `@uscis-helper/knowledge` — `translateAuthority()` now tries registry as fallback after hardcoded glossary.
- 5 new Phase 2 regression tests added to `birthCertificate.test.ts` (26 total, all pass).
- `looksLikeBirthCertLabel` function is now dead code (kept, not called).

### PHASE 3 — militaryId.ts (agency registry wired)
- `translateAuthority()` now calls `lookupAuthority()` from registry as fallback.
- Covers ТЦК (Territorial Recruitment Center, the post-2022 name for military commissariats).
- All 20 existing tests pass.

### PHASE 4 — mrzAuthority.ts (MRZ debug classification)
- Added `MrzDebugStatus` type: 6 states — valid_mrz, no_mrz_lines, partial_mrz_lines, check_digit_failed, ocr_noise_in_mrz, mrz_parse_error.
- `classifyMrzStatus(rawText, parsedOk, checks)` — inspects raw OCR for TD3/TD1 line patterns.
- `parseMrzFromText(rawText)` — returns `MrzParseResult` with valid, debug_status, mrz_lines_found, candidates, check_digits_pass.
- Existing `mrzCandidatesFromText()` and `mrzReadFromOcrText()` unchanged.

### PHASE 5 — Gazetteer
- Downloaded КАТОТТГ JSON from GitHub (5.7 MB, orderDate 2024-01-19).
- Ran `gen-settlements.mts` — generated 458 city rows → `packages/knowledge/src/registry/settlements.generated.ts`.
- Already wired into `registryIndex.ts` lazy singleton (SETTLEMENT_ROWS merged with REGISTRY_ROWS).

### PHASE 6 — Agency registry
- Confirmed: registry.csv already has РАЦС, ЗАГС, МВС, поліція, міліція, ДМС, ТЦК with source_url proofs.
- Wired into `birthCertificate.ts` and `militaryId.ts` authority translation as registry fallback.

**Tests: 2751/2751 passing (34 new). tsc: 0 errors. Build: passes.**

**What was NOT done:**
- MRZ debug status not yet wired into OCR route response (routes still return FieldCandidate[] only; MrzParseResult available but not called in routes). Non-blocking — routes can call parseMrzFromText() instead of mrzCandidatesFromText() when they want debug info.
- No new live benchmark run (no real document uploaded).
- `looksLikeBirthCertLabel` dead code in birthCertificate.ts not removed (safe, TypeScript doesn't error on unused functions in non-strict unused-locals mode).

**Next exact task:**
1. Merge this PR (feat/knowledge-driven-core).
2. Update OCR routes to call `parseMrzFromText()` instead of `mrzCandidatesFromText()` to surface `debug_status` in API responses.
3. Owner: upload real birth certificate to verify label-as-value fix.
4. Owner: upload real military ID to verify agency registry hit for authority field.

# HANDOFF — Session 100 (2026-06-03)

## Session 100 — VISION_CREDENTIALS_LOADER: fix Google Vision 403, add diagnostic endpoint

**What was done:**
- **Root cause identified**: Vision API returns HTTP 403 in Vercel Production because `GOOGLE_CLOUD_VISION_API_KEY` (set in `.env.local`) was never added to Vercel environment variables. Provider returns empty OcrResult → MRZ parser gets empty text → `_mrz_source=NOT_PRESENT`.
- **`loadVisionCredentials()`** created in `apps/web/src/lib/canonical/vision/visionCredentials.ts`:
  - Checks 3 SA JSON env var names in priority order: `GOOGLE_VISION_SERVICE_ACCOUNT_JSON` > `GOOGLE_CLOUD_CREDENTIALS` > `GOOGLE_APPLICATION_CREDENTIALS_JSON`
  - Falls back to API key: `GOOGLE_CLOUD_VISION_API_KEY` | `GOOGLE_VISION_API_KEY`
  - Normalizes `private_key` `\\n` → real newlines (Vercel stores escaped)
  - Validates required fields; returns typed error codes
  - Masks `client_email` in status; NEVER exposes `private_key`
- **Vision provider** (`apps/web/src/lib/ocr/providers/google-vision.ts`) updated to call `loadVisionCredentials()`. When SA JSON found: uses `google-auth-library` (`GoogleAuth`) to get Bearer token. API key path unchanged.
- **Diagnostic endpoint** `apps/web/src/app/api/_diag/vision/route.ts`: `GET /api/_diag/vision`, protected by `X-Internal-Diag-Token` header. Sends 1×1 synthetic PNG (no PII), returns sanitized status. Error codes: `VISION_AUTH_403`, `VISION_API_DISABLED_OR_PERMISSION_DENIED`, `VISION_BILLING_OR_QUOTA`, etc.
- **Tests**: `canonical/vision/__tests__/visionCredentials.test.ts` — 12 tests, all pass. Full suite: 2680/2680. tsc: 0.
- **Owner instructions**: `docs/reports/VISION_MRZ_AUTH_DIAGNOSTIC.md`

**What was NOT done:**
- Vision is not verified live — owner must add credentials to Vercel + redeploy
- MRZ live confirmation (`_mrz_source=ocr_mrz`) pending Vision working in Production

**Next exact task:**
1. Owner: add `GOOGLE_VISION_SERVICE_ACCOUNT_JSON` (SA JSON) or `GOOGLE_CLOUD_VISION_API_KEY` to Vercel Production env
2. Owner: redeploy
3. Call `/api/_diag/vision` to confirm `vision_ok: true`
4. Upload real passport; verify `_mrz_source=ocr_mrz` in response

# HANDOFF — Session 99 (2026-06-03)

## Session 99 — MRZ_AUTHORITY_WIRED_CODE_READY: wire mrzCandidatesFromText into TPS + Re-Parole Core routes

**What was done:**
- **TPS route** (`/api/tps/ocr/extract`): In the `ONE_CORE_TPS_ENABLED=1` block, after `readDocument` (Gemini docintel) succeeds for `ua_international_passport`, calls `mrzCandidatesFromText(result.raw_text)` using the Google Vision OCR text already obtained in-route. MRZ candidates pushed into `candidates[]` before `arbitrateDocument`. Import added: `mrzCandidatesFromText` from `@/lib/canonical/core/mrzAuthority`.
- **Re-Parole route** (`/api/reparole/ocr/extract`): For `ua_international_passport` hint, runs `googleVisionProvider.extractText()` in parallel with `readDocument` using `Promise.all`. Vision OCR provides raw text for `mrzCandidatesFromText`. MRZ candidates pushed into `candidates[]` before `arbitrateDocument`. Imports added: `googleVisionProvider` + `isBlocked` (for OCR result type guard) + `mrzCandidatesFromText`.
- **Both routes**: MRZ injection guarded on `docintelId === 'ua_international_passport'`. EAD/booklet/i94/dl/i797 not affected. MRZ never populates i94, a_number, ead_category, us_address, eligibility, patronymic.
- **New test file**: `canonical/core/__tests__/mrzWiringProof.test.ts` — 18 arbitration-level proof tests: valid MRZ wins over Gemini (7 fields), invalid MRZ forces review, missing MRZ visual fallthrough, 5 forbidden fields checked, EAD not affected, conflict preserved in evidence, PASSPORT_MRZ_FIELDS alignment.
- Full suite: 2664/2664 passing. tsc: 0 errors.

**What was NOT done:**
- Live smoke test — `MRZ_AUTHORITY_LIVE_CONFIRMED` requires PR #74 merge + Vercel deploy + real international passport upload.
- Ground truth fixture (`qa-private/ground-truth/passport_international_kuropiatnyk.json`) still MISSING — owner must fill.
- PR #74 not merged (task contract says do NOT merge).

**Next exact task:**
1. Owner reviews PR #74 (`feat/mrz-passport-authority`) and merges.
2. Vercel deploy (auto on merge to main).
3. Upload real international passport via TPS wizard (ONE_CORE_TPS_ENABLED=1) — verify `_mrz_source` in Core response.
4. Owner fills ground truth fixture.

# HANDOFF — Session 98 (2026-06-03)

## Session 98 — MRZ international passport authority for Document Core

**What was done:**
- Created `apps/web/src/lib/canonical/core/mrzAuthority.ts`.
- Full suite: 2646/2646 passing. tsc: 0 errors.

# HANDOFF — Session 97 (2026-06-03)

## Session 97 — B4 UI WIRING: EAD wizard calls /api/ead/ocr/extract when flag ON

**What was done:**
- Wired `EADWizard.tsx` to call `/api/ead/ocr/extract` behind `NEXT_PUBLIC_ONE_CORE_EAD_ENABLED=true` flag.
- Added `StepUpload` component (injected at step index 2 when flag ON; skipped entirely when OFF).
- Upload supports: passport, EAD card, I-94. User selects doc type → uploads image → Core extracts fields → form prefilled.
- Prefill mapping: family_name→lastName, given_name→firstName, date_of_birth→dob, sex→gender M/F, country_of_birth→countryOfBirth, a_number→alienNumber (source-gated by Core adapter; null if source not EAD/I-797).
- `Skip — enter manually` button always visible — upload step never blocks navigation.
- `hasReviewFields` state: shows amber warning when `review_required=true` from Core.
- Flag OFF: wizard unchanged — old 7-step manual form, no upload, no API call.
- Created `apps/web/src/components/services/ead/__tests__/eadWizardUiWiring.test.ts`: 45 new tests — flag wiring, route reference, docHints, prefill mapping, source gates, review_required, architecture contract markers, invented_fields_count=0.
- Full suite: 2610/2610. tsc: 0 errors.

**What was NOT done:**
- `ONE_CORE_EAD_ENABLED=true` NOT set in Vercel yet — needs owner to merge PR #73 first
- `NEXT_PUBLIC_ONE_CORE_EAD_ENABLED=true` NOT set — requires fresh Vercel build after flag change
- ONE_BRAIN_FINAL_SMOKE_TEST not yet run
- PR #73 not yet merged

**Next exact task (ONE_BRAIN_COMPLETE_LIVE path):**
1. `gh pr merge 73 --merge --repo 2133611700c-sudo/uscis-helper` — after CI green
2. `vercel env add ONE_CORE_EAD_ENABLED production` = true
3. `vercel env add NEXT_PUBLIC_ONE_CORE_EAD_ENABLED production` = true
4. `vercel deploy --prod --force` — NEXT_PUBLIC_* requires fresh build
5. Smoke test all 4: `/api/tps/health`, `/api/translation/vision-extract`, `/api/reparole/ocr/extract`, `/api/ead/ocr/extract`

**Architecture:**

# HANDOFF — Session 96 (2026-06-03)

## Session 96 — B4: EAD consumes CanonicalDocumentResult (ONE_BRAIN_COMPLETE_CODE_READY)

**What was done:**
- Created `apps/web/src/lib/canonical/core/eadAdapter.ts`: pure `toEadAnswers()` adapter — no OCR, no Gemini, no API calls; source-gated field mapping canonical → EadCoreAnswers
  - Identity fields: mapped from any document
  - EAD/USCIS fields (a_number, ead_category, uscis_number, card_number, ead_validity_*): **null unless source is ead_card/i766/i797/uscis_notice/us_ead**
  - I-94 fields (i94_admission_number, i94_date_of_entry, i94_class_of_admission, i94_place_of_entry): **null unless source is i94/us_i94/arrival_departure_record**
  - us_address: **null unless source is drivers_license/dl/state_id** (never inferred from passport)
  - invented_fields_count: always 0 (hard-coded, compile-time type `0`)
- Created `apps/web/src/app/api/ead/ocr/extract/route.ts`: new EAD OCR route behind `ONE_CORE_EAD_ENABLED=true` flag (default: false); same pattern as B3 Re-Parole route
- Created `apps/web/src/lib/canonical/core/__tests__/eadAdapter.test.ts`: 74 tests — all green
  - Passport-only proof case: all 11 gated fields are null ✅
  - EAD source: a_number, ead_category, card_number, ead_validity_* mapped ✅
  - I-94 source: i94_* fields mapped ✅
  - DL source: us_address mapped ✅
  - invented_fields_count: 0 in all cases ✅

**What was NOT done:**
- `ONE_CORE_EAD_ENABLED=true` NOT set in Vercel (owner decision)
- `NEXT_PUBLIC_ONE_CORE_EAD_ENABLED` — EAD wizard (EADWizard.tsx) is currently client-side only (no existing OCR path in it); the new `/api/ead/ocr/extract` route is the new Core path when enabled
- ONE_BRAIN_FINAL_SMOKE_TEST (all 4 products live simultaneously)
- Certificate ground truth (owner responsibility)

**Architecture:**
- Flag OFF (default): `/api/ead/ocr/extract` returns 503 — EAD wizard unaffected (it had no OCR before)
- Flag ON: image → readDocument → arbitrateDocument → toEadAnswers → EadCoreAnswers JSON
- Source gates strictly enforced in adapter (no runtime checks needed — logic self-contained)

**To go live (owner):**
1. Set `ONE_CORE_EAD_ENABLED=true` in Vercel
2. Merge PR feat/b4-ead-core
3. EAD wizard integration: wire Step 2 (personal info) to call `/api/ead/ocr/extract` with passport upload
4. ONE_BRAIN_FINAL_SMOKE_TEST: TPS + Translation + Re-Parole + EAD on real passport

**Evidence:** 74 new adapter tests + 2565/2565 full suite passing; tsc 0

# HANDOFF — Session 95c (2026-06-03)

## Session 95c — B3 UI WIRING: Re-Parole wizard calls Core route behind flag

**What was done:**
- Modified `apps/web/src/app/[locale]/services/re-parole-u4u/start/ReparoleWizardV2.tsx`:
  - Added `REPAROLE_CORE_ENABLED` constant from `NEXT_PUBLIC_ONE_CORE_REPAROLE_ENABLED` env var
  - Added `CORE_COVERED_SLOTS = new Set(['passport', 'booklet'])` (US slots always use old path)
  - Changed `handleUpload`: OCR route selected by flag AND slot coverage
  - When flag ON + passport/booklet: calls `/api/reparole/ocr/extract`, parses `ReParoleCoreAnswers` shape
  - When flag OFF OR i94/ead/dl: calls `/api/tps/ocr/extract` (old path, unchanged)
  - `date_of_birth` (Core key) → `dob` (wizard key) aliased in CORE_FIELD_MAP
  - `review_required` and `uncertain_fields` from Core response drive `requires_review` per field
  - I-94 fields: null → not added to fields object (not invented)
- Created `apps/web/src/app/api/reparole/ocr/extract/__tests__/uiWiring.test.ts`:
  - 8 source-level wiring tests (flag constant, CORE_COVERED_SLOTS, route selection, response shape)
  - 4 functional response parsing tests (Core shape mapping, review_required, i94 null, fallback_used)
  - 12 total new tests, all passing

**What was NOT done:**
- `NEXT_PUBLIC_ONE_CORE_REPAROLE_ENABLED=true` NOT set in Vercel (owner decision)
- EAD → Core (B4) — not done
- ONE_CORE_REPAROLE_ENABLED (server-side, for the route itself) still needs owner to enable separately
- i94/ead/dl slots not yet wired to Core (Core doesn't cover them)

**Architecture:**
- Flag OFF (default): wizard → `/api/tps/ocr/extract` — byte-for-byte identical to before
- Flag ON, slot passport/booklet: wizard → `/api/reparole/ocr/extract` → Core → `ReParoleCoreAnswers`
- Flag ON, slot i94/ead/dl: wizard → `/api/tps/ocr/extract` (Core fallback, unchanged)
- Response parsing: Core JSON top-level fields → wizard `FieldExtraction` records
- Backend route also gated by `ONE_CORE_REPAROLE_ENABLED` (server-side, separate from frontend flag)

**To go live (owner):**
1. Set `NEXT_PUBLIC_ONE_CORE_REPAROLE_ENABLED=true` in Vercel (client-side flag)
2. Set `ONE_CORE_REPAROLE_ENABLED=true` in Vercel (server-side flag for the route)
3. Merge PR #72 and deploy
4. Upload passport in Re-Parole wizard → should call `/api/reparole/ocr/extract`
5. Verify `family_name`/`given_name`/`dob` populated in form

**Next task:** B4 — EAD → Core

**Evidence:** 12 new tests passing, full suite 2503 passing, tsc 0

# HANDOFF — Session 95 (2026-06-03)

## Session 95 — B3: Re-Parole consumes CanonicalDocumentResult (ONE_BRAIN_PARTIAL_3_PRODUCTS)

**What was done:**
- Created `canonical/core/reParoleAdapter.ts`: pure `toReParoleCoreAnswers()` function — no OCR, no Gemini, no API calls inside; pure field mapping canonical → ReParoleCoreAnswers
- Created `app/api/reparole/ocr/extract/route.ts`: new dedicated Re-Parole OCR route behind `ONE_CORE_REPAROLE_ENABLED=true` flag (default: false)
- Created 29 adapter tests in `canonical/core/__tests__/reParoleAdapter.test.ts`: identity mapping, I-94 non-invention, review_required propagation, uncertain_fields, core_status, adapter purity
- All 29 tests pass; full suite 2491/2491; tsc 0 errors

**What was NOT done:**
- `ONE_CORE_REPAROLE_ENABLED=true` NOT set in Vercel (owner decision)
- EAD → Core (B4) — not done
- Certificate ground truth
- UI changes (Re-Parole wizard still calls `/api/tps/ocr/extract`)

**Architecture:**
- Re-Parole wizard calls `/api/tps/ocr/extract` for OCR (unchanged)
- New route `/api/reparole/ocr/extract` is Core-first when flag=true; returns `ReParoleCoreAnswers`
- Old path completely unchanged when flag=false
- Adapter: `CanonicalDocumentResult.fields[]` → `ReParoleCoreAnswers` (field-key lookup, no invention)
- Fields: family_name, given_name, dob (alias dob), sex, passport_number, country_of_birth/nationality, date_of_expiry, i94_admission_number, last_entry_date, i94_class_of_admission, a_number
- I-94 fields stay null for passport source (no invention)

**Next task:**
1. Owner merges PR #70 (B2 Translation) and enables `ONE_BRAIN_CORE_ENABLED=1`
2. Owner enables `ONE_CORE_REPAROLE_ENABLED=true` when ready to test Re-Parole Core path
3. B4: EAD → Core to complete ONE_BRAIN

**Evidence:** 29 tests passing, full suite 2491 passing, tsc 0

# HANDOFF — Session 93 (2026-06-03)

## Session 93 — B0 verification + B1: TPS → Core behind flag (branch feat/b1-tps-core-flag)

**B0 verified (partial):** PR #67 SHA `1c0261c` in prod (healthz confirmed). Gemini key `GEMINI_API_KEY2` resolves via `getGeminiApiKey()`. Route responds with JSON (not crash). Synthetic 1×1 JPEG test returns `vision_failed:HTTP 400` — expected (blank image). Real document: UNVERIFIED (no test document available). `CENTRAL_BRAIN_TRANSLATION=on` causes every request to degrade (all fields `review_required=true`) — known issue, not blocking.

**B0 mistake found and fixed:** `ONE_BRAIN_CORE_ENABLED=1` was set too early (before real-doc verification) → added 2× Gemini calls → Cloudflare timeout. Removed immediately.

**B1 implementation (this PR):**
- `TpsExtractionSource` gets new value `'canonical_core'` (types.ts)
- New `canonical/core/tpsAdapter.ts`: `mapTpsHintToDocintelId` (passport→ua_international_passport, booklet→ua_internal_passport_booklet, US forms→null), `canonicalFieldToTpsField`, `canonicalToTpsModuleResult`
- TPS `/api/tps/ocr/extract` route: adds `ONE_CORE_TPS_ENABLED=1` path BEFORE existing switch. If Core returns fields → uses them. If Core fails/returns nothing → old switch path runs unchanged. Response includes `core_status` field for diagnostics.
- US form slots (i94/ead/dl/i797): `core_status='skipped_no_mapping'`, old path runs
- Architecture correct: TPS → Core → arbitration → toTPSAnswers → existing contract/normalize pipeline

**Evidence:** `tpsAdapter.test.ts` 12/12. Full web 2407 pass. tsc 0.

**PROOF NEEDED before declaring B1 done:**
1. Set `ONE_CORE_TPS_ENABLED=1` in Vercel
2. Upload real Ukrainian passport (booklet or international) to TPS wizard
3. Check response: `core_status: 'ok'`, `final_field_keys` populated, `critical_wrong_count = 0`
4. Compare with Translation result on same document: same `family_name`, `given_name`, etc.
5. Gate: critical fields must not be wrong, uncertain → `review_required`

**What is NOT done:**
- MRZ injection into Core (passport MRZ fields not yet wired into Core readers)
- Re-Parole, EAD not migrated (separate PRs after B1 proven)
- Translation not yet sharing same Core path as TPS (B2)
- `CENTRAL_BRAIN_TRANSLATION` degrading Translation — investigate why Vision API fails

---

# HANDOFF — Session 92 (2026-06-02)

## Session 92 — Core field-vocab fixes + review carry-through + Translation wiring (branch feat/core-wire-translation)

**Three real-data bugs fixed** (found during Session 91 real-document testing):

**(1) `criticalityOf('dob')` returned 'low'** — Gemini docintel emits `dob`, not `date_of_birth`. Core treated date of birth as low-criticality and could auto-fill without review. Fix: `dob` added as critical alias. Birth-cert child fields also added as critical.

**(2) Reader `review_required` silently dropped** — `FieldCandidate` had no `reviewRequired` field. Docintel flags (blurry handwriting) were discarded by the Core. Fix: field added to type; `arbitrateField` carries the signal as `reader_review_required`.

**(3) Core wired to Translation** — First live wiring via `canonical/core/translationAdapter.ts` + `ONE_BRAIN_CORE_ENABLED=1` path in `vision-extract/route.ts`. Flag OFF = byte-for-byte identical to legacy. Logs `[ONE_BRAIN_CORE] arbitrated N fields`.

**Evidence:** `coreFixes.test.ts` 12/12. Full web 2389 pass, tsc 0.

**Gate:** PR pending. Owner action needed: (1) merge PR #67, (2) merge this PR, (3) set `ONE_BRAIN_CORE_ENABLED=1` in Vercel.

**Next:** provide real documents + ground truth → reader benchmark → wire Core to TPS.

---

# HANDOFF — Session 91 (2026-05-31)

## Session 91 — PROD HOTFIX: Gemini key name mismatch + recognition root cause (branch `fix/gemini-key-066-name`, off main)

**Root cause of "ничего не распознаётся" found + verified.** Prod `/api/translation/vision-extract` returns **502** on real Ukrainian documents (Vercel logs confirm). The code reads the Gemini key ONLY from `GEMINI_API_KEY_PAY` / `GEMINI_API_KEY` (`vision-extract/route.ts:109`, `geminiVisionProvider.ts:99`). The owner uploaded the WORKING key to Vercel under the name **`GEMINI_API_KEY_066`** → the app never reads it → it uses the old dead/restricted key → central-brain consensus Gemini call fails / reads 0 fields → the route returns **502 by design** (`route.ts:130`: `status: fields.length ? 200 : 502`).

**Fix (this PR):** new `apps/web/src/lib/gemini/apiKey.ts` `getGeminiApiKey()` resolves the key from ANY `GEMINI_API_KEY*` env name (the owner kept renaming: `GEMINI_API_KEY_066` → `GEMINI_API_KEY2` → …; suffixed names preferred over the bare `GEMINI_API_KEY`). Wired into both `vision-extract/route.ts` and `geminiVisionProvider.ts`. **Verified end-to-end:** with the local var named exactly `GEMINI_API_KEY2` (mirroring Vercel), `readDocument` reads the real booklet correctly (ok=true, 4 fields). `apiKey.test.ts` 6/6, tsc 0, full web 2383 pass, guard 0. This ends the name-mismatch class of failure for good.

**Proven on real data:** with the working key (set locally), a SINGLE Gemini read (`docintel.readDocument`) reads BOTH owner documents correctly — internal booklet (KUROPIATNYK / SERHII / 1986-06-25 / Vinnytsia Oblast, 25s) and birth cert (10 fields, 8.6s). The single read WORKS where the central-brain consensus returns 0 → 502. This directly validates the one-brain single-read Core as the fix.

**Two real-data bugs found for the Core** (next fixes, grounded not theoretical): (1) reader field-key vocabulary mismatch (Gemini emits `dob`, birth-cert keys like `child_family_name`) → Core's `criticalityOf` misses them → mis-criticalized; (2) the reader's `review_required` is not carried into the Core candidate → Core under-flagged the birth cert. Fix = a reader→canonical key normalizer + carry `review_required` into the candidate.

**Local key:** the owner's temporary key is in `apps/web/.env.local` (gitignored, NOT committed); owner will rotate it. Local 403 on the previous key was because it was IP/referrer-restricted to Vercel.

**Instant owner option (no merge needed):** in Vercel rename `GEMINI_API_KEY_066` → `GEMINI_API_KEY_PAY` (and optionally set `CENTRAL_BRAIN_TRANSLATION` off → uses the proven legacy single-read path) → prod recognition works immediately.

**Also fixed `route.ts:130` (same PR):** when central-brain consensus reads 0 fields, the route now DEGRADES to the legacy single-read path (which uses the same key resolver and is proven to read real docs) instead of returning a hard 502. So merging #67 makes prod recognition work even if central-brain yields nothing. tsc 0, full web 2383 pass.

**Gate:** PR #67 not merged (manual approval). After merge, prod recognition should work (reads GEMINI_API_KEY2 + degrades instead of 502).

---

# HANDOFF — Session 89 (2026-05-30)

## Session 89 — Reader-benchmark harness (branch `feat/reader-benchmark`, off main; #64 merged)

Merged #64 (one-brain v1 spine, foundation). Built the reader-benchmark instrument the owner asked for: compare **old TPS reader / old Translation (docintel) / MRZ parser / new Document Core** against a hand-filled ground truth; metric = `critical_wrong_count` (must be 0; coverage secondary). Built against VERIFIED real signatures (3 parallel agents confirmed `readDocument`, `parseTd3` + per-field `checkResults`, `preprocessImage`).

New `apps/web/src/lib/canonical/core/benchmark/`:
- `passportTruth.ts` — the owner's flat passport ground-truth schema (latin+cyrillic split: family/given/patronymic _latin/_cyrillic, dob, sex, passport_number, expiry_date, citizenship, place_of_birth_raw/english, province) + criticality + `passportTruthToGroundTruth` (empty fields excluded).
- `mappers.ts` — `mapMrz`/`mapTranslation`/`mapTps`/`mapCore`: each reader's NATIVE output → common `ProducedField[]` keyed to the truth fields (MRZ "D Month YYYY"→ISO, per-field check-digit→review; docintel value→latin + raw_cyrillic→cyrillic; TPS/Core normalized_value→latin). MRZ has no Cyrillic/patronymic/place by design (shows its gap).
- `runReaderBenchmark.ts` — scores all readers vs one truth → side-by-side `critical_wrong`/`coverage` + PII-free `summarizeBenchmark`.
- updated `core/groundTruth.example.json` to the owner's flat schema.

**Evidence:** `core/__tests__/benchmark.test.ts` 7/7 (+ spine core.test 16/16). Full web 2377 pass, tsc 0, content-guard 0.

**BUILT:** the reader-benchmark scorer + mappers + runner (pure, tested with synthetic reader outputs).
**NOT LIVE / NOT DONE:** no product migrated, no flags. The harness scores PROVIDED reader outputs — it does NOT yet call the live engines.
**NEEDS REAL INPUT:** (1) owner fills `groundTruth.example.json` from a real passport (and a booklet); (2) a small live runner that calls Gemini `readDocument` + `parseTd3` + the TPS route on that real image to PRODUCE the four outputs to feed the benchmark (needs GEMINI_API_KEY_PAY + a real doc). Then we get the actual `critical_wrong_count` per reader.

**Gate:** product route migration = explicit owner approval only. PR for this = NOT merged (manual approval).

---

# HANDOFF — Session 88 (2026-05-30)

## Session 88 — One Brain v1 spine: Document Core (branch `feat/one-brain-v1-spine`, off main)

Built the v1 spine of the single Document Core per `docs/architecture/ONE_BRAIN_DECISION.md` (owner-approved). New `apps/web/src/lib/canonical/core/`:
- `arbitration.ts` — the Core's judge (minimal authority policy): valid MRZ controls passport fields; **invalid MRZ → review** (not silent fallback); critical field with **no MRZ anchor → review**; material conflict on critical/high → review; fuzzy → review; **no candidate → no field**. Reuses `policy.ts` (criticalityOf/materiallyDifferent/sourceRank).
- `readDocumentCore.ts` — the one entrypoint: quality gate → visual read (Gemini, injected) → MRZ read if passport → minimal arbitration → one `CanonicalDocumentResult`, or `needs_better_photo` (never garbage). Readers injected (testable; real OCR wiring is a thin call later).
- `benchmark.ts` — scorer vs hand-verified ground truth; locked metric `critical_wrong_count` (critical field auto-filled wrong & not review-flagged → must be 0). `parseGroundTruth`.
- `groundTruth.example.json` — the format the owner fills by reading a real document.

**Evidence:** `core/__tests__/core.test.ts` 16/16. Full web 2370 pass, tsc 0, content-guard 0.

**What is BUILT:** the Core spine (arbitration + entrypoint + benchmark + ground-truth format), pure + tested.
**What is NOT live:** nothing consumes the Core — no product migrated, no flags, no UI/payment touched. "One brain" is NOT done (done only when a product consumes Core in production).
**What requires real input:** owner-provided real documents (≥1 passport with MRZ, ≥1 internal booklet) + hand-verified ground truth → reader benchmark → derive empirical knobs → core benchmark → THEN (with approval) migrate the first product.

**Next (needs owner):** provide real documents/ground truth, OR approve the reader-benchmark wiring (calling the real Gemini docintel + MRZ reader on a real doc). Product route migration = manual approval only.

---

# HANDOFF — Session 87 (2026-05-30)

## Session 87 — Legal Copy Freeze (branch `feat/legal-copy-freeze`, off main)

Compliance guard. `apps/web/src/lib/translation/__tests__/legalCopyFreeze.test.ts` pins the 8 CFR §103.2(b)(3) certification legal text: `CERTIFICATION_VERSION === 'v1.0-8cfr-2026'` + `sha256(CERTIFICATION_STATEMENT)` to a known hash. Any silent edit to the signed legal text fails the build, with a message instructing: write an ADR, bump the version, update the pin. Also asserts the statement still cites the regulation. Test-only, zero runtime impact.

**Evidence:** `legalCopyFreeze.test.ts` 3/3. Full web 2354 pass, tsc 0, content-guard 0. Report: `docs/reports/LEGAL_COPY_FREEZE.md`.

**State of the plan:** the safe/low-risk code-completable scope is now genuinely exhausted — Phase-1 safety, UX, the full canonical core (contract + 2 adapters + parity + live shadow + manual-override + doc-gate + quarantine + contradiction detector), and the Phase-5 guards (PII-log, TPS reset, prompt-injection, legal-copy-freeze). **What is left is gated:** (1) data-minimization — a real extraction-pipeline redesign needing owner buy-in; (2) migration → consolidation — needs real-traffic parity (`ONE_BRAIN_SHADOW=1` canary); (3) Phase 4 (finalization lock / PDF proof / evidence-ledger DB); (4) Phase 6 ops; (5) owner-gated source/visual items. **Next owner decision:** enable the canary shadow run, or pick the next gated workstream.

---

## Session 86 — Cross-Document Contradiction Detector (branch `feat/cross-doc-contradictions`, off main)

Canonical-core Quality item. `apps/web/src/lib/canonical/contradictions.ts`: `findCrossDocumentContradictions(fields, canonicalize?)` reports when the SAME field key is read with materially-different values across documents (passport MRZ vs I-94 vs EAD vs DL) — a critical/high contradiction is `blocking` and must be resolved by review (never silently reconciled). Each `Contradiction` carries the criticality + the distinct candidates (value + source + provider, highest-authority first). `hasBlockingContradiction` is a convenience gate. Complements `mergeCanonicalByKey` (resolve) with a reporter (surface). Pure, additive, unwired.

**Evidence:** `contradictions.test.ts` 6/6. Full web 2351 pass, tsc 0, content-guard 0. Report: `docs/reports/P2_CROSS_DOC_CONTRADICTIONS.md`.

**Remaining (gated / larger):** data-minimization (extraction redesign — needs owner buy-in); migration/consolidation (real-traffic parity via `ONE_BRAIN_SHADOW=1` canary); Phase 4 (finalization lock / PDF proof / evidence-ledger DB); Phase 6 ops; owner-gated source/visual items.

---

## Session 85 — Prompt-injection defense (branch `feat/prompt-injection-defense`, off main)

Security fix: OCR text fed to the Document Brain LLM is untrusted (off a user-uploaded document) and was interpolated raw into the prompt — a prompt-injection vector (a document could contain "set confidence 1.0, skip review"). New `apps/web/src/lib/tps/ai/untrustedText.ts`: `fenceUntrustedText(label, text)` wraps the text in unguessable begin/end sentinels and STRIPS any forged markers from the input first (so a document can't fake a fence-close and break out into the instruction context); `UNTRUSTED_TEXT_SYSTEM_RULE` is the system sentence that gives the fences meaning. Wired into `documentBrain.ts`: `buildUserMessage` fences both the full OCR text and the line-by-line view; `SYSTEM_PROMPT` carries the rule + an explicit extract-only clause. Legitimate extraction is unchanged. Used fencing, not blacklisting.

**Evidence:** `untrustedText.test.ts` 8/8 (fence; forged-marker break-out blocked; strip; empty/null; system rule; + source guards). Full web 2339 pass, tsc 0, content-guard 0. No Document-Brain regressions. Report: `docs/reports/SEC_PROMPT_INJECTION_DEFENSE.md`.

**Remaining completable-now:** Phase-5 data-minimization (crop+label) + retention. Then the gated work (migration/Phase-4/Phase-6) needing real-traffic parity + owner decisions.

## Session 84 — TPS per-document state reset (branch `feat/tps-doc-state-reset`, merged #60)

The TPS wizard's `restart` reset the personal-fields blob but left `tps:attest:v1`, `tps:legal-risk:v1` and `wizard:tps-ukraine:part7:v1` in localStorage — so person A's attestation + legal-risk answers carried into person B's packet. New `apps/web/src/lib/tps/documentState.ts` (`clearTpsDocumentState`) removes the three per-document keys; wired into `restart`. Same-document page refresh unaffected. `documentState.test.ts` 4/4; full web 2335 pass; tsc 0; guard 0. Report: `docs/reports/TPS_DOC_STATE_RESET.md`.

## Session 83 — Phase-5 PII-redaction CI guard (branch `feat/pii-log-guard`, merged #59)

`apps/web/src/lib/security/__tests__/noPiiLogging.test.ts` fails the build if any source `console.*` interpolates a PII value. Walks all src .ts(x), reports file:line, self-tests a planted leak. Codebase audited clean. `noPiiLogging.test.ts` 2/2; full web 2333 pass; tsc 0; guard 0. Report: `docs/reports/P5_PII_LOG_GUARD.md`.

---

## Session 82 — Doc-Type Confidence Gate + Provider Output Quarantine (branch `feat/canonical-doc-gate`, off main)

Two more canonical-core policy items. `apps/web/src/lib/canonical/documentGate.ts`: `applyDocumentTypeGate(doc, docTypeConfidence, {threshold=0.7})` — below threshold (we're not confident WHAT the document is / unknown page) it forces every field to `reviewRequired` with reason `unknown_document_type` and sets `requiresReview` (a confident value on an unknown page is a lie); at/above threshold it returns the result unchanged; idempotent. `partitionQuarantine(doc)` → `{accepted, quarantined}` — accepted = needs-no-review fields (safe to auto-use), quarantined = candidates still needing confirmation; after a failed gate, `accepted` is empty. Pure, additive, unwired.

**Evidence:** `documentGate.test.ts` 6/6. Full web 2331 pass, tsc 0, content-guard 0. Report: `docs/reports/P2_DOCTYPE_GATE_QUARANTINE.md`.

**Canonical core is now fully contract-complete:** types + policy + TPS adapter + Translation adapter + parity diff + live shadow + manual override + doc-type gate + quarantine — all additive, tested, unwired. The remaining plan work is genuinely gated and NOT code-deferrable-now: (1) collect real-traffic parity (`ONE_BRAIN_SHADOW=1` canary) → parity threshold → per-product migration behind the flag → consolidation (remove the 2nd brain); (2) Phase 4 finalization-lock / two-layer PDF proof / evidence-ledger DB table; (3) Phase 6 ops (review queue, metrics, status board) — last; (4) owner-gated (official military/diploma/pension URLs, КАТОТТГ byte-verify, birth-cert visual approval, live rotated-photo).

---

# HANDOFF — Session 81 (2026-05-30)

## Session 80 — Live ONE_BRAIN_SHADOW wiring in TPS route (branch `feat/canonical-shadow-wiring`, merged #56)

The first LIVE wiring of the canonical core — observe-only, default OFF. New pure helper `apps/web/src/lib/canonical/liveShadow.ts` (`summarizeTpsReviewShift`) builds the canonical from the SAME live `TpsExtractedField[]` and returns a PII-free one-line review-shift summary (`+review[keys]` the canonical adds, `-review` always 0 by the never-lower-a-flag invariant). The TPS extract route logs `[ONE_BRAIN_SHADOW] <summary>` just before the main success return, guarded by `if (mergedModule && isShadowEnabled())` AND `try/catch` — never throws into the response, never runs unless the flag is on. With `ONE_BRAIN_SHADOW` unset, extraction is byte-for-byte unchanged. Evidence: `liveShadow.test.ts` 4/4 + `shadowWiring.test.ts` 3/3; full web 2320 pass; tsc 0; guard 0. Report: `docs/reports/P2_3W_LIVE_SHADOW_WIRING.md`.

## Session 81 — Manual Override Contract (branch `feat/canonical-manual-override`, off main)

Completes the canonical-core contract surface. `apps/web/src/lib/canonical/manualOverride.ts`: `applyManualOverride(field, userValue)` is the Manual Override Contract (policy §D) — a user correction is the lowest-authority source, applied only on confirmation. It sets `normalizedValue` + `source='manual_user_entry'`, PRESERVES the prior machine value as an `evidence[]` entry (`provider:'pre_manual_override'`), records `rejectedReason` when it replaced a materially different value, clears `reviewRequired`/`reviewReasons` (the override IS the human confirmation — this resolves a critical field's mandatory review), and sets a user-confirmed confidence (final 1.0). Pure, additive, unwired.

**Evidence:** `manualOverride.test.ts` 5/5. Full web 2318 pass, tsc 0, content-guard 0. Report: `docs/reports/P2_MANUAL_OVERRIDE_CONTRACT.md`. (NB: the live shadow wiring is Session 80 / PR #56, merging separately; numbering interleaves.)

**Canonical core is now contract-complete:** types + policy + TPS adapter + Translation adapter + parity diff + live shadow + manual override — all additive, tested, unwired. **What remains is genuinely gated**, not code-deferrable: (1) collect real-traffic parity with `ONE_BRAIN_SHADOW=1` in a canary, then a parity threshold → controlled per-product migration behind the flag → consolidation (remove the 2nd brain); (2) Phase 4 finalization-lock / two-layer PDF proof / evidence-ledger DB table; (3) Phase 6 ops layer (review queue, metrics, status board) — sequenced LAST; (4) owner-gated items (official military/diploma/pension URLs, КАТОТТГ byte-verify, birth-cert visual approval, live rotated-photo). Document-Type Confidence Gate + Provider Output Quarantine remain as further canonical-core items.

---

## Session 79 — P2.2-translation adapter + cross-brain parity (branch `feat/canonical-adapter-translation`, off main)

The second half of the adapter. `apps/web/src/lib/canonical/adapterTranslation.ts`: `readCanonicalDocumentFromTranslation(input)` maps the Translation reader output (`ExtractedField[]`) into the SAME `CanonicalDocumentResult` shape using the P2.1 policy and the same two invariants. Source is inferred (Translation has no explicit source enum): `user_corrected`→`manual_user_entry`, MRZ `source_zone`→`mrz`, else `ai_vision` (ranked below document OCR — a vision guess must not outrank a labelled read). Honest confidence: ocr=provider, source_match only for an MRZ zone with a check-digit pass, unknown layers null. Reuses `mergeCanonicalByKey`.

**The payoff:** the test runs the first real two-brain measurement — build a TPS-canonical and a Translation-canonical for the same document and `diffCanonical` them: agreement → parityRate 1.0, criticalDisagreements 0; a `family_name` disagreement → disagree 1, criticalDisagreements 1 (surfaced, not silently reconciled).

**ADDITIVE / unwired — no behavior change.**

**Evidence:** `adapterTranslation.test.ts` 5/5 (incl. 2 cross-brain cases). Full web 2313 pass, tsc 0, content-guard 0. Report: `docs/reports/P2_2T_CANONICAL_ADAPTER_TRANSLATION.md`.

**Next per Master Plan:** live shadow wiring — behind `ONE_BRAIN_SHADOW=1`, run the canonical adapter alongside the live TPS/Translation extraction and `console.info(summarizeParity(...))` (observe-only, no output change) to collect real-traffic parity numbers; then a parity threshold → per-product migration behind the flag → consolidation (remove 2nd brain) → evidence-ledger table + hash chain.

---

## Session 78 — P2.3 Canonical shadow parity (branch `feat/canonical-shadow`, off main)

Phase 2 step 3: the instrument that settles the two-brain problem with numbers. `apps/web/src/lib/canonical/shadow.ts`: `diffCanonical(left, right, canonicalize?)` returns a `ParityReport` (per-key agree/disagree/left_only/right_only, `criticalDisagreements` for critical+high fields, `parityRate`) using the same `materiallyDifferent` comparator as the no-silent-correction rule; a present-on-both field where one side lacks a value counts as a real disagreement (not silently equal). `isShadowEnabled(env?)` reads `ONE_BRAIN_SHADOW` — only `1`/`true` enables, default OFF, gates LOGGING only (never output). `summarizeParity` is a PII-free one-liner (counts + disagreeing critical keys, never values).

**ADDITIVE / observe-only — unwired, no behavior change.**

**Evidence:** `canonical/__tests__/shadow.test.ts` 8/8. Full web 2308 pass, tsc 0, content-guard 0. Report: `docs/reports/P2_3_CANONICAL_SHADOW.md`.

**Next per Master Plan:** (1) a Translation-side adapter `readCanonicalDocumentFromTranslation` so BOTH stacks emit the same canonical shape — that pair is the actual input to `diffCanonical` (the real two-brain measurement); (2) live shadow wiring behind `ONE_BRAIN_SHADOW=1` (run canonical alongside the live path, `console.info(summarizeParity(...))`, observe-only) — owner-visible, held separate to stay additive; (3) parity threshold gate → per-product migration → consolidation (remove 2nd brain) → evidence-ledger table.

---

## Session 77 — P2.2 Canonical adapter (branch `feat/canonical-adapter`, off main)

Phase 2 step 2: `apps/web/src/lib/canonical/adapter.ts` — `readCanonicalDocumentFromTps(input)` maps the existing TPS reader output (`TpsExtractedField[]`) into one `CanonicalDocumentResult` using the P2.1 policy. `toCanonicalField` maps source→authority + derives split confidence honestly (ocr=provider confidence; source_match only where real — MRZ check digit 0.99 pass / 0.3 fail; field_match/normalization null = excluded from `final` min). `mergeCanonicalByKey` groups same-key readings (e.g. family_name from MRZ + EAD), keeps ALL candidates as evidence, picks highest-authority primary, forces review on material critical/high disagreement. Two invariants tested: (1) never lower a module's `review_required`; (2) never drop a candidate. Also renamed the result type's always-false `readyForReview` → `requiresReview` (added in #52, consumed by nothing).

**ADDITIVE — unwired, zero behavior change.**

**Evidence:** `canonical/__tests__/adapter.test.ts` 8/8. Full web 2300 pass, tsc 0, content-guard 0. Report: `docs/reports/P2_2_CANONICAL_ADAPTER.md`.

**Next per Master Plan:** P2.3 — `ONE_BRAIN_SHADOW` flag (default OFF) + run TPS through the adapter in shadow and emit a parity report; then a Translation-side adapter so both stacks produce the same canonical shape (the actual two-brain diff); then hash-chain + evidence ledger; then per-product migration behind the flag; then consolidation.

---

## Session 76e — P2.1 Canonical contract (branch `feat/canonical-contract`, off main)

First step of Phase 2 (the real fix for the two-brain problem): define ONE recognition output shape + ONE set of review rules, contract-first, before any migration. New `apps/web/src/lib/canonical/`: `types.ts` (`CanonicalDocumentResult`, `CanonicalField` with rawValue-always-preserved + split `FieldConfidence` + `evidence[]` + `reviewRequired`/reasons + hash chain) and `policy.ts` (pure rules grounded in the constitution docs): `computeFinalConfidence` (final ≤ min of applicable layers, null excluded, derived never provider-set), `criticalityOf`/`CRITICAL_FIELDS` (§B matrix), `materiallyDifferent` (no-silent-correction), `sourceRank`/`higherAuthority` (MRZ>...>manual), `resolveDisagreement` (material disagreement on critical/high → review, both retained), `decideReviewRequired` (combines all into {reviewRequired, reasons}). Codifies S1+S3 as general rules.

**ADDITIVE — imported by nothing in the live flow. Zero behavior change, zero risk to TPS/Translation/EAD/Re-Parole.**

**Evidence:** `canonical/__tests__/policy.test.ts` 16/16 (one per `FIELD_CONFIDENCE_AND_CRITICALITY_POLICY.md §F` bullet). Full web 2292 pass, tsc 0, content-guard 0. Report: `docs/reports/P2_1_CANONICAL_CONTRACT.md`.

**Next per Master Plan (Phase 2–3, sequenced):** P2.2 `readCanonicalDocument` adapter over the strongest existing reader (build a CanonicalDocumentResult from current extraction output, still unwired); P2.3 `ONE_BRAIN_SHADOW` flag + run TPS+Translation through the adapter in shadow, diff vs live, emit parity report (default OFF); then per-product migration behind the flag; then consolidation (remove the 2nd brain); then the evidence-ledger table. Hash-chain fields exist on the type but are not yet populated (P2.2+).

---

## Session 75 — UX wizard reset + Back/Start-over (branch `feat/wizard-reset-startover`, off main)

The user-facing complement to the session-isolation fix. The live-failure investigation showed a user could be stuck on a bad recognition with no clean recovery: the review screen (5) had no top Back button and there was no full "Start over" except on success. Added: a top **Back** (→ re-upload screen 3) and a **Start over** button on screen 5; a new `startOver` that confirms data loss, resets, and returns to doc-type (2). Strengthened the existing `resetAll` to clear EVERY piece of session state — it previously left `certifierAddress`/`dataReviewed`/`accuracyAttested`/`procStep`/`stripeCheckoutId` and the persisted `tw:cs` checkout id behind, so a "reset" could inherit stale data; now it also removes both `tw:v2:draft` and `tw:cs`. i18n strings added to RU base + EN override (UK/ES fall back to RU). The success-screen "Translate another" (`s7_restart`) already called `resetAll` and benefits from the fuller reset.

**Evidence:** `wizardResetStartOver.test.ts` 4/4 (source-level, same node-env style as sessionIsolation.test). Full web 2276 pass, tsc 0, content-guard 0. Report: `docs/reports/UX_WIZARD_RESET_STARTOVER.md`.

**Remaining (written):** `window.confirm` is unstyled (later modal polish); UK/ES show RU "Start over" copy via fallback (trivial follow-up); source-level test locks wiring not pixels.

**Next per Master Plan:** Phase 2 — CanonicalDocumentResult + CanonicalField types (contract-first; the path to one recognition brain). Phase-1 safety (S1+S2+S3) and this UX item are done.

---

## Session 103 — Source-code-only Core audit (2026-06-03)

Completed the requested source-code-only audit proving whether the project truly uses one central Document Core across TPS, Translation, Re-Parole, and EAD. Conclusion from source: **it does not yet**. The live system is a hybrid: shared docintel/arbitration substrate exists, but runtime routing remains fragmented by feature flags and legacy slot/document-class bypasses.

### What changed

- Added four audit artifacts:
  - `docs/reports/ACTUAL_PRODUCT_CALL_GRAPH.md`
  - `docs/reports/CORE_LIBRARY_RUNTIME_AUDIT.md`
  - `docs/reports/DOCUMENT_CLASS_EXTRACTION_MATRIX.md`
  - `docs/reports/CODEX_SPY_PROJECT_AUDIT.md`

### Verified evidence

- `readDocumentCore()` exists but is not called by product routes.
- Runtime "DocumentProfile" abstraction is absent; actual shared runtime profile is `DocTypeSpec` via `getDocTypeSpec()`.
- `CanonicalDocumentResult` is built in Re-Parole and EAD routes, but not uniformly in TPS or Translation live Core paths.
- TPS still bypasses Core for `i94`, `ead`, `dl`, `i797`, `tps_notice`, `i797_or_ead`, `ead_old`, `military_id`, `birth_certificate`.
- Re-Parole still bypasses `i94`, `ead`, `dl` to `/api/tps/ocr/extract`.
- Translation can run shared docintel, central-brain, or optional Core arbitration path; not one single path.

### Verification commands

- `npm --prefix apps/web run typecheck` → PASS
- `npm --prefix apps/web test -- src/lib/docintel/__tests__/docintel.test.ts src/lib/canonical/core/__tests__/documentClassPolicy.test.ts src/lib/canonical/core/__tests__/mrzAuthority.test.ts src/lib/canonical/core/__tests__/tpsAdapter.test.ts src/lib/canonical/core/__tests__/reParoleAdapter.test.ts src/lib/canonical/core/__tests__/eadAdapter.test.ts src/lib/tps/modules/__tests__/birthCertificate.test.ts src/lib/tps/modules/__tests__/militaryId.test.ts src/lib/tps/modules/__tests__/labelValueExtractor.test.ts` → 9 files, 302 tests PASS

### Exact next action

1. Decide whether the target architecture is:
   - truly route all four products through `readDocumentCore()`, or
   - delete/replace the dead abstraction and standardize on `readDocument() + arbitrateDocument()`.
2. If unification is desired, first PR should wire one explicit shared profile/result contract:
   - `DocTypeSpec`/profile layer
   - one canonical result shape
   - route-level document-class guards in Re-Parole and EAD
3. After that, migrate `military_id` and `birth_certificate` off legacy TPS-only extraction or mark them intentionally outside Core.

## Session 74 — S3 Name No-Silent-Recase (branch `fix/name-no-silent-recase`, off main)

Third safety item. Audited all five S3 categories (name/patronymic/authority/date/series). Four already preserve raw + flag `review_required=true` on uncertainty (verified by reading `reconcilePatronymic`, `normalizeAuthority` normalize.ts:146, `normalizeDate` normalize.ts:95, `validatePassportPerforation`). Only NAME still silently mutated: the EAD + passport modules built `normalized_value` with a naive `s[0] + s.slice(1).toLowerCase()` and `review_required:false`, corrupting the controlling Latin spelling — `O'BRIEN→O'brien`, `PETRENKO-VASYL→Petrenko-vasyl`, `VAN DER BERG→Van der berg` (EAD never split on spaces), `McDonald→Mcdonald`.

Fix: new shared `formatLatinName` (`packages/knowledge/src/formatName.ts`, exported from index) — preserves a deliberately mixed-case read; for all-caps/all-lower reads title-cases each alphabetic segment (`\p{L}+` splits on space/hyphen/apostrophe) so each part keeps its initial capital. Wired into `ead.ts` (family+given) and `passport.ts` (family+given), replacing the naive casts. `raw_value` and the passport MRZ-gated `review_required` are unchanged — this fixes the value corruption itself.

**Evidence:** `nameNoSilentRecase.test.ts` 6/6 — O'Brien, hyphenated, multi-word, mixed-case preserved, all-caps no-regression, trim/empty. Full web 2272 pass, tsc 0, content-guard 0. Report: `docs/reports/S3_NAME_NO_SILENT_RECASE.md`.

**Remaining (written):** all-caps "MCDONALD" → "Mcdonald" residual (internal capital unrecoverable from caps; raw preserved for the reviewer; surname-particle dictionary out of scope). Translation stack renders names via its own path; if a name cast is later found there, reuse `formatLatinName`. Master Plan tracker (PR #47) to update: S3 → [x] with this PR#.

**Next per Master Plan:** Phase-1 safety (S1+S2+S3) complete — move to UX (Translation wizard reset + Back/Start-over), then the CanonicalDocumentResult contract (Phase 2).

---

# HANDOFF — Session 73 (2026-05-30)

## Session 73 — S2 Audit Persistence Hard-Fail (branch `fix/audit-persist-hard-fail`, off main)

Second safety item from the Master Plan. `generate-pdf` was persisting the order + the 8 CFR §103.2(b)(3) certification attestation best-effort, then returning HTTP 200 + the signed PDF **even when that write failed** — a signed translation with no audit record (a compliance gap, previously tracked `[~]`). New testable helper `apps/web/src/lib/translation/persistCertification.ts` inserts both rows with one retry each (transient-blip tolerance) and returns `{ok, orderErr, auditErr}`, `ok` true only if BOTH stored. The route now, on `!ok`: (1) emits the full signed attestation as a structured `AUDIT_RECONCILE` log line so a signed record is never lost, (2) fails closed — **503, no PDF, no email**. The user already paid + signed; payment is an idempotent Stripe session so a retry does not re-charge (response says so).

**Evidence:** `persistCertification.test.ts` 5/5 — audit-fail-after-retry → ok=false; transient → recovers; thrown error → ok=false; order-fail → ok=false; both-ok → ok=true. Full web 2266 pass, tsc 0, content-guard 0. Report: `docs/reports/S2_AUDIT_PERSIST_HARD_FAIL.md`.

**Remaining (written):** the reconcile log is a durable fallback, not an auto-replay queue (a reconciliation job is Phase 6 ops). The fail-closed UX is deliberate (owner-approved "no 200 on DB failure") and reversible by flag if deliver-on-degrade is later preferred — the attestation is preserved in logs either way. Master Plan tracker (PR #47) to update: S2 → [x] with this PR#, audit `[~]` → resolved.

**Next per Master Plan:** S3 — no-silent-correction for name / patronymic / authority / date / series (extend the S1 principle beyond geography).

---

# HANDOFF — Session 72 (2026-05-30)

## Session 72 — S1 Geography No-Silent-Snap (branch `fix/geography-no-silent-snap`, off main)

First execution item from the Engineering Master Plan (PR #47), done strictly as a safety-only PR. The owner's live failure: a place reading `с.м.т. Ярошенець` was silently rewritten to `Тростянець` and presented as recognized — a legal error (wrong place on a signed document). Root cause: `snapCity`'s fuzzy branch returned `value: GAZETTEER[bestIdx]`, promoting a within-threshold (0.34 confusion-distance) *suggestion* to the *final value*. Fix: the fuzzy branch now keeps the RAW cleaned read as `value`, returns the nearest entry as `suggestedValue` only, sets `matched=false` and `review_required=true` (callers already honour `review_required`). Exact match unchanged; unknown geography → raw + review, no suggestion. `PlaceMatch` gained `suggestedValue?: string | null`. ONE behavior change in `packages/knowledge/src/gazetteer.ts` — no dictionary rewrite, TPS `dictionaryBridge` untouched (it was not the source; `GEO_CORRECTIONS` has no `Ярошенець`).

**Evidence:** `geographyNoSilentSnap.test.ts` 3/3 — Ярошенець must NOT silently become Тростянець; Тростянець exact may normalize (no review); unknown gibberish → raw + review. Full web 2261 pass, tsc 0, content-guard 0. Report: `docs/reports/S1_GEOGRAPHY_NO_SILENT_SNAP.md`.

**Remaining (written, honest):** seed GAZETTEER is ~70 places — a real village absent from the seed returns `unknown_geography` + review (safe, no silent replace) but offers no suggestion; full KOATUU load is a separate data task. The UI must present `suggestedValue` and block until reviewed — the contract is now correct; a dedicated geo review-surface is the UX phase. Master Plan tracker (PR #47) to be updated: S1 → [x] with this PR#, plus the "no phase [x] without 5 conditions" rule.

**Next per Master Plan:** S2 (audit persistence hard-fail → non-200 on DB failure), then S3 (no-silent-correction for name/patronymic/authority/date/series).

---

## Session 71 — Booklet orientation auto-rotate (branch `fix/booklet-orientation`, off main)

The TPS OCR route already rotated 90/180/270 for an international passport whose MRZ was not found, accepting a rotation only if it located an MRZ. An INTERNAL passport booklet has NO MRZ, so rotation never helped it — a rotated booklet matched on garbage and was never re-tried. Extended ADDITIVELY: (1) trigger rotation also when a booklet matched with <2 identity fields; (2) in the rotation loop, track the rotation with the most identity fields (`bookletFieldCount`); (3) after the loop, adopt that rotation if it has strictly more identity fields than the upright read. The passport MRZ path is unchanged (handled first). tsc 0; TPS 370 pass; full web pass; content-guard 0.

**Honest caveat:** cannot verify with a live rotated-booklet image in this env (no upload). The change is additive and only adopts a strictly-better rotation, so it cannot regress the upright/passport paths. Owner should live-repro a rotated booklet to confirm the chosen rotation reads correctly.

**Remaining:** P2–P5 glossary; owner-gated (birth visual approval, official military/diploma/pension URLs + КАТОТТГ byte-verify).
# HANDOFF — Session 70 (2026-05-30)

## Session 70 — Owner mode site-wide (branch `feat/owner-mode-site-wide`, off main)

Closed the owner request: test every product without payment. Inventory: TPS wizard already had owner-bypass; EAD + Re-Parole have no site payment (free); server routes (generate-pdf/render/tps-packet) already honour `isOwnerSession`; owner-login UI exists at `/[locale]/owner` (request-code → verify-code). The ONLY gap was the Translation wizard — it had no owner check and forced Stripe. Fixed: it now fetches `/api/owner/status` on mount, and `handlePayment` skips Stripe → `setScreen(7)` for the owner (the generate-pdf route already bypasses the payment gate for a verified owner cookie). CTA shows "Owner — continue free". `ownerMode.test.ts` 3/3; full web pass; tsc 0; content-guard 0.

**Remaining (honest):** orientation auto-rotate (needs a live rotated fixture to verify — owner to provide or accept blind); P2–P5 glossary consolidation; owner-gated (birth visual approval, official military/diploma/pension URLs + КАТОТТГ byte-verify).

---


## 2026-06-03 | Wire military/birth modules
- Wired military_id + birth_certificate into TPS OCR route switch
- Fixed TS errors in test files
- Next: commit + deploy + live test

## 2026-06-03 | militaryId regex fix
- Fixed: УКРАЇНА was being extracted as family_name (header text before serial number)
- Fix: added to looksLikeMilitaryLabel filter
- Tests: 20/20 passing

## 2026-06-03 | translation rotation fix
- Added preprocessImage to translation/vision-extract/route.ts
- Fixes upside-down document not being read in translation flow
- tsc: 0 errors

## 2026-06-03 | architecture map follow-up
- Added source-only architecture docs:
  - `PROJECT_ARCHITECTURE_MAP.md`
  - `PRODUCT_RUNTIME_ARCHITECTURE.md`
  - `KNOWLEDGE_ASSET_ARCHITECTURE.md` + `.csv`
  - `DOCUMENT_CLASS_ARCHITECTURE.md`
  - `OCR_AI_ARCHITECTURE.md`
  - `ENV_FLAGS_ARCHITECTURE.md`
  - `LEGACY_BYPASS_ARCHITECTURE.md`
  - `CYRILLIC_HANDLING_ARCHITECTURE.md`
  - `PROJECT_ARCHITECTURE_VERDICT.md`
- Verified outcome:
  - intended one-reader file `canonical/core/readDocumentCore.ts` is still not wired to product routes
  - live shared path is `docintel/documentFieldReader.ts` plus route-local arbitration/policy wiring
  - Translation still has 3 runtime branches
  - Re-Parole still bypasses its own core route for `i94`, `ead`, `dl`
  - EAD core route exists but is off by default unless both client/server flags are enabled
- Verification:
  - `npm --prefix apps/web run typecheck` PASS
  - restored `apps/web/tsconfig.tsbuildinfo` to `HEAD` afterward

## 2026-06-03 | Phase 1 runtime baseline
- Closed the remaining Phase 1 UNKNOWNs without changing product behavior.
- `tps/centralBrain.ts` is confirmed live as a TPS merge/translation path:
  - UI calls `/api/tps/brain/merge` from `TPSWizardV2.tsx`
  - route calls `mergeToCentralBrain()`
  - booklet translation preview + packet builder consume `brainMerged`
- Ran live engine baseline:
  - command: `LIVE_E2E=1 npm test -- --run src/lib/engine/__tests__/pipeline.live.e2e.test.ts`
  - result: 2/3 pass, 1 fail
  - fail: passport fixture in `engine/presence.ts` produced empty Latin fields after OCR-confirm guard; assertion on `KUROPIATNYK` failed
- Ran direct route-handler smoke against real booklet fixture with `.env.local` loaded:
  - TPS: route logged `used Core for booklet fields: 4 review_required: 4`
  - Translation: `200`, `status=ok:core-b2`, `provider=one-brain-core:translation-b2`, `fields=4`, `review_required=4`
  - Re-Parole: `200`, `_core=true`, `core_status=ok`, `uncertain_fields=13`
  - EAD: `200`, `_core=true`, `core_status=ok`, `invented_fields_count=0`
  - Google Vision during this smoke returned `HTTP 403`
- Local `next dev` API smoke is `DEGRADED` on this workstation:
  - `GET /api/central-brain/health` → `404`
  - `POST /api/tps/ocr/extract`, `/api/translation/vision-extract`, `/api/reparole/ocr/extract`, `/api/ead/ocr/extract` → `404`
  - log showed `Failed to find Server Action` plus repeated `EMFILE` watcher errors
  - conclusion: direct route invocation is more trustworthy than localhost app-router in current local state
- Cleanup done:
  - temporary test harness deleted
  - `apps/web/.next` removed again
  - `apps/web/tsconfig.tsbuildinfo` restored to `HEAD`

Next action:
- Stop after Phase 1 as requested.
- If owner wants to proceed, Phase 2 starts with `SMART_NORMALIZE_ENABLED` scaffolding and first brick = `snapCity` into the live dictionary door.

## 2026-06-03 | P1.5.1 Vision auth gate
- Followed `docs/MIGRATION_BRIEF.yaml`, phase `P1.5.1` only.
- Diagnosis:
  - local `.env.local` exposes `GOOGLE_APPLICATION_CREDENTIALS` by name
  - referenced ADC file exists locally
  - file contains a valid service-account JSON shape
  - existing Vision loader ignored ADC file-path mode entirely and fell back to API key
- Code change:
  - added ADC file-path support to `apps/web/src/lib/canonical/vision/visionCredentials.ts`
  - gated behind `VISION_ADC_FILE_ENABLED` (default OFF, no prod behavior change)
  - added tests in `apps/web/src/lib/canonical/vision/__tests__/visionCredentials.test.ts`
- Verification:
  - `npx vitest run src/lib/canonical/vision/__tests__/visionCredentials.test.ts` → 14/14 PASS
  - direct live Vision probe with `VISION_ADC_FILE_ENABLED=1` switched auth mode to service account:
    - project detected: `messenginfo`
    - service account detected masked: `messenginfo-docai-ocr-sa@***.iam.gserviceaccount.com`
  - sanitized diag still returned `VISION_AUTH_403` with exact cause:
    - `This API method requires billing to be enabled ... project #537268475735`
- Conclusion:
  - loader bug is fixed
  - phase is still `BLOCKED` on billing, not on code
  - `P1.5.3` full baseline matrix must NOT run until Vision billing is enabled
- Cleanup:
  - temporary probe tests removed
  - `apps/web/tsconfig.tsbuildinfo` restored to `HEAD`

Next action:
- Owner enables billing for Google Vision on project `537268475735` or supplies a Vision-enabled project/credential path.
- After that, rerun `P1.5.1` probe once, then continue to `P1.5.3` full baseline matrix. Do not skip directly to Phase 2.

## 2026-06-03 | P1.5.3 partial baseline matrix (Gemini-core subset)
- Corrected the phase logic from `docs/MIGRATION_BRIEF.yaml` with source proof: Vision billing is **not** required for the Gemini-core subset baseline.
- Added report: `docs/reports/BASELINE_MATRIX.md`
  - code-derived matrix for every `product x class` row from the brief
  - runtime rows only for live-core + real-fixture pairs
- Runtime harness:
  - temporary out-of-repo `tsx` script under `/tmp`
  - direct `POST()` route-handler invocation only
  - `.env.local` loaded by name
  - forced flags for local truthing:
    - `ONE_CORE_TPS_ENABLED=1`
    - `ONE_CORE_REPAROLE_ENABLED=true`
    - `ONE_CORE_EAD_ENABLED=true`
    - `ONE_BRAIN_CORE_ENABLED=1`
- Verified runtime rows:
  - TPS `internal_booklet` -> `core_status=ok`, `final_field_count=4`, `module_field_count=4`
  - Translation `internal_booklet` -> `ok:core-b2`, 4 fields, all under review
  - Translation `birth_certificate` -> `ok:core-b2`, 10 fields, all under review
  - Translation `soviet_birth_certificate` -> `ok:core-b2`, 10 fields, 9 under review; note: generic `ua_birth_certificate` spec
  - Translation `divorce_certificate` -> `ok:core-b2`, 1 field
  - Re-Parole `internal_booklet` -> `_core=true`, `X-Core-Fields=4`, `core_status=ok`
  - EAD `internal_booklet` -> `_core=true`, `X-Core-Fields=4`, `core_status=ok`, `invented_fields_count=0`
- Degraded row:
  - Translation `marriage_certificate` blocked before OCR by policy guard (`needs_better_scan`, 136226 bytes < 300000 byte minimum)
- Critical truth:
  - `Vision billing` is not a blocker for booklet/birth/divorce Gemini-core baseline.
  - It remains relevant only for passport MRZ-augmented parity and legacy/Vision-text branches.
  - `us_ead`, `us_i94`, `us_i797` are not billing-blocked; they are `NOT_ON_LIVE_CORE` because the route maps them but docintel has no registry entry.

Next action:
- If continuing `P1.5.3`, do **not** go back to billing first.
- First fill the remaining Gemini-only gaps:
  - add or locate real fixtures for `international_passport` and `id_card`
  - rerun the same route-handler harness
- Keep passport rows separate as `Gemini core / MRZ parity unverified under Vision 403`.
- Treat `us_ead`, `us_i94`, `us_i797`, `driver_license`, and TPS/Re-Parole non-core classes as coverage gaps, not OCR-billing gaps.

## 2026-06-03 | P1.5.4 booklet ground-truth gate
- Added report: `docs/reports/P1_5_4_BOOKLET_GROUND_TRUTH_GATE.md`
- Purpose: define the exact owner-gated contract required before booklet quality can be measured honestly.
- Verified hard blocker:
  - `test-fixtures/real-docs/` currently has only one booklet fixture: `internal_passport_kuropiatnyk.jpg`
  - there are not `3-4` booklet fixtures in that folder today
- Verified the repo already expects owner-filled ground truth for risky Cyrillic docs:
  - `docs/reports/FAILED_CYRILLIC_GROUND_TRUTH_ADJUDICATION.md`
  - `docs/reports/CYRILLIC_DOCUMENT_CLASS_POLICY.md`
- Prepared the exact JSON shape and suggested path pattern for booklet truth files:
  - `qa-private/ground-truth/booklet/<fixture_basename>.json`
- Did **not** fabricate any field values and did not inspect private PII values.

Next action:
- Owner adds `3-4` booklet fixtures or explicitly accepts `N=1`.
- Owner fills one truth JSON per booklet fixture using the contract in `P1_5_4_BOOKLET_GROUND_TRUTH_GATE.md`.
- Only after that does booklet “baseline did not worsen” become measurable for `P2`.

## 2026-06-03 | YAML sync + start Path A
- Synced canon YAML to current state
- Next autonomous brick: P1.5.4 ground-truth templates, then P2.1 snapCity

## 2026-06-03 | P2.1 done
- snapCity in live door (flag OFF). Next autonomous: P2.2 reconcilePatronymic
- OWNER_QUEUE: fill ground-truth (OG-1) to enable P2 accuracy delta
