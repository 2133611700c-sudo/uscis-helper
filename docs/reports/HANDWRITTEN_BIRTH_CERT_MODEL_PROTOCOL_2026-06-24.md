# Handwritten Birth Certificate Model Protocol (2026-06-24)

Status: DEGRADED
Scope: real handwritten Soviet/Russian-language birth certificate fixture, owner-GT benchmark, no production flip
Branch: `translation/ru-and-model-matrix-fixes`
Commit at audit start: `6004f35`

## Executive verdict

Direct VLM image reading is NOT a safe primary path for this handwritten birth certificate.

- `gemini-2.5-pro`: fails on the handwritten certificate.
- `gpt-4.1`: fails on the handwritten certificate.
- `gpt-4o`: fails/refuses on the handwritten certificate.
- `gpt-5`: fails on the handwritten certificate and is slow.
- `DeepSeek`: not an image reader here; text-only structuring role only.

For this document class, the correct current engineering direction is:

1. preserve original pixels as long as possible,
2. correct orientation explicitly,
3. use HTR / field-crop route for handwritten critical fields,
4. keep human review,
5. do NOT select a GPT/Gemini direct-image path as acceptance logic.

## Fixture under test

- file: `test-fixtures/real-docs/birth_cert_handwritten_01.jpg`
- source sha256: `3188741189ef589cc32a56c7ba11df709b46643b10120a28fa0014ff058aa2f7`
- source md5: `5126bf0210b045224ae7216adc1c94c2`
- source size: `7072376` bytes
- source dimensions: `4128x3096`
- document type: `ua_birth_certificate`
- language/script reality: Soviet Ukrainian document written in Russian script on page

## Measured pipeline truth

### Client upload

Client upload does NOT auto-rotate content.

- entrypoint: `apps/web/src/lib/upload/prepareImageForUpload.ts`
- downscale helper: `apps/web/src/lib/upload/downscaleImage.ts`
- behavior:
  - threshold: `3_800_000` bytes
  - target max edge: `3072`
  - jpeg quality: `0.80`
  - fail-open: original file preserved if client resize fails
- important rule:
  - no client OSD auto-rotation
  - manual rotate is a separate explicit action

### Server preprocess

Server preprocess is the first real OCR pixel normalization step.

- entrypoint: `apps/web/src/lib/ocr/image-preprocess.ts`
- measured on this real cert:
  - input: `7072376` bytes, `4128x3096`
  - output: `2195486` bytes, `2304x3072`
  - scale factor: `0.7441860465`
  - brightness: `166.3`
  - blurScore: `36.92`
  - assessment: `good`
- behavior:
  - EXIF rotate only
  - cap longest side to `<=3072`
  - jpeg quality default `90`
  - no grayscale
  - no binarization
  - quality gate checks brightness/blur

### Content orientation

Content orientation is a separate read-time decision.

- detector: `apps/web/src/lib/docintel/orientation/detectOrientation.ts`
- method:
  - build 2x2 grid of the same page at 0/90/180/270
  - ask the model which cell is upright
  - vote across runs
- live measured result on this cert:
  - detected correction: `270°`
  - detected: `true`

## Model evidence

### Same-pipeline OpenAI benchmark

Script:
- `apps/web/scripts/gpt-pipeline-bench.mjs`

Measured results:

| model | passport | military | handwritten birth cert |
|---|---:|---:|---:|
| `gpt-4.1` | `4/4=100%` | `2/5=40%`, samePerson=`NO` | `0/5=0%`, samePerson=`NO` |
| `gpt-4o` | `4/4=100%` | `2/5=40%`, samePerson=`NO` | `0/5=0%`, samePerson=`NO` |

Report paths:
- `qa-private/reports/gpt-pipeline-bench-gpt-4.1.md`
- `qa-private/reports/gpt-pipeline-bench-gpt-4o.md`

### Raw visibility benchmark

Script:
- `apps/web/scripts/evidence-bench.mjs`

Measured results:

| model | passport | military | handwritten birth cert | latency notes |
|---|---|---|---|---|
| `gemini-2.5-pro` | `CYR 2/3`, `LAT 1/3`, `DOB Y` | `CYR 3/3`, `LAT 0/3`, `DOB Y` | `CYR 0/3`, `LAT 0/3`, `DOB N` | ~79-80s per doc |
| `gpt-4.1` | `CYR 2/3`, `LAT 1/3`, `DOB Y` | `CYR 3/3`, `LAT 0/3`, `DOB N` | `CYR 0/3`, `LAT 0/3`, `DOB N` | ~8-16s |
| `gpt-4o` | `CYR 2/3`, `LAT 1/3`, `DOB Y` | `MODEL_REFUSAL` | `MODEL_REFUSAL` | refusal on harder docs |
| `gpt-5` | `CYR 2/3`, `LAT 1/3`, `DOB Y` | `CYR 0/3`, `LAT 0/3`, `DOB N` | `CYR 0/3`, `LAT 0/3`, `DOB N` | ~42-105s |
| `gpt-5.5-pro` | `RAW_TRANSCRIPTION_ERROR` | `RAW_TRANSCRIPTION_ERROR` | `RAW_TRANSCRIPTION_ERROR` | HTTP 404 |

Report path:
- `qa-private/reports/evidence-run.md`

### DeepSeek role check

Script:
- `apps/web/scripts/test-deepseek-teaching.mjs`

Measured truth:

- DeepSeek is used as text structuring only.
- It is NOT the image-reading decision layer.
- Current script contains a stale expected-date narrative mismatch; do not treat the script comment as benchmark truth.
- On the test input, shared rules did not produce a measured improvement over the baseline text structuring output.

## Rules for the system

### Hard rules for this document class

1. Do NOT use `gemini-3.1-pro-preview`.
2. Do NOT use any direct GPT/Gemini image read on this handwritten certificate as acceptance truth.
3. Do NOT let a direct VLM handwritten result auto-fill USCIS critical fields without review.
4. Do NOT transliterate inside the image model.
5. Do NOT Ukrainianize Russian-script source text.
6. Do NOT binarize or grayscale handwritten critical crops.
7. Do NOT silently rely on EXIF alone for orientation.

### Processing rules

1. Keep original bytes for audit and crop derivation.
2. Client resize exists only to stay under upload/body limits.
3. Server preprocess may down-cap large images, but handwritten critical reading should prefer native-res field crops where available.
4. Orientation must be treated as a separate content decision.
5. Handwritten critical fields must flow through HTR/crop route plus review.

### Model role split

1. `gemini-2.5-pro`:
   - acceptable candidate for printed-doc LLM reading,
   - NOT acceptable for this handwritten birth cert.
2. `gpt-4.1`:
   - useful comparator for printed-doc LLM reading,
   - NOT acceptable for this handwritten birth cert.
3. `gpt-4o`:
   - less predictable on harder docs due to refusal behavior,
   - NOT acceptable for this handwritten birth cert.
4. `gpt-5`:
   - too weak on this handwritten cert and operationally too slow,
   - NOT acceptable for this handwritten birth cert.
5. `DeepSeek`:
   - text mapper / structurer only,
   - never primary image reader here.

## Decision

For the handwritten Soviet birth certificate, the system should treat:

- direct Gemini/GPT image read = advisory/debug evidence only,
- HTR field route = primary technical direction,
- human review = mandatory release gate.

## Next exact step

Update the handwritten route and prompt law so the repository explicitly treats:

- printed field reading = LLM path,
- handwritten critical field reading = HTR-first path,
- direct VLM handwritten outputs = non-acceptance evidence only.
