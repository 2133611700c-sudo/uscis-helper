-- Migration: Add OCR ID evidence columns to extracted_fields
-- v6.0 — Google Vision + DeepSeek Text ID-based mapping
--
-- New columns:
--   ocr_ids       jsonb    — array of OcrWord/OcrLine IDs that back this field
--                            e.g. ["w_0012"] or ["w_0020","w_0021","w_0022"]
--   combined_bbox jsonb    — [x0,y0,x1,y1] union bbox when ocr_ids.length > 1
--
-- These columns are nullable — pre-v6 rows keep NULL (no migration of old data).

ALTER TABLE public.extracted_fields
  ADD COLUMN IF NOT EXISTS ocr_ids      jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS combined_bbox jsonb DEFAULT NULL;

COMMENT ON COLUMN public.extracted_fields.ocr_ids IS
  'Array of OCR token IDs (OcrWord.id / OcrLine.id) from the Google Vision result that map to this field value. NULL for pre-v6 extractions.';

COMMENT ON COLUMN public.extracted_fields.combined_bbox IS
  'Union bounding box [x0,y0,x1,y1] normalised 0-1 when multiple OCR tokens were combined. NULL for single-token or missing-bbox fields.';

-- Also widen the audit_logs event_type CHECK to include v6 events
-- (safe to run even if the constraint was already widened in a prior migration)
DO $$
BEGIN
  -- Drop old constraint if it exists (idempotent)
  ALTER TABLE public.audit_logs
    DROP CONSTRAINT IF EXISTS audit_logs_event_type_check;

  -- Recreate with all known event types
  ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_event_type_check CHECK (event_type IN (
      -- session lifecycle
      'session_created', 'session_deleted',
      -- upload
      'document_uploaded', 'document_upload_failed',
      -- OCR / extraction (v5 + v6)
      'ocr_started', 'ocr_completed', 'ocr_failed',
      'ocr_retake_required', 'extraction_completed',
      'extraction_manual_review_required',
      -- review
      'field_confirmed', 'field_corrected', 'field_reviewed',
      'render_blocked_completeness_audit',
      -- certification
      'certification_created', 'certification_updated',
      -- payment
      'payment_initiated', 'payment_confirmed', 'payment_failed',
      -- render / delivery
      'pdf_rendered', 'pdf_downloaded', 'email_sent',
      -- admin
      'admin_review_started', 'admin_review_completed',
      'manual_review_required', 'manual_review_completed'
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- constraint already exists with this name
END;
$$;
