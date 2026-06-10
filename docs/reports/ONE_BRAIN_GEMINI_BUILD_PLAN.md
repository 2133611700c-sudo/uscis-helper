# ONE BRAIN (Gemini) — phased build plan

Decision: ADR-017. Target: one Gemini brain + deterministic knowledge truth + review gate, shared by ALL products.
Constraints (owner): Gemini = recognition (all keys/models); DeepSeek = retained fully (prose, Mia, crossref); GPT = removed; HTR = parked. Keys/prod = owner-managed; agent builds to preview-ready, owner flips prod.

Rule for every phase: behavior-changing code ships behind a flag (default OFF) → tests → preview proof → owner flips prod. tsc 0 + full suite green every commit. No PII; qa-private untouched.

## Phase 1 — Dictionary IN the brain  (CODE, no prod)
The accuracy fix. Knowledge applied to the FINAL value for ALL products, in one place.
- [x] **1.1** `canonical/core/knowledgeNormalize.ts` — pure deterministic normalizer (KMU-55 / gazetteer / patronymic / oblast→nominative / authority / Latin-preserve). 8 tests. **DONE** (this commit).
- [ ] **1.2** Wire it into `canonical/core/arbitration.ts` (`normalizedValue` = `normalizeCanonicalValue(...)`) behind `KNOWLEDGE_BRAIN_ENABLED` (default OFF → byte-identical). Tests: off=identical, on=rules enforced.
- [ ] **1.3** Pass doc-class + sex + given-name context from each adapter (translation/tps/reparole/ead) into arbitration so patronymic/place get full context.
- [ ] **1.4** Local proof on real fixtures (Militsiya, oblast, patronymic) like the C3 real-doc proof.

## Phase 2 — One pipeline (consolidation)  (CODE + owner flip)
Kill fragmentation. Make Gemini-Core the default reader for every product; retire forks.
- [ ] **2.1** Make `ONE_CORE_*` the DEFAULT path (flag still allows fallback) for Translation/TPS/Reparole/EAD; preview-prove each product reads + builds its PDF.
- [ ] **2.2** Retire the legacy ungated `/api/ocr/extract` DeepSeek+gpt path (RC-3). Confirm no live caller, then remove.
- [ ] **2.3** **Remove GPT-4o/gpt-4o-mini** code + `ENABLE_OPENAI_VISION` (owner: GPT not used).
- [ ] **2.4** Reparole: extend Core to i94/ead/dl (today they fall back to TPS).

## Phase 3 — Safety gate ON  (owner flip, already built)
- [ ] **3.1** Field-safety (C3, `OCR_FIELD_SAFETY_ENABLED`) default-on after Phase 1/2 (candidate≠final proven on real docs locally 2026-06-09).
- [ ] **3.2** Self-consistency as instability detector (disagree→review), not a vote.

## Phase 4 — Provenance / audit log  (CODE)
- [ ] **4.1** Persist per-field origin (reader / dictionary / MRZ / user_corrected) + review reasons; surface "source" in the review UI. Enables trust + future calibration.

## Phase 5 — Tabs, professional pass  (CODE/UX, per product)
From the surface maps, finish each product's tabs:
- [ ] Translator (7-step): wire Lab "upload your own" (currently "coming soon"); ensure review gate uses the knowledge-normalized value.
- [ ] TPS (6-step): confirm Core path + knowledge on review screen.
- [ ] Reparole (5-step): wire Part 1 Item 1.e Re-Parole checkbox in the I-131 field map; family-member/travel rows.
- [ ] Shared: review surfaces show field + crop; uncertain → empty until pay (anti-screenshot).

## PARKED (do not build until GT from different people justifies)
- HTR (Transkribus PII/DPA vs own TrOCR). Gemini-pro reads handwriting today.
- Empirical confidence-threshold calibration (needs GT breadth).

## Owner actions (the only blockers)
- Provide/rotate prod Gemini + Vision keys in Vercel (agent never handles prod secrets).
- Flip each phase's flag in prod after the preview proof.
- Provide ground-truth from DIFFERENT people to unblock calibration + the HTR decision.
