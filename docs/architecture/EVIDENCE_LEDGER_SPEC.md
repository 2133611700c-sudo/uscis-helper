# EVIDENCE_LEDGER_SPEC.md — Per-Final-Document Provenance Ledger

**Status:** CONSTITUTION DOC (required by ENGINEERING_MASTER_PLAN.md §4)
**Purpose:** Prove, for every signed PDF/ZIP we emit, that it was generated from the exact data the user confirmed — no re-extraction, no silent edit, no swap.
**Enforces:** Law 2 (no review snapshot → no final PDF) and Law 1 (no evidence → no field).

---

## 1. What the ledger is
One immutable row per **finalized document**, recording the full hash chain from raw upload to signed PDF plus the audit anchor. It is written **after** PDF generation and **before** the order is marked complete. If the ledger write fails, the order is DEGRADED (S2 hard-fail), never "complete".

## 2. The hash chain (the proof)

```
upload_hash ─▶ normalized_image_hash ─▶ canonical_result_hash ─▶ review_snapshot_hash ─▶ final_pdf_hash
                                                                          │
                                                                          └─▶ audit_id
```

Each link is verifiable independently:

| Link | Asserts |
|---|---|
| `upload_hash` → `normalized_image_hash` | The image we processed derives from the bytes the user uploaded (deskew/rotate only). |
| `normalized_image_hash` → `canonical_result_hash` | The canonical fields were extracted from that exact image. |
| `canonical_result_hash` → `review_snapshot_hash` | The frozen snapshot is the canonical object as the user confirmed it (edits captured, then frozen). |
| `review_snapshot_hash` → `final_pdf_hash` | The PDF was rendered from the frozen snapshot — re-hashing the snapshot used by the generator equals `review_snapshot_hash`. |
| → `audit_id` | A durable audit row exists for this finalization. |

**Proof statement the ledger lets us make:** "This `final_pdf_hash` was generated from `review_snapshot_hash`, which the user confirmed (2 checkboxes + signature), which froze `canonical_result_hash`, extracted from `normalized_image_hash`, derived from `upload_hash`." Any broken link = the PDF is not trustworthy and must not be delivered.

## 3. Ledger record shape

| Field | Type | Notes |
|---|---|---|
| `ledger_id` | uuid (pk) | One per finalized document. |
| `document_session_id` | uuid | Scope (see DOCUMENT_SESSION_CONTRACT). |
| `product` | enum | tps / translation / reparole / ead / bureau_pdf. |
| `doc_type` | enum | As finalized. |
| `upload_hash` | sha256 | = `file_hash` of raw upload. |
| `normalized_image_hash` | sha256 | Image actually OCR'd. |
| `canonical_result_hash` | sha256 | Serialized CanonicalDocumentResult. |
| `review_snapshot_hash` | sha256 | Frozen confirmed snapshot. |
| `final_pdf_hash` | sha256 | Signed PDF/ZIP bytes. |
| `audit_id` | uuid | FK to audit table. |
| `pdf_proof` | jsonb | Two-layer proof: `{ visual_png_hash, text_readback_ok, snapshot_match: true }`. |
| `source_versions` | jsonb | Pinned official-source ids/hashes used (KMU rule versions, KATOTTG, etc.). |
| `created_at` | timestamptz (UTC) | Write time. |
| `chain_valid` | bool | Set true only if all links recomputed and matched at write time. |

## 4. Where it is stored
- Primary: a dedicated table `evidence_ledger` (one row per finalized doc), with `pdf_proof` / `source_versions` as **jsonb** columns.
- The `audit` table holds the operational audit row; `evidence_ledger.audit_id` FKs into it.
- Both writes (audit + ledger) are required for completion. Either failing → DEGRADED / non-200 (S2).
- Append-only: ledger rows are never updated or deleted. A correction = a new finalization = a new `document_session_id` = a new ledger row.

## 5. Verification (how we prove it later)
A `verifyLedger(ledger_id)` check recomputes:
1. `final_pdf_hash` from stored PDF bytes == recorded.
2. The generator, fed `review_snapshot_hash`, would produce the recorded `final_pdf_hash` (deterministic render).
3. `pdf_proof.snapshot_match == true` and `text_readback_ok == true`.
4. `audit_id` resolves to a real audit row for the same `document_session_id`.
Any mismatch → `chain_valid=false` → document is repudiated, not delivered.

## 6. Acceptance
- Every finalized document has exactly one ledger row with all six hashes + `audit_id` + `chain_valid=true`.
- Tampering with the PDF after finalization fails `verifyLedger` (final_pdf_hash mismatch).
- Editing canonical after freeze cannot change `final_pdf_hash` (Law 2) — proven by snapshot→pdf link.
- Missing audit or ledger write blocks "complete" (S2).
