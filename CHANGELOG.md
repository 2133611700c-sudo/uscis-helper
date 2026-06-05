# CHANGELOG

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
