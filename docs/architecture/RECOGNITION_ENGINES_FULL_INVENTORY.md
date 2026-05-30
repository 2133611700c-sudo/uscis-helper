# Recognition Engines — Full Inventory (all products, all folders)
**Date:** 2026-05-30 · Critical audit. Built from 3 parallel code scans (providers /
per-product pipelines / brains). Companion to ADR-016 (one recognition brain).

## TL;DR — the "two brains" problem, at scale
There are effectively **TWO parallel recognition+normalization stacks**, plus a
central-brain that only partially bridges them:
- **Stack A (Translation):** Gemini-vision `docintel` → `engine/orchestrator` →
  central-brain `analyze`. Reads the whole document.
- **Stack B (TPS + Re-Parole):** Google Vision OCR → keyword `tps/modules/*` →
  `tps/centralBrain` merge (its OWN dictionaryBridge/hallucinationGuard/fieldArbiter).
  Read only the surname on the owner's live test.
- **EAD:** no OCR at all (manual entry).

Same document → different engines → different fields → **legal-accuracy defect**.
**26 brain/normalizer components** exist; the most capable (`engine/orchestrator`)
is NOT wired into TPS. Geography/authority/transliteration are normalized **two
different ways** (orchestrator vs `tps/dictionaryBridge`).

---

## 1. OCR / VISION / AI PROVIDERS (low-level readers)

### Pure OCR (text + bounding boxes)
| File | Service / model | Returns | Env flag |
|---|---|---|---|
| `lib/ocr/providers/google-vision.ts` | **Google Vision** DOCUMENT_TEXT_DETECTION | text + lines/words + bboxes | `GOOGLE_(CLOUD_)VISION_API_KEY` |
| `lib/docai/client.ts` + `provider.ts` | **Google Document AI** | text + lines + confidence | `DOCAI_ENABLED`, `GOOGLE_DOCAI_CREDENTIALS_JSON`, `DOCAI_PROCESSOR_ID` |

### Vision-LLM readers (return fields)
| File | Model | Used by |
|---|---|---|
| `lib/docintel/providers/geminiVisionProvider.ts` | **Gemini 3.1-pro-preview** (→3.5-flash→2.5-flash) | docintel reader (Translation), TPS arbiter |
| `lib/engine/models.ts` `geminiReader` / `vertexGeminiReader` / `openaiReader` / `googleVisionFullText` | Gemini Studio / **Vertex Gemini 2.5-pro** / **GPT-4o** / Vision presence-confirm | engine consensus (D1) |
| `lib/tps/ai/geminiVisionArbiter.ts` | Gemini (wraps docintel provider) | TPS booklet slot |
| `lib/engine/htr.ts` | **Transkribus** | 🔴 NOT runtime-verified (OAuth account, password grant fails) |

### Prose translators / text AI (DeepSeek)
| File | Model | Purpose |
|---|---|---|
| `lib/engine/translator.ts` | DeepSeek `deepseek-chat` | Ukrainian prose → English (locked tokens) |
| `lib/ocr/field-mapper.ts` | DeepSeek (text) | OCR-token → fields (ID-based, no vision) |
| `lib/tps/ai/dualOcrCrossref.ts` | DeepSeek | Vision+DocAI cross-ref (booklet handwriting) |
| `lib/tps/ai/documentBrain.ts` | DeepSeek | legacy TPS AI brain (flag `TPS_AI_BRAIN_ENABLED`) |
| `lib/deepseek/client.ts` | DeepSeek chat/reason (R1) | generic client |

### Preprocessing (sharp)
`lib/ocr/image-preprocess.ts` AND `lib/engine/preprocess.ts` — **two preprocessors**
(EXIF auto-orient, resize, JPEG, quality gate). Duplication.

---

## 2. BRAINS / NORMALIZERS — wired vs dead (26 components)

| Component | Purpose | Wired to live route? |
|---|---|---|
| `central-brain/analyze` | product coordinator | ✅ `/translation/vision-extract` (flag), `/central-brain/health` |
| `engine/orchestrator` (extractDocument/normalize) | **most capable**: consensus + KMU-55 + geography + patronymic + dates | ⚠️ internal — via central-brain/docintel only, **NOT wired to TPS** |
| `engine/consensus` | hallucination guard (≥2 readers agree) | internal (orchestrator) |
| `engine/terminologist` | dates + authority (deterministic) | internal |
| `engine/assembler` | final EN doc assembly | 🔴 dead (no caller) |
| `engine/docTypes` | field structure per doc type | internal |
| `docintel/documentFieldReader` `readDocument` | Gemini read → transliteration → provenance | ✅ `/translation/vision-extract` |
| `docintel/transliterationPolicy` `toCanonicalValue` | KMU-55 single-source | internal (docintel) |
| `docintel/documentRegistry` | doc-type specs | internal |
| `tps/centralBrain` `mergeToCentralBrain` | TPS merge (contracts→guard→priority→arbiter) | ✅ `/tps/brain/merge` |
| `tps/ai/documentBrain` | DeepSeek extraction | ✅ `/tps/ocr/extract` (flag) |
| `tps/ai/dualOcrCrossref` | Vision+DocAI arbiter | ✅ `/tps/ocr/extract` (flag) |
| `tps/ai/geminiVisionArbiter` | booklet Gemini read | ✅ `/tps/ocr/extract` |
| `tps/fieldArbiter` / `hallucinationGuard` / `sourcePriority` / `dictionaryBridge` | TPS-only merge helpers | internal (tps/centralBrain) |
| `tps/modules/{passport,booklet,i94,ead,dl,i797}` | keyword field extraction | ✅ `/tps/ocr/extract` |
| `tps/ocr/postExtractNormalize` | TPS pre-response normalize | ✅ `/tps/ocr/extract` |
| `knowledge/{transliterate,gazetteer,patronymic,registry/registryLookup,dictionary}` | KMU-55, snapCity, patronymic, D-GLOSSARY | internal (orchestrator + dictionaryBridge) |
| `knowledge/normalize.ts` | legacy normalize service | 🔴 dead (superseded, no caller) |

**Distinct recognition+normalization stacks: 2** (engine/docintel vs tps/*), bridged
partially by central-brain. Dead: `engine/assembler`, `knowledge/normalize.ts`.

---

## 3. PER-PRODUCT PIPELINE + DIVERGENCE

| | TPS-Ukraine | Translation | Re-Parole | EAD |
|---|---|---|---|---|
| Extract route | `/api/tps/ocr/extract` | `/api/translation/vision-extract` | `/api/tps/ocr/extract` (reuses TPS) | none |
| **OCR engine** | **Google Vision** + DocAI | **Gemini vision** (docintel) | Google Vision + DocAI | manual |
| **Field extraction** | keyword **modules** + flagged DeepSeek brain | **Gemini** read (docintel) | TPS modules | manual |
| **Normalize/brain** | `tps/centralBrain` + `postExtractNormalize` + `dictionaryBridge` | `engine/orchestrator` + `central-brain` | same as TPS | none |
| **Geography** | `dictionaryBridge` (genitive→nominative, geo corrections) | `orchestrator` (snapCity + registryLookup) | dictionaryBridge | none |
| Transliteration | KMU-55 (knowledge) | KMU-55 (knowledge) | KMU-55 | none |
| Output | ZIP (I-821 + I-765) | PDF + cert | ZIP (I-131) | HTML |

### 🔴 Critical divergences (the legal risk)
1. **Different OCR/reader:** TPS/Re-Parole use Google-Vision+keyword-modules;
   Translation uses Gemini-vision. → different fields on the same document.
2. **Different normalize brain:** TPS uses `tps/centralBrain` + `dictionaryBridge`;
   Translation uses `engine/orchestrator`. → different geography/authority results
   (e.g. `Ярошенець→Trostianets` vs other).
3. **Most-capable engine (`orchestrator`) is NOT used by TPS** — TPS is the WEAKER
   stack, yet it's the paid TPS product.
4. **Duplication:** 2 preprocessors, geography normalized 2 ways, transliteration
   referenced from 4+ call sites, authority mapping in 3 places, 2 dead modules.

---

## 4. UNIFICATION TARGET (per ADR-016)
ONE reader = Gemini-vision docintel; ONE normalize = `engine/orchestrator` (or
central-brain `analyze`) for BOTH stacks; TPS modules become validators over the
same read (MRZ controlling-Latin, slot contract). One geography/authority/translit
path (D-GLOSSARY). Phased B1–B5 with a **fixture parity test** (same doc → identical
fields in TPS and Translation). Delete the duplicate path + dead modules
(`engine/assembler`, `knowledge/normalize.ts`) at the end.

**Honest:** this is a multi-phase refactor of the live TPS pipeline — executed and
verified phase by phase, not one commit.
