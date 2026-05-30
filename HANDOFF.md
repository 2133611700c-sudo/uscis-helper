# HANDOFF — Session 82 (2026-05-30)

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

