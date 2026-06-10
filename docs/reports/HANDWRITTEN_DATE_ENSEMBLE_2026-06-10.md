# Handwritten Cyrillic dates — the ensemble fix (proven, 2026-06-10)

The honest problem (multi-run probe): a general vision LLM reads handwritten
Cyrillic NAMES well but misreads handwritten DATES — specifically the month word
(one Ukrainian month confidently read as an adjacent one) — stably wrong.

## What the field/best-practice says (research)

- **Transkribus** has a dedicated Ukrainian HTR model, CER ≈ 4.2% — the best
  documented for handwritten Ukrainian. Needs owner-provisioned readcoop/Processing
  auth (our integration scaffolding exists but was never authenticated).
- **TrOCR-Cyrillic** (HuggingFace, fine-tuned on Transkribus Cyrillic) — self-host or HF-token.
- **Azure Document Intelligence EXCLUDES handwritten Cyrillic.** Out.
- **Google Document AI** is weak on handwriting (~23% WER, loses reading order).
- The whole field uses **specialized HTR + ENSEMBLE + human-in-the-loop**; no engine
  is reliable alone on handwritten Cyrillic. Even the best (Transkribus 4.2% CER)
  needs human verification on critical fields.

Sources: Transkribus Ukrainian HTR (Kyiv-Mohyla); TrOCR-Cyrillic (HuggingFace);
Azure OCR language coverage; OCR benchmark comparisons (handwriting WER).

## What we PROVED on a real handwritten document (live)

Three techniques tested on the owner's handwritten birth cert vs ground truth:

| technique | day | month | year | stable |
|---|---|---|---|---|
| Gemini, full page | wrong | wrong | ok | no |
| Gemini, date-disambiguation prompt | unstable | wrong | ok | no |
| Gemini, **detect-region + crop + zoom ×5** | **correct** | wrong | **correct** | **yes** |
| **Google Vision (SA), handwriting OCR** | near | **correct** | ok | — |

Two findings that change everything:
1. **Zooming the date region** (geometric crop, not tonal — the rejected B&W is
   different) recovered the DAY and stabilized it.
2. **Gemini and Google Vision DISAGREE on the month, and Vision read it correctly**
   where Gemini did not. Neither engine alone is right; **together they contain every
   correct component**. Combining day (Gemini-zoom) + month (Vision) + year =
   the correct date that neither produced alone.

## The fix (best-practice, on engines we already have)

ENSEMBLE + human-in-the-loop, no new vendor:
- Read with **Gemini** (primary; strong on names + structure) AND **Google Vision**
  (second engine; better on the handwritten month here).
- For DATE fields, parse each engine's reading and **reconcile component-wise**.
  Agreement → trust. **Any disagreement → force review and surface BOTH candidates**
  to the human (who now has two machine opinions, one correct).
- Optional booster: a zoomed date-region crop re-read for the day/digits.
- This is exactly what specialized-HTR pipelines do; Transkribus/TrOCR can later be
  added as a THIRD reader (owner provisions auth) to push month accuracy further.

## Built this step (the deterministic core)

`docintel/ensemble/dateReconcile.ts` + tests:
- `parseDateText` — UA + RU word-months, ISO, MM/DD/YYYY (distinguishes червня=June vs липня=July).
- `reconcileDate(candidates)` — component-wise; agreement → ISO value; ANY
  disagreement/missing → `reviewRequired` + reason codes + all candidates. Never
  silently picks. Pinned on the real Gemini-July vs Vision-June pattern.

## Remaining build (defined, no research needed)
1. Wire **Google Vision second-read** into the translation path for handwritten-risk
   classes; extract date strings from both engines → `reconcileDate`.
2. Zoomed date-region crop re-read (geometric) for the day/digits.
3. Review UI: show both candidate readings on a disagreed date; human picks.
4. (Later, owner-gated) add Transkribus/TrOCR as a third reader for the month.

## [OWNER ACTIONS]
- **SECURITY:** the Vision service-account private key was pasted into chat — treat it
  as compromised and **rotate it** (new key for messenginfo-vision-ocr@…, delete key id `eb576de0…`).
- To add the best specialized reader later: provision Transkribus Processing auth or an HF token.
