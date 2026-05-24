# HANDOFF.md
Last updated: 2026-05-24 05:12 UTC
Session: 10
Production SHA: ccbbb1f

## 2026-05-24 (session 12) — runtime dual-proof instrumentation

### What I changed
1. `apps/web/src/app/[locale]/services/tps-ukraine/start/TPSWizardV2.tsx`
   - Added `data-testid="tps-gate-error-container"` on Step 5 gate error block.

2. `scripts/t3ps-runtime-dual-proof.mjs` (new)
   - End-to-end dual-mode production probe with:
     - selector contract check,
     - slot-level OCR status/error capture,
     - unpaid/paywall check,
     - paid callback generate attempt,
     - owner mode availability check,
     - network/console/failed request exports.

3. Updated tests/scripts to V2 selectors:
   - `apps/web/src/lib/tps/__tests__/wizardV2RuntimeLock.test.ts`
   - `scripts/t3ps-functional-closeout-browser.mjs`
   - `scripts/t3ps-production-contour-clean.mjs`
   - `scripts/t3ps-final-browser-audit.mjs`

### Current truth
- Dual-proof run shows selector contract present and OCR status 200 per required slot.
- Owner mode remains blocked in automation due missing owner session.
- Client mode currently stuck at step 5 until full required review corrections are satisfied.

## WHAT WAS DONE IN SESSION 10

### Goal
Enforce mandatory session docs on every commit:
- STATUS.md
- HANDOFF.md
- CHANGELOG.md

### Implemented
1. Added guard script:
   - `scripts/guards/require-session-docs.sh`
   - Modes: `--staged`, `--files`, `--commit`, `--range`, `--ci`
2. Added tracked local hook:
   - `.githooks/pre-commit`
   - calls `scripts/guards/require-session-docs.sh --staged`
3. Added hook setup script:
   - `scripts/setup-git-hooks.sh`
   - runs `git config core.hooksPath .githooks`
4. Added CI workflow:
   - `.github/workflows/session-docs-guard.yml`
   - runs on `push` + `pull_request`
   - validates every commit in range using `pnpm guard:session-docs`
5. Added root script:
   - `package.json` → `guard:session-docs`
6. Updated agent rules:
   - `AGENTS.md`, `CLAUDE.md`
   - explicit enforcement note + setup command

### Verification
- `--files STATUS.md HANDOFF.md CHANGELOG.md` → PASS
- `--files apps/web/src/foo.ts CHANGELOG.md` → FAIL
- `--files STATUS.md HANDOFF.md` → FAIL
- `--commit 211540f` → PASS
- `--commit ccbbb1f` → FAIL
- `.githooks/pre-commit` with staged non-doc file → FAIL
- `pnpm guard:session-docs` in simulated PR/push ranges → PASS/FAIL as expected

## WHAT WAS DONE IN SESSION 9

### Commits (9 total)
```
ccbbb1f fix: add 'online_myuscis' to _signature_mode type
e88cc91 fix: P0 — manual fields show OCR data as prefill + signature mode fix (build failed, fixed in ccbbb1f)
ad9ed1a fix: booklet upload slot for BOTH init AND rereg
bd38474 fix: signature [?] shows tooltip instead of opening new tab
56f2286 fix: CRITICAL regex bug — mandatory dot for с./м./сел./хут. prefixes
2e22bea feat: expanded settlement dictionary — verified against official sources
1e6d8fc fix: signature block only for paper filing, not online
9f6e93a fix: human-readable tooltips in [?] for all fields (4 languages)
6d89c45 fix: remove all example placeholders from manual input fields
a296ee1 fix: add missing locale prop to ReviewManual — fixes Vercel build
```

### Key changes
1. **Signature**: only for paper filing. Online = sign in myUSCIS. Screen mode blocking.
2. **Booklet slot**: now in BOTH init and rereg branches.
3. **Regex bugfix**: mandatory dot for с./м./сел./хут. — prevented stripping "Суми"→"уми".
4. **Dictionary**: +10 entries (хут, пгт, громада, округ, full forms). CZO verified.
5. **Tooltips**: human language (not "Part 8 I-821"), 4 languages.
6. **Placeholders**: removed from all manual fields.
7. **OCR prefill**: manual fields now show mergedFields data.
8. **EAD subtitle**: merged into [?] tooltip.
9. **Signature mode**: paper | screen | online_myuscis in TPSAnswers type.

### Build failures during session
## 2026-05-24 (session 10) — runtime drift closure (active)

### What I changed
1. `apps/web/src/app/[locale]/services/tps-ukraine/start/TPSWizardV2.tsx`
   - Added stable data-testid selector contract for critical TPS path.
   - Added Step-5 preflight gate before Step-6 transition.
   - Added generated artifact truth marker (`generatedManifest`) after successful packet generation.
   - Added deterministic Step-6 eligibility (`isStep6Eligible`) from real merged data + gate result (no volatile session flag dependency).
   - Added per-slot OCR diagnostics (`ocr_http_status`, `ocr_error`) to reduce silent 422 behavior.

2. Session docs updated:
   - `STATUS.md`
   - `HANDOFF.md`
   - `CHANGELOG.md`

### What is verified right now
- Local gates pass after patch: `typecheck`, `test`, `lint`, `guard`, `build`.
- Original failure is still reproducible on production until deploy (expected): script timeout on missing `tps-ocr-cta`.

### What must happen next (no shortcuts)
1. Commit scoped changes and push.
2. Wait for deployment readiness.
3. Rerun production browser proof:
   - selector presence,
   - clean-session false-readiness blocked,
   - OCR/upload statuses visible,
   - generate `200`,
   - ZIP downloaded,
   - PDFs opened and visually checked.

- `959e761` — ERROR: missing locale prop in ReviewManual. Fixed in `a296ee1`.
- `e88cc91` — ERROR: TS2322 'online_myuscis' not in type. Fixed in `ccbbb1f`.

## WHAT IS BROKEN (must fix next)

### CRITICAL
1. **last_entry_date gate block for rereg** — users can't complete rereg flow.
   - mailReadyGate.ts requires it unconditionally
   - ReviewManual doesn't show it for rereg paths
   - No manual input field exists
2. **us_address_city/state/zip** — no manual input, only DL/I-797 OCR.
   - Users without DL upload can't pass gate.
3. **passport_expiration_date** — no manual fallback if OCR fails.

### HIGH
4. **REREG+NOEAD path** — no passport/I-94 upload slots.
5. **Edge-case regex tests** — inline only (node -e), not in test suite.

## WHAT IS NOT PROVEN
- No real passport photo uploaded and OCR'd this session
- No PDF opened and visually inspected
- No ZIP generated and contents verified
- No clean-session gate test in production
- No E2E flow completed end-to-end

## NEXT SESSION PRIORITY
1. Fix CRITICAL #1 (last_entry_date) and #2 (address split)
2. Full E2E test with real passport photo
3. Open generated PDF and verify every field
4. Add load-bearing tests to CI

## KEY FILE PATHS
- Wizard: `apps/web/src/app/[locale]/services/tps-ukraine/start/TPSWizardV2.tsx`
- Gate: `apps/web/src/lib/tps/mailReadyGate.ts`
- Answers: `apps/web/src/lib/tps/answers.ts`
- Field maps: `apps/web/src/lib/tps/forms/i821FieldMap.ts`, `i765FieldMap.ts`
- PDF prefiller: `apps/web/src/lib/tps/pdfPrefiller.ts`
- OCR normalize: `apps/web/src/lib/tps/ocr/postExtractNormalize.ts`
- Dictionary: `packages/knowledge/src/dictionary.ts`
- Transliterate: `packages/knowledge/src/transliterate.ts`
