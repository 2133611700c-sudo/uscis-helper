# Product Flow Matrix
**Date:** 2026-05-30 · READ-ONLY.

| | **TPS-Ukraine** | **Translation** | **Re-Parole** | **EAD** |
|---|---|---|---|---|
| **upload** | TPSWizardV2, localStorage state | TranslateWizard, sessionStorage draft (gated ?paid=1) | ReparoleWizardV2, localStorage | EADWizard, no upload |
| **OCR** | Google Vision + DocAI | **Gemini docintel** | reuses TPS OCR | none (manual) |
| **brain** | tps/centralBrain + dictionaryBridge + keyword modules | engine/orchestrator + central-brain | tps/centralBrain | none |
| **review** | review screen; garbage-guard on merge+hydration | review + 2 checkboxes + signature + address; garbage-guard | review | manual form |
| **payment** | owner-bypass OR Stripe (server-verified) | owner-bypass OR Stripe | owner/Stripe (upstream) | free |
| **PDF** | pdf-lib prefiller (I-821 + I-765) | packet/pdf.ts (flat PDF + cert + signature image) | reparole packetBuilder (I-131) | ead i765FieldMap (HTML/PDF) |
| **DB** | tps_ocr_audit; packets | translation_sessions/extracted_fields/audit_logs/**translation_orders**/**translation_certification_audit** | generated_packets | none |
| **audit** | tps_ocr_audit (async) | translation_certification_audit (**continues on insert failure**) | — | — |
| **reset** | ⚠️ partial — legal-risk/attest keys persist cross-document | ✅ new upload clears fields; draft restore gated ?paid=1 | partial | n/a (stateless) |
| **status** | ACTIVE (paid) — **WEAK reader** | ACTIVE (paid) — **STRONG reader** | ACTIVE | ACTIVE (free) |
| **blockers** | uses weaker brain than Translation; stale legal-risk state; no per-doc-session id; rotation only via MRZ→identity-fix added | [CONFIRM] on bureau path (off); audit DB continues-on-fail; orientation needs live repro | inherits TPS brain weakness | — |

## Cross-product divergences (legal risk)
- **Same document → TPS and Translation read DIFFERENTLY** (different OCR + different normalize). This is the #1 issue (ADR-016).
- Geography normalized two ways (engine snapCity vs tps dictionaryBridge).
- Two preprocessors, two transliteration impls.
- State reset is inconsistent (Translation gated/cleared; TPS legal-risk persists).

## What's verified vs unverified
- ✅ payment gates (server-side Stripe) on all paid products.
- ✅ review gate (Translation): name+address+2 checkboxes+signature.
- ⚠️ audit DB write: shape proven, but route returns 200 even if it fails; no real row yet.
- 🔴 recognition parity: NOT verified (the two-brain bug).
- ⏳ orientation auto-rotate (booklet): deployed, needs a live rotated photo.
