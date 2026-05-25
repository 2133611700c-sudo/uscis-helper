# Booklet Pipeline — Evidence Report (Session 18)

**Date:** 2026-05-25
**Sample:** canonical Ukrainian internal passport booklet (`qa-shots/private/booklet_test_resized.jpg`)
**Runs analyzed:** 28 (across `reports/booklet-stability-20260525-122050/` through `133117/`)
**Live SHA at time of analysis:** `8bce911` (drift gate) on top of `794b86d` (whitelist fix)

This report exists because Session 17 declared the booklet path "production verified" based on the four fields that DID land in the user's wizard. The four fields that didn't were treated as "not extracted" without investigating WHY. This report fills that gap.

---

## Summary of evidence

| Field | Brain emits? | Validation passes? | Contract allows? | Reaches user? | Root cause |
|-------|--------------|--------------------|------------------|---------------|------------|
| family_name | yes | yes | yes (Wave 2) | **yes** (post 794b86d) | — |
| city_of_birth | yes | yes | yes | **yes** | — |
| province_of_birth | yes | yes | yes | **yes** | — |
| middle_name (patronymic) | yes | yes | yes | **yes** | — |
| **dob** | **yes (28/28 runs)** | **no (28/28 runs)** | n/a (would be stripped) | **no** | brain emits unparseable format |
| **given_name** | yes (some runs) | yes (when emitted) | **no — forbidden** | **no** | OCR garbage (`"Behri"` from Cyrillic В misread as Latin B) |
| country_of_nationality | yes | yes | **no — forbidden** | **no** | by design — passport MRZ is authoritative |
| passport_country_of_issuance | yes | yes | **no — forbidden** | **no** | by design — passport MRZ is authoritative |
| sex | not emitted | n/a | **no — forbidden** | **no** | not extracted; manual entry |
| document_number | not emitted | n/a | not in allowed | **no** | not extracted; manual entry |

## Detailed findings

### `dob` — deterministic brain failure, parser tolerance gap

**Evidence (28/28 runs):**
- Brain reports `field_count: 6`, listing `dob` among emitted fields.
- `brain.validated_skipped` contains `{ field: 'dob', reason: 'date not parseable' }` in 28/28 runs.
- Contract would strip `dob` even if validation passed (server `documentContracts.booklet.forbidden_fields` includes `dob`).

**Raw OCR text containing the date:**
```
25 червня 1986 року
```
("25 of June 1986 year" — Ukrainian, with month name `червня` in genitive case, followed by the noun `року` meaning "year")

**Why the parser fails:**
- `parseDate` (in `documentBrain.ts:580`) supports Ukrainian month abbreviations in `MONTHS_CYRILLIC` (`СІЧ`, `ЛЮТ`, `БЕР`, `КВІ`, `ТРА`, `ЧЕР`, `ЛИП`, `СЕР`, `ВЕР`, `ЖОВ`, `ЛИС`, `ГРУ`).
- The regex `^(\d{1,2})[\s\-\/.]+([A-Za-zА-Яа-яІіЇїЄєҐґ]{3,})[\s\-\/.]+(\d{2,4})$` requires exactly three tokens (day, month, year).
- The actual brain emission appears to retain trailing `року` ("year"), giving a FOUR-token string the regex won't match. Or the brain emits something else malformed — without raw-value logging, the exact emission is unknown.
- The brain prompt (`documentBrain.ts:769`) tells the model to emit MM/DD/YYYY but evidently the model doesn't comply for booklet handwritten dates.

**Two-step fix path:**
1. **Make the brain emit parseable dob.** Either tighten the prompt with an explicit example (`Output dob as MM/DD/YYYY ONLY. Strip Ukrainian words like 'року', 'р.', 'г.'. Example: '25 червня 1986 року' → '06/25/1986'`), OR extend `parseDate` to strip trailing year-words and to recognize Ukrainian month names in genitive case (`січня`, `лютого`, `березня`, `квітня`, `травня`, `червня`, `липня`, `серпня`, `вересня`, `жовтня`, `листопада`, `грудня`).
2. **Relax `documentContracts.booklet.forbidden_fields` to allow `dob`.** Then the field flows through. Drift gate (`scripts/check-booklet-contract-drift.mjs`) will require updating `BOOKLET_WAVE1_FIELDS` and `SLOT_ALLOWED_FIELDS.booklet` in the same commit.

**Critical preconditions before step 2 ships:**
- Multi-sample benchmark. One canonical sample proves nothing about variance in handwriting, OCR confidence, and brain interpretation.
- Logging enhancement: capture the brain's raw `final_value` for `dob` in the audit table, so the next investigation isn't blind.

### `given_name` — structural OCR limitation, not a contract issue

**Evidence:**
- Raw Google Vision OCR of the given-name handwritten zone: `"Behri"` — Latin letters where Cyrillic should be (Vision misreads handwritten `В` as Latin `B`, then runs the rest through a Latin-confused decoder).
- Brain warning (run 133117): `"Given name OCR is garbled (Behri) – likely 'В' misread as 'B', needs manual review"`.
- DocAI OCR provides a second reading (the dual-OCR crossref module uses both), but no run shows successful given_name recovery.

**Why this is fundamentally different from family_name:**
- Family name and patronymic recovered via dual-OCR crossref BECAUSE one engine got most of the letters right and the other complemented it (Vision read `"REDACTED_NAME"`, DocAI read `"REDACTED_NAME"`, crossref hybrid = `"REDACTED_NAME"`).
- For given_name, BOTH engines collapsed to Latin garbage on the same zone. There's no recoverable Cyrillic signal to hybrid.
- The image-zone for given_name may be where the Vision OCR most consistently fails on this canonical sample. Different sample = different failure mode. Need multi-sample to know.

**Three possible paths, ordered by feasibility:**
1. **Accept manual entry for given_name on booklet-only users.** Honest. Aligns with current contract. Doesn't degrade other fields.
2. **Brain inference from patronymic.** A patronymic `Сергійович` strongly implies a father named `Сергій`. The given_name MIGHT be `Сергій`. **This is unsafe** — the patronymic refers to the FATHER, not the user. Multiple given names share the same patronymic form. Do not infer.
3. **Improve OCR (different provider, image enhancement, fine-tuned model).** Out of scope for now. Document as a Phase 2 research item if booklet-only TPS users become a meaningful segment.

**Recommendation: option 1.** Don't relax the contract. Show a clear "введите имя вручную" prompt at Step 5 for booklet-only users.

### Other forbidden fields — by design, not a bug

- `country_of_nationality`, `passport_country_of_issuance`: forbidden from booklet because passport MRZ is the canonical source. Booklet booklet-only users are typically Ukrainian — server can hardcode `Ukraine` for these or surface a country picker. Not a pipeline gap.
- `sex`: not extracted from booklet in any of the 28 runs. Possible future addition, but the booklet image zone for sex is small and unreliable. Manual entry is acceptable.

## Verification status of 794b86d / 8bce911

- **794b86d** — client-side BOOKLET_WAVE1_FIELDS drift fix is live on prod. Verified via `wizard-simulation-test.mjs` against `https://messenginfo.com`: 4/4 fields surface with source `dual_ocr_crossref`.
- **8bce911** — drift gate `scripts/check-booklet-contract-drift.mjs` is now in CI. Local: exit 0, three sets match. Synthetic drift check confirms regex correctly extracts renamed identifiers; set diff would fire.
- **Not yet verified:** browser-level walk of the wizard with the canonical booklet image. The simulation script mirrors the client filter logic but does not exercise the deployed JS bundle, localStorage hydration, or the actual PDF download. This is the Definition of Done that remains owed.

## Recommended next-session priorities (in order)

1. **E2E browser test with PDF byte-grep.** Playwright + `pdftotext`. The real gate. Not the simulation script.
2. **Logging enhancement.** Save brain's raw `final_value` for every field (including rejected ones) into `tps_ocr_audit`. Without this, future debugging is blind.
3. **dob unblocking sequence.** Improve parser + prompt → multi-sample benchmark → relax contract → drift gate auto-catches the client update needed.
4. **Multi-sample booklet benchmark.** 3-5 real booklets with verified ground truth. PII — handle per `qa-shots/private/` rules.
5. **Contract-as-API consolidation.** Server emits `GET /api/tps/contract/booklet`. Client fetches once. Eliminates the 5-sync-point structural debt entirely.
6. **Time-critical (unrelated):** H.R.1 IFR copy updates before 2026-05-29 — see `daily-briefing-2026-05-25.md`.

## What you should NOT do

- Do not relax the server contract for `dob` or `given_name` before steps 2 and 4. The lesson from Session 17 is that "the API returns the right thing on canonical" is not the same as "the user gets the right thing in their PDF across real-world variation."
- Do not infer `given_name` from `patronymic`. The patronymic encodes the father's first name, not the user's.
- Do not declare the pipeline "production-stable" without multi-sample evidence. One sample proves determinism, not generalization.
