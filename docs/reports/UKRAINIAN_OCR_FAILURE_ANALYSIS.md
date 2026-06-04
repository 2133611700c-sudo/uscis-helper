# Ukrainian OCR/Vision Failure Analysis (hard-case)

**Date:** 2026-06-04. Sanitized (no PII; illustrative patterns only). Source of truth: the documents are
**Ukrainian**; recognition is Ukrainian → English. GT = Ukrainian as-written. Measured against owner GT
on **N=2 hard-case birth certs** (the only owner-verified GT today) — this is a strong signal, not a
prod-grade verdict.

## Core finding
The hard-case failure is NOT a small-dictionary problem. It is that the **model does not read the Ukrainian
original stably and substitutes a more-probable Russian form**. On the two owner-verified hard-case birth
certs, identity accuracy ≈ **0–1 of 5** (2.5-flash 0/5 — different person; 3.1-pro 1/5). A dictionary must
NOT "fix" this silently — that would be dictionary-fabrication. It may only signal a conflict and raise review.

## Failure classes (illustrative; not PII)
1. **Ukrainian → Russian substitution** — a `-ій` Ukrainian given name returned in the Russian `-ей` form;
   `і/ї/є/ґ` Russianized to `и/е/г`. Counted WRONG vs Ukrainian GT.
2. **Apostrophe dropped** — the Ukrainian apostrophe `ʼ` (e.g. in a `пʼ`/`ʼя` cluster) omitted → wrong token.
3. **Ukrainian month misread** — the month read wrong (and inconsistently across runs/models), e.g. GT
   month 06 read as 02 (2.5-flash) / 07 (3.1-pro).
4. **Ukrainian patronymic replaced by the Russian patronymic** form.
5. **Stable wrong read** — a confidently-wrong identity that self-consistency does NOT catch when the model
   repeats the same wrong answer (agreement ≠ correctness).

## What each layer can and cannot do
- **Unicode normalization (NFC, UAX#15)** — REQUIRED before compare/hash (visually-equal strings can be
  different codepoints). Does NOT fix Russianization — that is an OCR/vision/language error upstream.
- **KMU-55 transliteration (Cabinet Resolution №55, 2010-01-27)** — the sourced UA→Latin rule, applied
  ONLY AFTER a correct Ukrainian read. Not a guess, not a repair for a wrong read.
- **Dictionaries / gazetteer / authority resolver** — SIGNAL/conflict/provenance only; never silently
  rewrite a name (Сергей→Сергій would be fabrication-by-dictionary).
- **Anti-fabrication + self-consistency gate** — forces review on hard-case identity; mode C drove
  false_negative_review to 0 on the measured pair and caught the month error the bare model missed.

## Status by class (honest)
- **Printed US / Ukrainian printed docs:** suspected usable (passport read correctly + stably in liveness),
  **NOT yet owner-GT-scored** — do not assert a percentage without verified GT.
- **Hard-case Ukrainian / Soviet / handwritten birth certs:** **critical failure** (≈0–1/5 vs owner GT) →
  must route to human review; the model cannot be trusted unaided here.

## Decisions
- `SMART_NORMALIZE_ENABLED`: **DO_NOT_ENABLE** (no accuracy gain; cannot fix a reading failure).
- `ANTI_FABRICATION_GATE_ENABLED`: **READY_FOR_CANARY_PREP** (evidence-supported; see ANTI_FAB_GATE_CANARY_PLAN.md) — NOT executed.
- hard-case model: **UNRESOLVED_BLOCKER** (neither 2.5-flash nor 3.1-pro reads UA hard-case reliably; a
  better Ukrainian reader / HTR / multi-reader is a separate, metrics-gated investigation).
- self-consistency: a safety SIGNAL (instability), not proof of truth.
- human review: REQUIRED for hard-case Ukrainian/Soviet/handwritten classes.

## Honest scope
N=2 / one person, hard-case only. Expanded owner GT (printed UA, passport, ID, EAD, I-94, more people) is
needed before any production flag or model decision.
