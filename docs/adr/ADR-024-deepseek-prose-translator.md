# ADR-024 — DeepSeek prose translator: built, proven, gated until a prose field exists

Date: 2026-06-22
Status: ACCEPTED (owner delegated the decision: "прими сам решение, делай как нужно")
Related: ADR-017 (one brain), ADR-018 (model matrix), CONSTITUTION L3 (DeepSeek prose-only)

## Context
Constitution L3 / RECOGNITION_ORG_CHART D3 assign DeepSeek ONE job: translate open PROSE
to English; never touch identity (names/dates/numbers); its output is never trusted. The
prose translator was dead/unwired. We built it SAFELY and the owner asked to bring it live
and test it critically ("не верю что справится без ошибок").

## What we built (and proved)
`lib/translation/prose/translateProse.ts` — safe-by-construction:
- Identity is masked to opaque `{{LOCK_n}}` placeholders BEFORE DeepSeek sees the text, so a
  model error can never corrupt a name/date/number.
- A deterministic GUARD verifies the output (every placeholder survives exactly once, no
  Cyrillic leak, no hallucination/length-blowup, non-empty). Any failure ⇒ review_required +
  english=null. Only a clean output restores the locked Latin.
- Adversarial tests (12) prove the guard catches every failure mode (dropped/mangled/
  duplicated placeholder, Cyrillic leak, hallucination, empty, throw, prompt-injection).
- LIVE probe on the real DeepSeek: `deepseek-chat` (V3) = 3/3 clean + injection-resistant;
  `deepseek-reasoner` (R1) returned EMPTY on a case → V3 is correct (pinned). The guard
  caught R1's failure.

## Decision
1. **Model = `deepseek-chat` (V3)**, pinned (override `DEEPSEEK_PROSE_MODEL` only with
   evidence). R1 is the wrong tool for translation (over-reasons, empty content, slower).
2. **Do NOT bolt translateProse onto the live certified-translation render.** VERIFIED: the
   live canonical render handles 100% STRUCTURED fields (kinds: name/date/place/agency/
   doc_number/sex) deterministically (KMU-55 + glossary). There are **no free-prose fields**
   in the canonical document registry — the only genuine narrative field (`basis_of_divorce`,
   "court decision / mutual agreement") lives in a legacy module not on the live canonical
   path. Adding an LLM call to a render with nothing to translate is cost + latency + risk for
   zero benefit — a top engineer does not add dead weight.
3. **Activation trigger (when to wire it):** the moment a genuine free-text/narrative field
   (e.g. `basis_of_divorce`, `court_decision_details`, a remarks/notes field) enters the
   CANONICAL pipeline, route THAT field's value (when it contains Cyrillic prose) through
   `translateProse` in the render value layer — behind a flag, with the guard + fallback to
   the current transliteration on guard-failure. The integration point is `renderValueForPdf`
   (a field-aware wrapper): structured kinds keep deterministic transliteration; a narrative
   kind gets translateProse.

## Consequences
- The capability is complete, tested, proven, and parked — ready in one wiring step.
- The legal render stays deterministic (safest) for all current document content.
- Re-evaluate when the divorce/court narrative fields are promoted to the canonical path.
