# CHANGELOG.md — Permanent Project History
Every work session appends here. Never delete entries. Newest first.

---

## 2026-05-24 — Session 14: Production Audit + BUG-1/BUG-2 Hotfix

### Audit (Claude Opus — independent browser + code audit)
- Full production audit: desktop + mobile (390px) + code review
- Confirmed: mobile and desktop show IDENTICAL upload slots (no viewport hiding)
- Confirmed: booklet upload slot present on mobile for all paths
- Confirmed: owner mode = paywall bypass only, no wizard drift
- Confirmed: field maps I-821 + I-765 are complete for all required fields
- Found: `noindex, nofollow` on all pages — zero Google visibility (decision pending)

### BUG-1 FIX (P0): rereg+noEAD missing upload slots
- **Root cause**: passport + I-94 slots were inside `if (ead)` guard in TPSWizardV2.tsx
- **Impact**: rereg+noEAD users saw only 3 slots (tps_notice, booklet, dl) — no passport, no I-94
- **Fix**: moved passport + I-94 outside `if (ead)`, only ead_old stays conditional
- **Result**: rereg+noEAD now has 5 slots (tps_notice, booklet, passport, i94, dl)

### BUG-2 FIX (P0): last_entry_date hidden from rereg review
- **Root cause**: ReviewOcr showed I-94 fields only for `if (init)`, but mailReadyGate requires last_entry_date unconditionally
- **Impact**: rereg users without I-94 upload were blocked with no way to see or edit last_entry_date
- **Fix**: I-94 review rows (i94_admission_number, last_entry_date, status_at_last_entry) now show for ALL paths
- **Bonus**: added a_number review row for rereg+noEAD (sourced from TPS notice)

### TypeScript: 0 errors after fixes

### Cosmetic fix: passport hint text
- passportRereg hint said "for identity verification when requesting EAD"
- Now says "For identity verification. May be expired." (all 4 langs)
- noindex/nofollow: confirmed INTENTIONAL and CORRECT (wizard pages only)

### FIX-3: passport_expiration_date manual fallback (P2)
- Added FieldInput in ReviewManual for passport expiration date (4 langs)
- Added `passport_expiration_date` to WizardData.manual interface
- Fixed buildDraftAnswers: now checks `data.manual.passport_expiration_date` before mergedFields
- Previously: if MRZ OCR failed, no way to enter this field → gate blocker
- I-912 fee waiver: confirmed as feature gap (needs income/household module), not a hotfix

## Audit — 2026-05-24 | Full TPS Production Audit Report
SHA: docs-only commit
File: docs/audit/TPS_PRODUCTION_AUDIT_20260524.md

### Findings
- CRITICAL: REREG+NOEAD = dead path (7 required fields blocked, no passport/I-94 slots)
- Only INIT+EAD+PAPER is E2E proven
- Mobile: UNVERIFIED (cannot test via automation tools)
- Owner vs Client: no drift except expected payment/translation difference
- 9 bugs ranked by severity with fix order

---

## Session 13 — 2026-05-24 | Step 5 Gate/Data Path Fix + E2E Closure
SHA range: 6f73aa3 → cc319ce
Production: cc319ce (verified healthz)

### Changed
- `TPSWizardV2.tsx`:
  - added explicit Step 5 manual inputs for `US Address (City/State/ZIP)`,
  - added stable test ids:
    - `tps-review-manual-address-street`
    - `tps-review-manual-address-city`
    - `tps-review-manual-address-state`
    - `tps-review-manual-address-zip`
    - `tps-review-manual-phone`
    - `tps-review-manual-email`
  - added Step 5 gate error selector token (`tps-gate-error-container`) for deterministic diagnostics.

### Validation
- PASS: `pnpm --filter web run typecheck`
- PASS: `pnpm --filter web test -- src/lib/tps/__tests__/wizardV2RuntimeLock.test.ts`
- PASS: `pnpm --filter web run lint`
- PASS (production dual proof after deploy):
  - selector contract present,
  - OCR slots all 200,
  - client unpaid paywall visible,
  - paid callback path -> `generate-packet=200`,
  - ZIP downloaded + PDF visual pages exported.

---

## Session 12 — 2026-05-24 | Runtime Dual-Proof + Selector Contract Sync
SHA: f3a3a05
Production: deployed

### Added
- `scripts/t3ps-runtime-dual-proof.mjs`:
  - probes selector contract in live production,
  - captures slot-level OCR statuses + errors,
  - validates unpaid/paywall behavior,
  - tests paid callback generate path,
  - records owner-session availability and blocking reason,
  - exports network/console/failed-request evidence.

### Changed
- `TPSWizardV2.tsx`:
  - Step 5 gate error now has `data-testid="tps-gate-error-container"`.
- Browser scripts synced to V2 selectors:
  - `scripts/t3ps-functional-closeout-browser.mjs`
  - `scripts/t3ps-production-contour-clean.mjs`
  - `scripts/t3ps-final-browser-audit.mjs`
- Added runtime lock tests:
  - `apps/web/src/lib/tps/__tests__/wizardV2RuntimeLock.test.ts`

### Verification
- PASS: `pnpm --filter web test -- src/lib/tps/__tests__/wizardV2RuntimeLock.test.ts`
- Dual proof result:
  - selector contract visible on live step 4,
  - OCR slot statuses 200 with improved fixtures,
  - owner mode blocked without owner session,
  - client contour still not reaching generate in current run.

---

## Session 11 — 2026-05-24 | TPS Runtime Drift + False Readiness Hardening
SHA range: 9449fe6 → 201ce5d
Production: deployed

### Done
- Hardened `apps/web/src/app/[locale]/services/tps-ukraine/start/TPSWizardV2.tsx`.
- Added stable selector contract for automation/runtime:
  - `tps-ocr-cta`
  - `tps-upload-slot-*`, `tps-upload-input-*`
  - `tps-review-step-container`
  - `tps-generate-cta`
  - `tps-gate-error-container`
  - `tps-signature-mode-block`
  - `tps-paywall-state`
  - `tps-package-ready-state`
  - `tps-download-success-state`
- Added preflight gate on Step 5 before Step 6:
  - blocks transition when no extracted fields,
  - applies `runMailReadyGate` blockers before pay/download screen.
- Added truth marker after real packet generation:
  - `generatedManifest` stores timestamp + ZIP bytes.
- Added OCR diagnostics in upload state:
  - `ocr_http_status`
  - `ocr_error`
- Added deterministic Step 6 eligibility (`isStep6Eligible`) computed from
  extracted fields + `runMailReadyGate` result so `?paid=1` callback does not
  depend on volatile in-memory preflight flags.

### Verification
- PASS: `pnpm --filter web run typecheck`
- PASS: `pnpm --filter web test`
- PASS: `pnpm --filter web run lint`
- PASS: `pnpm --filter web run guard`
- PASS: `pnpm --filter web run build`

### Notes
- Production rerun still pending deploy of this commit.

---

## Session 10 — 2026-05-24 | Session Docs Guard Enforcement
SHA: f94f942
Production: unchanged runtime code (docs/guard infra only)

### Done
- Added `scripts/guards/require-session-docs.sh` to enforce:
  - `STATUS.md`
  - `HANDOFF.md`
  - `CHANGELOG.md`
- Added `.githooks/pre-commit` (tracked) to block staged commits without all 3 docs.
- Added `scripts/setup-git-hooks.sh` to set `core.hooksPath=.githooks`.
- Added CI workflow `.github/workflows/session-docs-guard.yml` on push/PR.
- Added root npm script: `guard:session-docs`.
- Updated `AGENTS.md` and `CLAUDE.md` with enforcement + setup note.

### Verification
- PASS: `--files STATUS.md HANDOFF.md CHANGELOG.md`
- FAIL: `--files apps/web/src/foo.ts CHANGELOG.md`
- FAIL: `--files STATUS.md HANDOFF.md`
- PASS: `--commit 211540f`
- FAIL: `--commit ccbbb1f`
- FAIL as expected: pre-commit with staged non-doc file
- CI simulation:
  - PASS on `211540f^..211540f`
  - FAIL on `ccbbb1f^..ccbbb1f`

### Notes
- macOS bash compatibility fixed (no `mapfile`, no `local -n`).
- No TPS runtime/product logic changed in this session.

---

## Session 9 — 2026-05-24 | Production Hardening + Signature + Dictionary + Audit
SHA range: a296ee1 → ccbbb1f (9 commits)
Production: messenginfo.com SHA ccbbb1f

### Done
- Signature E2E: only for paper filing, hidden for online. /s/ NAME in PDF.
- Signature [?]: inline tooltip (was: new tab to uscis.gov).
- Signature blocking: screen without drawing = explicit error (4 langs).
- _signature_mode type: paper | screen | online_myuscis.
- Booklet upload slot: fixed for BOTH init AND rereg (was: init only, broke 3x).
- Regex CRITICAL fix: mandatory dot for с./м./сел./хут. (was: stripped "Суми"→"уми").
- Empty result guard: if prefix strip leaves empty, keep original.
- Dictionary: +10 entries (хут, пгт, громада, округ). CZO/MFA verified.
- Settlement type "смт" warning: abolished Jan 2024.
- Tooltips: human language, 4 langs (was: "Part 8 I-821 — контактний телефон").
- Placeholders: removed from all manual fields (was: "2131234567", "Kyiv", "JOHN DOE").
- EAD subtitle: merged into [?] tooltip (was: shown as separate line).
- OCR prefill: manual fields now show mergedFields data (was: always empty).
- Personal data: removed from all code (real names → TESTENKO/IVAN).

### Bugs found but NOT fixed
- CRITICAL: last_entry_date required by gate but not in rereg review/manual.
- CRITICAL: us_address_city/state/zip no manual input, only DL/I-797 OCR.
- HIGH: passport_expiration_date no manual fallback.
- HIGH: REREG+NOEAD path has no passport/I-94 slots.

### Root causes of regressions
1. Two separate if/else branches for init/rereg — adding to one, forgetting other.
2. Regex copy-paste without edge-case testing.
3. Claiming "done" before verifying production SHA on healthz.

### Build failures
- 959e761: missing locale prop → fixed in a296ee1.
- e88cc91: TS2322 'online_myuscis' type → fixed in ccbbb1f.

### Not proven
- No real passport OCR test.
- No PDF opened visually.
- No ZIP generated.
- No clean-session gate test in production.

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

---

## 2026-05-23 (session 7) | Translation Bridge + SignatureStep + Product Vision

**Summary:**
Full ADR-006 implementation: one upload → forms + translation in same ZIP.

**Built:**
- `translationBridge.ts` — shouldTranslate, resolveTemplate, generateTPSTranslation, completenessCheck (16 tests)
- `SignaturePad.tsx` — reusable touch canvas, 4 languages, high-DPI, dark mode
- `SignatureStep.tsx` — USCIS rules + "I've read the rules" + user choice (screen/paper/online)
- `packetBuilder.ts` — patched: auto-generates Translation_Internal_Passport.txt + Certification_Translation.txt
- `mailReadyGate.ts` — patched: checks translation completeness per 8 CFR §103.2(b)(3)
- `TPS_PRODUCT_VISION.md` — complete package architecture
- `ADR-006-one-upload-two-products.md` — architecture decision
- `ADR-007-signature-rules.md` — USCIS signature rules with sources
- Interactive product blueprint (4 tabs: flow/arch/docs/zip)

**Deployed:** SHA 8c13826

**Metrics:**
- Commits: 10 (a9b7062 → 8c13826)
- Tests: 1956 (was 1940, +16)
- Files: 30+ created/changed
- ADRs: 2 new (006, 007)

**P0 DONE:**
✅ translationBridge.ts (rules + rendering + tests)
✅ packetBuilder.ts patched (translation in ZIP)
✅ mailReadyGate.ts patched (translation completeness)
✅ SignaturePad + SignatureStep (user choice, USCIS rules)
✅ Product vision documented

**P1 REMAINING:**
🔲 Wire SignatureStep into TPSWizardV2 as step 6
🔲 Multi-page upload for internal passport booklet
🔲 Blank/non-blank page detection
🔲 PDF rendering (currently TXT → needs bureauStyleRenderer for proper PDF)
🔲 E2E proof: upload → OCR → forms + translation → ZIP
🔲 Translation standalone service integration (birth/marriage/divorce certs)

---

## 2026-05-24 (session 8) | SignatureStep wired + API route + full pipeline

**Honest error analysis:**
Over 2 days I created components but didn't wire them. SignatureStep existed as a file but wasn't imported in the wizard. API route wasn't patched. Translation bridge existed but packetBuilder didn't call it. Today I fixed all of that.

**What was done:**
- [x] SignatureStep wired as step 6 in TPSWizardV2 (wizard now 7 steps)
- [x] Progress bar updated to 7 segments
- [x] API route patched: _translation sidecar → buildPacket(translationOpts)
- [x] Wizard sends uploadedDocTypes + signerName + signatureDataUrl to API
- [x] packetBuilder try/catch for translation (forms never blocked)
- [x] Test mock updated (translations[] + auditSummary)
- [x] signatureData state in wizard, passed through to _translation

**Deployed:** SHA 1bb9d3d (13 commits total this session)

**Tests:** 0 type errors, 1956 pass, 53 files

**Remaining P1:**
- [ ] Translation as .pdf not .txt (needs bureauStyleRenderer)
- [ ] city_of_birth "смт." expansion in translation (forms OK via toWinAnsiSafe)
- [ ] civil_registry_terms.json migration to knowledge
- [ ] E2E with real upload (requires manual test)
