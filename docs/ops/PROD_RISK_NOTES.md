# PROD RISK NOTES (owner-ruled corrections, 2026-06-11)

Audit corrections so the next agent/session reads the CURRENT truth, not an overstated one.

## Paid-request risks — ACTIVE vs LATENT (F1 correction)
Earlier reports overstated the paid-422 risk as "active". Under the CURRENT prod config
(`CONFIRMED_VALUE_GUARD_MODE` unset ⇒ shadow; `OCR_FIELD_SAFETY_ENABLED` unset ⇒ OFF):

```
Current ACTIVE risks (can hit a paying user today):
- persistCertification 503 (infra failure after charge)
- silent email-fail with a 200 response (user thinks they got the PDF)

LATENT risks (only after future flag changes):
- confirmed-value guard blocking paid users after a future MODE=enforce
- OCR safety blocking after a future OCR_FIELD_SAFETY_ENABLED=1
```

The L1 A-full handling (triage + acks + tickets) covers all four — behind
`REFUND_AUTOTICKET_ENABLED` (OFF until activated).

## RU_TRANSLIT_ENABLED coupling (F2 — known coupling, documented)
`RU_TRANSLIT_ENABLED` currently controls BOTH the Russian romanization AND the
ambiguous→review source-script gate (`isNameSourceScriptAmbiguous` returns false when the
flag is off). Acceptable today (the flag is ON in prod), but architecturally wrong long-term:
**a safety gate must not die when a functional flag is turned off.** If RU_TRANSLIT is ever
disabled, the ambiguity protection silently disappears with it. Future fix: split the gate
behind its own flag (not now — no code change without a measured need).

## Handwritten Cyrillic — the exact claim (do not overstate)
> Handwritten Cyrillic is supported via a human-verified review-first pipeline: the AI reads
> with explicit uncertainty (raw Cyrillic preserved, every handwritten field review_required,
> specific reasons surfaced), the certifier/user confirms, C3 releases only confirmed values,
> and the PDF prints only what was released. **Auto-finalization of handwritten critical
> fields is forbidden by design. Automatic extraction of hard handwriting (HTR) is a separate
> future phase (Phase 7), not a current guarantee.**

Accuracy honesty: on N=1 owner document, handwritten DOB auto-read = 0/1 (month misread,
caught by review). The sample is INSUFFICIENT for any rate estimate — a real number requires
the L2 GT fixtures.

## Observability — exists as code, not yet as proof
All observability tables are EMPTY (guard_block_events, certifier_override_audit; baseline
not started). The crons run green but their ALERT logic is untested with real data (count=0,
threshold=uncalibrated ⇒ the >0 and threshold-crossing paths have never fired live).
`GUARD_BLOCK_METRICS_ENABLED=1` is required to start the 14-day baseline. Do NOT enable
enforce modes (`CONFIRMED_VALUE_GUARD_MODE=enforce`, `OCR_FIELD_SAFETY_ENABLED=1`) until the
baseline exists and the GT files are filled.

## Known boundary-loss (pattern audit after the review_reasons bug)
Checked every ExtractedDocField property across `docintelToCandidate` → `canonicalToFieldOut`:
field ✓, value ✓, raw_cyrillic ✓, confidence ✓, review_required ✓, review_reasons ✓ (fixed
2026-06-10), provider ✓ (folded into the provider string). ONE remaining known loss:
**docintel `kind` (semantic type: name/date/place) is dropped** — `FieldOut.kind` carries the
SOURCE ('ai_vision'), not the semantic type. Known consequence already hit once: the date
ensemble had to detect date fields by NAME. Documented as a known pattern; fix only with a
concrete need (renaming the output field is a breaking API change).
