# OCR / Extraction / Contract Feature-Flag Matrix

**Stage-0, documentation-only.** This file enumerates every OCR / extraction / contract
feature flag, its default, its current effective state, what it gates, the exact
read-site, the acceptance gate that must pass before it may be enabled, and the
staged enable order.

> **Production posture (binding):** ALL production flags stay **OFF**. No flag may
> be enabled without (a) its acceptance gate passing on the owner's real documents
> **and** (b) explicit owner sign-off. Defaults below were confirmed read-only from
> the cited source lines; nothing here was inferred or invented.

---

## 1. Flag matrix

| Flag | Default | Current effective state | What it gates | Read-site (path:line) | Acceptance gate before enabling |
|---|---|---|---|---|---|
| `CONTENT_ORIENT_ENABLED` | **ON** (`env !== '0'`) | BUILT_AND_ON | Content-based orientation detection/correction before the read (overrides unreliable EXIF auto-rotate); costs `ORIENT_VOTE_RUNS` grid calls/doc (default 3). | `apps/web/src/lib/docintel/orientation/detectOrientation.ts:178,186` | Already enabled per owner decision 2026-06-27 (A/B on the real birth cert: OFF → 0/4 EXACT, ON → 2/4 EXACT). Keep `=0` kill-switch documented; re-measure if orientation regressions appear. |
| `FINAL_PDF_CONFIRMATION_GATE_ENABLED` | **OFF** (`=== '1'`) | BUILT_BUT_OFF | Server-side single confirmation boundary for the FINAL PDF: a final/preview-equivalent PDF may be emitted ONLY from a confirmed, validated, non-raw, server-persisted document. OFF → `{ready:true, enforced:false}` legacy passthrough (byte-identical golden). | `apps/web/src/lib/contracts/finalPdfGate.ts:7,24` | Stage 8 (last). Requires confirmation gate (stage 7), abstention enforcement (stage 6), and metrics (stage 4) all green first, plus golden-PDF byte-diff review + owner sign-off. |
| `OCR_FIELD_SAFETY_ENABLED` (C3) | **OFF** (`=== '1'`) | BUILT_BUT_OFF | Global OCR Field Safety Contract: an unsafe CRITICAL_IDENTITY value is moved to a separate candidate slot (`value→null`) and flagged review/manual; content never altered. OFF → caller skips entirely (byte-identical prod). | `apps/web/src/lib/documentSafety/applyOcrFieldSafety.ts:5,19-20` | Stage 6 (abstention enforcement). Requires metrics comparison (stage 4) showing the safety guard does not regress confirmed fields, plus a held-out negative set + owner sign-off. |
| `UNIFIED_DOC_CONTRACT_ENABLED` | **OFF** (`=== '1'`) | BUILT_BUT_OFF | Master switch for the unified document contract (birth-cert Soviet V1 path). | `apps/web/src/lib/contracts/birthCertSovietV1Contract.ts:299,302` (`isUnifiedDocContractEnabled`) | Stage 2–4 (OCR/layout shadow → metrics). Shadow-run the contract, diff field outputs vs legacy on real docs; no regressions + owner sign-off. |
| `UNIFIED_DOC_CONTRACT_SPLIT_ENABLED` | **OFF** (`=== '1'`) | BUILT_BUT_OFF | Strictly-additive split of merged fields (e.g. combined name/place into structured slots). | `apps/web/src/lib/contracts/splitMergedFields.ts:12,29` | Stage 3–4. Split must be additive-only (raw untouched); diff confirms no field loss on real docs + owner sign-off. |
| `UNIFIED_DOC_CONTRACT_NORMALIZE_ENABLED` | **OFF** (`=== '1'`) | BUILT_BUT_OFF | Runs split + writes the NORMALIZED/TRANSLATED English layer into `value` (raw_cyrillic stays RAW). | `apps/web/src/lib/contracts/contractFieldFlow.ts:102,113` | Stage 4–5. Requires split (stage 3) green; normalization reviewed against KMU-55/dictionary; confirmed value remains the review layer + owner sign-off. |
| `REPOSITORY_DRIVER` | **`in_memory`** (`supabase` opt-in only) | EXTERNAL_BLOCKED (supabase path is a stub) | Selects persistence backend; `'supabase'` → `createSupabaseRepositoriesStub()`, otherwise in-memory. | `apps/web/src/lib/repositories/index.ts:15,17,19,30` (`resolveRepositoryDriver`) | Not part of the OCR enable ladder. Switch only when the real Supabase adapter (not stub) is implemented + migration/RLS verified + owner sign-off. |
| `MIRROR_PDF_ENABLED` | **OFF** (`=== '1'`), BUT birth-cert + other listed doc types are mirror-on by default via `MIRROR_READY_DOCTYPES` | BUILT_AND_ON (for `MIRROR_READY_DOCTYPES` only) | Renders the official mirror-layout PDF when an official schema exists; fail-open to the generic table on any error. Default-on doc types: `ua_birth_certificate`, `ua_marriage_certificate`, `ua_divorce_certificate`, `ua_death_certificate`, `ua_name_change_certificate`, `ua_internal_passport_booklet`, `ua_international_passport`, `ua_id_card`. | `apps/web/src/app/api/translation/generate-pdf/route.ts:417,427-435` | For doc types NOT in `MIRROR_READY_DOCTYPES`: eyeball mirror layout vs official schema, verify key mapping, owner sign-off before adding to the set / setting `=1`. (Note: mirror PDF interacts with the stage-8 final-PDF gate.) |
| `isForensicEnabled` (`FORENSIC_LOG_ENABLED`) | **OFF** (`=== '1'`) | BUILT_BUT_OFF | PII-free forensic diagnostics (run_id, sha256, dims, orientation, model, stage, latency, field NAMES, HASHED values). Fail-open: a forensic error never alters/breaks the read. | `apps/web/src/lib/docintel/forensics.ts:23` | Stage 1 (diagnostics-only) — the first flag to enable. Confirm log digest is PII-free (no raw names/photos/keys) on real docs + owner sign-off. |

---

## 2. Correct staged enable ORDER

Each stage is enabled ONLY after the prior stage's acceptance gate passes on the
owner's real documents **and** the owner signs off. Production flags stay OFF until
their stage is reached.

1. **Diagnostics-only** — `FORENSIC_LOG_ENABLED`. Observe without changing any read.
   Gate: log digest verified PII-free on real docs.
2. **OCR / layout shadow** — `UNIFIED_DOC_CONTRACT_ENABLED` (shadow). Run the unified
   contract alongside legacy, emit nothing user-facing. Gate: no field-output divergence.
3. **Bbox evidence shadow** — `UNIFIED_DOC_CONTRACT_SPLIT_ENABLED` (additive split,
   shadow). Gate: split is strictly additive, raw untouched, no field loss.
4. **Metrics comparison** — `UNIFIED_DOC_CONTRACT_NORMALIZE_ENABLED` measured vs
   legacy; aggregate EXACT/PARTIAL/WRONG/EMPTY metrics on real docs. Gate: no
   regression vs the legacy baseline.
5. **Review UI evidence display** — surface contract/split/normalize evidence in the
   review UI (read-only display). Gate: reviewer can see raw vs normalized + candidates.
6. **Abstention enforcement** — `OCR_FIELD_SAFETY_ENABLED` (C3). Unsafe critical
   values abstain (`value→null`) + force review. Gate: held-out negatives abstain;
   confirmed fields not regressed.
7. **Confirmation gate** — require server-persisted `confirmed` state before a document
   is eligible for final output. Gate: client cannot forge `confirmed`; server-side path proven.
8. **Final PDF gate** — `FINAL_PDF_CONFIRMATION_GATE_ENABLED`. Only confirmed,
   validated, non-raw documents may emit a final/preview-equivalent PDF. Gate: golden
   PDF byte-diff reviewed; interacts with `MIRROR_PDF_ENABLED` renderers.

(`CONTENT_ORIENT_ENABLED` already ON per owner 2026-06-27; `REPOSITORY_DRIVER` is
infra, not on this OCR ladder — switch only when a real Supabase adapter exists.)

---

## 3. Classification summary

- **BUILT_AND_ON:** `CONTENT_ORIENT_ENABLED`; `MIRROR_PDF_ENABLED` (for `MIRROR_READY_DOCTYPES` only).
- **BUILT_BUT_OFF:** `FINAL_PDF_CONFIRMATION_GATE_ENABLED`, `OCR_FIELD_SAFETY_ENABLED`,
  `UNIFIED_DOC_CONTRACT_ENABLED`, `UNIFIED_DOC_CONTRACT_SPLIT_ENABLED`,
  `UNIFIED_DOC_CONTRACT_NORMALIZE_ENABLED`, `FORENSIC_LOG_ENABLED`.
- **EXTERNAL_BLOCKED:** `REPOSITORY_DRIVER` (the `supabase` path resolves to
  `createSupabaseRepositoriesStub()` — a stub, not a real persistence backend).
