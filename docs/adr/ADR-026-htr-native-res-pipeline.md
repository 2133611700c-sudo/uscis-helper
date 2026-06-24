# ADR-026 — Handwritten Cyrillic (UA/RU) is readable key-free; the blocker was OUR pipeline, not the model

Date: 2026-06-24
Status: ACCEPTED (owner: "ищи корень не поверхностно; все корни; потом тест; работай агентами" → root-caused, verified)
Related: ADR-018 (model matrix), MODEL_INVENTORY.md, CONSTITUTION (human-review gate), docs/research/HTR_ZEROSHOT_POC.md

## Context
Multiple prior sessions concluded "NO model reads handwritten certificates without error" and that the only
path was fine-tuning on a labeled corpus. A 4-agent root-cause pass (measurement / segmentation /
image-restoration / data), then independent reproduction, **overturned that conclusion**.

## Decision / finding (verified, N=1 document, modern UA/RU Cyrillic — the target scope)
`raxtemur/trocr-base-ru` (Apache-2.0, key-free, local, CPU) reads the handwritten child name on the real
Soviet/Ukrainian birth certificate **exactly**, with NO fine-tuning, when the input is prepared correctly:

| Field | CER | Result |
|---|---|---|
| surname | 0.000 | exact 10/10, consistent 3/3 runs |
| given | 0.000 | exact |
| patronymic | 0.333 | GT matches as substring |

Blank-control clean (no fabrication from a white image). Reproduced by an independent agent and by
`qa-private/htr-poc/verify_root.py`.

## The binding root cause (why every prior attempt failed)
1. **Resolution (the binding one):** field crops were **downscaled to height 128** before recognition →
   the cursive signal was destroyed. Re-cropping at **native resolution** from the 4128×3096 source fixed it.
2. **Scoring channel bug:** the POC scorer folded with `\w` (keeps a–z), so a model emitting the **Latin**
   transliteration was compared to the **Cyrillic** GT → correct reads scored as total misses. (The production
   `rescore-channels.mjs` is already channel-aware; the bug was POC-local — but it polluted the verdict.)
3. **Segmentation contamination:** loose band crops included the printed label + a registry stamp → the model
   read that noise as extra characters (CER > 1.0). A tight, field-level word crop removed it.

What was NOT the constraint: model capability, engine choice, or missing labeled data. Synthetic-font
fine-tuning was a dead end and is abandoned.

## Production rule (the standard going forward)
For handwritten Cyrillic (UA/RU) field reading:
- **Crop each field region at NATIVE resolution from the original upload. NEVER downscale the field crop.**
  (The global `image-preprocess` 3072 cap and any height-128 line resize must NOT apply to the field-crop reader.)
- **Light contrast-stretch / gamma only.** NEVER binarize (Otsu/Sauvola destroy faded-ink stroke continuity).
- **Stamp suppression** (blue-channel mask → white) is an optional secondary; small effect.
- **Reader — ROUTE BY FIELD RENDERING (corrected 2026-06-24 honest re-test, HTR_HONEST_RETEST.md):**
  HANDWRITTEN field → `raxtemur/trocr-base-ru` (best on cursive) **but it CANNOT abstain — it fabricates a
  word on a blank crop**, so its non-exact reads MUST be gated (run-consistency / confidence) + human review;
  PRINTED field → an LLM (Gemini/GPT read printed passport text perfectly; raxtemur FAILS print, CER ~1.0).
  Do NOT use one reader for all. `gemini-2.5-pro` stays DISQUALIFIED for handwriting (fabricates).
- **Scoring/acceptance must be channel-aware** (Cyrillic vs Latin-translit) — never compare across alphabets.
- **Human review stays as the safety gate** (CONSTITUTION), but HTR is now a viable autonomous-CANDIDATE reader,
  not a known-failure. Promotion to autonomous requires broader N validation across documents/writers.

## Open follow-ups
- ~~Re-test the LLM APIs (Gemini/GPT) on native-res field crops~~ **ANSWERED (2026-06-24, tri-agent benchmark
  on the owner's real docs — docs/research/HTR_TRIAGENT_BENCHMARK.md):** on identical native-res crops, the
  local key-free `raxtemur` wins (3/6 exact) over gemini-3.1-pro-preview (2/6), gpt-4.1 (1/6), gemini-2.5-pro
  (0/6), gpt-5.5 (0/6). Native-res recovers the STRONGEST model (3.1-pro-preview was partly low-res-limited)
  but NOT the GA models or newer GPT — those have a genuine handwriting deficit. **raxtemur is the
  handwritten-field reader; LLMs are not.**
- Field-region localization: this proof used hand-found boxes; production needs automatic per-field region
  detection (layout/segmentation) to crop at native res.
- Validate on more real UA/RU documents/writers before relaxing the human-review gate.

## Project aligned to this standard (2026-06-24, inventory-then-fix, each step tested green)
Inventoried every OCR/resolution/scoring process in the project (3 parallel agents) and fixed each
divergence from the verified recipe; full web suite (4660 pass / 24 skip) + tsc 0 after every step:
1. **`ensemble/tileRegionRead.ts`** — the per-region recovery reader cropped at native res then DOWNSCALED
   the tile to 1600px (destroying the signal the crop preserved). Now keeps native res up to
   `OCR_TILE_MAX_DIMENSION` (3000), adds `.normalise()` contrast-stretch, q88→q92. (061e3cb)
2. **`upload/downscaleImage.ts`** — the client pre-shrank uploads to 2400px, BELOW the server's 3072 OCR
   cap, discarding pixels the server would keep. Aligned client maxEdge to 3072, q0.82→0.80 (stays under
   the ~4.5MB Vercel cap). Resolution now lost once, server-side. (bee3a58)
3. **`ocr/image-preprocess.ts`** — added `.normalise()` contrast-stretch to the faded/low-DPI upscale
   branch (the recipe's second proven lever), beside the existing handwriting sharpen; no binarization. (8d7f55c)
4. **`canonical/core/benchmark.ts`** — deprecated the test-only alphabet-agnostic `scoreAgainstTruth`;
   redirected acceptance to the channel-aware `scoreDocumentAcceptance`. Production scorers were already
   channel-aware (verified) — this closes the last landmine. (b5d6c23)

**Confirmed safe (no change needed):** production acceptance scorer `cyrillicAcceptanceMetrics.ts` and all
bench scorers (`rescore-channels`, `gt-pipeline-bench`, etc.) are already channel-aware; no binarization
exists anywhere in the recognition path. Still-open production gap: a native-res PER-FIELD reader as the
PRIMARY path (today it's full-downscaled-page → Gemini, with tileRegionRead as recovery) + automatic
field-region localization + the raxtemur sidecar host — these need the hosting decision.

## Consequence for the committed record
MODEL_INVENTORY's blanket "NO model reads handwritten certificates without error" is corrected: it holds for the
GA LLM APIs (which fabricate) but is FALSE for a specialized key-free HTR (`raxtemur`) given native-res input.
