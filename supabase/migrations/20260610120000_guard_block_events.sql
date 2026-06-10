-- L1 observability: PII-free guard-block event trail for rate-alert baseline.
-- NOTE: the AUTHORITATIVE version was applied directly to prod by the owner
-- (migration "l1_observability_guard_block_events_and_alert_escalation"). This file
-- mirrors that applied schema so a fresh DB reproduces prod. Idempotent.
-- One row per gate rejection. NO field VALUES — gate_type + reason_code + field_name
-- + would_block + doc_type + session_id only.

create table if not exists public.guard_block_events (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  gate_type     text        not null,          -- confirmed_value_guard | ocr_field_safety
  doc_type      text,                          -- nullable, PII-free doc type id
  field_name    text,                          -- nullable, field NAME only (never value)
  reason_code   text        not null,          -- PII-free reason
  would_block   boolean     not null,          -- true in shadow (would have blocked); false when it blocked
  session_id    uuid                           -- nullable correlation id
);

create index if not exists idx_gbe_created_at
  on public.guard_block_events (created_at desc);
create index if not exists idx_gbe_gate_reason
  on public.guard_block_events (gate_type, reason_code, created_at desc);

alter table public.guard_block_events enable row level security;
-- service_role only (no client policy by design).

comment on table public.guard_block_events is
  'PII-free guard-block audit trail (L1 rate-alert baseline). gate + reason + field NAME + would_block only.';

-- Escalation suppression for the L1 escalation timer.
alter table public.manual_review_queue
  add column if not exists last_alert_stage text,      -- 'created' | 'second_alert' | 'third_channel'
  add column if not exists last_alerted_at  timestamptz;
