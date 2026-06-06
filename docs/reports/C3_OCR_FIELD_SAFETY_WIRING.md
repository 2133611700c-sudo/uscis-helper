# C3 — Wire Global OCR Field Safety Gate into live flows (behind OFF flag)

**Date:** 2026-06-06. Wires the proven guard (PR #95) into product flows behind `OCR_FIELD_SAFETY_ENABLED`
(default OFF). **OFF ⇒ byte-identical prod.** No prod flag enabled. No model/provider/HTR/OneBrain/SMART change.

## Done in this increment
- **Wiring helper** `apps/web/src/lib/documentSafety/applyOcrFieldSafety.ts`:
  - `classifyCriticality(fieldName)` → critical_identity / critical_document / admin / optional.
  - `isOcrFieldSafetyEnabled()` (flag, default OFF).
  - `applyOcrFieldSafety(fields, ctx, {zeroRecognition})` → runs each field through `protectOcrField`; an unsafe
    critical field is moved to `candidate_value` (value→null) and flagged `review_required` + `manual_required`,
    never shown as the final value. Input is never mutated. Returns `anyUnresolvedCritical`.
- **Wired flow #1 — Translation public** (`/api/translation/vision-extract`): a guarded block before the
  response. OFF ⇒ skipped (byte-identical). ON ⇒ unsafe critical reads (hard-case, source/stale mismatch, low
  conf, zero recognition) become candidate-only + review/manual; response carries `ocr_field_safety`.

## Tests — RED→GREEN
- `ocrFieldSafetyGate.test.ts` (18) + `applyOcrFieldSafety.test.ts` (10): classify; flag default OFF; hard-case
  → candidate-only (value→null, candidate kept, manual_required); source mismatch → not final; legacy reader →
  candidate; zero recognition → manual; admin safe → stays; input not mutated; PII-free output.
- The guard's `manual_required` was corrected (contract 2.5): candidate_only ALSO sets manual_required (the
  human must confirm/correct), only `accept_final` leaves it false.
- **Evidence:** tsc 0 errors; documentSafety 28/28; **full web suite 2903 passed / 4 skipped** — flag OFF =
  vision-extract byte-identical, zero regression.

## Remaining C3 sub-increments (next, same helper, one PR-able step each + tests)
These reuse `applyOcrFieldSafety` / `hasUnresolvedCriticalForOutput`; each behind the same OFF flag:
2. **TPS merge plane** (`tps/ocr/extract` + `centralBrain`): run OCR-derived critical fields through the guard
   before they become final TPS state; forbid an internal-passport source label on birth-cert fields; block stale-session bleed.
3. **Legacy OCR boundary** (`/api/ocr/extract` → `/api/ocr/translate`): mark `legacy_reader=true` → critical
   candidate-only/manual; no direct final write.
4. **PDF/payment block** (`generate-pdf` / `render` / `tps/generate-packet`): reuse `hasUnresolvedCriticalForOutput`
   (note: `generate-pdf` already blocks unresolved OCR review via `reviewGate` from PR #84 — this adds the unified gate).

Wired one flow at a time (not all-at-once) deliberately — wiring 4 live routes in one shot is the exact risk
that caused the incident. Flag OFF means zero prod impact at every step.

## Guardrails
No prod env/flag change; `OCR_FIELD_SAFETY_ENABLED` unset in prod; no model/provider/HTR/OneBrain/ReaderResult/
SMART; no PII (guard is PII-free by construction); qa-private=0.

## Status
PASS for this increment (guard wired into the incident-primary Translation path, flag-gated, tested, byte-identical
OFF). Full C3 = PASS after sub-increments 2–4. D0 prod / ReaderResult / OneBrain stay HELD until C3 complete +
owner enables the flag after a browser proof.
