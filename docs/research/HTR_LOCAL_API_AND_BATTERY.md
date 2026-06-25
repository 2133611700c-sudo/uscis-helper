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
- **Held-out correction:** the old `marr1939` failure was caused by WRONG localization. The later frozen bake-off on corrected crops measured `raxtemur` EXACT and `kansallis-base` EXACT on that surname. This removes the false negative, but does NOT prove broad generalization because the 1939 field is still non-gold (`agent_visual`) and localization is still hand-frozen.
- **Ablation correction:** on already-TIGHT field crops, downscaling to 128 barely hurts (0.172 → 0.191). The
  large resolution effect is at the FULL-PAGE → field-crop stage, not within a tight crop — earlier
  "resolution is THE lever" was over-stated for the field-crop case; it is the lever at the page stage.

## Honest verdict
Positive recognition is PROVEN (3 exact + 3 partial, stable, key-free, ~1 s/field on the Mac GPU, through a
real service) — but it is **NOT production-grade**: 50% exact on a small gold set, no abstention, hand-frozen
localization, and no runtime staging/site E2E proof. raxtemur + this local API is a **reviewer-assist
handwriting reader behind a mandatory human-review gate**, not an autonomous reader. The remaining work is not
just hosting: we still need broader human-verified GT, real upload-path E2E, and hardened failure-mode proof.

## End-to-end through the production code path (2026-06-24) — Gemini-INDEPENDENT
The field-first route is wired into `readDocument` and runs even when the LLM read FAILS:
- `documentFieldReader.runHtrFieldStage` — for a handwritten doc family + `HTR_SIDECAR_URL` set, the HTR route
  reads the name fields INDEPENDENTLY of the LLM full-page read (runs on the normal path AND the vision-failed
  early-return path; creates the name rows if the LLM omitted them). FAIL-CLOSED: HTR unavailable / empty /
  low-confidence on a critical handwritten field → value=null + review_required → USCIS autofill blocked.
- `handwrittenFieldRoute` localizer priority: (1) `HTR_FIELD_BOXES` override → (2) NON-LLM per-doc-class
  `FIELD_BOX_TEMPLATES` (deterministic, no Gemini) → (3) Gemini bbox fallback.

**PROVEN through `readDocument` on the owner's real birth cert, with Gemini FULLY DOWN (503) and NO override
(the NON-LLM template localized):** `STATUS=htr_only:3f` — family_name (conf 0.96) + given_name (0.98) +
patronymic (0.94) read field-first by the template + raxtemur sidecar, ALL review-gated, **zero Gemini
dependency**. With the sidecar down, the same path FAIL-CLOSES (value=null + review). Suite 4677 green, tsc 0,
OFF by default. Honest remaining: per-class templates beyond birth cert; broad held-out GT; website-UI/tunnel
staging E2E; a production sidecar host.

## Reproduce
Start: `cd qa-private/htr-poc && ../htr-venv/bin/uvicorn ocr_api:app --port 8077`.
Battery: `../htr-venv/bin/python battery.py`. (venv + crops + reads gitignored.)
