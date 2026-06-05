# CHANGELOG

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
