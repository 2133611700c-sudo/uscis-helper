# ZERO-TRUST RECOGNITION STATE AUDIT

Date: 2026-06-09 (agent, zero-trust auditor)
Method: facts first (git / GitHub / Vercel / tests), reports second. Anything not directly verified = **UNVERIFIED**.
Constraints honored: no prod env change, no flag toggle, no PR merge, no deploy, no paid broad-model test, no PII, no qa-private commit, no code change, no ReaderResult/OneBrain/HTR/D0 work.

---

## 1. Executive summary

**Verdict: DEGRADED** (prod itself is safe; monitoring + governance are broken).

- **Prod is on the proven-safe baseline.** `prod_sha == origin/main == 03eb30f`, healthz ok, `OCR_FIELD_SAFETY_ENABLED` / `SMART_NORMALIZE_ENABLED` / `QUALITY_GATE_ENABLED` all **ABSENT (OFF)**. Code is green (tsc 0; full suite 2919 passed / 4 skipped).
- **Real DEGRADED finding:** **every scheduled GitHub Actions run on `main` is `startup_failure`** (continuous 06-08 → 06-09). Automated prod monitoring is **NOT running**. Root cause UNVERIFIED (GitHub reports a generic "workflow file issue"; API returns no workflow name).
- **Governance debt:** local `main` is stale (`0d3d82b`, behind origin); three doc-only PRs (#100/#101/#102) are OPEN and unmerged, so `main`'s STATUS/HANDOFF lag reality; the temp `prod-safety-monitor.yml` was supposed to be deleted after 2026-06-07 and is still present (and failing); the working tree has ~30 untracked report/`daily-briefing` files.
- **Canary is NOT a full PASS.** OCR field-safety canary was run → DEGRADED → closed; flag rolled back OFF. `candidate≠final on real content` is proven **locally only** (agent, 2026-06-09). Real owner upload / TPS / payment-gated-PDF proofs = **NOT done**.

---

## 2. Git / prod status

| Fact | Value | Source |
|---|---|---|
| Current branch | `docs/ocr-canary-closeout-rollback` (= head of OPEN PR #102) | `git branch` |
| HEAD | `0af255e` | `git rev-parse HEAD` |
| origin/main | `03eb30f` | `git rev-parse origin/main` |
| local `main` | `0d3d82b` — **STALE** (behind origin/main; local-only cosmetic) | `git rev-parse main` |
| Branch divergence | HEAD = 4 ahead (all docs) / 1 behind (the #99 merge commit) | `git log` |
| HEAD vs origin/main code diff | **NONE** — only 8 doc files differ (STATUS/HANDOFF/OWNER_QUEUE/CHANGELOG + 4 reports) | `git diff --name-only` |
| ⇒ tested code == prod code | **TRUE** (tsc/suite run on HEAD; HEAD code byte-equals 03eb30f) | derived, verified |
| prod_sha | `03eb30f` | `curl /api/healthz` |
| prod == main | **TRUE** | derived |
| healthz | `{"status":"ok",...,"sha":"03eb30f"}` | curl |
| Dirty tree | `apps/web/tsconfig.tsbuildinfo` (build artifact) + ~30 untracked `docs/reports/*.md` + `daily-briefing-*.md` | `git status` |
| qa-private / real-docs | **NOT tracked, gitignored** (`git check-ignore` confirms) — no PII staged | `git ls-files`, `git check-ignore` |

---

## 3. PR state #94–#102

| PR | title | state | merged | code/docs |
|----|-------|-------|--------|-----------|
| #94 | P0 OCR forensic audit + safety contract | **MERGED** | 06-06 | docs |
| #95 | global OCR field safety guard (containment) | **MERGED** | 06-06 | code |
| #96 | C3 wire field safety guard into Translation | **MERGED** | 06-06 | code |
| #97 | C3 field safety proof + canary runbook | **MERGED** | 06-06 | docs |
| #98 | OCR field safety canary result (DEGRADED) | **MERGED** | 06-06 | docs |
| #99 | vision-extract 502 fix | **MERGED** | 06-06 | code |
| #100 | canary after 502 fix (gate live, DEGRADED-clean) | **OPEN** | — | docs |
| #101 | owner proof for OCR field safety canary | **OPEN** | — | docs |
| #102 | close canary — precautionary rollback | **OPEN** | — | docs (current branch) |

Note: #100/#101/#102 are a stacked doc-only trail of the canary closeout that never landed on `main`. statusCheckRollup per-PR = **UNVERIFIED** (not fetched this run).

---

## 4. GitHub Actions / CI state

- **All scheduled runs on `main` = `startup_failure`**, continuously (sampled 2026-06-08T17:21 → 2026-06-09T20:21, every 1–3h). `gh run view` → *"This run likely failed because of a workflow file issue."* `workflowName` is empty in the API for these runs (cannot attribute to one file via API).
- `gh workflow list` shows all 8 workflows in state **active** (none disabled): Dead Link Checker, Federal Register Monitor, Form Edition Checker, Content & Brand Guards, **Prod Safety Monitor (Wave D)**, Session Docs Guard, USCIS News Monitor, YouTube Monitor.
- No `push`/`pull_request` CI runs in the recent window (no pushes to `main` since the 06-06 merges).
- **Effect:** the "automated prod monitor" (`prod-safety-monitor.yml`, every 6h) is **not actually executing** — Wave-D automated monitoring is dead. The file was also slated for deletion after 2026-06-07 and still exists.
- **Root cause: UNVERIFIED.** Generic startup_failure across *all* crons + empty workflow name suggests a repo/org-level cause (a malformed workflow, an Actions setting, or billing) rather than one runtime bug. Not investigated further per "do not fix".

---

## 5. Flag / env state (prod)

`vercel env ls production` shows **presence + age, NOT the literal value**. "ON" below = present (assumed `=1`); value-literal is UNVERIFIED by `ls`.

| Flag | Presence | Inferred |
|---|---|---|
| OCR_FIELD_SAFETY_ENABLED | **ABSENT** | **OFF** ✓ (rollback confirmed) |
| SMART_NORMALIZE_ENABLED | **ABSENT** | **OFF** ✓ |
| QUALITY_GATE_ENABLED (D0) | **ABSENT** | **OFF** ✓ |
| ANTI_FABRICATION_GATE_ENABLED | present (5d) | ON (value UNVERIFIED) |
| SELF_CONSISTENCY_GATE_ENABLED | present (5d) | ON (value UNVERIFIED) |
| DOCUMENT_CLASS_METRICS_ENABLED | present (6d) | ON (value UNVERIFIED) |
| ONE_BRAIN_CORE_ENABLED | present (7d) | ON? (value UNVERIFIED) — **wired into vision-extract B2 arbitration** |

- prod logs (2h): grep for `error/fatal/5xx/exception/PII` returned **no matches** — but the log fetch output was truncated/unconfirmed, so prod-error-cleanliness this run = **UNVERIFIED-clean**.

---

## 6. Brain layer reality matrix

| Layer | Target | Current reality | Evidence | Status |
|---|---|---|---|---|
| D0 quality/reshoot | bounce bad photo pre-OCR | code exists, flag OFF in prod | `docintel/quality/documentImageQuality.ts`; `QUALITY_GATE_ENABLED` absent | **CODE_READY_FLAG_OFF** |
| D1 reader (Gemini) | primary reader | live in prod path | `documentFieldReader.ts`; healthz/prod 03eb30f | **LIVE_UNVERIFIED** (no real read probed this run) |
| OCR field-safety guard | candidate≠final contract | built + tested | `documentSafety/ocrFieldSafetyGate.ts` + `applyOcrFieldSafety.ts`; 38 tests | **CODE_READY_FLAG_OFF** |
| Translation public wired | gate in vision-extract | wired behind flag OFF | `app/api/translation/vision-extract/route.ts` | **CODE_READY_FLAG_OFF** |
| TPS wired | gate in tps ocr | wired behind flag OFF | `app/api/tps/ocr/extract/route.ts` | **CODE_READY_FLAG_OFF** |
| Legacy OCR wired | gate in legacy boundary | wired behind flag OFF | `app/api/ocr/extract/route.ts` | **CODE_READY_FLAG_OFF** |
| PDF/payment block | block unresolved critical | wired behind flag OFF | `app/api/translation/generate-pdf/route.ts` | **CODE_READY_FLAG_OFF** |
| Anti-fab gate | force review on fabrication risk | present in prod | `vercel env ls` (present); prior runtime proof | **LIVE_UNVERIFIED** (value/firing not re-proven this run) |
| Self-consistency gate | instability → review | present in prod | `vercel env ls` (present) | **LIVE_UNVERIFIED** |
| SMART normalize | dictionary normalize | OFF (absent) | `vercel env ls` | **PARKED/OFF** (DO_NOT_ENABLE) |
| canonical/core arbitration | single arbiter (B2) | wired + flag present in prod | `ONE_BRAIN_CORE_ENABLED` present; `vision-extract` line 211 + `canonical/core/arbitration.ts` | **LIVE_UNVERIFIED** |
| OneBrain `decideField` | field-decision center | module + tests, **0 app callers** | `docintel/oneBrain/decideField.ts` | **PARKED** |
| ReaderResult interface | reader contract | **not present** | grep `ReaderResult` in `apps/web/src` = empty | **NOT_BUILT** |
| D2 KMU-55 transliterate | Сергій→Serhii | live | `packages/knowledge/src/transliterate.ts` | **LIVE_VERIFIED** (unit) |
| D2 gazetteer | place correction | code present | `packages/knowledge/src/gazetteer.ts` | **CODE_READY** (flag-sensitive in path) |
| D2 patronymic | по-батькові | code present | `packages/knowledge/src/patronymic.ts` | **CODE_READY** (flag-sensitive in path) |
| D3 translation prose | DeepSeek prose | code present (engine) | `lib/engine/translator.ts` | **LIVE_UNVERIFIED** |
| D4 validators | numbers/dates guard | code present | `lib/engine` guards | **CODE_READY** |
| D5 UI review | confident→empty | wizard review gate live | `reviewGate.ts`, `TranslateWizard.tsx` | **LIVE_UNVERIFIED** |
| D6 PDF render | certified EN PDF | route present | `generate-pdf/route.ts` | **LIVE_UNVERIFIED** |
| HTR (Transkribus/TrOCR) | handwriting reader | engine file exists, **no app caller** | `lib/engine/htr.ts`; no route ref | **PARKED / NOT_LIVE** |
| Auditor/correction loop | provenance + training | — | none found | **NOT_BUILT** |

---

## 7. Canary state

- **Sequence (verified from git/PR/STATUS cross-check):** canary enabled → DEGRADED (vision-extract 502 blocked the read path) → 502 root-caused + fixed (#99, MERGED) → canary re-run flag ON → DEGRADED-clean (gate live in prod, `ocr_field_safety.applied=true`, zero-recognition→review, **no real upload**) → **CLOSED, flag rolled back OFF** (precautionary).
- **Now:** `OCR_FIELD_SAFETY_ENABLED` ABSENT/OFF in prod ✓.
- 502 fix: **live in prod code** (origin/main route returns 200 + `review_required` on zero-field) ✓ (code-verified; prod re-probe this run = UNVERIFIED).
- Real owner upload proof: **NOT done**. TPS proof: **NOT done**. PDF/payment proof: **NOT done**.
- `candidate≠final on real content`: **agent-proven LOCALLY** only (2026-06-09, commit `0af255e`, real Gemini + flag ON on local fixtures) — NOT a prod/HTTP/Stripe proof.
- **Conclusion: NOT `PASS_CANARY_FULL`.** State = `CLOSED_DEGRADED` / flag OFF / partial local proof.

---

## 8. What is SAFE / LIVE now

- Prod on proven-safe baseline `03eb30f`, healthz ok, `prod == main`.
- Risky flags OFF (OCR field safety, SMART, D0 quality).
- Code green: tsc 0; full suite **2919 passed / 4 skipped**; documentSafety **38 passed**.
- 502 fix live (zero-field reads return 200, not gateway-502).
- Anti-fab + self-consistency + class-metrics + ONE_BRAIN_CORE flags present in prod (firing UNVERIFIED this run).

## 9. What is CODE-READY but OFF

- OCR field-safety guard, wired into all 4 flows (Translation/TPS/legacy/PDF), behind `OCR_FIELD_SAFETY_ENABLED` OFF.
- D0 quality/reshoot behind `QUALITY_GATE_ENABLED` OFF.
- OneBrain `decideField` module (parked, 0 callers).

## 10. What is BLOCKED

- **Full canary PASS — BLOCKED_OWNER:** real hard-case upload over prod HTTP, TPS upload, Stripe payment-gated PDF block, breadth (docs from a different person). Agent cannot upload PII / drive browser / create Stripe sessions.
- **ReaderResult / OneBrain resume — BLOCKED** until the prod canary PASSes (self-imposed freeze).
- **GT from different people — BLOCKED_OWNER** (the calibration unblock).

## 11. Next 3 actions (only)

1. **Fix the dead Actions** (separate, code/infra task — NOT in this audit's no-touch scope): diagnose the repo-wide `startup_failure` and either repair or delete `prod-safety-monitor.yml` (overdue since 2026-06-07). Until then, treat automated monitoring as **non-existent** and monitor manually.
2. **Land the doc trail to `main`:** merge (or close) PRs #100/#101/#102 so `main`'s STATUS/HANDOFF reflect reality; then fast-forward local `main` off origin. Removes the stale-truth gap.
3. **Owner-only:** run the prod canary proofs (real upload + TPS + payment-gated PDF + a different person's docs) per `OCR_FIELD_SAFETY_FINAL_OWNER_PROOF.md` — the only path to `PASS_CANARY_FULL` and to unfreezing ReaderResult/OneBrain.

---

### RETURN
```
RESULT: DEGRADED
task_type: zero_trust_recognition_state_audit
branch: docs/zero-trust-recognition-state-audit (audit PR) ; working branch was docs/ocr-canary-closeout-rollback
commit: <this audit commit>
new_pr: <opened against main>
prod_sha: 03eb30f
main_sha: 03eb30f (origin) ; local main 0d3d82b STALE
prod_equals_main: yes (origin/main)
healthz_ok: yes
flags: OCR_FIELD_SAFETY=OFF(absent), SMART=OFF(absent), QUALITY_GATE=OFF(absent), ANTI_FAB=present, SELF_CONS=present, DOC_CLASS_METRICS=present, ONE_BRAIN_CORE=present (values UNVERIFIED by `ls`)
github_actions_status: ALL scheduled runs startup_failure (monitoring NOT running); root cause UNVERIFIED
tests_run: tsc + documentSafety + full vitest suite
tests_passed: tsc 0 errors; documentSafety 38/38; full suite 2919 passed / 4 skipped (142 files)
pr_state_summary: #94-#99 MERGED; #100/#101/#102 OPEN (docs-only canary closeout trail)
brain_layer_matrix: see §6 (guard CODE_READY_FLAG_OFF x4 flows; D0 CODE_READY_FLAG_OFF; canonical/core arbitration LIVE_UNVERIFIED; OneBrain decideField PARKED; ReaderResult NOT_BUILT; HTR PARKED)
canary_state: CLOSED_DEGRADED, flag OFF; candidate≠final proven LOCAL only; real/TPS/PDF proofs NOT done → not PASS_CANARY_FULL
ocr_field_safety_state: CODE_READY, wired x4, flag OFF in prod
readerresult_state: NOT_BUILT
onebrain_state: decideField PARKED (0 callers); canonical/core arbitration flag present in prod (LIVE_UNVERIFIED)
next_3_actions: 1) fix/delete dead Actions monitor; 2) land #100/#101/#102 to main + ff local main; 3) owner runs prod canary proofs
confirmed_no_prod_env_change: yes
confirmed_no_code_change: yes
confirmed_no_pii: yes
```
