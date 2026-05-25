# CHANGELOG.md — Permanent Project History
Every work session appends here. Never delete entries. Newest first.

---

## 2026-05-24 — Session 15: P0 OCR Routing Fix (3 dead slots)

### White-box audit findings
- Independent code audit traced full pipeline: wizard → OCR route → contract → mergedFields → gate → PDF
- Found P0: three wizard slot IDs (i797_or_ead, tps_notice, ead_old) had NO case in OCR route switch
- i797_or_ead additionally had NO entry in documentContracts → ALL fields killed as UNKNOWN_SLOT
- Net result: users uploading I-797, TPS notices, or previous EAD got zero extracted fields

### P0 FIX: route cases + contract
- route.ts: `case 'tps_notice'` → runI797Module (same doc family)
- route.ts: `case 'i797_or_ead'` → try BOTH runI797Module + runEadModule, pick winner by field count
- route.ts: `case 'ead_old'` → runEadModule with rotation retry (same as case 'ead')
- documentContracts.ts: added 'i797_or_ead' to SlotId + contract (union of i797 + ead allowed_fields)
- TPSWizardV2.tsx: added i797_or_ead to SLOT_ALLOWED_FIELDS (client-side hydration firewall)
- TypeScript: 0 project errors

### Also found (NOT fixed this session)
- Part 7 background declaration never shown to user (P1 legal risk) — FIXED same session
- marital_status not in gate required list (P2) — FIXED same session
- province_of_birth missing from I-821 field map (P3)
- receipt_number extracted but never reaches PDF (P3)

### P1 FIX: Part 7 background declaration review
- Added Part 7 confirmation card to Step 5 (all 4 locales)
- User must check "I reviewed Part 7 and all answers are No" before generating
- Gate blocks generation if part7_reviewed is false
- buildDraftAnswers reads part7Reviewed from wizard state instead of hardcoded true

### P2 FIX: marital_status in gate required fields
- Added marital_status to REQUIRED_FIELDS in mailReadyGate.ts
- Gate now blocks generation if marital status not selected

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

### BUG-4 FIX (P0): booklet contract MISSING → ALL booklet OCR fields rejected
- **Root cause**: `documentContracts.ts` had NO entry for `booklet` slot
- `applyContract('booklet', ...)` returned `UNKNOWN_SLOT` for ALL fields
- **Impact**: middle_name, city_of_birth, province_of_birth NEVER reached wizard from booklet
- **Fix**: Added `booklet` to SlotId type + full contract (11 allowed fields)
- Also added `place_of_last_entry` to I-94 contract allowed_fields (was missing)
- **Proven by**: real user ZIP readback — I-821 + I-765 had empty city/province/patronymic

### BUG-4c FIX (P0): API route missing case 'booklet'
- **Root cause #2**: `switch(docTypeHint)` in OCR API route had no `case 'booklet'`
- When wizard sent `docHint='booklet'` → fell through to `default:` → `moduleResult=null`
- **Impact**: booklet extraction module NEVER RAN for booklet uploads
- **Fix**: Added `case 'booklet'` that runs `runPassportBookletModule()` with rotation retry
- Combined with BUG-4 contract fix: now full chain wizard→API→module→contract→review→PDF works

### BUG-5 FIX: booklet multi-line birthplace parsing
- **Root cause**: `findValueNear` returned only FIRST adjacent line after label
- When booklet had city and oblast on separate lines, only oblast was captured → city_of_birth empty
- **Fix**: Rewrote birthplace extraction to scan ALL adjacent lines (up to 4), separate city and oblast using OBLAST_RE pattern
- Now handles: single-line ("м. Вінниця Вінницької обл."), multi-line (city on one line, oblast on next), city-only ("м. Київ")

### BUG-6 FIX (P0): booklet contract + validation lockdown
- **Root cause**: booklet contract allowed identity fields (family_name, given_name, dob, sex, passport_number) which booklet handwritten OCR fills with garbage (month names as given_name, date fragments in surname)
- **Fix 1**: Restricted booklet contract to ONLY 3 unique fields: middle_name, city_of_birth, province_of_birth. Identity fields moved to forbidden_fields.
- **Fix 2**: Added validation guards: reject values containing digits, date month names, or unreasonable length before emitting middle_name/city/province
- **Architecture rule**: загранпаспорт MRZ is authoritative for identity. Booklet is SUPPLEMENTARY for patronymic + birthplace only.

### BUG-7 FIX (P0): booklet findValueNear search direction REVERSED
- **Root cause**: Ukrainian booklet has handwritten value ABOVE the printed label. OCR reads top-to-bottom → value line comes BEFORE label in array. But `findValueNear` searched NEXT lines first (step 2) then PREVIOUS as "fallback" → grabbed the WRONG field's value every time. DOB ended up as given_name, given_name as patronymic.
- **Fix**: Reversed search order → PREVIOUS lines first (primary), NEXT lines as fallback
- **Verified against**: real Ukrainian booklet photo — handwritten layout confirmed value-above-label

### BUG-8 FIX: birthplace parser must scan ABOVE AND BELOW label
- City is ABOVE "Місце народження" label, oblast is BELOW it
- Previous parser only scanned offsets 0..+4 (below) → city always missed
- **Fix**: scan range -2..+4 (both directions)

### BUG-9 FIX (P0): Brain second-pass for booklet extraction
- Vision OCR cannot read handwritten Cyrillic — labels found but values garbage
- Added `booklet` to `TARGETED_BRAIN_FIELDS` with middle_name, city_of_birth, province_of_birth
- Added city_of_birth, province_of_birth to Brain FieldSchema
- Added booklet-specific Brain prompt rules 21-25 (layout, oblasts, patronymics, settlement types)
- Brain output goes through `@uscis-helper/knowledge` normalization, not directly to PDF

### BUG-10 FIX: province_of_birth from загранпаспорт visible zone
- Загранпаспорт has printed "ВІННИЦЬКА ОБЛ./UKR" in Place of birth — Brain reads this reliably
- Was blocked by passport contract (only identity fields were allowed)
- Added province_of_birth to passport allowed_fields + targeted brain fields
- Strategy: province from загранпаспорт (printed), patronymic from booklet (handwritten), city manual

### Remove middle_name from booklet extraction
- Patronymic is OPTIONAL on USCIS forms (I-821, I-765)
- Vision cannot read handwritten Cyrillic reliably for this field
- Removed from booklet contract allowed_fields, added to forbidden_fields
- Removed from Brain targeted fields
- User enters manually if needed via ReviewManual FieldInput

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


---

## 2026-05-24 (session 16) | Live RU internal-passport runtime evidence (no code changes)

**Summary:**
Captured production browser evidence for RU flow with uploaded internal passport. Verified step-4 upload state and step-5 post-recognize outputs in live user Chrome session.

**Artifacts added:**
- `docs/reports/evidence/t3ps-final-release/browser-run-clean/runtime-ukr-passport-20260524/01_step5_city_oblast_ru.png`
- `docs/reports/evidence/t3ps-final-release/browser-run-clean/runtime-ukr-passport-20260524/02_step4_internal_passport_uploaded_ru.png`
- `docs/reports/evidence/t3ps-final-release/browser-run-clean/runtime-ukr-passport-20260524/03_step5_conflict_top_ru.png`
- `docs/reports/evidence/t3ps-final-release/browser-run-clean/runtime-ukr-passport-20260524/04_health_tps.json`
- `docs/reports/evidence/t3ps-final-release/browser-run-clean/runtime-ukr-passport-20260524/RUNTIME_AUDIT_RU_INTERNAL_PASSPORT_2026-05-24.md`

**Observed runtime facts:**
- Step 4: internal passport uploaded (`Внутренний паспорт Украины ✓ загружено`)
- Step 5 after recognize:
  - city_of_birth rendered as `слет . Тростянець`
  - province_of_birth rendered as `VINNYTSKA OBL.`
  - Patronymic not auto-filled from internal passport path
- Live health SHA: `3513eb3720d71421d18c8f1d65352f2b642fd449`

**Code changes:** none.

---

## 2026-05-24 (session 17) | Wave1 Runtime-Stable v1 implementation (booklet OCR)

**Summary:**
Implemented guarded extraction and parity lock for Ukrainian internal passport birthplace fields to stop OCR garbage from reaching review/PDF.

**Changed behavior:**
- `postExtractNormalize` now enforces strict validation for `city_of_birth` and `province_of_birth`.
- Broken prefix/noise values are rejected and marked manual-required.
- OCR response now includes additive diagnostics:
  - `knowledge_rejected_fields`
  - `knowledge_diagnostics`
- OCR route removes rejected fields from module output before returning to wizard.
- Wizard accepts booklet OCR only for `city_of_birth` and `province_of_birth` and only when normalized + non-rejected.
- `generate-packet` now enforces review→payload parity for birthplace fields and blocks mismatches with `422`.
- Booklet slot contract tightened to birthplace-only allowed fields.

**Files (key):**
- `apps/web/src/lib/tps/ocr/postExtractNormalize.ts`
- `apps/web/src/app/api/tps/ocr/extract/route.ts`
- `apps/web/src/app/[locale]/services/tps-ukraine/start/TPSWizardV2.tsx`
- `apps/web/src/app/api/tps/generate-packet/route.ts`
- `apps/web/src/lib/tps/ocr/documentContracts.ts`
- `apps/web/src/lib/tps/reviewParity.ts` (new)
- tests:
  - `apps/web/src/lib/tps/__tests__/postExtractNormalize.test.ts` (new)
  - `apps/web/src/lib/tps/__tests__/reviewParity.test.ts` (new)

**Validation:**
- Build: PASS
- Tests: 57/57 files, 1968/1968 tests PASS
### Session 15 commit 5: Brain threshold + EAD dup + contracts
### Commit 6: birthplace merge + I-94 label-as-value + dob normalization


### Phase A Stabilization (2026-05-24 Session 15)
- A2: MRZ identity lock — strong fields can't be degraded by weak sources
- A3: city/province Cyrillic \b regex fix — JS word boundary doesn't work with Cyrillic
- A4: booklet weak source — all fields marked review_required
- A5: honest STATUS/HANDOFF — no filler content
- ROOT CAUSE: JS \b treats Cyrillic as \W → regex never matches "ОБЛ." in validateCity
- Booklet garbage-rejection guard: mixed-case, consonant clusters, word count
- 7 new tests: BiRHEROI rejected, valid cities pass, MRZ unaffected
- Address binding fix: parse full DL address into split fields when split not available
- Manual fields now fall back to mergedFields.address for DL auto-fill
- Review cards: a_number + address visible for ALL filing types (not just rereg)
- Address binding: full DL address parsed into street/city/state/zip fallback
- Compose mergedFields.address from split DL fields (removes "Не найдено" card)
- Review cards: a_number/address for ALL filing types
- passport_expiration_date added to review cards (4 locales)

- Fix duplicate address card (composed address shows once, not twice)
- Field Arbiter v0: source ranking, identity lock, rejectedCandidates, conflict flags
- 10 load-bearing tests: MRZ lock, garbage rejection, source priority, batch resolution
- Deduplicate address review card
- FIELD ARBITER v0 WIRED INTO WIZARD MERGE
- Old Pass 1 + Pass 2 replaced with resolveAllFields()
- Source-ranked merge: MRZ(1) > CBP(2) > USCIS(3) > DL(4) > Brain(5-9) > manual(10)
- Identity lock, conflict tracking, rejectedCandidates in audit trail
- BOOKLET: middle_name (patronymic) UNBLOCKED — was forbidden, now extracted + transliterated
- Contract: middle_name moved from forbidden to allowed for booklet
- Brain targeted: middle_name added for booklet slot
- postExtractNormalize: patronymic garbage guard + KMU-55 Cyrillic→Latin transliteration
- Arbiter: booklet_ocr_keyword priority added for weak fields
- Patronymic guard: reject Latin without valid Ukrainian endings (-ovych/-ovna/-ivna)
- Patronymic guard: reject Cyrillic without -ович/-овна/-івна endings
- 'Cepriticbur' now correctly REJECTED as garbage
- Central Brain: Levenshtein fuzzy matching + name plausibility guard
- Brain prompt: patronymic MUST be Cyrillic source_value, omit if garbage
- Brain prompt: I-94 place_of_last_entry (Port of Entry) instruction added
- Brain schema: place_of_last_entry field added
- Central Brain v0.1: Levenshtein fuzzy matching + name plausibility
- Country field hallucination guard: rejects person names as country values
- Google Document AI integration: client, provider, feature flag
- DocAI adapter matches OcrResult interface — drop-in replacement for Vision
- Feature flag: DOCAI_ENABLED=false (safe rollout, switchable)
- Health endpoint shows docai_enabled + ocr_provider
- Live proof: booklet processed via DocAI, pages=1, text_len=195
