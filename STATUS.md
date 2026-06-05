# STATUS

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
