# STATUS

## 2026-06-05 — POST-DEPLOY VERIFICATION (agent, raw evidence) — infra GREEN, runtime UNOBSERVED

Independent verification of the "ALL SAFETY LAYERS LIVE" claim below. What is **proven from raw**:
- ✅ **Code in prod = main**: prod `healthz` sha = `73e7505` = `origin/main` HEAD; PRs #80/#81/#82 MERGED;
  latest production deploy `dpl_7GbX…` (sha 73e7505) state=READY, target=production. Code IS live.
- ✅ **No regression**: 0 error/fatal runtime logs in 3h; only `/api/healthz` 200 + `/robots.txt` in 6h.

What is **NOT yet verified** (honesty — do not over-claim "LIVE"):
- ⚠️ **Flag env VALUES not independently confirmed.** The Vercel MCP has no env-read tool here; "ON" rests on
  the owner's action + code presence, not a read. **Owner: confirm with `vercel env ls production`.**
- ⚠️ **Zero runtime evidence the gates fire.** `document_class_metric` logs in 24h = **0** → **no document
  was processed in prod in the last 24h**. The anti-fab gate + self-consistency emit NO log (they silently set
  `review_required`), so their live effect is only observable in a real extraction's API response. Until a real
  hard-case doc is processed, "gate protecting clients" is proven by **offline tests only**, not by prod runtime.
- ⚠️ **Self-consistency cost/latency unmeasured** (never triggered; it adds N=2 reads ONLY on hard-case birth
  classes, so cost is scoped to that minority — but unobserved).
- ⚠️ **Accuracy line below is overstated.** "US printed (I-94/EAD) ~100%" is a RAW API read, NOT product
  accuracy (ADR-016: EAD/I-94 are out of UA-door scope). "UA printed 60–83%" is not what the measured runs
  show (passport 3/3 read fields, military 5/5). Treat as directional, single-person.

**Verdict: DEGRADED (not broken).** Infra/deploy/health are green; the *safety-active* claim is unproven until
one controlled hard-case extraction runs in prod. Next: owner does one controlled upload + `vercel env ls`.
Rollback ready (env rm + redeploy, byte-identical by test; prior deploy is a rollback candidate).

## 2026-06-05 — ALL SAFETY LAYERS LIVE

**Production state (messenginfo.com):**
- ANTI_FABRICATION_GATE_ENABLED = ON (hard-case identity → force review)
- SELF_CONSISTENCY_GATE_ENABLED = ON (N=2 same-model, hash mismatch → force review)
- DOCUMENT_CLASS_METRICS_ENABLED = ON (PII-free class logging)
- SMART_NORMALIZE_ENABLED = OFF (DO_NOT_ENABLE — dictionaries don't fix model reading errors)
- Core flags = ON (ONE_CORE_TPS, ONE_BRAIN_CORE, EAD, REPAROLE)

**Accuracy (gemini-3.1-pro-preview, 6 GT docs, owner-verified):**
- US printed (I-94, EAD): ~100% (raw API, not through live door)
- UA printed (passport, military): 60-83%
- UA hard-case (birth certs): 25% (1/4 identity fields)
- false_negative_review in mode C = 0 (gate catches all errors)

**Decisions (ADR-016):**
- Hard-case UA = human review by policy (not model improvement)
- OneBrain/decideField = PARKED (revisit at GT≥50 from different people)
- PII history = INTERNAL-ONLY FOREVER (repo private, topic closed)
- Model hard-case = UNRESOLVED_BLOCKER (no Gemini reads UA hard-case reliably)

**Rollback:**
- Anti-fab: `vercel env rm ANTI_FABRICATION_GATE_ENABLED production --yes`
- Self-cons: `vercel env rm SELF_CONSISTENCY_GATE_ENABLED production --yes`
- Both proven byte-identical by automated tests.

**Remaining (not code — needs real humans/documents):**
- GT from different people for calibration
- Better model for Ukrainian hard-case documents
