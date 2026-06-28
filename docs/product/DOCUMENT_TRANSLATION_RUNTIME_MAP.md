# Runtime Map — USCIS Document Translation

AS-IS runtime chain for the translation product (verified read-only; file-level where a precise
line isn't pinned, line-level where verified). Cross-ref: `docs/ocr/CURRENT_STATE.md`.

## User-visible pages (translator)
- Entry / wizard: `apps/web/src/app/[locale]/services/translate-document/page.tsx`, `…/start/page.tsx`
- Wizard component: `apps/web/src/components/services/translation/TranslateWizard.tsx`
- Review screen: `apps/web/src/app/[locale]/services/translate-document/session/[sessionId]/review/page.tsx` + `EvidenceReviewPage.tsx`
- Checkout result: `…/translate-document/checkout/success/page.tsx`, `…/checkout/cancel/page.tsx`

## Runtime chain (upload → download)
| Step | Route / module | Notes |
|---|---|---|
| upload | `apps/web/src/app/api/translation/upload/route.ts` | stores file in Supabase Storage `translation-documents`; creates `translation_documents` + advances session |
| quality/orientation | `apps/web/src/lib/docintel/quality/documentImageQuality.ts`; orientation `apps/web/src/lib/docintel/orientation/detectOrientation.ts:178,186` (content-orient default ON) | |
| extract (Core) | `apps/web/src/app/api/translation/vision-extract/route.ts` | readDocument (Gemini/docintel) → `arbitrateDocument` → `toTranslationRows`; google-vision used for raw text/MRZ only (`:42,167,172,403`) |
| raw preservation | `apps/web/src/lib/canonical/core/translationAdapter.ts:8,26` (`raw_cyrillic`) | FieldOut carries NO bbox (`:22-50`) → review uses full_image/zone_fallback |
| persist fields | `apps/web/src/lib/translation/packetStateManager.ts` (`persistExtractedFields`) | `extracted_fields` (DELETE+INSERT, idempotent) |
| review state | `apps/web/src/app/api/translation/[sessionId]/review-state/route.ts` | builds ReviewField[]; `annotateReviewFields` adds contract_review_state when flag ON |
| confirm | `apps/web/src/app/api/translation/[sessionId]/confirm-field/route.ts` | **MIGRATED** to `getRepositories()` (no Supabase client) |
| correct | `apps/web/src/app/api/translation/[sessionId]/correct-field/route.ts` | still Supabase-coupled (ratchet backlog) |
| payment | Stripe checkout `apps/web/src/app/api/stripe/checkout/route.ts:44-77` (metadata.service='translation'); verify `apps/web/src/lib/stripe/verifyPayment.ts:60-88`; live gate `generate-pdf/route.ts:233-248` (402 if not paid) | |
| certification | build `apps/web/src/lib/translation/certificationRecord.ts:49-72`. **Two surfaces:** live wizard → `persistCertification.ts:64-71` → `translation_orders` + `translation_certification_audit` (7 hash fields); separate operator `certify/route.ts` → `certification_records` | |
| final PDF (live wizard) | `apps/web/src/app/api/translation/generate-pdf/route.ts:401-481` (mirror/generic) → returns `application/pdf` `:625-633` **and EMAILS it as a base64 attachment via Resend `:599-622`** — **NOT stored in a Storage bucket** | behind finalPdfGate + reviewGate + payment |
| final PDF (operator/v5 path) | `apps/web/src/app/api/translation/render/route.ts` → stores `final_renders` + Storage | separate from the live wizard path |
| download (live) | `checkout/success/page.tsx:149-187` generates **4 HTML files CLIENT-SIDE from localStorage** (`translation_pending`) — translation draft / certification / checklist / instructions; the server PDF arrives by email | |

## Safety gates already in the chain
- **finalPdfGate (server-side, BOTH emitters):** `apps/web/src/lib/contracts/finalPdfGate.ts:24` (`FINAL_PDF_CONFIRMATION_GATE_ENABLED` default OFF); applied in generate-pdf + render; route invariant `apps/web/src/lib/contracts/__tests__/finalPdfGateRouteInvariant.test.ts`.
- **raw→PDF closure:** `shouldBlockRawPdfFallback` (`contractReviewState.ts`).
- **C3 OCR field safety:** `apps/web/src/lib/documentSafety/applyOcrFieldSafety.ts:19-20` (`OCR_FIELD_SAFETY_ENABLED` default OFF).
- **review-required pre-payment block:** `generate-pdf/route.ts` `unresolvedReviewFields` returns 400 before charging.

## No `upload → Gemini → auto-PDF` shortcut
The PDF emitters (`generate-pdf`, `render`) require confirmed fields / review gate / certification +
payment; extraction (`vision-extract`) returns fields for review and does NOT produce a PDF. The
final-PDF confirmation boundary (`assertDocumentReadyForFinalPdf`) is enforced before any renderer
when its flag is ON. So no direct extraction→PDF path exists.

## Repository decoupling (in progress)
Persistence is moving behind `apps/web/src/lib/repositories/` (`getRepositories()`, in-memory
default; Supabase opt-in stub). Migrated routes: confirm-field, manual-review-status,
extraction-status. Backlog (still import Supabase directly): correct-field, certify, render, upload,
process, extract, ocr-from-storage, delete, review-state — tracked by the ratchet test
`apps/web/src/lib/repositories/__tests__/noDirectSupabaseInDomain.test.ts`.

## Acceptance-relevant gaps (verified by read-only inventory agents)
1. **Delivery ≠ Storage+download (live path).** The acceptance criterion "final PDF exists in
   Storage and downloads" is NOT met by the live wizard: the PDF is emailed (Resend base64,
   `generate-pdf:599-622`) and the success page downloads **client-side HTML from localStorage**
   (`checkout/success/page.tsx:149-187`). Only the separate `render` route writes `final_renders`+
   Storage. → MVP needs the live path to persist the PDF to Storage + a real download, OR adopt the
   render path for the wizard.
2. **No per-field bbox/evidence in the translation path** (FieldOut lacks it) → review falls back to
   full image (`EvidenceReviewPage` full_image/zone_fallback).
3. **Provider blockers:** Vision/DocAI 403 billing; Gemini 429 (owner-only).
4. **Corpus:** GT schema templates exist (`docs/templates/ground-truth/birth_cert_ua_printed.template.json`
   + soviet + handwritten); manifest `docs/document-coverage/PRIVATE_CORPUS_MANIFEST.safe.yaml` shows
   **birth certs = 1 (handwritten); printed birth certs with verified transcription = 0**. Real data is
   gitignored (qa-private/, absent from this worktree). Required 20–30 printed GT = NOT present.
5. **No non-mocked browser/DB E2E.**

This map is verified at file:line for the cited rows (two read-only inventory agents, 2026-06-28).
