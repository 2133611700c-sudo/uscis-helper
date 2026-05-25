# HANDOFF — Session 18 (2026-05-25)

## What was done

### Killed the client-side whitelist drift that ate `family_name`
The server contract for booklet (`documentContracts.booklet.allowed_fields`) was correctly extended to include `family_name` in commit `ce12446`. The wizard client was not. Three independent filters silently dropped the field before it reached Step 5 review. This session updates those filters and extends the source-type unions so the server-emitted `dual_ocr_crossref` source survives the wire.

### Files changed
- `apps/web/src/app/[locale]/services/tps-ukraine/start/TPSWizardV2.tsx` (4 changes)
- `apps/web/src/lib/tps/fieldArbiter.ts` (1 change)
- `STATUS.md`, `CHANGELOG.md`, `HANDOFF.md` (session docs — required by `.githooks/pre-commit`)
- `scripts/wizard-simulation-test.mjs` (regression script; runs against any base URL)
- `reports/booklet-stability-20260525-*` (10 stability run directories from this session)
- `daily-briefing-2026-05-25.md` (USCIS policy monitor — H.R.1 IFR effective 2026-05-29)

### Verification done
- `pnpm typecheck` clean.
- `pnpm test` 1985/1985 green in 12s.
- Diff is 17 lines code + 3 doc files.

### Verification NOT done (deliberately deferred)
- No browser-level Step 5 walk-through. Honest definition of done says "screenshot + PDF byte-grep". I did not run Playwright. The fix is structurally correct and tested at unit + typecheck level. The proper E2E gate is queued for next session.
- No run against prod URL yet (push hasn't happened in this session — see "What is NOT done").

## What is NOT done

### Did not push
The commit is staged-ready locally. I have not run `git add && git commit && git push`. The diff is preserved by git; next session picks up with:
```
cd /Users/sergiiredacted/work/uscis-helper
git add apps/web/src/app/\[locale\]/services/tps-ukraine/start/TPSWizardV2.tsx \
        apps/web/src/lib/tps/fieldArbiter.ts \
        STATUS.md HANDOFF.md CHANGELOG.md \
        scripts/wizard-simulation-test.mjs \
        reports/booklet-stability-20260525-* \
        daily-briefing-2026-05-25.md
git commit -m "fix: client-side BOOKLET_WAVE1_FIELDS drift — family_name reaches PDF for booklet-only TPS users

Server contract already allowed family_name (ce12446). Client had three
independent filters still on wave1=3-field set, silently dropping the
field. Adds family_name to BOOKLET_WAVE1_FIELDS, adds missing
SLOT_ALLOWED_FIELDS.booklet entry, extends ExtractionSource/SourceType
unions to include dual_ocr_crossref.

Diff: 17 lines code + 3 session docs.
Tests: 1985/1985. Typecheck clean.
Not yet E2E verified — Playwright + PDF byte-grep queued for next session."
git push origin main
```

### Did not build the real integration gate
The predecessor's `scripts/wizard-simulation-test.mjs` is a regression script for the API contract. It hardcodes the wave1 set as a constant. **It does not actually load `BOOKLET_WAVE1_FIELDS` from the .tsx file at runtime, so it cannot catch the next drift between server contract and client filters.** That is the gap. Next session has to write the gate that does.

## What must happen next (in order)

### 1. Push
Commit + push. Verify Vercel deploy READY. Run `node scripts/wizard-simulation-test.mjs https://messenginfo.com` against prod — confirms API still delivers 4 fields (regression check).

### 2. Build the real integration gate
Write `scripts/check-booklet-contract-drift.mjs` that:
- Imports `documentContracts.booklet.allowed_fields` from server source.
- Greps `BOOKLET_WAVE1_FIELDS` and `SLOT_ALLOWED_FIELDS.booklet` literals out of `TPSWizardV2.tsx` (or refactors them into shared module first).
- Asserts the three sets are equal.
- Exits non-zero on mismatch.
Wire into `package.json` scripts as `lint:contract` and add to CI workflow. This catches the bug pattern that hit Session 17.

### 3. Consolidate to single source of truth
Refactor so the three client filters all derive from one constant exported from `apps/web/src/lib/tps/ocr/documentContracts.ts` (or a sibling). After this, the gate from step 2 collapses to a typecheck — drift becomes structurally impossible.

### 4. Multi-sample booklet benchmark
The real Phase 0 gap the predecessor correctly identified. Need 3-5 real booklets from other Ukrainian TPS holders (PII — handle per `qa-shots/private/` rules). Without this, every "production-stable" claim is on a one-sample benchmark.

### 5. Open product question — booklet-only `given_name` and `dob`
For booklet-only TPS users these are critical fields still on the server `forbidden_fields` list. Relaxing them requires multi-sample benchmark proof that dual-OCR crossref handles them. **Do not relax before evidence**. Memory rule: "до любой рекомендации — анализ, реальная оценка, явное указание того, чего я не знаю."

## Unrelated but on the clock

`daily-briefing-2026-05-25.md` flags **H.R.1 IFR effective 2026-05-29** — TPS EAD capped at 1 year, no auto-extension, fee non-waivable. That is **4 days from now**. Affects TPS section copy, fee guidance, I-765 instructions. Not a pipeline change — content/legal copy. Schedule before the rule goes live or users will see stale guidance. Same briefing flags adjustment-of-status restriction (PM-602-0199, effective 2026-05-21) and signatures rule (effective 2026-07-10).

## Why session 17's "production verified" was wrong (for the record)
"10/10 stable on canonical dataset, surname=REDACTED, crossref_ok, latency=15.3s on messenginfo.com" — true at the OCR API boundary. Not true at the user boundary. The session declared success on `curl` output and committed before walking a wizard. The cost: 0 (caught in the same session before propagation). The lesson: API success and user success are different invariants. New definition of done is enforced in `STATUS.md`.
