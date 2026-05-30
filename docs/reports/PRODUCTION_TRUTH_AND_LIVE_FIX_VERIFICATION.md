# Production Truth & Live-Fix Verification
**Date:** 2026-05-30 · Mode: zero-trust, no new features.

## status: **DEGRADED** (SHA truth resolved + fixes deployed; some items UNVERIFIED/BLOCKED — honest)

```
main_sha:        49da20e
healthz_sha:     49da20e   (5 consecutive fresh reads, all 49da20e)
vercel_prod_sha: 49da20e   (healthz served by the prod deployment)
sha_match:       true
```

## 1. SHA truth — PASS (contradiction explained)
- `origin/main` = local `main` = **49da20e**.
- `https://messenginfo.com/api/healthz` returns **49da20e** on 5/5 fresh cache-busted reads.
- The `56dcf07` the owner saw is an **OLDER commit** ("fix(tps): remove middle_name from booklet") that is an **ancestor of 49da20e** (part of the deployed build). It was a stale read — either a browser/CDN cache or a healthz read taken before the latest deploy propagated. **There is no current mismatch.**

## 2. Fixes present in the deployed artifact (main@49da20e) — PASS
Verified via `git show 49da20e:<file>` (the deployed build == this SHA):
- ✅ `garbageGuard.ts`, ✅ `attestation.ts`
- ✅ owner-mode (`/api/owner/status` in TranslateWizard), ✅ session isolation (`?paid=1` gate)
- ✅ garbage guard wired — Translation (2) + TPS (3)
- ✅ booklet orientation (`bookletFieldCount`, 4)
- ✅ audit DB insert (`translation_certification_audit`, 2), ✅ review-gate v2 (3)

## 3. DB audit live proof — **UNVERIFIED**
- The insert SHAPE is proven against the REAL schema (controlled probe inserted into `translation_orders` + `translation_certification_audit` and read back, then cleaned).
- BUT `translation_certification_audit` has **0 rows**, and `translation_orders` has only the **2 old rows from 2026-05-08**. **No full generation has occurred since the deploy**, so no route-written audit row exists yet.
- Per the rule: **UNVERIFIED, not PASS.** The first real owner-mode sign+download will create a row; re-query then. (I cannot trigger the route here without the owner cookie/payment, which gate before the DB write.)

## 4. Translation stale-data — PASS (code + test)
- Deployed code restores `extractedFields` ONLY on `?paid=1` (Stripe return); a fresh visit starts clean. `handleFiles` clears fields on a new upload. `sessionIsolation.test.ts` 2/2.
- A fresh-browser end-to-end was not run headless (no DOM/browser driver), but the deployed code path guarantees no stale restore on a plain visit.

## 5. TPS stale-data — **DEGRADED**
- Garbage values are dropped on localStorage hydration, but the TPS wizard still restores full upload state by design (refresh resilience) and has **no per-`documentSessionId` isolation**. Per the owner's criterion, this is **DEGRADED** until a document-session id invalidates prior fields.

## 6. Garbage guard live — PASS (code + test)
- `garbageGuard.test.ts` 4/4 — rejects `„ Пріз` (quote+label), bare labels, punctuation-only, too-short. Wired into Translation (extract → empty + review) and TPS (merge + hydration). Deployed.

## 7. Orientation auto-rotate — **BLOCKED (live)**
- Code deployed (additive: rotate booklet, pick rotation with most identity fields; passport MRZ path untouched). tsc 0, TPS 370 pass.
- **Cannot verify with a live rotated booklet image** in this environment (no upload). **BLOCKED until the owner uploads a real rotated photo** (or provides a fixture in `test-fixtures/`).

## 8. Source-evidence gate — **FAIL / not implemented**
- Fields are not yet required to carry `documentSessionId` + upload-slot + method + bbox/page metadata before being labelled "recognized". This is **not implemented** → marked FAIL per the criterion. (Garbage guard + session isolation mitigate the symptom, but the formal evidence contract is absent.)

## 9. Payment/signature safety on unsafe fields — **DEGRADED (by design)**
- The Translation wizard intentionally allows payment when OCR fails ("manual review after payment" business model), so there is no hard payment-block on missing identity fields. Safety is provided by the garbage guard (no garbage shown) + the review gate (signature + checkboxes + name + address required before the certified PDF). A dedicated "block on unsafe" is not implemented.

## Output contract
```
status:                 DEGRADED
main_sha:               49da20e
healthz_sha:            49da20e
vercel_prod_sha:        49da20e
sha_match:              true
db_audit_result:        UNVERIFIED (shape proven via probe; 0 real rows — no generation since deploy)
translation_stale_result: PASS (code + sessionIsolation 2/2)
tps_stale_result:       DEGRADED (garbage-drop only; no per-doc-session id)
garbage_guard_result:   PASS (garbageGuard 4/4, wired both wizards)
orientation_result:     BLOCKED (deployed; needs live rotated photo)
source_evidence_result: FAIL (not implemented)
payment_block_result:   DEGRADED (manual-review model; review gate + garbage guard mitigate)
tests_run:              garbageGuard 4/4 · sessionIsolation 2/2 · ownerMode 3/3 · attestation 5/5 · TPS 370 · full web pass · tsc 0 · guard 0
remaining_blockers:     DB audit live row (await first real generation); orientation live photo (owner); source-evidence gate + per-doc-session id (not implemented); birth visual approval + official URLs (owner)
next_action:            owner runs one owner-mode generation (creates an audit row to verify live) + uploads a rotated booklet to confirm orientation. Then: per-documentSessionId isolation + source-evidence gate.
```
