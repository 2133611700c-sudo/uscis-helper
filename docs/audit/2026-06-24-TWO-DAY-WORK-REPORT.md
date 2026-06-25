# TWO-DAY WORK REPORT (2026-06-22 → 06-24) — everything we did, every prompt, results, and gaps

Single consolidated log of two days. 78 commits. Honest, evidence-linked. PII-free.
**THE ONE FOCUS (owner, 2026-06-24): handwritten UA/RU document recognition. Printed = solved, out of scope.**

---

## 1. ALL OWNER PROMPTS (chronological intent)

### Day 1 (2026-06-22 → 06-23, from session summary)
1. NO real PII — system/agents must store only FICTIONAL data; real data only in gitignored qa-private ("иначе все тесты фейк").
2. Full model inventory + corrected rules + "which model reads handwriting without errors?".
3. Test all ChatGPT versions / consider switching vendor for Cyrillic.
4. Investigate why apps recognize but our API doesn't (Gemini/OpenAI/Claude app vs API).
5. Evidence-first discipline: stop conflating OCR vs transport vs scoring; fix the benchmark first; channel-aware scorer; don't over-claim.
6. Verify all rules updated + all models (Gemini/GPT/DeepSeek) actually know them.
7. Handwriting trap tests on the birth cert across all models ("не верь ранним тестам, включи всех агентов").
8. Build our own Cyrillic/handwriting recognizer ("без иллюзий, только суть, без вранья").
9. "Найди в интернете кто читает кириллицу и древние рукописи… найди движки… скопировать всё что можем легально!".

### Day 2 (2026-06-24, this session)
10. (External HTR research report pasted + owner critique) "прочти и как независимый эксперт проанализируй".
11. "делай всё полностью, не оставляй на выбор, всё пробуй, потом обучи ИИ агентов, потом тест как в первый раз".
12. "ищи всегда КОРЕНЬ проблемы, не поверхностно; все корни; потом тест; запомни и работай ВСЕГДА с агентами".
13. "топ твой метод! всё сравнивай с собой в корне, по шагу исправляй под свои стандарты, тести шаг за шагом".
14. "помни всё, главное это кириллица УКР и РУС".
15. "ты всё делаешь сам, по нашему плану через себя прогоняешь, настраиваешь проект как у тебя при правильном результате; тесты после каждого".
16. "ты имеешь все оригиналы моих документов, используй! проверь на двух агентах Gemini и GPT; сначала обучи все 3 агента, потом тест на всех трёх; план и погнали".
17. "критически протести всё снова на свидетельстве И паспорте; не верю твоим тестам; делай заново честно".
18. "всё фейк, нет стабильных отчётов, всё по-разному; откуда ты взял Gemini-3.1-pro? это нестабильная preview!".
19. "проверь все правила и инструкции — как обновлено и работает — и словари; максимально критично".
20. "начни как инженер проверять и работать над всеми пунктами; собери план; прочти аудиты; работай сразу со всеми агентами".
21. "коротко что сам думаешь об этом результате?".
22. "продумай ещё раз; не объявляй победу по всей рукописи; held-out разные UA рукописи; я не верю, нет закономерности".
23. "зачем работаешь с печатными? проблема в рукописях! фокус только 1".
24. "подними всю работу за 2 дня в 1 отчёт; список задач; все мои промты; всё что делал; правила, словари, результаты; и всё что НЕ сделал". ← THIS.

---

## 2. TASK LIST — everything done (by theme, with commit anchors)

### A. Recognition pipeline / OCR (Day 1)
- R0–R8 recognition program: place-fix root causes; live image preprocessing + upscale small scans (b660be8, 1a80de4); auto-delivery backbone behind default-OFF flags (32fe26f).
- Fix #1: critical unread fields no longer vanish — dob surfaces (a8e0fb9).
- Date-region read revived (was silently dead): box detect + Gemini crop + parse (d7a2351).
- Orientation-first content-based upright detector + K-vote stabilization (f1f2a72, c217e01).
- STAGE 4 hi-res tile recovery of empty fields, wired into all 4 OCR routes + K-sample majority voting (2e80bbe, cec98ef, 348fb4e).
- Cross-document reconciliation engine (read one doc's field from a sibling doc), flag-gated, wired TPS/EAD/Re-Parole + client one-click (fd9679a, ad10e8b…f194fcd).
- Free-first cost ordering: fill empty fields from free sibling values before paid tile recovery (5efbcad, e2cbdfe); early-exit voting to minimize Gemini calls (8322440).

### B. One-brain / Constitution / rules architecture (Day 1)
- Per-document reading rules for ALL 12 doc classes + completeness guard (3e72ea3, aa4664f).
- Codex foundation: CONSTITUTION + one-dictionary guard + unified TPS transliterator (f7d02dd); one-brain VERIFIED, rules DEFAULT ON for all 4 products (0916262).
- DeepSeek prose translator (D3) safe-by-design + adversarially tested + ADR-019/024 (a63a7f3, e4d1cab).
- RULES_MASTER_INDEX (the audit menu) + CLAUDE.md points agents to it first (3899956, 4080f80).
- Teach Gemini handwriting best-effort read; teach DeepSeek shared codex rules (L9, flag-gated) (82a050d, ed3d6e7).

### C. Dictionaries / codex (Day 1 + Day 2)
- KMU_RU_FALLBACK re-added (RU names leaked Ё/Э/Ы) + permanent no-Cyrillic-leak guard 26 cases (82bf771, c448677).
- КАТОТТГ village + raion tiers (0.36MB) → places validated (2b8a6d2); KMU-55 normative apostrophe audit (6e4ade4).
- Full Russian-language support: RU→EN glossary + places + separate Russian rule (136315e, fc156fe).
- Reference validation + Gemini↔DeepSeek sync + registry (continuous teaching) (b3f5652).
- Sex-from-patronymic deterministic/FREE — closes sex=MISS (5186334).
- Doc-level RU script routing (ambiguous name on RU doc → Russian table), flag-gated (d5ea620).

### D. PII + stability (Day 1→2)
- PII fictionalization of every committed identity value + hash guard + corrected model inventory (8abd9b9).
- Multi-run stability audit harness + honest real-doc stability report (c5f6a5d, bda104c).

### E. Evidence + HTR investigation (Day 2) — THE handwriting focus
- Evidence-first ablation harness (stage-isolated) — proves the API SEES printed Cyrillic; the loss was scorer/transport, not OCR (bfb28d4, c0e01a0).
- Channel-aware re-scorer + failure taxonomy — first trustworthy OCR number (e1ccd87).
- Handwriting trap benchmark — consensus does NOT save handwriting (WRONG-STABLE) (e786e10).
- HTR legal-reuse landscape research (157efe4); zero-shot POC of key-free Cyrillic models (b694d07); 4-candidate bake-off + stamp test (138eaf9).
- **ROOT-CAUSE REVERSAL** — handwritten UA/RU IS readable key-free (raxtemur) given native-res crop + contrast; prior "no model reads handwriting" was OUR low-res-crop + scorer-channel bug (b71130d); ADR-026.
- Project aligned to the recipe: tileRegionRead native-res+contrast, client downscale 2400→3072, preprocess contrast-stretch, deprecate alphabet-agnostic scorer (061e3cb, bee3a58, 8d7f55c, b5d6c23).
- Tri-agent benchmark on real docs (raxtemur vs Gemini vs GPT) (0a6b55f); honest critical re-test corrects 2 over-claims (52e766e); FROZEN stable benchmark 5-runs, no preview (9385601).

### F. Critical rules+dict audit + engineering of all open points (Day 2)
- 3-agent critical audit + propagate ADR-026 to the law layer (17f5831).
- Hardened docReadingRulesSync (token coverage + verbatim presence; catches mid-rule + whole-rule loss) (e6352ae, 9ee65ff).
- Guarantee no-Cyrillic-leak across full U+0400–U+04FF (sanitizeCyrillicLeak) + golden vectors wired into CI (9009453).
- normalizeName routes clearly-RU names → Russian table (4491a91).
- ADR-026 PENDING banner in modelMatrix (abdd2bf).

---

## 3. RESULTS — what actually worked, measured (PII-free)

### Handwriting (the focus) — HONEST
- **raxtemur/trocr-base-ru reads a NARROW CLUSTER:** birth_cert_handwritten_01 (surname+given CER 0.000 exact, patronymic 0.333) and birth_cert_soviet_01 (given+patronymic exact, surname 0.2) — BOTH high-res Soviet/RU-script cursive. **Stable across 5 runs (deterministic).**
- **Tri-agent frozen (handwriting):** raxtemur > gpt-4.1 / gemini-3.1-pro > gemini-2.5-pro (fabricates) > gpt-5.5 (worst). raxtemur best on cursive, key-free, $0, no PII egress.
- **HELD-OUT = NEGATIVE:** the first genuinely DIFFERENT handwritten doc (marriage_1939, bilingual, different writer/era, lower-res) FAILED. ⇒ **NO PROVEN REGULARITY — two similar points are a cluster, not a pattern.**
- raxtemur CANNOT abstain (fabricates on a blank crop) → non-exact reads need a gate + human review.

### Rules / dictionaries — measured green
- knowledge codex: 18/18 test files green (incl. golden 79, full-block Cyrillic-leak sweep 530); tsc 0.
- web suite: 4664 pass / 24 skip / 0 fail; tsc 0; PII guard 0/1808.
- Sync guard now genuinely enforces "one source → both models" (token + verbatim); no-Cyrillic-leak now guaranteed across U+0400–U+04FF; RU names route to the Russian table.

---

## 4. WHAT WAS NOT DONE (open, honest)

### Handwriting (the real problem — UNSOLVED)
- ❌ **No proven regularity on handwriting.** Only a 2-doc high-res Soviet-RU cluster works; held-out diverse doc failed.
- ❌ **Zero scored Ukrainian-handwriting results** — UA handwritten docs lack ground truth (OWNER_FILL_REQUIRED) or are printed/low-res. **NEEDS OWNER GT.**
- ❌ **Automatic per-field localization** — every doc needed hand-found crop boxes; several mis-located. Unbuilt.
- ❌ **raxtemur sidecar host** — it is Python/torch, cannot run on Vercel; no production reader exists. Lives only in gitignored qa-private. **NEEDS HOSTING DECISION.**
- ❌ **Fine-tuning on labeled real handwriting** — would need ~30–50 labeled pages of our doc family; synthetic-font fine-tune was tried and ABANDONED (anti-transfer).
- ⏸ Re-test LLM APIs on native-res HANDWRITTEN crops at larger N (only N=2 done).

### Rules / product
- ⏸ Flip `RU_TRANSLIT_ENABLED` in prod (Russification-amplification risk for ambiguous names) — product decision.
- ⏸ ADR-026 route-by-rendering NOT wired into code (modelMatrix is LLM-only; banner flags it).
- ⏸ Cyrillic Extended-B (U+A640+) outside the leak-sanitizer scope (latent, not on UA/RU docs).
- ⏸ DeepSeek shared-rules + several auto-delivery/consensus levers remain default-OFF pending live re-measure.

---

## 5. HONEST BOTTOM LINE
Two days produced a solid recognition/rules/dictionary foundation (green, guarded, PII-clean) and one genuine
discovery: the "no model reads handwriting" belief was OUR pipeline artifact, and key-free raxtemur reads a
narrow cluster of high-res Soviet-RU cursive. **But the actual product problem — reliably reading DIVERSE
handwritten UA/RU documents — is NOT solved and NOT proven.** The honest next step is not more building: it is a
GROUND-TRUTHED, diverse, HANDWRITING-ONLY held-out set (owner data) to measure whether ANY approach has
regularity — and only then invest in a sidecar or fine-tuning. Everything printed is out of scope.
