# Architecture Dependency Map
**Date:** 2026-05-30 · READ-ONLY.

## TPS flow
```mermaid
flowchart TD
  TPSUI[TPSWizardV2.tsx] -->|upload| OCR[/api/tps/ocr/extract/]
  OCR --> GV[Google Vision]
  OCR --> DOCAI[Google Document AI]
  OCR --> MODS[tps/modules: passport/booklet/i94/ead/dl/i797]
  OCR -.flag.-> GEM[Gemini arbiter / DeepSeek brain / dualOcrCrossref]
  OCR --> NORM[postExtractNormalize + dictionaryBridge]
  NORM --> MERGE[/api/tps/brain/merge → tps/centralBrain/]
  MERGE --> REVIEW[review screen]
  REVIEW -->|owner OR Stripe| PKT[/api/tps/generate-packet/]
  PKT --> PDFLIB[pdf-lib prefiller: I-821 + I-765]
  PDFLIB --> ZIP[(ZIP)]
```

## Translation flow
```mermaid
flowchart TD
  TUI[TranslateWizard.tsx] -->|upload| VX[/api/translation/vision-extract/]
  VX --> DOCINTEL[docintel.readDocument: Gemini vision]
  VX --> CB[central-brain analyze]
  CB --> ORCH[engine/orchestrator normalize]
  VX -->|garbage guard| REVIEW[review + signature + 2 checkboxes + address]
  REVIEW -->|owner OR Stripe| GEN[/api/translation/generate-pdf/]
  GEN --> GATE[assertReviewGate]
  GATE --> PDF[packet/pdf.ts generateTranslationPDF + cert block + signature image]
  GEN --> AUDIT[(translation_certification_audit + translation_orders)]
  PDF --> OUT[(PDF)]
```

## OCR / brain flow (the two-brain divergence)
```mermaid
flowchart LR
  subgraph StackA[Stack A — Translation]
    A1[Gemini docintel] --> A2[engine/orchestrator] --> A3[central-brain]
  end
  subgraph StackB[Stack B — TPS + Re-Parole]
    B1[Google Vision + DocAI] --> B2[tps/modules] --> B3[tps/centralBrain + dictionaryBridge]
  end
  KN[(packages/knowledge: KMU-55, registry, gazetteer, patronymic)]
  A2 --> KN
  B3 --> KN
  ORCHX[engine/orchestrator = MOST CAPABLE] -.NOT wired.-> B1
  classDef dead fill:#fdd;
```

## PDF flow
```mermaid
flowchart TD
  LIVE[packet/pdf.ts — LIVE: translation flat PDF + cert + signature] --> OUTL[(PDF)]
  BUREAU[renderOfficialTranslation — FLAGGED BUREAU_PDF off] --> OUTB[(PDF, civil schemas)]
  MAR[renderMarriageCertificateTranslation — DEAD 0 importers] -.x.-> BUREAU
  TPSF[tps prefiller — LIVE: I-821/I-765/I-131] --> OUTZ[(ZIP)]
  EADF[ead/i765FieldMap — LIVE: I-765] --> OUTE[(HTML/PDF)]
  BSR[bureauStyleRenderer — text/audit only]
```

## DB / audit flow
```mermaid
flowchart TD
  R1[/translation/generate-pdf/] -->|insert, error LOGGED not blocked| TO[(translation_orders)]
  R1 -->|insert, error LOGGED not blocked| TCA[(translation_certification_audit)]
  R2[/translation/vision-extract,render/] --> TS[(translation_sessions)]
  R2 --> EF[(extracted_fields)]
  R2 --> AL[(audit_logs)]
  R3[/tps/ocr/extract async/] --> TOA[(tps_ocr_audit)]
  R4[/tps/brain/merge/] -.-> CBA[(central_brain_audit — referenced, maybe not in migrations)]
  R5[manual review] --> MRQ[(manual_review_queue)]
```

## Notes
- `engine/orchestrator` (most capable) is wired only via central-brain/docintel → Translation; TPS does NOT use it (the divergence).
- Dead nodes: `engine/assembler`, `knowledge/normalize.ts`, `renderMarriageCertificateTranslation`, `engine/htr` (broken).
- 20 distinct DB tables touched across 47 routes; 26 migrations.
