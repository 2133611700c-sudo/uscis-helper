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

## Bake-off completion (2026-06-24, same day) — the 4th candidate + stamp-suppression
Per the expert critique ("test the missing local candidate; surname may be an IMAGE problem, not a model
problem"), two more PII-safe, key-free tests on the same crops:

**Step A — PyLaia CRNN-CTC (the missing candidates), all local, Apache-2.0:**
- `achimrabus/crnn-ctc-ukrainian` (verified Apache in card; raw PyLaia checkpoint, loaded via the MIT
  `inference_pylaia_native.py` from achimrabus/polyscriptor): surname CER 0.90 / conf **0.33** (miss);
  given CER 1.00 (miss — **worse** than the TrOCR models, which read the given name). NOT a zero-shot winner.
- `achimrabus/crnn-ctc-church-slavonic`: CER 1.0–1.17 — useless on modern Ukrainian → **transfer-gap
  confirmed empirically** (a Church-Slavonic model does not transfer to a modern UA civil cert).
- **Useful positive:** PyLaia confidence on every wrong read is LOW (0.21–0.38) — calibrated in the right
  direction, so the confidence score is usable as a **reviewer-assist flag** ("don't trust this read").

**Step B — stamp suppression (test the image-hypothesis):** the blue registry stamp covers only **~5%** of
the surname crop. Removing it (blue-channel mask → white; and HSV-value grayscale) moved `raxtemur` surname
CER 1.10 → **0.70** (real but partial), `cyrillic-trocr` mixed. ⇒ the stamp hurts a little; the **dominant**
blocker is the cursive + faded ink itself, not occlusion.

**Decisive verdict (now across architectures, not one):** NO key-free model — TrOCR transformer, PyLaia
CRNN-CTC, or the Ukrainian-specific model — reads our cursive **surname** zero-shot. This is the off-the-shelf
ceiling, not a model-selection miss. The only remaining key-free lever for the surname is **fine-tuning on our
own labeled corpus of modern Ukrainian/Soviet documents** (NOT someone else's medieval corpus) — exactly the
expert conclusion, now empirical. Engine for that: PyLaia/Kraken (CTC) — it's the same family the only model
that even got the alphabet right is built on; trainable, local, Apache/MIT.

**License reality (per the legal-manifest discipline):** `card-license=apache-2.0` for the achimrabus weights
covers the weights as declared, NOT the training-data provenance → `benchmark_allowed: true,
production_allowed: false` until a per-corpus rights audit. Transkribus/Google/Azure comparison readers were
NOT run: they egress the real document off-box → one-time-with-consent benchmark only, never in the production
loop on real PII.

## Reproduce (PII-free numbers only)
`qa-private/htr-venv/bin/python qa-private/htr-poc/{infer,bakeoff}.py` (crops + venv + polyscriptor + real
reads are all gitignored under qa-private/).
