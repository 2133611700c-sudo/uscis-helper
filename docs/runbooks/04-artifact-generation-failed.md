# Runbook 4 — Artifact generation failed

## Symptoms
- `approveForRender` returns 503/409; order stuck in `approved_for_render` with no artifact.
- Alert 7 (order ready but artifact missing) or `artifact_generation_failures_total` /
  `artifact_storage_failures_total` elevated.

## Safe diagnosis (PII-free)
1. `artifact_generation_failures_total{error_code}`:
   - `SIGNER_NOT_CONFIGURED` → operator signer env missing (precondition, not infra).
   - `CANONICAL_NOT_FOUND` → the bound canonical is gone/unreadable.
   - `artifact_generation_failed` → render error.
2. `artifact_storage_failures_total{error_code=artifact_upload_failed}` → bucket upload failed.

## Steps
1. Signer not configured → set the signer config; re-run `approveForRender`.
2. Storage upload failed → check the `translation-artifacts` bucket / Supabase storage health,
   then re-run. The storage key is content-addressed (`<orderId>/<sha>.pdf`) and the upload is
   `upsert:true`, so a re-run is a safe no-op overwrite of identical bytes.
3. `createArtifactAndEnqueue` runs ONE transaction (artifact + transition + outbox). A failure
   rolls back fully — there is NO orphan outbox row. Just re-run the action.
4. Idempotency: the idempotency_key is `sha256(orderId:artifactSha256)`, so a duplicate
   approve produces the same key and cannot double-enqueue.

## NEVER
- NEVER hand-insert a `document_artifacts` row (immutability trigger will reject UPDATE/DELETE
  anyway).
- NEVER hand-create a `delivery_outbox` row — let the transaction do it.
- NEVER re-render with different bytes for the same artifact version.
