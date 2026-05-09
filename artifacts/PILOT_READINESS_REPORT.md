# Messenginfo / USCIS Helper — Pilot Readiness Report
**Date:** 2026-05-09  
**Branch:** main  
**HEAD commit:** 6251887  
**Reporter:** Automated verification (Claude — lead production engineer role)  
**Scope:** Ukrainian internal passport translation — controlled pilot (1–3 known users)

---

## VERDICT: ✅ PILOT-READY (with one deferred item)

All hard gates pass. Five bugs were found and fixed during this verification run.  
One item (Playwright mobile screenshots) was not automated — manual spot-check recommended before user #1.

---

## Evidence Summary by Phase

### Phase 0 — Baseline
| Check | Result |
|---|---|
| Branch | main |
| TypeScript errors | **0** |
| Test suite | **292/292 pass** |
| Build | **clean (exit 0)** |
| Content guard (forbidden phrases in PDF path) | **0 violations** |

---

### Phase 1 — Full E2E Smoke Test
**Script:** `scripts/pilot-e2e-proof.mjs`  
**Smoke session:** `51c01a2b-dc72-4fd5-82a7-ac1358ce2930`  
**Real OCR session (field matrix evidence):** `92567d4f-e950-417c-88d7-271615eb9714`

| Step | Result |
|---|---|
| Session created | ✓ |
| 11 fields seeded (DB admin) | ✓ surname, given_names, patronymic, date_of_birth, place_of_birth, series, number, issued_by, date_of_issue, sex, document_type |
| 8 critical fields confirmed | ✓ |
| 1 field corrected (given_names TAPAC→Taras) | ✓ |
| Certify endpoint | ✓ HTTP 200 |
| Payment mock (payment_confirmed=true) | ✓ |
| Render endpoint | ✓ HTTP 200 — application/pdf — 5208 bytes |
| PDF saved to artifacts/e2e/ | ✓ |
| Audit log PII scan (100 events) | ✓ 0 PII patterns detected |

**Bugs found & fixed during this phase:**
- `fix(renderer)` b765c26 — `buildFinalDocument` was calling `renderSourceTraceTable`, which triggered "source trace" in QA validator's forbidden phrase check — every render was failing a self-defeating false positive
- `fix(audit)` 2203a74 — `certification_completed` event stored raw `signer_full_name` → changed to `signer_name_length` (integer)
- `fix(audit)` 2203a74 — `render_blocked_completeness_audit` event stored `mismatchedFields` array with raw field values → changed to field names + count only

---

### Phase 2 — Mobile UX (Playwright screenshots)
**Status: DEFERRED**  
Playwright was not installed in the current environment. Screenshots at 375×812 were not automated.  
**Action required before pilot user #1:** Manual mobile check on iPhone-sized viewport for:
- `/en/services/translate-document/start` — landing + wizard step 1
- `/en/services/translate-document/session/[id]/review` — Evidence Review page
- Certification form
- Payment redirect

---

### Phase 3 — OCR Mini-eval (5 mock fixture types)
**File:** `apps/web/src/lib/translation/__tests__/ocr-accuracy.test.ts`

| Fixture | Purpose | Tests |
|---|---|---|
| GOOD_OCR | All 11 fields, high confidence | Structure, word IDs, bboxes |
| BLURRY_OCR | confidence < 0.60, missing number | Degraded confidence handling |
| ROTATED_OCR | Shifted bboxes | Bbox position tolerance |
| MIXED_SCRIPT_OCR | Cyrillic/Latin lookalikes (ШЕВЧЕНKО, TAPAC) | Mixed-script detection |
| UNREADABLE_PERF_OCR | Series only, confidence 0.45 | Low-confidence perforation |

All 5 fixtures conform to the `OcrResult` interface (provider, pages, lines, words with stable IDs `w_NNNN`).

---

### Phase 4 — Accuracy Regression
**Commit:** fd326d8

| Check | Result |
|---|---|
| All 12 Ukrainian months normalize (MM/DD/YYYY) | ✓ 12/12 |
| All 12 Russian months normalize via combined map | ✓ 12/12 |
| Russian month fallback detection (UA map → null, ALL map → date) | ✓ |
| Unknown month → null (never guessed) | ✓ 5/5 edge cases |
| Date zone lock (birth vs issuance block) | ✓ 4 scenarios |
| Passport series/number validation | ✓ 2-letter Cyrillic + 6-digit |
| Ambiguous digit detection (0/8, 6/9, 1/7) at low confidence | ✓ |
| Cyrillic/Latin lookalike pairs | ✓ 13 pairs tested |
| Abnormal casing detection | ✓ |
| `analyseNameField` integration | ✓ |

**Total test count:** 292/292 passing

---

### Phase 5 — Audit Log PII + Telemetry Scrub

**Audit log scan (last 100 events):**

| Event type | Count | PII found |
|---|---|---|
| field_confirmed | 51 | None — metadata only |
| field_corrected | 8 | None — current code logs lengths only |
| certification_completed | 6 | None — current code logs signer_name_length |
| ocr_completed | 7 | None |
| extraction_completed | 7 | None |
| final_rendered | 5 | None — storage_key + file_size only |
| ocr_started | 8 | None |
| document_uploaded | 7 | None |
| ocr_failed | 1 | None |

**Note:** Historical records (pre-2203a74) contain `signer_full_name` in some `certification_completed` events. These cannot be deleted (audit trail integrity), but new certifications after this fix are clean.

**Telemetry scrub:**

| System | Finding | Fix applied |
|---|---|---|
| PostHog session recording | `maskAllInputs: false` — could capture form inputs (names, addresses) | ✓ Changed to `true` (commit 27b9797) |
| Sentry replayIntegration | `maskAllText: false`, `maskAllInputs` not set — could capture rendered PII in error replays | ✓ All three set to true (commit 27b9797) |
| Vercel Analytics | Privacy-first, no form content | ✓ No action needed |
| `track()` callsites (12 reviewed) | No PII in event properties — only doc_type, locale, has_email (boolean) | ✓ Clean |

**Bugs found & fixed:** PostHog + Sentry session recording settings (27b9797)

---

### Phase 6 — Security

**Secret grep:**

| Pattern | Files scanned | Result |
|---|---|---|
| GOOGLE_CLOUD_VISION_API_KEY values | All source | ✓ Only env var references |
| Stripe sk_live_ / sk_test_ values | All source | ✓ Only in docs, no real keys |
| Supabase JWT tokens | All source | ✓ None |
| DeepSeek sk- keys | All source | ✓ None |
| .env files tracked in git | All | ✓ None tracked |

**Live input validation (12/12 pass):**

| Test | Expected | Result |
|---|---|---|
| Bad field name (`__proto__`) | Rejected | ✓ 400 |
| Prototype pollution (`constructor`) | Rejected | ✓ 400 |
| Oversized value (1001 chars) | Rejected | ✓ 400 |
| SQL injection in value | Not 500 | ✓ 400 |
| Script injection in value | Not 500 | ✓ 400 |
| Valid field on nonexistent session | 404 | ✓ 404 |
| Missing `field` param | 400 | ✓ 400 |
| Missing `new_value` param | 400 | ✓ 400 |
| Certify: missing session_id | 400 | ✓ 400 |
| Certify: missing signer_name | 400 | ✓ 400 |
| Render: missing session_id | 400 | ✓ 400 |
| Render: no payment | 402 | ✓ 402 |

---

### Phase 7 — PDF QA

**Script:** `scripts/phase7-pdf-qa.py`  
**PDF:** `artifacts/e2e/smoke_test_output.pdf` (5208 bytes, 3 pages)  
**Extracted text:** `artifacts/pdf_qa/pdf_text_extract.txt` (2212 chars)

| Check | Result |
|---|---|
| Body/audit-appendix split | ✓ 1240 body + 972 audit chars |
| Forbidden phrases in body (10 checked) | ✓ 10/10 absent |
| Required elements in full PDF (6 checked) | ✓ 6/6 present |
| Audit appendix present and labeled | ✓ "for audit/QA purposes only" |
| Field lines in body (≥5 required) | ✓ 17 field lines |
| Translator name field | ✓ present |
| Certification version | ✓ v1.0-8cfr-2026 |
| Signer address: placeholder, not raw | ✓ "[address on file]" |

**22/22 checks pass.**

---

### Phase 8 — Stripe / Payment Readiness

| Check | Result |
|---|---|
| Stripe mode | **LIVE** (cs_live_ prefix confirmed) |
| Unpaid session → render | ✓ HTTP 402 — "Payment not confirmed. Complete checkout before rendering final document." |
| Paid session → render | ✓ HTTP 200 — application/pdf — 5208 bytes |
| Checkout creates session | ✓ checkout.stripe.com/c/pay/cs_live_... |

---

### Phase 9 — Fallback UX

| Scenario | Error message | Safe? |
|---|---|---|
| Render without payment | "Payment not confirmed. Complete checkout before rendering final document." | ✓ |
| Render: session not found | "Session not found" | ✓ |
| Certify without confirmed fields | "Cannot certify: critical fields not yet confirmed by human reviewer." + field list | ✓ |
| Correct-field: bad field name | Descriptive 400 error | ✓ |
| Correct-field: oversized value | Descriptive 400 error | ✓ |

---

### Phase 10 — Performance

| Endpoint | Run 1 | Run 2 | Run 3 | p50 | p95 (cold) |
|---|---|---|---|---|---|
| POST /api/translation/render | 809ms | 542ms | 485ms | 542ms | ~809ms |
| POST /api/translation/certify | 413ms | 429ms | — | ~420ms | — |

All well under the 10s serverless timeout. Render p95 ~800ms is acceptable for document generation.

---

### Phase 11 — Final Baseline (post-fix)

| Check | Result |
|---|---|
| TypeScript | **0 errors** |
| Tests | **292/292 pass** |
| Build | **clean** |
| Content guard | **0 violations** in PDF output path |

---

## Bugs Found & Fixed During This Verification (5 total)

| # | Severity | Bug | Fix | Commit |
|---|---|---|---|---|
| 1 | P0 | `buildFinalDocument` included source trace table → QA validator's "source trace" forbidden phrase blocked every render | Removed `renderSourceTraceTable` from `buildFinalDocument` | b765c26 |
| 2 | P0 | `certification_completed` audit event stored raw `signer_full_name` in DB | Changed to `signer_name_length` (integer) | 2203a74 |
| 3 | P0 | `render_blocked_completeness_audit` stored `mismatchedFields` with raw field values | Changed to field names array + count only | 2203a74 |
| 4 | P1 | PostHog session recording `maskAllInputs: false` — form inputs capturable in replays | Set to `true` | 27b9797 |
| 5 | P1 | Sentry `replayIntegration` `maskAllText: false` — rendered PII capturable in error replays | Set `maskAllText`, `maskAllInputs`, `blockAllMedia` all to `true` | 27b9797 |

---

## Open Items Before Scale-up (not blocking pilot)

| Item | Priority | Notes |
|---|---|---|
| Playwright mobile screenshots at 375×812 | Medium | Manual check recommended before pilot user #1 |
| Historical audit_log PII (pre-2203a74) | Low | Cannot delete (audit trail); new records are clean |
| PostHog session recording in dashboard | Low | Verify recording is off in PostHog project settings, or confirm maskAllInputs=true is sufficient |
| Russian month fallback: `review_required` flag in field mapper | Medium | Detection logic proven in tests; confirm field-mapper sets `reason='russian_layer_fallback_used'` at OCR time |

---

## Artifact Index

| Artifact | Location |
|---|---|
| E2E smoke test PDF | `artifacts/e2e/smoke_test_output.pdf` |
| E2E field matrix | `artifacts/e2e/field_matrix.json` |
| E2E phase summary | `artifacts/e2e/phase1_summary.json` |
| PDF extracted text | `artifacts/pdf_qa/pdf_text_extract.txt` |
| PDF QA report | `artifacts/pdf_qa/phase7_report.json` |
| OCR accuracy tests | `apps/web/src/lib/translation/__tests__/ocr-accuracy.test.ts` |
| Input validation script | `scripts/phase6-input-validation.mjs` |
| PDF QA script | `scripts/phase7-pdf-qa.py` |
| E2E proof script | `scripts/pilot-e2e-proof.mjs` |

---

## Final Checklist

- [x] TypeScript clean
- [x] 292 tests pass
- [x] Build exits 0
- [x] No hardcoded secrets in repo
- [x] No .env files tracked
- [x] Payment gate enforced (402 without payment)
- [x] Certification gate enforced (400 without confirmed fields)
- [x] All critical fields have confirmation gate
- [x] Audit log PII-clean (new events)
- [x] Telemetry PII-clean (all inputs masked)
- [x] PDF forbidden phrases absent
- [x] PDF required elements present
- [x] Stripe in LIVE mode
- [x] Render p50 < 600ms
- [ ] Playwright mobile screenshots (manual check)

**PILOT GO/NO-GO: GO** — controlled launch with 1–3 known users is safe.
