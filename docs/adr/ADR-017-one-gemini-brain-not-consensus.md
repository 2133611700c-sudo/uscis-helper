# ADR-017 — Recognition core = ONE Gemini brain + deterministic knowledge truth, NOT multi-reader consensus

Date: 2026-06-09
Status: ACCEPTED (owner-directed rebuild; supersedes the "consensus / multi-reader org-chart" framing and the OneBrain park in ADR-016 for the recognition core)
Owner mandate: "распознавание через Gemini (все ключи/модели); DeepSeek используем полностью; GPT пока не используем; сделай как должно быть."

## Context

The product ships document recognition for four surfaces — Translator, TPS, Reparole, EAD — plus a Mia FAQ bot. A 2026-06-09 zero-trust audit + 5-agent surface map established the real state:

- Gemini is ALREADY the primary document reader (`docintel`, `gemini-2.5-pro` → `3.5-flash` → `2.5-flash`), but is the DEFAULT only for the Translator. For TPS/Reparole/EAD the Gemini "Core" path is parked behind flags (`ONE_CORE_TPS_ENABLED`, `ONE_CORE_REPAROLE_ENABLED`, `ONE_CORE_EAD_ENABLED`, `ONE_BRAIN_CORE_ENABLED`) that nobody flips.
  - **⚠ CORRECTION (2026-06-29):** the `ONE_CORE_{TPS,EAD,REPAROLE}_ENABLED` flags described above were REMOVED in Phase 2.3/2.4. The EAD/ReParole/TPS Core paths are now UNCONDITIONAL (no env gate); the current code reads none of these flags (enforced by `deadFlagGuard.test.ts`). The only recognition flag the routes read is `ONE_BRAIN_RECOGNIZE_ENABLED` (orchestrator vs inline read). This bullet is kept as the original 2026-06-09 decision record. Canonical flag-truth: `docs/ocr/ONE_BRAIN_CONVERGENCE.md` §Flag Truth.
- TPS default = Google Vision OCR + deterministic rule modules. Reparole = Gemini-Core for passport/booklet, TPS fallback for i94/ead/dl.
- DeepSeek = Mia FAQ, legacy `/api/ocr/extract` text-parse, optional prose translator, optional TPS dual-OCR crossref. NOT document vision.
- gpt-4o-mini = parked (`ENABLE_OPENAI_VISION` off).
- Knowledge (KMU-55, gazetteer, patronymic, oblast, authority) is strong + tested, but only PARTLY wired into outputs: TPS normalizes places/authorities; the Translator path does NOT → "Міліція"/genitive-oblast can reach the user.

The owner's reference design ("org chart") put a **consensus engine over 3 independent readers (HTR + Gemini + GPT-4o)** at the center.

## Decision

**The center of the system is ONE Gemini brain + a deterministic knowledge layer that can override the reader + a strict review gate — NOT a voting consensus of multiple readers.**

1. **One reader: Gemini.** `gemini-2.5-pro` for the current printed-field primary path; `*-flash` for availability only. Google Vision stays as the "eye" (raw text + MRZ input), not a competing reader.
2. **One shared pipeline.** All products call the SAME `readDocument` → `canonical/core` arbitration. Per-product recognition forks are retired. This is the real meaning of "ONE BRAIN" — one pipeline, not a committee.
3. **Knowledge (D2) is elevated to co-equal with the reader and lives INSIDE the brain.** KMU-55 / gazetteer / patronymic / oblast→nominative / authority are applied deterministically to the FINAL value for every product. The dictionary may OVERRIDE the reader (facts > opinion). Never silent: fuzzy/unresolved → review, value preserved.
4. **Self-consistency = instability detector, not a vote.** Two reads agreeing on a confident hallucination is still a hallucination; disagreement → review. (Memory: anti-fabrication-self-consistency.)
5. **Field-safety contract (C3) is the gate:** candidate≠final; zero-recognition≠success; no source → no final; hard-case → review.
6. **DeepSeek stays** (prose translation, Mia FAQ, dual-OCR linguistic crossref). **GPT-4o/gpt-4o-mini is removed.** **HTR (Transkribus/TrOCR) is explicitly PARKED** — Gemini-pro already reads handwriting; revisit only if ground-truth from DIFFERENT people proves Gemini insufficient.
7. **Provenance/audit log built early** (cheap, enables trust): per-field origin (reader / dictionary / MRZ / user). Auditor→HTR-training deferred.

## §D2 authority contract (AI-risk control — binding)

The dictionary may influence a value ONLY as an auditable authority layer, NEVER as a silent auto-replace
(else a Gemini hallucination is just traded for a dictionary hallucination — e.g. a gazetteer rewriting a real
place to a "similar" one). `knowledgeNormalize` returns a DECISION, not a value:
`{ action, finalValue, candidateValue, ruleId, reasonCodes, provenance, evidenceStrength }`.

- **accept / preserve** — a deterministic, evidenced transform (KMU-55 of clean Ukrainian Cyrillic; controlling
  Latin/MRZ preserved; oblast genitive→nominative known map; known authority pattern; gazetteer EXACT; date
  parse). The transform becomes the final value.
- **suggest / review / block** — any CONFLICT or unproven case (Russian spelling on a UA doc; gazetteer FUZZY;
  generated/garbled patronymic; unknown authority; unparsed date). The Core **keeps the read value**, surfaces
  the dictionary's proposal as `suggestedValue`, and forces `review_required` with `reasonCodes`. A critical
  identity field is **never** silently finalized from D2.

Wiring rule: `KNOWLEDGE_BRAIN_ENABLED=OFF` ⇒ arbitration is byte-identical (D2 not invoked). `ON` ⇒ accept the
safe transforms, route every conflict to candidate+review. Proven by `knowledgeNormalize.test.ts` (conflict
cases: Russian-on-UA → review; clean UA → accept; gazetteer exact → accept; gazetteer fuzzy → suggest;
patronymic fragment → review; MRZ Latin → preserve; unknown authority → review) + arbitration OFF=identical/ON
tests. Provenance (`knowledgeRule` / `knowledgeProvenance` on each field) feeds the Phase-4 audit log.

This is a managed control, not a belief: behind a flag, measured by tests now and by review-rate/conflict
metrics on traffic later; prod cutover stays owner-gated.

## BINDING CONTRACT — D2 / C3 / final_value (owner-approved 2026-06-09)

The primary risk is no longer the reader (Gemini) — it is **downstream bypass** (a value reaching the PDF without
passing the gate). The structural defense is: **`final_value` is null until C3 (or a human confirmation that
re-runs C3) grants it.** This contract is binding; Phase 2 may not start until it is recorded here.

1. **D2 = annotation / authority layer only.** D2 (`knowledgeNormalize`) returns
   `{ normalized_value, suggested_value, action, rule_id, provenance, evidence_strength, reason_codes }`.
   **D2 never writes `final_value`.**
2. **C3 = the single output gate.** Only C3 writes `final_value`.
   `accept_final` ⇒ `final_value = normalized_value`. `candidate | review | block | manual` ⇒ `final_value = null`.
   *(Refinement A — the gate is the only writer, but it runs again after a D5 user confirmation: a confirmation
   creates provenance, re-runs C3, and C3 may then set `final_value`. So a confirmed field CAN become final — via
   C3, never by bypassing it.)*
3. **D6 / PDF reads only `final_value`.** A **critical** field with `final_value = null` ⇒ block. No consumer may
   read `normalized_value` as a release value. *(Refinement B — only CRITICAL null blocks; admin/optional null does
   not block, matching `hasUnresolvedCriticalForOutput`.)*
4. **D5 review UI reads `normalized_value` + `suggested_value` + `reason_codes`.** Crop/source UI comes later via
   ReaderResult/Vision bbox; **crop does not block the safety MVP.**
5. **ONE criticality taxonomy** shared by D2 and C3. No two separate critical-field tables. (Consolidate D2's
   field routing onto C3's `classifyCriticality` — single source.)
6. **Adapters MUST NOT drop**: `suggested_value`, `rule_id`, `provenance`, `reason_codes`, `evidence_strength`,
   `review_required`. (Today `suggestedValue` is dropped — fixed in Phase 2/3.)
7. **Phase order (binding):** 1.4 local fixture proofs → Phase 2 Core-default/consolidation (one product at a time)
   → Phase 3 explicit `final_value` + C3 as the final writer → Phase 4 Knowledge canary (only after Core-default)
   → ReaderResult/crop later.

Status: `final_value` is NOT yet a field on `CanonicalField` (Phase 3 adds it). Until then the de-facto gate is
`normalized_value` + `review_required`; Phase 3 makes the null-until-granted invariant structural. Phase 2 is
built to this contract so the migration is additive.

## Why NOT the consensus org-chart

- The 2026-06-06 incident did not break because readers disagreed. It broke from: HTTP 502 on zero fields, `candidate≠final` not enforced, six ungated reader regimes. Consensus voting fixes none of these; a single gated pipeline + field contract + knowledge truth fixes all of them.
- With GPT excluded (owner) and HTR dead (401)/unbuilt, "three readers voting" is a committee of one — fiction.
- For Ukrainian hard-case docs the model Russianizes confidently; agreement among reads is not truth. Accuracy comes from the deterministic knowledge layer, not from more readers.
- Cost/latency: fan-out triples spend for no proven accuracy gain on current ground-truth.

## Consequences

- Lower cost/latency than fan-out. Single-vendor (Gemini) risk for recognition accepted, mitigated by the pro→flash fallback chain and DeepSeek retained elsewhere.
- Handwriting accuracy is capped by Gemini until GT justifies HTR — accepted, parked.
- Behavior-changing steps (making Core the default, wiring knowledge into outputs) ship behind flags, are proven on preview, and the OWNER flips prod env/keys (keys are owner-managed; the agent builds to preview-ready).
- Supersedes the "OneBrain parked until GT≥50" stance of ADR-016 for the recognition CORE: the core is now actively built; calibration of empirical thresholds still waits on GT from different people.

## Status of implementation

See `docs/reports/ONE_BRAIN_GEMINI_BUILD_PLAN.md` for the phased plan. Phase 1 brick #1 landed with this ADR: `canonical/core/knowledgeNormalize.ts` (pure, 8 tests) — the deterministic "dictionary in the brain", not yet wired into the arbiter (Phase 1 step 2, behind `KNOWLEDGE_BRAIN_ENABLED`, default OFF).
