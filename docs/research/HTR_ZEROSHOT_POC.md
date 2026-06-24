# HTR zero-shot POC — off-the-shelf Cyrillic models on our real handwritten cert (2026-06-24)

**Goal (owner: "скопировать всё что можем легально"):** before spending any labeling effort, measure
what legally-clean (Apache/MIT) open Cyrillic HTR models read on our real Soviet birth certificate
**zero-shot, no API keys, no training**. This is the honest baseline for "off-the-shelf, ours".

## Method
- Env: local CPU venv (`qa-private/htr-venv`, gitignored), torch 2.8 + transformers 4.57, no keys.
- Input: the real `birth_cert_handwritten_01.jpg` (4128×3096). Cropped the **child-name region**
  (handwritten surname line + given-name line) with `sharp`. **First crop attempt missed** — it grabbed
  the printed title "СВИДЕТЕЛЬСТВО О РОЖДЕНИИ" instead of the name; caught by eye, not by trusting the
  number. Re-cropped at the correct band (surname y≈0.23–0.29, given y≈0.30–0.37), **visually verified**
  the cursive surname/given are in-frame before scoring.
- Models (all commercially clean): `raxtemur/trocr-base-ru` (Apache), `Kansallisarkisto/cyrillic-htr-model`
  (Apache, Soviet-era aesthetic — processor lives in repo `subfolder="processor"`),
  `cyrillic-trocr/trocr-handwritten-cyrillic` (MIT, only one covering Ukrainian).
- Score: channel-aware, GT folded; substring-match against GT child given/surname (Cyrillic). PII stays in
  gitignored `qa-private/htr-poc/`; only match flags / CER are reported here.

## Result (zero-shot, no training)
| Model | License | Given name | Surname | Note |
|---|---|---|---|---|
| **raxtemur/trocr-base-ru** | Apache-2.0 | ✅ read (embedded in output) | ✗ CER≈1.1 | given correct, surname garbage |
| **cyrillic-trocr/...cyrillic** | MIT | ✅ read (embedded) | ✗ CER≈1.8 | given correct, surname garbage |
| **Kansallisarkisto/cyrillic-htr** | Apache-2.0 | ✗ | ✗ | short output, neither field |

## Honest verdict
- **2 of 3 open models read the GIVEN name** that the LLM APIs (Gemini/GPT) **fabricated** in the trap test
  (MODEL_INVENTORY trap 2026-06-24). So key-free open HTR already surfaces a field the paid APIs invent —
  real, if narrow, signal.
- **NONE read the cursive SURNAME zero-shot** (CER > 1 = output longer/unrelated, not even proofread-grade).
  The surname is the hard case: long cursive + apostrophe + a blue registry stamp printed over the ink.
- **Zero-shot off-the-shelf is NOT autonomous** for the critical field. This exactly confirms the
  `CYRILLIC_HTR_LANDSCAPE.md` prediction: ready models give proofreading-grade at best; the lever is
  fine-tuning on our document family.

## Decision point (no fantasy, no keys)
1. Zero-shot ready models: **DONE — given yes, surname no.** Not shippable alone for surnames.
2. The only path that beats the APIs on the handwritten **surname**: **fine-tune** Kraken/PyLaia (CTC) or
   TrOCR on **~30–50 labeled pages** of this document family (FICTIONAL/sanitized GT per PII policy) →
   expected CER ~8–12% (proofreading-assist). Cost = labeling effort (1–2 weeks), not money/keys.
3. Production stays unchanged until that number exists: handwritten certs = **human review** (CONSTITUTION +
   MODEL_INVENTORY handwriting policy). Printed docs keep the LLM APIs (already work).

## Reproduce (PII-free numbers only)
`qa-private/htr-venv/bin/python qa-private/htr-poc/infer.py` (crops + venv + real reads are gitignored).
