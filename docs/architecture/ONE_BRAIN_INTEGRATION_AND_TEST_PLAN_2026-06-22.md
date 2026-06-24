# ONE BRAIN — Integration & Test Plan (2026-06-22)

Owner ask: implement + integrate everything into ONE working brain, run it, then test
(Claude → DeepSeek → Gemini), compare, teach all three, and derive per-point rules. No
inventing, no lying — root causes only. Owner will run a hard audit afterward.

RULE #1 honored: this plan is built on the EXISTING docs (CONSTITUTION L1–L10, ONE_BRAIN_
UNIFICATION_PLAN U1–U6, RECOGNITION_MASTER_PLAN STAGE 1–7, ORG_CHART, ADR-018/024) and on a
fresh CODE trace — it does not re-invent them.

---

## 0. HONEST CURRENT STATE (code-verified 2026-06-22, not from stale docs)

The "3 separate products" are ALREADY converged onto ONE reader. Verified by tracing each route:

| Product | Real reader today | Evidence |
|---|---|---|
| Translator | `readDocument` (Gemini one brain), always | vision-extract/route.ts:350 |
| EAD | `readDocument`, always | ead/ocr/extract/route.ts:165 |
| Re-Parole | `readDocument`, always (+ Google Vision for MRZ) | reparole/ocr/extract/route.ts:182 |
| TPS | `readDocument` for UA-identity docs; legacy rule-modules + optional DeepSeek text-filler for US forms (i94/ead/dl/i797) | tps/ocr/extract/route.ts:297, 896 |

- DeepSeek (`runBrain`) is NEVER an image reader — it takes Vision-OCR TEXT only, optional, TPS only (documentBrain.ts:31). So **L3 already holds**.
- The shared dictionary (KMU-55 + RU + apostrophe fix + gazetteer + patronymic + countries) is ONE package, consumed by the one brain. **L2 already holds.**
- Per-document reading rules feed the Gemini prompt (DOC_READING_RULES default ON). **L9 holds for Gemini**; DeepSeek-side is wired but OFF.
- C3 critical-null is UNCONDITIONAL on translation. **L5/L6 hold there.**

**Conclusion:** integration is NOT a rebuild. It is closing 4 named seams + flipping measured
flags. Anything claiming "all separate, big rebuild" would be false.

---

## 1. THE 4 REMAINING SEAMS (the actual integration work)

### SEAM A — Cross-document reconciliation NOT wired (the biggest quality lever)
- Built + 14 tests: `apps/web/src/lib/canonical/core/crossDocReconcile.ts` (`reconcileAcrossDocuments`).
- NOT called in any route (tests only). Integration points already identified: TPS packetBuilder.ts:185 / translation order assembly.
- Proven need (today's fresh read): the handwritten military DOB day "_5" is ambiguous (15/25) alone; the passport MRZ `9001158` + record `19900115` make it 25. Reconciliation is what carries that authority across a person's documents.
- Does NOT need Gemini quota — pure logic over already-read fields. **Can do now, behind its OFF flag.**

### SEAM B — TPS US-form slots bypass the one brain
- i94/ead/dl/i797 have no docintelId mapping (tps/ocr/extract/route.ts:293) → skip readDocument → legacy rules + DeepSeek.
- BUT `docReadingRules` already has `us_ead`, `us_i94`, `us_i797` rule blocks. So these CAN route through readDocument like EAD already does.
- Mechanical: extend `mapTpsHintToDocintelId` + the Core branch. Keep legacy as fallback. **Can do now; no quota for the wiring; measure later.**

### SEAM C — DeepSeek shared rules wired but OFF
- `buildSystemPrompt` (documentBrain.ts:990) appends `textRulesForDeepSeek` only when DEEPSEEK_SHARED_RULES_ENABLED=1 (OFF).
- Live proof today: on text, DeepSeek V3 is already correct WITH and WITHOUT the rules → parity/no-regression, no measurable lift. So this flag is SAFE to turn on (insurance), but is not a quality win on its own.

### SEAM D — Quality flags OFF, unmeasured
- AUTO_ORIENT_ENABLED (content rotation — the sideways-doc fix), SELF_CONSISTENCY_VOTE_ENABLED, DICTIONARY_AUTOCORRECT_ENABLED, DICTIONARY_CLEARS_SOFT_REVIEW (auto-delivery enabler), DOC_SCRIPT_ROUTING_ENABLED (RU names), RU_TRANSLIT_ENABLED.
- All built + tested + OFF. Flipping them is gated on a LIVE real-doc re-measure, which is **BLOCKED by the Gemini 429 monthly spend cap** (ai.studio/spend). This is the one true external blocker.

---

## 2. INTEGRATION PLAN — ordered, with what is autonomous vs gated

### PHASE 1 — Wire the one brain end-to-end (autonomous, NO Gemini quota needed)
1. **Wire SEAM A** — call `reconcileAcrossDocuments` at the packet/order assembly point, behind CROSS_DOC_RECONCILE_ENABLED (already OFF). Prove byte-identical when OFF. Add an integration test that the passport MRZ disambiguates a sibling doc's ambiguous DOB. (L10 safe-change.)
2. **Wire SEAM B** — extend `mapTpsHintToDocintelId` for us_ead/us_i94/us_i797 so TPS US forms read through readDocument (matching EAD), legacy as fallback. Behind a flag if behavior changes; prove parity OFF.
3. **Add the unified field-decision trace** (ORG_CHART D-decideField) only if needed for the audit — defer unless it blocks A/B.

### PHASE 2 — One test harness across the 3 models (autonomous build; Gemini run gated)
Build/confirm a single harness that, per real document + per field, records: Claude(me) read, DeepSeek(text) read, Gemini(pipeline) read, GT, verdict (EXACT/WRONG/EMPTY/FABRICATED/REVIEW). This is the apparatus for "test by me, then DeepSeek, then Gemini, compare". The Claude + DeepSeek legs run now; the Gemini leg records BLOCKED_429 honestly until quota is raised.

### PHASE 3 — Measure + flip (OWNER + QUOTA gated)
Only after the harness shows per-field accuracy on the primary model: flip SEAM D flags per-field-class, never globally, per L10. Requires Gemini quota restored.

### PHASE 4 — Teach + derive per-point rules (continuous)
For every field where a model misses, write the per-document rule (the L9 teaching artifact) and re-measure. Output a per-point rulebook (below).

---

## 3. TEST PROTOCOL (Claude → DeepSeek → Gemini → compare → teach)

Per the owner's sequence, for EACH real document in test-fixtures/real-docs + its VERIFIED_BY_OWNER GT:

1. **Claude (me) reads the image** applying ALL rules (RUSSIAN_SCRIPT, MONTH_WORD, controlling-Latin, source-faithful, cross-doc anchor). Record field-by-field. (Done today for passport/military/birth — DOB 25 June 1986 confirmed across 3 docs; SERGII controlling; СОЛОВ'ЯК→SOLOVIAK.)
2. **DeepSeek reads the Vision-OCR text** with shared rules ON. Record. (Live-proven: keeps Russian, parses spelled date.)
3. **Gemini pipeline reads the image** via readDocument. Record. (BLOCKED_429 now — not faked.)
4. **Compare** all three vs GT → verdict table per field.
5. **Teach** the loser via the per-document rule; re-run.
6. **Derive the per-point rule** (section 4) for that field/document.

Honesty gates: a flash-model read is NEVER an acceptance number (ADR-018). EMPTY/REVIEW/null is never "success". 429 is reported BLOCKED, never substituted.

---

## 4. PER-POINT RULEBOOK (who does what, by point) — the audit menu

| # | Point | Who | Rule (one line) | State |
|---|---|---|---|---|
| 1 | Read the image | Gemini gemini-3.1-pro-preview ONLY | L1: single reader, all products; flash = fallback→forced review, never acceptance | ON |
| 2 | Cyrillic transcription | Gemini | L8: source-faithful — RU stays RU, UA stays UA; keep ы/э/ё/ъ; never convert | ON (rule in prompt) |
| 3 | Spelled-out date | Gemini | MONTH_WORD: read whole word; червня/июня=June≠липня/июля=July; anchor year→day→month | ON |
| 4 | Controlling Latin | Gemini | L7: printed/MRZ Latin returned exactly (SERGII ≠ ANDRII) | ON (rule) — but verify pipeline doesn't re-transliterate |
| 5 | Transliteration | packages/knowledge | L2: KMU-55 (UA) / BGN-PCGN (RU) from raw Cyrillic; apostrophe family dropped (U+2019 fix) | ON |
| 6 | RU name routing | transliterationPolicy | ambiguous RU name on RU doc → RU table (Andrey≠Serhei) | OFF (DOC_SCRIPT_ROUTING) |
| 7 | Critical-field safety | C3 applyOcrFieldSafety | L5/L6: uncertain critical → null + review, never a guess; single final_value writer | ON (unconditional, translation) |
| 8 | Handwritten date anchor | strongSourceAnchor | L6: handwritten date never self-anchors; needs MRZ/dictionary external check | ON |
| 9 | Cross-document authority | crossDocReconcile | STAGE 3: MRZ-validated passport resolves a sibling doc's ambiguous field | BUILT, NOT WIRED (Seam A) |
| 10 | Orientation | preprocess + autoOrient | EXIF rotate (ON) fixes metadata only; content rotation needs autoOrient | autoOrient OFF (Seam D) |
| 11 | DeepSeek role | documentBrain | L3: text/prose only, never identity; final_value overwritten from source | ON (boundary guard) |
| 12 | Teaching source | docReadingRules | L9: one rule set per doc/field feeds Gemini AND DeepSeek; no divergent inline rules | Gemini ON, DeepSeek OFF (Seam C) |
| 13 | Safe change | every flag | L10: default OFF, byte-identical when OFF, measured before flip, owner-gated | ENFORCED |

---

## 5. THE ONE TRUE EXTERNAL BLOCKER

Live measurement of the primary reader (Gemini) — the prerequisite for flipping any Seam-D
quality flag — is BLOCKED by the **Gemini 429 monthly spend cap** (AI Studio project spend
limit, ai.studio/spend). Until the owner raises it, PHASE 3 cannot produce real numbers; the
Claude + DeepSeek legs of the test protocol can still run. No code change unblocks this.

---

## 6. WHAT I WILL DO AUTONOMOUSLY NEXT (no quota, safe, L10)
- Wire Seam A (cross-doc reconcile) behind its OFF flag + integration test (passport anchors sibling DOB).
- Wire Seam B (TPS US forms through readDocument) with legacy fallback + parity test.
- Build the 3-model comparison harness (Claude/DeepSeek legs live; Gemini leg records BLOCKED).
- Keep all behavior-changing flags OFF; prove byte-identical-when-OFF; full suite + tsc green.
- NOT touch prod Supabase/Vercel/Stripe; NOT flip prod flags; NOT republish canon history.

Owner decisions reserved: raise Gemini quota (unblocks PHASE 3); go/no-go on each Seam-D flip
after measurement; go/no-go on DICTIONARY_CLEARS_SOFT_REVIEW (the auto-delivery legal line).
