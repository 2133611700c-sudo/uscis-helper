# Supabase Connection Plan (birth-certificate vertical)

> ⛔ **DO NOT RUN WITHOUT OWNER APPROVAL.** Supabase is intentionally **disconnected**.
> Nothing here is applied. The runtime uses the in-memory repository
> (`apps/web/src/lib/repositories/`) by default; the Supabase adapter is a
> fail-closed stub until the owner wires + approves it.

## Why disconnected now
The product is **CODE COMPLETE — READY FOR DATABASE-BACKED STAGING VALIDATION**.
Persistence is behind `RepositoryBundle` interfaces. Connecting Supabase is the
owner's deliberate, supervised step (real DB, RLS, secrets) — not an agent action.

## Repository → table mapping (proposed)
| Interface | Table | Notes |
|---|---|---|
| DocumentRepository | `translation_sessions` | session_id PK, doc_type, status, scope_title, payment_confirmed, created_at, updated_at |
| ReviewRepository / ConfirmationRepository | `extracted_fields` | (session_id, field) unique; raw_value, normalized_value, confirmed, confirmed_at, review_required, evidence_type |
| TranslationRepository | `extracted_fields.translated_value` (new col) OR `translated_values` | translated layer kept separate from raw/normalized |
| PdfArtifactRepository | `pdf_artifacts` | session_id, kind, sha256, byte_length, created_at (store hash+metadata; bytes in Storage bucket) |
| AuditEventRepository | `audit_logs` | session_id, event_type, at, detail(jsonb, PII-FREE only) |

## Fields FORBIDDEN to store / log (data minimization)
- Never log: names, DOB, certificate series/number, full OCR text, document images, translated document contents.
- `audit_logs.detail` = PII-free only (field KEYS, states, error categories, model id, schema version, latency, anon correlation id).
- Raw document images → Storage bucket with short retention; never inline in a table.

## Encryption / RLS
- Encrypt at rest (Supabase default) + restrict Storage bucket to service role + signed URLs.
- **RLS:** every table row scoped by `session_id` ownership; a user reads/writes only their own session (auth.uid() → session owner map). Service-role used only server-side.
- `extracted_fields.raw_value` is append/immutable by policy (no client UPDATE of raw); corrections write `normalized_value`/`confirmed_*` only.

## Indexes
- `extracted_fields (session_id)`, unique `(session_id, field)`.
- `audit_logs (session_id, at)`.
- `pdf_artifacts (session_id)`.

## Ownership / lifecycle / retention
- Owner = the authenticated user that created the session.
- Retention: extracted_fields + images purged N days after delivery (owner sets N); audit_logs retained longer (PII-free).
- Deletion: a session delete cascades fields + artifacts + storage objects.

## Migrations (as files — NOT applied)
`supabase/migrations/0001_contract_vertical.sql` (DO NOT RUN) — creates the tables/
indexes/RLS above. Apply only via the connection sequence below, by the owner.

## Env var checklist (no real values here)
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`REPOSITORY_DRIVER=supabase` (opt-in). Validate with `lib/repositories/envValidation.ts`
(shape-only; no real secret values committed).

## EXACT connection sequence (owner-run, supervised)
```bash
# 1. point CLI at the staging project (NOT production)
supabase link --project-ref <STAGING_REF>
# 2. review + apply migrations (staging)
supabase db push                       # applies supabase/migrations/*
# 3. seed synthetic data ONLY (no PII)
psql "$STAGING_DB_URL" -f scripts/seed/synthetic-birth-cert.sql
# 4. wire the real Supabase adapter (replace supabaseAdapter.stub with the impl)
# 5. set env + opt-in driver
export REPOSITORY_DRIVER=supabase NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
# 6. validate
node -e "require('./apps/web/src/lib/repositories/envValidation').assertSupabaseEnv(process.env)"
# 7. run the repository CONTRACT TESTS against the real adapter (must pass identical suite)
# 8. run the DB-backed staging E2E (docs/runbooks/CONTRACT_STAGING_E2E_RUNBOOK.md)
```

## EXACT validation sequence
1. Repository contract suite green against the Supabase adapter.
2. RLS policy tests (a user cannot read another session).
3. raw-immutability test (client cannot overwrite raw_value).
4. DB-backed browser E2E PASS (review-contract.spec unskips).
5. PII-free audit log assertion.

## Rollback
Set `REPOSITORY_DRIVER` back to `in_memory` (or unset) → runtime reverts to in-memory;
no destructive change. Staging migrations are reversible (drop the added tables).

⛔ Again: **DO NOT RUN WITHOUT OWNER APPROVAL.** No production project, no production secrets.
