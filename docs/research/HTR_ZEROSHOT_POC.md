# HTR zero-shot POC — off-the-shelf Cyrillic models on our real handwritten cert (2026-06-24)

> ## ⛔ CORRECTION (2026-06-24, root-cause pass) — the earlier "no key-free model reads the surname" verdict was WRONG
> It was an artifact of OUR pipeline, not a model limit. A 4-agent root-cause pass + independent reproduction proved:
> **`raxtemur/trocr-base-ru` (Apache, key-free, local) reads the handwritten child name EXACTLY** when fed a crop taken
> at **native resolution** from the 4128×3096 source + a light **contrast-stretch** (NO downscale, NO binarization):
> surname **CER 0.000 (exact, 10/10)**, given **CER 0.000 (exact)**, patronymic **CER 0.333 (matches)**; blank-control
> clean (not fabrication); reproduced on independent runs. The earlier 0/8 was caused by three OWN bugs: (1) the crop was
> **downscaled to height 128** → signal destroyed; (2) the scorer folded Latin output against Cyrillic GT (`\w` keeps a–z)
> → correct reads counted as misses; (3) loose crops carried printed-label + stamp contamination. See the **ROOT-CAUSE
> REVERSAL** section below + `docs/adr/ADR-026-htr-native-res-pipeline.md`. Target scope: **modern Ukrainian & Russian
> Cyrillic** (not historical/Church-Slavonic).

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

## ROOT-CAUSE REVERSAL (2026-06-24) — 4 parallel agents, then independent test
Owner directive: "ищи корень, не поверхностно; все корни; потом тест; работай агентами." Four agents each
root-caused one hypothesis (measurement, segmentation, image-restoration, data); the binding root was found,
then reproduced independently.

**The four roots (PII-free):**
1. **Measurement was BROKEN (agent 1):** the bake-off `fold()` used `\w` (keeps a–z), so a model emitting the
   **Latin transliteration** was scored against the **Cyrillic** GT → guaranteed false miss. The substring
   `match` gate also under-counted partial reads. GT itself was validated as correct (surname = 10 Cyrillic
   chars). The production eval `scripts/.../rescore-channels.mjs` is already channel-aware; the bug was POC-local.
2. **Segmentation matters (agent 2):** rough band (label + stamp) CER 1.10 → tight word crop CER 0.30 (−73%).
3. **IMAGE RESOLUTION was the binding root (agent 3):** the prior crops were **downscaled to height 128**.
   Re-cropping the surname at **native resolution** from the 4128×3096 source + a light **contrast-stretch /
   gamma** (NOT binarization — binarizing HURT: Otsu 0.30, Sauvola 0.90) drove `raxtemur/trocr-base-ru` to
   **CER 0.000, exact 10/10**. Upscaling alone was neutral; the stamp (~5–6%) was secondary.
4. **Data was NOT the binding constraint (agent 4 SUPERSEDED):** agent 4 concluded "need labeled data" but
   reasoned only from the OLD low-res numbers and did not have agent 3's result — superseded the moment it
   landed. Synthetic-font fine-tuning was a dead end (synthetic val CER 0.59→0.26 but real flat/worse, conf
   0.33→0.15) — but moot, because the base model already reads the real hand once the crop is right.

**Independent verification (`qa-private/htr-poc/verify_root.py`), raxtemur, native-res crop + 2/98 contrast-stretch:**

| Field | best CER | match | channel | consistency | box on 4128×3096 |
|---|---|---|---|---|---|
| surname | **0.000** | ✅ exact | Cyrillic | 3/3 identical | (960,705,2250,905) |
| given | **0.000** | ✅ exact | Cyrillic | — | (540,905,1010,1120) |
| patronymic | 0.333 | ✅ (substring) | Cyrillic | — | (700,905,2050,1120) |

- **Blank control:** a white image yields NO name → the reads are real recognition, not fabrication.
- **Engine:** `raxtemur/trocr-base-ru` (Apache-2.0, Russian-handwriting TrOCR). `cyrillic-trocr` did NOT match
  even restored — raxtemur is the reader for our **UA/RU** hand.

**Corrected conclusion:** off-the-shelf, key-free, local HTR **DOES** read this modern UA/RU handwritten cert —
the blocker was our own low-res crop + scorer bug, not model capability and not missing labeled data. No
fine-tuning needed for this document. The production fix is a **pipeline rule** (native-res field crop +
contrast-stretch, never downscale, never binarize, channel-aware scoring) — see ADR-026. Human review stays as
the safety gate, but HTR is now a viable autonomous-candidate reader pending broader N validation.

**Open follow-up (honest):** the LLM-API "fabrication" trap result may ALSO be partly a low-res-input artifact
(the APIs got a downscaled full page). Worth re-testing Gemini/GPT on native-res field crops before treating
their fabrication as intrinsic.

## Generalization test (N=2 real RU docs, parallel agents, 2026-06-24)
Applied the SAME recipe (native-res crop + 2/98 contrast + raxtemur + channel-aware score) to more real docs:
- **birth_cert_soviet_01 (2nd real RU handwritten): recipe GENERALIZES.** given **CER 0.000 exact**, patronymic
  **CER 0.000 exact**, surname **CER 0.200** (8/10 — residual is a stamp/watermark intruding into the crop, a
  localization artifact, not a model limit). Blank-control clean.
- **marriage_zastavnyi_kovshirina (UA) + marriage_1939_kharkiv (old cursive): BLOCKED — GT MISSING.** Both
  agents correctly STOPPED rather than fabricate a number (OWNER_FILL placeholders). UA validation — our main
  scope alongside RU — cannot proceed until the owner transcribes the real names into the gitignored qa-private GT.

**Honest tally (N=2 RU docs, 6 name fields):** 4 exact (CER 0) + 1 near (0.2) + 1 substring-match (0.333).
Critical later correction: `raxtemur` is NOT blank-clean; on a blank image it emits non-empty text, so every
non-exact handwritten read must remain fail-closed and review-gated. The recipe reads real RU handwriting; the
remaining gap to EXACT (which a legal surname requires) is **field-region isolation** — stamps/labels/watermarks bleeding into a hand-found crop.
Next lever = automatic per-field localization; human review stays for any non-exact read.
**GT bug found:** `birth_cert_soviet_01.json` has `handwritten:false` though the name VALUES are cursive — the
flag describes the printed labels, mis-scoping the doc for HTR routing; worth correcting.

## Reproduce (PII-free numbers only)
`qa-private/htr-venv/bin/python qa-private/htr-poc/{infer,bakeoff,verify_root}.py` (crops + venv + polyscriptor
+ real reads are all gitignored under qa-private/). The binding recipe: native-res crop + contrast-stretch + raxtemur.
