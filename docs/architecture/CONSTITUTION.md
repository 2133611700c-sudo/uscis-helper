# THE CONSTITUTION — the laws above everything (2026-06-22)

The single, top-level set of inviolable laws for reading documents and filling/serving
ALL products (Translation, TPS, EAD, Re-Parole). Below this sits ONE CODEX of knowledge
+ rules (`packages/knowledge`); below that, ONE BRAIN pipeline; below that, thin product
adapters. Consolidates ADR-017 (one brain), ADR-018 (model matrix), and
`ONE_BRAIN_CYRILLIC_CONSTITUTION`. A deviation is a BUG, not an option. Each law cites
where it is ENFORCED in code so it is checkable, not aspirational.

## The Laws

**L1 — ONE READER.** `gemini-3.1-pro-preview` is THE document reader (D1) for ALL
products, ALL doc classes. Flash models are availability fallbacks only; a fallback read
of a non-Latin doc is force-reviewed and is NEVER a quality/acceptance number; some are
disqualified for whole doc classes. *Enforced:* `modelMatrix.ts`, `geminiVisionProvider.ts`,
`documentFieldReader.ts` (fallback_model_used), `modelMatrix.test.ts` + CI guard. (ADR-018)

**L2 — ONE CODEX.** ALL knowledge (transliteration/KMU-55, gazetteer, oblasts,
authorities, months, civil-status, countries, settlement types, doc-number formats) AND
all per-document reading rules live ONLY in `packages/knowledge`. No parallel dictionary
anywhere else. Every AI prompt + every module gets its knowledge from the codex. *Enforced:*
`oneDictionaryGuard.test.ts` (fails the build on any Cyrillic→Latin map outside the codex),
`docReadingRules` completeness test.

**L3 — DeepSeek = PROSE ONLY.** DeepSeek never sees pixels, never decides identity / date /
number / Cyrillic, and its claimed `final_value` is never trusted (deterministically
overwritten from `source_value`). It is for D3 prose translation only. *Enforced:* ADR-018
matrix; the DeepSeek sanitizer; (re-instate the boundary guard — OPEN, see roadmap).

**L4 — RAW_CYRILLIC IS PRESERVED.** The original Cyrillic read is carried end-to-end; D2
dictionaries/validators operate on the Cyrillic, never on already-transliterated Latin.
KMU-55 is defined FROM the Cyrillic. *Enforced:* `ExtractedDocField.raw_cyrillic` (GAP A —
carry it through `FieldCandidate`/`CanonicalField`, OPEN).

**L5 — C3 IS THE SINGLE WRITER OF final_value.** One gate decides the release value.
`finalValue === null` ⇒ the value is NOT released and is NEVER resurrected downstream.
*Enforced:* `documentSafety/applyOcrFieldSafety`, `getCanonicalValue`, the cross-product
anti-drift audit harness.

**L6 — NEVER GUESS A CRITICAL FIELD.** A handwritten/uncertain critical field ⇒
`review_required=true` + `value=null` (manual entry), never a fabricated value. A stably
read handwritten value is NOT proof of correctness (a cursive 25 can read as 26 on every
pass) — a handwritten DATE never self-anchors. *Enforced:* C3, `strongSourceAnchor.ts`,
`autoDeliveryConsensus.ts`, the registry-backfill surfacing of unread fields.

**L7 — CONTROLLING LATIN WINS.** The official Latin printed on the document (passport bio,
MRZ, EAD, I-94) is returned EXACTLY as printed; it beats any re-transliteration (passport
"SERGII" beats KMU-55 "SERHII"). *Enforced:* MRZ authority in arbitration; `docReadingRules`.

**L8 — SOURCE-FAITHFUL TRANSCRIPTION.** Transcribe the script that is ON the page: a
Russian-language (Soviet) document stays Russian, a Ukrainian one stays Ukrainian — never
silently convert one to the other. A genuine RU/UA ambiguity surfaces for review; the
dictionary may flag, never silently rewrite. *Enforced:* source-script gate; `docReadingRules`.

**L9 — TEACH EVERY AI FROM ONE SOURCE.** Per-document reading rules (with real examples)
that teach the model HOW each document writes each field live in the codex
(`docReadingRules`) and feed BOTH the Gemini prompt and any other AI — no AI carries its
own divergent inline rules. *Enforced:* `docReadingRules` + completeness test; (DeepSeek
sharing — OPEN).

**L10 — SAFE CHANGE DISCIPLINE.** Every recognition/auto-delivery change ships flag-gated
default OFF, proven byte-identical when OFF, measured on the real-document harness, and is
never flipped in production without the owner. Read the existing report FIRST (RULE #1).

## The hierarchy
```
CONSTITUTION (these laws)
   └── CODEX  (packages/knowledge: knowledge data + per-document rules, no duplicates)
         └── ONE BRAIN (D0 quality → D1 Gemini reads image[+OCR/MRZ hint] → D1.5 raw_cyrillic
              → D2 codex normalize/validate → C3 single final_value → D3 DeepSeek prose
              → D4 validators → D5 review → D6 PDF → Audit)
                └── PRODUCTS (thin adapters: Translation, TPS, EAD, Re-Parole)
```

## Status of the unification (2026-06-22 — most laws now enforced)
- **L1/L3 — DONE.** VERIFIED: all 4 products (translation, TPS-UA, EAD, Re-Parole) read
  through the ONE Gemini `readDocument` brain (`oneBrainGuard.test.ts`). DeepSeek is the
  SECONDARY US-Latin-doc path only, now bounded by explicit role lines + the re-instated
  `deepseekBoundaryGuard` (U-STAGE 2).
- **L2 — DONE.** One Codex; the forked TPS transliterator now delegates to the package;
  `oneDictionaryGuard.test.ts` fails the build on any new fork.
- **L4 — DONE (Phase 2.0).** `raw_cyrillic` is threaded ExtractedDocField → FieldCandidate
  → CanonicalField; D2 receives the Cyrillic (`arbitration.ts inputForD2 = f.rawCyrillic`).
- **L5 — DONE.** C3 now runs unconditionally on the Core path too (closes GAP-2).
- **L9 — DONE.** `docReadingRules` (per-document, default ON) feed the Gemini prompt for all
  products; DeepSeek prompts carry bounded-role lines.
- PDF (render layer): mirror renderer determinism pinned + leak-gated (U-STAGE 5); the two
  renderers are NOT yet collapsed (deferred, low risk). Form gating unified behind
  `SHARED_FORM_GATE_ENABLED` (U-STAGE 4, default OFF — flip after measure).

## Remaining (small)
- Codex DATA: load the full КАТОТТГ village/raion tier (external download + bundle decision).
- Flip the measured flags (SHARED_FORM_GATE / DICTIONARY_AUTOCORRECT / consensus) per the
  real-doc harness, owner-gated.
