# CHANGELOG

## 2026-06-10 (feat: synthetic L2 fixture pack + runner smoke-test + GH-secrets setup doc, CODE, agent)
- Goal: lower the owner's activation energy for L2 (worked examples) without building an inert module. INDEPENDENT DEVIATION from the prompt's proposed fixture schema (`fixture_id`/`mock_ocr_output`/`expected_status`): it conflicts with the already-built-and-tested `GroundTruthFixture` format the real runner consumes — a second format would be a forbidden parallel schema AND the smoke test could not exercise the real runner. Reconciled by delivering the worked examples in the EXISTING `GroundTruthFixture` shape (so they actually run) with the rich illustrative content (mock OCR, expected behavior, adversarial category, synthesis notes) carried in `_`-prefixed keys that `parseFixture` ignores.
- 3 synthetic worked-example fixtures in benchmark/examples/: `passport_ua_normal` (clean baseline, no adversarial), `birth_cert_silent_substitution` (parent name `expected: null` — the source-script gate must fire, not a silent cross-script rewrite), `birth_cert_cyrillic_in_output` (Latin field `expected: null` — a Cyrillic-bearing value must be blocked). NEW l2RunnerSmoke.test.ts (+5): loads the 3 → runs the REAL `runAllClasses` → asserts (a) verdict INSUFFICIENT_N (N per class < 30), (b) per-field accuracy still computed, (c) a safe reader yields zero false-finalizations AND a broken reader that finalizes a must-not-finalize field is CAUGHT as `critical_wrong` (≥2). Proof-of-flow before any real data.
- NEW docs/ops/SETUP_GITHUB_SECRETS.md: exact steps to activate the drift-guard (where to get SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF=rtfxrlountkoegsseukx / SUPABASE_DB_PASSWORD, how to add them in GitHub Actions, verify via workflow_dispatch, rollback). Added a worked-examples pointer to L2_FIXTURES_HOWTO.
- PII audit: 0 real names/DOB/numbers — synthetic only (Ivanenko / Taras / Petrovych / 1990-01-01 / Sergii). Placement note: fixtures live in benchmark/examples/ (importable + smoke-tested, consistent with the existing examples) rather than docs/l2-fixtures/, pointed to from the HOWTO. 3203 passed, tsc 0, content-guard 0.

## 2026-06-10 (chore: parity verification + comment-gap fix + drift-guard (verification-only), DOCS, agent)
- Verification-only session. The canonical `supabase db diff --linked` is NOT runnable in this environment (the Docker daemon is down — it needs a shadow DB — and the local CLI is logged into a different project than prod), so parity was verified via thorough Supabase MCP introspection (information_schema + pg_get_* for every column/type, the 5 CHECK constraints, 8 indexes, 2 append-only triggers, the reject function, RLS, the read policy, and column/table comments). Result: repo migrations are STRUCTURALLY identical to prod; the only diff was 6 missing COMMENTs (the predicted comment-only gap). Per the safe-to-fix rule, added the COMMENT ON statements verbatim from prod to both migration files (guard_block_events table; certifier_override_audit table + certifier_id/tier/cross_doc_anchor_id/immutable_signature) — closing the gap without any structural change.
- Orphan grep (`failure_type | 20260610120000_guard_block | gate text | session_id text`): 0 active-code orphans. recordGuardBlock and the rate-check script already use the new schema (gate_type/reason_code/would_block); every `failure_type` hit is the legitimate TS `PaymentFailureType` enum or a historical CHANGELOG/HANDOFF entry; the `20260610120000` hits are historical log text; `session_id text` matched an unrelated translation_orders line. Nothing rewritten (history + the legitimate enum left as-is, per the branch rules).
- Activation checklist readout (read as an owner with zero context): tightened two ambiguities — added a "WHERE each variable lives" block (Vercel env for the route flags vs GitHub Actions secrets/vars for the crons; the placement was already correct but implicit) and a manual `workflow_dispatch` note for confirming the crons.
- CI drift guard added: .github/workflows/supabase-drift-check.yml (daily 09:00 UTC + manual; `supabase db diff --linked`, fails the job on drift = the alert; skips cleanly until SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF / SUPABASE_DB_PASSWORD secrets are set) — guards against any future silent prod schema change, by anyone. content-guard 0, no TS change.

## 2026-06-10 (chore: repo↔prod migration sync + Path B FK-drop wiring + activation checklist, CODE, agent)
- Owner applied the FK-drop migration (Path B) and verified it; directed "помни ты независимый инженер". Synced the repo migration files with prod from the LIVE schema (Supabase MCP `list_migrations` + `pg_get_*` introspection — exact definitions, not guesses), and made an independent honest call: the owner's 4-step MCP migration history (create → harden → drop-fk) cannot be byte-replayed from introspection (the DB retains only the FINAL state), so the repo gets FINAL-STATE reconstruction files (exact DDL) headed with a note that the canonical source is the Supabase migration history (`supabase db pull` for CLI-exact files). Deleted the conflicting hand-written duplicate `20260610120000_guard_block_events.sql`.
  - NEW supabase/migrations/20260610223933_l1_observability_guard_block_events_and_alert_escalation.sql (guard_block_events with the real columns gate_type/reason_code/field_name/would_block/session_id-uuid + indexes + RLS; manual_review_queue escalation columns).
  - NEW supabase/migrations/20260610224523_l3_t0_certifier_override_audit_persistence.sql (certifier_override_audit: the 5 ADR-021 CHECK constraints, 6 indexes, reject_audit_modification() with hardened search_path, the two append-only UPDATE/DELETE triggers, RLS + the consolidated admin-or-own read policy; certifier_id is a SOFT uuid — the FK to profiles is folded out per Path B).
- PATH B verified independently against the LIVE DB: a placeholder uuid (00000000-…-001) INSERT succeeded (RETURNING) then ROLLBACK — confirming the FK is gone and the exact column mapping works. The TS code already accepts any uuid (`asUuidOrNull`, no FK assumption); added a Path-B unit test. Added an `.env.example` block (OWNER_CERTIFIER_ID + the 6 safety-ops flags, all default OFF) and docs/ops/L1_T0_ACTIVATION_CHECKLIST.md (paste-ready Step 0→4: prereqs → 14-day baseline → A-full → T0 canary → L2 fixtures, with rollback). +1 test. 3198 passed, tsc 0, content-guard 0. The append-only triggers are DB-level (owner-verified via MCP; not unit-testable in vitest). No Supabase apply from the agent side — the owner handles applies via MCP.

## 2026-06-10 (feat: L3 T0 audit writer (verified vs real DB) + adversarial fixtures, CODE, agent)
- Owner applied the T0 Supabase migrations directly ("все ты дальше"). Built the TS receivers against the owner's REAL applied schema (queried via Supabase MCP `information_schema`, not guessed) — and the verification caught TWO real findings:
  1. `guard_block_events` columns differed from the repo migration: owner's actual = `gate_type / reason_code / field_name / would_block / session_id (uuid)`. Fixed `recordGuardBlock` (+ the two route call sites) to the real columns, added `asUuidOrNull` coercion (session_id is a uuid column), and realigned the repo migration file to mirror the applied schema (repo ↔ prod, idempotent).
  2. `certifier_override_audit.certifier_id` has a FOREIGN KEY → `profiles`, and `profiles` is currently EMPTY → durable persistence will fail the FK until a profile exists. Surfaced as an owner action; the writer logs `persist_failed` so the gap is visible, never silent.
- NEW persistCertifierAudit.ts: `buildAuditRow` (pure) maps a CertifierAuditRecord to the exact columns and enforces all 5 DB CHECK constraints in code (reason_code ∈ 6 certifier codes, tier ∈ 1-3, other_with_text⇒note, unreadable⇒null new hash / else non-null, user_clarified⇒tier 3) — verified against the live DB with a `BEGIN/INSERT/ROLLBACK` (columns + checks passed; only the empty-profiles FK failed). Skips `user_confirmed` and block/reject (not acted attestations); uuid-coerces session/pdf/anchor; `OWNER_CERTIFIER_ID` env supplies the certifier uuid. Behind `CERTIFIER_AUDIT_PERSIST_ENABLED` (default OFF). Wired into `certifierOverrideApply` (now async; the generate-pdf route awaits it).
- (A) Adversarial fixtures made MANDATORY (owner rule): added examples/adversarial.example.json + a 6-category table in docs/L2_FIXTURES_HOWTO.md (wrong-person, silent substitution, illegible critical, cyrillic-in-output, soviet bilingual mismatch, pre-2020 admin unit), requiring ≥3 categories per class, with a validity test (the adversarial example must carry ≥3 must-not-finalize fields). Otherwise the benchmark measures "works on easy" and proves zero safety invariants.
- +16 tests. 3197 passed, tsc 0, content-guard 0. Owner actions: resolve the certifier_id FK (create an owner profile + set OWNER_CERTIFIER_ID, or relax the FK for the transitional owner-only phase); provide L2 fixtures incl ≥3 adversarial/class; L1 activation.

## 2026-06-10 (feat: L2 runner on-ramp — fixture format + validator + runner + howto, CODE, agent)
- Owner "делай как топовый инженер" — removed all friction on the L2 keystone so the owner only has to drop documents + ground truth + keys and it runs.
  - NEW groundTruthFixture.ts: the owner-facing GT fixture format. `FixtureField.expected: string | null` where `null` = the field MUST NOT be finalized (illegible / wrong-person). `parseFixture` validates untrusted JSON with clear errors (never throws); `fixtureToGroundTruth` maps value fields to the existing GroundTruth; `scoreFixture` reuses the proven `scoreAgainstTruth` then folds any false-finalization (a non-null prediction on a null-expected field, not review-flagged) into `critical_wrong_count` — so the class verdict's zero-tolerance rule catches a silent identity substitution, without modifying the proven scorer.
  - NEW runFixtureBenchmark.ts: `runClassBenchmark` / `runAllClasses` with an INJECTED `predict` function (the live readDocument pipeline at runtime; a stub in tests → the whole runner is unit-testable WITHOUT API keys or real documents) → per-class `ClassBenchmarkReport` with a PII-free `summarizeReports`.
  - Committed a synthetic example (examples/birth_certificate.example.json — Ivanenko, including an `expected:null` field) + a test that keeps it valid. NEW docs/L2_FIXTURES_HOWTO.md: exact owner instructions — format, ≥30 docs/class from ≥5 people, gitignored `test-fixtures/owner/` + encryption, how it runs, and that a PASS on ≥3 classes (≤7 days) is the canary permission.
- +9 tests. 3186 passed, tsc 0, content-guard 0. L2 is now code-complete end-to-end (format → validate → score → verdict → canary gate); the only remaining input is the owner's fixtures + keys.

## 2026-06-10 (feat: L2 runner core — class-level verdict + canary gate, CODE, agent)
- Built the L2 benchmark runner core (owner "двигайся"), extending the existing per-document scoring (scoreAgainstTruth → BenchmarkScore) with the missing class-level verdict. NEW apps/web/src/lib/canonical/core/benchmark/classVerdict.ts: `evaluateClassBenchmark(documentClass, BenchmarkScore[])` → N < 30 ⇒ `INSUFFICIENT_N` (an underpowered sample is undecidable, never PASS — a number, not a guess); ANY `critical_wrong_count > 0` ⇒ `FAIL` regardless of accuracy (silent wrong-critical is zero-tolerance); per-critical-field accuracy ≥ the LOCKED per-class threshold ⇒ `PASS` else `FAIL`. `CLASS_THRESHOLDS` taken verbatim from docs/architecture/GT_BENCHMARK_EXIT_CRITERIA.md (passport/booklet 0.99, military 0.98, birth/marriage/soviet-bilingual 0.97, unmapped 0.99 strict — never invented). `canaryDeployAllowed(lastPassAtMs, nowMs, 7d)` — a pure freshness gate: a canary/prod rollout requires a PASS no older than 7 days (null ⇒ never passed ⇒ blocked).
- +7 tests (N gate, zero-tolerance, locked thresholds PASS/FAIL boundary, canary freshness). 3177 passed, tsc 0, content-guard 0. STILL owner-blocked (Phase 2): the actual benchmark RUN needs the owner's GT fixtures (≥5 people × 7 classes = 35-49 docs, encrypted, gitignored under test-fixtures/owner/ — already in .gitignore). The CI canary-permission gate is deliberately NOT wired yet — wiring `canaryDeployAllowed` into CI now would block every deploy (no PASS exists until fixtures arrive); it activates after the first L2 PASS (Phase 3).

## 2026-06-10 (feat: L1 infra — guard-block table + write-hook + 3 cron workflows, CODE, agent)
- Built the L1 infrastructure layer (owner: "делай все и задействуй агентов"), mapped first with 2 parallel Explore agents for the exact Supabase-migration / GH-cron / monitoring-script patterns (no guessing). All additive and measurement-gated — no prod behavior change until the owner enables flags and sets the baseline.
  - Migration supabase/migrations/20260610120000_guard_block_events.sql: a PII-free table (gate, failure_type, doc_type, session_id — never field names/values) for the rate-alert baseline, plus manual_review_queue.last_alert_stage / last_alerted_at columns for escalation suppression. service_role-only RLS.
  - apps/web/src/lib/documentSafety/recordGuardBlock.ts (+test): best-effort insert via createAdminSupabaseClient behind GUARD_BLOCK_METRICS_ENABLED (default OFF ⇒ no-op, never constructs a client); never throws. Wired at the two guard-block points in generate-pdf (confirmed_value_guard records would_block in shadow too, so the baseline is measurable before enforce; ocr_field_safety).
  - 3 cron scripts that call the already-TESTED pure logic (thin glue only): scripts/monitoring/escalation-tick.ts (open paid_request_failed tickets → nextEscalationStage → owner alert → mark stage), daily-reconciliation.ts (ticketsForDigest ≥24h → digest email via sendDigest), guard-block-rate-check.ts (exceedsRate; threshold from GUARD_BLOCK_RATE_THRESHOLD, UNSET ⇒ Infinity ⇒ never alerts — measurement-first). scripts/monitoring/lib/owner-alert.ts posts directly to the Telegram owner webhook (dry-run when unset; avoids the Next.js import chain in a script context).
  - 3 GitHub workflows (federal-register-monitor pattern): escalation-tick (*/30), daily-reconciliation (06:00 UTC), guard-block-rate-check (hourly).
- Fixed a brittle confirmedValueGuard source-matching test (it found the first 'gate: confirmed_value_guard' substring, which recordGuardBlock now also uses — re-anchored it to the response-only '…, field: f.field' form). 3170 passed, tsc 0, the new scripts typecheck (cross-import resolves), content-guard 0. Owner actions to activate L1: apply the migration; set GH secrets/vars; GUARD_BLOCK_METRICS_ENABLED=1 to start the 7-14 day baseline (14 recommended); then set GUARD_BLOCK_RATE_THRESHOLD; then the REFUND_AUTOTICKET_ENABLED canary. Item-3 handwriting counter stays blocked on the ADDITION-C signals.

## 2026-06-10 (feat: L1-finish logic — escalation timer + reconciliation + rate-alert, CODE, agent)
- Accepted the owner's reframe (handwritten-Cyrillic translation already works via the human-in-loop review flow; HTR is a Phase-7 ~30s/field UX speedup, not a product unblocker) and the 7-phase plan. Built the L1-finish decision LOGIC as pure, deterministic (now/threshold injected), additive modules:
  - NEW apps/web/src/lib/documentSafety/ticketEscalation.ts: `nextEscalationStage` (owner cadence — 2nd owner alert at 4h, 3rd channel at 12h; monotonic, never re-fires a done stage, jumps straight to third_channel past 12h), `ticketsForDigest` (the daily reconciliation set, age ≥ 24h), `pendingEscalations` (batch).
  - NEW guardBlockRate.ts: `countInWindow` + `exceedsRate` (the alert threshold is INJECTED — calibrated from the Phase-1 baseline, never a blind hardcode; `UNCALIBRATED_RATE` = Infinity threshold = never alerts, the safe default) + `rateAlertSummary` (PII-free: counts + threshold only).
- +13 tests (escalation 7, rate 6). 3168 passed, tsc 0, content-guard 0. REMAINING L1 is the infra wiring (not unit-testable without a DB, deploy-touching, measurement-gated): a guard_block_events table + write hook; 2-3 GH-cron workflows (federal-register-monitor pattern) for the escalation tick / daily digest / rate check binding this logic to manual_review_queue + notifyOwnerAlert; and a 7-14 day baseline (flags OFF) to calibrate the rate threshold before any alert fires. Item-3 (handwriting counter) stays blocked on the ADDITION-C signals (a handwritten-origin classifier + visual_evidence_score that do not exist yet — not faked). Owner input needed: baseline window 7 vs 14 days (agent recommends 14 for a low-traffic stable baseline).

## 2026-06-10 (feat: wire L1 item-1 end-to-end into generate-pdf behind a flag, CODE, agent)
- Owner directed "дожимай". Route-wired the L1 triage + orchestration into all 4 post-payment failure points of generate-pdf behind REFUND_AUTOTICKET_ENABLED (default OFF → byte-identical prod): confirmed_value_guard 422 → user_input_invalid (correction ack); ocr_field_safety 403 → guard_block (review + owner alert); persistCertification 503 → backend_persist_failure (owner alert every case); the email-send catch → delivery_failure (check-spam ack, no refund).
- NEW paymentFailureRouteAdapter.ts: postPaymentFailure(failureType, ctx) — the flag check lives inside (OFF ⇒ no-op), and it binds the three strictly-typed reuse utilities at the boundary (sendEmail type 'payment_failure_ack'; createManualReviewTicket reasons ['paid_request_failed'] priority high; notifyOwnerAlert eventType 'manual_review_queued'). Never throws.
- Refactored handlePaymentFailure DI from separate createTicket + alertOwner to a single escalateToOwner — because the real notifyOwnerAlert is ticket-coupled (it needs the createManualReviewTicket ticketId), so create-ticket + alert is one escalation unit; modelling it as two was wrong. Extended two shared enums (verified first, map-before-wire): EmailType += 'payment_failure_ack'; ManualReviewReason += 'paid_request_failed' (type + MANUAL_REVIEW_REASONS array).
- +20 L1 tests (triage 11, handler 7 incl all-deps-throw-resolves + PII-safe escalation summary, adapter 2 flag-OFF-no-op). 3155 passed, tsc 0, content-guard 0. Verified twice (flag OFF byte-identical, pinned by the adapter test; flag ON correct via the DI handler tests + a tsc-typed adapter). Flag NOT enabled in prod — needs an OFF/ON measurement plus the escalation timer + daily reconciliation cron, which are the remaining L1 pieces (with item-2 rate-alert and item-3 handwriting counter).

## 2026-06-10 (feat: L1 item-1 core — per-failure-type triage + DI orchestration, CODE, agent)
- Owner directed proceeding now ("сам как ты думаешь и делай"). Built the L1 item-1 logic, additive (no route change, byte-identical prod):
  - NEW apps/web/src/lib/documentSafety/paymentFailureTriage.ts: the `failure_type` enum (user_input_invalid / guard_block / backend_persist_failure / delivery_failure) — the single key that drives BOTH the triage and the ack routing; the per-type TriageDecision (422 → correction_flow, no owner alert, refund only if abandoned; 403 → manual_review + owner alert, refund if unresolvable; 503 → auto_retry 3x + owner alert every case, refund only if persistent; delivery → auto_resend, NEVER refund); `failureTypeFromGate` (route gate → type); and the 4 client-facing acknowledgment templates routed by type (the 422 message requires the user to RETURN and confirm — never "no action needed"; the email-failure message says check spam; the wait-cases say no action; every body states the 24h SLA).
  - NEW handlePaymentFailure.ts: dependency-injected orchestration (sendAck / createTicket / alertOwner passed in) — best-effort, NEVER throws (a failing side-effect returns a false flag, never worsens the already-failing request), PII-free ticket reason + owner summary (failure_type + doc_type + session only), ack to the customer's own address; does NOT move money (refund stays manual). DI was chosen because sendEmail / createManualReviewTicket / notifyOwnerAlert each carry strict typed enums (EmailType / ManualReviewReason / OperatorNotificationInput) whose values were verified first (map-before-wire) — the route binds concrete adapters at the boundary instead of guessing enum values.
- +18 tests (triage 11; handler 7, incl. all-dependencies-throw-still-resolves and PII-safe-summary). 3153 passed, tsc 0, content-guard 0. REMAINING for item-1: the route adapters at the 4 post-payment failure points behind REFUND_AUTOTICKET_ENABLED (default OFF) — requires extending the EmailType + ManualReviewReason enums and threading the customer email; then item-2 (rate-alert), item-3 (handwriting counter), the escalation timer, and the daily reconciliation cron.

## 2026-06-10 (docs: embed owner forward-directives into L1 kickoff (turnkey), DOCS, agent)
- Embedded the owner's two forward-directives into docs/NEXT_SESSION_L1_KICKOFF.md so the fresh L1 session inherits them rather than relying on memory: (1) STOP-ON-AMBIGUITY — if something unexpected surfaces during L1 wiring (e.g. 503 auto-retry vs Stripe idempotency, ack-routing needing a webhook path), STOP and open a mentor-discussion, do not guess; (2) AFTER L1, the priority is L2 (the GT benchmark with the owner's encrypted, GT-labeled fixtures, 35-49 docs/class) — NOT HTR / new classes / new languages (the recurring prioritization trap), because L1 dashboard numbers describe an unknown baseline until L2 exists, and L2 is owner-time that cannot be delegated. Also added a turnkey first-step note: define the failure_type enum (drives both the triage and the ack routing) + the persistence table before anything downstream. Docs only.

## 2026-06-10 (docs: L1 ack-templates per failure_type + SLA 24h confirmed, DOCS, agent)
- Owner confirmed SLA = 24h and caught a hole in the single acknowledgment template: one message is wrong because "no action is needed" actively misleads the 422 user-input case (the user MUST return to D5 to fix a field; if the email tells them to do nothing, the ticket goes 'abandoned' and the refund queue grows artificially) and the email-failure case needs a "check your spam folder" instruction. RULED: 4 templates routed by failure_type. Drafted all 4 (client-facing English) in docs/NEXT_SESSION_L1_KICKOFF.md: ack_422_correction (action required + link back to D5), ack_403_review (manual review, wait), ack_503_retry (auto-retry, wait), ack_email_resend (check spam, auto-resend). Routing key = the failure_type that drives the triage; sent via the existing Resend sendEmail (reuse). SLA 24h appears in every version.
- L1 is now fully specced (per-type triage + 4 acks + escalation timer 4h/12h + daily reconciliation cron + 24h SLA + reuse map); the fresh L1 session opens straight to code from the kickoff. Docs only.

## 2026-06-10 (docs: L1 ruling LOCKED — A-full + per-failure-type triage, SLA 24h, DOCS, agent)
- Owner ruled refund handling = A-full with PER-FAILURE-TYPE TRIAGE, correcting the agent's blanket-"A": treating all 4 post-payment failures as "ticket + refund" over-refunds the user-input and retry cases (double loss = refund + lost conversion). Triage: confirmed_value_guard 422 (user-input) → correction-flow, refund only if abandoned; ocr_field_safety 403 (guard) → review-flow + manual, refund if unresolvable after N; persistCertification 503 (infra) → auto-retry 3x + owner-alert every case, refund only if persistent; email-failure → auto-RESEND, never refund. Mandatory A-full structure: customer-facing acknowledgment email, escalation timer (4h→12h), daily reconciliation cron (>24h digest). Refund execution stays manual (owner via Stripe) for cases classified irrecoverable/user-requested; auto-refund (B) deferred (highest-risk path: needs fail-type enum + dry-run + daily cap + immutable audit + legal accounting review ≈ 2-3 sessions; A-full delivers ~80% of the user benefit in 1).
- Customer SLA = 24 hours (agent-recommended with competitive + ops reasoning: honest for owner-only transitional ops, beatable via the 4h/12h internal escalation, 24-48h is the human-reviewed certified-translation norm; missing a short SLA overnight drives the very chargeback being prevented). Owner confirms/tightens. Drafted the client-facing English acknowledgment template. Recorded the full ruling in docs/NEXT_SESSION_L1_KICKOFF.md (owner rulings RESOLVED). Fresh session for L1 implementation (payment-route sensitivity). Docs only.

## 2026-06-10 (docs: L1 grounded kickoff + paid-422 premise verified, DOCS, agent)
- Owner ruled the next work = L1 operations, NOT the D5 UI (the agent's "UI first" recommendation was the same prioritization error flagged across prior sessions: enabling an override surface before the operational layer = accumulating paid-incident exposure). Accepted.
- VERIFIED the owner's "a paid 422 is possible / chargeback risk" premise with 2 read-only Explore agents (challenge-assumptions discipline): CONFIRMED. The confirmed_value_guard 422 (~route line 207), ocr_field_safety 403 (~236), persistCertification 503 (~366), and a silent email-failure (~394, returns 200) all occur AFTER the payment gate (line 124). The new certifier_override 422 (lines 72-86) is the one block that runs BEFORE payment (safe). No refund code exists anywhere in the repo — an active financial wound, exactly as the owner said.
- Mapped L1 infrastructure to REUSE (not reinvent): Resend sendEmail; notifyOwnerAlert/notifyOperator (email + Telegram webhook; no Slack); createManualReviewTicket + manual_review_queue (auto-ticket mechanism already exists); documentClassMetric (handwriting-counter extension candidate); the federal-register-monitor GH-cron as the rate-checker pattern; tables translation_quality_log / monitoring_alerts. Gaps: no log drain (guard-block console logs are unconsumed), no Slack.
- Wrote docs/NEXT_SESSION_L1_KICKOFF.md (grounded, paste-ready): 3 items (refund + auto-ticket behind a flag; guard-block rate-alert via persist-then-cron with a shadow-measured threshold; handwriting-failure counter — flagged that ADDITION-C signals, a handwritten-origin classifier + visual_evidence_score, must be built first), reuse map, out-of-scope, DoD. Surfaced the one OWNER business ruling needed before L1 code: refund execution = (A) ticket-only + manual refund [recommended, transitional] vs (B) auto stripe.refunds.create. Recommended a fresh session for L1 implementation (dense context + payment-route sensitivity, same rationale as L0). Docs only.

## 2026-06-10 (feat: wire L0 certifier_override into generate-pdf route behind a flag, CODE, agent)
- Wired the certifier_override primitive into the live route behind CERTIFIER_OVERRIDE_ENABLED (default OFF ⇒ byte-identical prod). NEW apps/web/src/lib/documentSafety/certifierOverrideApply.ts: `applyCertifierOverrides(fields, ctx)` — disabled → fields untouched; for each field carrying a `certifier_override` payload it runs `evaluateCertifierOverride` and, on finalize, sets `final_value` and CLEARS `review_required` (resolving the review gate the certifier just attested); `unreadable_per_source` → final_value null with review kept; `block_escalate`/`reject_invalid` → returns a `{field, reason}` block. Every decision is audited via recordCertifierOverride (no PII).
- generate-pdf/route.ts: ONE guarded call inserted BEFORE the pre-payment review check (so a finalized override clears that field's review flag and the user is not asked to re-confirm it); a block returns 422 `{gate:'certifier_override', field, reason}` BEFORE any Stripe charge (consistent with the existing pre-payment philosophy). Imports docintelIdToDocumentClass to record the document_class in the audit.
- +6 helper tests (disabled→untouched/byte-identical; TIER 1 source_verified finalizes + clears review; user_confirmed alone on TIER 1 → block; anchor conflict → block; unreadable_per_source → null with review kept). 3135 passed, tsc 0, content-guard 0. Verified twice (flag OFF skips the block + the helper's enabled:false is a second guard; flag ON behaves correctly and audits). Flag NOT enabled in prod — it needs the D5 review UI to send override payloads + an OFF/ON measurement first. Honest gap: no full-route integration test (payment/auth heavy); the helper unit tests cover the decision logic.

## 2026-06-10 (feat: L0 certifier_override authorization primitive (additive), CODE, agent)
- Owner directed proceeding now ("двигайся дальше, проверь дважды, задействуй агентов"). Mapped reality with 4 parallel Explore agents (C3 finalValue door, classifyCriticality call-sites, DeepSeek flow, audit infra) before writing code; verified the plan twice. Implemented the L0 authorization primitive ADDITIVELY — no live-route or flag change, byte-identical prod:
  - NEW apps/web/src/lib/documentSafety/certifierAuthority.ts: `fieldTier(docType, field) → 1|2|3` per-doc-class matrix built from the REAL docintel field keys per ADR-021 (unmapped pairs fall back to substring criticality mapped to a tier, so an identity field is never under-protected); `REASON_TIER_MATRIX` + `isReasonValidForTier` (ADDITION A); `evaluateCertifierOverride` enforcing LAW 2#5 (TIER 3 user self-path finalizes; TIER 1/2 require certifier_override, user-alone rejected; cross-doc anchor conflict → block_escalate never override; `unreadable_per_source` → refused_null; `dual_witness` post-launch-gated; `other_with_text` requires a note + audit flag); `buildCertifierAuditRecord` (the 12-field ADR-021 schema, values sha256-hashed = no PII per LAW 5, `immutable_marker` tamper-evident) + `recordCertifierOverride` (`[certifier_override]` structured log).
  - NEW deepseekBoundaryGuard.ts: CHECKABLE LAW 7 enforcement (was only a comment) — `findDeepSeekFinalViolations` / `assertNoDeepSeekFinal` throws when a DeepSeek-sourced field carries a finalValue.
  - classifyCriticality marked SUPERSEDED (kept as the fallback used by fieldTier + the existing C3 gate; NOT removed — removal would break 5 call-sites and change prod behavior silently).
- +23 tests (certifierAuthority 16 incl the TDD anchor "user_clarified rejected on a TIER 1 field"; deepseekBoundaryGuard 7 incl the bad-fixture throw). 3129 passed, tsc 0, content-guard 0. DELIBERATELY OUT OF SCOPE (next, behind CERTIFIER_OVERRIDE_ENABLED + D5 UI, measured): wiring the primitive into the generate-pdf route — a prod-behavior change kept separate from this additive primitive.

## 2026-06-10 (docs: L0 kickoff + checklist for next session, DOCS, agent)
- Created docs/NEXT_SESSION_L0_KICKOFF.md: a paste-ready first-message prompt for the next (fresh) session that builds the L0 certifier_override primitive, plus the full HANDOFF checklist the owner specified — LOCKED doc refs (constitution + ADR-021 both @46efb8b), the TDD-anchor first test (`certifier_override_rejects_user_clarified_reason_for_TIER_1_field`), L0 PR scope (certifier_override path + criticality matrix replacing the substring classifyCriticality at applyOcrFieldSafety.ts:48-51 + tier×reason_code matrix + DeepSeek lint + 9-field audit hook), explicit OUT-OF-SCOPE (L1, gazetteer history, ADR-019 persistence, ADR-020/HTR, D5 UI), Definition of Done, and an anti-drift reminder (RULED docs — do not interpret/extend; on ambiguity STOP and ask owner).
- SCOPE CORRECTION (owner): gazetteer-history is NOT bundled into the L0 PR — it is the next work window AFTER L0 merges (a TIER-1 place_of_birth risk reducer), a sequence not a parallel, to keep the L0 PR business-sized. Owner-recommended deferring the L0 authorization primitive to a fresh session (avoiding subtle bugs from a long-session implementation of a 3-tier × 6-code × per-doc-class × anchor-conflict × out-of-matrix surface). Docs only.

## 2026-06-10 (docs: ADR-021 RULED — 3-tier certifier authority + HTR 6-condition gate, DOCS, agent)
- Owner ruled ADR-021 with substantive improvements over the draft. Q1: THREE tiers, not two — collapsing applicant DOB and issuing-authority into one bucket would make the certifier block every Soviet-bilingual doc over normal authority-spelling variance and kill throughput. TIER 1 (applicant identity, highest friction, explicit reason + side-by-side), TIER 2 (related-person identity + document validity, certifier_override but LOW friction single-click), TIER 3 (non-critical, user_confirmed). Per-doc-class field lists (A_number ≠ document_number ≠ receipt_number); patronymic is its own field; place_of_birth is TIER 1. Q2: ENUM of 6 reason codes — added `source_corroborated_user_value` (distinct legal attribution from source_verified) and `unreadable_per_source` (a documented REFUSAL that stays null, not a finalization code, so a pressured certifier can't pick a "close enough" code); `user_clarified` restricted to TIER 3. Q3: parents/spouses = critical (TIER 2) low-friction, accepted.
- AGENT CRITICAL ADDITIONS (owner-accepted): (A) a tier×reason_code validity MATRIX enforced in code — the ENUM alone let a certifier mis-apply `source_corroborated_user_value` to TIER 1; out-of-matrix (code,tier) pairs are rejected at the override entry point. (B) `cross_doc_anchor_id` REFERENT defined = the applicant case/person key (an undefined id can't reconcile a birth-cert father with a later marriage-cert spouse → would need the retrofit it was meant to avoid). (C) HTR condition 4 presumes signals we do NOT emit today (no handwritten-origin classifier, no `visual_evidence_score`) — so "build the counter" is actually classifier → score → window-counter → 6-condition gate.
- HTR rollout threshold RULED: 15% stays but gated by ALL 6 conditions (L1 closed; L2 PASS ≥3 doc classes; post-L1 rolling 100-doc window; defined handwriting_field_failure = critical AND gemini<0.7 AND visual_evidence_score=handwritten AND review_required; rate >15%; ADR-020 locked). Audit hook LOCKED from commit 1, now including `tier`, `document_class`, `cross_doc_anchor_id`. ADR-021 status → RULED v1; L0 certifier_override is unblocked (write once). Next session (agent): L0 certifier_override + criticality-per-doc-class-in-code + DeepSeek-lint, then L1. Docs only.

## 2026-06-10 (docs: ADR-021 v1 draft + HTR rollout threshold — owner-inputs before code, DOCS, agent)
- Owner correction accepted: ADR-021 minimum + HTR threshold must precede `certifier_override` code (else code is built on shifting assumptions and rewritten). DRAFTED docs/adr/ADR-021-delegated-certifier.md (v1-minimum, DRAFT — owner ruling pending) answering 3 questions with the owner's stated recommendations baked in as concrete text to rule on: Q1 scope = critical-identity set per doc class; Q2 reason codes = ENUM {source_verified|user_clarified|dual_witness|other_with_text}; Q3 parents/spouses = CRITICAL → certifier_override but LOW-FRICTION (source side-by-side, single-click source_verified) because USCIS cross-validates parent names and a mismatch is an auto fraud flag. Audit-hook schema LOCKED (per owner point 4): every override writes reason_code/field_name/previous_value/new_value/certifier_id/timestamp_utc/session_id/linked_pdf_doc_id/immutable_marker from commit 1 (log file acceptable until ADR-019 persistence; schema + hook ship with commit 1, never retrofit).
- HTR ROLLOUT THRESHOLD defined in the constitution NOW (before it is approached): rollout considered ONLY when handwriting-related field-failures > 15% of total critical-field failures over a rolling 100-document window AND ADR-020 is locked. Creates a concrete L1 instrumentation requirement (count handwriting failures per window — absent today). Corrected next-session order: owner rules ADR-021 Q1–Q3 (~30min) → agent L0 (certifier_override + criticality-per-doc + DeepSeek-lint + audit hook) → agent L1 (refund + rate-alert + handwriting-failure counter) → ADR-020 before HTR → ADR-019 persistence parallel to L1. Docs only.

## 2026-06-10 (docs: LAW 2#5 RULED — tiered user/certifier authority, DOCS, agent)
- Owner ruled LAW 2#5 with a Type-3 resolution (rejected both agent options as a false dichotomy): user_confirmed authority is TIERED by field criticality. Non-critical → user_confirmed CAN finalize an otherwise-null field (+ provenance + audit event + PDF flag + certification-text acknowledgement). Critical identity (applicant DOB/surname/given-name/document-number/nationality) → user_confirmed CANNOT finalize alone; path = certifier_override (authorized certifier attests reading from the source, attribution on the certification line, audit records certifier identity). Cross-document anchor (MRZ/EAD) ALWAYS overrides user_confirmed on critical identity; conflict → block + escalate. Certifier role = owner-only TRANSITIONAL (explicitly a launch mechanism, not permanent — a throughput bottleneck at scale) → delegated certifier role = separate ADR-021. Verbatim ruling recorded in ONE_BRAIN_CYRILLIC_CONSTITUTION.md LAW 2#5; the ⚠ OWNER-CONFIRM tags on LAW 2 are now resolved (RULED 2026-06-10).
- Agent flagged (not yes-manned): the ruling's critical-identity list is the APPLICANT's own fields; whether relatives/parents/spouses need certifier_override vs user_confirmed is an OPEN sub-question deferred to ADR-021. NEW DEBT: ADR-021 (delegated certifier) + C3 has no certifier_override path in code yet (must be built implementing the tiered authority). Maps to 8 CFR 103.2(b)(3); the mirror PDF's TRANSLATOR'S CERTIFICATION block is where override attribution lands. Docs only.

## 2026-06-10 (docs: constitution PART II — 8 LAWS + L0–L4 maturity map, DOCS, agent)
- Owner directed turning the layer-scheme into an enforceable "constitution." Extended ONE_BRAIN_CYRILLIC_CONSTITUTION.md with PART II (8 LAWS: 1 transliteration, 2 source-of-truth precedence, 3 handwriting, 4 visual-evidence, 5 privacy/no-real-PII, 6 critical-fields-per-doc-type-code-is-SoT, 7 DeepSeek boundary, 8 audit-trail) and PART III (L0–L4 maturity map + build order, rule "no layer N+1 before N≥80%"). Rewrote the "real problem" section into historical-failure-vs-current-invariant (Phase 2 merged: raw_cyrillic must never drop before D2/C3).
- AGENT CRITICAL REVIEW of the owner's spec (not yes-manned): (1) flagged a CONTRADICTION between SOURCE-OF-TRUTH #1 (MRZ controls applicant identity) and the locked visual-evidence rule (illegible field never finalized from MRZ) → resolved by scoping "controls" to romanization authority for the applicant, candidate-only on other-doc illegible fields [⚠ OWNER-CONFIRM]; (2) flagged that "user correction is evidence not truth" would trap an illegible-only field in review forever → C3 may final on a sole-source user confirmation with provenance=user_confirmed, never overriding MRZ [⚠ OWNER-CONFIRM]; (3) corrected the owner's L1 estimate 10%→~45% with repo evidence (422, guard-block log, runbook, rollback all done); (4) noted L2 is gated on owner-provided GT fixtures, not agent work. Next session opens with L1 (refund + guard-block rate alert), not HTR. Docs only.

## 2026-06-10 (docs: owner-review corrections — rollback handles, mirror semantic, claim accuracy, DOCS, agent)
- Owner critique accepted with evidence. (1) docs/runbook.md: added per-feature ROLLBACK HANDLES table for the 3 new layers (source-script gate = `vercel env rm RU_TRANSLIT_ENABLED`; gazetteer = git revert, noted inert behind SMART_NORMALIZE_ENABLED OFF; mirror = `vercel env rm MIRROR_PDF_ENABLED`). (2) docs/architecture/MIRROR_TRANSLATION_ARCHITECTURE.md: status → ENABLED + explicit SEMANTIC CLASSIFICATION — mirror is an ADVISORY TRANSPARENCY/UX layer, NOT a validation control (fails open, outside the safety chain); safety lives in confirmedValueGuard + source-script gate + finalValue contract. Prevents future semantic drift.
- CORRECTED OVERSTATEMENTS: mirror was "text-content verified by extraction," NOT "end-to-end" (visual layout/font/stamp-position unverified — pending owner review on a synthetic doc). Gazetteer (b) is sanitary MODERN coverage only: repo check shows pre-2020 units (Дніпропетровськ/Кіровоград/Артемівськ) ABSENT, settlement `aliases` ALL-EMPTY (historical renames unmapped), Crimea included without policy — so old-document places (our actual user population) still false-negative → review (safe but incomplete). 458-row selection criterion unverified.
- PRIOR-ROUND 7-ITEM STATUS (repo-verified, file:line): 403→422 DONE, structured guard-block log DONE, DeepSeek-never-final DONE, Tier0≠legal DONE, runbook DONE, kill-switch decided-as-rollback; **item #6 (N<30 enforced in bench runner) STILL OPEN**. No code/test changes in this commit — documentation + accuracy only.

## 2026-06-10 (feat: harden + verify mirror PDF end-to-end, enable in prod, CODE, agent)
- Owner task (a): made the mirror translation PDF production-safe and enabled it. (1) HARDENED apps/web/src/app/api/translation/generate-pdf/route.ts — the mirror render is now in its OWN try/catch so any failure falls back to the generic certification PDF (previously a mirror throw hit the outer catch, left pdfBuffer=null, and returned an error to the client). (2) Added mirrorEndToEnd.test.ts (+4): a realistic synthetic birth-cert extraction renders a valid %PDF buffer; a review-flagged field → unresolved/[CONFIRM]; a missing field → [enter from document]; never invents a value; all 5 certificate schemas (birth/marriage/divorce/death/name-change) render; unknown docType → null (generic fallback). (3) Emitted a synthetic sample and text-verified the line-by-line structure and content-rule compliance (Patronymic not Middle Name, "AI-assisted draft" not certified, 1213 Gordon St without Apt 8, 8 CFR 103.2(b)(3) translator certification, KMU source citation).
- MIRROR_PDF_ENABLED enabled in production (fail-open, draft-labeled, never-invents; replaces the generic table ONLY for the 5 cert types when a schema matches; OFF/no-schema = byte-identical generic). 3106 passed, tsc 0, content-guard 0. Rollback: `vercel env rm MIRROR_PDF_ENABLED production` + redeploy. HONEST SCOPE: extraction QUALITY on real handwritten docs remains review-gated — the mirror faithfully renders whatever extraction yields, with [CONFIRM]/blank markers; it does not improve reading, it presents it line-by-line.

## 2026-06-10 (feat: wire geo gazetteer to official КАТОТТГ settlement registry, CODE, agent)
- Owner task (b): the handwriting place fuzzy-matcher `snapCity` (gazetteer.ts) was scoring against a 60-item hardcoded seed while the repo already ships the official КАТОТТГ settlement registry (settlements.generated.ts, 458 sourced rows, Наказ Мінрегіону №290 від 26.11.2020, mtu.gov.ua) — the same data the agent's exact lookup uses. GAZETTEER is now `Array.from(new Set([...CURATED_SEED, ...SETTLEMENT_ROWS(settlement).key_uk]))` (~500 deduped). The matcher (confusion-weighted Levenshtein, anti-silent-snap) is byte-for-byte unchanged — this is exactly the expansion the file header mandated ("the matcher does not change, only the data").
- Anti-silent-snap safety verified intact: a fuzzy read keeps its raw value, matched=false, review_required=true; only the surfaced SUGGESTION moves to a nearer real city (e.g. с.м.т. Ярошенець now suggests Кременець). Updated geographyNoSilentSnap.test.ts to pin the safety invariant rather than a specific suggestion. +5 tests (gazetteerRegistryExpansion.test.ts). 3102 passed, tsc 0, content-guard 0.
- HONEST SCOPE: the generated registry is the city/urban-type-settlement tier (~458), NOT the full ~28k-village КАТОТТГ — extending to villages = re-run scripts/gen-settlements.mts against the full source (a data task). CAVEAT: snapCity is active only where wired and behind SMART_NORMALIZE_ENABLED (OFF in prod) — the expansion is ready; activation is a separate flag decision. Files: packages/knowledge/src/gazetteer.ts, apps/web/.../gazetteerRegistryExpansion.test.ts, geographyNoSilentSnap.test.ts.

## 2026-06-10 (feat: source-script gate — ambiguous name → review, not silent KMU-55, CODE, agent)
- Owner decision (b): visible source script controls transliteration; ambiguity blocks final. A name with no distinctive Ukrainian letter (і/ї/є/ґ) AND no distinctive Russian letter (ы/э/ё/ъ) is AMBIGUOUS — old Soviet/bilingual docs legitimately mix scripts, so we never guess. NEW `isNameSourceScriptAmbiguous` (transliterationPolicy.ts) + source-script gate in documentFieldReader.ts: ambiguous name → review_required=true + reason_code `source_script_ambiguous`; the value stays a best-effort KMU-55 CANDIDATE (review screen not empty) but C3 (applyOcrFieldSafety) refuses a finalValue (=null) until the script is confirmed or user/admin confirmation passes. Behind RU_TRANSLIT_ENABLED (ON in prod); OFF → legacy KMU-55-for-all (byte-identical).
- This closes the prior LIMITATION (ambiguous Сергей silently became Serhii). All 8 owner-required tests now covered (added sourceScriptGate.test.ts +7): Сергей→Sergey, Сергеевич→Sergeyevich, Леонидович→Leonidovich, Сергій→Serhii, Сергійович→Serhiiovych, mixed child/father no-harmonization, illegible-month-not-final, **ambiguous-source-does-not-final**. 3097 passed, tsc 0, content-guard 0. Files: transliterationPolicy.ts, documentFieldReader.ts, __tests__/sourceScriptGate.test.ts. Synthetic names only.

## 2026-06-10 (feat: lock RU=BGN/PCGN standard + visual-evidence date rule, CODE, agent)
- Owner locked transliteration standards: RU=BGN/PCGN simplified, UA=KMU-55, applicant=MRZ/passport-controlling, relatives=as-written, ambiguous→review. transliterateRussian rewritten to BGN/PCGN (е after vowel/initial→ye: Сергеевич→Sergeyevich; я→ya: Наталья→Natalya). +visualEvidenceRule tests: cross-document/cross-engine DOB match is a CANDIDATE that raises confidence/review but NEVER overwrites or finalizes an illegible date (C3 finalValue=null). 18 name+date tests; 3090 passed. RU_TRANSLIT_ENABLED enabled in prod (mappings proven). Synthetic names only.

## 2026-06-10 (feat: deterministic date-role guard, CODE, agent)
- NEW dateRoleGuard.ts in readDocument (all products, no flag): role-conflation (same date in dob and date_of_issue → both review + date_role_conflict) and sequence conflict (issue before birth → date_sequence_conflict). Only raises review, never edits values or lowers flags. Addresses the observed model bug of copying one date into two role fields, and a spec requirement. +10 tests; suite green.

## 2026-06-10 (feat: Russian as-written transliterator + script detection, CODE, agent)
- Critical analysis of a ChatGPT spec found a REAL gap: only KMU-55 (Ukrainian) existed, so a Russian-script Soviet-doc line (Сергей) was KMU-55-ed to Serhei. NEW transliterateRussian (Сергей→Sergey, Сергеевич→Sergeevich, Леонидович→Leonidovich, Наталья→Natalia — matches owner-approved outputs) + detectNameScript (ua/ru/unknown). Wired into transliterationPolicy name-kind behind RU_TRANSLIT_ENABLED (default OFF): clearly-Russian script → Russian system; unknown → KMU-55 (never guess). +14 tests; 3079 passed.
- LIMITATION (honest): ambiguous names with no distinctive letter (Сергей has no ы/э/ё/ъ) → unknown → stay KMU-55; routing them needs DOCUMENT-level language context (next step).
- REJECTED from the spec: the *why I read 25 June* narrative = post-hoc fabrication; the month is illegible-as-June to every engine + a human (verified). Privacy rule followed: synthetic example names only.

## 2026-06-10 (feat: KIT 2 verify — passport MRZ is the DOB authority, test, agent)
- The handwritten birth-cert month is illegible-as-June to every engine + a human; the international passport MRZ encodes it with a check digit → 1986-06-25 (June). Verified mrzAuthority decodes it correctly (conf 0.99, check_digits dob=true) and the existing fieldArbiter ranks passport_ocr_mrz #1, so in multi-doc flows (TPS/reparole) the MRZ DOB overrides the handwriting. +2 tests.

## 2026-06-10 (feat: KIT 1 auto-orientation infrastructure, CODE, agent)
- Reading the docs myself revealed the handwritten birth cert was photographed SIDEWAYS (content rotated 90); every engine read cursive sideways. NEW autoOrient.ts: detect content rotation via a Gemini thumbnail + self-verify loop (90<->270 unstable) + fail-open, geometric only. Wired into readDocument (all products) behind AUTO_ORIENT_ENABLED (default OFF). A/B on the real birth cert: dob day 26->25 (correct), place_of_birth fuller (+district). +2 fail-open tests.

## 2026-06-10 (findings: exhaustive proof — handwritten month needs trained HTR, docs, agent)
- With the owner Vision key + full resources, tried every general approach: Gemini prompts/zoom, Vision word-geometry line-segmentation, Vision multi-crop voting (0/5 readable months), HF-TrOCR (endpoint needs token). ALL fail the handwritten month (червня). Names read well (11/12) — the bulk of handwritten Cyrillic is already readable. Date-month is a trained-HTR-grade problem; finishing needs an owner-provided Transkribus or HuggingFace token, then the built ensemble wires the HTR as the month reader.

## 2026-06-10 (findings: PROVEN wall on auto-reading handwritten dates, docs, agent)
- Local Gemini experiments + prod diag prove: Gemini cannot read this handwritten month (3 prompts × 2 runs → липня/травня, never червня) NOR give a tight date-line bbox (~39% of page). Vision reads the month only on a manual tight crop Gemini cannot produce. Conclusion: no deployable automated approach auto-reads this handwritten date; product is correct (dates review_required, human-in-loop). Finishing needs owner action: rotate Vision key for local tuning, or Transkribus/TrOCR HTR. Appended to HANDWRITTEN_DATE_ENSEMBLE report.

## 2026-06-10 (stop: ensemble flag OFF in prod; bound the date crop, CODE+env, agent)
- HONEST: the date ensemble infra is complete, Core-path-wired, tested, observable, fail-safe — but it is NOT yet delivering a reliable second reading: Vision garbles the handwritten month on tight auto-crops (month_hits=0), and full-width bands time out the route. Turned ENSEMBLE_DATE_ENABLED OFF in prod (dates are already review_required, so safety unchanged). Bounded the crop (≤2 regions, padded bbox, capped resize) so the code is timeout-safe when re-enabled. Finishing needs local Vision iteration (after key rotation) or Transkribus HTR.

## 2026-06-10 (tune: ensemble crops full-width date band, not tight bbox, CODE, agent)
- Vision read the year but garbled the month on tight Gemini bboxes (month_hits=0). Crop the FULL-WIDTH horizontal band at the date line instead — gives Vision the whole handwritten line. Targeted attempt; if still garbled, the path is Transkribus HTR (owner auth).

## 2026-06-10 (debug: month/year/cands diag for ensemble, CODE, agent)
- Ensemble now runs in the Core path (3 boxes, 3 crops, 375 chars Vision text) but extracts 0 date candidates. Added PII-free month_hits/year_hits/cands to date_ensemble diag to determine whether Vision garbles the handwritten month on the zoomed crops.

## 2026-06-10 (fix: wire date ensemble into the CORE path (was dead in legacy), CODE, agent)
- Root cause of the silent ensemble: it lived in the legacy merged-path, but real reads return via the Core path (ok:core-b2) which returns early — the ensemble code never executed. Extracted shared runDateEnsemble helper, wired into the Core path (and deduped the legacy block). date_ensemble diag now in the Core response. tsc 0; 3061 passed.

## 2026-06-10 (debug: expose date_ensemble diagnostics in response, CODE, agent)
- TEMPORARY: response carries date_ensemble {status, boxes, crops, chars, disagreements} (PII-free counts) to diagnose why the live ensemble isnt surfacing the 2nd reading after multiple fixes. Remove once fixed.

## 2026-06-10 (fix: ensemble extracts month+year without a day, CODE, agent)
- Vision OCR of the zoomed date region often drops a clean day digit → the strict day+month+year regex matched nothing → no second-engine candidate → month disagreement never surfaced. Day now optional. +2 tests; 3061 passed.

## 2026-06-10 (fix: ensemble surfaces any date diff on cropped region, CODE, agent)
- Required shared-year anchor wrongly suppressed the real handwritten case (Gemini reads the year, Vision the month — no shared component). Since the 2nd engine reads the cropped DATE region, surface ANY difference. +relaxed test. tsc 0; 17 ensemble tests.

## 2026-06-10 (fix: ensemble date-bbox parse — array boxes + salvage malformed JSON, CODE, agent)
- Gemini returned malformed keyed JSON for date bboxes → empty → ensemble fell back to full-page Vision (garbled month). Now requests array boxes [ymin,xmin,ymax,xmax] + salvages malformed JSON via quartet regex. tsc 0.

## 2026-06-10 (feat: date-region ZOOM crop for ensemble second-read — the working fix, CODE, agent)
- Prod smoke revealed Vision garbles the handwritten month on the FULL page; it reads it correctly only on a ZOOMED date-region crop. NEW `dateRegionRead.ts`: Gemini returns date bboxes → crop+zoom×5 each → Google Vision OCR on the crop → combined text for the reconciler. Geometric only (no tonal). Fail-open.
- Route ensemble now uses readDateRegionsWithVision (zoom) with full-page Vision as fallback. tsc 0; 3058 passed; guard 0. Live behind ENSEMBLE_DATE_ENABLED=1 (prod).

## 2026-06-10 (fix: ensemble date detection by NAME not kind (was silenced), CODE, agent)
- BUG: response FieldOut.kind carries the SOURCE ('ai_vision'), not the data type, so the ensemble guard `kind==='date'` NEVER matched → ensemble silently never ran on dates. Fixed: detect date fields by NAME (`isDateFieldName`: dob/date_of_*). Route guard + applyDateEnsemble both updated. +1 test (16 ensemble).
- ENSEMBLE_DATE_ENABLED=1 flipped in prod + redeployed; this fix makes it actually fire on handwritten date fields.

## 2026-06-10 (feat: review UI surfaces ensemble second-reading on date conflict, CODE, agent)
- TranslateWizard: ExtractedField carries ensemble_candidate + review_reasons; review screen shows the second engine's date reading ('Second reading (Google Vision): X — please verify') under the English value when Gemini & Vision disagreed. i18n keys added (RU/EN).
- Completes the user-facing half of the handwritten-date ensemble: when flag ON, the human sees Vision's (correct) month next to Gemini's, and confirms. tsc 0; 3057 passed; content-guard 0.
- Still OFF until owner rotates Vision key + confirms prod SA + flips ENSEMBLE_DATE_ENABLED.

## 2026-06-10 (feat: WIRE handwritten-date ensemble into translation route, CODE, agent)
- `docintel/ensemble/dateReconcile.ts`: added extractDateCandidatesFromText (pull dates from OCR full-text).
- NEW `docintel/ensemble/applyDateEnsemble.ts`: field-level cross-engine date check — reconciles each date field vs the 2nd engine's readings; disagreement (shared-year anchor) → force review + reason `date_ensemble_disagreement` + attach `ensemble_candidate`; never overwrites, never lowers review. +7 tests.
- WIRED into translation/vision-extract behind `ENSEMBLE_DATE_ENABLED` (default OFF): for handwritten-risk classes with date fields, runs googleVisionProvider 2nd-read → applyDateEnsemble. OFF = byte-identical, no extra cost. FieldOut carries review_reasons + ensemble_candidate.
- tsc 0; 3057 passed / 4 skipped / 0 failed. Remaining: review UI to surface ensemble_candidate; zoomed date-crop booster; OWNER rotate Vision key + confirm prod SA + flip flag after sample.

## 2026-06-10 (feat: handwritten-date ENSEMBLE — Gemini+Vision cross-check (proven), CODE, agent)
- Research: best handwritten-Ukrainian = Transkribus (CER 4.2%, owner-auth needed); Azure excludes Cyrillic handwriting; DocAI weak. Field uses HTR+ensemble+human-in-loop.
- PROVEN live on a real handwritten birth cert: Gemini misreads the month, Google Vision (SA) reads it CORRECTLY; zoomed date-region crop recovers the day. Neither engine alone is right; together they contain every correct component.
- BUILT the deterministic core: `docintel/ensemble/dateReconcile.ts` — parse UA/RU word-months + ISO/MDY (червня=June vs липня=July), reconcile component-wise; agreement→ISO, any disagreement→review + both candidates, never silent-picks. +8 tests (synthetic dates, no PII).
- Remaining (defined): wire Vision second-read into translation path for handwritten classes; zoomed date crop; review UI dual-candidate; later Transkribus/TrOCR third reader.
- SECURITY: a Vision SA private key was pasted in chat → owner must ROTATE it. Report: docs/reports/HANDWRITTEN_DATE_ENSEMBLE_2026-06-10.md.

## 2026-06-10 (probe: HONEST handwritten Cyrillic multi-run — names work, DATES fail, docs, agent)
- 3 runs each on 3 handwritten owner docs vs GT. RESULT: handwritten NAMES read well+stable (11/12); handwritten DATES stably WRONG (0/3 both birth certs). Corrects earlier print-emphasis.
- Failure mode: model misreads handwritten month word + day digit and copies one date into both dob & date_of_issue. All review-flagged (safety holds) but machine is wrong on dates.
- Next target = handwritten DATES: disambiguate dob vs issue date; test zoomed field-region crop (geometric, OFF/ON benched). Report: docs/reports/HANDWRITTEN_CYRILLIC_PROBE_2026-06-10.md.
- Also generated a real mirror-PDF sample to gitignored qa-private (birth cert) to validate the format. No code/prod change; no PII committed.

## 2026-06-10 (feat: mirror translation PDF — wire official schemas to live flow, CODE, agent)
- FOUNDATIONAL: the English-mirror capability existed as orphaned scaffolding (5 KMU-sourced schemas + renderOfficialTranslation) fed ONLY by mockOCR. Built the 3 missing bricks to drive it from REAL extracted fields:
  - `forms/ukraine/schemas/registry.ts` — getOfficialSchema(docType) for the 5 cert types.
  - `pdf/buildMirrorValues.ts` — maps registry keys→schema keys (child_family_name→child_surname, dob→date_of_birth, …), finalValue-first, never invents.
  - `pdf/renderMirrorTranslationPDF.ts` — orchestrator (schema+values+renderer → mirror PDF, or null).
- Wired into generate-pdf behind `MIRROR_PDF_ENABLED` (default OFF → live unchanged): on + schema exists → faithful English mirror per KMU layout; else generic.
- +9 tests (registry/mapping/e2e real PDF). tsc 0; 3042 passed / 4 skipped / 0 failed. content-guard 0.
- Arch: docs/architecture/MIRROR_TRANSLATION_ARCHITECTURE.md. Mirror = structural English mirror (title/groups/order/source + seal placeholders), NOT a visual clone.

## 2026-06-10 (decision: NO tonal preprocessing before vision read — A/B data, docs, agent)
- Tested orig(color) vs greyscale+contrast vs hard B&W on real Cyrillic docs via live prod read. Handwritten birth cert: 3/3→0/3 Cyrillic when preprocessed; printed unaffected. Tonal preprocessing DESTROYS faint handwriting (our danger class).
- DECIDED: send original color (geometric resize only, already shipped). Geometric crop/deskew may help but must be bench-measured first; never greyscale/binarize. Official PDF is built from extracted text, not a scan → no PDF benefit either.
- Report: docs/reports/PREPROCESS_AB_DECISION_2026-06-10.md. No code/prod change; no PII.

## 2026-06-10 (bench: add Soviet-bilingual birth cert; correct overstated finding B, docs, agent)
- Extended GT bench to the Soviet-bilingual birth cert (danger class): same pattern as handwritten — surname Cyrillic ✓, given/patronymic Cyrillic ✗, dob wrong, ALL review-flagged. Coverage now 4/5 core UA classes.
- CORRECTED finding B (was overstated): ua_birth_certificate IS protected — docintelIdToDocumentClass→birth_certificate_handwritten (always_review:true) + route applyHardCaseReviewOverride (unconditional) + role guard; policy already unit-tested. The handwritten:false spec flag is cosmetic-misleading, not a live danger. Residual: protection is route-level (translation), not at the shared readDocument door.
- Noted gap: international-passport GT is MISSING (owner to fill) — the printed+MRZ class we'd expect highest.
- No code/prod change. No PII in committed files.

## 2026-06-10 (fix: shared client-side downscale across ALL upload paths, CODE, agent)
- NEW `apps/web/src/lib/upload/downscaleImage.ts` — shared helper (>3.8MB → ≤2400px JPEG q0.82, fail-open, browser-only).
- Wired into all 5 client upload paths: translation (vision-extract), EAD, TPS DocumentUploadScreen, TPSWizardV2, ReparoleWizardV2 — every OCR/vision upload now clears the ~4.5MB Vercel edge cap. TranslateWizard local copy replaced by the shared import.
- NEW `downscaleImage.test.ts` (5 fail-safe unit tests). tsc 0; 3033 passed / 4 skipped / 0 failed.

## 2026-06-10 (fix: client-side downscale before upload — GT bench finding A, CODE, agent)
- `TranslateWizard.tsx`: NEW `downscaleImageForUpload` — images >3.8MB downscaled in-browser (longest edge ≤2400px, JPEG q0.82) before POST to vision-extract. Fixes HTTP 413 at the ~4.5MB Vercel edge cap (real phone photos 4–12MB never reached the brain). Fail-open: any error sends the original. Bench: 7.1MB→1.5MB, no accuracy loss.
- +3 source-assertion tests. tsc 0; 3029 passed / 4 skipped / 0 failed.
- Follow-up: same 413 risk in reparole/ead/tps OCR uploads (mostly Latin US docs) — not yet fixed.

## 2026-06-10 (bench: live GT pipeline measurement on real Cyrillic docs, infra+report, agent)
- NEW `apps/web/scripts/gt-pipeline-bench.mjs` — re-runnable; POSTs owner fixtures to PROD vision-extract (real gemini-3.1-pro-preview path), scores per-field vs owner GT, auto-downscales >4MB, doc-class-aware field map. Raw→gitignored qa-private; sanitized scorecard→docs/reports.
- Results (EXPLORATORY, 1 doc/class): military(printed) 4/4 readable exact; booklet(hw) family+given+dob ✓, patronymic missed; birth(hw) surname-cyr ✓, given/patronymic/dob wrong — ALL review-flagged (no silent bad output).
- 4 findings (GT_PIPELINE_BENCH_FINDINGS): (A) >4MB images 413 at edge before brain; (B) ua_birth_certificate fields mislabeled handwritten:false on the most dangerous class; (C) sex not in booklet/birth/military specs; (D) pro misses handwritten patronymic.
- No code/prod/env change. No PII in committed files.

## 2026-06-10 (test: close BUG C + BUG D debt; pin a real RU-spelling gap, CODE, agent)
- NEW `canonicalValueUnresolved.test.ts` (BUG C, 4): date with no iso_date + non-empty cyrillic → emitted review `canonical_value_unresolved`, not dropped; empty cyrillic → dropped.
- NEW `sovietBilingualTolerance.test.ts` (BUG D, 6): pins doc-origin distinction — `ukrainianDoc===false` skips the RU-spelling review; `!==false` flags `russian_spelling_suspected`.
- **GAP pinned (not hidden):** `looksRussianSpelled` matches a composite full_name against the SINGLE-name set, so a multi-word RU name without ё/э/ы/ъ (e.g. 'Сергей Иванович') is NOT flagged even on a UA doc. Single-token 'Сергей' IS caught. Tightening needs owner GT + rule change.
- tsc 0; 3026 passed / 4 skipped / 0 failed (+10).

## 2026-06-10 (ci: bump GitHub Actions to Node-24 majors, infra, agent)
- checkout v4→v6, setup-node v4→v6, cache v4→v5, pnpm/action-setup v4→v6 across all 8 workflows. Clears the Node.js-20 deprecation (forced to Node 24 on 2026-06-16). No `version:` inputs → action-setup v6 reads `packageManager: pnpm@10.33.2`. YAML validated.

## 2026-06-10 (ci: content-guard fix — reword 'certified translation' comment, agent)
- `applyOcrFieldSafety.ts` comment reworded ('certified translation' literal tripped Rule 4 product-claim guard in CI). No logic change. tsc 0.

## 2026-06-10 (P0-A hardening: revert enforce→shadow, 403→422, kill-switch, runbook, CODE, agent)
- **Walked back 816cb64's always-on enforce** (which auto-deployed to prod with no data) to SHADOW mode default. `CONFIRMED_VALUE_GUARD_MODE` = shadow|enforce|off (one knob, no flag sprawl). Shadow = validate+log `would_block`, do NOT block → prod byte-identical. Owner flips enforce after reviewing shadow logs.
- `generate-pdf/route.ts`: guard block 403 → 422 (content invalid ≠ auth; frontend verified to only alert error string). PII-free structured log `[confirmed_value_guard] would_block|block {field,criticality,reason,doc_type}`.
- NEW `docs/architecture/CERTIFIED_DOC_INCIDENT.md` — incident runbook, MODE=off kill-switch, interim post-charge refund policy.
- Contract sharpening: C3_USER_CORRECTION_CONTRACT (DeepSeek-never-final; P0-A.1 vs P0-A.2 = anchor-check not gazetteer re-run; shadow rollout); ADR-019 (Tier-0 hashes ≠ legal evidence, breach-liability note); GT_BENCHMARK_EXIT_CRITERIA (N<30 must be enforced in runner code).
- New guard tests updated for shadow-default + regression on the removed f.confirmed flag. tsc 0; 3016 passed / 4 skipped / 0 failed.

## 2026-06-10 (P0 design lock + P0-A output-door sanitation, CODE+5 docs, agent)
- NEW `apps/web/src/lib/documentSafety/confirmedValueGuard.ts` — deterministic release-value sanitation (Cyrillic/control/length/date).
- `generate-pdf/route.ts` — guard wired ALWAYS-ON (legal sanitation, not behind OCR_FIELD_SAFETY). Fixed dead-code bug from prior agent (keyed on never-sent `confirmed` flag → now validates real release values). Deliberate prod behavior change: defects blocked, legitimate Latin unaffected.
- `applyOcrFieldSafety.ts` classifyCriticality — added validity dates, issuing_authority, category, nationality (were silently `optional`). Reconciled to CRITICAL_FIELDS_CONTRACT.
- `documentFieldReader.ts` — PII-free fallback_model_used observability log.
- `translation/types.ts` — ExtractedField.final_value + confirmed.
- 5 design-lock contracts: CRITICAL_FIELDS_CONTRACT, C3_USER_CORRECTION_CONTRACT, PAYMENT_REFUND_LEGACY_GATE_CONTRACT, GT_BENCHMARK_EXIT_CRITERIA (docs/architecture/); ADR-019-audit-trail-persistence (docs/adr/).
- NEW test `confirmedValueGuard.test.ts` (14). tsc 0; 3011 passed / 4 skipped / 0 failed.

## 2026-06-10 (ADR-018 model matrix locked + fallback-model review guard, CODE+ADR, agent)
- `docs/adr/ADR-018-model-matrix.md` — iron model matrix per owner directive: pro-preview = reader, flash = fallback-only, Vision = technical eye, DeepSeek = prose (+sanitized TPS text gap-fill), D2/C3/PDF = code.
- `geminiVisionProvider.ts` — `primaryGeminiModel()` exported.
- `documentFieldReader.ts` — NEW deterministic guard (no flag): fallback-model read of any non-Latin doc ⇒ all fields `review_required=true` + `fallback_model_used`. Closes the silent pro→flash degradation hole (2.5-flash disqualified on certificates).
- New `fallbackModelReview.test.ts` (5 tests); 3 existing docintel test mocks updated to report primary model.
- tsc 0; 2997 passed | 4 skipped | 0 failed (+5).

## 2026-06-10 (housekeeping: Vercel dead flags removed + local branch cleanup, env+infra, agent)
- Removed 7 dead Vercel prod env flags (code no longer reads them after Phase 2): ONE_BRAIN_CORE_ENABLED, ONE_CORE_TPS_ENABLED, ONE_CORE_REPAROLE_ENABLED, NEXT_PUBLIC_ONE_CORE_REPAROLE_ENABLED, ONE_CORE_EAD_ENABLED, NEXT_PUBLIC_ONE_CORE_EAD_ENABLED, CENTRAL_BRAIN_TRANSLATION.
- Deleted 68 stale local git branches. Only `main` remains.
- Closed 10 stale/superseded GitHub PRs (#25, #43–#47, #66, #92, #93, #103) with explanation.
- No code or prod behavior change.

## 2026-06-10 (fix: pre-payment review check — block before Stripe if fields unresolved, CODE, agent)
- `apps/web/src/app/api/translation/generate-pdf/route.ts`: added pre-payment review check block before Stripe gate.
  - Filters `payload.fields` for `review_required === true`; returns 400 `fields_require_review` if any found.
  - Prevents charge-before-block ordering bug (user charged → PDF blocked 403).
- tsc: 0 errors. 2992 passed | 4 skipped | 0 failed (unchanged from Phase 3 baseline).

## 2026-06-10 (docs: OCR field safety canary full record applied to main, docs-only, agent)
- Added 3 canary report files from PRs #100, #101, #102 (squashed; shared state files already on main).
- `docs/reports/OCR_FIELD_SAFETY_CANARY_RESULT_AFTER_502_FIX.md` — canary re-run after 502 fix, DEGRADED-clean result.
- `docs/reports/OCR_FIELD_SAFETY_OWNER_PROOF_RESULT.md` — owner proof run result.
- `docs/reports/OCR_FIELD_SAFETY_FINAL_OWNER_PROOF.md` — canary closeout, precautionary rollback to OFF.
- PRs #100, #101, #102 closed after content applied.

## 2026-06-09 (Phase 3: CanonicalField.finalValue + C3 as only writer, CODE, agent)
- `apps/web/src/lib/canonical/types.ts`: added `finalValue?: string | null` to `CanonicalField` — 3-state contract: `undefined`=C3 not run, `null`=rejected, `string`=accepted (ADR-017 §C3).
- `apps/web/src/lib/documentSafety/applyOcrFieldSafety.ts`: added `finalValue` to `SafeField` interface; C3 accept path writes `finalValue=string`, reject/block path writes `finalValue=null`.
- `apps/web/src/lib/canonical/core/translationAdapter.ts`: `canonicalToFieldOut` — `value` uses finalValue-first pattern (backward compat: `undefined` falls back to `normalizedValue`).
- `apps/web/src/lib/canonical/core/tpsAdapter.ts`: `canonicalFieldToTpsField` — `normalized_value` uses same finalValue-first pattern.
- `apps/web/src/lib/canonical/core/eadAdapter.ts`: `getValue` helper — same finalValue-first pattern.
- `apps/web/src/lib/packet/pdf.ts`: `planTranslationRows` type + logic — `final_value !== undefined ? final_value : normalized_value`.
- `apps/web/src/lib/documentSafety/__tests__/finalValueContract.test.ts`: 18 new contract tests (all 3 states, all 3 adapters, D2 boundary).
- tsc 0 errors. 2992 passed | 4 skipped | 0 failed (was 2974).
- Prod untouched. `OCR_FIELD_SAFETY_ENABLED` stays OFF. No env changes.
- Proof: `docs/reports/PHASE_3_FINAL_VALUE_C3_WRITER_PROOF.md`

## 2026-06-10 (PASS_PROD_MODEL_SMOKE: prod model flipped to gemini-3.1-pro-preview, env-only, agent)
- **No code change.** Prod env-only operation.
- Removed dirty `GEMINI_MODEL="gemini-2.5-flash\n"` (embedded literal `\n` made flash the effective prod model since Phase 1).
- Set clean `GEMINI_MODEL=gemini-3.1-pro-preview` via `printf | vercel env add` (no trailing newline).
- Redeploy: Vercel build OK, SHA `203b572`, aliased `messenginfo.com`. Healthz OK.
- Live smoke confirmed: `POST /api/translation/vision-extract` (1×1 PNG, no PII) → `model: gemini-3.1-pro-preview`, 4554ms, no fallback.
- Result: `PASS_PROD_MODEL_SMOKE`. Phase 3 UNBLOCKED.
- Report: `docs/reports/PROD_GEMINI_MODEL_FLIP_SMOKE_2026-06-10.md`

## 2026-06-10 (Phase 2 split EXECUTED: PRs #104-#109 all merged, docs, agent)
- Sequential split-merge per PR104 audit OPTION B: #104 (1.3) -> #105 (2.0) -> #106 (2.1a) -> #107 (2.1) -> #108 (2.2-2.6 two-part label) -> #109 (PR-F timeouts). Green checks before every merge.
- Added docs/reports/PR104_PHASE2_INTEGRATION_AUDIT.md to main (was local-only) + execution outcome appended.
- Prod env untouched. Owner action unblocked: flip prod GEMINI_MODEL -> gemini-3.1-pro-preview (clean value).

## 2026-06-10 (PR-F: raise Core read timeouts for pro-model, CODE, agent)
- `timeoutMs: 20_000 → 40_000` for readDocument in 4 routes (translation/tps/reparole/ead) — gemini-3.1-pro-preview observed at 28s on handwritten birth cert; 20s cap silently degraded pro reads to flash (PR104 audit, timeout_status: CONFLICT).
- `maxDuration: 30 → 60` on reparole + EAD routes (translation/TPS already 60).
- Prerequisite for owner flipping prod GEMINI_MODEL → gemini-3.1-pro-preview. tsc 0.

## 2026-06-09 (Phases 2.2–2.6: All flag gates removed, GPT-4o deleted, wizard cleanup, CODE, agent)
- **Phase 2.2** `apps/web/src/app/api/tps/ocr/extract/route.ts`: removed `ONE_BRAIN_CORE_ENABLED` flag gate; Core B1 unconditional for UA identity docs. `coreStatus` initial value `'skipped_no_mapping'` (was `'off'`). Logs `[ONE_CORE_TPS]` → `[Core/TPS]`.
- **Phase 2.2a** `apps/web/src/lib/docintel/documentRegistry.ts`: added `us_ead`, `us_i94`, `us_i797` specs (script `latin`; consumers `ead`/`reparole`/`tps`).
- **Phase 2.3** `apps/web/src/app/api/reparole/ocr/extract/route.ts`: removed `ONE_CORE_REPAROLE_ENABLED` flag gate (was: if !flagOn → 503). Route always runs Core.
- **Phase 2.4** `apps/web/src/app/api/ead/ocr/extract/route.ts`: removed `ONE_CORE_EAD_ENABLED` flag gate (same pattern).
- **Phase 2.5** `apps/web/src/app/api/ocr/extract/route.ts`: removed OpenAI vision block, `ENABLE_OPENAI_VISION` flag, `image_base64` param. DeepSeek text-parse retained. No live callers confirmed.
- **Phase 2.6** `apps/web/src/lib/engine/models.ts`: removed `openaiReader()` (gpt-4o). GPT fully removed per ADR-017.
- **Wizard** `ReparoleWizardV2.tsx`: removed `REPAROLE_CORE_ENABLED`; `useCoreRoute = CORE_COVERED_SLOTS.has(id)`.
- **Wizard** `EADWizard.tsx`: removed `EAD_CORE_ENABLED`; STEPS always 8 with StepUpload.
- Tests updated (2 files): replaced flag-existence assertions with Phase 2.3/2.4 unconditional assertions.
- tsc 0 errors. 2974 passed | 4 skipped | 0 failed.

## 2026-06-09 (Phase 2.1: Translation Core unconditional + CENTRAL_BRAIN dead code removed, CODE, agent)
- `ONE_BRAIN_CORE_ENABLED` flag gate removed from `apps/web/src/app/api/translation/vision-extract/route.ts`. Core B2 is now the unconditional default path.
- Dead `CENTRAL_BRAIN_TRANSLATION` consensus block (~40 lines, `CENTRAL_BRAIN_TRANSLATION === 'on' && ONE_BRAIN_CORE_ENABLED !== '1'` condition) removed. Was unreachable when ONE_BRAIN_CORE_ENABLED=1 (already ON in prod).
- Dead imports removed: `analyze` (central-brain), `deepseekProseTranslator` (engine/translator), `DOC_TYPES` (engine/docTypes).
- `degradedFromBrain` variable removed. Response `status` field: Core emits `ok:core-b2` (unchanged); legacy fallback now emits `ok:legacy-reader` (was `ok:degraded-legacy`). `degraded`/`degraded_reason` response fields removed.
- Legacy reader (with D0 preprocessing + quality gate) stays as fallback for Core errors + 0-field fallthrough.
- Phase 2.0b confirmed already done: `gemini-2.0-flash` removed from fallback chain in prior session.
- tsc 0; 2975/4 (0 regressions, 0 new tests — code-only cleanup). Prod untouched (ONE_BRAIN_CORE_ENABLED=1 already ON → behavior unchanged). Branch feat/one-brain-gemini-core (PR #104).

## 2026-06-09 (Phase 2.1a: Translator hard-case unbypass, CODE, agent)
- **RC-1 unblocked (flag-gated):** birth/marriage docs (`auto:false`) now route through vision-extract + hard-case review gate when `NEXT_PUBLIC_HARD_CASE_AUTOREAD_ENABLED=1`. Default OFF = byte-identical.
- 3-way state machine: flag OFF → manual unchanged; flag ON + 0 fields → falls through to manual; flag ON + fields → `hardCaseHasFields=true`, `needsReviewGate=true`, all fields `review_required`, payment blocked until all confirmed.
- `autoread?: boolean` on DocTypeMeta (birth + marriage); `hardCaseHasFields` state (useState false, cleared on resetAll); `needsReviewGate = currentDocMeta?.auto || hardCaseHasFields`; `unresolvedReviewFields` and `canProceedToCertifiedOutput` use `needsReviewGate`.
- Screen 2 UI: autoread docs show gold "hard case" notice; manual docs show specialist notice. I18n keys: `s2_hard_case_note` (RU + EN).
- Files: `apps/web/src/components/services/translation/TranslateWizard.tsx`, new `apps/web/src/components/services/translation/__tests__/hardCaseAutoread.test.ts` (14 tests, pure logic, no React render).
- tsc 0; full suite 2975/4 (was 2961, +14 new, 0 regressions). Prod untouched. No model/provider/payment/PDF/PII change. Branch feat/one-brain-gemini-core (PR #104).

## 2026-06-09 (Phase 2.0: rawCyrillic threaded + D2 sees Cyrillic + 4 bug fixes, CODE, agent)
- **GAP A fixed:** rawCyrillic threads ExtractedDocField → FieldCandidate.rawCyrillic (new field) → CanonicalField.rawCyrillic (new field). No longer dropped by docintelToCandidate.
- **GAP B fixed:** `applyKnowledge()` in arbitration.ts now feeds D2 with `f.rawCyrillic ?? normalizedValue ?? rawValue`. D2 Cyrillic rules (gazetteer, RU/UA spelling, patronymicReconcile, normalizeName) now fire on original Cyrillic text instead of derived Latin.
- **Bug A fixed:** `knowledgeNormalize.ts` date handler: ISO YYYY-MM-DD → USCIS MM/DD/YYYY without false review; already-USCIS MM/DD/YYYY pass-through.
- **Bug B fixed:** `sourceBasis` field added to `KnowledgeNormalizeCtx`; derived KMU-55 Latin gets evidenceStrength 0.6 vs MRZ/EAD/I-94 controlling Latin (0.99).
- **Bug C fixed:** `documentFieldReader.ts` — emit review (canonical_value_unresolved) instead of silently dropping field when `toCanonicalValue()` returns null but `r.cyrillic` is non-empty.
- `canonicalToFieldOut`: prefers `f.rawCyrillic` over cyrillicMap (map kept for backward compat).
- Files changed: `canonical/core/types.ts`, `canonical/types.ts`, `canonical/core/translationAdapter.ts`, `canonical/core/arbitration.ts`, `docintel/documentFieldReader.ts`, `canonical/core/knowledgeNormalize.ts`.
- New test file: `canonical/core/__tests__/phase20CyrillicD2Door.test.ts` (24 tests).
- tsc 0; full suite 2961/4 (was 2937, +24 new, 0 regressions). Prod untouched. KNOWLEDGE_BRAIN_ENABLED default OFF. Branch feat/one-brain-gemini-core (PR #104).
- Proof: docs/reports/PHASE_2_0_CYRILLIC_D2_DOOR_PROOF.md.

## 2026-06-09 (product readiness comparison TPS/Translator/Reparole/EAD, docs-only, agent)
- read latest audits (PRODUCT_RUNTIME_ARCHITECTURE, ONE_BRAIN_FINAL_STATUS, ACTUAL_PRODUCT_CALL_GRAPH + session surface maps + zero-trust) and wrote PRODUCT_READINESS_COMPARISON_2026-06-09.md.
- alignment to Constitution: Reparole 85% (reference) > EAD 80% (clean arch; US-doc registry specs UNPROVEN, no scorable fixtures, thinnest UX) > Translator 60% (3 branches) > TPS 40% (default Vision/DocAI+rule modules).
- FLAGSHIP PARADOX: Translator birth/marriage `auto:false` → vision-extract never called → manual ticket (incident RC-1 STILL TRUE). Safety stack now proven → added Phase 2.1a "Translator hard-case unbypass" (flag-gated). TPS convergence narrowed to UA-docs (keep deterministic US-form modules + Vision/DocAI as the eye). Added 2.2a EAD registry proof + owner fixtures ask.
- priority: 2.0 → 2.1a → 2.2 → EAD proof → tabs. docs-only; no code/prod/env/keys/PII; flags OFF. Branch feat/one-brain-gemini-core (PR #104).

## 2026-06-09 (self-check: corrections to my own claims + 4 design bugs found, docs-only, agent)
- FACT CORRECTION: full `vercel env ls` (earlier grep missed ONE_CORE_*): ONE_BRAIN_CORE/ONE_CORE_TPS/ONE_CORE_REPAROLE/ONE_CORE_EAD (+NEXT_PUBLIC twins), CENTRAL_BRAIN_TRANSLATION, DOCAI_ENABLED are ALL PRESENT in prod → Core arbitration is LIVE for all 4 products; KNOWLEDGE_BRAIN_ENABLED=1 in prod would fire immediately (NOT a no-op as I claimed). "Core parked behind unflipped flags" narrative corrected; Phase 2 = harden live Core + retire legacy fallbacks, not "flip Core on".
- DESIGN BUGS found in my Phase-1 D2 (all fix-in-2.0, flag still OFF so inert): (1) convertDateToUSCIS rejects ISO yyyy-mm-dd → correctly-read dates flagged date_unparsed (false review noise, seen in 1.4 run); (2) "preserve Latin" conflates derived KMU-55 Latin with controlling Latin — controlling must be source-based (mrz/ead/i94), not script-based; (3) documentFieldReader.ts:71 silently DROPS fields when toCanonicalValue→null (raw_cyrillic lost, no candidate/review); (4) RU-spelling-on-UA framing wrong for Soviet bilingual docs (RU spelling may be literally as-written; review stays, but reason/era context must distinguish — GT_LANGUAGE_INTENT: value=as-written).
- docs-only; no code/prod change; flags OFF. Branch feat/one-brain-gemini-core (PR #104).

## 2026-06-09 (Cyrillic Constitution assembled + mapped to real code, docs-only, agent)
- per owner: analyzed the full Cyrillic data highway (read code, not docs) and assembled the owner's iron constitution into ONE product schema: docs/architecture/ONE_BRAIN_CYRILLIC_CONSTITUTION.md (canonical architecture).
- code-grounded trace: Gemini reads VisionFieldRead.cyrillic; documentFieldReader.ts:70 runs toCanonicalValue IN the read loop → ExtractedDocField.value = KMU-55 Latin, raw_cyrillic kept alongside (:76); docintelToCandidate (translationAdapter.ts:50) drops raw_cyrillic (FieldCandidate.value=Latin; Cyrillic only in side cyrillicMap for display). Core/D2/C3/audit see Latin.
- GAPS: A=raw_cyrillic dropped from Core record; B=D2 partial at toCanonicalValue (city/oblast on Cyrillic, but name=bare KMU-55 no RU/UA check, no KnowledgeDecision); C=3 D2 sites/2 flags (Door A toCanonicalValue + Door B documentFieldReader post-pass SMART_NORMALIZE + my arbitration knowledgeNormalize KNOWLEDGE_BRAIN); D=no final_value, C3 post-adapter on Latin. documentFieldReader = the one shared door (anti-fab/self-consistency already centralize there).
- realization (unified, supersedes "3rd layer"): D2 = ONE layer at the one door on raw_cyrillic (toCanonicalValue+Door B emit KnowledgeDecision, retire arbitration dup, one flag); carry rawCyrillic+decision forward into FieldCandidate/CanonicalField; final_value + C3 single writer; PDF reads final_value only.
- docs-only; no code/prod/env/keys/PII; flags OFF; ReaderResult/OneBrain HOLD. Branch feat/one-brain-gemini-core (PR #104).

## 2026-06-09 (knowledge inventory + audit synthesis — Phase 2.0 reconciled, docs-only, agent)
- per owner ("inventory the dictionaries + read audits first"): read live data inventory + 4 prior audits (KNOWLEDGE_CORE_INVENTORY 06-03, CYRILLIC_HANDLING_ARCHITECTURE 06-03, P2_DICTIONARY_IN_LIVE_PATH_CHECKPOINT 06-03, FAILED_CYRILLIC_GROUND_TRUTH 06-02).
- FINDING 1 (architecture): a dictionary-in-path layer ALREADY exists at the right place (raw Cyrillic) — SMART_NORMALIZE_ENABLED P2.1-P2.3 (Door A toCanonicalValue→snapCity; Door B documentFieldReader patronymic/authority, tests 25/25). My Phase-1 knowledgeBrain at arbitration duplicates it at the WRONG layer (post-KMU-55 Latin). → Phase 2.0 reframed: RECONCILE to ONE layer at Door A/B keeping my KnowledgeDecision contract; retire the arbitration duplication. Supersedes "thread rawCyrillic".
- FINDING 2 (risk): dominant real failure = wrong_person_selected (model reads a different identity; 2.5-pro false-confidence on birth certs) — NOT a dictionary problem; defended by always-review policy + model choice + reshoot.
- inventory: gazetteer/settlements = SEED (35/458 vs ~28-30k KOATUU); deprecated gemini-2.0-flash (404) still in fallback chain (bug → 2.0b); civil_registry_terms.json + GLOBAL_BLOCKLIST/FIELD_LABELS orphaned. HARD GATE: any dict layer in prod FORBIDDEN until owner GT + OFF/ON delta; per-class model selection GT-gated.
- docs-only; no code/prod/env/keys/PII; all dict flags OFF; ReaderResult/OneBrain HOLD. Report: KNOWLEDGE_INVENTORY_AUDIT_SYNTHESIS_2026-06-09.md. Branch feat/one-brain-gemini-core (PR #104).

## 2026-06-09 (Phase 1.4 — real-doc Knowledge Brain proof + Cyrillic-bypass finding, agent)
- ran real Soviet + handwritten birth certs through readDocument (real Gemini gemini-3.1-pro-preview) → applyKnowledgeBrainIfEnabled (KNOWLEDGE_BRAIN_ENABLED=1) via a temp harness (created→run→DELETED, suite count untouched). SANITIZED output only (field name + action/rule/provenance/booleans, NO values/PII).
- safety PASS: D2 provenance on every field; conflict→review+suggestedValue (child_patronymic→patronymic.fragment; issuing_authority/date_of_issue→authority.unknown); no silent override; no Cyrillic leaks in accepted finals.
- FINDING: D2's Cyrillic-dependent rules (gazetteer / RU-spelling / normalizeName-on-Cyrillic) are bypassed on the live pipeline — docintel KMU-55-transliterates to Latin BEFORE arbitration (translationAdapter candidate.value = KMU-55 Latin; Cyrillic in separate cyrillicMap; FieldCandidate has no rawCyrillic). Safe, but accuracy value not yet delivered. Added Phase 2.0 prerequisite (thread rawCyrillic to D2; eventual: D2 = single transliteration authority).
- docs/plan only; no product code change; no prod/env/keys/PII; flags OFF; ReaderResult/OneBrain HOLD. Branch feat/one-brain-gemini-core (PR #104).

## 2026-06-09 (binding D2/C3/final_value contract recorded in ADR-017 — Phase 2 gate, docs-only, agent)
- owner verdict APPROVE_CONTRACT_BEFORE_PHASE_2. Recorded the binding contract in ADR-017 §"BINDING CONTRACT — D2/C3/final_value" + restructured ONE_BRAIN_GEMINI_BUILD_PLAN.md phase order.
- contract: (1) D2 annotates only, never writes final_value; (2) C3 is the SINGLE writer of final_value (accept_final→final_value=normalized_value, else null; D5 confirmation re-runs C3 so confirmed fields can become final via C3, not by bypass); (3) D6/PDF reads only final_value, critical null→block (admin/optional null does not block); (4) D5 reads normalized+suggested+reasons, crop later via ReaderResult/Vision bbox (non-blocking); (5) ONE criticality taxonomy for D2+C3; (6) adapters must not drop suggested_value/rule_id/provenance/reason_codes/evidence_strength/review_required; (7) phase order 1.4→2(Core-default per product)→3(explicit final_value + C3 final writer)→4(Knowledge canary after Core-default)→ReaderResult/crop later.
- 2 mentor refinements added: D5 user-confirmation re-runs C3 (else confirmed fields could never be final); PDF block scoped to CRITICAL final_value=null only.
- primary risk reframed: downstream bypass, not Gemini. Defense = final_value=null until C3/confirmation. final_value is NOT yet on CanonicalField (Phase 3 adds it; until then gate = normalized_value + review_required).
- docs-only; no code/prod/env/keys/PII change; KNOWLEDGE_BRAIN_ENABLED default OFF; ReaderResult/OneBrain HOLD. Branch feat/one-brain-gemini-core (PR #104).

## 2026-06-09 (Phase 1.3 — wire Knowledge Brain through ONE shared helper, agent)
- owner directive: wire through one shared helper, not four route forks. Created `canonical/core/knowledgeBrain.ts`: isKnowledgeBrainEnabled / buildKnowledgeContext (central doc-class/ukrainianDoc/historical derivation) / applyKnowledgeBrainIfEnabled (arbitrate, apply D2 only when flag ON).
- wired all 4 Core arbitration callers (translation/tps/reparole/ead) via the helper — 1-line diff each; removed direct arbitrateDocument imports from routes; no route-local KMU/gazetteer/patronymic logic.
- OFF proof: applyKnowledgeBrainIfEnabled deep-equals arbitrateDocument(candidates) (knowledgeBrain.test.ts); canonical 329/329 unchanged; full suite 2937 passed/4 skipped; tsc 0. ON proof (vi.stubEnv): Russian-on-UA→review+suggestedValue (read kept), clean UA→accept, provenance present.
- legacy /api/ocr/extract + generate-pdf are NOT arbitration seams → intentionally not D2-forked (legacy retires Phase 2; PDF inherits D2 + C3 gate). 6 new tests (knowledgeBrain.test.ts).
- no prod/env/model/provider/SMART/D0/ReaderResult/OneBrain/HTR/GPT change; KNOWLEDGE_BRAIN_ENABLED default OFF; no PII (provenance = rule ids only); qa-private untouched. Branch feat/one-brain-gemini-core. Report: docs/reports/KNOWLEDGE_BRAIN_PHASE_1_3_WIRING_PROOF.md.

## 2026-06-09 (Phase 1.2 — D2 authority contract, safe no-silent-override, agent)
- owner AI-risk review (ACCEPT_PHASE_1_ONLY) correctly rejected "dictionary silently overrides reader": that just trades a Gemini hallucination for a dictionary one. Rebuilt knowledgeNormalize.ts as a managed AUTHORITY LAYER before any wiring.
- `knowledgeNormalize` now returns a DECISION {action: accept|preserve|suggest|review|block, finalValue, candidateValue, ruleId, reasonCodes, provenance, evidenceStrength} — never a silent value. `arbitrateDocument(candidates, knowledge?)`: accept/preserve→deterministic final; suggest/review/block→keep READ value, set `suggestedValue`, force review_required (critical identity never silently finalized from D2). `isKnowledgeBrainEnabled()` gates callers (KNOWLEDGE_BRAIN_ENABLED, default OFF). `CanonicalField.knowledgeRule/knowledgeProvenance` added (Phase-4 audit).
- conflict-case tests (12): Russian-spelling-on-UA→review (candidate offered, not silent "Sergey"); clean UA→accept (KMU-55); gazetteer exact→accept, fuzzy→suggest (never overwrite); patronymic fragment→review; MRZ Latin→preserve; unknown authority→review (do not invent); arbitration OFF=byte-identical / ON=conflict→review. tsc 0; canonical suite 329/329 (OFF identical proven); full suite 2931 passed / 4 skipped.
- ADR-017 updated with binding §D2 authority contract. No prod/env/keys/PII change (prod 03eb30f, flag OFF). ReaderResult/OneBrain runtime HOLD per owner verdict. Branch feat/one-brain-gemini-core.

## 2026-06-09 (REBUILD: ADR-017 ONE Gemini brain + Phase 1.1 dictionary-in-brain, agent)
- mentor verdict on owner's "consensus org-chart": 70% right (D0→D6 + Auditor pipeline) but center wrong — consensus voting fixes none of the incident root causes and is a committee of one (GPT out, HTR dead). Decided ADR-017: ONE Gemini brain + deterministic knowledge truth (D2 can override reader) + review gate; one shared pipeline for all products. Real cause of "3 weeks → 0" = fragmentation (4 products / 4 regimes / Core parked behind unflipped flags).
- scope locked by owner: Gemini = recognition (all keys/models); DeepSeek retained fully (prose/Mia/crossref); GPT removed; HTR parked; keys/prod owner-managed.
- 5 read-only surface-map agents run (Translator/TPS/Reparole/Knowledge/model-inventory): Gemini already primary reader (gemini-3.1-pro-preview→flash); TPS default=Google Vision+rules; knowledge layer strong but only partly wired to outputs (Translator path misses normalizePlace/oblast/patronymic — the accuracy gap).
- Phase 1.1 (CODE): `apps/web/src/lib/canonical/core/knowledgeNormalize.ts` — pure deterministic dictionary-in-brain (KMU-55/gazetteer/patronymic/oblast→nominative/authority on FINAL value; Latin/MRZ preserved; never-silent fuzzy→review). 8 tests RED→GREEN; tsc 0. Pure/unwired = byte-identical.
- docs: ADR-017-one-gemini-brain-not-consensus.md; ONE_BRAIN_GEMINI_BUILD_PLAN.md. Branch feat/one-brain-gemini-core off origin/main 03eb30f. No prod/env/keys/PII/qa-private change. SECURITY: owner pasted live Gemini+service-account keys in chat → flagged, must rotate; repo tracked files verified clean (only test placeholder 'key123').

## 2026-06-06 (P0 vision-extract 502 triage + fix, agent)
- runtime proof (preview deploy of fix branch): ead no-fields probe → HTTP 200 {ok:false,status:unknown_document_type,review_required:true} (identical request = 502 on prod); blank ua_birth_certificate → 200 all fields value:null+review_required (no 502, no fabrication). PR #99.
- root cause: /api/translation/vision-extract returned HTTP 502 on every zero-field read — final return was `status: ok ? 200 : 502`. Proved by hitting the Vercel origin directly (bypassing Cloudflare): full valid JSON body returned WITH status 502, server=Vercel, x-vercel-id present, no crash, safety gate ran. Through Cloudflare the body was masked as bare "error code: 502". 502 in ~0.5-1.3s ⇒ not a timeout (maxDuration=60). This is the original "translator 0 results" incident; affects real hard-case docs that read 0 fields.
- fix: final return → status 200 always; added review_required:true to the no-fields body (zero recognition never silent success). 400/413/415/429 unchanged. True unhandled exceptions still 500.
- tests: NEW visionExtract502.test.ts (6 source-level guards). tsc 0; full suite 2919 passed / 4 skipped (was 2913+6). C3 documentSafety green.
- no prod env/flag change; no model/provider; no PII (synthetic inputs); qa-private=0. Branch fix/vision-extract-502-triage, PR open. Re-run OCR field-safety canary only after merge; ReaderResult/OneBrain HOLD.

## 2026-06-06 (OCR field-safety canary — DEGRADED, rolled back, agent)
- canary: enabled OCR_FIELD_SAFETY_ENABLED=1 in prod + code-free redeploy (commit 0d3d82b). Route proof blocked: every Translation vision-extract request reaching the Gemini model-read path returned 502 (synthetic non-PII images, all sizes/docTypes). Early quality-guard path returned 200 (route healthy).
- disambiguation: rolled back flag to OFF + redeploy; identical probe STILL 502 → 502 is PRE-EXISTING and flag-independent (gate runs post-read, never executed; no exception/stack logged — gateway timeout signature).
- rollback: OCR_FIELD_SAFETY_ENABLED ABSENT/OFF (verified). prod==main==0d3d82b, healthz ok. anti-fab/self-consistency/SMART/D0/model/provider untouched. No PII (synthetic inputs). qa-private=0.
- docs: OCR_FIELD_SAFETY_CANARY_RESULT.md. NEW finding (out of C3 scope, NOT proven for real uploads): vision-extract read-path 502 on synthetic requests — separate triage. C3 code-ready/prod OFF; D0/ReaderResult/OneBrain HOLD.

## 2026-06-06 (C3 stack merged + proof + canary runbook, agent)
- merge: #94 (audit) → #95 (guard) → #96 (C3 wiring) all MERGED to main (0d3d82b). tsc 0; full suite 2913 passed / 4 skipped on merged main.
- verify: OCR_FIELD_SAFETY_ENABLED ABSENT (OFF) in prod (vercel env ls). prod deploy of 0d3d82b catching up through stacked merges (flag OFF = byte-identical).
- docs: C3_OCR_FIELD_SAFETY_PROOF.md (flag-ON logic proof per flow) + OCR_FIELD_SAFETY_CANARY_RUNBOOK.md (owner enable/rollback/checks/stop-conditions).
- no prod env/flag change; no model/provider/HTR/OneBrain/SMART; no PII; qa-private=0. Canary = owner step; D0/ReaderResult/OneBrain HELD.

## 2026-06-06 (C3 FULL verified + flag-ON proof, agent)
- verified all 4 flows wired (grep): translation vision-extract, tps/ocr/extract, legacy ocr/extract, generate-pdf — all behind OCR_FIELD_SAFETY_ENABLED (OFF).
- added c3FlowSafety.proof.test.ts: flag-ON logic proof per flow (hard-case→candidate; zero-recognition→manual; legacy/source-mismatch→not final; PDF gate blocks unresolved critical, admin passes).
- evidence: tsc 0; documentSafety 38 tests; full suite 2913 passed / 4 skipped. OFF byte-identical. Prod flag NOT enabled; no env/model/provider/HTR/OneBrain/SMART; no PII; qa-private=0.

## 2026-06-06 (C3 wiring COMPLETE: all 4 flows behind OFF flag, agent)
- wire: TPS merge (tps/ocr/extract — mergedModule.fields through guard, legacy untrusted, normalized_value→null for unsafe critical), legacy boundary (/api/ocr/extract — legacy_reader/candidate-only annotation), PDF/payment (generate-pdf — hasUnresolvedCriticalForOutput blocks unresolved critical; admin passes). Translation public wired earlier this branch.
- all behind OCR_FIELD_SAFETY_ENABLED (default OFF). evidence: tsc 0; documentSafety 28 tests; full suite 2903 passed / 4 skipped — OFF byte-identical, zero regression.
- prod flag NOT enabled; no env/model/provider/HTR/OneBrain/SMART change; no PII; qa-private=0. Report docs/reports/C3_OCR_FIELD_SAFETY_WIRING.md.

## 2026-06-06 (C3 wiring inc.1: global OCR field safety wired into Translation public, OFF flag, agent)
- feat: applyOcrFieldSafety helper (classifyCriticality + apply guard to field list) + isOcrFieldSafetyEnabled (OCR_FIELD_SAFETY_ENABLED default OFF).
- wire: /api/translation/vision-extract — guarded block; OFF=byte-identical; ON ⇒ unsafe critical (hard-case/source-mismatch/stale/low-conf/zero-recognition) → candidate-only + review/manual, never final value; response carries ocr_field_safety.
- fix: guard manual_required now set for candidate_only too (contract 2.5: unsafe critical needs human action).
- evidence: tsc 0; documentSafety 28 tests (RED→GREEN); full suite 2903 passed / 4 skipped (flag OFF, zero regression).
- remaining C3 (same helper, next): TPS merge, legacy boundary, PDF/payment. Report docs/reports/C3_OCR_FIELD_SAFETY_WIRING.md.
- prod flag NOT enabled; no env/model/provider/HTR/OneBrain/SMART change; no PII; qa-private=0.

## 2026-06-06 (containment: global OCR field safety guard — built+tested, not wired, agent)
- feat: `apps/web/src/lib/documentSafety/ocrFieldSafetyGate.ts` — single global guard enforcing GLOBAL_OCR_FIELD_SAFETY_CONTRACT (candidate≠final, zero-recognition≠success, source/stale/hard-case/legacy/low-conf→not final, review/manual monotonic). PII-free by construction (takes value_present booleans, never the value). + hasUnresolvedCriticalForOutput shared PDF/payment gate.
- evidence: tsc 0; 18 guard tests (RED→GREEN equiv, incl. no-PII assertion); full suite 2893 passed / 4 skipped — guard pure/unwired = byte-identical, zero regression.
- NOT wired into product flows yet (next C3 increment, behind OCR_FIELD_SAFETY_ENABLED default OFF, per-flow + tests). Report docs/reports/GLOBAL_OCR_FIELD_SAFETY_CONTAINMENT.md.
- no prod env/flag change; no model/provider/HTR/OneBrain/ReaderResult/SMART; no PII; qa-private=0.

- 2026-06-06: scrubbed incident-document identity values from P0 docs → generic placeholders (no PII in docs).
- 2026-06-06: also genericized the legacy "Yovych" bug-label in STATUS incident block.

## 2026-06-06 (P0 OCR forensic audit — docs-only, agent)
- OCR/recognition reclassified INCIDENT / NOT TRUSTED after owner birth-cert incident (translator 0 results; TPS wrong/flagged patronymic + blanks).
- Read-only forensic map: 6 reader paths / 4 safety regimes (Gemini-gated docintel; TPS-core gated; TPS-legacy-modules ungated; translation-session=DeepSeek ungated conf<0.70; translation-public=Gemini gated but skipped when docType auto:false; legacy /api/ocr/extract=gpt-4o-mini ungated, called by /api/ocr/translate).
- Root causes: RC-1 public translator birth auto:false → skip API → 0 results (config, not crash; commit fca0582); RC-2 candidate≠final not enforced → wrong value ("Yovych" truncated patronymic, DOB month) shown AS value with only a review flag; RC-3 six paths/four regimes (no global contract); RC-4 TPS multi-doc aggregation; RC-5 TPS core→legacy fallback ungated.
- Ruled out: D0 (QUALITY_GATE_ENABLED absent in prod), anti-fab/self-consistency gates (keep values), server crash (0 error/fatal/5xx), Supabase.
- Artifacts: docs/reports/P0_OCR_FLOW_INVENTORY.md, P0_FIELD_LIFECYCLE_MAP.md, P0_ROOT_CAUSE_ANALYSIS.md, P0_OCR_SAFETY_TEST_PLAN.md; docs/architecture/GLOBAL_OCR_FIELD_SAFETY_CONTRACT.md (10 rules).
- FROZEN until containment: D0 prod / ReaderResult / OneBrain / HTR / 2nd provider / SMART / model. No code/flag/env/prod change; no PII; qa-private=0.


## 2026-06-05 (D0 quality/reshoot — first real brick, behind flag OFF, agent)
- merge: PR #90 (operating contract) MERGED → origin/main 3d9d566 (rails locked in main).
- feat(D0): `lib/docintel/quality/documentImageQuality.ts` — pure decision module: image metrics
  (brightness/blurScore/resolution, reused from lib/ocr/image-preprocess) → ACCEPT / DEGRADED_REVIEW /
  RESHOOT_REQUIRED + signals + reshoot message keys (RU). Flag `QUALITY_GATE_ENABLED` default OFF.
- wiring: guarded inert block in app/api/translation/vision-extract/route.ts — flag OFF ⇒ byte-identical;
  flag ON ⇒ a too-blurry/dark/small photo returns a reshoot instruction before OCR.
- hard rule: blur is NEVER an anti-fabrication signal (test asserts no fabrication/identity text in output).
- evidence: tsc 0 errors; D0 tests 16 passed; full suite 2875 passed / 4 skipped (flag OFF = nothing broke).
  Report: docs/reports/D0_QUALITY_RESHOOT_IMPLEMENTATION.md.
- no prod flag enabled; no model/provider/HTR/OneBrain/SMART change; no prod env/deploy; no PII; qa-private=0.

## 2026-06-05 (operating contract refinements — Gemini-first guardrails, docs-only, agent)
- refine AGENT_OPERATING_CONTRACT §3: + "Gemini-first ≠ multi-provider fan-out", "HTR research ≠ HTR implementation".
- refine §6 + Phase Gate 6: Gemini top-version benchmark must precede ANY non-Gemini provider discussion.
- Phase Gate 0: + PR #89 Gemini-first merged. OWNER_QUEUE: + owner command before any non-Gemini provider discussion.
- Docs-only; no runtime/flag/env change; no PII; qa-private=0. Applied to the open agent-operating-contract PR.

## 2026-06-05 (agent operating contract + phase gates + D0 start pack — docs-only, agent)
- merge: PR #89 (Gemini-first correction) MERGED → origin/main 50ee030 (prod deploy catching up, docs-only).
- docs: created the project "rails" so future agents don't confuse live/target or jump to HTR/GPT/OneBrain:
  - `docs/architecture/AGENT_OPERATING_CONTRACT.md` — current live reality, target, forbidden confusions,
    agent autonomy (may-do-without-asking vs must-stop-and-ask), evidence contract, phase-gate rules, hard rules.
  - `docs/reports/RECOGNITION_PHASE_GATES_CHECKLIST.md` — Gates 0–6 with required evidence; no phase starts
    until prior is PASS; HTR/second provider only after GT from different people + owner decision.
  - `docs/reports/NEXT_PROMPT_B_D0_QUALITY_RESHOOT.md` — copy-paste D0 prompt (flag default OFF; blur never a
    fabrication signal; reshoot UI; tests) — NOT started (waits for clean monitor + owner "start D0").
- No runtime/flag/env change; no code; no PII; qa-private=0. Next code step = D0, owner-gated.

## 2026-06-05 (Gemini-first roadmap correction — docs-only, agent)
- correction (owner): reader strategy = GEMINI-FIRST. Removed all near-term GPT-4o framing from the roadmap docs.
  D1 near-term work stays within the Gemini family (top versions/benchmarks); a second reader is a
  provider-agnostic DISABLED slot (GPT-4o/Claude NOT near-term); HTR research-only — all gated on GT breadth +
  owner decision + cost/privacy/accuracy evidence; no multi-provider fan-out until ROI proven.
- files patched (docs-only): RECOGNITION_TARGET_ARCHITECTURE_D0_D6.md (D1 Gemini-first block), RECOGNITION_SYSTEM_TRUTH_MAP.md,
  RECOGNITION_BUILD_PLAN_PHASES.md (Phase 3 + Phase 10), NEXT_AGENT_PROMPTS_RECOGNITION_STRUCTURE.md (Prompt C),
  RECOGNITION_ROADMAP_FROM_CURRENT_TO_TARGET.md (target diagram, gap list, Wave E — removed "Wire GPT-4o").
- PR #88 already merged → this is a follow-up correction PR. No runtime/flag/env change; no PII; qa-private=0.

## 2026-06-05 (recognition structure roadmap — docs-only, agent)
- merge: PR #87 (monitoring) MERGED → origin/main 951d4f6 (monitoring baseline locked before architecture work).
- docs: read-only repo classification → 4 architecture docs (NO code/flag/prod change):
  - `docs/reports/RECOGNITION_SYSTEM_TRUTH_MAP.md` — LIVE (readDocument+Gemini+arbitration+gates+review/PDF, TPS centralBrain plane) / PARKED (decideField, consensus, htr — 0 callers) / LEGACY (central-brain+orchestrator dormant, engine/models+GPT-4o on legacy /api/ocr/extract, tps modules) / TARGET.
  - `docs/architecture/RECOGNITION_TARGET_ARCHITECTURE_D0_D6.md` — D0 quality → D1 readers(ReaderResult) → OneBrain → D2 knowledge(signal) → D3 translation → D4 validators → D5 review → D6 PDF → Auditor.
  - `docs/reports/RECOGNITION_BUILD_PLAN_PHASES.md` — 10 phases, each with objective/files/allowed/tests/stop/rollback/forbidden; D0 first (bad photo breaks everything), OneBrain shadow-first, HTR/GPT-4o research-only after GT breadth.
  - `docs/reports/NEXT_AGENT_PROMPTS_RECOGNITION_STRUCTURE.md` — 5 copy-paste prompts (A monitoring closeout, B D0, C ReaderResult, D OneBrain shadow, E Auditor).
- truth held: this is a safety wrapper, NOT a full brain; HTR/GPT-4o/consensus/OneBrain still not live (parked). No runtime/flag/env change; no PII; qa-private=0.

## 2026-06-05 (Wave D monitoring set up — agent)
- merge: PR #86 (docs-only FINALIZE) MERGED → origin/main 08b183a; PR #85 also merged. prod deploy in progress (healthz 7c6068c, behavior-identical docs change).
- monitor: added `.github/workflows/prod-safety-monitor.yml` — READ-ONLY public healthz check every 6h (+ workflow_dispatch), permissions contents:read, NO secrets, self-no-ops after 2026-06-07 (temporary — delete after window). Deeper Vercel-log/metric/review_rate checks need a VERCEL_TOKEN that is NOT a repo secret → manual runbook instead.
- monitor: added `docs/reports/PROD_SAFETY_MONITORING_24H_RUNBOOK.md` — manual `vercel`/curl commands + what-to-watch (5xx, metric count, review_rate incl. printed-birth-cert false positives, self-consistency latency/cost, UI/PDF block) + rollback policy (SELF_CONSISTENCY first, keep ANTI_FAB; never execute without owner confirm unless active harm).
- No runtime code/flag/env change; no PII; qa-private tracked=0. Next: monitor 24–48h, then GT from different people (no new architecture).

## 2026-06-05 (FINALIZE — PASS_RUNTIME_VERIFIED, agent)
- verify: prod == main == 7c6068c (healthz ok; latest prod deploy dpl_6rXpz READY); PR #85 merged.
- verify: anti-fab gate firing is now PROD-RUNTIME-OBSERVED — owner ran a controlled hard-case prod upload (ua_birth_certificate via /api/translation/vision-extract) → 8/10 review=true, ALL identity protected, admin fields free. Corroborated by runtime logs (2× vision-extract 200 at 02:01–02:02 + metric, 0 errors) and matches the agent's independent local real-model proof field-for-field.
- status: gate verification COMPLETE. Safety wrapper working in prod (Gemini reader + post-passes + anti-fab/self-consistency gates + UI review/PDF block). NOT a full OneBrain — HTR/GPT-4o/consensus/OneBrain still not live (parked). SMART_NORMALIZE absent/OFF.
- next: monitor 24–48h (5xx, review_rate, self-consistency latency/cost, UI/PDF block, support). Rollback ready (self-consistency first if cost rises). No new architecture/code.

## 2026-06-05 (post-runtime GATE verification — env + firing proven, agent)
- verify: `vercel env ls production` (CLI authed as owner) — ANTI_FABRICATION_GATE_ENABLED (2h), SELF_CONSISTENCY_GATE_ENABLED (1h), DOCUMENT_CLASS_METRICS_ENABLED (17h) all PRESENT in Production; SMART_NORMALIZE_ENABLED ABSENT. (ls shows presence+target, not the literal value.)
- verify: gate FIRING proven on the identical readDocument code path, locally, real model + real hard-case Soviet birth cert + flags ON → 5/5 identity fields review_required=true; reasons [handwritten_document, model_instability_risk, no_strong_identity_anchor, self_consistency_identity_mismatch]; values unchanged ON vs OFF; self_consistency status=mismatch (2 reads disagreed on identity) → forced review; non-identity act_record_number NOT forced (scoped). Raw → qa-private (gitignored); report docs/reports/POST_RUNTIME_GATE_VERIFICATION.md.
- residual (owner-only): a literal PROD HTTP hard-case extraction RESPONSE (needs PII upload agent won't do) — flips gate from local-runtime-proven to prod-runtime-observed.
- prod still 0 error/fatal (2h); no code change; no flag touched; no PII to prod; harness removed after run.

## 2026-06-05 (post-runtime re-verification, agent — raw evidence)
- verify: review-gate fix NOW IN PROD — PR #84 merged; origin/main=2d2a391; e298d97 ancestor of main; healthz sha=2d2a391==main. (Was feat-only/not-deployed in the prior entry.)
- verify: independent re-run of the fix — tsc 0 errors; full suite **2859 passed / 4 skipped** (exact match to claim); reviewGate.ts server block + generate-pdf wiring + TranslateWizard client block + new tests all read and correct.
- verify (runtime logs): real prod extractions ran ~01:01–01:03 — 3× POST /api/translation/vision-extract 200 each emitting `[document_class_metric]`, + 2× POST /api/tps/ocr/extract 200; **0 error/fatal in 3h**. → DOCUMENT_CLASS_METRICS = RUNTIME VERIFIED; deployed safety code = no regression.
- GAP (unchanged): env flag VALUES not readable (no Vercel env-list MCP tool) → owner `vercel env ls production`. Anti-fab/self-consistency FIRING not independently confirmable (gates emit no log; metric line truncated; owner's "8/10 review=true" is owner-observed). To prove the gate: capture one hard-case extraction RESPONSE, not logs.
- no code change; no flag touched; no PII upload performed by agent.

## 2026-06-05 (translation public wizard hardening — local runtime verified, agent)
- fix: closed the real public Translation Wizard false-readiness gap in the legacy contour:
  unresolved OCR `review_required` fields now block payment and final PDF download, and
  `/api/translation/generate-pdf` now rejects unresolved OCR review fields from the wizard payload.
- ux: added an explicit `Confirm` action for unchanged OCR-flagged values, so a user can
  human-confirm a correct value without faking an edit; editing or confirming clears the
  local review flag and re-enables the payment path only when all flagged fields are resolved.
- verify: `pnpm --filter web exec tsc --noEmit --pretty false` PASS; `pnpm --filter web test` PASS;
  `pnpm --filter web run build` PASS.
- live local proof on `/en/services/translate-document/start` with real booklet fixture:
  `reviewBadgesBefore=4`, `confirmButtonsBefore=4`, `payDisabledBefore=true`,
  then after explicit confirms `reviewBadgesAfter=0`, `confirmButtonsAfter=0`,
  `payDisabledAfter=false`.
- evidence: `docs/reports/TRANSLATION_REVIEW_HARDENING_2026-06-04.md`
- truth boundary: production still needs one post-deploy reverify for this exact fix.

## 2026-06-04 (target recognition scheme verification, agent)
- verify (read-only): added `docs/reports/TARGET_RECOGNITION_SCHEME_FILE_VERIFICATION_2026-06-04.md`
  to reconcile the requested D0..D6 + Auditor recognition scheme against the actual repository file-by-file.
- confirmed: the scheme exists as architecture docs and as parked `engine/*` + `central-brain/*` code.
- confirmed: the live default product spine is still `docintel/documentFieldReader.ts` + Gemini provider + canonical arbitration, not `consensus.ts` multi-reader control.
- confirmed: D0 preprocess is real; D1 Gemini reader is live; D2 KMU-55 is live; gazetteer/patronymic exist but are not universally active by default; review/PDF/audit pieces exist but are split.
- verdict: repo contains most target building blocks, but the project does NOT yet match the exact target scheme in live runtime. No behavior change; no flag change; no prod mutation.

## 2026-06-04 (latest audit / inventory reconciliation, agent)
- verify (read-only): added `docs/reports/LATEST_AUDIT_INVENTORY_RECONCILIATION_2026-06-04.md`
  to check the newest inventory / audit / matrix / verdict reports against current code.
- confirmed: the freshest truth-layer reports are mostly internally consistent and align with code:
  live spine = `readDocument()` + Gemini provider + arbitration/gates.
- confirmed: older snapshot reports are now partially stale; specifically, reports claiming `ua_military_id`
  absent are outdated because `docintel/documentRegistry.ts` now defines `ua_military_id`.
- clarified: `ROUTE_INVENTORY_2026-05-29.md` remains valid for payment/review-bypass risk, but it does not
  answer the newer "which brain is live" architecture question.
- no behavior change; no test run; no prod mutation.

## 2026-06-04 (critical live-door re-verify, agent)
- verify (read-only): added `docs/reports/CRITICAL_REVERIFY_LIVE_DOOR_2026-06-04.md`
  to correct earlier over-broad claims about what is "not wired" vs "wired behind flags".
- confirmed against code:
  - `snapCity`, patronymic reconcile, authority resolve are already wired into the live `readDocument()` path
  - anti-fabrication and self-consistency are already wired into `readDocument()`
  - `garbageGuard` is runtime-used in UI/review layers, but not server-side in the live reader
- corrected truth: several D2 / verification pieces are present in the live door already; the accurate
  distinction is default-OFF flag-gated behavior versus absent behavior. No behavior change; no prod mutation.

## 2026-06-04 (project understanding master, agent)
- verify (read-only): added `docs/reports/PROJECT_UNDERSTANDING_MASTER_2026-06-04.md`
  after a full-project understanding pass across startup docs, accepted ADRs, repo structure, `lib/*`, and
  product OCR routes.
- confirmed: the repo is best understood as three coexisting architecture layers:
  legacy TPS/product-specific OCR, current shared `docintel` + `canonical/core` live spine, and parked/target
  `central-brain` + `engine/consensus` direction.
- clarified: TPS merge brain (`lib/tps/centralBrain.ts`) is a separate live plane, not dead code.
- no behavior change; no test run; no prod mutation.

## 2026-06-05 (UX review chain — CODE-VERIFIED, agent)
- verify (read-only, Translation flagship): the review→correct→PDF safety chain is wired correctly in code:
  (a) `EvidenceReviewPage.tsx` surfaces review — "Needs review" label + ⚠ + "verify the value is correct",
  driven by `field.is_critical && field.review_required`; (b) `correct-field` route records a `user_corrections`
  row + updates `normalized_value` (user can fix); (c) `generate-pdf` route RETURNS `review_required` gate →
  **PDF is blocked while review is pending** (uncertain fields never flow silently into the PDF); (d) `render`
  route enforces "Final PDF fields must match the confirmed DB values" with a PII-safe source-to-final audit.
- So the gate→review_required→UI→PDF-block→confirmed-value chain is connected STRUCTURALLY. Still NOT proven in
  live runtime (no extraction processed). Roadmap Wave B updated to "code-verified, runtime pending".
- re-confirmed infra: healthz sha=73e7505 == main, ok @ 00:48; no new errors. No code change; no flag touched; no PII upload.

## 2026-06-05 (post-deploy verification, agent — raw evidence)
- verify: prod healthz sha=73e7505 == origin/main HEAD; PRs #80/#81/#82 MERGED; latest prod deploy dpl_7GbX READY. Code live.
- verify: 0 error/fatal runtime logs in 3h; 6h prod traffic = only /api/healthz 200 + /robots.txt. No regression.
- GAP: document_class_metric logs in 24h = 0 → no real extraction in prod → anti-fab/self-consistency runtime effect UNOBSERVED (gates emit no log; only visible in a real extraction response).
- GAP: flag env VALUES not independently readable via Vercel MCP (no env-list tool) — "ON" rests on owner action + code presence. Owner to confirm `vercel env ls production`.
- GAP: STATUS accuracy line overstated (US printed ~100% is raw API not product accuracy; UA printed 60-83% not what measured runs show). Flagged in STATUS POST-DEPLOY VERIFICATION block.
- verdict: DEGRADED (not broken) — infra green, safety-active claim unproven until one controlled hard-case extraction runs in prod. No code change; no flag touched; no PII upload performed.

## 2026-06-05
- ops: ANTI_FABRICATION_GATE_ENABLED=1 in production (hard-case identity → force review)
- ops: SELF_CONSISTENCY_GATE_ENABLED=1 in production (N=2 hash mismatch → force review)
- decision: PII history = INTERNAL-ONLY FOREVER (repo private, topic closed)
- decision: SMART_NORMALIZE = DO_NOT_ENABLE (dictionaries don't fix model reading)
- decision: OneBrain/decideField = PARKED (revisit at GT≥50 different people)

## 2026-06-04
- feat: PR #81 merged — anti-fab canary turnkey, ADR-016, military registry, patronymic fix
- feat: PR #80 merged — P2 dictionaries, anti-fab gate, self-consistency, class metric, GT workflow
- ops: DOCUMENT_CLASS_METRICS_ENABLED=1 in production
- GT: 6/30 VERIFIED_BY_OWNER (birth_cert x2, passport, i94, ead, military)
- accuracy: hard-case 25%, printed ~100%, false_negative_review=0 in mode C

## 2026-06-10 (docs: clarify activation checklist — 3 distinct secret-sets, DOCS, agent)
- Independent catch on the owner activation plan: the drift-guard secrets (SUPABASE_ACCESS_TOKEN/PROJECT_REF/DB_PASSWORD) were being conflated with L1 baseline activation. They are separate and do NOT enable the baseline. Clarified docs/ops/L1_T0_ACTIVATION_CHECKLIST.md: L1 baseline DATA collection needs only GUARD_BLOCK_METRICS_ENABLED=1 in Vercel (the route writes via the already-set SUPABASE_URL/SERVICE_ROLE_KEY); the cron secrets are a separate GitHub set for alerting (silent until GUARD_BLOCK_RATE_THRESHOLD is set); the drift-guard secrets are a third separate set; OWNER_CERTIFIER_ID is Step 3 (L3), not the baseline. Docs only, no code.

## 2026-06-10 (feat: handwritten-Cyrillic E2E — live prod test found+fixed review-reasons loss, CODE, agent)
- Owner: "сделай чтобы работала рукописная кириллица и протестируй". Ran a LIVE PROD test on the REAL handwritten birth certificate (local gitignored document → prod vision-extract, PII-safe reporting): names + Cyrillic read, ALL fields review_required (the safety chain holds on real handwriting), the date misread (month+day) but CAUGHT by review — exactly the designed behavior. The live test FOUND a real bug: the reader's specific review_reasons (source_script_ambiguous, date_role_conflict, fallback_model_used) were lost — docintelToCandidate replaced them with a generic [reader_flagged] and canonicalToFieldOut never output them, so the D5 review screen could not tell the user WHY a field needs review. FIXED both boundaries (TDD red→green): docintelToCandidate now carries the specific reasons (generic only as fallback); canonicalToFieldOut outputs review_reasons when present. +4 tests (reviewReasonsChain.test.ts incl arbitration passthrough).
- NEW handwrittenCyrillicE2E.test.ts (+4): pins the WHOLE handwritten chain with REAL functions, no mocks — reader output (handwritten ⇒ review + reasons) → candidate → arbitrate → FieldOut (reasons surface) → user confirms in D5 → validateConfirmedValue (accepts a clean date fix; REJECTS Cyrillic left in a critical field) → mirror PDF keeps the unconfirmed date visible as unresolved while confirmed names print. ALSO FOUND: the local ground-truth files are UNFILLED templates (every value empty) — the owner keystone is now concrete: fill 3 JSONs for his own documents. 3207 passed, tsc 0, content-guard 0. Synthetic values in all committed tests.
