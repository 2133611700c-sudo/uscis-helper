-- ============================================================
-- AUTO-GRANT EVENT TRIGGER — Supabase Oct 30 2026 Fix
-- ============================================================
-- Problem: After Oct 30 2026, new tables in 'public' schema
-- will NOT be exposed to Data API (PostgREST/supabase-js)
-- by default. Any CREATE TABLE requires explicit GRANT.
--
-- Solution: This event trigger fires automatically on every
-- CREATE TABLE in public schema and grants anon + authenticated
-- access immediately. Zero manual action needed ever again.
--
-- Applied to DB: 2026-05-27
-- ============================================================

-- Step 1: Explicit grants for all EXISTING tables (pre-Oct 30 safety net)
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.profiles,
  public.form_sessions,
  public.form_answers,
  public.form_editions,
  public.generated_packets,
  public.audit_log,
  public.audit_logs,
  public.canonical_answers,
  public.official_sources,
  public.certification_records,
  public.manual_answers,
  public.manual_review_queue,
  public.manual_review_events,
  public.session_documents,
  public.session_members,
  public.extracted_fields,
  public.extraction_runs,
  public.numeric_evidence,
  public.user_corrections,
  public.assistant_threads,
  public.wizard_sessions,
  public.translations_orders,
  public.translation_orders,
  public.translation_sessions,
  public.translation_documents,
  public.translation_events,
  public.translation_payments,
  public.translation_quality_log,
  public.final_renders,
  public.tps_ocr_audit,
  public.monitoring_alerts,
  public.monitoring_sources,
  public.dead_links_log,
  public.email_events
TO anon, authenticated;

-- Step 2: Event trigger — auto-grant on every future CREATE TABLE
CREATE OR REPLACE FUNCTION public.auto_grant_on_new_table()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN
    SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag = 'CREATE TABLE'
      AND schema_name = 'public'
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO anon, authenticated',
      obj.object_identity
    );
  END LOOP;
END;
$$;

DROP EVENT TRIGGER IF EXISTS auto_grant_public_tables;

CREATE EVENT TRIGGER auto_grant_public_tables
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION public.auto_grant_on_new_table();
