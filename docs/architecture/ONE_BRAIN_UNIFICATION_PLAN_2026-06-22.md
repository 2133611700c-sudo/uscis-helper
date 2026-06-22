# ONE BRAIN for ALL Services — Divergence Map + Unification Plan (2026-06-22)

Owner mandate: ONE brain for ALL services, NO divergence; teach every AI (Gemini,
DeepSeek) my approach via rules/instructions; dictionaries are the shared brain all AIs
must use. Built from 4 parallel forensic audits (DeepSeek, form-filling, PDF, dictionary)
+ live path verification. Every claim cited to the audits/code; verify before trusting.

---

## PART A — THE DIVERGENCE MAP (proven — this is NOT one brain today)

### A1. TWO recognition brains
| Service | Reader | Dictionary use | Sees pixels? |
|---|---|---|---|
| Translation (live wizard → `vision-extract`) | **Gemini** `readDocument` | uses `@uscis-helper/knowledge` cleanly | YES |
| TPS / EAD / Re-Parole (`tps/ocr/extract`) | **DeepSeek** `documentBrain` + Vision/DocAI text | FORK (own translit + inline lists) | NO (text only) |
→ The same name/date/oblast can be transliterated DIFFERENTLY by the two brains.

### A2. DeepSeek is not a contained "prose-only" node (constitution LAW 7 broken)
- 5 hand-written prompts for the same task; 2 dead (the better-engineered ones); conflicting
  facts (24 vs 25 oblasts; "transliterate" vs "never normalize").
- Text-only everywhere (it never sees the image) — confirmed; but it is the PRIMARY identity
  extractor + transliterator on TPS/EAD/Re-Parole, and it GUESSES/reconstructs Cyrillic names.
- `deepseekBoundaryGuard` (the code that enforced "DeepSeek output can't reach final_value")
  was DELETED and never shipped. Only the TPS Brain has `hardenFinalValues` (overwrites with a
  FORKED transliterator); the legacy translation field-mapper has no equivalent.

### A3. Dictionary forks (CLAUDE.md "no parallel dictionaries" violations)
- `lib/tps/transliterate.ts` = a full parallel KMU-55 engine (DeepSeek path uses it, not the package).
- `documentBrain.ts MONTHS_UA_FULL`, inline oblast list; `field-mapper.ts` inline month/sex maps.
- `nameNormalizer.LATIN_LOOKALIKES` = a second confusion model vs `gazetteer.confusionDistance`.
- ЗАГС/РАЦС/ДРАЦС mapped in 3 places inside the package itself.

### A4. Form-filling: identity = one brain (good); gating = forked
- Shared canonical document mapper + an always-on anti-drift cross-product harness; NO AI in the
  fill path; deterministic. GOOD — keep.
- Completeness gating forked 3×: TPS (strong `readinessPolicy`), Re-Parole (duplicated thin), EAD
  (essentially NONE). EAD/Re-Parole boundaries FAKE OCR provenance on typed input.

### A5. PDF: form path shared (good); translation path forked
- `generateTranslationPDF` (US-Letter, deterministic, leak-gated) vs `renderOfficialTranslation`
  (A4, non-deterministic, ungated) — the latter is now DEFAULT for 8 doc types. Two sanitizers,
  three cert texts, determinism broken in the TPS-embedded path.

---

## PART B — THE UNIFICATION PLAN (one brain, staged, each flag-gated + measured)

**U-STAGE 1 — ONE DICTIONARY (the owner's emphasis; safest first).**
All AIs import `@uscis-helper/knowledge`; delete every fork.
- U1 delete `lib/tps/transliterate.ts` → re-export `transliterateKMU55`/`transliterateRussian`/`toWinAnsiSafe` from the package.
- U2 delete `documentBrain.MONTHS_UA_FULL` + `field-mapper` inline month/sex maps → package `convertDateToUSCIS`/`UA_MONTHS`/`SEX_MAP`.
- U3 fix 24-vs-25 oblast (Ukraine = 24 oblasts + 2 special cities); both prompts derive from the package oblast map.
- U4 resolve ЗАГС/РАЦС triple-mapping → delegate to canonical `registry.csv`/`AUTHORITIES`.
- U5 move `nameNormalizer.LATIN_LOOKALIKES` into the package (one confusion model).

**U-STAGE 2 — ONE SHARED INSTRUCTION/RULES BRAIN (teach ALL AIs my approach).**
The per-document reading rules (`docReadingRules.ts`, STAGE 1) become the SINGLE source of
reading instructions consumed by BOTH the Gemini prompt AND the DeepSeek prompts. One rule
set per document, per field — no AI has its own divergent inline rules.

**U-STAGE 3 — ONE RECOGNITION BRAIN (the big architectural call — owner decision).**
Today TPS/EAD/Re-Parole use DeepSeek; translation uses Gemini. Options:
  (a) Route ALL products through the Gemini `readDocument` brain (the audit's + constitution's
      target: a VLM that SEES the image beats text-arbitration); contain DeepSeek to PROSE only
      and re-instate the boundary guard. RECOMMENDED — but changes all products' OCR (cost/quota).
  (b) Keep DeepSeek for TPS but feed it the shared dictionary + shared rules (U1/U2) so it stops
      diverging — cheaper, but keeps the weaker text-only reader.
→ This needs a MEASURED Gemini-vs-DeepSeek comparison on real docs before flipping. Owner go/no-go.

**U-STAGE 4 — ONE GATING RULEBOOK** (build the designed `decideField()`/readiness contract):
unify completeness + content validation + review propagation across TPS/EAD/Re-Parole; stop the
faked OCR provenance; EAD gets the same gate as TPS.

**U-STAGE 5 — ONE TRANSLATION PDF RENDERER**: collapse the two renderers into one
(deterministic + leak-gated + one cert text); fix the TPS-embedded `new Date()` determinism break.

**U-STAGE 6 — DICTIONARY DATA UPDATES** (so all AIs can actually resolve every field):
village gazetteer tier, raion list, doc-number formats, given-name list, death/name-change
labels, EAD/I-94/I-797 vocab (categories, class-of-admission). [synthesis R9/R11]

**Every stage:** RULE #1 (read the existing report first), flag-gated default OFF, prove
flag-OFF parity, measure on the real-doc harness, no prod flip without owner.

---

## PART C — ORDER + THE ONE DECISION
1. U-STAGE 1 (one dictionary) — start now; clearly correct, owner-emphasized, mostly mechanical.
2. U-STAGE 2 (shared rules brain) — teach all AIs from one source.
3. **DECISION:** U-STAGE 3 (Gemini-for-all vs contain-DeepSeek) — needs a measured comparison + owner go/no-go.
4. U-STAGE 4 (one gating), U-STAGE 5 (one PDF), U-STAGE 6 (dict data) — in parallel where safe.
