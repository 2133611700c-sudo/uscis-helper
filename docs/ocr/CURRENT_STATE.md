# OCR / Extraction — CURRENT STATE (AS-IS), 2026-06-28

Branch `translation/ru-and-model-matrix-fixes` @ `e32fbfc`. **Documentation only — no runtime
code, flags, providers, billing, or tests were changed to produce this file.** Every claim cites
a concrete `path:line` or test name. Classification legend: **BUILT_AND_ON · BUILT_BUT_OFF ·
PARTIAL · MISSING · EXTERNAL_BLOCKED · NOT_PROVEN**.

> Core finding (unchanged from the audit): the review UI + safety contour are largely BUILT. The
> central gap is EARLIER — the translation extraction path does NOT produce real per-field
> bbox/evidence, so the (capable) review UI falls back to full-image. Do NOT rebuild review UI,
> validators, states, or gates — they exist.

## A. BUILT_AND_ON (live by default)
| Feature | Status | Evidence |
|---|---|---|
| Content-orientation (default ON) | BUILT_AND_ON | `apps/web/src/lib/docintel/orientation/detectOrientation.ts:178,186` (`CONTENT_ORIENT_ENABLED !== '0'` → default on) |
| Legacy AUTO_ORIENT NOT the path | BUILT_AND_ON | same file:184 (content-orient preferred; AUTO_ORIENT disabled) |
| raw_cyrillic immutable end-to-end | BUILT_AND_ON | `apps/web/src/lib/canonical/core/translationAdapter.ts:8,26`; in-memory raw-immutability proven `apps/web/src/lib/repositories/__tests__/repositoryContract.test.ts` |
| RU/UA script routing | BUILT_AND_ON | `packages/knowledge/src/transliterate.ts:247` (`detectNameScript`), `:299` (`detectDocumentScript`) |
| Script/leak validators (no Cyrillic in English) | BUILT_AND_ON | `apps/web/src/lib/translation/pdf/__tests__/phase9VerticalProof.test.ts` (pdfSafe leak check); `apps/web/src/lib/translation/__tests__/noSilentStrip.guard.test.ts` |
| Date / series / number format checks | BUILT_AND_ON | `packages/knowledge/src/docNumberFormats.ts`; date logic `packages/knowledge/src/transliterate.ts` (date conversion) |
| Review states candidate/confirmed/missing/unreadable/not_applicable/conflict | BUILT_AND_ON | `apps/web/src/lib/contracts/contractReviewState.ts` (`contractReviewState`) |
| Review UI bbox/crop contract | BUILT_AND_ON | `apps/web/src/app/[locale]/services/translate-document/session/[sessionId]/review/EvidenceReviewPage.tsx:71-74` (`combined_bbox/evidence_crop_path/evidence_type/bbox_status`), `:200,537-538` (exact/combined/approximate/missing + zone_fallback render) |
| HTR route + manual-entry path | BUILT_AND_ON (route exists; HTR sidecar NOT wired) | `apps/web/src/lib/docintel/documentFieldReader.ts` (HTR_NAME_FIELDS, manual-entry backfill); manual_user_entry in `apps/web/src/lib/docintel/autoDeliveryConsensus.ts` |
| Metrics engine (CER/field-exact/empty/fabricated/review-rate/false-final) | BUILT_AND_ON | `apps/web/scripts/gt-pipeline-bench.mjs` (empty/fabricated metrics), `ablation-bench.mjs`, `evidence-bench.mjs` |
| Negative / abstention battery | BUILT_AND_ON | `apps/web/src/lib/docintel/__tests__/negativeAbstentionBattery.test.ts`, `htrFailClosed.test.ts` |
| Unified contract Phase 6–10 + repository abstraction | BUILT_AND_ON (flag-gated additions default OFF) | `apps/web/src/lib/contracts/*`, `apps/web/src/lib/repositories/*` |

## B. BUILT_BUT_OFF (exists, default-disabled — not in the live result)
| Feature | Status | Evidence |
|---|---|---|
| Final-PDF confirmation gate | BUILT_BUT_OFF | `apps/web/src/lib/contracts/finalPdfGate.ts:7,24` (`FINAL_PDF_CONFIRMATION_GATE_ENABLED` default OFF); tests `__tests__/finalPdfGate.test.ts` |
| C3 OCR field safety (null-on-reject) | BUILT_BUT_OFF | `apps/web/src/lib/documentSafety/applyOcrFieldSafety.ts:5,19-20` (`OCR_FIELD_SAFETY_ENABLED` default OFF) |
| Unified-contract split/normalize/labels/review-annotation | BUILT_BUT_OFF | `UNIFIED_DOC_CONTRACT_ENABLED` / `_SPLIT_` / `_NORMALIZE_` default OFF (`apps/web/src/lib/contracts/birthCertSovietV1Contract.ts` flag readers) |
| image quality gate / forensics | BUILT_BUT_OFF / PARTIAL | `apps/web/src/lib/docintel/quality/documentImageQuality.ts`; forensics `apps/web/src/lib/docintel/forensics.ts:23` (`isForensicEnabled` default OFF) |

## C. EXTERNAL_BLOCKED (built, blocked by billing/quota — cannot run)
| Feature | Status | Evidence |
|---|---|---|
| Google Vision OCR (text) | EXTERNAL_BLOCKED | imported + called `apps/web/src/app/api/translation/vision-extract/route.ts:42,167,172,403`; returns 403 PERMISSION_DENIED w/o billing/creds `apps/web/src/lib/ocr/providers/google-vision.ts:147,244` |
| Document AI client | EXTERNAL_BLOCKED + NOT WIRED to translation | `apps/web/src/lib/docai/client.ts:191` (403→PERMISSION_DENIED); NOT imported by vision-extract (only google-vision is) |
| Gemini live measurement | EXTERNAL_BLOCKED | 429 RESOURCE_EXHAUSTED / spend cap (memory: gemini-recognition-billing-and-no-flash) |

## D. PARTIAL (works, but does not feed the live result)
| Feature | Status | Evidence |
|---|---|---|
| Per-field bbox/evidence into review | PARTIAL/MISSING in translation path | `FieldOut` (`apps/web/src/lib/canonical/core/translationAdapter.ts:22-50`) carries NO bbox/evidence_type/evidence_crop fields → the Core translation path produces no per-field crop; review UI therefore renders `full_image`/`zone_fallback` (`EvidenceReviewPage.tsx:73,200`). googleVisionProvider is used for raw TEXT only (`extractText`), not per-field bbox evidence. |

## E. MISSING (not built)
| # | Missing layer | Evidence (absence) |
|---|---|---|
| 1 | per-region classification (printed/handwritten/stamp/signature/mixed) | no module under `apps/web/src/lib/docintel` produces region kinds per field |
| 2 | working OCR/layout/bbox in translation evidence | `FieldOut` has no bbox (translationAdapter.ts:22-50) |
| 3 | document/template classification (UA modern vs Soviet vs RU) | `documentRegistry.ts` has one `ua_birth_certificate` id; no template variants |
| 4 | multi-engine consensus | only one live reader (Gemini via docintel); Vision is text-only/blocked |
| 5 | formal `AbstentionReason` enum | not present in canonical/docintel types |
| 6 | evidence bbox on FieldCandidate | `FieldCandidate` (`apps/web/src/lib/canonical/core/types.ts`) has no evidenceRegionIds/bbox |
| 7 | metrics: document-exact, wrong-field, abstention P/R, printed/handwritten + template rollups, bbox coverage, exact-crop rate | absent from `gt-pipeline-bench.mjs` (only empty/fabricated/CER/field-exact) |
| 8 | representative GT corpus (printed + handwriting) | only N=1 birth-cert GT + 2-hand HTR set (qa-private, gitignored) |
| 9 | real printed Cyrillic baseline | no printed corpus measured |
| 10 | real browser E2E (DB-backed) | only local mocked (`apps/web/tests/e2e-contract/*`); DB E2E BLOCKED (no Docker) |
| 11 | real-document PDF acceptance | not measured on real docs |

## F. NOT_PROVEN
- Handwriting Cyrillic recognition: **NOT_PROVEN (failed)** — HTR `hand_B_military_ua strict_exact 0/3` (`scripts/htr/cross_hand_harness.py:62-65`); Gemini fabricates on unreadable handwriting (memory: htr_native_res_recipe_verified).
- Printed Cyrillic OCR accuracy: **NOT_PROVEN** — no printed baseline run. The handwriting 0% **must not** be generalized to printed.
- Gemini structured-JSON correctness: **NOT_PROVEN as accuracy** — schema compliance ≠ value correctness; values require independent verification (Google structured-output docs).

## G. Components that MUST NOT be rebuilt (already exist)
validators (`apps/web/src/lib/translation/validators/*Validators.ts`), RU/UA routing (transliterate.ts:247,299), raw immutability (translationAdapter.ts:8,26), review states (contractReviewState.ts), finalPdfGate (contracts/finalPdfGate.ts), HTR route (documentFieldReader.ts), review bbox UI (EvidenceReviewPage.tsx:71-74), metrics engine (scripts/*-bench.mjs), negative battery (docintel/__tests__/negativeAbstentionBattery.test.ts).

**No production readiness is claimed.** Next stage (per owner): GT corpus + metrics only — see EVALUATION_PROTOCOL.md.
