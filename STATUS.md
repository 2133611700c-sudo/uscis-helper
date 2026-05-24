# STATUS.md
Last updated: 2026-05-24 05:12 UTC
Session: 10 (session docs guard enforcement: pre-commit + CI)
Production SHA: ccbbb1f

## Product
Messenginfo = self-help immigration information, document translation, and USCIS draft-form generation platform.
Not a law firm. No legal advice. User reviews, signs, and files independently.

## Current production goal
Fully automatic: upload docs → OCR/vision → normalization → TPSAnswers → I-765/I-821 PDF → review → clean export.
User manual input: phone, email, marital status, SSN only. Everything else from documents.

## VERIFIED (with evidence)
- [x] Session docs enforcement added: every commit must include STATUS.md + HANDOFF.md + CHANGELOG.md
- [x] Local git hook enabled via .githooks/pre-commit and scripts/setup-git-hooks.sh
- [x] CI guard added: .github/workflows/session-docs-guard.yml checks each commit in push/PR range
- [x] Guard script supports --staged, --files, --commit, --range, --ci
- [x] Validation proof:
  - commit 211540f PASS
  - commit ccbbb1f FAIL (as expected)
  - staged non-doc change FAIL (as expected)
- [x] Production live: messenginfo.com, SHA ccbbb1f, healthz 200 OK
- [x] Wizard: 6 steps, progress bar matches
- [x] Booklet upload slot: BOTH init AND rereg paths (Chrome screenshot proof)
- [x] 5 upload slots for init: passport, booklet, I-94, I-797/EAD, DL
- [x] 4+ upload slots for rereg+EAD: tps_notice, booklet, passport, ead_old, i94, dl
- [x] Signature: only for paper filing (hidden for online)
- [x] Signature [?]: inline tooltip, not new tab
- [x] Signature blocking: screen mode without drawing = explicit error in 4 languages
- [x] Signature in PDF: /s/ NAME in I-821 + I-765 (readback test: 3 tests pass)
- [x] Placeholders removed from manual fields (phone, email, city, province, place, in_care_of)
- [x] Tooltips: human language in 4 langs, no "Part X I-821" references
- [x] EAD subtitle "Устанавливается автоматически" moved inside [?]
- [x] Regex: mandatory dot for с./м./сел./хут. — 15 edge cases pass
- [x] Empty result guard: strip leaves empty → keep original
- [x] Dictionary: 22 settlement types, CZO/MFA verified
- [x] KMU-55 transliteration: Тростянець → Trostianets (confirmed CZO)
- [x] pdfPrefiller: toWinAnsiSafe on ALL values (no Cyrillic crash)
- [x] OCR prefill: manual fields show mergedFields data as fallback
- [x] _signature_mode: paper | screen | online_myuscis (type in answers.ts)
- [x] Province normalization: genitive → nominative → English (25/25 oblasts)
- [x] Personal data removed from codebase (real names → test data)
- [x] 0 TS errors, 1959 tests pass

## 2026-05-24 (session 12) — dual-mode runtime proof hardening

### VERIFIED
- Production SHA aligned to `201ce5d...` before this patch cycle.
- OCR slot-level diagnostics now reproducible via dual proof script.
- OCR 422 root cause was fixture quality (overexposed); switching fixtures produced slot 200 responses in all required slots.

### CHANGED NOW
- Added `data-testid="tps-gate-error-container"` on Step 5 gate error surface (same contract token as Step 6).
- Added `scripts/t3ps-runtime-dual-proof.mjs` for owner/client contour evidence:
  - selector contract probe,
  - slot-level OCR status/error capture,
  - unpaid/paywall and paid-callback behavior capture,
  - generate/ZIP capture when available.
- Updated runtime lock tests and browser scripts to V2 selector contract.

### OPEN
- Owner-mode generate proof is blocked without owner session in automation context.
- Client-mode still needs final `generate 200 + ZIP + PDF visual` closure in same evidence run.

## 2026-05-24 (session 13) — gate/data path closure for Step 5

### CHANGED NOW
- Added explicit Step 5 manual fields for gate-required data:
  - `us_address_city`
  - `us_address_state`
  - `us_address_zip`
  - plus stable test ids for street/phone/email manual fields.
- This removes hidden inconsistency where gate demanded fields the user could not input directly in current UI.

## 2026-05-24 (session 10) — TPS runtime hardening in progress

### VERIFIED
- `local == origin/main == production health SHA` before this fix cycle.
- Reproduced production selector drift: missing `[data-testid="tps-ocr-cta"]` in live UI.
- Reproduced false-readiness path in clean session (could reach Step 6 shell before real packet generation proof).

### CHANGED NOW
- Added stable selector anchors in TPSWizardV2:
  - `tps-ocr-cta`
  - `tps-upload-slot-*`, `tps-upload-input-*`
  - `tps-review-step-container`
  - `tps-generate-cta`
  - `tps-gate-error-container`
  - `tps-signature-mode-block`
  - `tps-paywall-state`
  - `tps-package-ready-state`
  - `tps-download-success-state`
- Added Step-5 preflight gate before entering Step 6:
  - blocks when extracted field count is zero
  - runs `runMailReadyGate` and surfaces blockers immediately
- Added generation truth-source manifest in UI (`generatedManifest`) after real `generate-packet` blob response.
- Replaced volatile Step-6 unlock dependency with deterministic eligibility check (`isStep6Eligible`) from current merged fields + mail-ready gate result.
- Improved OCR error observability per slot (`ocr_http_status`, `ocr_error`).

### OPEN
- Deploy + live production rerun not finished yet in this section.
- Final proof chain still required: review -> generate 200 -> ZIP -> opened PDFs.

## CRITICAL BUGS (open, not fixed)
- [ ] **last_entry_date**: REQUIRED by gate unconditionally, but rereg review rows don't show it, no manual input exists. Rereg users blocked.
  - File: mailReadyGate.ts line 48, TPSWizardV2.tsx line 2849
  - Fix needed: add to rereg review OR make conditional on init only
- [ ] **us_address_city/state/zip**: no manual input. Only from DL/I-797 OCR. Users without DL upload blocked.
  - File: TPSWizardV2.tsx (ReviewManual), mailReadyGate.ts
  - Fix needed: parse address string OR add separate manual inputs
- [ ] **passport_expiration_date**: no manual fallback if OCR fails. Gate blocks.
  - Fix needed: add manual input OR move to RECOMMENDED
- [ ] **REREG+NOEAD path**: no passport/I-94 upload slots. Minimal flow.
  - Fix needed: add passport slot OR evaluate if path is valid

## OPEN (not proven)
- [ ] PDF visual proof — no PDF opened and inspected
- [ ] ZIP contents — no ZIP generated in this session
- [ ] OCR real upload — no test with actual passport photo
- [ ] Gate clean-session block — not tested in production UI
- [ ] E2E: upload → review → PDF → ZIP complete flow

## ROOT CAUSES OF SESSION 9 REGRESSIONS
1. **Two separate branches for init/rereg** in doc list builder. Adding to one, forgetting the other. Happened 3 times.
2. **Regex copy-paste without testing**. `^с\.?\s*` stripped "С" from "Суми". Caught only when owner said "проверь критически".
3. **Claiming "done" before verifying production SHA**. Multiple times healthz showed old SHA.
4. **localStorage masking changes**. Owner testing with cached state, not seeing new slots.

## DO NOT RE-LITIGATE
- Dictionary v1.2 is canonical (ADR-002)
- Patronymic ≠ Middle Name (blocklist enforced)
- Historical Militsiya stays Militsiya (ADR-004)
- KMU-55 is the only transliteration standard
- Existing pipeline is correct; extend, do not rebuild
- смт abolished Jan 2024 but stays in dictionary for old documents

## RELATED ADRs
- `docs/adr/ADR-001-product-boundary.md`
- `docs/adr/ADR-002-ukraine-dictionary-v1.2.md`
- `docs/adr/ADR-003-tps-runtime-pipeline.md`
- `docs/adr/ADR-004-historical-authority-policy.md`
- `docs/adr/ADR-006-translation-bridge.md`
- `docs/adr/ADR-007-signature-rules.md`
