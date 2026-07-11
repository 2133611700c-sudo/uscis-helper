# Vertical Slice #1 — live E2E on the Soviet birth certificate (2026-07-11)

Preview-only, ONE real document (`birth_cert_soviet_01.jpg`), uploaded RAW with **no docType hint**
(fully incognito). Flags on Preview: `ONE_BRAIN_INTAKE_SHADOW=1`, `ONE_BRAIN_CONTROLS_READER=1`,
`ONE_BRAIN_READER_FALLBACK=1`. PII-free: only field NAMES, counts and flags are recorded — never values.

## Result (verified, not asserted)
`POST /api/translation/vision-extract` (multipart, single `file`, **no docTypeId**) → HTTP 200.

| Step-8 question | Answer (from the live response) |
|---|---|
| Did the user need to choose the doc type? | **NO** — uploaded raw, no docTypeId. Route default would be `ua_internal_passport_booklet`. |
| Auto reader selected | **`ua_birth_certificate`** — the controlled bridge swapped the manual default → intake-mapped type (`ua_birth_certificate_soviet` → `ua_birth_certificate`). The read used the birth-cert schema, NOT passport. |
| Extracted field count | **12** (child_family_name, child_given_name, child_patronymic, dob, place_of_birth_city, father_full_name, mother_full_name, act_record_number, act_record_date, issuing_authority, certificate_series_number, date_of_issue) — all birth-cert fields. |
| Fields requiring review | **12 / 12** (candidate-only, force-review) |
| Provider / model | `gemini-2.5-flash` (availability fallback within the Gemini chain; primary 3.1-pro unavailable). `fallback_model_used` review reason applied. The OpenAI reader-fallback (#13) was available but not needed this run. |
| Review reasons (union) | fallback_model_used, critical_no_mrz_anchor, authority_unverified, date_role_conflict, knowledge:review:authority.unknown |
| Latency | ~33 s (single page) |
| Estimated cost | ~one Gemini-flash vision call on a 1.25 MB image (image tokens) ≈ cents |
| Translation candidates generated | **YES** — response is the `toTranslationRows` set (12 rows) the wizard renders on its review screen; status `ok:core-b2`, `core_path` present. |
| Blocker | none — the chain completed end-to-end. |

## What this proves
Raw upload (no type) → **automatic intake** (Soviet birth cert) → **automatic reader selection**
(`ua_birth_certificate`) → **field candidates** (12) → **human review** (all 12 force-review) →
**translation rows** returned for the wizard. The user never chose the document type.

## Honest limits
- Field VALUES are handwritten Soviet Cyrillic ⇒ candidate-only, force-review, NOT trusted accuracy.
  The product value is auto-intake + auto-reader + the review flow, not raw-OCR correctness.
- The rendered wizard UI (review screen + confirmed→translation output) is the existing
  `TranslationLab`/review-state components consuming exactly this response shape; the browser wizard
  E2E (Playwright) is not part of this API-level proof.
- N=1. Not a trust claim; no `N>=25/family`. Flags are Preview-only; Production is byte-identical (OFF).
