# OCR Evaluation Protocol — GT Corpus + Measurement Contract

**Stage-0, documentation only. 2026-06-28.** No runtime code, flags, providers, billing,
or tests were changed to produce this file. This document defines the ground-truth (GT)
corpus and the measurement protocol that **MUST exist and be populated before any new OCR
code is written or merged**. It is the acceptance contract for the MISSING items in
`docs/ocr/CURRENT_STATE.md` §E (rows 7–9) and §F.

> Why this exists: today there is one N=1 birth-cert GT plus a 2-hand HTR set (gitignored),
> no printed Cyrillic baseline, and the metrics engine lacks document-level + rollup +
> abstention + bbox metrics (`CURRENT_STATE.md:58-60`). New OCR code without this corpus
> would be tuned against nothing measurable.

---

## 0. Non-negotiable rules (read first)

1. **PRINTED and HANDWRITING are measured and reported SEPARATELY. Never combine them into
   one figure.** Cyrillic handwriting in Vision/LLMs is experimental and currently
   NOT_PROVEN (failed). Any single blended "OCR accuracy %" number is invalid and must be
   rejected in review.
2. **The handwriting 0/3 result does NOT generalize to printed.** `hand_B_military_ua
   strict_exact 0/3` (`scripts/htr/cross_hand_harness.py:62-65`) is a handwriting datum
   only. It must never be cited as evidence about printed-document accuracy, and printed
   results must never be used to claim handwriting works.
3. **No real PII in committed files.** Real images + real GT values + raw model outputs live
   ONLY under gitignored `qa-private/` (`.gitignore:70` `/qa-private/`). Anything committed
   to the repo (fixtures, examples, rule samples, this doc, test vectors) uses **FICTIONAL**
   data only. A committed example containing a real person's value is a defect.
4. **Stability rule: a result needs MULTIPLE runs.** A single run is never "proof". A
   baseline is only trustworthy after ≥3 independent runs with the disagreement recorded
   (see §6). Any byte-instability ("качели") is itself a finding to be reported, not smoothed
   over.
5. **External blockers must be resolved before trusting a baseline.** If the run hit Gemini
   `429 RESOURCE_EXHAUSTED` / spend cap, or Google Vision `403 PERMISSION_DENIED`
   (`CURRENT_STATE.md:37-42`), the result is `BLOCKED_…`, NOT a number. A blocked run may not
   be reported as an accuracy figure.
6. **Reuse the existing metrics engine; do not rebuild it.** Scoring logic, verdict taxonomy,
   and per-class rollup already live in `apps/web/scripts/gt-pipeline-bench.mjs` and sibling
   `apps/web/scripts/*-bench.mjs`. New metrics extend these scripts; they do not fork them.

---

## 1. Printed corpus

**Target: 20–30 documents.** Real images + GT under `qa-private/`; committed manifest +
this doc reference fixtures by stable ID only (no values).

### 1.1 Composition (script × quality matrix)

| Script family | Min docs | Notes |
|---|---|---|
| UA printed (modern: international passport, ID card, modern certificate) | 6–8 | printed Cyrillic + Latin/MRZ where present |
| RU printed | 4–6 | route to Russian table; ё/э/ы must survive |
| Soviet printed (bilingual RU/UA, pre-1991 forms) | 4–6 | historical place names preserved, not modernized |
| Mixed printed + handwritten (printed form, handwritten fill-ins) | 4–6 | only the **printed** regions count toward the printed score; handwritten regions are scored in the handwriting corpus (§2) |

**Quality grade — every doc tagged exactly one of `good | medium | poor`** and the matrix
must contain at least 3 docs at each grade so quality-stratified rollups are meaningful.
Grade rubric:
- `good` — sharp, even lighting, upright, no glare/occlusion.
- `medium` — mild blur/skew/shadow or moderate JPEG artifacts; legible to a human.
- `poor` — heavy blur, glare, low resolution, partial occlusion, or steep angle.

### 1.2 Per-document manifest record (PII-safe, committable)

```
doc_id            stable slug, e.g. ua_intl_passport_g01
script_family     ua_printed | ru_printed | soviet_printed | mixed_printed_hw
template_id       e.g. ua_international_passport, soviet_birth_cert_bilingual
quality_grade     good | medium | poor
source_sha256     SHA-256 of the gitignored image (integrity anchor, like the HTR harness)
gt_path           qa-private/ground-truth/<doc_id>.json   (values gitignored)
owner_verified    list of GT field keys the owner has confirmed
notes             orientation/rotation, known defects (PII-safe)
```

Real values (`given_name_cyrillic`, dates, numbers, …) live in `gt_path` under `qa-private/`,
never in the manifest.

---

## 2. Handwriting corpus

**Target: 20–50 individual crop regions** (regions, not whole documents — handwriting is
scored per field box, mirroring the HTR harness).

### 2.1 Per-region record (PII-safe portion committable; values gitignored)

| Field | Meaning |
|---|---|
| `region_id` | stable slug, e.g. `birth_ru_family_name` |
| `document_family` | birth_cert / marriage / death / military_id / name_change / certificate |
| `field_id` | semantic field, e.g. `family_name_cyrillic`, `given_name_cyrillic`, `patronymic_cyrillic`, `date_of_birth` |
| `expected_cyrillic` | **gitignored** — the owner-verified Cyrillic string (real PII) |
| `region_type` | printed / handwritten / stamp / signature / mixed |
| `quality_grade` | good / medium / poor |
| `rendering` | printed \| handwritten (route-by-rendering, ADR-026) |
| `expected_abstention` | EXPECT_READ \| EXPECT_ABSTAIN \| EXPECT_REVIEW — what the system *should* do (e.g. a blank/illegible crop must abstain, not fabricate) |
| `frozen_box` | native-pixel `[left, top, right, bottom]` on the rotated image, **chosen before** seeing any model output |
| `rotate_cw` | upright rotation in degrees CW |
| `source_sha256` | integrity anchor of the gitignored source image |

`expected_abstention` is the contract that lets us measure abstention precision/recall
(§3): a region whose truth is "unreadable / blank" must carry `EXPECT_ABSTAIN`, so a model
that emits text there is scored FABRICATED, not rewarded.

### 2.2 Frozen-box discipline

Boxes are frozen in the committed harness config **before** any model is run (never select a
box after seeing the output). This follows the existing pattern in
`scripts/htr/cross_hand_harness.py:35-59` (PII-safe frozen boxes + recorded EXPECTED
verdicts). The harness is the template; real images/GT/raw outputs stay gitignored.

---

## 3. Metrics

### 3.1 Existing — REUSE, do not rebuild

Already implemented in `apps/web/scripts/gt-pipeline-bench.mjs` (and sibling `*-bench.mjs`):

- **CER** (character error rate) — `cross_hand_harness.py:73-82` and bench scripts.
- **field-exact / recognition rate** = CORRECT / (CORRECT+WRONG+MISS+FABRICATED);
  CORRECT_EMPTY excluded (`gt-pipeline-bench.mjs:26-27,163-164,299-302`).
- **empty (MISS)** and **fabricated (FABRICATED)** verdicts (`:148-152`).
- **review-rate** and **false-final** (review/safety contour, bench scripts).
- **per-class rollup** (`byClass`, `gt-pipeline-bench.mjs:307-359`) — extend for the new
  rollups below rather than forking.

**Verdict taxonomy (canonical, do not redefine):** `CORRECT · WRONG · MISS · CORRECT_EMPTY ·
FABRICATED` (`gt-pipeline-bench.mjs:20-27`).

### 3.2 New metrics to ADD (currently MISSING — `CURRENT_STATE.md:58`)

Each extends the existing engine; computed **separately for printed vs handwriting**.

| Metric | Definition | Why |
|---|---|---|
| **document-exact** | fraction of documents where **every** owner-verified field is CORRECT | per-field rate hides whole-doc failure; one wrong name = a wrong document |
| **wrong-field assignment** | a read value that is correct text but landed in the **wrong field** (e.g. given↔patronymic swap) | a swap is currently scored CORRECT per-field but is a real defect |
| **per-type rollup** | metrics grouped by `script_family` / `document_family` | UA vs RU vs Soviet differ; one blended number lies |
| **per-template rollup** | metrics grouped by `template_id` | template variants (modern vs Soviet) behave differently |
| **abstention precision** | of regions where the system abstained, fraction that **should** have abstained (`EXPECT_ABSTAIN`/`EXPECT_REVIEW`) | measures over-abstention |
| **abstention recall** | of regions that **should** abstain, fraction the system **did** abstain (= 1 − fabrication-on-blank) | measures fail-closed behavior; the safety-critical number |
| **consensus disagreement** | rate at which multiple readers/runs disagree on a field | exposes instability + drives review gating |
| **bbox coverage** | fraction of scored fields that carry a real per-field bbox (not full-image/zone_fallback) | directly measures the §D gap (`EvidenceReviewPage.tsx:73,200`) |
| **exact-crop rate** | fraction of fields whose evidence crop tightly bounds the value (vs approximate/combined/full) | review quality + future consensus depend on it |

### 3.3 Reporting layout (mandatory)

Every report renders **two independent tables — PRINTED and HANDWRITING — never merged**,
each with its own document-exact, per-type rollup, per-template rollup, and abstention P/R.
A combined grand-total accuracy figure is prohibited (rule §0.1).

---

## 4. Stability + blocker gates (acceptance preconditions)

A baseline number may be published only if ALL hold:

1. **≥3 independent runs** completed; per-field consensus disagreement (§3.2) reported.
2. **No unresolved external blocker** in any of those runs (no Gemini 429 / spend cap, no
   Vision 403). A blocked field is reported as `BLOCKED_…`, excluded from the accuracy
   denominator, and counted separately.
3. **Acceptance measured on the primary reader only** (`gemini-2.5-pro`, ADR-018 / CLAUDE.md).
   A fallback/flash read is force-reviewed and may NEVER be reported as an acceptance number.
4. **Single-run results are labeled "indicative, not a baseline"** and may not gate code.

---

## 5. Reproducible harness reference

- **Handwriting template:** `scripts/htr/cross_hand_harness.py` — the committed, reproducible,
  CI-safe pattern. PII-safe config only (fixture names, source SHA-256, rotation, frozen
  pixel boxes, GT key names, recorded EXPECTED verdicts); real images + GT values + raw
  outputs live ONLY under gitignored `qa-private/` and are read at runtime
  (`cross_hand_harness.py:11-15,30-32`). If fixtures/weights are absent (CI), it prints SKIP
  and exits 0 (`:103-117,128-130`). New handwriting corpus entries extend its `FIXTURES` +
  `EXPECTED` blocks.
- **Printed template:** `apps/web/scripts/gt-pipeline-bench.mjs` — LIVE prod-read or `--dry`
  frozen-reads scoring; PII-safe markdown summary (field names + verdicts + counts only);
  real images + raw reads stay under `qa-private/` (`gt-pipeline-bench.mjs:1-49`). New printed
  corpus docs extend its `DOCS` list and field maps.
- **Real images/GT location:** `qa-private/ground-truth/*.json` and
  `test-fixtures/real-docs/*` (gitignored real PII). Committed fixtures = FICTIONAL only.

---

## 6. Definition of done (before new OCR code)

- [ ] Printed manifest populated: 20–30 docs across the §1.1 matrix, every doc graded, ≥3 per grade.
- [ ] Handwriting corpus populated: 20–50 regions with full §2.1 records + frozen boxes + `expected_abstention`.
- [ ] All real values under `qa-private/`; committed examples FICTIONAL only (spot-checked).
- [ ] New §3.2 metrics added to the existing bench engine (not a fork), printed/handwriting separated.
- [ ] ≥3-run stability completed with consensus disagreement reported; no unresolved 429/403.
- [ ] Baseline published as TWO separate figures (printed, handwriting), never one blended number.
```
