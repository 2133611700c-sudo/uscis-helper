# STATUS — Messenginfo TPS Robot
**Updated:** 2026-05-25 Session 18 — client whitelist drift killed (BOOKLET_WAVE1_FIELDS, SLOT_ALLOWED_FIELDS.booklet, source-type unions)
**Live SHA:** pending push (was b29ef3f)
**Tests:** 1985/1985
**Commits this session:** 1

## SESSION 18 — booklet family_name actually reaches the user

### Post-mortem on Session 17
Session 17 closed with "production verified, surname=Kuropiatnyk, crossref_ok" against the OCR API. That measurement was correct at the API boundary and misleading at the user boundary. The server contract (commit `ce12446`) allowed `family_name`. The client throws it away in **three** independent places that the predecessor had not updated:
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
Server (`documentContracts.ts:106`) + 3 client filters in `TPSWizardV2.tsx` (1082, 1121, 1973) + 1 arbiter union in `fieldArbiter.ts:91` = **5 sync points**. Recommended fix: server emits the contract over `/api/tps/contract/booklet`, client fetches once and uses for all 3 filters. Queued for next session.

## NEXT STEP
1. Push this fix → verify on prod.
2. Build the real integration gate: a CI script that imports `BOOKLET_WAVE1_FIELDS`, `SLOT_ALLOWED_FIELDS.booklet`, `documentContracts.booklet.allowed_fields` at runtime and asserts equality. Catches future drift.
3. Multi-sample booklet benchmark (still the real Phase 0 gap from the Central Brain plan).
4. Open product question: relax server contract to allow `given_name` + `dob` from booklet — only after multi-sample benchmark proves crossref handles them.























