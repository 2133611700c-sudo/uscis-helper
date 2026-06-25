# Local Cyrillic-HTR infrastructure + full proof battery (2026-06-24)

The missing production-route component is BUILT, and the recipe is measured with a full battery on the
owner's real handwritten documents. PII-free (CER / exact / conf / lengths only; crops/reads/GT gitignored).

## Infrastructure (built + running)
`qa-private/htr-poc/ocr_api.py` — a local FastAPI service: loads `raxtemur/trocr-base-ru` ONCE, serves
`POST /read` (native-res field crop → `{text, confidence, ms}`). Runs on **Apple Silicon GPU (MPS)** of the
Mac, **~1 s/field**, key-free, binds to 127.0.0.1 only. Recipe baked in: native-res crop → 2/98
contrast-stretch → raxtemur (never downscale, never binarize). This is the piece Vercel/Node cannot host
(Python/torch) — the production route is: Vercel route → HTTP → this sidecar → text → into the pipeline.

Proven through the API on the owner's birth cert: surname **exact** (conf 0.96, 987 ms), given **exact**
(conf 0.98, 768 ms) — real positive recognition through the running service, not a one-off script.

## Full battery (qa-private/htr-poc/battery.py) — methodology: CER + exact, 3 repeats, blank, ablation, held-out
| Doc | Field | provenance | GT_len | native CER | exact | 3-run | conf | downscaled-128 CER |
|---|---|---|---|---|---|---|---|---|
| birth01 | surname | owner | 10 | **0.0** | ✅ | stable | 0.96 | 0.0 |
| birth01 | given | owner | 6 | **0.0** | ✅ | stable | 0.98 | 0.0 |
| birth01 | patronymic | owner | 9 | 0.333 | — | stable | 0.94 | 0.333 |
| soviet01 | surname | owner | 10 | 0.2 | — | stable | 0.84 | 0.2 |
| soviet01 | given | owner | 6 | 0.5 | — | stable | 0.93 | 0.5 |
| soviet01 | patronymic | owner | 9 | **0.0** | ✅ | stable | 0.90 | 0.111 |
| marr1939 | surname | agent_visual | 9 | 1.44 | — | stable | 0.65 | 1.33 |

## Results (honest)
- **GOLD (owner-verified, N=6 handwritten fields): 3/6 EXACT, mean CER 0.172.** Real, key-free, positive
  Cyrillic recognition on the owner's documents.
- **Determinism: STABLE 3/3 on every field** — raxtemur is deterministic (reproducible, unlike the LLM previews).
- **Blank control: raxtemur CANNOT abstain** — emits text on a blank image → its reads MUST be gated
  (confidence + run-consistency) and human-reviewed; never autonomous on a critical field.
- **Held-out (marriage_1939, different writer/era): FAILS, CER 1.44.** No proven generalization to diverse hands.
- **Ablation correction:** on already-TIGHT field crops, downscaling to 128 barely hurts (0.172 → 0.191). The
  large resolution effect is at the FULL-PAGE → field-crop stage, not within a tight crop — earlier
  "resolution is THE lever" was over-stated for the field-crop case; it is the lever at the page stage.

## Honest verdict
Positive recognition is PROVEN (3 exact + 3 partial, stable, key-free, ~1 s/field on the Mac GPU, through a
real service) — but it is **NOT production-grade**: 50% exact on a small gold set, held-out negative, cannot
abstain. raxtemur + this local API is a **reviewer-assist handwriting reader behind a mandatory human-review
gate**, not an autonomous reader. The remaining levers (owner-side): broader human-verified GT for a real
held-out measurement; a production host for the sidecar.

## Reproduce
Start: `cd qa-private/htr-poc && ../htr-venv/bin/uvicorn ocr_api:app --port 8077`.
Battery: `../htr-venv/bin/python battery.py`. (venv + crops + reads gitignored.)
