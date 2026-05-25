# Booklet Pipeline — Evidence Report (Session 18)

**Date:** 2026-05-25
**Sample:** canonical Ukrainian internal passport booklet (`qa-shots/private/booklet_test_resized.jpg`)
**Runs analyzed:** 28 (across `reports/booklet-stability-20260525-122050/` through `133117/`)
**Live SHA at time of analysis:** `8bce911` (drift gate) on top of `794b86d` (whitelist fix)

This report exists because Session 17 declared the booklet path "production verified" based on the four fields that DID land in the user's wizard. The four fields that didn't were treated as "not extracted" without investigating WHY. This report fills that gap.

---

## Evidence classification rule (added 2026-05-25 after external review)

Every claim about OCR / translation provider capability in this report — and in any future report in this repo — must be tagged one of three ways:

- **(officially claimed)** — vendor documentation states the capability. Reference required.
- **(verified on our data)** — we have run the provider on a specific Messenginfo dataset and measured the result. Sample count and dataset reference required.
- **(not verified)** — neither of the above; default state until proven otherwise.

A claim like "Vendor X does not support handwritten Cyrillic" is almost always wrong as written — what we usually mean is "Vendor X failed on our N samples". The two statements have different consequences and different costs.

This rule exists because the original draft of this report drifted into the second mistake on the `given_name` and `dob` analyses. The corrections below are deliberate.

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

### `given_name` — OCR garbage on the canonical sample, scope-limited finding

**Evidence (verified on our data, N=28 runs, 1 booklet sample):**
- Raw Google Vision OCR of the given-name handwritten zone: `"Behri"` — Latin letters where Cyrillic should be (Vision misreads handwritten `В` as Latin `B`, then runs the rest through a Latin-confused decoder).
- Brain warning (run 133117): `"Given name OCR is garbled (Behri) – likely 'В' misread as 'B', needs manual review"`.
- DocAI OCR provides a second reading (dual-OCR crossref uses both). On THIS sample, the crossref does not produce a usable given_name.

**Why family_name recovered but given_name did not — on this sample:**
- Family name and patronymic recovered via dual-OCR crossref because one engine got most of the letters right and the other complemented (Vision read `"Кулоп'ятник"`, DocAI read `"Куронятник"`, crossref hybrid = `"Куроп'ятник"`).
- For given_name, on this specific zone of this specific booklet, both Vision and DocAI collapsed to Latin garbage. There was no recoverable Cyrillic signal to hybrid.

**What this finding does NOT prove (added after external review):**
- It does NOT prove that "OCR cannot extract handwritten Cyrillic given_name from booklets". One sample is not a population.
- It does NOT prove that other providers (Azure Read, Yandex Vision) fail the same way. We have not benchmarked them on Cyrillic handwritten booklets. (Azure docs *officially claim* expanded handwriting support including Russian; status on Ukrainian handwritten booklet on our data: *not verified*.)
- It does NOT prove that DocAI fails generically. Other approaches not yet tried: region-of-interest cropping to the given-name zone only, image preprocessing (deskew, contrast, dewarp) before OCR, different DocAI processor types, the Form Parser processor with a custom schema.

**Honest current status:**
- *Verified on our data (N=1 booklet, 28 OCR runs):* Vision + DocAI both produce garbage for given_name on this sample. Crossref does not recover. Manual entry is required for this user on this document.
- *Not verified:* whether the failure mode holds across handwriting styles, image qualities, or other OCR providers.

**Paths to investigate before treating this as a hard product limit:**
1. **Multi-sample benchmark on current stack.** 3-5 real booklets, same Vision+DocAI pipeline. If given_name recovers on some samples and not others, the determining factor is handwriting / image quality, not the OCR provider.
2. **Azure Read on the same canonical sample.** One-off API call, single image. Tells us whether the provider matters. (See `daily-briefing` not — there is no compliance blocker on running Azure for one test image with a synthetic / our own data.)
3. **Image preprocessing.** Deskew, sharpen, contrast normalize → re-run Vision and DocAI. Cheap to try.
4. **Region cropping.** Crop the given-name zone to its own image, send to OCR. Sometimes vendors do better when the region is unambiguously the one piece of text to recognize.

**Until any of those four are tried:** manual entry for given_name on booklet-only TPS users is the honest default. Don't relax the contract. But don't write "not fixable" — write "not yet fixed on N=1 sample with one OCR stack configuration".

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
- **Do not write absolute claims about provider capability based on N=1 sample.** "Provider X does not handle handwritten Cyrillic" is almost always wrong as written. The correct phrasing names the dataset and the sample count, and stays in one of the three classes (officially claimed / verified on our data / not verified).
