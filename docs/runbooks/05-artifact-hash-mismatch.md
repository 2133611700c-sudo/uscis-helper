# Runbook 5 — Artifact hash mismatch (CRITICAL)

## Symptoms
- `artifact_hash_mismatch_total > 0` (alert 3, paging).
- `downloadArtifactBytes` threw: stored bytes' sha256 ≠ the certified `artifact_sha256`.

This means the bytes in storage do NOT match the certification hash — tamper or corruption.
The certified PDF is the legal artifact; delivering mismatched bytes is unacceptable.

## Safe diagnosis (PII-free)
1. Identify by `internal_uuid` (artifact id) + `truncated_hash`. Never open the document.
2. The delivery worker already treats a mismatch as transient and re-verifies on retry; a
   persistent mismatch ages to permanent failure after MAX_ATTEMPTS — delivery is BLOCKED.

## Steps
1. BLOCK delivery for the affected order (the worker does this automatically — do not override).
2. QUARANTINE the suspect artifact: do NOT delete it, do NOT overwrite it. Leave the row and
   bytes for forensics (the row is immutable anyway).
3. Generate a NEW artifact VERSION via `approveForRender` (new `artifact_version`, new storage
   key). The new version NEVER overwrites the old.
4. The new version gets its own outbox row + idempotency_key and delivers the verified bytes.
5. Investigate the corruption source (storage, upload path) before closing.

## NEVER
- NEVER deliver bytes whose sha ≠ the stored `artifact_sha256`.
- NEVER overwrite or delete the quarantined artifact to "fix" it.
- NEVER edit `document_artifacts` (immutability trigger rejects UPDATE/DELETE).
