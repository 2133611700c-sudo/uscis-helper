# STATUS (2026-06-10 — synthetic L2 fixture pack + runner smoke-test + GH-secrets doc)
- L2 ACTIVATION-ENERGY LOWERED: 3 synthetic worked-example fixtures (examples/: passport baseline + 2 adversarial silent-substitution/cyrillic-in-output) in the EXISTING GroundTruthFixture format (independent deviation from prompt's parallel schema, reconciled via `_`-doc keys). l2RunnerSmoke.test.ts (+5) runs the REAL runner end-to-end → INSUFFICIENT_N + broken-reader false-finalization caught. docs/ops/SETUP_GITHUB_SECRETS.md (drift-guard activation). HOWTO pointer added. PII audit: 0 real (synthetic only). 3203 passed, tsc 0, guard 0. OWNER: copy the 3 shapes → ≥30 real docs/class incl ≥3 adversarial; or L1 baseline. No further agent value without owner deliverable.
- PARITY: supabase db diff --linked NOT runnable here (Docker down + CLI linked to wrong project). MCP-introspection parity instead (columns/types/5 constraints/8 indexes/triggers/fn/RLS/policy/comments) → structurally identical, ONLY 6 missing COMMENTs (gap a) → added verbatim to both migration files. ORPHANS: 0 active-code (recordGuardBlock uses new schema; failure_type matches = legit TS enum or historical docs) → none rewritten. CHECKLIST: +WHERE-each-var-lives (Vercel vs GitHub) + manual-trigger note. CI DRIFT-GUARD added (.github/workflows/supabase-drift-check.yml, daily, graceful-skip until 3 Supabase secrets set). guard 0. OWNER: optional canonical CLI diff (local Docker); set 3 Supabase secrets to activate drift-guard.
- 2026-06-11 MIGRATION-EXEC: passport migration steps A-D CODE-COMPLETE (PASSPORT_SCHEMA_RENDERER_ENABLED + DUAL_RENDER, both default OFF = byte-identical; snapshots; visual-diff artifact). /admin/status dashboard live (owner-only). Runbook + validation checklist + owner takeover doc. Agent-цикл ЗАВЕРШЁН — остались owner-actions (checklist/baseline/GT/3 decisions) + mentor (canary review, L2 verdict, threshold calibration). (hotfix: <a>→<Link> в /admin/status — build-блокер ESLint) Deploy: webhook-miss на хотфиксе → retrigger.
- 2026-06-11 FINAL-CLOSURE: 3 passport schemas BUILT NOT REGISTERED (registration = live PDF switch, pinned by test; migration plan in docs/ops/PASSPORT_SCHEMA_MIGRATION_PLAN.md). HEIC (iPhone) WORKS end-to-end via heic-convert WASM (sharp HEVC = dead code, removed): vision-extract intake + upload→storage-as-JPEG + preprocess step-0 (TPS/EAD/Reparole fixed centrally); 6/6 real-decode tests. Footer→Supported Documents (4 locales) + formats note + 4 FAQ. 3241 passed/tsc 0. OPEN: owner iPhone re-test (catalog + HEIC); schema registration only via migration plan.
- REPO↔PROD SYNC: reconstructed the 2 new-table migrations from the LIVE schema (pg_get_* exact), deleted my conflicting dup. Honest note: 4-step history can't be byte-replayed from introspection → FINAL-STATE files + `db pull` for CLI-exact. Path B (certifier_id FK dropped): code already accepts arbitrary uuid — VERIFIED LIVE (placeholder uuid insert+rollback ok). Added .env.example (OWNER_CERTIFIER_ID + 6 flags OFF) + docs/ops/L1_T0_ACTIVATION_CHECKLIST.md (Step0→4). +1 test (3198 passed, tsc 0, guard 0). OWNER: OWNER_CERTIFIER_ID (placeholder ok) → GUARD_BLOCK_METRICS_ENABLED 14d baseline → calibrate threshold → REFUND_AUTOTICKET → (post L2 PASS) audit+override canary. Keystone = L2 fixtures + adversarial.
- L3 T0 receiver: persistCertifierAudit.ts (behind CERTIFIER_AUDIT_PERSIST_ENABLED OFF) maps to owner's REAL certifier_override_audit schema + satisfies all 5 CHECK constraints in code (verified by live BEGIN/INSERT/ROLLBACK). Wired into certifierOverrideApply (async; route awaits). recordGuardBlock FIXED to owner's real guard_block_events schema (gate_type/reason_code/field_name/would_block/uuid) — repo migration realigned. +adversarial fixtures (6-category, ≥3/class) in L2_FIXTURES_HOWTO. +16 tests (3197 passed, tsc 0, guard 0). 2 FINDINGS: (1) guard_block_events schema differed (fixed); (2) certifier_id FK→profiles + profiles EMPTY → T0 persist fails until owner creates a profile + sets OWNER_CERTIFIER_ID (or relaxes FK). OWNER: resolve certifier_id FK; L2 fixtures incl adversarial [keystone]; L1 activation.
- L2 CODE-COMPLETE end-to-end: groundTruthFixture.ts (owner format w/ expected:null=must-not-finalize + validator + scorer folding false-finalization into critical_wrong) + runFixtureBenchmark.ts (DI-predict runner → per-class verdict + PII-free summary) + classVerdict.ts (INSUFFICIENT_N/zero-tolerance/locked thresholds/canary gate) + synthetic example + docs/L2_FIXTURES_HOWTO.md. +9 tests (3186 passed, tsc 0, guard 0). ONLY remaining = owner fixtures+keys (the run). Session: L0/L1/L2 agent-cores all code-complete, ~80 new tests. Binding constraint = OWNER: L2 fixtures (keystone ~8-16h) + L1 activation. Then L0 prod wiring → D5 UI → L3. HTR last.
- L2 RUNNER CORE: classVerdict.ts (evaluateClassBenchmark → INSUFFICIENT_N at N<30, FAIL on any silent wrong-critical, PASS at LOCKED per-class threshold) + canaryDeployAllowed (PASS ≤7d). Thresholds from GT_BENCHMARK_EXIT_CRITERIA (passport .99/military .98/birth-marriage-soviet .97). +7 tests (3177 passed, tsc 0, guard 0). Extends existing scoreAgainstTruth (per-doc). OWNER-BLOCKED: GT fixtures (35-49 docs, encrypted, gitignored). NOT wired: CI canary-gate (would block all deploys until first PASS; activates Phase 3). PHASES: L1 code-complete (owner activation pending); L2 core done (fixtures pending); next = L0 wiring after L2 PASS / D5 UI / L3.
- L1 INFRA complete (built via 2 mapping agents, by-the-book): guard_block_events migration (+ manual_review_queue escalation columns); recordGuardBlock write-hook behind GUARD_BLOCK_METRICS_ENABLED (OFF=no-op), wired at 2 guard points; 3 cron scripts (escalation-tick */30, daily-reconciliation 6:00, guard-block-rate-check hourly) calling the TESTED pure logic; owner-alert Telegram helper; 3 GH workflows. ALL additive + measurement-gated (no prod change until owner enables). 3170 passed, tsc 0, scripts typecheck, guard 0. OWNER to activate: apply migration → set GH secrets → GUARD_BLOCK_METRICS_ENABLED=1 for baseline (14d rec) → set GUARD_BLOCK_RATE_THRESHOLD → REFUND_AUTOTICKET_ENABLED canary. Item-3 handwriting counter blocked on ADDITION-C signals. After-L1=L2 (owner fixtures).
- ACCEPTED reframe: handwritten-Cyrillic translation ALREADY WORKS via human-in-loop; HTR = Phase-7 UX speedup, not unblocker. 7-phase plan accepted.
- L1-finish LOGIC built (pure, additive): ticketEscalation.ts (4h→12h→24h-digest, monotonic) + guardBlockRate.ts (window count + threshold-injected exceedsRate; uncalibrated=never-alerts). +13 tests (3168 passed, tsc 0, guard 0). REMAINING L1 = infra (DB+cron, measurement-gated): guard_block_events table + write hook; GH-cron workflows (escalation-tick/daily-digest/rate-check); 7-14d baseline → calibrate threshold; then REFUND_AUTOTICKET_ENABLED canary. Item-3 handwriting counter BLOCKED on ADDITION-C signals (don't fake). OWNER INPUT: baseline 7 vs 14 days (rec 14). After-L1=L2 (owner fixtures).
- L1 item-1 DOJATO: triage + DI orchestration + route-wired at 4 post-payment failure points (422/403/503/email) behind REFUND_AUTOTICKET_ENABLED (default OFF → byte-identical). paymentFailureRouteAdapter.ts binds 3 typed reuse utils; handler refactored to single escalateToOwner (notifyOwnerAlert is ticket-coupled). Enums extended (EmailType+='payment_failure_ack', ManualReviewReason+='paid_request_failed'). +20 L1 tests (3155 passed, tsc 0, guard 0). Verified twice. Flag OFF in prod (needs measurement + escalation/reconciliation first). REMAINING L1: escalation timer, daily reconciliation cron, item-2 rate-alert, item-3 handwriting counter. After-L1=L2 (owner GT fixtures).
- L1 item-1 LOGIC built (additive, byte-identical prod): paymentFailureTriage.ts (failure_type enum + per-type triage + 4 ack templates, owner-ruled) + handlePaymentFailure.ts (DI orchestration: best-effort, never-throws, PII-free, no money movement). +18 tests (3153 passed, tsc 0, guard 0). DI because the 3 reuse utils have strict typed enums — bind at route boundary, not by guessing (map-first verified sigs). REMAINING item-1: route adapters at 4 failure points behind REFUND_AUTOTICKET_ENABLED (OFF) + extend EmailType/ManualReviewReason enums. Then item-2 rate-alert, item-3 handwriting counter, escalation timer, daily reconciliation. Directives stand: STOP-on-ambiguity; after-L1=L2.
- OWNER FORWARD-DIRECTIVES in kickoff: STOP-on-ambiguity during L1 wiring (mentor-discussion, no guessing); AFTER L1 = L2 GT benchmark with owner fixtures (NOT HTR/new-classes — prioritization trap; dashboard numbers are an unknown baseline until L2); turnkey first step = failure_type enum + persistence table. L1 = fresh session straight to code.
- L1 FULLY SPECCED (fresh session = code): A-full per-type triage (422→correction / 403→review+manual / 503→retry3x+manual / email→resend) + 4 ack-templates routed by failure_type (owner caught: 1 template misleads 422 user-input → drafted ack_422_correction / ack_403_review / ack_503_retry / ack_email_resend, English, in kickoff) + escalation timer 4h/12h + daily reconciliation cron + SLA 24h CONFIRMED. Refund = manual via Stripe (irrecoverable/user-requested only); B deferred. Reuse: Resend, notifyOwnerAlert+Telegram, createManualReviewTicket+manual_review_queue, documentClassMetric, GH-cron. Premise verified (post-payment fails real, no refund code). Earlier: L0 backend done (+29 tests, flag OFF, byte-identical).
- L1 RULED: A-full + PER-TYPE TRIAGE (422 user-input→correction not refund; 403→review+manual; 503→auto-retry 3x then manual refund + owner-alert; email-fail→resend never refund) + customer ack-email + escalation timer (4h/12h) + daily reconciliation cron. Refund = manual via Stripe, only irrecoverable/user-requested. B (auto-refund) deferred. Customer SLA = 24h (agent-rec, owner confirms). All in docs/NEXT_SESSION_L1_KICKOFF.md. Paid-422 premise VERIFIED (post-payment: confirmed_value_guard 422 / 403 / 503 / silent email-fail; no refund code exists). TEMPO: fresh session for L1 (payment-route).
- OWNER RULED next = L1 (not D5 UI). Verified paid-422 premise (2 agents): CONFIRMED — confirmed_value_guard 422 / ocr_field_safety 403 / persistCertification 503 / silent email-failure all AFTER payment gate (line 124); certifier_override 422 is pre-payment (safe). NO refund code anywhere. L1 reuses existing infra (Resend, notifyOwnerAlert+Telegram, createManualReviewTicket+manual_review_queue, documentClassMetric, GH-cron pattern). docs/NEXT_SESSION_L1_KICKOFF.md written (refund+auto-ticket / rate-alert / handwriting counter). OWNER RULING NEEDED: refund = (A) ticket+manual [rec] vs (B) auto stripe.refunds. TEMPO: fresh session for L1 (payment-route sensitivity).
- L0 step 1 WIRED: certifierOverrideApply.ts (pure helper) + ONE guarded call in generate-pdf BEFORE the review check, behind CERTIFIER_OVERRIDE_ENABLED (default OFF → byte-identical prod). finalize→sets final_value+clears review; block (anchor conflict / user-alone-on-T1 / invalid)→422 pre-charge; every decision audited. +6 tests (3135 passed, tsc 0, guard 0). Verified twice (OFF skipped; ON correct). Flag NOT enabled in prod (needs D5 UI + measurement). NEXT: D5 UI (certifier picks reason_code + source side-by-side → sends override) → criticality live-swap (flag+measure) → L1.
- L0 PRIMITIVE LIVE-IN-CODE (additive, byte-identical prod): certifierAuthority.ts (fieldTier matrix + tier×reason matrix + evaluateCertifierOverride per LAW 2#5 + 12-field sha256 audit hook) + deepseekBoundaryGuard.ts (CHECKABLE LAW 7, throws on DeepSeek finalValue). +23 tests (TDD-anchor: user_clarified on T1 → reject). classifyCriticality marked superseded (fallback kept; removal would break 5 call-sites + change prod). 3129 passed, tsc 0, guard 0. Built via 4 parallel Explore agents mapping reality first; plan verified twice. NOT wired into live route yet (prod-behavior change → behind CERTIFIER_OVERRIDE_ENABLED + D5 UI next, measured). NEXT: route wiring (flag OFF) → criticality live-swap (flag+measure) → L1.
- NEXT SESSION = L0 certifier_override. Paste-ready prompt + checklist in docs/NEXT_SESSION_L0_KICKOFF.md. LOCKED docs @46efb8b (constitution + ADR-021 RULED). TDD-anchor test = reject user_clarified on TIER 1. Replace classifyCriticality substring (applyOcrFieldSafety.ts:48-51) with (field,doc_class)→tier matrix. SCOPE: gazetteer-history NOT in L0 PR — sequence AFTER L0 merge (TIER-1 place_of_birth reducer). Anti-drift: RULED docs, don't interpret/extend; ambiguity → STOP+ask.
- ADR-021 RULED v1: Q1 = 3 TIERS (T1 applicant-identity high-friction / T2 related+validity low-friction / T3 user_confirmed), per-doc-class lists. Q2 = ENUM 6 codes (+source_corroborated_user_value, +unreadable_per_source-as-refusal; user_clarified=T3-only). Q3 = parents=T2 + cross_doc_anchor_id. HTR = 15% + ALL 6 conditions (L1 closed, L2 PASS ≥3, post-L1 window, defined handwriting_field_failure, >15%, ADR-020). Agent additions accepted: (A) tier×reason_code matrix enforced in code; (B) anchor_id referent = applicant case key; (C) HTR cond-4 needs signals we don't emit (handwritten classifier + visual_evidence_score) → build those first. Audit hook LOCKED from commit 1. NEXT (agent L0): certifier_override (3-tier+matrix+hook) + criticality-per-doc-class-in-code + DeepSeek-lint; then L1.
- ADR-021 DRAFTED (docs/adr/ADR-021-delegated-certifier.md, v1-min): Q1 scope / Q2 enum reason-codes / Q3 parents=critical-low-friction — OWNER RULING PENDING. Audit-hook schema LOCKED from commit 1. certifier_override code BLOCKED until Q1-Q3 ruled (avoids rewrite). HTR THRESHOLD set in constitution: >15% handwriting failures / rolling 100-doc + ADR-020 locked → needs L1 handwriting-failure counter (absent today). NEXT ORDER: owner rules ADR-021 (~30min) → agent L0 (certifier_override+criticality-per-doc+DeepSeek-lint+audit-hook) → agent L1 (refund+rate-alert+counter) → ADR-020 → ADR-019 persistence (parallel, non-blocking).
- LAW 2#5 RULED (owner Type-3): non-critical → user_confirmed finalizes (+audit+flag); critical identity → certifier_override required (user alone can't); cross-doc anchor always overrides user on critical, conflict→block. certifier=owner-only TRANSITIONAL → ADR-021 (delegated role). MRZ scope ruled: romanization authority + candidate-only on illegible other-doc. Verbatim in constitution LAW 2#5. OPEN sub-q (ADR-021): parents/spouses scope. NEW DEBT: ADR-021 + C3 code has NO certifier_override path yet (must build with tiered authority).
- CONSTITUTION codified (ONE_BRAIN_CYRILLIC_CONSTITUTION.md PART II/III): 8 LAWS (translit/source-of-truth/handwriting/visual-evidence/privacy/critical-fields-per-doc/DeepSeek/audit) + L0–L4 maturity map + build order. 2 clauses ⚠ OWNER-CONFIRM (MRZ-controls scope; user-confirm-as-sole-source-may-final). L1 corrected 10%→~45% (repo-verified). OPEN L0: criticality-per-doc-in-code, DeepSeek lint. OPEN L1: refund + guard-block rate-alert. L2 gated on owner GT fixtures. NEXT SESSION = L1 (refund + rate-alert), HTR stays behind ADR-020 + a real number.
- CORRECTED CLAIMS (owner critique): mirror = TEXT-content verified only, visual layout PENDING owner look (not "end-to-end"). Gazetteer (б) NOT fully closed — pre-2020 names (Дніпропетровськ/Кіровоград/Артемівськ) ABSENT, aliases all-empty (renames unmapped), Crimea no-policy; OLD-doc places still false-negative→review (safe, incomplete). Mirror documented as ADVISORY transparency, NOT a safety control. Rollback handles for all 3 layers in runbook.
- PRIOR 7-ITEM TRUTH (repo-verified): 403→422 ✓, structured guard-block log ✓, DeepSeek-never-final ✓, Tier0≠legal ✓, runbook ✓, kill-switch=decided-as-rollback, **N<30-in-runner STILL OPEN**. Real debt = N<30 + gazetteer history + ADR-020 before HTR. No prod telemetry on handwritten-date failure % (instrumentation gap) → HTR priority unjustified.
- MIRROR PDF (a): route hardened (mirror render in own try/catch → fail-open to generic; was a 500 risk). End-to-end verified (mirrorEndToEnd +4): valid %PDF, review→[CONFIRM], missing→[enter from document], never invents, all 5 schemas render. Text-verified sample structure + content rules (Patronymic/draft/no Apt 8). MIRROR_PDF_ENABLED ENABLED in prod (fail-open, draft-labeled). Rollback: env rm + redeploy. 3106 passed. Extraction quality on real handwriting still review-gated (mirror renders what it gets, marked).
- GEO (b): snapCity gazetteer expanded from 60 hardcoded → ~500 (CURATED_SEED ∪ official КАТОТТГ SETTLEMENT_ROWS, 458 sourced). Matcher unchanged, only data. Anti-silent-snap intact. +5 tests (3102). SCOPE: city/UTS tier, not the 28k villages (re-run gen-settlements.mts for those). CAVEAT: active only where snapCity wired + SMART_NORMALIZE_ENABLED ON (OFF in prod).
- SOURCE-SCRIPT GATE BUILT (owner decision b): name with no distinctive UA letter (і/ї/є/ґ) nor RU letter (ы/э/ё/ъ) → review_required + reason source_script_ambiguous + C3 finalValue=null (no silent KMU-55 final). Best-effort KMU-55 candidate still shown. isNameSourceScriptAmbiguous + gate in documentFieldReader, behind RU_TRANSLIT_ENABLED (ON prod). +7 tests (3097). All 8 owner-required transliteration tests covered. Owner rule: noisy review > clean PDF with wrong name.
- OWNER STANDARD LOCKED: RU=BGN/PCGN (Сергеевич→Sergeyevich), UA=KMU-55, applicant=MRZ/passport, relatives=as-written, ambiguous→review. transliterateRussian updated to BGN/PCGN + visual-evidence rule pinned (cross-doc match = candidate, never finalValue for illegible). 18 tests. Enabling RU_TRANSLIT in prod.
- BUILT date-role guard (deterministic, no flag, in readDocument all products): catches date role-conflation (one date in two role fields) + sequence conflict (issue before birth) → review. +10 tests. From the ChatGPT spec, applicable part.
- APPLIED from ChatGPT spec: Russian transliterator (transliterateRussian) + detectNameScript, wired into transliterationPolicy behind RU_TRANSLIT_ENABLED (OFF). 14 tests. LIMITATION found: ambiguous names (Сергей, no ы/э/ё/ъ) → unknown → need DOC-level script context, not per-name. Rejected ChatGPT fabrication (it never read the image either).
- KIT 2 VERIFIED: passport MRZ decodes DOB=1986-06-25 (June, check-digit valid, conf 0.99); fieldArbiter ranks passport_ocr_mrz #1 → MRZ resolves the illegible birth-cert date in multi-doc flows (TPS/reparole). Test added.
- KIT 1 BUILT: auto-orientation (autoOrient.ts) wired into readDocument behind AUTO_ORIENT_ENABLED. PROVEN on rotated birth cert: day 26→25 (correct), place fuller. Detects content rotation (Gemini thumbnail) + self-verify loop + fail-open.
- EXHAUSTIVE: Gemini, Vision line-seg, Vision multi-crop voting (0/5), HF-TrOCR — ALL fail the handwritten month. Names readable (11/12). Date-month needs a TRAINED HTR (Transkribus/TrOCR) → owner must provide a token. Then ensemble wires it.
- PROVEN WALL: Gemini cannot read this handwritten month (липень/травень never червень, 3 prompts) NOR localize the date line (39% box). Auto-reading handwritten dates needs Vision-tuning (key rotation) or Transkribus HTR (owner creds). Names work; dates stay human-reviewed.
- STOP: ensemble flag turned OFF in prod (full-width band timed out; tight crop garbled month). Infra complete+tested+observable but Vision-reads-month not reliable on auto-crops. Dates already review-gated (safety intact). Crop bounded to avoid timeout.
- TUNING: tight bbox clipped the handwritten month (Vision: year ok, month garbled). Now crop FULL-WIDTH horizontal band at the date line. One targeted attempt.
- DEBUG2: ensemble runs (3 boxes/3 crops/375 chars) but extracts 0 dates. Added month_hits/year_hits/cands diag to see if Vision garbles the month on crops.
- ROOT CAUSE FOUND: ensemble was wired into the legacy path but reads return via the CORE path (ok:core-b2, early return) — ensemble never ran. Now wired into Core path via shared runDateEnsemble helper.
- DEBUG: exposed date_ensemble diagnostics in response (boxes/crops/chars/status) to find why the 2nd reading isnt surfacing in prod.
- FIX: ensemble extractor required day+month+year; Vision OCR drops the day → no candidate → no surfacing. Day now optional. Re-deploy+smoke.
- FIX: ensemble required shared-year anchor → suppressed the real case (Gemini gets year, Vision gets month, no shared component). Relaxed: any date diff on the cropped region surfaces.
- FIX: Gemini bbox returned malformed JSON → boxes empty → ensemble fell back to garbled full-page Vision. Now requests ARRAY boxes + salvages malformed JSON.
- Ensemble now reads date REGIONS zoomed (Vision garbles month on full page, reads it on crop — prod proof). dateRegionRead wired. Live in prod. Re-smoke pending.
- FIX: ensemble date-field detection by NAME (FieldOut.kind is source not type, silenced it). ENSEMBLE_DATE_ENABLED=1 LIVE in prod. Re-smoke pending.
- Review UI now surfaces the ensemble second-reading on a date conflict (Gemini+Vision both shown, human picks). Handwritten-date ensemble is end-to-end (backend+UI) behind ENSEMBLE_DATE_ENABLED=OFF. Remaining: owner rotate key + flip; optional date-crop booster.
- WIRED handwritten-date ensemble into translation route (ENSEMBLE_DATE_ENABLED, default OFF): Gemini+Vision 2nd-read, date disagreement→review+candidate. +7 tests (3057). Remaining: review UI surfacing + date-crop; OWNER rotate Vision key + flip flag.
- HANDWRITTEN DATES: PROVEN ensemble fix — Gemini misreads month, Google Vision reads it right; cross-check recovers the date. Built dateReconcile core (+8 tests). Remaining: wire Vision 2nd-read+crop+review UI. OWNER: ROTATE the Vision SA key pasted in chat.
- HONEST handwritten probe (3 runs): NAMES read well+stable; DATES stably WRONG on birth certs (month/day misread + dob/issue conflation). Real target = handwritten dates, not printed. All review-flagged.
- BUILT mirror translation PDF: official KMU schemas now wired to real extraction (was mockOCR-only). registry+buildMirrorValues+orchestrator, behind MIRROR_PDF_ENABLED (default OFF). Birth cert = strong; marriage/divorce sparse extraction; +9 tests.
- DECIDED (A/B data): no scanner-style greyscale/B&W preprocessing — it collapses handwritten Cyrillic (3/3→0/3); send original color. Geometric crop/deskew = future measured candidate only.
- Bench coverage 4/5 UA classes (+Soviet bilingual: same review-gated misread pattern). Finding B corrected: birth cert IS protected via always_review+route override (not the spec flag). Intl-passport GT MISSING (owner).
- Finding A fully closed: ALL 5 upload paths (translation/EAD/TPS×2/reparole) now downscale >3.8MB photos client-side via shared lib/upload/downscaleImage. No more 413 on large phone photos anywhere.
- FIXED bench finding A: translate wizard now downscales >3.8MB photos client-side before upload (was HTTP 413 at edge). Flagship only; reparole/ead/tps follow-up.
- GT pipeline bench run (live prod): printed Cyrillic reliable (military 4/4); handwritten partial but always-review holds. Findings: 413>4MB, birth-cert handwritten:false mislabel, sex-not-in-spec. EXPLORATORY (1/class).
- Debt closed: BUG C + BUG D tests (+10). NEW finding: RU-spelling guard misses composite full_names without ё/э/ы/ъ — pinned + flagged for owner.
- CI infra: bumped GitHub Actions to Node-24 majors (checkout v6 / setup-node v6 / cache v5 / pnpm-action-setup v6) — clears 2026-06-16 Node-20 deprecation.
- CI fix (content-guard): reworded a 'certified translation' comment in applyOcrFieldSafety.ts (Rule 4 product-claim). No logic change.

## P0-A hardening (2026-06-10, CODE — walked enforce back to shadow)
- **CORRECTION to 816cb64:** that commit shipped the confirmed-value guard ALWAYS-ON/enforcing straight to prod (auto-deploy) with zero block-rate data — a measurement-first violation. This commit reverts it to **SHADOW mode by default**: the guard validates + logs `would_block` but does NOT block → **prod output byte-identical**. Owner flips `CONFIRMED_VALUE_GUARD_MODE=enforce` AFTER reviewing shadow logs.
- ONE env knob, three modes (no flag sprawl): `shadow` (default) | `enforce` | `off` (emergency kill-switch, loudly logged). Collapsed the separate EMERGENCY_GUARD_BYPASS into `off`.
- `403 → 422` for the guard block (content invalid ≠ auth failure; verified frontend just alerts the error string, no breakage).
- PII-free structured log on every would_block/block: `{field, criticality, reason, doc_type}` — no values.
- Added `CERTIFIED_DOC_INCIDENT.md` runbook (kill-switch steps, interim refund policy, SEV levels).
- Contract additions: DeepSeek-never-writes-finalValue (C3 contract); P0-A.1-vs-P0-A.2 scoping (A.2 = MRZ anchor cross-check, NOT full gazetteer re-run); Tier-0≠legal-evidence warning (ADR-019); N<30-binding-in-runner-code (GT criteria).
- tsc 0; **3016 passed | 4 skipped | 0 failed**.

## P0 Design Lock + P0-A (2026-06-10, CODE + 5 contract docs)
- **P0-A output door (now SHADOW-default):** `generate-pdf` runs `validateConfirmedValue` on EVERY release value (not behind OCR_FIELD_SAFETY_ENABLED) — Cyrillic/control/over-length/bad-date in a certified English PDF is a legal defect. Fixed Agent-A keying bug (it keyed on a `confirmed` flag the client never sends; now keys on real release values).
- **classifyCriticality reconciled** to CRITICAL_FIELDS_CONTRACT: added validity DATES (issue/expiry/marriage), issuing_authority, ead_category/class_of_admission, nationality. Previously fell through to `optional` (real gap).
- **Observability (P1 start):** PII-free `[ADR018] fallback_model_used` log (ids+counts only).
- **5 design-lock contracts created:** CRITICAL_FIELDS_CONTRACT, C3_USER_CORRECTION_CONTRACT, PAYMENT_REFUND_LEGACY_GATE_CONTRACT, GT_BENCHMARK_EXIT_CRITERIA (docs/architecture/), ADR-019-audit-trail-persistence (docs/adr/).
- tsc 0; **3011 passed | 4 skipped | 0 failed** (+14: confirmedValueGuard tests).
- **OWNER DECISIONS PENDING (marked in docs):** refund/legacy policy, audit-trail PII tier+retention, manual-override path, GT sample sourcing (need docs from different real people), military rank criticality.
- **NOT done (owner-gated/blocked):** GT benchmark runner (Agent B hit spend limit), audit-trail persistence code (ADR only), canary (blocked on GT Tier-1 sample), Vision bbox ADR-020 (research gathered).

# STATUS (2026-06-10 — ADR-018 model matrix LOCKED: fallback-model reads of Cyrillic docs force review)

## ADR-018 Model Matrix DONE (2026-06-10, CODE + ADR)
- **ADR-018 created** (`docs/adr/ADR-018-model-matrix.md`): iron matrix — gemini-3.1-pro-preview = THE reader; flash = fallback-only; Vision = technical eye; DeepSeek = prose + sanitized TPS text-structuring (never sees image, final_value always overwritten from source); D2/C3/validators/PDF = code, no AI.
- **Safety gap CLOSED:** provider chain silently fell back pro→flash on timeout/5xx — gemini-2.5-flash is DISQUALIFIED on certificate docs (read a different person, 2026-06-02). Now: `documentFieldReader.ts` forces `review_required=true` + `fallback_model_used` on EVERY field when `spec.script !== 'latin'` AND `read.model !== primaryGeminiModel()`. Deterministic, no flag.
- Latin US forms (us_ead/us_i94/us_i797) exempt — flash never disqualified on Latin print.
- `primaryGeminiModel()` exported from geminiVisionProvider.
- New tests: `fallbackModelReview.test.ts` (5). Three existing test mocks updated to report primary model.
- tsc 0; **2997 passed | 4 skipped | 0 failed** (was 2992, +5).

# STATUS (2026-06-10 — housekeeping: Vercel dead flags removed, branches cleaned, 0 open PRs)

## Housekeeping DONE (2026-06-10)
- 7 dead Vercel prod env flags removed: ONE_BRAIN_CORE_ENABLED, ONE_CORE_TPS_ENABLED, ONE_CORE_REPAROLE_ENABLED (+NEXT_PUBLIC), ONE_CORE_EAD_ENABLED (+NEXT_PUBLIC), CENTRAL_BRAIN_TRANSLATION.
- 68 stale local git branches deleted. Only `main` remains.
- All GitHub PRs closed (0 open). Canary docs applied to main.

# STATUS (2026-06-10 — payment ordering bug FIXED in generate-pdf/route.ts)

## Payment ordering bug FIXED (2026-06-10)
- **Bug:** Stripe charge (402) fired before review gate (403) — user could be charged for blocked PDF.
- **Fix:** Pre-payment 400 `fields_require_review` check inserted before Stripe block in `generate-pdf/route.ts`.
- **Applies to:** all users (owner included — certification is legal not financial).
- **tsc:** 0 errors. Tests: 2992 passed | 4 skipped | 0 failed.
- **Prod:** deployed via Vercel on push to main.

# STATUS (2026-06-10 — PR cleanup done; Phase 3 DONE: CanonicalField.finalValue + C3 as only writer)

## Phase 3 DONE (2026-06-09, CODE — CanonicalField.finalValue + C3 as only writer)
- **finalValue added to CanonicalField** (`apps/web/src/lib/canonical/types.ts`): `undefined` = C3 not run, `null` = rejected, `string` = accepted.
- **C3 is now the only writer** (`applyOcrFieldSafety.ts`): accept path sets `finalValue=string`, reject/block path sets `finalValue=null`.
- **3 adapters updated** (finalValue-first pattern, backward compat):
  - `translationAdapter.ts` (`canonicalToFieldOut`): `finalValue !== undefined ? finalValue : normalizedValue ?? rawValue`
  - `tpsAdapter.ts` (`canonicalFieldToTpsField`): same pattern for `normalized_value`
  - `eadAdapter.ts` (`getValue` helper): same pattern
- **pdf.ts updated** (`planTranslationRows`): `final_value !== undefined ? final_value : normalized_value`
- **D2 verified**: does NOT write `CanonicalField.finalValue` — writes `normalizedValue` only (D2's DECISION struct's internal `finalValue` is a different concept).
- **Tests:** 2992 passed | 4 skipped | 0 failed (18 new Phase 3 contract tests).
- **tsc:** 0 errors.
- **Backward compat:** flag OFF → `finalValue=undefined` → all adapters fall back to `normalizedValue` → byte-identical to Phase 2.
- **Prod untouched.** No env changes. `OCR_FIELD_SAFETY_ENABLED` stays OFF in prod.
- **Payment ordering bug noted** (review gate 403 fires after payment gate 402 in `generate-pdf/route.ts`) — separate issue, not fixed here.
- **Proof:** `docs/reports/PHASE_3_FINAL_VALUE_C3_WRITER_PROOF.md`
- **Next:** Owner choice — enable `OCR_FIELD_SAFETY_ENABLED` canary OR PR cleanup (dead env flags) first.

# STATUS (2026-06-10 — PASS_PROD_MODEL_SMOKE: prod on gemini-3.1-pro-preview, Phase 3 UNBLOCKED)

## PROD MODEL FLIP + SMOKE: PASS (2026-06-10)
- **GEMINI_MODEL flipped:** removed dirty `"gemini-2.5-flash\n"` → set clean `gemini-3.1-pro-preview` (no embedded \n).
- **Redeploy:** Vercel build OK, SHA `203b572` (main is current), aliased `messenginfo.com`.
- **Healthz:** `{"status":"ok","sha":"203b572","environment":"production"}` — OK.
- **Model smoke (live Gemini call):** `model: gemini-3.1-pro-preview` confirmed in `/api/translation/vision-extract` response at 4554ms. No 5xx, no timeout, no fallback to flash.
- **Result: PASS_PROD_MODEL_SMOKE.** Phase 3 is UNBLOCKED.
- Report: `docs/reports/PROD_GEMINI_MODEL_FLIP_SMOKE_2026-06-10.md`

## PR-F DONE (2026-06-10, CODE — Core read timeouts raised for pro-model)
- readDocument `timeoutMs` 20s→40s in all 4 product routes; reparole/EAD `maxDuration` 30→60.
- Reason: PR104 audit timeout_status CONFLICT — pro observed 28s, 20s cap silently degraded pro→flash.
- Unblocks owner action: flip prod `GEMINI_MODEL` → `gemini-3.1-pro-preview` (clean value, no \n). **DONE.**

## Phase 2.2–2.6 DONE (2026-06-09, CODE — All One-Core flag gates removed, GPT deleted)
- **Phase 2.2:** TPS OCR (`apps/web/src/app/api/tps/ocr/extract/route.ts`) — `ONE_BRAIN_CORE_ENABLED` flag gate removed. Core B1 is now the unconditional default for UA identity docs.
- **Phase 2.2a:** documentRegistry (`apps/web/src/lib/docintel/documentRegistry.ts`) — added `us_ead`, `us_i94`, `us_i797` specs with `script: 'latin'` (EAD route can now look up these doc types).
- **Phase 2.3:** ReParole OCR (`apps/web/src/app/api/reparole/ocr/extract/route.ts`) — `ONE_CORE_REPAROLE_ENABLED` server-side flag gate removed. Route always runs Core.
- **Phase 2.4:** EAD OCR (`apps/web/src/app/api/ead/ocr/extract/route.ts`) — `ONE_CORE_EAD_ENABLED` server-side flag gate removed. Route always runs Core.
- **Phase 2.5:** `/api/ocr/extract` — no live callers confirmed; DeepSeek text-parse path retained per ADR-017.
- **Phase 2.6:** `attemptOpenAIVision` (gpt-4o-mini) removed from `/api/ocr/extract`; `openaiReader` (gpt-4o) removed from `lib/engine/models.ts`. GPT fully gone per ADR-017.
- **Wizard cleanup:** `ReparoleWizardV2.tsx` — `REPAROLE_CORE_ENABLED` constant removed; `useCoreRoute = CORE_COVERED_SLOTS.has(id)` (always Core for passport/booklet). `EADWizard.tsx` — `EAD_CORE_ENABLED` constant removed; upload step always present (8-step flow).
- Tests: 2974 passed | 4 skipped | 0 failed. tsc: 0 errors.
- Prod untouched. All One-Core flags were already ON in prod; behavior unchanged.
- **Next: Phase 3 — explicit `final_value` + C3 as single writer. Or KNOWLEDGE_BRAIN_ENABLED canary (owner GT-gated).**

## Phase 2.1 DONE (2026-06-09, CODE — Translation Core unconditional)
- `ONE_BRAIN_CORE_ENABLED` flag gate removed from Translation vision-extract route. Core B2 is now the unconditional default.
- Dead `CENTRAL_BRAIN_TRANSLATION` consensus block (~40 lines) removed. Dead imports removed (`analyze`, `deepseekProseTranslator`, `DOC_TYPES`).
- `degradedFromBrain` variable and all ternaries removed. Response `status`: Core = `ok:core-b2`; legacy fallback = `ok:legacy-reader`.
- Legacy reader (with preprocessing) stays as fallback for Core errors / 0 fields.
- tsc 0; 2975/4 (0 regressions). Prod untouched (ONE_BRAIN_CORE_ENABLED=1 was already ON in prod → behavior unchanged).
- Phase 2.0b: `gemini-2.0-flash` was already removed from fallback chain in a prior session. Only appears in comments.
- **Next: Phase 2.2 — TPS → Core default for UA-identity docs (booklet/birth/military).**

## Phase 2.1a DONE (2026-06-09, CODE — Translator hard-case unbypass)
- **Translator birth/marriage** (`auto:false`, incident RC-1 STILL TRUE in prod) now route through vision-extract + review gate when `NEXT_PUBLIC_HARD_CASE_AUTOREAD_ENABLED=1` (default OFF).
- Flag OFF: byte-identical to current behaviour. No vision call, no gate, manual specialist path unchanged.
- Flag ON + 0 fields: falls through to manual (no gate breakage — hardCaseHasFields=false).
- Flag ON + fields: `hardCaseHasFields=true → needsReviewGate=true` → all fields review_required, payment blocked until all confirmed.
- `autoread?: boolean` on DocTypeMeta (separate from `auto`, does NOT change `auto:false`). `hardCaseHasFields` state cleared on `resetAll`.
- Files: `TranslateWizard.tsx`; new test `hardCaseAutoread.test.ts` (14 pure-logic tests).
- tsc 0; full suite 2975/4 (was 2961, +14 new, 0 regressions). Prod untouched. No PII. Branch feat/one-brain-gemini-core (PR #104).
- **Next code step: Phase 2.0b — remove deprecated `gemini-2.0-flash` (HTTP 404) from geminiVisionProvider fallback chain.**

## Phase 2.0 DONE (2026-06-09, CODE — rawCyrillic threaded + D2 sees Cyrillic + 4 bug fixes)
- **GAP A FIXED:** rawCyrillic now threads ExtractedDocField → FieldCandidate.rawCyrillic → CanonicalField.rawCyrillic. `docintelToCandidate` sets `rawCyrillic: f.raw_cyrillic`. `canonicalToFieldOut` prefers `f.rawCyrillic` over cyrillicMap.
- **GAP B FIXED:** `applyKnowledge()` feeds D2 with `f.rawCyrillic ?? f.normalizedValue ?? f.rawValue`. D2 Cyrillic rules (gazetteer, RU/UA spelling, normalizeName, patronymicReconcile) now fire on ORIGINAL Cyrillic text. Phase 1 `knowledgeBrain` at arbitration now receives Cyrillic and is effectively at the right level.
- **Bug A FIXED:** ISO YYYY-MM-DD dates accepted without false review (`date.iso_to_uscis`); already-USCIS MM/DD/YYYY pass-through.
- **Bug B FIXED:** `sourceBasis` in `KnowledgeNormalizeCtx` distinguishes MRZ/EAD/I-94 controlling Latin (evidence 0.99) from derived KMU-55 Latin (0.6).
- **Bug C FIXED:** `documentFieldReader.ts` emits review field (`canonical_value_unresolved`) instead of silent drop when `toCanonicalValue()` returns null but `r.cyrillic` non-empty.
- tsc 0; full suite 2961/4 (was 2937; +24 new tests, 0 regressions). Proof: PHASE_2_0_CYRILLIC_D2_DOOR_PROOF.md.
- **Prod untouched. KNOWLEDGE_BRAIN_ENABLED default OFF. cyrillicMap kept as fallback. No PII.**
- GAP C (flag consolidation SMART_NORMALIZE vs KNOWLEDGE_BRAIN → ONE flag) = Phase 2.0b (future).
- GAP D (explicit final_value + C3 single writer) = Phase 3 (future).
- **Next code step: Phase 2.1a — Translator hard-case unbypass (auto:false → Core + review + C3).**


## ⚠️ SELF-CHECK CORRECTION (2026-06-09, agent): Core flags ARE present in prod
- My earlier claim "Gemini-Core is parked behind flags nobody flips / Knowledge canary is a no-op until Phase 2" was **WRONG** — my `vercel env ls` grep pattern missed `ONE_CORE_*`. Full check: **ONE_BRAIN_CORE_ENABLED, ONE_CORE_TPS_ENABLED, ONE_CORE_REPAROLE_ENABLED, ONE_CORE_EAD_ENABLED (+NEXT_PUBLIC twins), CENTRAL_BRAIN_TRANSLATION, DOCAI_ENABLED are ALL PRESENT in prod** (values unverified by `ls`; P2 checkpoint 06-03 records owner-verified ON). ⇒ the Core arbitration path is LIVE for all 4 products; `KNOWLEDGE_BRAIN_ENABLED=1` in prod would fire IMMEDIATELY on live traffic (not a no-op). Phase 2 reframed: not "flip Core on" but "harden the already-live Core + retire legacy fallbacks". Extra care on any dictionary flag.
- Also confirmed (self-check): `convertDateToUSCIS` does NOT accept ISO `yyyy-mm-dd` → my Phase-1 D2 date rule flags correctly-read ISO dates as `date_unparsed` (false review noise — fix in 2.0); my "preserve Latin" rule wrongly treats derived KMU-55 Latin as controlling Latin (controlling must be SOURCE-based: mrz/ead/i94 — not script-based); `documentFieldReader.ts:71` silently DROPS a field when `toCanonicalValue` returns null (read-but-unparseable fields vanish with their raw_cyrillic — violates candidate≠final spirit; fix in 2.0).

## ARCHITECTURE DECISION ADR-017 + Phase 1 brick #1 (2026-06-09)
- Owner mandate: recognition via Gemini (all keys/models); DeepSeek retained fully; GPT removed; HTR parked; "сделай как должно быть". Decided (ADR-017): core = ONE Gemini brain + deterministic knowledge truth + review gate, NOT multi-reader consensus (consensus fixes none of the incident root causes; with GPT out + HTR dead it is a committee of one). Plan: docs/reports/ONE_BRAIN_GEMINI_BUILD_PLAN.md.
- **Phase 1.1+1.2 DONE (code):** `knowledgeNormalize.ts` rebuilt per AI-risk review as a D2 **authority layer** (NOT auto-replace): returns a DECISION {action accept/preserve/suggest/review/block, finalValue, candidateValue, ruleId, reasonCodes, provenance}. `arbitrateDocument(candidates, knowledge?)` applies it — accept/preserve→final; **conflict (suggest/review/block)→keep read value + suggestedValue + review, never silent override**. Flag `KNOWLEDGE_BRAIN_ENABLED` (default OFF → byte-identical, proven by canonical suite 329). 12 conflict-case tests (Russian-on-UA→review, clean UA→accept, gazetteer exact→accept/fuzzy→suggest, patronymic fragment→review, MRZ→preserve, unknown authority→review). tsc 0; full suite 2931/4. ADR-017 §D2 contract added.
- **Phase 1.3 DONE (code):** ONE shared helper `canonical/core/knowledgeBrain.ts` (isKnowledgeBrainEnabled / buildKnowledgeContext / applyKnowledgeBrainIfEnabled) — wired translation/tps/reparole/ead at the arbitration seam (1-line diff each, no route-local dictionary logic, no four forks). OFF deep-equals bare arbitration; ON=conflict→review. 18 helper/normalize tests; full suite 2937/4; tsc 0. Legacy /api/ocr/extract + generate-pdf are NOT arbitration seams (no D2 fork). Proof: docs/reports/KNOWLEDGE_BRAIN_PHASE_1_3_WIRING_PROOF.md.
- **BINDING CONTRACT recorded (ADR-017, owner-approved 2026-06-09) → Phase 2 unblocked.** D2 annotates only (never writes final_value); **C3 is the single writer of `final_value`** (accept_final→final_value=normalized_value, else null; D5 confirmation re-runs C3); **D6/PDF reads only final_value**, critical null→block; one criticality taxonomy for D2+C3; adapters must not drop suggested/rule_id/provenance/reason_codes/evidence_strength/review_required. Primary risk now = downstream bypass; defense = final_value=null until C3/confirmation. Phase order: 1.4 fixtures → 2 Core-default (one product at a time) → 3 explicit final_value + C3 final writer → 4 Knowledge canary (after Core-default) → ReaderResult/crop later.
- **Phase 1.4 DONE (real-doc proof, flag ON, real Gemini).** Safety holds on real Soviet + handwritten birth certs: D2 provenance on every field, conflict→review+suggestedValue (patronymic.fragment / authority.unknown), no silent override, no Cyrillic leaks. **FINDING:** D2's Cyrillic rules (gazetteer / RU-spelling / normalizeName) are bypassed live — docintel KMU-55-transliterates to Latin BEFORE arbitration (Cyrillic in a separate cyrillicMap; FieldCandidate has no rawCyrillic). Safe but accuracy value not yet delivered. → Phase 2.0 prerequisite: thread rawCyrillic to D2.
- **KNOWLEDGE INVENTORY + AUDIT SYNTHESIS DONE (2026-06-09)** — read live data inventory + 4 prior audits. TWO critical findings: (1) a dictionary-in-path layer ALREADY exists at the RIGHT place (raw Cyrillic) — `SMART_NORMALIZE_ENABLED` P2.1-P2.3 (Door A toCanonicalValue→snapCity; Door B documentFieldReader patronymic/authority). My Phase-1 knowledgeBrain at arbitration is at the WRONG layer (post-KMU-55 Latin) and DUPLICATES it → Phase 2.0 reframed as RECONCILE-to-one-layer (keep my KnowledgeDecision contract, apply at Door A/B, retire arbitration duplication). (2) Dominant real failure = `wrong_person_selected` (model reads a DIFFERENT identity; 2.5-pro false-confidence) — NOT a dictionary problem; defended by always-review policy + model choice + reshoot. Coverage: gazetteer/settlements = SEED (35/458 vs ~28-30k). Bug: deprecated gemini-2.0-flash (404) in fallback chain. HARD GATE: any dict layer in prod FORBIDDEN until owner GT + OFF/ON delta. Report: docs/reports/KNOWLEDGE_INVENTORY_AUDIT_SYNTHESIS_2026-06-09.md.
- **CYRILLIC CONSTITUTION assembled (docs/architecture/ONE_BRAIN_CYRILLIC_CONSTITUTION.md)** — owner's iron constitution mapped node-by-node to real code. Traced the Cyrillic highway: Gemini reads `VisionFieldRead.cyrillic`; `documentFieldReader.ts:70` runs `toCanonicalValue` IN the read loop → `value`=KMU-55 Latin + `raw_cyrillic` kept alongside (`:76`); `docintelToCandidate` (translationAdapter:50) DROPS raw_cyrillic (FieldCandidate.value=Latin; Cyrillic only in a side cyrillicMap for display). GAP A = raw_cyrillic dropped from Core record; GAP B = D2 partial at toCanonicalValue (city/oblast on Cyrillic) but name=bare KMU-55 no RU/UA check; GAP C = 3 D2 sites/2 flags (Door A toCanonicalValue + Door B documentFieldReader post-pass SMART_NORMALIZE + my arbitration knowledgeBrain); GAP D = no final_value, C3 post-adapter on Latin. documentFieldReader IS the one shared door (all 4 products).
- Realization: D2=ONE layer at the one door on raw_cyrillic (upgrade toCanonicalValue+Door B to KnowledgeDecision, retire arbitration dup, one flag); carry rawCyrillic+decision FORWARD into FieldCandidate/CanonicalField; final_value + C3 single writer; PDF reads final_value only.
- **PRODUCT READINESS COMPARISON done (docs/reports/PRODUCT_READINESS_COMPARISON_2026-06-09.md):** 4 products = 4 stages of one migration. Pipeline alignment to Constitution: Reparole 85% (reference: Gemini-Core+MRZ, no ungated fallback) > EAD 80% (cleanest arch, but US-doc registry specs UNPROVEN + no scorable fixtures, thinnest UX) > Translator 60% (3 branches) > TPS 40% (default = Vision/DocAI + rule modules; Gemini only passport/booklet). **FLAGSHIP PARADOX: Translator birth/marriage are `auto:false` → vision-extract NEVER called → manual ticket (incident RC-1, STILL TRUE)** — the most polished product is worst on exactly the docs where Cyrillic matters; the now-proven safety stack makes auto-read safe → added Phase 2.1a (unbypass). TPS convergence narrowed to UA-docs only (keep deterministic US-form modules). Added 2.2a EAD registry proof.
- Next: Phase 2.0 reconcile D2 to the one door on raw_cyrillic + carry forward; then 2.1a flagship unbypass. Branch feat/one-brain-gemini-core (PR #104). No prod/keys/PII change.

## P0 FIX: vision-extract 502 root-caused + fixed (the original "0 results" incident)
- RUNTIME PROOF (preview): ead no-fields probe → HTTP 200 (was 502 on prod); blank birth-cert → 200 all-review, no fabrication. PR #99.
- Root cause: route returned HTTP 502 whenever it recognized ZERO fields (final return `status: ok ? 200 : 502`). NOT a crash/timeout/provider issue — direct-origin probe returned the full valid JSON body with a 502 status; Cloudflare masked it as "error code: 502". Affects real hard-case docs that read 0 fields. Fix: return 200 with ok:false+status+error+review_required (matches the route's other non-fatal returns). tsc 0; suite 2919/4. See docs/reports/VISION_EXTRACT_502_TRIAGE_2026-06-06.md.
- C3 merged but canary BLOCKED by this 502 (now fixed, PR open). OCR_FIELD_SAFETY_ENABLED remains OFF. Re-run canary only AFTER this fix merges. ReaderResult/OneBrain HOLD.

## OCR field-safety canary = DEGRADED (rolled back); pre-existing vision-extract 502 found
- Canary run 2026-06-06: enabled OCR_FIELD_SAFETY_ENABLED=1 + redeploy → route proof blocked by a 502 on the Translation model-read path. 502 REPRODUCES with flag OFF (two redeploys, commit 0d3d82b) → pre-existing, flag-independent; the safety gate never ran. Rolled back to OFF (proven-safe baseline). See docs/reports/OCR_FIELD_SAFETY_CANARY_RESULT.md.
- prod==main==0d3d82b, healthz ok, flag ABSENT/OFF. NEW finding (out of C3 scope, NOT proven for real uploads): vision-extract returns 502 on synthetic gate-reaching requests — needs separate triage. C3 stays code-ready/prod OFF. D0/ReaderResult/OneBrain HOLD until a real-document canary is clean.

## C3 MERGED to main — global OCR field safety code-ready; canary = owner
- Stack #94→#95→#96 MERGED (origin/main 0d3d82b). Guard wired into all 4 flows behind `OCR_FIELD_SAFETY_ENABLED` (ABSENT/OFF in prod — verified vercel env ls). tsc 0; full suite 2913. Flag-ON proof: docs/reports/C3_OCR_FIELD_SAFETY_PROOF.md. Canary runbook: docs/reports/OCR_FIELD_SAFETY_CANARY_RUNBOOK.md.
- Prod deploy of 0d3d82b catching up through the 3 stacked merges (flag OFF = byte-identical). D0/ReaderResult/OneBrain HELD until owner canary. No model/provider/prod-env change.

## C3 wiring COMPLETE — guard wired into all 4 flows behind OFF flag
- `OCR_FIELD_SAFETY_ENABLED` (default OFF). Wired: Translation public (vision-extract), TPS merge (tps/ocr/extract), legacy boundary (/api/ocr/extract), PDF/payment (generate-pdf via hasUnresolvedCriticalForOutput).
- candidate≠final enforced; zero-recognition≠success; unsafe critical → candidate-only+review/manual; PDF blocks unresolved critical. tsc 0; documentSafety 28 tests; full suite 2913 passed (incl. flag-ON proof). OFF=byte-identical. Prod flag NOT enabled; D0/ReaderResult/OneBrain HELD.

## ✅ Containment guard built (ocrFieldSafetyGate) — pure, tested, NOT yet wired
- `lib/documentSafety/ocrFieldSafetyGate.ts`: one global guard, PII-free by construction (no value in/out),
  enforces the 10-rule contract (candidate≠final; zero-recognition≠success; source/stale/hard-case/legacy/low-conf
  → not final). + `hasUnresolvedCriticalForOutput` (shared PDF/payment gate). tsc 0; 18 guard tests; full suite
  2893 passed. Pure/unwired → prod byte-identical. **Next: wire into Translation/TPS/legacy/PDF behind
  `OCR_FIELD_SAFETY_ENABLED` (default OFF), per-flow + tests.** D0/ReaderResult/OneBrain still HELD.
<!-- P0 docs PII-scrubbed: incident identity values replaced by placeholders -->

## ⛔ Global OCR / Recognition = INCIDENT / NOT TRUSTED (2026-06-06)
Owner uploaded a birth cert → translator gave **0 results**; TPS showed a wrong/flagged patronymic (a truncated patronymic suffix)
+ many blank fields. Prior narrow PASS verdicts were per-endpoint, NOT global. **All next brain layers FROZEN**
(D0 prod / ReaderResult / OneBrain / HTR / 2nd provider / SMART / model work).
**P0 forensic audit COMPLETE (docs-only, no code changed):**
- `docs/reports/P0_OCR_FLOW_INVENTORY.md` — 6 reader paths, 4 safety regimes (Gemini-gated / DeepSeek-ungated /
  TPS-legacy-modules-ungated / gpt-4o-mini-ungated).
- `docs/reports/P0_FIELD_LIFECYCLE_MAP.md` — per-field origin/flag/final/PDF trace; where safety is lost.
- `docs/reports/P0_ROOT_CAUSE_ANALYSIS.md` — RC-1 birth `auto:false`→0 results; RC-2 wrong value shown AS value
  (candidate≠final not enforced — "a truncated patronymic"); RC-3 six paths/four regimes; RC-4 TPS multi-doc; RC-5 core→legacy fallback ungated.
- `docs/architecture/GLOBAL_OCR_FIELD_SAFETY_CONTRACT.md` — 10 binding rules.
- `docs/reports/P0_OCR_SAFETY_TEST_PLAN.md` — RED-first regression tests.
Ruled out: NOT my D0 (flag absent in prod), NOT the gates (keep values), NOT a crash (0 errors), NOT Supabase.
**Next phase:** adopt the contract → build shared `ocrFieldSafetyGate` + RED tests → only then resume D0/ReaderResult/OneBrain.

# STATUS (2026-06-05 — honest, no overclaiming)

## D0 quality/reshoot — IMPLEMENTED behind flag OFF (first real brick)
- `lib/docintel/quality/documentImageQuality.ts`: image metrics → ACCEPT / DEGRADED_REVIEW / RESHOOT_REQUIRED
  + reshoot messages. Flag `QUALITY_GATE_ENABLED` default OFF → prod byte-identical. Inert hook in translation
  vision-extract route. Blur is NEVER a fabrication signal. tsc 0; D0 16 tests; full suite 2875 passed.
- NOT enabled in prod. Next (Gate 2) = ReaderResult interface. Enabling D0 in prod = separate owner decision.

## Agent rails in place (operating contract + phase gates + D0 start pack)
- Refined: Gemini-first guardrails hardened — "Gemini-first ≠ fan-out", "HTR research ≠ implementation",
  and a Gemini top-version benchmark must precede ANY non-Gemini provider discussion.
- `docs/architecture/AGENT_OPERATING_CONTRACT.md` = the law (live vs target, autonomy boundaries, evidence
  contract, phase-gate order). `docs/reports/RECOGNITION_PHASE_GATES_CHECKLIST.md` = Gates 0–6.
- Next CODE step = D0 quality/reshoot (`docs/reports/NEXT_PROMPT_B_D0_QUALITY_RESHOOT.md`), flag default OFF,
  ONLY after clean 24–48h monitor + owner "start D0". HTR/2nd provider/OneBrain stay gated.

## Reader strategy = GEMINI-FIRST (locked 2026-06-05)
- Near-term reader work stays within the Gemini family (top versions/benchmarks). A second reader = a
  provider-agnostic DISABLED slot — GPT-4o/Claude NOT near-term; HTR research-only. No fan-out until ROI proven.
  All gated on GT breadth from different people + owner decision. (Roadmap docs corrected via follow-up PR.)

## Recognition structure roadmap accepted (docs-only; build = next, phased)
- Truth map + target D0–D6 + 10-phase build plan + 5 next-prompts written (see CHANGELOG / OWNER_QUEUE).
- Order: monitoring closeout → D0 quality → ReaderResult contract → OneBrain shadow → D2/D3/D4 → Auditor;
  HTR/GPT-4o research only AFTER GT from different people. Still a safety wrapper, NOT a full brain.

## Wave D monitoring ACTIVE (PASS_RUNTIME_VERIFIED reached; PR #86 merged)
- Read-only healthz workflow `.github/workflows/prod-safety-monitor.yml` (every 6h, no secrets, self-no-ops
  after 2026-06-07 — delete after window) + manual runbook `docs/reports/PROD_SAFETY_MONITORING_24H_RUNBOOK.md`.
- Watch 24–48h: 5xx, document_class_metric count, review_rate (incl. printed-birth-cert false positives),
  self-consistency latency/cost, UI/PDF block. Rollback: SELF_CONSISTENCY first, keep ANTI_FAB (owner-confirm).
- No new architecture (HTR/OneBrain/GPT-4o/SMART/L2-WIRE parked). Next real unblock = GT from different people.

## Translation hardening — NOW IN PROD (verified 2026-06-05 01:43)

- ✅ **Live in prod**: PR #84 merged; `origin/main` = `2d2a391`; review-gate commit `e298d97` is an ancestor
  of main; prod `healthz` sha = `2d2a391` == main. The fix that was "local only" last entry IS now deployed.
- (history) Public Translation Wizard false-readiness gap CLOSED:
  - OCR `review_required` fields now block payment and PDF download
  - user can explicitly confirm unchanged flagged OCR values
  - `/api/translation/generate-pdf` now rejects unresolved OCR review fields from the legacy public wizard payload
- Local proof:
  - Typecheck PASS
  - Vitest PASS
  - Build PASS
  - Live local browser run on `/en/services/translate-document/start` with real booklet fixture:
    - `reviewBadgesBefore=4`
    - `confirmButtonsBefore=4`
    - `payDisabledBefore=true`
    - `reviewBadgesAfter=0`
    - `confirmButtonsAfter=0`
    - `payDisabledAfter=false`
- Evidence: `docs/reports/TRANSLATION_REVIEW_HARDENING_2026-06-04.md`
- Independent re-verify (agent, raw): tsc 0 errors; full suite **2859 passed / 4 skipped** (matches claim);
  server gate logic + wizard block + tests read and correct. Build NOT re-run by agent (tsc+suite = proxy).

## Production Safety Gates — PASS_RUNTIME_VERIFIED (2026-06-05, prod==main==7c6068c)

| Gate | Env (prod) | Firing proven | Evidence |
|------|-----|-----------------|----------|
| ANTI_FABRICATION_GATE | **present** (`vercel env ls`, set 2h ago) | **YES — prod + local agree** | owner prod-HTTP: 8/10 review=true, ALL identity protected (corroborated by logs, 0 errors); agent local real-model: 5/5 identity forced, reasons attached, values unchanged. Field-for-field match. |
| SELF_CONSISTENCY_GATE | **present** (set 1h ago) | **YES (runtime, local real-model)** | `self_consistency=mismatch` (2 reads disagreed on identity) → forced review. |
| DOCUMENT_CLASS_METRICS | **present — RUNTIME VERIFIED =1** | **YES** | multiple `[document_class_metric]` on real prod `POST /vision-extract` 200 (01:01–01:03, 02:01–02:02) |
| (extraction path) | — | **HEALTHY** | all vision-extract / tps-ocr 200; **0 error/fatal**. No regression. |
| SMART_NORMALIZE | **absent** | N/A | DO_NOT_ENABLE ✅ |

> Gate firing is now **prod-runtime-observed** (owner's controlled hard-case upload) AND independently
> reproduced by the agent's local real-model proof — the two agree field-for-field. Remaining honesty note:
> env `ls` shows presence not the literal `=1` value (metric proves its own flag `=1`; the two gate flags are
> presence + set-time + the observed firing). This is a **safety wrapper working in prod**, NOT a full OneBrain.
> Full report: `docs/reports/POST_RUNTIME_GATE_VERIFICATION.md`. **Next: monitor 24–48h.**

## What is NOT live (do not claim otherwise)

- HTR: dead (auth 401)
- GPT-4o second reader: code exists, not in live path
- consensus.ts: dormant (gated by ONE_BRAIN_CORE)
- OneBrain/decideField: PARKED, 0 callers
- Quality signal to readDocument: not threaded

## Accuracy (measured, owner GT, N=6/1 person)

- Printed: 60-83% (live-door-scorable fields only)
- Hard-case: 25% (1/4 identity). Model Russianizes Ukrainian.
- false_negative_review mode C = 0

## Decisions (ADR-016)

- Hard-case UA = human review by policy
- PII = internal-only forever (CLOSED)
- OneBrain = PARKED until GT≥50

## Next owner action

ONE CONTROLLED UPLOAD of a hard-case document through messenginfo.com UI.
This is the ONLY way to change status from ENABLED_BY_ENV to RUNTIME_VERIFIED.

## 2026-06-04 — TARGET SCHEME FILE VERIFICATION

- Report added: `docs/reports/TARGET_RECOGNITION_SCHEME_FILE_VERIFICATION_2026-06-04.md`
- Verified file-by-file against the requested D0..D6 + Auditor scheme.
- Verdict: the scheme exists as documentation and as parked `engine/*` / `central-brain/*` code, but the live product spine is still `docintel/documentFieldReader.ts` + `geminiVisionProvider.ts` + `canonical/core/arbitration.ts`.
- Confirmed mismatch to the exact target:
  - `consensus.ts` exists but is not the live default Chief Engineer.
  - `models.ts` contains Gemini/GPT-4o/Vision readers, but not as the active multi-reader production fanout.
  - `htr.ts` exists, but HTR is not proven live and not the active reader path.
  - D0 preprocess is real, but it does not cut documents into line crops as claimed in the target scheme.
  - D2 KMU-55 is live; gazetteer/patronymic are real but partly flag-sensitive, not universally "inside the brain by default".
- Current truth:
  - target scheme documented = PASS
  - most building blocks present in repo = PASS
  - project already matches the exact target scheme in live runtime = FAIL

## 2026-06-04 — LATEST AUDIT / INVENTORY RECONCILIATION

- Report added: `docs/reports/LATEST_AUDIT_INVENTORY_RECONCILIATION_2026-06-04.md`
- Verified latest report layer against current code.
- Current trustworthy layer:
  - `TARGET_RECOGNITION_SCHEME_FILE_VERIFICATION_2026-06-04.md`
  - `ARCHITECTURE_INVENTORY_VERDICT.md`
  - `BASELINE_MATRIX.md`
  - `GT_ACCURACY_VERIFICATION.md`
  - `ACCURACY_OFFON_RESULTS.md`
  - `LIVE_DOOR_SCORABLE_COVERAGE.md`
  - `RECOGNITION_ROADMAP_FROM_CURRENT_TO_TARGET.md`
- Partially stale snapshots:
  - `PROJECT_ARCHITECTURE_VERDICT.md`
  - `DOCUMENT_CLASS_EXTRACTION_MATRIX.md`
  - parts of `KNOWLEDGE_CORE_INVENTORY.md`
- Strongest stale point confirmed by code:
  - older reports saying `ua_military_id` is absent are now false; registry entry exists in `docintel/documentRegistry.ts`
- Reconfirmed live truth:
  - default runtime spine is still `readDocument()` -> Gemini provider -> arbitration/gates
  - exact target multi-reader consensus runtime is still not live

## 2026-06-04 — CRITICAL LIVE-DOOR RE-VERIFY

- Report added: `docs/reports/CRITICAL_REVERIFY_LIVE_DOOR_2026-06-04.md`
- Correction to earlier over-broad audit wording:
  - `snapCity` IS already wired into the live door, but behind `SMART_NORMALIZE_ENABLED`
  - patronymic reconcile IS already wired into the live door, but behind `SMART_NORMALIZE_ENABLED`
  - authority resolve IS already wired into the live door, but behind `SMART_NORMALIZE_ENABLED`
  - anti-fabrication and self-consistency ARE already wired into `readDocument`, but behind flags
  - `garbageGuard` is runtime-used in UI/review surfaces, but NOT server-side in `readDocument`
- Strong corrected truth:
  - "not wired at all" was too rough for several D2 / gate components
  - more exact status = wired, but flag-gated and OFF by default

## 2026-06-04 — PROJECT UNDERSTANDING MASTER

- Report added: `docs/reports/PROJECT_UNDERSTANDING_MASTER_2026-06-04.md`
- Full-project understanding pass completed across:
  - startup truth docs (`AGENTS.md`, `STATUS.md`, `HANDOFF.md`, `SOURCE_OF_TRUTH.md`, `CHANGELOG.md`)
  - accepted ADRs
  - top-level repo structure
  - `apps/web/src/lib/*`
  - product OCR routes
- Strongest verified understanding:
  - this repo contains **three architectural eras at once**
    1. legacy TPS/product-specific pipelines
    2. current shared live `docintel` + `canonical/core` spine
    3. parked / target `central-brain` + `engine/consensus` layer
  - project understanding must distinguish these planes instead of flattening them into one claim
  - TPS merge brain (`lib/tps/centralBrain.ts`) is a separate live plane, not dead code
- 2026-06-10 clarified L1_T0_ACTIVATION_CHECKLIST: 3 distinct secret-sets (baseline≠crons≠drift-guard); baseline data needs only GUARD_BLOCK_METRICS_ENABLED in Vercel.
- 2026-06-10 HANDWRITTEN: live prod test on REAL handwritten cert → found+FIXED review_reasons loss (translationAdapter 2 boundaries, TDD +4); +handwrittenCyrillicE2E.test.ts (+4, full chain real functions); GT templates UNFILLED (owner: fill 3 JSONs). 3207 passed.
- 2026-06-11 fix: L1 crons .contains on jsonb reasons → JSON.stringify (22P02 in live run, diagnosed from gh logs)
- 2026-06-11 cleanup: PII-trail 0 rows (verified), OPS_INCIDENT_LOG + PROD_RISK_NOTES created (F1/F2, exact handwritten wording, boundary-loss audit, alert-logic-untested). No code/env changes.
- 2026-06-11 GT filled (3 files, owner qa-private merged + agent visual reads) + FIRST REAL BENCH: 11/12 (91%), SILENT-WRONG=0, INSUFFICIENT_N honest. Report committed PII-free.
- 2026-06-11 fix: repaired printf-truncated CHANGELOG bench entry.
- 2026-06-11 silent-wrong fix: ua_birth_certificate all fields handwritten:true (real GT-bench catch: act_record_number wrong+unflagged); +3 regression tests; 3 stale tests updated. 3214 passed.
- 2026-06-11 incident: manual CLI deploy broke vision-extract (504) → rolled back per runbook, service restored; rule: git-push deploys only.
- 2026-06-11 CLOSED LOOP: after-fix re-bench on the real cert → SILENT-WRONG=0 (act_record_number now review-gated); 6/9 match, all 9 review-gated; service healthy on git build aaed819.
- 2026-06-11 methodology fix: GT field_provenance added (gold vs agent-proposed); bench report REVISED with separated numbers + CI[62,100] + shadow-mode disclaimer + act# caveat. Verified: bench-1 11/12 was ALL-GOLD (not circular); full-spec had 3 agent-proposed.
- 2026-06-11 corroboration pass: father+mother CONFIRMED by 2nd independent max-zoom read (+patronymic consistency); act# AMBIGUOUS (8+crossed-7: 87 likely, 84 possible) — owner must adjudicate on the physical doc. Evidence in GT _meta; provenance NOT flipped (owner-only).
- 2026-06-11 critic-round closed: docs 2-3 full-spec bench (mil 5/5 incl doc_number-vector, pass 3/3, SILENT-WRONG=0 everywhere); kind↔anti-fab audit done → marriage+divorce same-vector flags flipped (TDD, +6 tests); post-deploy-smoke workflow added (CI gap); ARCH_DEBT handwritten-assumption recorded; provenance was ALREADY applied (81bb43e). 3220 passed.
- 2026-06-11 untracked triage: 15 PII-bearing reports → qa-private/reports (gitignored, LAW 5); 11 clean historical reports committed; 4 daily-briefings → qa-private/briefings (personal artifacts, duplicate CHANGELOG function — reversible decision).
- 2026-06-11 bench report: per-document numbers section added (mil 5/5, pass 3/3, birth 4/6; silent-wrong 0 everywhere).
- 2026-06-11 C-ACTIVATION: 6 env-vars live (baseline clock started; paid-incident handling on; T0 receiver armed; OCR guard on; shadow pinned). Enforce+override stay gated. Deploy via git (CLI forbidden per incident).
- 2026-06-11 INCIDENT+ROLLBACK: OCR_FIELD_SAFETY=1 nulled critical values (candidate-only, no anchor) → TPS/translation showed 'не найдено'. Owner T+24h test caught it; rollback <10min (cdc0785). Flag needs UI-aware integration before re-enable. Smoke must assert values.
- 2026-06-11 lessons IMPLEMENTED (not just listed): (1) post-deploy-smoke now VALUE-CHECKING (fails on nulled-values-with-200 — the exact incident mode); (2) UI-aware candidate render in TPS+Reparole ingest (safety-demoted value → prefill raw_value + forced review, not 'Не найдено'). Tail-1 closed with DATA: vertical real doc post-rollback = 10/10 values SET (vertical was the flag symptom). Tail-2: all session tables 0/24h = owner stopped at the broken extraction screen (sessions created later) — no DB anomaly; owner-login = setup step (/api/owner/request-code, OWNER_EMAILS set in prod).
- 2026-06-11 OWNER UI-FAIL ROOT CAUSES (не распознавание!): (1) birth/marriage autoread был OFF (NEXT_PUBLIC_HARD_CASE_AUTOREAD_ENABLED отсутствовал) → визард шёл в manual-fallback НЕ вызывая extraction → env=1 поставлен; (2) военника НЕ БЫЛО в DOC_TYPES визарда → добавлен (military, autoread, ua_military_id, 6 insertion points); (3) загран правильным путём = 5/5 SET incl номер+expiry (3 поля у owner'а = окно сломанного флага). + Telegram NATIVE Bot API (TELEGRAM_BOT_TOKEN+TELEGRAM_CHAT_ID) в оба alert-пути — BotFather 3 мин вместо самодельного webhook.
- 2026-06-11 ROTATION VERIFIED LIVE: real doc pixel-rotated 0/90/180/270 → 10/10 fields+values+cyr, family MATCH vs GT on ALL four (autoOrient works). TEMPLATES truth: dictionaries DO apply (values are KMU-55); structural mirror templates exist for 5 certs only; passport/military/ID render generic; wizard sample previews were stub dashes → upgraded to real registry field sets (passport_foreign 5, birth 8, marriage 5, id_card 4, military 4).
- 2026-06-11 SILENT-DROP UI bug FIXED (the REAL passport-3-fields cause): translation review table filtered fields through a 6-key booklet-only label map → passport number/expiry, 9/10 birth-cert fields, military doc_number SILENTLY DROPPED. New translationFieldLabels.ts (full registry coverage, test-pinned 7 tests) + ukrLabelFor fallback (never drop). Mentor's null-render premise was the wrong mechanism (owner's '—' was the SAMPLE-stub path, fixed earlier); the label-filter was the live hole.
- 2026-06-11 TRIPLE-CLOSURE: (3) synthetic generators birth/military/marriage written+validated vs prod (birth 10/10, military 5/5 after size fix; marriage gen ready) + README; (2) ua_military_id mirror schema (source=official booklet blank, verified vs real doc; keys=docintel, no aliases) + registry + 2 tests (PDF renders, [CONFIRM] works) + stale no-schema test updated; (1) Playwright E2E wizard smoke (config+spec birth/military+workflow on deployment_status) + methodology entry in OPS_INCIDENT_LOG; first live run in progress.
- 2026-06-11 FULL-COVERAGE P1/3/4/7 docs: DOC_COVERAGE_MATRIX (10×12, gaps W1/F1/F2/M1/S1/US), HANDWRITING_RULES_PER_DOCCLASS (vintage=true 5/5, printed=false 5/5, anti-fab cross-ref), DICTIONARY_RULES_INVENTORY (KEY: translationRule = declarative, исполнение upstream), HANDWRITTEN_CYRILLIC_COVERAGE_PROOF (fixtures×prod, rotation 4-way, E2E 2/2 GREEN, edge: HEIC/PDF unsupported, 45° limitation).
- 2026-06-11 FULL-COVERAGE code: divorce в TranslateWizard (tile+samples+title, autoread) + divorce→marriage_apostille docClass mapping + 2 synthetic generators (divorce 5/5, id-card 5/5 vs prod) + labels-test +divorce (8/8) + /supported-documents страница (registry-driven, 4 локали, 10 классов, ✍️-бейджи) + линк из визарда + E2E spec → 6 классов + inventory-page check.
- 2026-06-11 CI-smoke fixes: marriage/divorce fixtures bumped past the 300KB apostille quality-gate (paper-grain noise; marriage now 6/6 vs prod); page-test locators .first() (strict-mode). 4/6 wizard cases were already green in CI incl divorce/passport/id-card.
- 2026-06-11 E2E COMPLETE: все 6 wizard-кейсов GREEN в CI (marriage 22.7s после fixture-fix; military через retry=транзиент); page-тест починен (бейдж внутри collapsed details → scoped expand) и зелёный локально 921ms.
