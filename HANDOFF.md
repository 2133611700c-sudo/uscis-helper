# HANDOFF — Session 73 (2026-05-30)

## Session 73 — Two-brain divergence + ADR-016 (branch `docs/adr-016-one-brain`, off main)

Owner live-tested the SAME Ukrainian passport in TPS and Translation → DIFFERENT results (TPS read only surname; Translation read surname+given+DOB+place). Root cause verified: two recognition engines — Translation `/api/translation/vision-extract` = Gemini docintel `readDocument` + central-brain `analyze` (GOOD); TPS `/api/tps/ocr/extract` = Google Vision OCR + keyword modules (WEAK). Geography also diverges (engine `snapCity` threshold 0.34 too loose — `Ярошенець→Trostianets`; it already sets review_required but the threshold over-matches). This is a legal-accuracy defect, not cosmetics.

**Decision (ADR-016):** ONE recognition brain — the Gemini-vision docintel spine + central-brain `analyze`. TPS modules become validators over the SAME read (slot contract, MRZ controlling-Latin), NOT a second OCR engine. One geography/authority/transliteration path (D-GLOSSARY). Phased B1 (single reader for TPS) → B2 (single normalize) → B3 (one snap policy) → B4 (evidence parity) → B5 (delete divergent path), each green, with a fixture PARITY test (same doc → identical fields in both flows). Also fix: Translation wizard back + start-over buttons (UX).

**NEXT (not p2):** execute B1 — add the docintel Gemini reader as the primary reader in the TPS OCR route, modules as validators, gated by a fixture parity test. Multi-step; do phase by phase with verification (cannot be one commit).

---

