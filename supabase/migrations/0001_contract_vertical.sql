-- ⛔ DO NOT RUN WITHOUT OWNER APPROVAL — Supabase is intentionally disconnected.
-- This migration is a FILE-ONLY artifact for the birth-certificate contract vertical.
-- Apply ONLY via the owner-run sequence in docs/architecture/SUPABASE_CONNECTION_PLAN.md
-- against a STAGING project (never production). See data-minimization rules there.

-- translation_sessions ──────────────────────────────────────────────────────────
create table if not exists translation_sessions (
  session_id text primary key,
  doc_type text not null,
  status text not null,
  scope_title text,
  payment_confirmed boolean not null default false,
  owner_uid uuid,                              -- RLS ownership
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- extracted_fields (raw immutable; corrections write normalized/confirmed only) ───
create table if not exists extracted_fields (
  id bigint generated always as identity primary key,
  session_id text not null references translation_sessions(session_id) on delete cascade,
  field text not null,
  raw_value text,                              -- original script; IMMUTABLE by policy
  normalized_value text,
  translated_value text,
  confirmed boolean not null default false,
  confirmed_at timestamptz,
  review_required boolean not null default true,
  evidence_type text,
  unique (session_id, field)
);
create index if not exists idx_extracted_fields_session on extracted_fields(session_id);

-- pdf_artifacts (hash + metadata; bytes live in a Storage bucket) ────────────────
create table if not exists pdf_artifacts (
  session_id text not null references translation_sessions(session_id) on delete cascade,
  kind text not null check (kind in ('mirror','generic')),
  sha256 text not null,
  byte_length integer not null,
  created_at timestamptz not null default now(),
  primary key (session_id)
);

-- audit_logs (PII-FREE detail only) ──────────────────────────────────────────────
create table if not exists audit_logs (
  id bigint generated always as identity primary key,
  session_id text not null,
  event_type text not null,
  at timestamptz not null default now(),
  detail jsonb                                 -- field KEYS / states / categories ONLY
);
create index if not exists idx_audit_session_at on audit_logs(session_id, at);

-- RLS (enable + owner-scoped) ─────────────────────────────────────────────────────
alter table translation_sessions enable row level security;
alter table extracted_fields enable row level security;
alter table pdf_artifacts enable row level security;
alter table audit_logs enable row level security;

-- Owner can read/write only their own session rows. Service role bypasses RLS.
create policy sessions_owner on translation_sessions
  using (owner_uid = auth.uid()) with check (owner_uid = auth.uid());
create policy fields_owner on extracted_fields
  using (session_id in (select session_id from translation_sessions where owner_uid = auth.uid()));
-- raw_value immutability is enforced at the application layer (corrections never
-- write raw_value) AND should be backed by a column-level update policy / trigger.

-- ⛔ END — DO NOT RUN WITHOUT OWNER APPROVAL.
