# STATUS — Messenginfo TPS Robot
**Updated:** 2026-05-26 Session 26 — persisted MacBook workstation policy into repo memory
**Status:** PASS
**Scope:** Documentation-only governance update; no app/runtime code touched.

## Session 26 Workstation Policy Persistence
- `VERIFIED` repository memory now includes a permanent "MacBook Workstation and Tool-Use Policy" section in `AGENTS.md`.
- `VERIFIED` policy explicitly permits CLI + browser/app/tool execution when task-relevant and mandates best-tool selection.
- `VERIFIED` policy explicitly preserves safety boundaries for destructive and high-risk operations requiring owner approval.
- `VERIFIED` no application logic, runtime code, build config, or production behavior was changed in this session.
- `VERIFIED` this commit is intended to improve future operator consistency across terminal and app sessions.

**Updated:** 2026-05-26 Session 25 — post-push guard status + clean-range repair commit
**Status:** DEGRADED
**Live SHA:** `d9e31a6254134d7840c3a54275067707f33be5d9`

## Session 25 Current Verified State
- `VERIFIED` Vercel production deployment for docs-only push is `Ready`:
  - deployment: `https://uscis-helper-k67x575l7-sergiis-projects-8a97ee0f.vercel.app`
  - status source: `vercel ls` (age ~5m, Production, Ready).
- `VERIFIED` GitHub `Content & Brand Guards` passed:
  - workflow run: `26461533323`
  - result: `completed success`.
- `FAILED` GitHub `Session Docs Guard` for previous push range:
  - workflow run: `26461533247`
  - result: `completed failure`.

## Session 25 Root Cause (Guard Failure)
- Guard checked the full push range:
  - `1d8e70a53cbebf71fc2f5968971e4ebd85f40a35..d9e31a6254134d7840c3a54275067707f33be5d9`
- In that range:
  - commit `d9e31a6` passed guard checks.
  - commit `1ed8a77` failed guard checks because it did not include `STATUS.md` and `HANDOFF.md`.
- `VERIFIED` process note:
  - `d9e31a6` repaired commit-time compliance for subsequent commits.
  - It cannot retroactively make the earlier pushed commit (`1ed8a77`) green inside the already evaluated push range.

## Session 25 Repair Intent
- A new documentation-only, guard-compliant commit is required to create a fresh push range where each included commit satisfies session-doc requirements.
- This commit includes `STATUS.md`, `HANDOFF.md`, and `CHANGELOG.md` together and changes no app/runtime code.

## Session 25 Current Risk
- `DEGRADED`: production is healthy, but repository CI history still shows one failed `Session Docs Guard` run on `main` tied to the earlier push range.
- No functional product/runtime regression is evidenced from this docs-only sequence.

## Session 25 Exact Next Verification Step
1. Push this guard-compliant docs commit normally to `origin/main`.
2. Re-check:
   - `gh run list --limit 10`
   - `gh run view <new Session Docs Guard run> --log`
   - `vercel ls`
3. Expected closure condition:
   - new `Session Docs Guard` run is `completed success`,
   - `Content & Brand Guards` remains `completed success`,
   - latest Vercel production deployment remains `Ready`.

**Updated:** 2026-05-25 Session 22 — Step6 H.R.1 runtime wiring + booklet guard hardening (post-deploy rerun)
**Status:** DEGRADED
**Live SHA:** `692619ca62d47ecb8d3b23a10cf4b137b1351230`

## Session 22 Truth (post-deploy)
- `VERIFIED` shipped code changes:
  - Step6 now renders `PacketCompletenessChecker` in `TPSWizardV2` (H.R.1 warning source used by runtime UI).
  - booklet city normalization now rejects English settlement descriptors (`... settlement`) to prevent auto-garbage propagation.
  - booklet dual crossref no longer maps `date_of_birth -> dob` (manual fallback only for DOB on weak booklet path).
- `VERIFIED` code gates:
  - `pnpm --filter web typecheck` pass.
  - `pnpm --filter web test -- src/lib/tps/__tests__/postExtractNormalize.test.ts` pass (`1988/1988`).
  - drift gate green (`exit=0`) + synthetic red (`exit=1`) with clean restore.
- `VERIFIED` live runtime on one SHA (`692619ca...`):
  - production E2E pass: upload→OCR→review→gate→generate→ZIP (`/apps/web/tests/e2e/booklet-review.spec.ts`);
  - PDF readback still shows core values in generated I-821/I-765;
  - Step6 H.R.1 warning present in EN/RU/UK/ES runtime UI (`phase22_hr1_locale_results.json`);
  - synthetic benchmark rerun (`booklet_0` vs `booklet_270`) now returns `city_of_birth=Trostianets` in both rows.
- `VERIFIED` audit trail still writes fresh rows:
  - `brain_raw` present,
  - `rejected_fields` type `array`,
  - `validated_skipped` keeps honest DOB fallback (`date not parseable`).

## Why status remains DEGRADED
- `BLOCKED` owner-mode full-chain verification still requires live OTP confirmation from owner mailbox.
- `UNVERIFIED` full mandatory matrix end-to-end for every row (all 4 scenarios × EN/RU × mobile/desktop × owner/normal) is not closed in this single post-deploy rerun.
- `UNVERIFIED` multi-sample benchmark on multiple real booklet identities is still missing (current run used canonical identity + synthetic transforms).

**Updated:** 2026-05-25 Session 21 — finish-all truth-chain execution (strict evidence)
**Status:** DEGRADED
**Live SHA:** `3ec6920de5312a509b1c4bfef3ad24e90acfc103` (start/end matched in ledger)

## Session 21 Truth (strict evidence only)
- `VERIFIED` Phase A/B/C/F foundations:
  - canonical dataset manifest frozen with hashes;
  - drift gate green (`exit=0`) + synthetic red (`exit=1`) with clean restore;
  - remote schema includes `20260526000001`, live audit rows write `brain_raw` + `rejected_fields=array`;
  - `typecheck` + full tests `1987/1987` pass.
- `VERIFIED` production E2E (`initial + paper + EAD yes`, EN normal):
  - upload → OCR → review → gate → generate → ZIP → PDF readback.
  - network proof includes `generate-network.json` with request/response metadata.
- `VERIFIED` DocAI environment readiness:
  - processor enabled + real `:process` request success.
  - production runtime still reports `tps_docai_enabled=false`.
- `VERIFIED` normal-mode Step4 slot matrix parity (EN/RU, desktop/mobile, 4 required scenarios):
  - booklet slot present on mobile and desktop in all normal rows.

## Critical runtime failures observed
- `FAILED` H.R.1 wizard UI visibility (EN/RU/UK/ES): expected H.R.1 strings not found in Step6 runtime UI.
- `VERIFIED` H.R.1 exists in generated `INSTRUCTION.txt` (runtime drift UI vs package text).
- `FAILED` booklet DOB stability: canonical 5-run benchmark shows `dob=NOT_FOUND` in 5/5.
- `FAILED` synthetic rotation robustness: 270° sample produced city drift (`Prostianets settlement`).

## Blocked / unverified
- `BLOCKED` owner-mode completion: `/api/owner/request-code` works, but OTP verification was not completed in-session.
- `UNVERIFIED` full 8-row matrix end-to-end (OCR→review→gate→generate→ZIP→PDF) for every row.
- `UNVERIFIED` multi-identity real-sample benchmark (only one real canonical identity + synthetic transforms executed in this run).

**Updated:** 2026-05-25 Session 20 — independent re-check of items 1..6 + contract-as-API hardening
**Status:** DEGRADED
**Live SHA:** `1c14c197267032e373a1a4a59d4e7f3c2213d721` (verified via `/api/tps/health` on 2026-05-25)

## Session 20 Truth (strict verification)
- `VERIFIED` Item 1 drift gate v2:
  - green path: `node scripts/check-booklet-contract-drift.mjs` exit 0
  - red path: synthetic removal of `'dual_ocr_crossref'` from `TpsExtractionSource` => exit 1 with explicit drift diagnostics.
- `VERIFIED` Item 2 logging enhancement:
  - remote migration list includes `20260526000001_tps_ocr_audit_brain_raw`
  - fresh rows in `public.tps_ocr_audit` show `brain_raw is not null = true`
  - fresh rows show `rejected_fields` JSON type `array`
  - booklet row contains `validated_skipped` with `dob: date not parseable`.
- `VERIFIED` Item 3 Playwright E2E:
  - `npx playwright test tests/e2e/booklet-review.spec.ts --reporter=list` passed against production
  - upload -> OCR -> review -> generate ZIP confirmed.
- `VERIFIED` Item 4 H.R.1 content in generated package:
  - generated `INSTRUCTION.txt` contains H.R.1 fee and EAD validity notes (effective 2026-05-29).
- `VERIFIED` Item 5 contract-as-API consolidation (implemented locally, committed this session):
  - `TPSWizardV2` now derives `SLOT_ALLOWED_FIELDS` from `DOCUMENT_CONTRACTS`
  - `ExtractionSource` now aliases shared `TpsExtractionSource`
  - drift guard script updated to support the new contract-derived shape.
- `VERIFIED` Item 6 benchmark rerun:
  - 5-run canonical stability on production: stable 4 fields (`family_name`, `city_of_birth`, `province_of_birth`, `middle_name`), `dob=NOT_FOUND` in 5/5
  - synthetic multi-sample (0/90/180/270 rotation): 270° produced `Prostianets` (city drift), others `Trostianets`.

## Why status remains DEGRADED
- `UNVERIFIED`: full runtime parity for H.R.1 copy across RU/UK/ES wizard UI (only generated EN packet text is proven this session).
- `FAILED` quality stability for booklet DOB (`NOT_FOUND` in canonical rerun) and city robustness under rotated sample (`Prostianets` at 270°).
- `UNVERIFIED`: local contract-as-API hardening commit is not production-deployed yet.

**Updated:** 2026-05-26 Session 19 — Playwright E2E + ZIP/PDF proof + audit wiring live on production SHA
**Status:** DEGRADED
**Live SHA:** `2d0a626584925b88657381f32cad5793d7ab8da5` (verified via `/api/tps/health` on 2026-05-26)

## Session 19 Truth (no fake pass)
- `VERIFIED` browser E2E against production URL (`/en/services/tps-ukraine/start`) passes with real upload→OCR→review→generate flow.
- `VERIFIED` ZIP artifact is real (`apps/web/test-results/booklet-review-artifacts/tps-packet.zip`, ~2.58MB).
- `VERIFIED` PDF readback finds core values in generated PDFs:
  - `REDACTED`, `FU262473`, `UHP`, `Los Angeles`, `90029`.
- `VERIFIED` live Supabase `tps_ocr_audit` is actively receiving fresh rows (checked in Supabase UI and via linked SQL).
- `VERIFIED` remote DB migrations are synced through `20260526000001`.
- `VERIFIED` new runtime rows now persist `brain_raw` and `rejected_fields` as JSON array:
  - latest rows around `2026-05-26 01:08:30..01:08:44+00` show `has_brain_raw=true` and `rejected_type=array`.

## Why status is still DEGRADED
- Historical rows before deploy still keep old shape (`brain_raw` null + `rejected_fields` string scalar). This is expected legacy data, not a new-write regression.
- `UNVERIFIED`: city/province/patronymic booklet values were not auto-surfaced in this specific production E2E run (`extraction flags: city=false, province=false, middle=false`), so no claim of stable auto-fill is made.

## Session 19 Evidence Paths
- Playwright spec: `apps/web/tests/e2e/booklet-review.spec.ts`
- Playwright screenshots:
  - `apps/web/test-results/booklet-review-artifacts/step5-review.png`
  - `apps/web/test-results/booklet-review-artifacts/step6-generated.png`
- ZIP manifest: `apps/web/test-results/booklet-review-artifacts/zip-manifest.txt`
- PDF text readback:
  - `apps/web/test-results/booklet-review-artifacts/unzip/I-821.txt`
  - `apps/web/test-results/booklet-review-artifacts/unzip/I-765.txt`
  - `apps/web/test-results/booklet-review-artifacts/unzip/pdf-grep.txt`

**Updated:** 2026-05-25 Session 18 — booklet drift killed (3 legs) + drift gate v2 + evidence report + zero-trust re-audit
**Live SHA:** e1429ba (or drift gate v2 commit pending push). Prod verified at simulation level.
**Tests:** 1985/1985
**Commits this session:** 5 (`794b86d` client fix, `8bce911` drift gate v1, `249a5b4` evidence report, `e1429ba` formulation correction, drift gate v2 pending push)

## EVIDENCE REPORT (corrected after external review)
`reports/BOOKLET_PIPELINE_EVIDENCE_REPORT_20260525.md` — 28-run analysis with three-class evidence rule (officially claimed / verified on our data / not verified). Headline findings:
- `dob`: brain emits unparseable format in 28/28 runs (`validated_skipped: "date not parseable"`). Brain prompt says to convert Ukrainian-month genitive forms but emission evidently retains trailing words like `року`. Fixable on this stack; not yet fixed.
- `given_name`: raw OCR garbage on N=1 booklet sample (`"Behri"` from Cyrillic `В` misread as Latin `B`). Vision and DocAI both fail. **NOT proven to fail across the population or across providers.** Azure Read claims expanded Russian handwriting support (officially); we have not benchmarked it. Image preprocessing and region cropping have not been tried. Honest current default: manual entry until multi-sample data says otherwise.
- All other "missing" booklet fields are forbidden by design (passport MRZ is authoritative for those).

## SESSION 18 — booklet family_name actually reaches the user

### Post-mortem on Session 17
Session 17 closed with "production verified, surname=REDACTED, crossref_ok" against the OCR API. That measurement was correct at the API boundary and misleading at the user boundary. The server contract (commit `ce12446`) allowed `family_name`. The client throws it away in **three** independent places that the predecessor had not updated:
1. `BOOKLET_WAVE1_FIELDS` (line ~1121) — wave1 set was still 3 fields, missing `family_name`.
2. `SLOT_ALLOWED_FIELDS.booklet` (line ~1082) — entire `booklet` entry was missing, so any post-hydration session stripped the field.
3. `ExtractionSource` / `SourceType` unions — `'dual_ocr_crossref'` was emitted by the server but absent from the client/arbiter type narrowing, silently downgrading the source to `ocr_visual` (lower priority).

Net effect on prod (still live on b29ef3f as of now): booklet-only TPS users see 3 fields in Step 5 review; surname comes through manual entry only. The "10/10" stability report measured the API response, not user experience.

### Fix shipped this session
- `TPSWizardV2.tsx`: add `family_name` to `BOOKLET_WAVE1_FIELDS`, add `booklet` entry to `SLOT_ALLOWED_FIELDS`, extend `ExtractionSource` union with `'dual_ocr_crossref'`, accept it in source-type narrowing.
- `fieldArbiter.ts`: extend `SourceType` union with `'dual_ocr_crossref'` so server-emitted source survives the wire.
- `scripts/wizard-simulation-test.mjs`: regression script that mirrors the client filter and asserts 4 fields on the canonical sample (added).
- Diff is 17 lines of code. Typecheck clean. 1985/1985 tests pass.

### What this fix is NOT
- It is not an end-to-end browser proof. The `wizard-simulation-test.mjs` script mirrors the wave1 set as a hardcoded constant; it does not actually load `BOOKLET_WAVE1_FIELDS` from the .tsx at runtime. So the next drift between server and client is **not yet** caught in CI.
- It does not solve the structural problem: 4 places (server contract + 3 client filters) maintained by hand, comments saying "mirrors server".
- It does not address `given_name` or `dob` from booklet — those are still forbidden by the server contract, awaiting multi-sample benchmark.

## STRUCTURAL DEBT — booklet allowed-fields drift surface
Server (`documentContracts.ts:106`) + 3 client filters in `TPSWizardV2.tsx` (1082, 1121, 1973) + 1 arbiter union in `fieldArbiter.ts:91` = **5 sync points**.

**Drift gate now wired into CI** (`guards.yml` → `scripts/check-booklet-contract-drift.mjs`): parses the three set literals out of source at build time and fails the workflow if they drift. This catches the Session-17 bug pattern. Not a structural fix — comments still say "mirrors server" — but it eliminates the silent-drift failure mode.

Long-term fix still queued: server emits the contract over `/api/tps/contract/booklet`, client fetches once and uses for all 3 filters. After that the gate collapses to a typecheck.

## NEXT STEP
1. ✅ Pushed (794b86d) and verified on prod via simulation script.
2. ✅ Drift gate `scripts/check-booklet-contract-drift.mjs` wired into `guards.yml`.
3. Browser-level E2E (Playwright + PDF byte-grep) — still owed. Simulation script is not a substitute.
4. Refactor: server emits `/api/tps/contract/:slot`, client fetches once, deprecate the hand-maintained client constants. Then the drift gate collapses to a typecheck.
5. Multi-sample booklet benchmark (still the real Phase 0 gap from the Central Brain plan).
6. Open product question: relax server contract to allow `given_name` + `dob` from booklet — only after multi-sample benchmark proves crossref handles them.














