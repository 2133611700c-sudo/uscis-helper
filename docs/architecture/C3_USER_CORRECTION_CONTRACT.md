# C3 USER-CORRECTION CONTRACT (P0 design lock)

Date: 2026-06-10
Status: LOCKED v1 (partially code-implemented; override path = owner decision)
Backs: `confirmedValueGuard.ts`, `generate-pdf/route.ts`, ADR-017 §C3.

## Principle (ADR-017)

> "A confirmed field CAN become final — via C3, never by bypassing it."

User correction does NOT write `finalValue` directly. The flow is:

```
user edits on review screen → value posted as release value (normalized_value)
  → server-side guard (validateConfirmedValue) → C3 decision
    → accept  → finalValue = sanitized value
    → block   → 403 (critical) or null+missing (non-critical)
```

The act of **signing the certification IS the confirmation** — there is no
separate "confirmed" event; every released value is, by signature, user-asserted.
The guard therefore runs on **all release values**, unconditionally (it is legal
input sanitation, not an AI-safety experiment — NOT gated behind
`OCR_FIELD_SAFETY_ENABLED`).

## Deterministic guard rules (implemented)

`validateConfirmedValue(field, value)`:
- empty/whitespace on a critical field → `empty_critical` → block
- any Cyrillic char (`/[Ѐ-ӿ]/`) → `cyrillic_in_release_value` → a Latin-only PDF must never carry Cyrillic
- length > 200 → `too_long`
- control / non-printable chars → `invalid_chars`
- date-named field not MM/DD/YYYY or YYYY-MM-DD → `invalid_date_format`

Disposition:
- **critical field fails** → 403 `{ gate: 'confirmed_value_guard', field: <NAME only>, reason }`. The rejected value is NEVER echoed (PII rule).
- **non-critical fails** → value nulled (renders MISSING), generation continues.
- **pass** → `finalValue` set; planTranslationRows uses finalValue-first.

## What C3 must NOT do to a user correction

- MUST NOT rewrite a user's value via dictionary/gazetteer. A rare-but-correct
  surname or place the user typed is authoritative over D2's suggestion.
- MUST NOT lower a review flag silently.
- MUST NOT accept Cyrillic/script-violating values into an English release field.

## [OWNER DECISION] manual override path (NOT yet implemented)

A value that is *possible but unprovable* (passes script/format checks but the
system cannot corroborate it) should reach `manual_override_required`, not silent
accept. The override is allowed ONLY with:
- explicit user confirmation,
- a reason code,
- an audit event (see ADR-019),
- no script violation in the final English field,
- no empty critical field,
- the PDF marking the value as **user-confirmed, not machine-read**.

This requires the audit-trail (ADR-019) and a UI affordance. Owner to approve the
override policy and whether the PDF must visually distinguish user-confirmed values.
