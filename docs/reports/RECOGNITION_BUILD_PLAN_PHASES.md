# Recognition Build Plan — Phases (build the structure without self-deception)

**Date:** 2026-06-05. One phase at a time. Each phase is small, tested, reversible, and does NOT regress the
proven safety wrapper. Global forbiddens (every phase): no prod env change, no flag flip without owner, no
model switch, no SMART, no PII in docs/logs, no committing qa-private, no raw-API-as-product-accuracy, no
calling the TARGET the CURRENT reality.

| # | Phase | Objective | Type | Gated by |
|---|---|---|---|---|
| 0 | Monitoring closeout | keep safety baseline stable 24–48h | ops | — |
| 1 | Truth map | stop the live/parked confusion | docs | done |
| 2 | D0 quality/reshoot | bad photo → reshoot before model spend | code (additive) | — |
| 3 | ReaderResult contract | reader abstraction, no fan-out | code (additive) | — |
| 4 | OneBrain shadow | one decision center, shadow-only | code (flagged, shadow) | Phase 3 |
| 5 | D2 knowledge hardening | validate, never silent-correct | code (flagged) | — |
| 6 | D3 translation lock | identity locked before prose | code | — |
| 7 | D4 validators | block release on critical inconsistency | code | — |
| 8 | D5/D6 generalized review/PDF | one shared review+PDF gate across products | code | — |
| 9 | Auditor/correction loop | corrections → GT candidates, PII-free | code | — |
| 10 | HTR / GPT-4o research | second reader, only if ROI | research | GT from diff people |

---

### Phase 0 — Monitoring Wave D closeout
- **Objective:** confirm gates stable in prod (5xx=0, no cost/latency spike, no UI/PDF complaints) for 24–48h.
- **Files:** `.github/workflows/prod-safety-monitor.yml`, `docs/reports/PROD_SAFETY_MONITORING_24H_RUNBOOK.md`.
- **Allowed:** read-only checks; delete the temp workflow after the window.
- **Stop:** stable → keep gates ON. Spike → rollback SELF_CONSISTENCY first (keep ANTI_FAB).
- **NOT:** no architecture work until this is clean (don't mix monitoring baseline).

### Phase 2 — D0 quality / reshoot
- **Objective:** thread quality signals into the intake so a degraded photo is caught before reading.
- **Files:** `lib/canonical/vision/preprocess*` (existing sharp), a new `qualityVerdict` module, intake routes.
- **Allowed:** additive quality verdict (`accept`/`degraded`/`reshoot_required`); UI message. Behind a flag,
  default OFF; flag OFF = byte-identical.
- **Tests:** clean→accept; rotated→corrected; too-blurred→reshoot_required; cropped-edge→reshoot_required.
- **Stop:** flag OFF identical; verdict never used as a fabrication signal (blur ≠ fabrication).
- **NOT:** don't block reading on quality in prod until measured; don't reuse blur as anti-fab.

### Phase 3 — ReaderResult contract
- **Objective:** formalize `ReaderResult`; map Gemini onto it. No fan-out, no behavior change.
- **Files:** new `lib/docintel/readers/ReaderResult.ts`; adapter wrapping geminiVisionProvider.
- **Allowed:** pure interface + adapter; GPT-4o/HTR = disabled stubs.
- **Tests:** Gemini output maps to ReaderResult losslessly; no change to readDocument output.
- **Stop:** prod byte-identical. **NOT:** no GPT-4o/HTR live; no consensus revival.

### Phase 4 — OneBrain shadow-only
- **Objective:** wire `decideField` to RECEIVE reads+signals and WRITE a sanitized decision comparison, while
  live output stays exactly the current path.
- **Files:** `lib/docintel/oneBrain/decideField.ts` (unpark carefully), a shadow writer, readDocument hook
  behind `ONEBRAIN_DECIDE_FIELD_ENABLED` (default OFF).
- **Allowed:** shadow compare only; thresholds remain PLACEHOLDER until GT calibration.
- **Tests:** flag OFF → no call; flag ON → live output unchanged, only shadow record written; no PII in record.
- **Stop:** zero live-output diff with flag ON. **NOT:** no live decisioning; no threshold "calibration" on N≈1.

### Phase 5 — D2 knowledge hardening
- **Objective:** make normalizers validate/signal, never silently correct.
- **Files:** knowledge pkg (transliterate, gazetteer, patronymic, authority), `dictionaryBridge`.
- **Allowed:** signal + review-raise + provenance; behind `SMART_NORMALIZE_ENABLED` (stays OFF in prod).
- **Tests:** exact→normalize; fuzzy→suggestion+review (no snap); apostrophe preserved; authority phrase-level.
- **Stop:** no silent rewrite anywhere. **NOT:** do not enable SMART in prod.

### Phase 6 — D3 translation lock
- **Objective:** lock names/dates/numbers before prose translation.
- **Files:** `lib/translation/*`, prose translator adapter.
- **Tests:** identity values byte-identical pre/post prose translation; translator only touches prose.

### Phase 7 — D4 validators / ОТК
- **Objective:** block release on critical inconsistencies.
- **Files:** new `lib/translation/validators/*` (+ reuse existing date/format guards).
- **Tests:** future DOB rejected; issue<DOB rejected; bad doc-number format flagged; missing critical → block.

### Phase 8 — D5/D6 generalized review + PDF gate
- **Objective:** one shared review component + PDF block across all products (today Translation-only).
- **Files:** shared review component; per-product generate-pdf gates reuse `reviewGate`.
- **Tests:** each product blocks PDF on unresolved review; PDF uses confirmed values; source-to-final audit.

### Phase 9 — Auditor / correction loop
- **Objective:** each correction → a PII-free evaluation/GT-candidate signal.
- **Files:** audit writer; private GT-candidate store (gitignored).
- **Tests:** correction recorded {before, after, reason, doc_class, reader_id}; NO PII in public logs.

### Phase 10 — HTR / GPT-4o research (only after GT breadth)
- A/B: Transkribus (faster, third-party PII/DPA/egress risk) vs TrOCR (privacy better, own infra/fine-tune).
- Decision criterion: hard-case review rate too high for UX AND GT from different people exists.
- **NOT a production commitment** — research/benchmark only.
