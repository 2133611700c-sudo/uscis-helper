# CHANGELOG.md — Permanent Project History
Every work session appends here. Never delete entries. Newest first.

---

## 2026-05-23 | Knowledge Engine + Pipeline Wiring + Continuity System

**Author:** Claude session (I-765 audit → knowledge engine → pipeline wiring)

**Summary:** Built canonical normalization package, fixed transliteration bugs, wired internal passport extraction for place of birth, added USCIS account extraction from I-797, created project continuity system (STATUS/HANDOFF/SOURCE_OF_TRUTH/ADRs).

**New files:**
- `packages/knowledge/` — full package: dictionary.ts, normalize.ts, transliterate.ts, 3 test files
- `apps/web/src/lib/tps/modules/visionBridge.ts` — OCR→Knowledge→TPSAnswers bridge
- `prompts/universal-document-extraction.md` — 10 document types vision prompt
- `STATUS.md`, `HANDOFF.md`, `SOURCE_OF_TRUTH.md` — continuity system
- `CLAUDE.md`, `AGENTS.md` — agent auto-load rules
- `docs/adr/ADR-001` through `ADR-004` — architecture decisions
- `CHANGELOG.md` — this file

**Changed files:**
- `apps/web/src/lib/tps/transliterate.ts` — +ЗГ→Zgh, +ALL-CAPS detection
- `apps/web/src/lib/tps/modules/passportBooklet.ts` — +city_of_birth, +province_of_birth extraction
- `apps/web/src/lib/tps/modules/i797.ts` — +uscis_online_account extraction
- `apps/web/src/app/[locale]/services/tps-ukraine/start/TPSWizardV2.tsx` — +province_of_birth merge/UI/labels(4 langs), +uscis_online_account, +eye_color, +hair_color wiring
- `apps/web/package.json` — +@uscis-helper/knowledge workspace dep

**Test evidence:**
- Knowledge: 74 tests pass (35 transliterate + 26 normalize + 13 e2e)
- Web app: 1932 tests pass, 51 files
- TypeScript: 0 errors
- E2E proof: "Вінницької області" → "Vinnytsia Oblast" auto-converted

**Key decisions (ADRs):**
- ADR-002: packages/knowledge is canonical dictionary, supersedes all ad-hoc glossaries
- ADR-003: extend existing pipeline, do not rebuild
- ADR-004: historical authorities preserved, not modernized

**Manual input reduced:** ~15 fields → 4 (phone, email, marital_status, SSN)

**Next task:** Wire visionBridge.ts into live OCR route, verify E2E on production.

---

## 2026-05-23 (session 2) | Export Gate + Bypass Audit + Continuity System

**Author:** Claude session (continued from session 1)

**Summary:** Added mail-ready export gate, audited old bypass paths in translation module, created full continuity system (CLAUDE.md, AGENTS.md, STATUS, HANDOFF, SOURCE_OF_TRUTH, 4 ADRs, PROJECT_HISTORY, CHANGELOG).

**New files:**
- `apps/web/src/lib/tps/mailReadyGate.ts` — export gate (blocks on empty fields, conflicts, low confidence)
- `CLAUDE.md` — agent auto-load rules (startup + shutdown protocol)
- `AGENTS.md` — Codex CLI auto-load rules
- `STATUS.md` — current operational truth
- `HANDOFF.md` — session handoff
- `SOURCE_OF_TRUTH.md` — canonical module map + deprecated paths
- `CHANGELOG.md` — permanent history
- `PROJECT_HISTORY.md` — full Messenginfo timeline (1588 commits, Oct 2025 → May 2026)
- `docs/adr/ADR-001` through `ADR-004`

**Audit findings:**
- 5 old bypass paths in translation/glossary/ that use parallel normalization
- Old test expects "Militia Department" (violates ADR-004)
- Translation module NOT yet migrated to @uscis-helper/knowledge

**Test evidence:**
- TypeScript: 0 errors
- Knowledge: 74 pass
- Web: 1932 pass
- Total: 2006 pass, 0 failures

**Next task:** Migrate translation/glossary/ to use @uscis-helper/knowledge. Fix "Militia Department" → "Militsiya" in tests. Wire mailReadyGate into GeneratePacketBlock.

---

## 2026-05-23 (session 3) | Militia Fix + Export Gate Wired + Bypass Audit

**Changed files:**
- `apps/web/src/lib/translation/glossary/ukraine_agency_abbreviations.json` — "Militia Department" → "Militsiya Department" (ADR-004)
- `apps/web/src/lib/translation/__tests__/glossary.test.ts` — test updated to expect "Militsiya Department"
- `apps/web/src/lib/tps/mailReadyGate.ts` — NEW: export gate (required fields, conflicts, OCR confidence, phone/email validation)
- `apps/web/src/app/[locale]/.../GeneratePacketBlock.tsx` — mailReadyGate wired before API call
- `SOURCE_OF_TRUTH.md` — 5 bypass paths documented with migration notes

**Evidence:** 0 type errors, 1932 tests pass, 74 knowledge tests pass

**Next:** Migrate remaining 4 bypass paths (agencyGlossary.ts, civil_registry_terms.json, nominativeCaseRestorer.ts) to @uscis-helper/knowledge. Production E2E with internal passport.

---

## 2026-05-23 (session 4) | Translation→Knowledge Bridge + Bypass Elimination

**Summary:** Connected translation glossary to canonical @uscis-helper/knowledge. Eliminated duplicate transliteration table. Old paths now delegate to canonical engine.

**Changed files:**
- `apps/web/src/lib/translation/glossary/agencyGlossary.ts` — imports normalizeAuthority from knowledge; unknown abbreviations fall through to canonical dictionary pattern matching instead of returning null
- `apps/web/src/lib/translation/glossary/nominativeCaseRestorer.ts` — removed duplicate UK_TO_LATIN table (60 lines). transliterateKMU2010() now delegates to transliterateKMU55 from knowledge. Unique restoreNominative() logic preserved.

**Bypass status:**
- agencyGlossary → BRIDGED (delegates to knowledge for unknowns)
- nominativeCaseRestorer → BRIDGED (uses canonical transliteration)
- ukraine_agency_abbreviations.json → FIXED (Militia→Militsiya in session 3)
- civil_registry_terms.json → DOCUMENTED for next migration
- Old glossary.test.ts → FIXED (expects Militsiya in session 3)

**Evidence:** 0 type errors, 1932 tests pass

**What this means for the robot:** Translation and TPS forms now share the same transliteration engine (KMU-55 with ЗГ→Zgh, ALL-CAPS). Unknown authority patterns fall through to the same dictionary. No more divergence between form output and translation output for transliterated names and authority names.

---

## 2026-05-23 (session 5 — FINAL) | OCR Route Normalization + V2 Wizard Gate + Full Pipeline

**Summary:** Wired postExtractNormalize into live OCR route. Added knowledge_conflicts + knowledge_low_confidence to API response. V2 wizard now collects conflict/confidence from ALL uploads and passes to mailReadyGate with real data. No more dead code in the gate — conflicts and low confidence are real runtime values.

**Changed files:**
- `apps/web/src/lib/tps/ocr/postExtractNormalize.ts` — NEW: post-extraction normalization (oblast genitive→nominative)
- `apps/web/src/app/api/tps/ocr/extract/route.ts` — WIRED postExtractNormalize + knowledge metadata in response
- `apps/web/src/app/[locale]/.../TPSWizardV2.tsx` — stores knowledge_conflicts/low_confidence per upload; collects from ALL uploads; runs mailReadyGate with real data before generate
- `apps/web/src/app/[locale]/.../GeneratePacketBlock.tsx` — added knowledgeConflicts/knowledgeLowConfidence props; passes to mailReadyGate
- `docs/adr/ADR-005-transliteration-boundaries.md` — NEW: Ukrainian→knowledge, Russian GOST→stays local

**Evidence:** 0 type errors, 1940 web tests + 74 knowledge tests = 2014 total, 0 failures

**Pipeline now fully wired:**
OCR → postExtractNormalize → response with metadata → wizard stores → merge normalizes → gate checks with real data → blocks or generates

**Remaining:** Production E2E (deploy + real upload), civil_registry_terms migration, city_of_birth Latin normalization

---

## 2026-05-23 (session 6) | I-94 place_of_entry + Production E2E + ADR-006

**Summary:**
- Added place_of_last_entry extraction to I-94 module (last document-field gap closed)
- Production E2E proof: wizard functional, province="Vinnytsia Oblast", Patronymic label correct, package generates
- Critical table correction: 5 fields marked "not extracted" were already working
- ADR-006: one upload → two products (forms + translation in same package)

**Changed files:**
- `apps/web/src/lib/tps/modules/i94.ts` — +place_of_last_entry extraction (Port of Entry)
- `docs/adr/ADR-006-one-upload-two-products.md` — NEW: architecture decision

**Deployed:** SHA 57f5a22

**Production evidence:**
- Wizard 6 steps functional
- Province = "Vinnytsia Oblast" (DMS-verified, not raw Cyrillic)
- "Отчество / Patronymic" label (not "Middle Name")
- Package generates: I-821 + I-765 + checklist + instructions
- Hand signature warning present

**Next:** Connect generateTranslationHTML to TPS packet builder. Same upload → forms + translation in one ZIP.
