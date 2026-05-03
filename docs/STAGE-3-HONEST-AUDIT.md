# Stage 3 Honest Audit — 2026-05-03

Auditor: Claude Code (stage-4-honest-audit branch)
All evidence is from live command output — no paraphrasing.

---

## Sample Packet Bug Analysis

The packet route is `apps/web/src/app/api/packet/generate/route.ts`.
The route does NOT call `generateFullPacket()` from `apps/web/src/lib/packet/index.ts` (that lib is for TRANSLATION orders only — PDF/DOCX translation certificates). Re-parole packet is a separate in-route ZIP builder using JSZip directly.

Live test: POST `/api/packet/generate` with session `65b7fdab-6de5-4d90-b25b-21e2133c2bab`.
Downloaded ZIP from signed Supabase URL and inspected with `unzip -p`.

| Issue | Evidence | Status |
|-------|----------|--------|
| Hardcoded $580/$630 | `grep -c '\$580\|\$630' checklist.txt` → 0 | NOT FOUND |
| File format | `file /tmp/packet-real.zip` → "Zip archive data, at least v1.0 to extract, compression method=deflate" | ZIP |
| ZIP contents | `unzip -l` → checklist.txt (2761 bytes) + README.txt (267 bytes) | 2 files |
| Filing-aware branching | `grep -n "filingMethod" route.ts:75` — `const method = state.filingMethod ?? 'unsure'`; MAIL and ONLINE branches are separate in `buildChecklistText()` | WORKS |
| MANUAL ANSWERS populated | `grep -c 'Kharkiv' checklist.txt` → 1; full "YOUR WRITTEN EXPLANATION" section with user text present | YES |
| Personal Explanation | "I came from Kharkiv in June 2024. My apartment was damaged by shelling." present in output | YES |
| Item 10.C mentioned | `grep -c '10\.C' checklist.txt` → 1 ("Part 1, Item 10.C — Re-parole Process...") | PRESENT |
| Item 1.e mentioned | `grep -c '1\.e' checklist.txt` → 0 | NOT PRESENT |
| feecalculator link | `grep -c 'feecalculator' checklist.txt` → 3 | PRESENT (3x) |
| 02/27/26 edition | `grep -c '02/27/26' checklist.txt` → 1 | PRESENT |
| Ukraine RE-PAROLE | `grep -c 'Ukraine RE-PAROLE' checklist.txt` → 2 | PRESENT |

**CRITICAL FACT CONFLICT: Item 10.C vs. 1.e**
Packet uses Item 10.C. The audit brief states: "OLD streamlined 'Ukrainian Re-Parole' option in online form ELIMINATED" and "The old Item 10.C was for old streamlined process — verify current official guidance."
The service data source comment (`re-parole-u4u.ts:9`) says: "Item 10.C confirmed: Ukraine Immigration Task Force + Nova Ukraine Refugee Portal" — citing external sources from 2025/2026.
The critical facts brief says Item 1.e is "new" and 10.C is "old." This conflict is UNRESOLVED — requires human verification against live USCIS form 02/27/26.

---

## Stage 3 Claims Verification

| # | Claim | Command | Output | Status |
|---|-------|---------|--------|--------|
| 1 | DeepSeek lib exists | `wc -l apps/web/src/lib/deepseek/client.ts` | 159 lines | VERIFIED — file exists; wraps `@uscis-helper/ai` `generateMiaAnswer`; also exports `chat()`, `reason()` types |
| 2 | OCR route exists | `ls apps/web/src/app/api/ocr/extract/` | route.ts (280 lines) | VERIFIED — route exists |
| 3 | Packet gen uses pdf-lib/docx/jszip | `grep -n "pdf-lib\|docx\|jszip" lib/packet/*.ts` | pdf.ts imports `pdf-lib`; docx.ts imports `docx`; zip.ts imports `jszip` | VERIFIED — but NOTE: these are for TRANSLATION packets only. Re-parole packet uses separate in-route JSZip (no PDF/DOCX) |
| 4 | Resend BCC | `grep -i "bcc" apps/web/src/lib/email/resend.ts` | `getBccAddress()` function; `bcc: bcc ? [bcc] : undefined` in sendEmail() | VERIFIED — BCC applied via `CONTACT_EMAIL_DESTINATION` env var |
| 5 | Supabase magic links | `ls apps/web/src/lib/supabase/auth.ts` → found; `ls apps/web/src/app/auth/callback/` → route.ts found | Both present | VERIFIED |
| 6 | Stripe TODO doc | `find docs -name "*stripe*"` → `docs/payments/STRIPE-INTEGRATION-TODO.md` | File exists; status: "NOT IMPLEMENTED — planned for after OCR + packet generation proven in production" | VERIFIED — doc exists with 5 explicit prerequisites before implementing |
| 7 | Health endpoint | `cat apps/web/src/app/api/health/route.ts` | Returns 9 fields: `ok, ts, db, wizard_sessions_ok, translation_orders_ok, canonical_answers_count, supabase_storage, deepseek_configured, resend_configured, stripe_configured` | VERIFIED — 9 fields match. BUT: `HEALTH_TOKEN` NOT in `.env.local` — `curl https://messenginfo.com/api/health` returns 404 (token required). Cannot verify live prod output. |
| 8 | PII scrubber | `grep -rn "scrubPII" apps/web/src/` | `pii.ts` (106 lines); called in `mia/chat/route.ts:36` before AI call | VERIFIED |
| 9 | Rate limiting | `cat apps/web/src/lib/security/rate-limit.ts` | File exists (154 lines); **@upstash NOT INSTALLED** (`ls node_modules/@upstash` → NOT FOUND; `grep upstash package.json` → not in package.json); uses in-memory fallback on Vercel (NOT shared across instances) | PARTIAL — code handles both KV and in-memory fallback, but @upstash is NOT installed. On Vercel serverless, in-memory rate limiting is per-instance only — NOT effective. Build warning expected if KV_URL not set. |
| 10 | canonical_answers 30 rows | `curl ... content-range` | `content-range: 0-0/30` | VERIFIED — exactly 30 rows |
| 11 | Mia live response | `curl POST https://messenginfo.com/api/mia/chat -d '{"message":"What edition..."}'` | `{"answer":"Use Form I-131 edition date **02/27/26**...","model":"deepseek-chat","disclaimer":"...not legal advice..."}` | VERIFIED — live, correct answer, real DeepSeek call |
| 12 | 96 static pages | `find apps/web/src -name "page.tsx" \| wc -l` | 12 page.tsx files found | FALSE — 12 page.tsx files, not 96. "96 static pages" claim was likely referring to next build output (locale × route combinations: 12 routes × ~8 locales/slugs = ~96). Build not run to confirm. Claim as stated (96 distinct page.tsx files) is FALSE. |

**Summary: 9 VERIFIED, 1 PARTIAL (rate limiting — no @upstash), 1 FALSE (96 page.tsx files), 1 UNRESOLVED (health endpoint live output)**

---

## End-to-End Test Results

- 3.1 Create session: **PASS** — `{"session_id":"65b7fdab-6de5-4d90-b25b-21e2133c2bab","locale":"en","service_slug":"re-parole-u4u","current_step":0}`
- 3.2 Save state: **PASS** (note: PATCH requires `session_id` in body, not URL param — API is correct but different from audit script assumption) — state_json with manualAnswers persisted
- 3.3 Restore — explanation persists: **YES** — `grep -c 'My apartment was damaged'` → 1
- 3.4 Packet format: **ZIP** (not TXT/PDF/DOCX) — `file /tmp/packet-real.zip` → "Zip archive data"
- 3.5 ZIP contents: `checklist.txt` (2761 bytes) + `README.txt` (267 bytes) — NO PDF, NO DOCX in re-parole packet
- 3.6 Audit log: `audit_log INSERT` fires on packet.generated (fire-and-forget, non-fatal)

---

## Production Live (messenginfo.com/en/services/re-parole-u4u)

Curl: `curl -s https://messenginfo.com/en/services/re-parole-u4u`

| Check | Count | Pass | Notes |
|-------|-------|------|-------|
| I-131 mentions | 3 | YES | - |
| 02/27/26 | 3 | YES (≥1) | Present in multiple places |
| Item 1.e | 0 | MISSING | Not present — only 10.C used |
| Item 10.C | 3 | - | Present — but see fact conflict note below |
| Ukraine RE-PAROLE | 3 | YES (≥1) | - |
| Fee calculator link | 2 | YES (≥1) | - |
| U4U paused/case-by-case notice | 0 (for pause) | **FAIL** | 7 matches for "hold" but ALL are: "hold harmless" in disclaimer text + UI state labels. Zero mentions of USCIS program pause Jan 2025, admin hold Feb 2025, or court-ordered resumption June 2025. |
| Hardcoded $580 | 0 | PASS (must be 0) | - |
| Hardcoded $630 | 0 | PASS (must be 0) | - |
| Hardcoded $1,020 | 0 | PASS (must be 0) | $1,020 grant fee NOT mentioned anywhere — not even as a notice |
| Processing time 8-21+ months | 0 | MISSING | No processing time range shown; only generic "Check USCIS Processing Times" link |

---

## OCR Status

- Route exists: **YES** — `apps/web/src/app/api/ocr/extract/route.ts` (280 lines)
- Actual behavior: **conditional** — if `DEEPSEEK_VISION_MODEL` env var set AND `image_base64` provided → real OCR via DeepSeek vision API; otherwise → `manual_review_required` mode returning empty field template
- `DEEPSEEK_VISION_MODEL` in `.env.local`: **NOT SET** — `grep DEEPSEEK_VISION_MODEL apps/web/.env.local` → "NOT IN .env.local"
- Therefore in production: **always returns `manual_review_required`** (vision model not configured)
- @upstash/ratelimit installed: **NO** — `ls node_modules/@upstash` → NOT FOUND; falls back to in-memory
- DeepSeek vision API calls: code present but **NEVER TRIGGERED** (env var missing)
- Honest UX: **YES** — `TranslationServicePanel.tsx:335` checks `uploadResult?.ocr_status === 'manual_review_required'` and shows manual entry form; `translation/upload/route.ts:42` sets `ocr_status: 'manual_review_required'`

---

## Critical Gaps (ordered by severity)

1. **[CRITICAL] U4U program status — NO notice on production page.** The page shows zero information about: (a) Jan 27, 2025 USCIS pause, (b) Feb 14, 2025 admin hold on ALL parolee applications, (c) June 9, 2025 resumption via court order, (d) case-by-case processing only. A Ukrainian user reading this page has NO warning that the program was paused for 4+ months and resumed under court order. The service data file (`re-parole-u4u.ts:15`) has this fact in a code comment only — not surfaced to the UI.

2. **[CRITICAL] $1,020 parole grant fee — NOT mentioned anywhere.** The new $1,020 fee (effective Oct 16, 2025, charged upon conditional approval) is absent from the production page, the checklist packet, and all messages. Users will be blindsided by this charge.

3. **[CRITICAL] Item 10.C vs. 1.e unresolved.** The audit brief states the USCIS online form's "Ukrainian Re-Parole" streamlined option (Item 10.C) was ELIMINATED. The new path requires Item 1.e ("I am outside the United States, applying for Advance Parole"). The production page and generated packet both use 10.C. The service data comment cites "Nova Ukraine Refugee Portal" as confirming 10.C — this may be outdated. If the brief is correct, the form guidance is WRONG. Human must verify against current USCIS I-131 edition 02/27/26.

4. **[HIGH] Rate limiting is in-memory only on Vercel.** `@upstash` NOT installed, no `KV_URL`/`UPSTASH_REDIS_REST_URL` in `.env.local`. On Vercel serverless, each function instance has its own Map — rate limits reset per cold start and are NOT shared across instances. Mia chat (20 req/min), OCR (10 req/min), magic-link (5 req/hr) are all vulnerable to per-instance bypass.

5. **[HIGH] No processing time range shown.** USCIS current data is 8-21+ months (Manifest Law April 2026). Production page shows only a generic link. Users need an explicit warning that processing is extremely slow.

6. **[HIGH] DEEPSEEK_VISION_MODEL not configured** — OCR route always falls back to `manual_review_required`. Translation OCR feature is non-functional in current production config. The UI correctly shows manual entry form (honest UX), but the feature is advertised as OCR-capable.

7. **[MEDIUM] Health endpoint not testable externally** — `HEALTH_TOKEN` absent from `.env.local`. Live production health check cannot be verified. 9-field schema confirmed from source only.

8. **[MEDIUM] Re-parole packet is TXT-only inside ZIP.** `checklist.txt` is plain text — no PDF, no fillable form, no I-131 pre-filled content. While this is honest (it's a checklist, not a form), the product description should clearly state this is a text checklist, not a filled I-131.

---

## USCIS Fact Accuracy in Production

| Fact | Expected | Found in source | Correct |
|------|----------|-----------------|---------|
| I-131 edition | 02/27/26 | `en.json`: "Form I-131 (edition 02/27/26)"; `re-parole-u4u.ts:23`: `edition: '02/27/26'`; checklist.txt: "Use edition: 02/27/26" | YES |
| Filing item | 1.e (per audit brief) OR 10.C (per service data) | 10.C in all locations | UNRESOLVED — conflict between audit brief and service data citations |
| Fee amounts | NOT hardcoded | No $580/$630 found in packet or page | YES |
| U4U paused notice | MUST be present | ABSENT from all user-facing surfaces | NO — CRITICAL GAP |
| $1,020 grant fee | Should be mentioned | ABSENT everywhere | NO |
| Program resumed June 9, 2025 | Should be mentioned | Code comment only, not in UI | NO |
| Processing time 8-21+ months | Should be shown | Not shown, only generic link | NO |

---

## Recommendation

Do NOT proceed to Stripe until:

- [ ] **RESOLVED: Item 10.C vs. 1.e** — human must verify against current USCIS I-131 form 02/27/26 PDF. If 1.e is correct, production page and packet are giving wrong form instructions.
- [ ] **U4U program status notice added to page** — must inform users of Jan 2025 pause, Feb 2025 admin hold, June 2025 court-ordered resumption, case-by-case processing.
- [ ] **$1,020 grant fee notice added** — not hardcoded, but must be mentioned with feecalculator link.
- [ ] **Processing time 8-21+ months** added to page with source citation.
- [ ] **@upstash rate limiting** — install `@upstash/ratelimit` + `@upstash/redis` and configure `KV_URL` or `UPSTASH_REDIS_REST_URL` in Vercel env. Current in-memory rate limit is not effective.
- [ ] **DEEPSEEK_VISION_MODEL** — set env var if vision OCR is intended for production, or mark the OCR feature as "coming soon" in UI.
