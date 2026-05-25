# HANDOFF — Session 18 (2026-05-25)

## What was done

### 1. Killed the client-side whitelist drift that ate `family_name` (commit 794b86d, prod live)
The server contract for booklet (`documentContracts.booklet.allowed_fields`) already included `family_name` in commit `ce12446`. The wizard client did not. Three independent filters silently dropped the field before it reached Step 5 review. This commit updates those filters and extends the source-type unions so the server-emitted `dual_ocr_crossref` source survives the wire.

### 2. Wired a CI drift gate so the same bug pattern can't ship again (commit 8bce911, pushed)
`scripts/check-booklet-contract-drift.mjs` parses the three set literals at CI time and fails the workflow if they don't match. Added to `.github/workflows/guards.yml` between typecheck and build.

### 3. Wrote evidence report on what blocks dob and given_name (commit pending push)
`reports/BOOKLET_PIPELINE_EVIDENCE_REPORT_20260525.md` — analysis of 28 stability runs. Distinguishes contract failures from validation failures from OCR failures. Key findings:
- `dob`: brain emits unparseable format in 28/28 runs. Fixable via prompt/parser improvement + multi-sample benchmark + contract relaxation.
- `given_name`: raw OCR garbage on the canonical sample (`"Behri"` from Cyrillic `В` misread as Latin `B`). Both Vision and DocAI fail the same zone. Manual entry is the honest path.

This is the foundation for any future "relax the booklet contract" conversation. Don't have it without re-reading the report.

### 4. Corrected evidence-report formulation after external review (commit pending push)
External reader (vendor-strategy note) caught two too-absolute claims in the evidence report. The `given_name` section was titled "structural OCR limitation, not a contract issue" and concluded "not fixable from this sample" — both phrasings drift from "Vision+DocAI failed on our N=1 sample" to "OCR cannot do this".

Added to the report:
- A global evidence-classification rule (*officially claimed* / *verified on our data* / *not verified*) applied to every provider-capability claim.
- Explicit acknowledgement that Azure Read and Yandex Vision were never benchmarked on Cyrillic handwritten booklets and could behave differently.
- Image preprocessing + region cropping as a fourth investigation path (cheap, untried).
- A "do not write absolute claims about provider capability based on N=1 sample" rule under "What you should NOT do".

No code change. This is correcting the analytical record. Same lesson as Session 17's post-mortem, applied to vendor framing instead of pipeline framing: don't generalize from one sample to a capability claim.

### Files changed (this commit)
- `reports/BOOKLET_PIPELINE_EVIDENCE_REPORT_20260525.md`
- `STATUS.md`, `HANDOFF.md`, `CHANGELOG.md`

### Files changed (all four commits this session)
- `apps/web/src/app/[locale]/services/tps-ukraine/start/TPSWizardV2.tsx`
- `apps/web/src/lib/tps/fieldArbiter.ts`
- `scripts/wizard-simulation-test.mjs` (regression script the predecessor wrote)
- `scripts/check-booklet-contract-drift.mjs` (new: CI gate)
- `.github/workflows/guards.yml` (new step wired)
- `STATUS.md`, `HANDOFF.md`, `CHANGELOG.md`
- `reports/booklet-stability-20260525-*` (10 stability runs)
- `daily-briefing-2026-05-25.md`

### Verification done
- `pnpm typecheck` (apps/web): clean.
- `pnpm test` (apps/web vitest): 1985/1985 in 12s.
- Drift gate green locally: all three sets equal at `[city_of_birth, family_name, middle_name, province_of_birth]`.
- Synthetic drift check: regex correctly extracts a renamed identifier; set diff would fire.
- Vercel deploy of `794b86d`: state READY.
- Prod regression check: `node scripts/wizard-simulation-test.mjs https://messenginfo.com` returned 4/4 fields surfacing with `dual_ocr_crossref` source.

### Verification NOT done
- **No browser-level Step 5 walk.** No Playwright. No screenshot of the actual Step 5 review screen with the surname populated. The simulation script mirrors the client filter — it does not exercise the deployed JS bundle, localStorage hydration, or PDF generation.
- **No PDF byte-grep.** The downloaded I-821 / I-765 PDFs have not been inspected to confirm `Kuropiatnyk` actually lands in the right form fields.
- These are the proper-E2E gate. They are the real Definition of Done. They are owed next session.

## What must happen next (in order)

### 1. Real E2E with Playwright + PDF byte-grep
Write a script that:
- Spins up the booklet upload flow in a headless browser against staging (or prod with a controlled test account).
- Walks Steps 1→6 with the canonical booklet image.
- Downloads the generated I-821 and I-765 PDFs.
- Uses `pdftotext` (already a CI dep — see `guards.yml`) to grep for `Kuropiatnyk`, `Trostianets`, `Vinnytsia Oblast`, `Serhiiovych`.
- Fails non-zero on any missing field.
This is the actual gate that catches "shipped, but doesn't reach the user". Make it the new `npm test:e2e` and wire into a separate CI job (slow; should not block the typecheck/build/unit fast path).

### 2. Contract-as-API consolidation
Server emits `GET /api/tps/contract/booklet → { allowed_fields, forbidden_fields }`. Client fetches once on wizard mount, uses for the three filter call sites. Deprecate `BOOKLET_WAVE1_FIELDS` and `SLOT_ALLOWED_FIELDS.booklet` literals. After this lands, the drift gate `scripts/check-booklet-contract-drift.mjs` is replaced by a TypeScript-level guarantee.

### 3. Multi-sample booklet benchmark
The real Phase 0 gap the predecessor correctly identified. Need 3-5 real booklets from other Ukrainian TPS holders (PII — handle per `qa-shots/private/` rules — gitignored). Without this, every "production-stable" claim is on a one-sample benchmark.

### 4. Open product question — booklet-only `given_name` and `dob`
For booklet-only TPS users these are critical fields still on the server `forbidden_fields` list. Relaxing them requires multi-sample benchmark proof that dual-OCR crossref handles them. **Do not relax before evidence.**

## Unrelated but on the clock

`daily-briefing-2026-05-25.md` flags **H.R.1 IFR effective 2026-05-29** — TPS EAD capped at 1 year, no auto-extension, fee non-waivable. That is **4 days from now**. Affects TPS section copy, fee guidance, I-765 instructions. Not a pipeline change — content/legal copy. Schedule before the rule goes live or users will see stale guidance. Same briefing flags adjustment-of-status restriction (PM-602-0199, effective 2026-05-21) and signatures rule (effective 2026-07-10).

## Why session 17's "production verified" was wrong (for the record)
"10/10 stable on canonical dataset, surname=Kuropiatnyk, crossref_ok, latency=15.3s on messenginfo.com" — true at the OCR API boundary. Not true at the user boundary. The session declared success on `curl` output and committed before walking a wizard. Cost: 0 (caught in the same session before propagation). Lesson: API success and user success are different invariants. New rule enforced in CI gate above.
