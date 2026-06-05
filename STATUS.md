# STATUS (2026-06-05 — honest, no overclaiming)

## Production Safety Gates

| Gate | Env | Runtime Observed | Evidence |
|------|-----|-----------------|----------|
| ANTI_FABRICATION_GATE | ON (27 min ago) | **NO** (0 docs processed) | Local liveness proven, prod awaiting first event |
| SELF_CONSISTENCY_GATE | ON (20 min ago) | **NO** (0 docs processed) | Local liveness proven, prod awaiting first event |
| DOCUMENT_CLASS_METRICS | ON (16h ago) | **NO** (metric_count=0) | No extraction since deploy |
| SMART_NORMALIZE | OFF | N/A | DO_NOT_ENABLE |

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
