> ⭐ **ONE BRAIN — READ FIRST:** Architecture in `docs/architecture/ONE_BRAIN_DECISION.md`. **B1 LIVE**: TPS uses Core. **B2 CODE READY** (PR #70): Translation uses Core. **B3 UI WIRED** (PR #72): Re-Parole calls Core route. **B4 CODE READY** (feat/b4-ead-core, PR open): EAD adapter + route. **ONE_BRAIN_COMPLETE_CODE_READY** — all 4 products wired. Not live until flags enabled + smoke test.
>
> 📋 **DOCUMENT CLASS POLICY WIRED (POLICY_WIRED):** Guards live in `tps/ocr/extract` + `translation/vision-extract`. checkImageQuality blocks tiny images before OCR call. applyHardCaseReviewOverride forces review_required=true on hard-case docs. applyCertificateRoleGuard rejects generic names on certs. 2565 tests passing, tsc 0.

# HANDOFF — Session 96 (2026-06-03)

## Session 96 — B4: EAD consumes CanonicalDocumentResult (ONE_BRAIN_COMPLETE_CODE_READY)

**What was done:**
- Created `apps/web/src/lib/canonical/core/eadAdapter.ts`: pure `toEadAnswers()` adapter — no OCR, no Gemini, no API calls; source-gated field mapping canonical → EadCoreAnswers
  - Identity fields: mapped from any document
  - EAD/USCIS fields (a_number, ead_category, uscis_number, card_number, ead_validity_*): **null unless source is ead_card/i766/i797/uscis_notice/us_ead**
  - I-94 fields (i94_admission_number, i94_date_of_entry, i94_class_of_admission, i94_place_of_entry): **null unless source is i94/us_i94/arrival_departure_record**
  - us_address: **null unless source is drivers_license/dl/state_id** (never inferred from passport)
  - invented_fields_count: always 0 (hard-coded, compile-time type `0`)
- Created `apps/web/src/app/api/ead/ocr/extract/route.ts`: new EAD OCR route behind `ONE_CORE_EAD_ENABLED=true` flag (default: false); same pattern as B3 Re-Parole route
- Created `apps/web/src/lib/canonical/core/__tests__/eadAdapter.test.ts`: 74 tests — all green
  - Passport-only proof case: all 11 gated fields are null ✅
  - EAD source: a_number, ead_category, card_number, ead_validity_* mapped ✅
  - I-94 source: i94_* fields mapped ✅
  - DL source: us_address mapped ✅
  - invented_fields_count: 0 in all cases ✅

**What was NOT done:**
- `ONE_CORE_EAD_ENABLED=true` NOT set in Vercel (owner decision)
- `NEXT_PUBLIC_ONE_CORE_EAD_ENABLED` — EAD wizard (EADWizard.tsx) is currently client-side only (no existing OCR path in it); the new `/api/ead/ocr/extract` route is the new Core path when enabled
- ONE_BRAIN_FINAL_SMOKE_TEST (all 4 products live simultaneously)
- Certificate ground truth (owner responsibility)

**Architecture:**
- Flag OFF (default): `/api/ead/ocr/extract` returns 503 — EAD wizard unaffected (it had no OCR before)
- Flag ON: image → readDocument → arbitrateDocument → toEadAnswers → EadCoreAnswers JSON
- Source gates strictly enforced in adapter (no runtime checks needed — logic self-contained)

**To go live (owner):**
1. Set `ONE_CORE_EAD_ENABLED=true` in Vercel
2. Merge PR feat/b4-ead-core
3. EAD wizard integration: wire Step 2 (personal info) to call `/api/ead/ocr/extract` with passport upload
4. ONE_BRAIN_FINAL_SMOKE_TEST: TPS + Translation + Re-Parole + EAD on real passport

**Evidence:** 74 new adapter tests + 2565/2565 full suite passing; tsc 0

# HANDOFF — Session 95c (2026-06-03)

## Session 95c — B3 UI WIRING: Re-Parole wizard calls Core route behind flag

**What was done:**
- Modified `apps/web/src/app/[locale]/services/re-parole-u4u/start/ReparoleWizardV2.tsx`:
  - Added `REPAROLE_CORE_ENABLED` constant from `NEXT_PUBLIC_ONE_CORE_REPAROLE_ENABLED` env var
  - Added `CORE_COVERED_SLOTS = new Set(['passport', 'booklet'])` (US slots always use old path)
  - Changed `handleUpload`: OCR route selected by flag AND slot coverage
  - When flag ON + passport/booklet: calls `/api/reparole/ocr/extract`, parses `ReParoleCoreAnswers` shape
  - When flag OFF OR i94/ead/dl: calls `/api/tps/ocr/extract` (old path, unchanged)
  - `date_of_birth` (Core key) → `dob` (wizard key) aliased in CORE_FIELD_MAP
  - `review_required` and `uncertain_fields` from Core response drive `requires_review` per field
  - I-94 fields: null → not added to fields object (not invented)
- Created `apps/web/src/app/api/reparole/ocr/extract/__tests__/uiWiring.test.ts`:
  - 8 source-level wiring tests (flag constant, CORE_COVERED_SLOTS, route selection, response shape)
  - 4 functional response parsing tests (Core shape mapping, review_required, i94 null, fallback_used)
  - 12 total new tests, all passing

**What was NOT done:**
- `NEXT_PUBLIC_ONE_CORE_REPAROLE_ENABLED=true` NOT set in Vercel (owner decision)
- EAD → Core (B4) — not done
- ONE_CORE_REPAROLE_ENABLED (server-side, for the route itself) still needs owner to enable separately
- i94/ead/dl slots not yet wired to Core (Core doesn't cover them)

**Architecture:**
- Flag OFF (default): wizard → `/api/tps/ocr/extract` — byte-for-byte identical to before
- Flag ON, slot passport/booklet: wizard → `/api/reparole/ocr/extract` → Core → `ReParoleCoreAnswers`
- Flag ON, slot i94/ead/dl: wizard → `/api/tps/ocr/extract` (Core fallback, unchanged)
- Response parsing: Core JSON top-level fields → wizard `FieldExtraction` records
- Backend route also gated by `ONE_CORE_REPAROLE_ENABLED` (server-side, separate from frontend flag)

**To go live (owner):**
1. Set `NEXT_PUBLIC_ONE_CORE_REPAROLE_ENABLED=true` in Vercel (client-side flag)
2. Set `ONE_CORE_REPAROLE_ENABLED=true` in Vercel (server-side flag for the route)
3. Merge PR #72 and deploy
4. Upload passport in Re-Parole wizard → should call `/api/reparole/ocr/extract`
5. Verify `family_name`/`given_name`/`dob` populated in form

**Next task:** B4 — EAD → Core

**Evidence:** 12 new tests passing, full suite 2503 passing, tsc 0

# HANDOFF — Session 95 (2026-06-03)

## Session 95 — B3: Re-Parole consumes CanonicalDocumentResult (ONE_BRAIN_PARTIAL_3_PRODUCTS)

**What was done:**
- Created `canonical/core/reParoleAdapter.ts`: pure `toReParoleCoreAnswers()` function — no OCR, no Gemini, no API calls inside; pure field mapping canonical → ReParoleCoreAnswers
- Created `app/api/reparole/ocr/extract/route.ts`: new dedicated Re-Parole OCR route behind `ONE_CORE_REPAROLE_ENABLED=true` flag (default: false)
- Created 29 adapter tests in `canonical/core/__tests__/reParoleAdapter.test.ts`: identity mapping, I-94 non-invention, review_required propagation, uncertain_fields, core_status, adapter purity
- All 29 tests pass; full suite 2491/2491; tsc 0 errors

**What was NOT done:**
- `ONE_CORE_REPAROLE_ENABLED=true` NOT set in Vercel (owner decision)
- EAD → Core (B4) — not done
- Certificate ground truth
- UI changes (Re-Parole wizard still calls `/api/tps/ocr/extract`)

**Architecture:**
- Re-Parole wizard calls `/api/tps/ocr/extract` for OCR (unchanged)
- New route `/api/reparole/ocr/extract` is Core-first when flag=true; returns `ReParoleCoreAnswers`
- Old path completely unchanged when flag=false
- Adapter: `CanonicalDocumentResult.fields[]` → `ReParoleCoreAnswers` (field-key lookup, no invention)
- Fields: family_name, given_name, dob (alias dob), sex, passport_number, country_of_birth/nationality, date_of_expiry, i94_admission_number, last_entry_date, i94_class_of_admission, a_number
- I-94 fields stay null for passport source (no invention)

**Next task:**
1. Owner merges PR #70 (B2 Translation) and enables `ONE_BRAIN_CORE_ENABLED=1`
2. Owner enables `ONE_CORE_REPAROLE_ENABLED=true` when ready to test Re-Parole Core path
3. B4: EAD → Core to complete ONE_BRAIN

**Evidence:** 29 tests passing, full suite 2491 passing, tsc 0

# HANDOFF — Session 93 (2026-06-03)

## Session 93 — B0 verification + B1: TPS → Core behind flag (branch feat/b1-tps-core-flag)

**B0 verified (partial):** PR #67 SHA `1c0261c` in prod (healthz confirmed). Gemini key `GEMINI_API_KEY2` resolves via `getGeminiApiKey()`. Route responds with JSON (not crash). Synthetic 1×1 JPEG test returns `vision_failed:HTTP 400` — expected (blank image). Real document: UNVERIFIED (no test document available). `CENTRAL_BRAIN_TRANSLATION=on` causes every request to degrade (all fields `review_required=true`) — known issue, not blocking.

**B0 mistake found and fixed:** `ONE_BRAIN_CORE_ENABLED=1` was set too early (before real-doc verification) → added 2× Gemini calls → Cloudflare timeout. Removed immediately.

**B1 implementation (this PR):**
- `TpsExtractionSource` gets new value `'canonical_core'` (types.ts)
- New `canonical/core/tpsAdapter.ts`: `mapTpsHintToDocintelId` (passport→ua_international_passport, booklet→ua_internal_passport_booklet, US forms→null), `canonicalFieldToTpsField`, `canonicalToTpsModuleResult`
- TPS `/api/tps/ocr/extract` route: adds `ONE_CORE_TPS_ENABLED=1` path BEFORE existing switch. If Core returns fields → uses them. If Core fails/returns nothing → old switch path runs unchanged. Response includes `core_status` field for diagnostics.
- US form slots (i94/ead/dl/i797): `core_status='skipped_no_mapping'`, old path runs
- Architecture correct: TPS → Core → arbitration → toTPSAnswers → existing contract/normalize pipeline

**Evidence:** `tpsAdapter.test.ts` 12/12. Full web 2407 pass. tsc 0.

**PROOF NEEDED before declaring B1 done:**
1. Set `ONE_CORE_TPS_ENABLED=1` in Vercel
2. Upload real Ukrainian passport (booklet or international) to TPS wizard
3. Check response: `core_status: 'ok'`, `final_field_keys` populated, `critical_wrong_count = 0`
4. Compare with Translation result on same document: same `family_name`, `given_name`, etc.
5. Gate: critical fields must not be wrong, uncertain → `review_required`

**What is NOT done:**
- MRZ injection into Core (passport MRZ fields not yet wired into Core readers)
- Re-Parole, EAD not migrated (separate PRs after B1 proven)
- Translation not yet sharing same Core path as TPS (B2)
- `CENTRAL_BRAIN_TRANSLATION` degrading Translation — investigate why Vision API fails

---

# HANDOFF — Session 92 (2026-06-02)

## Session 92 — Core field-vocab fixes + review carry-through + Translation wiring (branch feat/core-wire-translation)

**Three real-data bugs fixed** (found during Session 91 real-document testing):

**(1) `criticalityOf('dob')` returned 'low'** — Gemini docintel emits `dob`, not `date_of_birth`. Core treated date of birth as low-criticality and could auto-fill without review. Fix: `dob` added as critical alias. Birth-cert child fields also added as critical.

**(2) Reader `review_required` silently dropped** — `FieldCandidate` had no `reviewRequired` field. Docintel flags (blurry handwriting) were discarded by the Core. Fix: field added to type; `arbitrateField` carries the signal as `reader_review_required`.

**(3) Core wired to Translation** — First live wiring via `canonical/core/translationAdapter.ts` + `ONE_BRAIN_CORE_ENABLED=1` path in `vision-extract/route.ts`. Flag OFF = byte-for-byte identical to legacy. Logs `[ONE_BRAIN_CORE] arbitrated N fields`.

**Evidence:** `coreFixes.test.ts` 12/12. Full web 2389 pass, tsc 0.

**Gate:** PR pending. Owner action needed: (1) merge PR #67, (2) merge this PR, (3) set `ONE_BRAIN_CORE_ENABLED=1` in Vercel.

**Next:** provide real documents + ground truth → reader benchmark → wire Core to TPS.

---

# HANDOFF — Session 91 (2026-05-31)

## Session 91 — PROD HOTFIX: Gemini key name mismatch + recognition root cause (branch `fix/gemini-key-066-name`, off main)

**Root cause of "ничего не распознаётся" found + verified.** Prod `/api/translation/vision-extract` returns **502** on real Ukrainian documents (Vercel logs confirm). The code reads the Gemini key ONLY from `GEMINI_API_KEY_PAY` / `GEMINI_API_KEY` (`vision-extract/route.ts:109`, `geminiVisionProvider.ts:99`). The owner uploaded the WORKING key to Vercel under the name **`GEMINI_API_KEY_066`** → the app never reads it → it uses the old dead/restricted key → central-brain consensus Gemini call fails / reads 0 fields → the route returns **502 by design** (`route.ts:130`: `status: fields.length ? 200 : 502`).

**Fix (this PR):** new `apps/web/src/lib/gemini/apiKey.ts` `getGeminiApiKey()` resolves the key from ANY `GEMINI_API_KEY*` env name (the owner kept renaming: `GEMINI_API_KEY_066` → `GEMINI_API_KEY2` → …; suffixed names preferred over the bare `GEMINI_API_KEY`). Wired into both `vision-extract/route.ts` and `geminiVisionProvider.ts`. **Verified end-to-end:** with the local var named exactly `GEMINI_API_KEY2` (mirroring Vercel), `readDocument` reads the real booklet correctly (ok=true, 4 fields). `apiKey.test.ts` 6/6, tsc 0, full web 2383 pass, guard 0. This ends the name-mismatch class of failure for good.

**Proven on real data:** with the working key (set locally), a SINGLE Gemini read (`docintel.readDocument`) reads BOTH owner documents correctly — internal booklet (KUROPIATNYK / SERHII / 1986-06-25 / Vinnytsia Oblast, 25s) and birth cert (10 fields, 8.6s). The single read WORKS where the central-brain consensus returns 0 → 502. This directly validates the one-brain single-read Core as the fix.

**Two real-data bugs found for the Core** (next fixes, grounded not theoretical): (1) reader field-key vocabulary mismatch (Gemini emits `dob`, birth-cert keys like `child_family_name`) → Core's `criticalityOf` misses them → mis-criticalized; (2) the reader's `review_required` is not carried into the Core candidate → Core under-flagged the birth cert. Fix = a reader→canonical key normalizer + carry `review_required` into the candidate.

**Local key:** the owner's temporary key is in `apps/web/.env.local` (gitignored, NOT committed); owner will rotate it. Local 403 on the previous key was because it was IP/referrer-restricted to Vercel.

**Instant owner option (no merge needed):** in Vercel rename `GEMINI_API_KEY_066` → `GEMINI_API_KEY_PAY` (and optionally set `CENTRAL_BRAIN_TRANSLATION` off → uses the proven legacy single-read path) → prod recognition works immediately.

**Also fixed `route.ts:130` (same PR):** when central-brain consensus reads 0 fields, the route now DEGRADES to the legacy single-read path (which uses the same key resolver and is proven to read real docs) instead of returning a hard 502. So merging #67 makes prod recognition work even if central-brain yields nothing. tsc 0, full web 2383 pass.

**Gate:** PR #67 not merged (manual approval). After merge, prod recognition should work (reads GEMINI_API_KEY2 + degrades instead of 502).

---

# HANDOFF — Session 89 (2026-05-30)

## Session 89 — Reader-benchmark harness (branch `feat/reader-benchmark`, off main; #64 merged)

Merged #64 (one-brain v1 spine, foundation). Built the reader-benchmark instrument the owner asked for: compare **old TPS reader / old Translation (docintel) / MRZ parser / new Document Core** against a hand-filled ground truth; metric = `critical_wrong_count` (must be 0; coverage secondary). Built against VERIFIED real signatures (3 parallel agents confirmed `readDocument`, `parseTd3` + per-field `checkResults`, `preprocessImage`).

New `apps/web/src/lib/canonical/core/benchmark/`:
- `passportTruth.ts` — the owner's flat passport ground-truth schema (latin+cyrillic split: family/given/patronymic _latin/_cyrillic, dob, sex, passport_number, expiry_date, citizenship, place_of_birth_raw/english, province) + criticality + `passportTruthToGroundTruth` (empty fields excluded).
- `mappers.ts` — `mapMrz`/`mapTranslation`/`mapTps`/`mapCore`: each reader's NATIVE output → common `ProducedField[]` keyed to the truth fields (MRZ "D Month YYYY"→ISO, per-field check-digit→review; docintel value→latin + raw_cyrillic→cyrillic; TPS/Core normalized_value→latin). MRZ has no Cyrillic/patronymic/place by design (shows its gap).
- `runReaderBenchmark.ts` — scores all readers vs one truth → side-by-side `critical_wrong`/`coverage` + PII-free `summarizeBenchmark`.
- updated `core/groundTruth.example.json` to the owner's flat schema.

**Evidence:** `core/__tests__/benchmark.test.ts` 7/7 (+ spine core.test 16/16). Full web 2377 pass, tsc 0, content-guard 0.

**BUILT:** the reader-benchmark scorer + mappers + runner (pure, tested with synthetic reader outputs).
**NOT LIVE / NOT DONE:** no product migrated, no flags. The harness scores PROVIDED reader outputs — it does NOT yet call the live engines.
**NEEDS REAL INPUT:** (1) owner fills `groundTruth.example.json` from a real passport (and a booklet); (2) a small live runner that calls Gemini `readDocument` + `parseTd3` + the TPS route on that real image to PRODUCE the four outputs to feed the benchmark (needs GEMINI_API_KEY_PAY + a real doc). Then we get the actual `critical_wrong_count` per reader.

**Gate:** product route migration = explicit owner approval only. PR for this = NOT merged (manual approval).

---

# HANDOFF — Session 88 (2026-05-30)

## Session 88 — One Brain v1 spine: Document Core (branch `feat/one-brain-v1-spine`, off main)

Built the v1 spine of the single Document Core per `docs/architecture/ONE_BRAIN_DECISION.md` (owner-approved). New `apps/web/src/lib/canonical/core/`:
- `arbitration.ts` — the Core's judge (minimal authority policy): valid MRZ controls passport fields; **invalid MRZ → review** (not silent fallback); critical field with **no MRZ anchor → review**; material conflict on critical/high → review; fuzzy → review; **no candidate → no field**. Reuses `policy.ts` (criticalityOf/materiallyDifferent/sourceRank).
- `readDocumentCore.ts` — the one entrypoint: quality gate → visual read (Gemini, injected) → MRZ read if passport → minimal arbitration → one `CanonicalDocumentResult`, or `needs_better_photo` (never garbage). Readers injected (testable; real OCR wiring is a thin call later).
- `benchmark.ts` — scorer vs hand-verified ground truth; locked metric `critical_wrong_count` (critical field auto-filled wrong & not review-flagged → must be 0). `parseGroundTruth`.
- `groundTruth.example.json` — the format the owner fills by reading a real document.

**Evidence:** `core/__tests__/core.test.ts` 16/16. Full web 2370 pass, tsc 0, content-guard 0.

**What is BUILT:** the Core spine (arbitration + entrypoint + benchmark + ground-truth format), pure + tested.
**What is NOT live:** nothing consumes the Core — no product migrated, no flags, no UI/payment touched. "One brain" is NOT done (done only when a product consumes Core in production).
**What requires real input:** owner-provided real documents (≥1 passport with MRZ, ≥1 internal booklet) + hand-verified ground truth → reader benchmark → derive empirical knobs → core benchmark → THEN (with approval) migrate the first product.

**Next (needs owner):** provide real documents/ground truth, OR approve the reader-benchmark wiring (calling the real Gemini docintel + MRZ reader on a real doc). Product route migration = manual approval only.

---

# HANDOFF — Session 87 (2026-05-30)

## Session 87 — Legal Copy Freeze (branch `feat/legal-copy-freeze`, off main)

Compliance guard. `apps/web/src/lib/translation/__tests__/legalCopyFreeze.test.ts` pins the 8 CFR §103.2(b)(3) certification legal text: `CERTIFICATION_VERSION === 'v1.0-8cfr-2026'` + `sha256(CERTIFICATION_STATEMENT)` to a known hash. Any silent edit to the signed legal text fails the build, with a message instructing: write an ADR, bump the version, update the pin. Also asserts the statement still cites the regulation. Test-only, zero runtime impact.

**Evidence:** `legalCopyFreeze.test.ts` 3/3. Full web 2354 pass, tsc 0, content-guard 0. Report: `docs/reports/LEGAL_COPY_FREEZE.md`.

**State of the plan:** the safe/low-risk code-completable scope is now genuinely exhausted — Phase-1 safety, UX, the full canonical core (contract + 2 adapters + parity + live shadow + manual-override + doc-gate + quarantine + contradiction detector), and the Phase-5 guards (PII-log, TPS reset, prompt-injection, legal-copy-freeze). **What is left is gated:** (1) data-minimization — a real extraction-pipeline redesign needing owner buy-in; (2) migration → consolidation — needs real-traffic parity (`ONE_BRAIN_SHADOW=1` canary); (3) Phase 4 (finalization lock / PDF proof / evidence-ledger DB); (4) Phase 6 ops; (5) owner-gated source/visual items. **Next owner decision:** enable the canary shadow run, or pick the next gated workstream.

---

## Session 86 — Cross-Document Contradiction Detector (branch `feat/cross-doc-contradictions`, off main)

Canonical-core Quality item. `apps/web/src/lib/canonical/contradictions.ts`: `findCrossDocumentContradictions(fields, canonicalize?)` reports when the SAME field key is read with materially-different values across documents (passport MRZ vs I-94 vs EAD vs DL) — a critical/high contradiction is `blocking` and must be resolved by review (never silently reconciled). Each `Contradiction` carries the criticality + the distinct candidates (value + source + provider, highest-authority first). `hasBlockingContradiction` is a convenience gate. Complements `mergeCanonicalByKey` (resolve) with a reporter (surface). Pure, additive, unwired.

**Evidence:** `contradictions.test.ts` 6/6. Full web 2351 pass, tsc 0, content-guard 0. Report: `docs/reports/P2_CROSS_DOC_CONTRADICTIONS.md`.

**Remaining (gated / larger):** data-minimization (extraction redesign — needs owner buy-in); migration/consolidation (real-traffic parity via `ONE_BRAIN_SHADOW=1` canary); Phase 4 (finalization lock / PDF proof / evidence-ledger DB); Phase 6 ops; owner-gated source/visual items.

---

## Session 85 — Prompt-injection defense (branch `feat/prompt-injection-defense`, off main)

Security fix: OCR text fed to the Document Brain LLM is untrusted (off a user-uploaded document) and was interpolated raw into the prompt — a prompt-injection vector (a document could contain "set confidence 1.0, skip review"). New `apps/web/src/lib/tps/ai/untrustedText.ts`: `fenceUntrustedText(label, text)` wraps the text in unguessable begin/end sentinels and STRIPS any forged markers from the input first (so a document can't fake a fence-close and break out into the instruction context); `UNTRUSTED_TEXT_SYSTEM_RULE` is the system sentence that gives the fences meaning. Wired into `documentBrain.ts`: `buildUserMessage` fences both the full OCR text and the line-by-line view; `SYSTEM_PROMPT` carries the rule + an explicit extract-only clause. Legitimate extraction is unchanged. Used fencing, not blacklisting.

**Evidence:** `untrustedText.test.ts` 8/8 (fence; forged-marker break-out blocked; strip; empty/null; system rule; + source guards). Full web 2339 pass, tsc 0, content-guard 0. No Document-Brain regressions. Report: `docs/reports/SEC_PROMPT_INJECTION_DEFENSE.md`.

**Remaining completable-now:** Phase-5 data-minimization (crop+label) + retention. Then the gated work (migration/Phase-4/Phase-6) needing real-traffic parity + owner decisions.

## Session 84 — TPS per-document state reset (branch `feat/tps-doc-state-reset`, merged #60)

The TPS wizard's `restart` reset the personal-fields blob but left `tps:attest:v1`, `tps:legal-risk:v1` and `wizard:tps-ukraine:part7:v1` in localStorage — so person A's attestation + legal-risk answers carried into person B's packet. New `apps/web/src/lib/tps/documentState.ts` (`clearTpsDocumentState`) removes the three per-document keys; wired into `restart`. Same-document page refresh unaffected. `documentState.test.ts` 4/4; full web 2335 pass; tsc 0; guard 0. Report: `docs/reports/TPS_DOC_STATE_RESET.md`.

## Session 83 — Phase-5 PII-redaction CI guard (branch `feat/pii-log-guard`, merged #59)

`apps/web/src/lib/security/__tests__/noPiiLogging.test.ts` fails the build if any source `console.*` interpolates a PII value. Walks all src .ts(x), reports file:line, self-tests a planted leak. Codebase audited clean. `noPiiLogging.test.ts` 2/2; full web 2333 pass; tsc 0; guard 0. Report: `docs/reports/P5_PII_LOG_GUARD.md`.

---

## Session 82 — Doc-Type Confidence Gate + Provider Output Quarantine (branch `feat/canonical-doc-gate`, off main)

Two more canonical-core policy items. `apps/web/src/lib/canonical/documentGate.ts`: `applyDocumentTypeGate(doc, docTypeConfidence, {threshold=0.7})` — below threshold (we're not confident WHAT the document is / unknown page) it forces every field to `reviewRequired` with reason `unknown_document_type` and sets `requiresReview` (a confident value on an unknown page is a lie); at/above threshold it returns the result unchanged; idempotent. `partitionQuarantine(doc)` → `{accepted, quarantined}` — accepted = needs-no-review fields (safe to auto-use), quarantined = candidates still needing confirmation; after a failed gate, `accepted` is empty. Pure, additive, unwired.

**Evidence:** `documentGate.test.ts` 6/6. Full web 2331 pass, tsc 0, content-guard 0. Report: `docs/reports/P2_DOCTYPE_GATE_QUARANTINE.md`.

**Canonical core is now fully contract-complete:** types + policy + TPS adapter + Translation adapter + parity diff + live shadow + manual override + doc-type gate + quarantine — all additive, tested, unwired. The remaining plan work is genuinely gated and NOT code-deferrable-now: (1) collect real-traffic parity (`ONE_BRAIN_SHADOW=1` canary) → parity threshold → per-product migration behind the flag → consolidation (remove the 2nd brain); (2) Phase 4 finalization-lock / two-layer PDF proof / evidence-ledger DB table; (3) Phase 6 ops (review queue, metrics, status board) — last; (4) owner-gated (official military/diploma/pension URLs, КАТОТТГ byte-verify, birth-cert visual approval, live rotated-photo).

---

# HANDOFF — Session 81 (2026-05-30)

## Session 80 — Live ONE_BRAIN_SHADOW wiring in TPS route (branch `feat/canonical-shadow-wiring`, merged #56)

The first LIVE wiring of the canonical core — observe-only, default OFF. New pure helper `apps/web/src/lib/canonical/liveShadow.ts` (`summarizeTpsReviewShift`) builds the canonical from the SAME live `TpsExtractedField[]` and returns a PII-free one-line review-shift summary (`+review[keys]` the canonical adds, `-review` always 0 by the never-lower-a-flag invariant). The TPS extract route logs `[ONE_BRAIN_SHADOW] <summary>` just before the main success return, guarded by `if (mergedModule && isShadowEnabled())` AND `try/catch` — never throws into the response, never runs unless the flag is on. With `ONE_BRAIN_SHADOW` unset, extraction is byte-for-byte unchanged. Evidence: `liveShadow.test.ts` 4/4 + `shadowWiring.test.ts` 3/3; full web 2320 pass; tsc 0; guard 0. Report: `docs/reports/P2_3W_LIVE_SHADOW_WIRING.md`.

## Session 81 — Manual Override Contract (branch `feat/canonical-manual-override`, off main)

Completes the canonical-core contract surface. `apps/web/src/lib/canonical/manualOverride.ts`: `applyManualOverride(field, userValue)` is the Manual Override Contract (policy §D) — a user correction is the lowest-authority source, applied only on confirmation. It sets `normalizedValue` + `source='manual_user_entry'`, PRESERVES the prior machine value as an `evidence[]` entry (`provider:'pre_manual_override'`), records `rejectedReason` when it replaced a materially different value, clears `reviewRequired`/`reviewReasons` (the override IS the human confirmation — this resolves a critical field's mandatory review), and sets a user-confirmed confidence (final 1.0). Pure, additive, unwired.

**Evidence:** `manualOverride.test.ts` 5/5. Full web 2318 pass, tsc 0, content-guard 0. Report: `docs/reports/P2_MANUAL_OVERRIDE_CONTRACT.md`. (NB: the live shadow wiring is Session 80 / PR #56, merging separately; numbering interleaves.)

**Canonical core is now contract-complete:** types + policy + TPS adapter + Translation adapter + parity diff + live shadow + manual override — all additive, tested, unwired. **What remains is genuinely gated**, not code-deferrable: (1) collect real-traffic parity with `ONE_BRAIN_SHADOW=1` in a canary, then a parity threshold → controlled per-product migration behind the flag → consolidation (remove the 2nd brain); (2) Phase 4 finalization-lock / two-layer PDF proof / evidence-ledger DB table; (3) Phase 6 ops layer (review queue, metrics, status board) — sequenced LAST; (4) owner-gated items (official military/diploma/pension URLs, КАТОТТГ byte-verify, birth-cert visual approval, live rotated-photo). Document-Type Confidence Gate + Provider Output Quarantine remain as further canonical-core items.

---

## Session 79 — P2.2-translation adapter + cross-brain parity (branch `feat/canonical-adapter-translation`, off main)

The second half of the adapter. `apps/web/src/lib/canonical/adapterTranslation.ts`: `readCanonicalDocumentFromTranslation(input)` maps the Translation reader output (`ExtractedField[]`) into the SAME `CanonicalDocumentResult` shape using the P2.1 policy and the same two invariants. Source is inferred (Translation has no explicit source enum): `user_corrected`→`manual_user_entry`, MRZ `source_zone`→`mrz`, else `ai_vision` (ranked below document OCR — a vision guess must not outrank a labelled read). Honest confidence: ocr=provider, source_match only for an MRZ zone with a check-digit pass, unknown layers null. Reuses `mergeCanonicalByKey`.

**The payoff:** the test runs the first real two-brain measurement — build a TPS-canonical and a Translation-canonical for the same document and `diffCanonical` them: agreement → parityRate 1.0, criticalDisagreements 0; a `family_name` disagreement → disagree 1, criticalDisagreements 1 (surfaced, not silently reconciled).

**ADDITIVE / unwired — no behavior change.**

**Evidence:** `adapterTranslation.test.ts` 5/5 (incl. 2 cross-brain cases). Full web 2313 pass, tsc 0, content-guard 0. Report: `docs/reports/P2_2T_CANONICAL_ADAPTER_TRANSLATION.md`.

**Next per Master Plan:** live shadow wiring — behind `ONE_BRAIN_SHADOW=1`, run the canonical adapter alongside the live TPS/Translation extraction and `console.info(summarizeParity(...))` (observe-only, no output change) to collect real-traffic parity numbers; then a parity threshold → per-product migration behind the flag → consolidation (remove 2nd brain) → evidence-ledger table + hash chain.

---

## Session 78 — P2.3 Canonical shadow parity (branch `feat/canonical-shadow`, off main)

Phase 2 step 3: the instrument that settles the two-brain problem with numbers. `apps/web/src/lib/canonical/shadow.ts`: `diffCanonical(left, right, canonicalize?)` returns a `ParityReport` (per-key agree/disagree/left_only/right_only, `criticalDisagreements` for critical+high fields, `parityRate`) using the same `materiallyDifferent` comparator as the no-silent-correction rule; a present-on-both field where one side lacks a value counts as a real disagreement (not silently equal). `isShadowEnabled(env?)` reads `ONE_BRAIN_SHADOW` — only `1`/`true` enables, default OFF, gates LOGGING only (never output). `summarizeParity` is a PII-free one-liner (counts + disagreeing critical keys, never values).

**ADDITIVE / observe-only — unwired, no behavior change.**

**Evidence:** `canonical/__tests__/shadow.test.ts` 8/8. Full web 2308 pass, tsc 0, content-guard 0. Report: `docs/reports/P2_3_CANONICAL_SHADOW.md`.

**Next per Master Plan:** (1) a Translation-side adapter `readCanonicalDocumentFromTranslation` so BOTH stacks emit the same canonical shape — that pair is the actual input to `diffCanonical` (the real two-brain measurement); (2) live shadow wiring behind `ONE_BRAIN_SHADOW=1` (run canonical alongside the live path, `console.info(summarizeParity(...))`, observe-only) — owner-visible, held separate to stay additive; (3) parity threshold gate → per-product migration → consolidation (remove 2nd brain) → evidence-ledger table.

---

## Session 77 — P2.2 Canonical adapter (branch `feat/canonical-adapter`, off main)

Phase 2 step 2: `apps/web/src/lib/canonical/adapter.ts` — `readCanonicalDocumentFromTps(input)` maps the existing TPS reader output (`TpsExtractedField[]`) into one `CanonicalDocumentResult` using the P2.1 policy. `toCanonicalField` maps source→authority + derives split confidence honestly (ocr=provider confidence; source_match only where real — MRZ check digit 0.99 pass / 0.3 fail; field_match/normalization null = excluded from `final` min). `mergeCanonicalByKey` groups same-key readings (e.g. family_name from MRZ + EAD), keeps ALL candidates as evidence, picks highest-authority primary, forces review on material critical/high disagreement. Two invariants tested: (1) never lower a module's `review_required`; (2) never drop a candidate. Also renamed the result type's always-false `readyForReview` → `requiresReview` (added in #52, consumed by nothing).

**ADDITIVE — unwired, zero behavior change.**

**Evidence:** `canonical/__tests__/adapter.test.ts` 8/8. Full web 2300 pass, tsc 0, content-guard 0. Report: `docs/reports/P2_2_CANONICAL_ADAPTER.md`.

**Next per Master Plan:** P2.3 — `ONE_BRAIN_SHADOW` flag (default OFF) + run TPS through the adapter in shadow and emit a parity report; then a Translation-side adapter so both stacks produce the same canonical shape (the actual two-brain diff); then hash-chain + evidence ledger; then per-product migration behind the flag; then consolidation.

---

## Session 76e — P2.1 Canonical contract (branch `feat/canonical-contract`, off main)

First step of Phase 2 (the real fix for the two-brain problem): define ONE recognition output shape + ONE set of review rules, contract-first, before any migration. New `apps/web/src/lib/canonical/`: `types.ts` (`CanonicalDocumentResult`, `CanonicalField` with rawValue-always-preserved + split `FieldConfidence` + `evidence[]` + `reviewRequired`/reasons + hash chain) and `policy.ts` (pure rules grounded in the constitution docs): `computeFinalConfidence` (final ≤ min of applicable layers, null excluded, derived never provider-set), `criticalityOf`/`CRITICAL_FIELDS` (§B matrix), `materiallyDifferent` (no-silent-correction), `sourceRank`/`higherAuthority` (MRZ>...>manual), `resolveDisagreement` (material disagreement on critical/high → review, both retained), `decideReviewRequired` (combines all into {reviewRequired, reasons}). Codifies S1+S3 as general rules.

**ADDITIVE — imported by nothing in the live flow. Zero behavior change, zero risk to TPS/Translation/EAD/Re-Parole.**

**Evidence:** `canonical/__tests__/policy.test.ts` 16/16 (one per `FIELD_CONFIDENCE_AND_CRITICALITY_POLICY.md §F` bullet). Full web 2292 pass, tsc 0, content-guard 0. Report: `docs/reports/P2_1_CANONICAL_CONTRACT.md`.

**Next per Master Plan (Phase 2–3, sequenced):** P2.2 `readCanonicalDocument` adapter over the strongest existing reader (build a CanonicalDocumentResult from current extraction output, still unwired); P2.3 `ONE_BRAIN_SHADOW` flag + run TPS+Translation through the adapter in shadow, diff vs live, emit parity report (default OFF); then per-product migration behind the flag; then consolidation (remove the 2nd brain); then the evidence-ledger table. Hash-chain fields exist on the type but are not yet populated (P2.2+).

---

## Session 75 — UX wizard reset + Back/Start-over (branch `feat/wizard-reset-startover`, off main)

The user-facing complement to the session-isolation fix. The live-failure investigation showed a user could be stuck on a bad recognition with no clean recovery: the review screen (5) had no top Back button and there was no full "Start over" except on success. Added: a top **Back** (→ re-upload screen 3) and a **Start over** button on screen 5; a new `startOver` that confirms data loss, resets, and returns to doc-type (2). Strengthened the existing `resetAll` to clear EVERY piece of session state — it previously left `certifierAddress`/`dataReviewed`/`accuracyAttested`/`procStep`/`stripeCheckoutId` and the persisted `tw:cs` checkout id behind, so a "reset" could inherit stale data; now it also removes both `tw:v2:draft` and `tw:cs`. i18n strings added to RU base + EN override (UK/ES fall back to RU). The success-screen "Translate another" (`s7_restart`) already called `resetAll` and benefits from the fuller reset.

**Evidence:** `wizardResetStartOver.test.ts` 4/4 (source-level, same node-env style as sessionIsolation.test). Full web 2276 pass, tsc 0, content-guard 0. Report: `docs/reports/UX_WIZARD_RESET_STARTOVER.md`.

**Remaining (written):** `window.confirm` is unstyled (later modal polish); UK/ES show RU "Start over" copy via fallback (trivial follow-up); source-level test locks wiring not pixels.

**Next per Master Plan:** Phase 2 — CanonicalDocumentResult + CanonicalField types (contract-first; the path to one recognition brain). Phase-1 safety (S1+S2+S3) and this UX item are done.

---

## Session 74 — S3 Name No-Silent-Recase (branch `fix/name-no-silent-recase`, off main)

Third safety item. Audited all five S3 categories (name/patronymic/authority/date/series). Four already preserve raw + flag `review_required=true` on uncertainty (verified by reading `reconcilePatronymic`, `normalizeAuthority` normalize.ts:146, `normalizeDate` normalize.ts:95, `validatePassportPerforation`). Only NAME still silently mutated: the EAD + passport modules built `normalized_value` with a naive `s[0] + s.slice(1).toLowerCase()` and `review_required:false`, corrupting the controlling Latin spelling — `O'BRIEN→O'brien`, `PETRENKO-VASYL→Petrenko-vasyl`, `VAN DER BERG→Van der berg` (EAD never split on spaces), `McDonald→Mcdonald`.

Fix: new shared `formatLatinName` (`packages/knowledge/src/formatName.ts`, exported from index) — preserves a deliberately mixed-case read; for all-caps/all-lower reads title-cases each alphabetic segment (`\p{L}+` splits on space/hyphen/apostrophe) so each part keeps its initial capital. Wired into `ead.ts` (family+given) and `passport.ts` (family+given), replacing the naive casts. `raw_value` and the passport MRZ-gated `review_required` are unchanged — this fixes the value corruption itself.

**Evidence:** `nameNoSilentRecase.test.ts` 6/6 — O'Brien, hyphenated, multi-word, mixed-case preserved, all-caps no-regression, trim/empty. Full web 2272 pass, tsc 0, content-guard 0. Report: `docs/reports/S3_NAME_NO_SILENT_RECASE.md`.

**Remaining (written):** all-caps "MCDONALD" → "Mcdonald" residual (internal capital unrecoverable from caps; raw preserved for the reviewer; surname-particle dictionary out of scope). Translation stack renders names via its own path; if a name cast is later found there, reuse `formatLatinName`. Master Plan tracker (PR #47) to update: S3 → [x] with this PR#.

**Next per Master Plan:** Phase-1 safety (S1+S2+S3) complete — move to UX (Translation wizard reset + Back/Start-over), then the CanonicalDocumentResult contract (Phase 2).

---

# HANDOFF — Session 73 (2026-05-30)

## Session 73 — S2 Audit Persistence Hard-Fail (branch `fix/audit-persist-hard-fail`, off main)

Second safety item from the Master Plan. `generate-pdf` was persisting the order + the 8 CFR §103.2(b)(3) certification attestation best-effort, then returning HTTP 200 + the signed PDF **even when that write failed** — a signed translation with no audit record (a compliance gap, previously tracked `[~]`). New testable helper `apps/web/src/lib/translation/persistCertification.ts` inserts both rows with one retry each (transient-blip tolerance) and returns `{ok, orderErr, auditErr}`, `ok` true only if BOTH stored. The route now, on `!ok`: (1) emits the full signed attestation as a structured `AUDIT_RECONCILE` log line so a signed record is never lost, (2) fails closed — **503, no PDF, no email**. The user already paid + signed; payment is an idempotent Stripe session so a retry does not re-charge (response says so).

**Evidence:** `persistCertification.test.ts` 5/5 — audit-fail-after-retry → ok=false; transient → recovers; thrown error → ok=false; order-fail → ok=false; both-ok → ok=true. Full web 2266 pass, tsc 0, content-guard 0. Report: `docs/reports/S2_AUDIT_PERSIST_HARD_FAIL.md`.

**Remaining (written):** the reconcile log is a durable fallback, not an auto-replay queue (a reconciliation job is Phase 6 ops). The fail-closed UX is deliberate (owner-approved "no 200 on DB failure") and reversible by flag if deliver-on-degrade is later preferred — the attestation is preserved in logs either way. Master Plan tracker (PR #47) to update: S2 → [x] with this PR#, audit `[~]` → resolved.

**Next per Master Plan:** S3 — no-silent-correction for name / patronymic / authority / date / series (extend the S1 principle beyond geography).

---

# HANDOFF — Session 72 (2026-05-30)

## Session 72 — S1 Geography No-Silent-Snap (branch `fix/geography-no-silent-snap`, off main)

First execution item from the Engineering Master Plan (PR #47), done strictly as a safety-only PR. The owner's live failure: a place reading `с.м.т. Ярошенець` was silently rewritten to `Тростянець` and presented as recognized — a legal error (wrong place on a signed document). Root cause: `snapCity`'s fuzzy branch returned `value: GAZETTEER[bestIdx]`, promoting a within-threshold (0.34 confusion-distance) *suggestion* to the *final value*. Fix: the fuzzy branch now keeps the RAW cleaned read as `value`, returns the nearest entry as `suggestedValue` only, sets `matched=false` and `review_required=true` (callers already honour `review_required`). Exact match unchanged; unknown geography → raw + review, no suggestion. `PlaceMatch` gained `suggestedValue?: string | null`. ONE behavior change in `packages/knowledge/src/gazetteer.ts` — no dictionary rewrite, TPS `dictionaryBridge` untouched (it was not the source; `GEO_CORRECTIONS` has no `Ярошенець`).

**Evidence:** `geographyNoSilentSnap.test.ts` 3/3 — Ярошенець must NOT silently become Тростянець; Тростянець exact may normalize (no review); unknown gibberish → raw + review. Full web 2261 pass, tsc 0, content-guard 0. Report: `docs/reports/S1_GEOGRAPHY_NO_SILENT_SNAP.md`.

**Remaining (written, honest):** seed GAZETTEER is ~70 places — a real village absent from the seed returns `unknown_geography` + review (safe, no silent replace) but offers no suggestion; full KOATUU load is a separate data task. The UI must present `suggestedValue` and block until reviewed — the contract is now correct; a dedicated geo review-surface is the UX phase. Master Plan tracker (PR #47) to be updated: S1 → [x] with this PR#, plus the "no phase [x] without 5 conditions" rule.

**Next per Master Plan:** S2 (audit persistence hard-fail → non-200 on DB failure), then S3 (no-silent-correction for name/patronymic/authority/date/series).

---

## Session 71 — Booklet orientation auto-rotate (branch `fix/booklet-orientation`, off main)

The TPS OCR route already rotated 90/180/270 for an international passport whose MRZ was not found, accepting a rotation only if it located an MRZ. An INTERNAL passport booklet has NO MRZ, so rotation never helped it — a rotated booklet matched on garbage and was never re-tried. Extended ADDITIVELY: (1) trigger rotation also when a booklet matched with <2 identity fields; (2) in the rotation loop, track the rotation with the most identity fields (`bookletFieldCount`); (3) after the loop, adopt that rotation if it has strictly more identity fields than the upright read. The passport MRZ path is unchanged (handled first). tsc 0; TPS 370 pass; full web pass; content-guard 0.

**Honest caveat:** cannot verify with a live rotated-booklet image in this env (no upload). The change is additive and only adopts a strictly-better rotation, so it cannot regress the upright/passport paths. Owner should live-repro a rotated booklet to confirm the chosen rotation reads correctly.

**Remaining:** P2–P5 glossary; owner-gated (birth visual approval, official military/diploma/pension URLs + КАТОТТГ byte-verify).
# HANDOFF — Session 70 (2026-05-30)

## Session 70 — Owner mode site-wide (branch `feat/owner-mode-site-wide`, off main)

Closed the owner request: test every product without payment. Inventory: TPS wizard already had owner-bypass; EAD + Re-Parole have no site payment (free); server routes (generate-pdf/render/tps-packet) already honour `isOwnerSession`; owner-login UI exists at `/[locale]/owner` (request-code → verify-code). The ONLY gap was the Translation wizard — it had no owner check and forced Stripe. Fixed: it now fetches `/api/owner/status` on mount, and `handlePayment` skips Stripe → `setScreen(7)` for the owner (the generate-pdf route already bypasses the payment gate for a verified owner cookie). CTA shows "Owner — continue free". `ownerMode.test.ts` 3/3; full web pass; tsc 0; content-guard 0.

**Remaining (honest):** orientation auto-rotate (needs a live rotated fixture to verify — owner to provide or accept blind); P2–P5 glossary consolidation; owner-gated (birth visual approval, official military/diploma/pension URLs + КАТОТТГ byte-verify).

---

