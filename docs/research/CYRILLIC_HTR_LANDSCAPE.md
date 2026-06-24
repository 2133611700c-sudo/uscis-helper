# Cyrillic handwritten/historical OCR (HTR) — legal-reuse landscape (research 2026-06-24)

**Why:** LLM APIs (Gemini/GPT/Claude) DO read printed Cyrillic but FABRICATE on handwriting (trap test:
0/5 match GT, "WRONG-STABLE" → consensus can't catch it). The ONLY path that can beat them on handwriting
is a SELF-HOSTED, key-free HTR engine fine-tuned on our document family. This catalogs what we can LEGALLY
reuse (engines, pretrained models, datasets) and the proven recipe + realistic data cost.

> **Honest ceiling (proven):** even the best Cyrillic HTR is ~4–12% CER (character error) on cursive — NOT
> zero. It is "proofreading-assist", not autonomous. But it is FAR better than the LLM APIs (which fabricate),
> it is OURS (no keys), and HTR + human review is the realistic product path for handwritten certs.

## ENGINES (open, self-hostable, no API keys)
| Engine | Repo | License | HTR? | Cyrillic | Trainable | Arch | Note |
|---|---|---|---|---|---|---|---|
| **Kraken** | github.com/mittagessen/kraken | **Apache-2.0** ✅ | yes | yes | yes (`ketos train`) | CNN+BiLSTM+CTC | best self-host base; segment+recognize |
| **PyLaia** (Teklia fork) | github.com/jpuigcerver/PyLaia | **MIT** ✅ | yes | yes | yes (`pylaia-htr-train-ctc`) | CNN+BiLSTM+CTC | the engine behind Transkribus' RU/UA models |
| **TrOCR** | microsoft/unilm + HF | **MIT** (code) ✅ | yes | yes | yes (HF Seq2SeqTrainer) | ViT enc + transformer dec | ready Cyrillic fine-tunes exist; needs line crops |
| **eScriptorium** | gitlab.com/scripta/escriptorium | **GPL/AGPL** ⚠️ | yes (wraps Kraken) | yes | yes (GUI) | Kraken | best GUI to LABEL + train; copyleft (self-host ok) |
| **Loghi** | github.com/knaw-huc/loghi | **MIT** ✅ | yes | retrainable | yes | CNN+LSTM+CTC + layout | full pipeline; no stock Cyrillic |
| Calamari / docTR / PaddleOCR / EasyOCR / Tesseract | (Apache) | ✅ | print-leaning | yes | yes | CRNN/CTC | for PRINTED Cyrillic; weak on cursive |
| Surya | datalab-to/surya | GPL-3 + OpenRAIL ⚠️ | basic | print | no | VLM | good for LAYOUT/line detect only |

## PRETRAINED Cyrillic HANDWRITING models — commercially clean (download weights, no key)
| Model | URL | License | Arch | Lang | Note |
|---|---|---|---|---|---|
| **Kansallisarkisto/cyrillic-htr-model** | huggingface.co | **Apache-2.0** ✅ | TrOCR-large | Cyrillic 17–20th c. | **best for Soviet-era aesthetic**; CER ~8% |
| **raxtemur/trocr-base-ru** | huggingface.co | **Apache-2.0** ✅ | TrOCR-base | Russian HW | strongest clean RU handwriting |
| **cyrillic-trocr/trocr-handwritten-cyrillic** | huggingface.co | **MIT** ✅ | TrOCR | RU+**UK**+ChSlav | only one covering Ukrainian; generic, CER ~25% |
| **ai-forever/ReadingPipeline-Peter** | huggingface.co | **MIT** ✅ | segment+OCR | Russian HW | full page→text pipeline |
| Old Cyrillic uncial (Rabus/Kraken) | zenodo.org/records/7755483 | **CC-BY-2.0** ✅ | Kraken .mlmodel | Church Slavonic | attribution required |
| ⛔ kazars24/trocr-base-handwritten-ru | huggingface.co | NO license = all-rights-reserved | TrOCR | RU | do NOT ship; use raxtemur instead |

## DATASETS — commercially clean (for fine-tuning)
| Name | License | #samples | Lang | Note |
|---|---|---|---|---|
| **HWR200** (AntiplagiatCompany) | **Apache-2.0** ✅ | 30,030 / 200 writers | RU HW | strongest legally-clean REAL handwriting |
| **Digital Peter** (ai-forever/Peter) | **MIT** ✅ | 9,696 lines | RU historical | Peter the Great cursive |
| **School Notebooks RU** (ai-forever) | **MIT** ✅ | 3 GB | RU HW | modern |
| **nastyboget/stackmix_cyrillic + synthetic_cyrillic** | **MIT** ✅ | 600,000 | RU | synthetic; pretrain for shape priors |
| **StackMix-OCR** (ai-forever) | **MIT** ✅ | generator | Cyrillic | augmentation: halves labeling need |
| ⛔ HKR / KOHTD | CC-BY-NC-ND | 63K / 140K | RU/KZ HW | research-only, NO commercial |
| ⛔ RUKOPYS (UCU, first open Ukrainian HTR) | CC-BY-NC-SA | ~1,330 | **UK** HW | research-only |

## WHO does it at scale (proven CER)
- **Transkribus/READ-COOP** (PyLaia engine): Russian Generic Handwriting **5.8% CER**, Russian+typed **5.54%**,
  single-archive Rychkov (581 pages) **4.4%**, Ukrainian Generic Handwriting **4.2%**, Church Slavonic **3.7–3.9%**.
  (Models run on the platform; weights NOT downloadable — but they prove the engine + data recipe.)
- **Digital Peter** (Sber, full open code+data+paper): CNN+CTC baseline **10.5% CER**; transformer did WORSE (14.5%).
- **StackMix** (Sber): HKR **3.49% CER** with augmentation.

## THE RECIPE (copyable) + realistic data cost (proven numbers)
- **Engine choice (evidence): CTC (Kraken/PyLaia) BEATS transformer/TrOCR on small historical Cyrillic sets**
  (Digital Peter CTC 10.5% vs transformer 14.5%; generic cyrillic-TrOCR 25%). Use Kraken/PyLaia + optional n-gram LM.
- **Pipeline:** layout/line-segmentation (Kraken `blla` / Laypa / Surya) → line crops → recognizer (Kraken/PyLaia/TrOCR).
- **Labeling tool:** eScriptorium (GUI) → export PAGE-XML/ALTO → `ketos train` (Kraken) or `pylaia-htr-train-ctc`.
- **Data needed (with transfer learning from a Cyrillic base):**
  - MVP (CER ~8–12%, proofreading-assist): **~30–50 pages (~1,000–1,500 lines)** · ~1–2 weeks labeling.
  - Good (CER ~4–6%, Transkribus band): **~100–600 pages** (Rychkov 581→4.4%) · 4–8 weeks labeling.
  - StackMix/blot augmentation roughly halves the labeling.
- Training is cheap (hours on 1 GPU); labeling is the cost.

## PLAN (key-free, measurable, no fantasy)
1. **Zero-shot POC** (this week, no training): download the 3 Apache/MIT ready models above, run them on LINE-CROPS
   of our real handwritten cert → measure CER per model. Honest baseline of "off-the-shelf ours".
2. If a base looks promising → label ~30–50 pages in eScriptorium (FICTIONAL/sanitized GT per PII policy; real PII
   stays in qa-private) → fine-tune Kraken/PyLaia → measure lift.
3. Decide by the number: if CER reaches proofreading-assist, wire HTR as the handwriting reader (force-review stays).
4. Printed docs keep using the LLM APIs (already work).

## Sources
Kraken github.com/mittagessen/kraken · PyLaia github.com/jpuigcerver/PyLaia + doc.teklia.com/pylaia ·
TrOCR huggingface.co/microsoft/trocr-base-handwritten · models: huggingface.co/{Kansallisarkisto/cyrillic-htr-model,
raxtemur/trocr-base-ru, cyrillic-trocr/trocr-handwritten-cyrillic, ai-forever/ReadingPipeline-Peter} ·
datasets: huggingface.co/datasets/{ai-forever/Peter, ai-forever/school_notebooks_RU, AntiplagiatCompany/HWR200,
nastyboget/stackmix_cyrillic} · github.com/ai-forever/{digital_peter_aij2020,StackMix-OCR} · zenodo.org/records/7755483 ·
Transkribus blog.transkribus.org/en/special-models-on-slavic-handwriting-released · eScriptorium escriptorium.readthedocs.io ·
Digital Peter arXiv 2103.09354 · PyLaia+LM arXiv 2404.18722 · data-size arXiv 2201.06170
