# UA-TrOCR — Tier-A Evidence Summary (PII-safe, frozen)

**Date:** 2026-06-27 · **Test validity:** PASS · **Result:** UA-TrOCR FAIL on current Tier-A set
· **Scorer validation:** PASS · **Infrastructure failure:** NO

This is the frozen, PII-safe record of testing the dedicated Ukrainian handwritten
TrOCR checkpoint against the owner's two real handwritten hands. Real images, GT
values, and raw model outputs stay gitignored under `qa-private/`; only PII-safe
metrics (verdicts, CER, lengths, hashes) are recorded here.

## Reproducibility identifiers (three distinct things — keep all)

| Identifier | Value |
|---|---|
| HF repository revision (Hub commit snapshot) | `60429f5bcfd5d78f06aa9b19ec1237a4fe03d8fb` |
| Local checkpoint SHA-256 (`model.safetensors`) | `cad9e6b333295e4345c9562a59ba06c0c9d6167a3485d84ef4b14a2bf11d5a5b` |
| Harness commit SHA (`scripts/htr/cross_hand_harness.py`) | `be1c0e139dcd050f53ce7577974626452f423b34` |

Checkpoint: `cyrillic-trocr/trocr-ukrainian-handwritten` · size 1,335,747,032 B ·
480 tensors · offline load OK (334M params, `local_files_only=True`,
`HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1`). Architecture: TrOCR (image encoder →
autoregressive text decoder); labelled as a Ukrainian handwritten model → the
logical last off-the-shelf candidate for the UA hand.

## Results (frozen boxes, GT, preprocessing, scoring — unchanged)

**hand A — birth_cert_handwritten_01 (RU cursive), source SHA `3188741189ef…`, rotate_cw 0**

| box ID | strict | folded-soft | CER |
|---|---|---|---|
| family_name_cyrillic | ✗ | ✗ | 0.600 |
| given_name_cyrillic | ✗ | ✓ | 0.167 |
| patronymic_cyrillic | ✗ | ✓ | 0.111 |

→ **hand A: strict 0/3, folded-soft 2/3**

**hand B — military_id_p1_01 (UA cursive), source SHA `f5dbc268836…`, rotate_cw 90**

| box ID | strict | folded-soft | CER |
|---|---|---|---|
| family_name_cyrillic | ✗ | ✗ | 0.818 |
| given_name_cyrillic | ✗ | ✗ | 0.833 |
| patronymic_cyrillic | ✗ | ✗ | 0.500 |

→ **hand B: strict 0/3, folded-soft 0/3**

## Independent validation (why 0/3 is real, not a scorer/infra artifact)

- **Determinism:** harness run 2× → raw outputs byte-identical across all 6 fields.
- **CER:** recomputed with a separate Levenshtein implementation → matches harness to 1e-9 on all 6.
- **Verdict:** independently recomputed STRICT/SOFT/WRONG → matches harness 6/6.
- **Fold fairness:** raw outputs are Cyrillic (cyr>0, lat=0) → folding does not unfairly discard Latin output.
- **Crops:** all boxes have positive area; GT present (lengths 6–11) for all 6 fields.
- **Infrastructure:** 0 MODEL_ERROR, 0 load-error — failure is recognition, not infra.

Raw outputs live only in gitignored `qa-private/htr-poc/cross_hand_evidence.json`.

## Status (scoped — do NOT overgeneralize)

- `UA-TROCR ON CURRENT TIER-A: FAIL`
- `OFF-THE-SHELF HTR SEARCH FOR MVP: CLOSED` (stop-rule; not worth more time)
- `AUTO-FINALIZATION (handwritten critical fields): PROHIBITED`
- `GENERAL ZERO-SHOT HTR IMPOSSIBILITY: NOT PROVEN` (2 hands / 6 fields is not a general claim;
  other models, preprocessing/segmentation, and Gemini/GPT are a different bucket — not disproven here)
- `NEXT PRODUCT PATH: mandatory human review + Unified Document Contract; later fine-tuning after sufficient verified GT`
