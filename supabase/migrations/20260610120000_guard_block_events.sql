-- L1 observability: PII-free guard-block event trail for rate-alert baseline.
-- One row per gate rejection. NO field names, NO values — gate + failure_type +
-- doc_type + session_id only. Populated only when GUARD_BLOCK_METRICS_ENABLED=1.

create table if not exists public.guard_block_events (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  gate          text        not null,          -- e.g. confirmed_value_guard | ocr_field_safety
  failure_type  text        not null,          -- e.g. user_input_invalid | guard_block
  doc_type      text,                          -- nullable, PII-free doc type id
  session_id    text                           -- nullable, PII-free correlation id
);

create index if not exists idx_gbe_created_at
  on public.guard_block_events (created_at desc);
create index if not exists idx_gbe_gate_failure
  on public.guard_block_events (gate, failure_type, created_at desc);

alter table public.guard_block_events enable row level security;
create policy "service_role_only"
  on public.guard_block_events
  for all
  using (auth.role() = 'service_role');

comment on table public.guard_block_events is
  'PII-free guard-block audit trail (L1 rate-alert baseline). gate + failure_type + doc_type + session only.';

-- Escalation suppression for the L1 escalation timer: remember the last stage we
-- alerted for an open manual-review ticket so the cron does not re-fire a stage.
alter table public.manual_review_queue
  add column if not exists last_alert_stage text,      -- 'created' | 'second_alert' | 'third_channel'
  add column if not exists last_alerted_at  timestamptz;
