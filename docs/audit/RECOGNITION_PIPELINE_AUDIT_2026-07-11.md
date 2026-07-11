# Recognition Pipeline Audit — 2026-07-11 (code-grounded, 4 parallel readers)

Mandatory phase-1 audit of the document recognition system against the new model+quality policy
(Gemini 2.5 Pro / newer STABLE Pro; GPT-4.1(-mini) for suitable non-primary tasks; NO Flash / preview /
deprecated in the working path). Findings are file:line, not from prior reports.

## Pipeline map (stage → file → engine → wired to prod? → verdict)
| Stage | File | Engine | Prod path? | Verdict |
|---|---|---|---|---|
| Upload + MIME/size | translation/upload/route.ts; vision-extract:214+ | — | yes | ok |
| HEIC→JPEG | ocr/heicToJpeg.ts | heic-convert (WASM) | yes | ok |
| Preprocess (EXIF-rotate, resize<=2048, jpeg q85) | ocr/image-preprocess.ts | sharp | yes (legacy path) | EXIF-only rotate |
| **PDF → images** | — | NONE | **NO** | **PDF accepted by MIME, never converted → fails downstream. BROKEN.** |
| **Content orientation 0/90/180/270** | docintel/orientation/detectOrientation.ts | Gemini+OpenAI+tesseract, grid vote | **intake shadow only (OFF)** | **not in prod reader; sideways scan read sideways** |
| **Deskew (small angle)** | — | NONE | **NO** | **missing** |
| Image quality gate | quality/documentImageQuality.ts | sharp metrics | flag OFF, legacy | partial |
| **Language / script / text-type** | docintel/detectLanguageCountry.ts | OpenAI gpt-4.1, fail-closed 0.6 | **shadow only** | **prod reader is language-BLIND; prompt hardcoded Ukrainian; handwriting DECLARED in registry not detected** |
| DocType classification | detectDocumentType.ts / documentRegistry.ts | vision (shadow) / manual | shadow / manual | detection shadow; prod uses manual type unless bridge ON |
| **OCR read** | providers/geminiVisionProvider.ts | primary `gemini-3.1-pro-preview` + fallback `gemini-3.5-flash`,`gemini-2.5-flash` | yes | **PREVIEW primary + FLASH fallback ⇒ violates new policy** |
| Field extract + anti-fabrication | documentFieldReader.ts; transliterationPolicy.ts | — | yes | **STRONG: can_read=false→null, backfill+review, auto_fill=false** |
| Logical field validation (dob↔registration, child↔parents) | dates/dateRoleGuard.ts (generic) | — | partial | **no birth-cert-specific logic** |
| Multi-page | vision-extract | Promise.all, max 6 | yes | ok |

## Models actually called (file:line)
- Reader primary: `geminiVisionProvider.ts:45-52` → `gemini-3.1-pro-preview` (**preview**).
- Reader fallback chain: `gemini-3.5-flash`, `gemini-2.5-flash` (**flash**, reachable, force-reviewed).
- modelMatrix.ts:22/25/36 mirrors this (PRIMARY_READER, FALLBACK_MODELS, SANCTIONED_CHAIN).
- Intake (lang/country/type/pageSide/orient-fallback): OpenAI `gpt-4.1` (`realProviders.ts:45`).
- BUG (FIXED here): `vision-extract/route.ts` Core-B2 success response reported `model: gemini-2.5-flash`
  even though Core reads with the primary — now reports the primary model honestly.

## Requirement status vs the new prompt
| Requirement | Status |
|---|---|
| Only Gemini 2.5 Pro / newer STABLE Pro; no Flash/preview in working path | **FAIL** (preview primary + flash fallback) |
| Fallback visible + non-flash | PARTIAL (flash force-reviewed but in path; misleading model field now fixed) |
| Per-page orientation before recognition | **FAIL** (detectOrientation shadow-only; prod = EXIF only) |
| Deskew | **FAIL** (absent) |
| Language/script explicitly detected | **FAIL** (shadow-only; reader blind + Ukrainian-hardcoded) |
| PDF per-page, no quality loss | **FAIL** (not converted) |
| Birth cert dedicated schema + anti-fabrication | **PASS** (13 fields all handwritten→review; "NEVER invent"; auto_fill=false) |
| Logical field relationships | PARTIAL (generic date guard only) |
| Missing data not fabricated | **PASS** (null+review, backfill) |
| Low confidence surfaced | **PASS** (review_required + reason codes) |

## Root causes
1. Models: ADR-018 disqualified `gemini-2.5-pro` on certs (fabricated a different person) → team moved to
   `gemini-3.1-pro-preview` primary + flash fallback for availability. The new policy forbids both preview
   and flash ⇒ needs a NON-flash fallback (the OpenAI gpt-4.1 provider already built) + honest fail, and a
   re-measured compliant STABLE Pro primary (measurement-gated, ADR-018 blocks a blind flip to 2.5-pro).
2. Orientation / language / PDF: all intake detection is SHADOW (default OFF) and NOT wired into the reader;
   prod reads by the manual type + EXIF only. This is the B→A gap (partially closed behind flags in #12/#14/#15).
3. PDF: declared in the MIME allowlist but no page-to-image converter exists.

## Prioritised remediation (measurement-gated where noted)
1. **Model policy** (cross-cutting; touches modelMatrix + provider + 4 test files + CI guards):
   remove flash from the reader chain; make the OpenAI gpt-4.1 fallback the default non-flash resilience
   (visible, force-reviewed); re-measure a compliant STABLE Pro primary on the real cert battery before any
   primary flip (paid + owner decision per ADR-018). DONE THIS PR: the misleading model field.
2. **PDF**: implement PDF→image (per page) conversion, or reject PDF with a clear message (stop the silent
   downstream failure).
3. **Orientation**: wire `orientToUpright` (per page) into the reader before recognition, flag-gated → flip.
4. **Language/script**: feed detected language/script into the reader prompt (stop the Ukrainian hardcode);
   drive handwriting review from detection, not only the registry declaration.
5. **Deskew**: add small-angle deskew (sharp/opencv) before recognition.
6. **Birth-cert logical validation**: add dob↔act_record_date / child↔parents consistency checks.
7. **Reproducible test battery + metrics** (one command): orientation/language/script/type/field accuracy,
   false-positive-success rate, per-doc cost, on the transform set (rotations/crops/blur) + real docs.

Each item is its own verified PR (no regressions; measurement before model/primary changes).
