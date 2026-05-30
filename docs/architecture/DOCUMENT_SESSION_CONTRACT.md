# DOCUMENT_SESSION_CONTRACT.md — The Single Lifecycle Contract

**Status:** CONSTITUTION DOC (required by ENGINEERING_MASTER_PLAN.md §4)
**Authority:** Binds every product (TPS / Translation / ReParole / EAD / BUREAU_PDF).
**Enforces Three Laws:** No evidence → no field · No review snapshot → no final PDF · One document → one CanonicalDocumentResult.

---

## 0. The three laws restated as session invariants
1. **One upload = one truth.** Each upload produces exactly one `document_session_id` and exactly one `CanonicalDocumentResult`. All products read that object — none re-run OCR/provider/render.
2. **No cross-product memory.** No field crosses a product boundary without matching `document_session_id` **and** `file_hash` **and** an explicit user action. No silent reuse of a prior upload's fields.
3. **No re-extraction after review.** Once a `review_snapshot_hash` is frozen, the final PDF/ZIP is generated only from that snapshot. No OCR/AI/normalizer runs after the snapshot.

---

## 1. Lifecycle (single canonical path)

```
upload → quality gate → OCR/provider (RAW) → vision candidates
  → quarantine → normalizers → safety guards
  → CanonicalDocumentResult → product adapter → review gate
  → reviewSnapshot (freeze) → payment/owner gate → finalization lock
  → final PDF/ZIP (from snapshot) → two-layer proof → evidence ledger + audit
```

Each arrow is a state transition. Each transition writes exactly one new ID/hash (below). No transition may skip backward except via **Reset** (§3).

---

## 2. IDs and hashes (canonical registry)

| ID / hash | Type | Created at | Derived from | Immutable after | Purpose |
|---|---|---|---|---|---|
| `upload_id` | uuid | upload accepted | — | creation | Identifies one raw upload event. |
| `file_hash` | sha256 (hex) | upload accepted | raw bytes of uploaded file | creation | Content identity; dedup; cross-product memory key. |
| `document_session_id` | uuid | upload accepted | new per upload | creation | Root of one truth. Everything below is scoped to it. |
| `normalized_image_hash` | sha256 | after quality gate | deskewed/rotated/normalized image bytes | creation | Identity of the image actually fed to OCR/vision. |
| `doc_type` | enum | after classification | anchor scoring on normalized image | review (can be corrected in review) | passport_book / passport_id_card / i94 / ead / dmv_dl / birth_cert / marriage_cert / divorce_decree / death_cert / name_change / `unknown_page`. |
| `page_type` | enum | after classification | per-page anchors | review | mrz_page / bio_page / visa_page / unknown_page. |
| `orientation` | enum + degrees | quality gate | rotation detection | normalized_image_hash freeze | up / 90 / 180 / 270; recorded as evidence. |
| `ocr_result_id` | uuid | OCR complete | normalized_image_hash + provider | creation | RAW provider output (untrusted DATA). |
| `canonical_result_id` | uuid | canonical built | ocr_result_id + vision + normalizers + guards | creation | The single truth object id. |
| `canonical_result_hash` | sha256 | canonical built | serialized CanonicalDocumentResult | creation | Ledger link; parity tests. |
| `review_result_id` | uuid | user opens review | canonical_result_id | creation | The review session over the canonical object. |
| `review_snapshot_hash` | sha256 | user confirms (freeze) | frozen field values + 2 checkboxes + signature + name+address | **forever** | The ONLY input allowed to PDF generation. |
| `final_pdf_id` | uuid | PDF generated | review_snapshot_hash | creation | The signed artifact id. |
| `final_pdf_hash` | sha256 | PDF generated | final PDF/ZIP bytes | creation | Two-layer proof + ledger. |
| `audit_id` | uuid | audit row written | all hashes above + outcome | creation | Hard-fail anchor (S2): no audit row → no "complete". |

**Rule:** every ID/hash is written **before** its consumer runs. A consumer that cannot find its required upstream ID/hash MUST stop and emit `review_required` or `BLOCKED` — never fabricate.

---

## 3. Reset rules (new upload → clean slate)

A **new upload** is any of: new file bytes (`file_hash` changes), user "Start over", or replacing a page in a multi-page set.

On reset, atomically:
1. Mint a **new** `document_session_id`. The old session is closed (read-only for audit).
2. **Clear all prior canonical fields** — no field from the old `document_session_id` is visible to the new one.
3. **Clear `tps:legal-risk:v1`** (per-session legal risk acknowledgment).
4. **Clear `tps:attest:v1`** (per-session attestation/checkbox/signature state).
5. Drop any in-flight `review_result_id`, `review_snapshot_hash`, `final_pdf_id` not yet finalized.
6. Re-run from quality gate. No carry-over of `doc_type`, `orientation`, or OCR.

These keys are **per-`document_session_id`**, never global, never per-user-forever.

---

## 4. Stale-state prevention

| Risk | Guard |
|---|---|
| Old fields shown for new upload | Fields are keyed by `document_session_id`; UI reads only the active session's canonical object. |
| PDF generated from edited-after-freeze data | PDF input is `review_snapshot_hash` only; generator re-hashes snapshot and rejects if it differs (Law 2). |
| Re-extraction after review | After `review_snapshot_hash` exists, OCR/vision/normalizer entrypoints are disabled for that session (Law 3). |
| Checkbox/signature leaking across uploads | `tps:legal-risk:v1` / `tps:attest:v1` cleared on every reset (§3.3–3.4). |
| Cross-product field leak | Product adapter requires matching `document_session_id` + `file_hash` + explicit action before reading a field (Law/No cross-product memory). |
| Provider candidate treated as truth | Candidates live in quarantine until guards pass; only canonical fields are user-visible. |
| Wrong page accepted | `page_type=unknown_page` / `doc_type=unknown_page` blocks recognized fields → ask better photo. |

---

## 5. Acceptance (what proves this contract holds)
- Reset test: new upload mints new `document_session_id`, old fields gone, `tps:legal-risk:v1` + `tps:attest:v1` cleared.
- Snapshot test: editing a field after freeze does not change the PDF; generator rejects hash mismatch.
- No-re-extraction test: OCR/vision entrypoints return disabled after snapshot freeze.
- Cross-product test: a TPS field is not visible to Translation without matching session+hash+action.
- Audit test (S2): missing `audit_id` write → non-200 / DEGRADED, never "complete".
