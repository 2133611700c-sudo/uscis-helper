# OPS INCIDENT LOG

One entry per operational incident / sensitive operation. Newest first. PII-free.

## 2026-06-11 — broken manual CLI deploy → vision-extract 504 (RESOLVED by rollback)
- The git webhook did not fire for commit 758415b; agent ran `npx vercel --prod --yes`
  from the repo root. The resulting artifact 504-ed EVERY vision-extract request
  (healthz fine) — monorepo CLI build ≠ git-integration build. Detected within minutes
  by a light synthetic probe; ROLLED BACK via `vercel promote <last-good>` per the
  runbook (service restored, probe 200). Exposure window ≈15 min, low-traffic hours.
- RULE: deploy ONLY via git push (the integration build). If the webhook misfires,
  re-trigger with an empty commit — never a root-level CLI deploy.

## 2026-06-11 — L1 escalation-tick cron failure (RESOLVED)
- Owner reported `L1 Escalation Tick` failing (~32s). `gh run` logs: Postgres `22P02` —
  supabase-js `.contains()` with a JS array on a **jsonb** column emits a `{}` pg-array literal.
- Fix `dcc2ceb`: both cron scripts pass `JSON.stringify([...])`. Re-ran all 3 workflows live:
  escalation-tick / daily-reconciliation / guard-block-rate-check — all green.
- Swept the repo: no other `.contains(` jsonb call sites exist.

## 2026-06-10/11 — owner-document prod test (PII handling record)
- Purpose: verify the handwritten-Cyrillic pipeline on a REAL handwritten certificate
  (before/after the review-reasons fix). Found + fixed a real bug (reasons lost at two
  adapter boundaries); verified the fix live.
- PII trail audit (performed immediately):
  - Prod DB: **0 rows** created in translation_quality_log / extraction_runs /
    translation_sessions / tps_ocr_audit in the test window (the direct vision-extract
    call carries no session) — verified by SQL.
  - Local: the downscaled temp image + both response JSONs deleted from /tmp.
  - Vercel logs: our log lines are PII-free by design (counts/flags only; bodies not
    logged). Standard log retention applies; nothing actionable to delete.
  - Third-party: the image was processed by the same Gemini path every real client
    uses (provider retention per its API terms). No additional copies created.
- RULE GOING FORWARD: prod tests on real owner documents only on explicit owner request,
  with immediate trail audit + this log entry. For routine verification prefer the
  synthetic fixtures (benchmark/examples/) — they exercise the same chain.
