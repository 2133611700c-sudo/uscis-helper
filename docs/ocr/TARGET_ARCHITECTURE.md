# OCR / Extraction — TARGET ARCHITECTURE (TO-BE), 2026-06-28

> **This is a TARGET / design document — the destination, not the current state.**
> It describes the future, **not-yet-built** OCR evidence architecture for the translation
> birth-certificate path. For what actually ships today (AS-IS, with `path:line` evidence),
> read **`docs/ocr/CURRENT_STATE.md`**. Nothing here is wired into the production pipeline.
>
> **NOT production-ready. NOT a claim of readiness.** Every layer below is gated behind the
> staged rollout (flag-gated, default OFF; see `docs/architecture/CONTRACT_FLAG_ROLLOUT.md`).
> This file changes **no** runtime code, flags, providers, or tests.

---

## 1. The architectural gap (why this exists)

Today's translation extraction path has **no layout/bbox OCR**. The chain is:

```
image
  └─► [TODAY: no layout/bbox OCR in the translation path]
        └─► Gemini receives too little reliable evidence
              └─► the candidate value is NOT tied to a precise source region
                    └─► the review UI is forced to full_image / zone_fallback
```

The asymmetry is the whole problem: **the review UI CAN already show an exact crop**, but the
extraction step never produces one. The UI contract has the fields for it
(`EvidenceReviewPage.tsx:71-74` — `bbox` / `combined_bbox` / `evidence_crop_path` /
`evidence_type` / `bbox_status`), but the Core translation `FieldOut` carries no bbox/evidence
(see `CURRENT_STATE.md` §D + §E.2). So `evidence_type` resolves to `full_image` or
`zone_fallback`, and the reviewer verifies a candidate against the *whole page* instead of a
tight, field-level crop.

**Target outcome:** every field candidate is anchored to one or more precise `EvidenceRegion`s,
so the existing review UI renders an exact crop (`evidence_type = ocr_bbox`/`combined_ocr_bbox`,
`bbox_status = exact`/`combined`) instead of falling back.

---

## 2. Target pipeline

Evidence comes from a layout-aware OCR engine; the LLM stops being the evidence source and
becomes a semantic mapper over that evidence.

```
image
  │
  ├─► Enterprise Document OCR  ──►  PRIMARY EVIDENCE
  │      (layout + bounding polygons + per-token confidence + region kind)
  │      → produces EvidenceRegion[]  (the ground truth of "what ink is where")
  │
  └─► Gemini = SEMANTIC MAPPER over the OCR/layout output
         (maps regions → fields, splits/normalizes, resolves which region is the surname,
          the date, the place — it does NOT invent the text; it reads the regions OCR found)
         → produces FieldCandidate[]  (each pointing back to evidenceRegionIds)
```

Principles:

- **Document OCR is PRIMARY.** Bounding polygons + text + confidence are the evidence of record.
  This is the layer missing today (`CURRENT_STATE.md` §C — Document AI client exists at
  `apps/web/src/lib/docai/client.ts` but is **not wired** into `vision-extract`; only
  text-only Google Vision is called).
- **Gemini is a MAPPER, not the evidence source.** It assigns OCR regions to semantic fields and
  normalizes values. It must cite the region(s) it used (`evidenceRegionIds`). A field with no
  backing region is an abstention, not a guess (per CONSTITUTION L: never guess critical fields).
- **Handwriting stays human-reviewed.** Regions classified `handwritten` follow ADR-026: LLM
  output is never accepted as-is; the key-free HTR sidecar (not yet wired) plus human review
  applies. This document does not change that gate.

---

## 3. Minimal target contracts (verbatim)

```typescript
type EvidenceRegion = { page:number; bbox:{x:number;y:number;width:number;height:number;normalized:boolean}; text:string; confidence:number|null; regionKind:"printed"|"handwritten"|"stamp"|"signature"|"mixed"|"unknown"; provider:"document_ai"|"vision"|"gemini" }

type FieldCandidate = { fieldId:string; rawValue:string|null; provider:string; confidence:number|null; evidenceRegionIds:string[]; abstentionReason:AbstentionReason|null }

enum AbstentionReason { HANDWRITING_UNREADABLE, LOW_IMAGE_QUALITY, NO_SOURCE_EVIDENCE, ENGINE_DISAGREEMENT, UNKNOWN_TEMPLATE, SCRIPT_AMBIGUITY, FIELD_NOT_PRESENT, PROVIDER_FAILURE }
```

Notes:

- `EvidenceRegion.bbox.normalized` mirrors the UI's `0–1` convention (`EvidenceReviewPage.tsx:70`).
  When `true`, `x/y/width/height` are fractions of page dimensions; the UI can crop directly.
- `FieldCandidate.evidenceRegionIds` is the link the current pipeline lacks. It is what turns
  `evidence_type` from `full_image` into `ocr_bbox` (one region) / `combined_ocr_bbox` (several).
- `abstentionReason` formalizes the missing enum (`CURRENT_STATE.md` §E.5). A non-null reason ⇒
  no value is asserted ⇒ the field routes to review/manual entry, never to the final PDF silently.

---

## 4. Region classification + template registry

### 4.1 Region classification
Each `EvidenceRegion.regionKind` is one of:

| regionKind   | meaning                                  | downstream treatment |
|--------------|------------------------------------------|----------------------|
| `printed`    | machine-printed text                     | LLM read acceptable (route-by-rendering, ADR-026) |
| `handwritten`| cursive / hand-filled                     | NEVER LLM-accepted; HTR sidecar + human review |
| `stamp`      | round/rect official stamp ink             | evidence-only; not a field value |
| `signature`  | signature ink                             | evidence-only; not a field value |
| `mixed`      | printed label + handwritten value overlap | split if possible, else review |
| `unknown`    | classifier abstains                       | review |

Classification is the layer absent today (`CURRENT_STATE.md` §E.1). It gates which reader is
trusted per region and feeds the consensus model below.

### 4.2 Template registry (start with ONE provable class)
A minimal document-template registry, expanding the single `ua_birth_certificate` id that exists
today (`CURRENT_STATE.md` §E.3):

| templateId              | scope                          | status in target |
|-------------------------|--------------------------------|------------------|
| `UA_BIRTH_CERT_MODERN`  | post-1991 Ukrainian birth cert | **start HERE — the one provable class** |
| `UA_BIRTH_CERT_SOVIET`  | Soviet-era UA birth cert       | deferred |
| `RU_BIRTH_CERT_SOVIET`  | Soviet-era RU birth cert       | deferred |
| `UNKNOWN_BIRTH_CERT`    | unrecognized layout            | abstain → `UNKNOWN_TEMPLATE` |

Discipline: **prove ONE document class end-to-end** (`UA_BIRTH_CERT_MODERN`) before adding
variants. An unmatched layout is `UNKNOWN_BIRTH_CERT` and abstains rather than guessing field
positions. This mirrors the owner rule: solve one real result, do not build a generic matrix
ahead of evidence.

---

## 5. Consensus model

Two independent producers vote per field, anchored to regions:

```
Document OCR (region text + bbox)   ─┐
                                     ├─►  agree    → consensus candidate (high confidence)
Gemini (semantic mapping of region) ─┘   disagree  → conflict → review (contractReviewState "conflict")
                                          neither   → no evidence → abstain (AbstentionReason)
```

Worked examples (generic placeholders — **NO real PII**):

1. **Consensus.** Document OCR reads region R1 (`printed`) as `SURNAME_A`; Gemini maps the
   `surname` field to R1 and normalizes to `SURNAME_A`. Both agree →
   `FieldCandidate{ fieldId:"surname", rawValue:"SURNAME_A", evidenceRegionIds:["R1"],
   abstentionReason:null }`, `bbox_status = exact`, UI shows the R1 crop.

2. **Conflict → review.** OCR reads R2 (`mixed`) as `PLACE_B`; Gemini maps `birthPlace` to R2 but
   normalizes to `PLACE_C`. Engines disagree →
   `FieldCandidate{ ..., abstentionReason:ENGINE_DISAGREEMENT }`, routed to review
   (`contractReviewState = "conflict"`); reviewer sees the R2 crop and both readings.

3. **No evidence → abstain.** The `patronymic` field has no region: OCR found no token, Gemini
   maps nothing →
   `FieldCandidate{ fieldId:"patronymic", rawValue:null, evidenceRegionIds:[],
   abstentionReason:NO_SOURCE_EVIDENCE }`. Nothing is asserted; the field never reaches the final
   PDF without explicit confirmation.

Consensus never *upgrades* a `handwritten` region to accepted on agreement alone — ADR-026 keeps
handwriting human-reviewed.

---

## 6. Reuse existing — do NOT rebuild

The target only **feeds better evidence** into machinery that already exists and is tested. Do
NOT re-implement any of these (see also `CURRENT_STATE.md` §G):

| Existing component (KEEP) | Location |
|---|---|
| Review bbox / crop UI | `apps/web/src/app/[locale]/services/translate-document/session/[sessionId]/review/EvidenceReviewPage.tsx:71-74` |
| Translation validators | `apps/web/src/lib/translation/validators/*Validators.ts` |
| Review states (candidate/confirmed/missing/unreadable/not_applicable/conflict) | `apps/web/src/lib/contracts/contractReviewState.ts` |
| Final-PDF confirmation gate | `apps/web/src/lib/contracts/finalPdfGate.ts` (BUILT_BUT_OFF) |
| Metrics engine (CER/field-exact/empty/fabricated/…) | `apps/web/scripts/*-bench.mjs` |
| Negative / abstention battery | `apps/web/src/lib/docintel/__tests__/negativeAbstentionBattery.test.ts` |

The only **new** work is upstream: a layout/bbox Document OCR evidence layer (`EvidenceRegion[]`),
region classification, the template registry, the `AbstentionReason` enum, and the consensus
mapper that links candidates to regions via `evidenceRegionIds`. Everything downstream is reused.

---

**Status: TARGET / design only. Not production-ready. Gated behind the staged rollout.**
Current truth: `docs/ocr/CURRENT_STATE.md`.
