# Best-Practice & GitHub Research — Document-AI Codex (2026-06-22)

Evidence base for the Codex/Constitution design. Real top solutions, fetched + verified,
with what is concretely COPYABLE for us and what is our differentiator.

## Top open-source solutions (verified via fetch)

| Solution | What it does | Copyable for us | Already in our project? |
|---|---|---|---|
| **getomni-ai/zerox** | Vision-LLM OCR: image → model → structured JSON-Schema output. Works with **Gemini**. | `schema` (JSON Schema) + SEPARATE `extractionModel` (≠ OCR model) + `extractPerPage` + per-doc `extractionPrompt`. | ✅ response_schema (R2), ✅ separate box-detection model (flash), ✅ per-doc prompt (docReadingRules) |
| **DocumindHQ/documind** | Schema-driven extraction; **library of reusable templates per document type**. | "store schema definitions as **versioned, reusable components, NOT inline**" = literally the Codex idea. Schema = {name, type, description, children}. | partial — docReadingRules exists; extend to full per-doc schema (field+type+desc+validation) |
| **IBM Docling** | `DoclingDocument` = ONE canonical document representation. | one unified canonical format (we have `CanonicalField`). | ✅ |
| **Marker / Unstructured** | layout/table parsing, 90+ langs. | layout parsing (we need less — our fields are known from the registry). | — |

## The "winning stack 2025+" (awesome-document-ocr, arXiv, Extend)
VLM-OCR → structured parsing → **VALIDATION** → ready output. Best accuracy =
**image + OCR-text/MRZ transcription together** (multimodal). Early input validation
(corruption/format/size) before model spend. Metadata/audit trail.

## The honest differentiator (proven by fetch)
**No open-source tool does field VALIDATION** (Documind: "no validation mechanism"; Zerox:
none). **None** do: (1) a deduplicated knowledge DICTIONARY with provenance, (2) per-field
semantic validation, (3) CROSS-DOCUMENT reconciliation (an MRZ-anchored passport date
resolving the ambiguous handwritten fields of the same person's other documents).
→ Our Codex (knowledge + per-doc rules + validators + cross-doc) is MORE advanced than the
top open-source tools. We copy their proven primitives (vision + schema + per-doc prompt —
we have them) and our value-add is validation + dictionary + cross-doc, which matches the
production best-practice (validation + human-in-loop is what separates prod from a demo).

## What this changes in the build
1. CONFIRMED our direction (Gemini vision + per-document schema/prompt + canonical format).
2. COPY from Documind: extend `docReadingRules` → a full per-document SCHEMA (field + type +
   description + validation rule), versioned, in the Codex, never inline.
3. COPY from Zerox: `extractPerPage` + a separate extraction model where useful.
4. KEEP as our differentiator: dictionary + per-field validators + cross-document reconciliation.

## Sources (fetched/verified)
- getomni-ai/zerox — https://github.com/getomni-ai/zerox
- DocumindHQ/documind — https://github.com/DocumindHQ/documind
- k-arvanitis/awesome-document-ocr — https://github.com/k-arvanitis/awesome-document-ocr
- dantetemplar/pdf-extraction-agenda — https://github.com/dantetemplar/pdf-extraction-agenda
- genieincodebottle/parsemypdf — https://github.com/genieincodebottle/parsemypdf
- Azure-Samples/data-extraction-using-azure-content-understanding — https://github.com/Azure-Samples/data-extraction-using-azure-content-understanding
- Lessons from Running an LLM Doc Pipeline in Production (Alan) — https://medium.com/alan/lessons-from-running-an-llm-document-processing-pipeline-in-production-33d87f99cdb1
- Document Extraction AI Guide (Extend) — https://www.extend.ai/resources/document-extraction-ai-guide
- Operationalizing Document AI (arXiv) — https://arxiv.org/html/2605.18818v1
