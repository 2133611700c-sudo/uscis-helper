# ONE BRAIN — General Convergence Plan (Cyrillic Document Intelligence)

**Date:** 2026-06-28 · **Base:** branch `translation/ru-and-model-matrix-fixes` @ `ed918eb` (verify tip before any work).
**Authoritative.** Supersedes the contradictory parts of older truth-maps. Built from a 10-agent code-grounded audit + all prior owner audits. Scope: recognition / Cyrillic / knowledge-core / evidence / decision / integration into the 4 products. **Out of scope (do NOT touch):** Supabase/repository refactor, payments/Stripe, infra, marketing.

> **One brain ≠ one model.** One brain = **one door, one namespace, one canonical type, one evidence contract, and exactly one function allowed to decide a field's final value.** Readers observe → Knowledge suggests → Decision Engine decides → Review confirms → Adapter lays out. No reader/dictionary/legacy module/DeepSeek may write a final value.

---

## 0. VERIFIED REALITY (corrections to earlier beliefs)

- **Spine is real:** `readDocument(...)` is called by **all 4 products** — `translation/vision-extract:367`, `tps/ocr/extract:318`, `ead/ocr/extract:175`, `reparole/ocr/extract:192`.
- **Knowledge core `packages/knowledge` is real and wired** (KMU-55, RU translit, patronymic, MRZ, docNumberFormats, registry 54 rows). **No standalone MT model** (no Marian/NLLB).
- **Geography = FULL КАТОТТГ wired** — `settlements.generated.ts` + `villages.generated.ts` (**~17,417 villages**, 228KB/382KB) imported into `gazetteer.ts`. (My earlier "53-entry stub" was a `wc -l` artifact — RETRACTED.) Gap = historical aliases + fuzzy-on-villages OFF (perf) + agency `source_act` verification.
- **"0% birth" = N=1**, one `child_dob` field, CER 0.2, REVIEW-flagged, on a **removed preview model** — NOT engine-broken. Printed docs (passport, military) already `production_ready`. The unsolved problem is **handwriting** (all HTR 0/3; GA LLMs fabricate) → handwriting stays **manual-review-only**.
- **Already built by parallel sessions** (build ON these, don't duplicate): `AbstentionReason` enum (`ocr/abstention.ts`), `contractExtractionBoundary.ts` (Gemini→contract schema+candidate-only sanitizer), `contractObservability.ts` (PII-free events), `finalPdfGate.ts` + route invariant, `splitMergedFields.ts`/`contractFieldFlow.ts`, `contractReviewState.ts`, unified Document Contract (birth-cert), repo cutovers #1–13.
- **Forks that break "one brain" (must collapse):**
  - Translation: **`vision-extract` (LIVE, Gemini, no bbox)** vs **`ocr-from-storage` (dark, Vision→DeepSeek→bbox)**.
  - TPS: Core → `legacy modules` (route:402) → `DeepSeek brain` (ON by key) → `dualOcrCrossref` (default ON; maps patronymic→middle_name slot).
- **Flag posture (prod defaults):** `KNOWLEDGE_BRAIN_ENABLED` **ON** (rewrites normalizedValue on accept), `DOC_SCRIPT_ROUTING_ENABLED` **ON**, `CONTENT_ORIENT_ENABLED` **ON**, `DUAL_OCR_CROSSREF` **ON**; `SMART_NORMALIZE`/`DICTIONARY_AUTOCORRECT`/`DICTIONARY_CLEARS_SOFT_REVIEW`/`UNIFIED_DOC_CONTRACT_*`/`FINAL_PDF_CONFIRMATION_GATE`/`OCR_FIELD_SAFETY`/`HTR_SIDECAR_URL`/`DOCAI` **OFF**. ⚠ The four default-ON flags are live and NOT byte-identical-to-off — govern them as enforced, not shadow.
- **External-blocked (owner-only):** Gemini 429 spend cap; Google Vision/DocAI billing 403; HTR sidecar host; GT corpus N=20-50 from multiple people; staging DB E2E; PII purge of dangling `31b62cd`.

---

## 1. TARGET ARCHITECTURE (one door)

```
4 products + BOTH translation routes
   → readDocument(...)              # public facade; orchestrator extracted from existing route sequence (NOT a new component)
   → preprocess (quality / orientation / classify)
   → Reader Adapters [Gemini | Vision | DocAI | HTR | legacy-module | DeepSeek-mapper(dependent)]
   → ReaderResult[]                 # observation only: rawCyrillic + evidence + confidence + abstention; never decides
   → Evidence Normalization         # all bbox/layout → ONE EvidenceRegion, BEFORE decision; honest status
   → Candidate / Namespace Norm     # all field names → ONE contract namespace (+ CI guard)
   → KnowledgeEvaluator             # SIGNALS ONLY (KnowledgeDecision); never rewrites
   → ONE Decision Engine            # readers + evidence + knowledge + validators → accept/review/abstain/conflict
   → CanonicalField[]               # raw immutable; only the Decision Engine writes finalValue
   → product adapters (translation / tps / ead / reparole)   # lay out only
```

**Build method = extract-not-rebuild.** The "one door" + "Decision Engine" already exist fragmented as `readDocument → buildCanonicalResult → arbitrateDocument(D2) → anti-fab → applyOcrFieldSafety(C3) → adapter`. Extract that sequence into one `recognizeDocument()` / `decisionEngine.ts`; do NOT introduce a parallel `RecognitionOrchestrator` (would become a 5th brain).

---

## 2. INVARIANTS (a permanent parity-trap test must enforce all)

1. All 4 products + both translation routes call **only `readDocument`**; no direct reader calls in routes.
2. Reader **observes**; Knowledge **suggests**; **only the Decision Engine** writes `finalValue`/status.
3. `rawCyrillic` immutable end-to-end; normalization happens in **one place**; **one `snapCity`** caller.
4. Reader emits no key outside the contract namespace (CI guard).
5. No reader self-confirms via repeated calls (self-consistency ≠ confirmation); **DeepSeek = dependent mapper, never a consensus vote**.
6. Evidence attached at candidate creation; `full_image`/`zone_fallback` labelled honestly, never "exact".
7. Conflict → review; no-evidence → review/abstain; all-abstain → null; handwriting+one-reader → manual review.
8. Provider key ≠ permission (flag + paid/non-train tier + doc-class + owner policy).
9. byte-identical during adaptation; after shadow+GT a measured-better result is allowed.
10. Adapter lays out only (may put patronymic in form-slot `middle_name` **while keeping `fieldKind=patronymic`**); never reads/normalizes/confirms; **UI never shows "Middle Name" for a patronymic**.

---

## 3. PER-SERVICE PLAN

### 3.1 Translation (engineer/architect)
- **AS-IS:** dual pipeline. `vision-extract` (live) has no bbox; `ocr-from-storage` produces bbox (Vision→`resolveOcrIds`) but the wizard never calls it; `generate-pdf` fakes bbox `[0,0,0,0]` and gates behind `assertReviewGate`→`finalPdfGate`(OFF)→`shouldBlockRawPdfFallback`(OFF).
- **TARGET:** `vision-extract` = the facade caller; `ocr-from-storage`'s Vision+`resolveOcrIds` becomes a **bbox/evidence Reader adapter** (drop its DeepSeek field-mapper — the arbiter owns semantics). bbox flows as `CanonicalField.sourceEvidence` → review → PDF (replace the `[0,0,0,0]` fake).
- **Steps (additive, flag `TRANSLATION_BBOX_EVIDENCE_ENABLED` OFF):** S1 optional `sourceEvidence` on CanonicalField; S2 extract `visionBboxLocator.ts` (pure, no DeepSeek); S3 wire as evidence pass in vision-extract (OFF=byte-identical); S4 carry to generate-pdf; S5 source-crop on review. Then deprecate `ocr-from-storage`.

### 3.2 TPS (engineer/architect)
- **AS-IS:** 4 planes write final directly — Core (tps_core), legacy modules (route:402-875), DeepSeek brain (route:877-998), dualOcrCrossref (route:426/734). `oneBrainGuard` only checks the string `readDocument` exists — does NOT stop the other 3 planes.
- **TARGET:** legacy modules / dualOcr / DeepSeek become **Reader adapters** emitting candidates into the same arbitration list; only the Decision Engine writes final. patronymic keeps `semantic_kind=patronymic`; slot→middle_name is a late projection. DeepSeek **PII-gate** (invert `isBrainEnabled` so key≠permission).
- **Steps (flags OFF):** S1 `TPS_DUALOCR_AS_READER`; S2 `TPS_USFORMS_VIA_CORE` (map i94/ead/i797→docintel); S3 DeepSeek PII-gate; S4 UA-doc legacy→reader (after HTR decision).

### 3.3 EAD (I-765) + ReParole/U4U (I-131)
- **AS-IS (good):** both already consume canonical via pure adapters (`eadAdapter`/`reParoleAdapter` honor C3 finalValue); packet builders fill from `buildI765/I131DocumentOps`; cross-product parity test exists. The two i765 field maps are NOT duplicates (both delegate document fields to one shared mapper).
- **Fixes (small):** delete stale `ONE_CORE_*` flag mentions (no runtime gate exists — misleading); turn `SHARED_FORM_GATE_ENABLED` ON so EAD gets the Cyrillic/A-number content firewall ReParole already has; add an enforce-mode extract→generate carriage test. ReParole i94/ead/dl slots still use the TPS OCR path — bring under Core for full coverage.
- **Keep:** EAD free vs ReParole paid is intentional policy; DRAFT watermark stays.

### 3.4 Reader layer + ReaderResult
- **Greenfield:** no `ReaderResult` exists. Add `readers/ReaderResult.ts` (rawCyrillic + isoDate + confidence + abstained + evidenceRegion + status{ok|unavailable|abstained|partial} + readerFamily + `dependent?`). Gemini adapter first (maps `VisionReadResult`, **byte-identical**); disabled stubs for Vision/DocAI/HTR (return `unavailable`, no network). Do NOT rewire `documentFieldReader` until parity green. `unavailable` ≠ empty-success (fail closed).

### 3.5 Knowledge unification
- **AS-IS:** TWO+ normalization layers (reader `toCanonicalValue` transliterates `value`; SMART_NORMALIZE Door A/B; KNOWLEDGE_BRAIN arbitration overwrites `normalizedValue`) → same raw normalized **twice**; **two `snapCity` callers**.
- **TARGET:** one `KnowledgeEvaluator` at raw-Cyrillic returning **signals only** (`KnowledgeDecision{suggestedValue,rule,strength,evidenceRequired,reviewRequired}`); remove the `normalizedValue = d.finalValue` rewrite in `arbitration.ts:290`; one `snapCity`; collapse reader Layer-A transliteration into the evaluator. Names/numbers stricter than closed-sets (name without controlling-Latin → suggest-only, never auto-accept).
- **Gate:** shadow harness (reuse `shadow.ts`/`liveShadow.ts`) → enable per-field-kind only after measured GT delta; stop-rule 0 gain → keep OFF. **Blocked on GT.**

### 3.6 Evidence/bbox + namespace
- **Namespace:** every field-list island (7: documentRegistry, documentBrain schema, dualOcrCrossref, documentContracts, translationExtractor, extraction prompts, field-mapper) becomes a **projection of the Unified Contract** + a **CI guard test** (every reader key ↔ contract key). Kills child_*/family_name, patronymic/middle_name, dob/date_of_birth drift. `contractExtractionBoundary.ts` already seeds this for birth-cert.
- **Evidence:** promote `EvidenceItem` → one `EvidenceRegion {fieldKey,bbox 0-1,page,status,source,crop_path}`; per-provider adapter at response boundary; honest status (Gemini→`full_image`, template→`approximate`, OCR token→`exact`/`combined`). Usable live bbox source today = `FIELD_BOX_TEMPLATES` (deterministic, key-free) — Vision is 403.

### 3.7 Decision Engine + review + abstention + final-PDF
- **AS-IS:** decision fragmented across 5 modules / 3 stages (arbitration, C3 applyOcrFieldSafety, reviewGate, finalPdfGate, contractReviewState) each re-deriving status; 4 gates in generate-pdf with 3 default-OFF flags.
- **TARGET:** one `decisionEngine.ts` (extract from arbitration+C3) emitting `FieldDecision{status: accept|review|abstain|conflict, finalValue(only on accept), candidateValue, suggestedValue, reasons:AbstentionReason[]}`. reviewGate/finalPdfGate become pure readers of it. **Invariant test:** `finalValue` written ONLY in the engine; `status!=='accept' ⟹ finalValue===null`.
- **Flag order to enforce (after GT):** C3 `OCR_FIELD_SAFETY_ENABLED` first → then `FINAL_PDF_CONFIRMATION_GATE` (depends on C3) → `CONFIRMED_VALUE_GUARD_MODE=enforce`. Keep `DICTIONARY_CLEARS_SOFT_REVIEW` OFF.

### 3.8 Measurement (the enable-gate for everything)
- **AS-IS:** scorer `cyrillicAcceptanceMetrics.ts` (CER, field-exact, EMPTY first-class, fabricated, false-final, review-rate, wrong-translit, mrz-conflict; gate fabricated=0 ∧ false_final=0 ∧ exact≥0.95); runner `cyrillic-acceptance.ts` (real readDocument, ADR-018 primary-only, 429→BLOCKED); committed `CYRILLIC_PILOT_ACCEPTANCE.json` (N=3, stale removed-model).
- **MISSING:** wrong-field-assignment, abstention precision/recall, printed-vs-handwritten + UA-vs-RU + per-field-kind rollups, error taxonomy (18 codes), committed PII-free per-field diff.
- **Steps:** add the missing metrics + taxonomy; committed **fictional** GT fixtures (real PII only in gitignored qa-private); `bench:cyrillic` alias + CI-safe fixture bench; before/after protocol gate before any flag flip. **Blocked on Gemini quota + real corpus.**

---

## 4. USER-FACING PLAN (age 35–80, immigrant, often phone, ESL)

**Reality:** the 4 products do NOT share review UI; Translation is most evolved (real `SourceCropViewer`, plain confidence labels) but **localizes only en/ru — a Ukrainian user gets a Russian screen** (`TranslateWizard.getT` RU fallback). TPS/EAD/ReParole have NO source image and use `window.prompt()` edits.

**Principles:** (1) source crop **always visible** for critical fields (never hidden behind a toggle) — it's the only way a non-English reader verifies the Latin form of their own Cyrillic name; (2) **no OCR jargon** — replace "Word-level OCR · exact position" with "This is the part of your document we read"; (3) **Patronymic explained inline**, never "Middle Name"; (4) honest states — "We couldn't read this — please type what you see"; (5) two loud states: green "Looks good" vs red "You must check this"; (6) ≥18px decision text, ≥48px primary tap; (7) no silent autofill, no bulk-confirm for critical fields; (8) localized wait/progress; (9) stake reminder near confirm: "You sign this — a wrong letter can delay your USCIS case; payment is only after you review."

**Top user fixes:** (a) localize Translation review+wizard to uk/es (or at least EN fallback, never RU-for-Ukrainians); (b) default-expand source crop for critical fields; (c) port a source-image viewer + replace `window.prompt` editing into TPS/EAD/ReParole.

**Acceptance:** a 70-year-old, in their language, uploads → understands each field with its crop → fixes one field in an in-page modal → confirms each critical field individually → signs → downloads PDF, unassisted.

---

## 5. EXECUTION ORDER (parity-trap = permanent guard; Measurement = parallel track gating F/H/I/J)

0. Inventory + fork taxonomy (this doc) + **parity-trap red test**.
A. `ReaderResult` + Gemini adapter (byte-identical).
B. One namespace (contract projection) + CI guard.
C. `EvidenceRegion` adapter (bbox at provider-response).
D. Extract `recognizeDocument()`/`decisionEngine.ts` (shadow vs live, byte-identical).
E. Merge translation routes → bbox on live wizard.
F. One KnowledgeEvaluator (shadow→canary). *needs GT*
G. Legacy/DeepSeek/dualOcr → Readers + DeepSeek PII-gate.
H. 2nd independent reader + true consensus (shadow). *needs Vision/DocAI billing or HTR host*
I. Real-GT benchmark. *needs Gemini quota + corpus*
J. Canary per field-kind → enforce. *needs staging E2E + owner sign-off*

**Parallel UX track:** localize Translation; default-expand crop; port crop+modal to TPS/EAD/ReParole.

---

## 6. OWNER ACTIONS (external blockers — code can't resolve)

| id | blocker | minimum action | verify |
|---|---|---|---|
| GEMINI_QUOTA | 429 monthly spend cap | raise cap at aistudio.google.com/app/spend (Flash rejected — don't re-propose) | primary read returns 400 not 429 |
| GT_CORPUS | N=3 only | 20-30 verified docs from MULTIPLE people → gitignored qa-private | `check-no-pii.mjs` clean |
| VISION_DOCAI_BILLING | 403 | enable Vision/DocAI API + billing (only if 2nd-reader/bbox via Google) | `gcloud services list` |
| HTR_HOST | sidecar unset | host raxtemur; set `HTR_SIDECAR_URL` (staging) | `/read` returns {text,confidence} |
| PII_PURGE | dangling `31b62cd` | GitHub Support sensitive-data removal (incident doc ready) | object unreachable by ref (already true) |
| FLAG_SIGNOFF | prod flips owner-only | flip per CONTRACT_FLAG_ROLLOUT after staging E2E PASS | OFF golden unchanged |

---

## 7. COORDINATION (critical)

Branch is **multi-session** (owner's own concurrent agents + ~30 worktrees). **All new code goes in an isolated worktree off the current tip**; rebase often; pin `git rev-parse origin/translation/ru-and-model-matrix-fixes` before any push. **Push is owner-only.** Permanent guards that must stay green (collision detectors): `noDirectSupabaseInDomain.test.ts`, `finalPdfGateRouteInvariant.test.ts`, `brainSingleArbiterInvariant.test.ts`, `oneBrainGuard.test.ts` — plus the new parity-trap + namespace CI guard from steps 0/B.

---

## STATUS 2026-06-29 — code spine COMPLETE (flag-gated), branch feat/one-brain-reader-result (unpushed)

DONE (additive, byte-identical OFF; `tsc` green; targeted one-brain cutover tests green):
- STEP 0 fork registry + parity guards (Level 1 oneBrainForkRegistry + Level 2 ratchet).
- STEP A ReaderResult + Gemini adapter + disabled reader roster (Vision/DocAI/HTR).
- STEP B namespace CI-guard (registry/schema + the other islands, ratcheted KNOWN_UNMAPPED).
- STEP C EvidenceRegion contract + provider adapters + visionBboxLocator (pure, fail-open).
- STEP D recognizeDocument — the ONE internal orchestrator (per-page readOpts + per-page model).
- STEP E recognition cutover of ALL 4 product routes to recognizeDocument, flag ONE_BRAIN_RECOGNIZE_ENABLED
  (default OFF = byte-identical): EAD, ReParole, TPS core, Translation core.
- STEP I measurement taxonomy + rollups (wrong-field-assignment, abstention P/R, per rendering/lang/field-kind).

NOT DONE (honest):
- Flags default OFF → ONE BRAIN is NOT live in prod (nothing changes until flipped).
- STEP E payoff: template-evidence is wired in the Translation backend behind
  `ONE_BRAIN_EVIDENCE_ENABLED`, but the live review UI still does NOT render EvidenceRegion/crops.
  Vision/DocAI exact bbox remains billing-403.
- STEP F one KnowledgeEvaluator + single snapCity (two snapCity callers remain) — shadow + GT-gated.
- STEP G legacy/DeepSeek/dualOcr → readers + DeepSeek PII-gate (key≠consent) — behavior change, needs sign-off.
- STEP H 2nd independent reader + true consensus — needs Vision/DocAI billing or HTR host.
- STEP I real-GT benchmark + STEP J canary — need Gemini quota + GT corpus + owner flag sign-off.

OWNER-BLOCKED (code cannot resolve): Gemini 429 spend cap; GT corpus N=20-30 (multi-person);
Vision/DocAI billing 403; HTR sidecar host; production flag sign-offs. PUSH is owner-only.
