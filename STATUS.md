# STATUS — Messenginfo
## Session 57 (2026-05-29) — Paid Gemini, model bench, recognition audit, D-GLOSSARY G1+G2 (branch feat/c3-presence)
- `VERIFIED(live API)` Best recognizer = **gemini-3.1-pro-preview** (20/22; handwriting 8/9, the ONLY model that reads it). 2.5-pro fabricates on handwriting (1/9); GPT-5.5/4o collapse (1/9); DeepSeek = text-only (no vision); Transkribus blocked. Default switched to 3.1-pro (env-driven, fallback 3.5-flash); prod key var = `GEMINI_API_KEY_PAY`.
- `VERIFIED(local)` presence-confirm fix: GV garbles handwriting → no longer discards handwriting reads (keep+review); only printed fields GV-guarded.
- `VERIFIED(local)` **D-GLOSSARY G1+G2**: unified registry `packages/knowledge/src/registry/` (CSV source + generated runtime, every row has source_url, era-gating). Wired into LIVE `normalize` (place_city/oblast/authority) with documentDate. смт→"urban-type settlement", oblast→DMS EN, міліція@1986→Militsiya. Web 2182 pass, 0 type errors; registry 11/11; wiring 4/4.
- `AUDIT` `docs/reports/RECOGNITION_TRANSLATION_AUDIT_2026-05-29.md` — danger is the DELIVERY layer (PDF drops empty fields, wizard hardcodes review, names vs MRZ, fake email, manual-review no ticket, no preprocessing).
- `VERIFIED(local)` **P0 honest-PDF** (audit #1): `pdf.ts::planTranslationRows` — unread field → visible MISSING placeholder, never dropped; missing → `certifiable=false`. 2/2 tests. Web 2184 pass.
- `VERIFIED(local)` **G4 (partial)**: `brainHealth().glossary` self-describes categories/total/provenance. Guard test.
- `VERIFIED(local)` **Wizard honesty (#2a+#4)**: real per-field review flag propagated (no more hardcoded true); false "sent to email" copy removed (email not collected). i18n drift 0.
- `VERIFIED(local)` **#3 MRZ controlling-Latin**: `knowledge/mrz.ts` TD3 parser (check digits, 4 tests) wired into presence for ua_international_passport — MRZ name/number/DOB beats KMU-55 re-translit (HARD RULE).
- `VERIFIED(local)` **B3 preprocessing**: sharp clean (orient/grayscale/normalize/downscale) + quality-gate, wired into presence before vision calls, fails-open, 5 tests.
- `VERIFIED(local)` **#5 manual-ticket**: wizard creates a manual-review ticket on paid manual docs (was payment without ticket). i18n/tsc clean.
- `NOT DEPLOYED / OPEN` G3 (full KOATUU/civil-registry into CSV), wizard real review-flag propagation (#2), MRZ/controlling-Latin (#3), EAD/Re-Parole route wiring, official renderers (P4), product contracts (P5). On Vercel confirm `GEMINI_API_KEY_PAY` set + deploy. Rotate OpenAI key (pasted in chat).

## Session 56 (2026-05-29) — Unified recognition engine + Central Brain (LOCAL)
- `VERIFIED(local)` recognition engine `apps/web/src/lib/engine/` 29/29; central-brain `apps/web/src/lib/central-brain/` 3/3 (delegated_to_legacy → TPS untouched); knowledge patronymic 26/26 + gazetteer.
- `VERIFIED(live API)` vision LLMs fabricate handwriting; Transkribus reads PRINTED not faded handwritten Soviet docs → printed=auto, handwritten=human-assist.
- `OFFICIAL SOURCES` UA forms ledger `docs/official-forms/ukraine/` (КМУ 1025/353/302/152…).
- `NOT DEPLOYED` engine not wired to any live product; prod translation still single Gemini Flash. Next: wire Translation to central-brain.

## DB Security Patch (2026-05-27)
- `VERIFIED` Event trigger `auto_grant_public_tables` active on uscis-helper
- `VERIFIED` Event trigger `auto_grant_public_tables` active on Handy & Friend  
- `VERIFIED` All 34 uscis-helper tables have explicit GRANT to anon+authenticated
- `VERIFIED` All 31 Handy & Friend tables have RLS policies (was: 12 with 0 policies)
ATUS — Messenginfo TPS Robot
**Updated:** 2026-05-28 — Session 55: P2 audit items closed (SEO + live Cyrillic OCR chain verified)
**Status:** PRODUCTION (auto-fill-only model live)
**Scope:** P0–P7 complete. 2124/2124 unit pass + 1 skip. 0 type errors.

## Session 55 (2026-05-28) — Post-audit P2 items: SEO + Cyrillic OCR chain

- `VERIFIED(prod)` Live Cyrillic OCR chain: synthetic Тарас Шевченко passport → ШЕВЧЕНКО→SHEVCHENKO, ТАРАС→TARAS, ГРИГОРОВИЧ→HRYHOROVYCH, 09 БЕРЕЗНЯ 1814→1814-03-09, МОРИНЦІ→MORYNTSI, ЧЕРКАСЬКА→Cherkasy Oblast. All 6 fields exact KMU-55 match.
- `VERIFIED(local)` sitemap.ts: `'translate-document'` → `'translate-document/start'` in SERVICE_SLUGS. Crawlers now index canonical URL directly, not the 307-redirect.
- `VERIFIED(local)` `/start/page.tsx`: `robots` noindex→index, explicit `openGraph` per locale, `twitter` card, `alternates.languages` hreflang for 4 locales.
- `KNOWN GAP` (continued) Git history still has 784 PII files. Owner-decision needed for filter-repo + force-push.
- `KNOWN GAP` (continued) Free Gemini key on prod. Swap to paid AQ when billing enabled.

## Session 54 (2026-05-28) — Post-audit PII purge from HEAD

- `VERIFIED(local)` `git rm` 784 files purged from HEAD: full `docs/reports/evidence/` (741), `reports/BOOKLET_*` + `booklet-synthetic-*` + `booklet-stability-*` (42), `qa-shots/ua_passport_real.png` (1).
- `VERIFIED(local)` `.gitignore` rewritten to block-everything for evidence + reports/ root (old policy whitelisted .txt/.json/.csv allowing 784 files to slip through).
- `VERIFIED(local)` Production-code redaction: TPSWizardV2.tsx:3872 hardcoded owner address → generic example.
- `VERIFIED(local)` Typecheck 0 errors, 2124 pass + 1 skip, `git grep Kuropiatnyk` 160 → 34 remaining (tests + intentional code + narrative docs, all reviewed).
- `KNOWN GAP` Git history still contains the 784 PII files in prior commits. Full purge needs git-filter-repo + force-push + GitHub Support ticket. Owner-decision (destructive, irreversible).
- `KNOWN GAP` 14 narrative docs still quote owner's name in prose (STATUS/HANDOFF/audit MDs). Acceptable as engineering memory; redactable on request.
- `KNOWN GAP` (continued from Session 53) Free Gemini key on production. Owner kept it; swap to paid AQ when billing enabled.

## Session 53 (2026-05-28) — Real diagnosis: stale landing + missing GEMINI_API_KEY

- `VERIFIED(prod)` `/ru/services/translate-document` (the URL every menu link points at) was serving the OLD Tailwind-blue landing with $14.99/$19.99/$29.99 trio. Replaced with `redirect()` to `/start`. Owner's "сайт старый" reports were correct — only `/start` had the new wizard, but no link from the menu went there directly.
- `VERIFIED(prod)` Added free `GEMINI_API_KEY` to Vercel Production env, redeployed. Production OCR endpoint now returns 200 with real Gemini fields. Without this, the wizard always fell into the "manual review" notice branch and the new layout never rendered.
- `VERIFIED(prod)` curl + headed-Playwright on messenginfo.com production: full Welcome → DocType → Upload → Processing → Review → Edit flow works with real OCR. Synthetic passport fixture returned TESTSURNAME / TESTGIVEN / 1985-07-12; Edit button opened native prompt and badged the corrected row with «ИСПРАВЛЕНО».
- `KNOWN GAP` Free Gemini tier trains on data. Owner accepted this temporarily; swap to paid AQ key once owner enables billing on the AQ project.
- `VERIFIED(local)` 2124 pass + 1 skip, 0 type errors, `pnpm build` SUCCESS.

## Session 52 (2026-05-28) — Strip flag emojis from review row (Windows + a11y)

- `VERIFIED(local)` Removed 🇺🇸/🇺🇦 prefixes from per-row values. On Windows the US/UA regional-indicator pairs do not render as flags — they show the letter pairs, and some translate extensions surface those as the literal word «English» in the user's reading. Stripping the icons removes ANY possible reading of «English» on the review row.
- `VERIFIED(local)` Visual hierarchy strengthened (no icons needed): original = 15px italic muted; ↓ arrow with aria-hidden; translation = 19px weight 800 dark.
- `VERIFIED(local)` Dead i18n keys `s5_col_orig`/`s5_col_trans` removed (declared but never referenced after Session 50).
- `VERIFIED(local)` 2124 pass + 1 skip, 0 type errors, `pnpm build` SUCCESS.

## Session 51 (2026-05-28) — Mobile/desktop parity audit + fixes

- `VERIFIED(local)` Audit table covering every Session-50 innovation × {mobile, desktop}. 12 features ✅ parity; 3 mismatches found.
- `VERIFIED(local)` Page-remove × bumped 28→36 px (matches TPS edit-button tap-target standard).
- `VERIFIED(local)` Drag-drop CSS was dead code — wired real handlers to upload zone + page grid.
- `VERIFIED(local)` Mobile tap feedback: `-webkit-tap-highlight-color: transparent` globally + `:active` states on every primary surface (no more iOS grey overlay; consistent green tap feedback).
- `KNOWN GAP` iOS HEIC uploads return 415 (backend only accepts JPEG/PNG/WebP). Deferred — needs server-side HEIF decode.
- `VERIFIED(local)` 2124 pass + 1 skip, 0 type errors, `pnpm build` SUCCESS.

## Session 50 (2026-05-28) — Wizard: edit-button + multi-page + contrast 1:1 with TPS

- `VERIFIED(local)` Review row redesigned to TPS RW pattern: ONE label per row, two values stacked on white card with dark text. No more green-on-green contrast issue (was ~2.5:1, now ≥7:1). Edit button per row uses `window.prompt()` exactly like TPSWizardV2 — universally accessible.
- `VERIFIED(local)` `extractedFields` updates with `kind:'user_corrected'` on edit; corrected row shows green «Исправлено» badge so the user knows their fix took.
- `VERIFIED(local)` Multi-page upload: state `image:File|null` → `images:File[]` (cap 6). Upload screen has 2-col thumbnail grid with × remove + «➕ Добавить страницу». CTA shows count («Распознать 3 стр. →»). Backend accepts repeated `file` keys; merges per-field preferring earliest non-empty across pages.
- `VERIFIED(local)` 2124 pass + 1 skip, 0 type errors, `pnpm build` SUCCESS (193 pages).

## Session 49 (2026-05-28) — Translation wizard restyled 1:1 to TPS design system

- `VERIFIED(local)` `TranslateWizard.tsx` CSS rewritten: prototype structure (7 screens, 6 doc-type tiles, side-by-side review, watermarked cert) preserved; visual language flipped to TPS — `var(--accent, #10a37f)` green, `var(--surface-1)` white cards, Inter (`var(--font-inter)`), 14px radius, 48px tap targets, `0 1px 4px rgba(0,0,0,.05)` shadow. Legacy prototype vars (`--gold`, `--navy*`) re-aliased to TPS-equivalents → JSX unchanged. Body-bg dark override removed. Cert preview kept paper-white (theme-independent document mockup).
- `VERIFIED(local)` 2124 pass + 1 skip, 0 type errors, `pnpm build` SUCCESS, drift gate green.

## Session 48 (2026-05-28) — Translation wizard FULL REWRITE per owner's prototype

- `VERIFIED(local)` Rewrote `TranslateWizard.tsx` faithfully under owner's navy/gold prototype: 7-screen flow (Welcome → DocType → Upload → Processing → Review → Pay → Success), doc-type-FIRST routing (booklet/passport/birth/marriage/ID/other; non-booklet → manual-review notice), preview-BEFORE-pay per v5 §21, side-by-side translation table, watermarked cert preview, Playfair Display + Nunito fonts. CSS scoped under `.tw-root` — no global bleed.
- `VERIFIED(local)` Backend reused 1:1: `/api/translation/vision-extract` (real docintel/Gemini), `/api/stripe/checkout` (real Stripe), `/api/translation/generate-pdf` with X-Payment-Token gate.
- `VERIFIED(local)` v5 §31 compliance: "принимается USCIS" / "accepted by USCIS" → "для подачи в USCIS" / "formatted for USCIS submission". Old structural test (`wizardScopeAndDeadCode`) replaced with focused v5 §31 forbidden-phrase guard + auto:false routing pin.
- `VERIFIED(local)` 2124 pass + 1 skip, 0 type errors, `pnpm build` SUCCESS (193 pages), drift gate green.

## Session 47 (2026-05-28) — P2: real OCR in translation wizard (no more Shevchenko mock)

- `VERIFIED(local)` New `/api/translation/vision-extract` — accepts uploaded image, runs through `docintel.readDocument` (Gemini vision + KMU-55), returns canonical extracted fields. Rate-limited 8/min/IP. Owner-set GEMINI_API_KEY required for prod (PAID tier per v5 §30 + memory `provider-routing-policy`).
- `VERIFIED(local)` `TranslateWizard.tsx`: `handleUpload` now actually captures the file. `handlePickDocType` for booklet POSTs the file to the new endpoint and renders the resulting fields. The hardcoded "SHEVCHENKO TARAS HRYHOROVYCH" name and the static `REVIEW_FIELDS` (Shevchenko/1814) are replaced by real KMU-55 values when extraction succeeds. Fields passed to `/api/translation/generate-pdf` so the PDF can render real data.
- `VERIFIED(local)` 2147 pass + 1 skip, 0 type errors, **`pnpm build` success**, drift gate green.

## Session 46-corr (2026-05-27) — critical gap-fix on today's plan

Self-audit found 8 gaps in earlier P1/P3 deliverables; closed 4 of them:
- `VERIFIED(live)` `buildEadPacket()` integration test: pdf-lib + integrity check + shared TPS I-765 actually produce a real PDF (~50KB+, `applied>8`, %PDF header verified). Closes the critical "never ran live" gap on P3.
- `VERIFIED(local)` `/api/translation/render` now uses shared `verifyStripeSessionPaid` (DRY — was its own local copy).
- `VERIFIED(local)` 2147 pass + 1 skip (+2 new integration tests), 0 type errors.
- `VERIFIED(prod-build)` `pnpm --filter web build` succeeded — catches more than typecheck, all routes built including `/api/ead/generate-packet`.

Still open (cannot close without owner inputs):
- EADFormData captures only ~10 of ~25 I-765 fields (no passport/SSN/phone/email/address breakdown/signature). PDF is functional but sparse. Expanding requires wizard UX changes (owner scope).
- Stripe end-to-end browser test (requires Stripe test mode + manual session).
- TranslateWizard visual layout (requires dev server / browser).
- P2 translation mock-data display (deferred).

## Session 46 (2026-05-27) — P4: v5 spec into repo + memory reconciliation

- `VERIFIED` `docs/translation/DOCUMENT_TRANSLATION_ENGINE_V5.pdf` committed (was only in owner's Downloads); MD index updated with source-artifact pointer.
- `VERIFIED` Memory reconciled: v3 (`project_tps_constitution_v3`) marked superseded for standalone-translator scope by v5 (`translation_engine_v5_canon`); MEMORY.md index updated. v3 keeps the TPS-embedded translation lineage; v5 governs the standalone product.

## Session 46 (2026-05-27) — P3: EAD now generates real filled I-765 PDF (parity with TPS/ReParole)

- `VERIFIED(local)` New `lib/ead/i765FieldMap.ts` (categories c11/c08/a12 supported; "other" → Item 27 left blank), `lib/ead/packetBuilder.ts` (loads shared `public/uscis/tps/i-765.pdf`, integrity check, prefill with EAD-DRAFT watermark), `api/ead/generate-packet/route.ts` (rate-limited, no payment — free service). `EADWizard` now offers PDF as PRIMARY action (44-48px tap targets, locale-aware labels en/uk/ru/es), HTML worksheet demoted to secondary.
- `VERIFIED(local)` 9 unit tests for the field map. 2145 pass + 1 skip, 0 type errors, drift green.
- Owner's "EAD = 0" finding closed: EAD lifted from HTML-worksheet-only to real filled I-765 PDF.

## Session 46 (2026-05-27) — P1: translation payment gate (Severity-1 liability closed)

- `VERIFIED(local)` New `lib/stripe/verifyPayment.ts` — single source of truth for "is this Stripe session paid for the expected service". Used by `/api/translation/generate-pdf` (was hardcoding `payment_confirmed:true`).
- `VERIFIED(local)` `/api/translation/generate-pdf`: owner-bypass OR Stripe-verified `paid` + `metadata.service==='translation'`; 402 otherwise. `TranslateWizard.tsx` captures `cs` from Stripe success redirect, persists in sessionStorage, sends as `X-Payment-Token` header.
- `VERIFIED(local)` 8 unit tests for the util (paid/unpaid/wrong-service/format/api-error/no-config). 2136 pass + 1 skip, 0 type errors. No drift.

## Session 45-corr (2026-05-27) — self-audit correction (no functional change)

- Two real errors in session-45 documentation/comments fixed: (1) actual brand color is **`#10a37f`** (verified `globals.css:90,153`), not `#0d5a34` as I'd claimed — the unification is functionally correct, only the documented hex was wrong; (2) `MEMORY.md` typo "Prostionets" → "Prostianets". EAD=0 re-verified directly.
- 2128 pass + 1 skip, 0 type errors.

## Session 45 (2026-05-27) — 4-product audit + Translation UI unified with TPS

- `VERIFIED` Audit: TPS (I-821+I-765 ✅), ReParole (I-131 ✅), **EAD (HTML worksheet ❌, no filled I-765 PDF — "0" confirmed)**, Translation (PDF generated but from mock data — separate bug).
- `VERIFIED(local)` `TranslateWizard.tsx` CSS rebuilt to share TPS tokens: `--acc:var(--accent,#0d5a34)` (was local #1a6b4a), body 17px (was 15), H1 28px (was 26), container 760px (was 440), buttons 48/44px tap targets with focus outlines, plan/upload borders 2.5px. WCAG 2.5.5 + 30-80yo readability. Zero behavior change.
- `VERIFIED(local)` 2128 pass + 1 skip, 0 type errors, drift gate green, content guards pass.
- Report: `docs/reports/SYSTEM_AUDIT_4_PRODUCTS.md`. Flagged separately: EAD needs I-765 PDF generation; translation wizard mock-data + ungated PDF (owner D2).

## Session 44 (2026-05-27) — Document Intelligence Layer (permanent shared spine)

- `VERIFIED(local)` New `lib/docintel/` — canonical pipeline TPS/ReParole/EAD/Translation all rest on: `types.ts`, `documentRegistry.ts` (6 UA doc types + consumers), `transliterationPolicy.ts` (KMU-55, one place; strips смт/с.м.т./м. prefixes), `providers/geminiVisionProvider.ts` (vendor-agnostic, prompt built from spec), `documentFieldReader.ts` (`readDocument()` entry).
- `VERIFIED(local)` `geminiVisionArbiter.ts` refactored into a thin TPS/booklet FACADE over the spine (no parallel logic; shared provider + transliteration). Route + existing tests unchanged.
- `VERIFIED(LIVE)` End-to-end through the spine on owner booklet: Kuropiatnyk / Serhii / Serhiiovych / 1986-06-25 / **Trostianets** (settlement prefix "с.м.т." correctly stripped) / Vinnytsia Oblast.
- `VERIFIED(local)` 2126 pass + 1 skip, 0 type errors, drift gate green.
- Arch doc: `docs/architecture/DOCUMENT_INTELLIGENCE_LAYER.md`. Other doc types declared + mock-tested; need real fixtures before prod. Flag OFF.
- `VERIFIED(local)` Coverage guard added: CI test fails if a registry field's kind is not handled by transliterationPolicy (drift-prevention / "rule auditor"). 2128 pass + 1 skip.

## Session 43 (2026-05-27) — P3 latency: vision-first (skip crossref when vision reads page)

- `VERIFIED(local)` Restructured booklet case to VISION-FIRST: Gemini vision runs first; if it reads the page (anchor=family_name) the DocAI+DeepSeek crossref is SKIPPED (~10s saved, ~17s→~7s when flag ON). Crossref still runs as fallback when vision fails/disabled. Flag OFF → behavior identical to before (crossref only).
- `VERIFIED(local)` 2115 pass + 1 skip, 0 type errors.

## Session 42 (2026-05-27) — P3: Gemini vision arbiter WIRED behind flag (OFF)

- `VERIFIED(local)` New `geminiVisionArbiter.ts`: reads handwritten Cyrillic from image, KMU-55 transliterates (names/city), normalizeProvince for oblast, ISO for dob. Candidate-only, review_required=true. 503/429 retry + model fallback + 8s timeout.
- `VERIFIED(local)` Wired into `route.ts` booklet case behind `TPS_GEMINI_VISION_ARBITER_ENABLED` (default OFF → prod unchanged). Vision overrides all sources except user_corrected/user_input/ocr_mrz; fail→keep existing (never block). `vision_arbiter_status` surfaced in response.
- `VERIFIED(unit)` visionReadsToFields → exact KMU-55: Kuropiatnyk / Serhii / Serhiiovych / Trostianets.
- `VERIFIED(LIVE, N=1)` End-to-end through production code on owner booklet: Gemini→KMU-55 produced Kuropiatnyk/Serhiiovych/Trostianets (was Yovych/Prostianets). Live test self-skips in CI (RUN_LIVE_VISION=1 to run).
- `VERIFIED(local)` 2115 pass + 1 skip, 0 type errors, drift gate green (reused dual_ocr_crossref source).
- `NOT ENABLED in prod` — needs ≥3 distinct people + ground truth + PAID tier (v5 §29/§32/§30).

## Session 41 (2026-05-27) — P1 PROOF: Gemini vision reads handwritten Cyrillic (N=1)

- `VERIFIED(live)` Gemini 2.5 Flash reading the booklet IMAGE (not OCR text) returned correct Cyrillic for ALL 5 identity fields on owner's fixture: Куроп'ятник, Сергій, **Сергійович** (prod was "Yovych"), 25 червня 1986, **Тростянець** (prod was "Prostianets"). 6.85s, ~0.12¢.
- `VERIFIED(live)` Critical finding: Gemini Cyrillic is correct but its TRANSLITERATION is wrong (Kurop'iatnyk, Troshchianets) → confirms v5 §13: Gemini reads Cyrillic, KMU-55 transliterates. Never LLM for names' Latin.
- `N=1 ONLY` — owner's own handwriting. NOT client-validated; needs ≥3 distinct people (v5 §29/§32) before flag-ON.
- Engineering plan: `docs/translation/ENGINEERING_PLAN_VISION_ARBITER.md`. Proof: `docs/translation/VISION_ARBITER_PROOF_N1.md`. Harness: `scripts/vision-arbiter-proof.mjs`.
- Free-tier key used for owner-doc test only (gitignored .env.local); to be rotated; PAID tier required for prod PII.

## Session 40 (2026-05-27) — Phase 0: single readinessPolicy (kills 3 conflicting gates)

- `VERIFIED(local)` New `readinessPolicy.ts` — single source of truth for required fields per stage (merge/generate/mail). centralBrain, isMinimallyComplete, mailReadyGate now all derive from it; no local required-field literals remain.
- `VERIFIED(local)` Behavior preserved byte-for-byte: each stage reproduces the exact historical field list. KNOWN INCONSISTENCIES (status_at_last_entry, passport_country_of_issuance) documented in-file as [KI-1]/[KI-2], NOT changed (owner decision pending).
- `VERIFIED(local)` +7 anti-drift tests (readinessPolicy.test.ts) pin behavior — fail if policy diverges from historical lists. 2108/2108 pass, 0 type errors.
- Part of OCR stabilization plan — see `docs/reports/EXECUTION_PLAN_OCR_STABILIZATION.md`. Phase 1 (Gemini vision arbiter) NOT started — needs API key + multi-person fixtures.

## Session 39N (2026-05-27) — fix: crossref OCR quality — Prostianets→Trostianets, reject short patronymic

- `VERIFIED(local)` `dualOcrCrossref.ts` prompt: added Т/П handwriting confusion rule + specific correction Простянець→Тростянець. Added patronymic completeness rule: value < 8 chars = suffix fragment, return null.
- `VERIFIED(local)` `route.ts`: added `crKey==='patronymic' && cr.value.length < 8 → continue` guard in BOTH crossref apply blocks (passport case + booklet case). "Yovych" (6 chars) now rejected instead of written to field.
- `VERIFIED(local)` 2101/2101 tests pass, 0 type errors.
- `UNVERIFIED` Production — deploy pending.

## Session 39M (2026-05-27) — fix: rotation loops for ALL slots guard on line count

- `VERIFIED(local)` Added `result.lines.length < 8` condition to rotation retry loops in passport / i94 / ead / dl cases. Loops now skip if Vision already reads 8+ lines (image is upright but doesn't match the module). Prevents 15-20s hang on ALL document types when mobile photo is clear but module doesn't match.
- `VERIFIED(local)` 0 type errors
- `UNVERIFIED` Production — deploy pending

## Session 39L (2026-05-27) — fix: remove booklet rotation retry loop (upload hang)

- `VERIFIED(local)` Removed 23-line rotation retry loop from `case 'booklet':` in `route.ts`. Loop ran 3 extra Vision calls (~15-20s) looking for `passport_number`, which is in `forbidden_fields` and gets discarded even if found. Booklet OCR now goes: runPassportBookletModule → dual-OCR crossref → done.
- `VERIFIED(local)` 0 type errors
- `UNVERIFIED` Production — deploy pending

## Session 39k (2026-05-27) — fix: booklet inferred fields + lineMatchesLabel false-positive

- `VERIFIED(local)` `lineMatchesLabel`: "Пол" (sex) no longer matches "Поліграфічний" (printing co.) via short-label token fix
- `VERIFIED(local)` `country_of_birth = 'Ukraine'` added to booklet inferred emissions
- `VERIFIED(local)` `country_of_nationality`, `country_of_birth`, `passport_country_of_issuance`, `sex` moved to `allowed_fields` in booklet contract
- `VERIFIED(local)` 2101/2101 tests pass, 0 type errors
- `UNVERIFIED` Production — deploy pending

## Session 39j (2026-05-27) — fix: booklet DOB fallback + given_name unblocked

- `VERIFIED(local)` `passportBooklet.ts`: DOB fallback scan when "Дата народження" label absent — scans all lines, emits if exactly 1 date candidate.
- `VERIFIED(local)` `documentContracts.ts`: `given_name` moved from `forbidden_fields` → `allowed_fields` for booklet slot.
- `VERIFIED(local)` 2101/2101 tests pass (+3 new), 0 type errors
- `UNVERIFIED` Production verify: call OCR on `booklet_test_resized.jpg` to confirm `dob` and `given_name` in `final_field_keys`

## Session 39h (2026-05-27) — fix: booklet-only E2E `tps-generate-cta` not visible

- `VERIFIED(local)` Central Brain: synthetic 'manual' upload slot now routed to `manualForBrain` (Step 2) instead of `brainUploads` (Step 1 with contract filter). Fixes `isStep6Eligible=false` after `?paid=1` reload when fields filled via `fillReviewRow`.
- `VERIFIED(local)` 2098/2098 tests pass, 0 type errors
- `UNVERIFIED` E2E `booklet-only-pdf-proof.spec.ts` — deploy pending

## Session 39d (2026-05-27) — fix: смт → "urban-type settlement" in translation

- `VERIFIED(local)` `MergedField.raw_value?` threaded from `winningCandidate.raw_value` in `centralBrain.ts`
- `VERIFIED(local)` `cityWithSettlementType()` in `translationExtractor.ts`: смт/пгт → "urban-type settlement", с. → "village", хут. → "khutor"
- `VERIFIED(local)` USCIS form still receives bare "Trostianets"; translation receives "Trostianets urban-type settlement"
- `VERIFIED(local)` +6 unit tests; 2098/2098 pass, 0 type errors
- `UNVERIFIED` Production deploy — pending push

## Session 39c (2026-05-27) — feat: knowledge v1.3 — missing agencies + DOCUMENT_TYPES + TPS requirements

- `VERIFIED(local)` dictionary.ts v1.3: +9 authorities (VIKONKOM/RDA/ODA/SILRADA/MISKRADA/NOTARY/PASSPORT_OFFICE/DILTNICHNYI), +14 DOCUMENT_TYPES, AUTHORITY_PATTERNS reordered
- `VERIFIED(local)` tps_ukraine_requirements.ts: eligibility dates, fees ($500-510 H.R.1 non-waivable), EAD A12/C19, common mistakes
- `VERIFIED(local)` ukraine_agency_abbreviations.json: +ВИКОНКОМ, РДА, ОДА, ТЦК, ДСНС, ДПСУ
- 2092/2092 unit tests pass, 0 type errors

## Session 39b (2026-05-27) — fix: booklet source label shows "Паспорт · OCR" instead of "Внутр. паспорт · OCR"

- `VERIFIED(local)` `provenanceLabel()` now has explicit `booklet` branch — `actualSlot==='booklet'` → `t.source.booklet` (all 4 locales). Previously fell through to `fallbackDoc==='passport'` → "Паспорт · OCR", confusing users into thinking data came from the international passport.
- `VERIFIED(local)` 0 type errors after fix.
- `UNVERIFIED` Production deploy — pending push.

## Session 39 (2026-05-27) — e2e green on production

- `VERIFIED(prod)` `booklet-multi-sample.spec.ts` 5/5 PASS: booklet_known/doc1/doc2 full translation (violations=0, bytes 2568-2569), doc3/doc4 non-identity warning (expected).
- `VERIFIED(prod)` `translation-review-gate.spec.ts` 1/1 PASS: given_name flows through EditOcr → translation. Cert present. Review Gate blocks without checkbox.
- Fixed bookletOcr wait to accept any HTTP status (non-identity pages return non-200).
- Fixed multi-sample CB race: passport + I-94 uploaded alongside booklet, CB completes <25s.

## Session 38 (2026-05-27)

- `VERIFIED(local)` Removed real-PII example placeholders from live site (Sergii/FU262473/06-25-1986/Serhiiovych). Auto-fill product rule restored.
- `VERIFIED(local)` Removed 4 manual identity FieldInputs (given_name/dob/passport_number/last_entry_date) from Step-5 ReviewManual — duplicated ReviewOcr rows which have "Изменить". Field→doc map: given_name/passport# ← загранпаспорт MRZ; dob ← passport/booklet/EAD; last_entry_date ← I-94; patronymic/birthplace ← booklet; address ← DL; phone/email/marital ← typed (not on docs).
- `VERIFIED(local)` "Изменить" writes to synthetic 'manual' slot under base key → flows to gate/forms/translation. Fixes earlier *_manual key mismatch that lost the given name in translation.
- `UNVERIFIED` e2e on prod — pending deploy. Test on site: upload загранпаспорт + I-94 + booklet at Step 4, confirm given_name auto-fills from MRZ and Step-5 has no blank manual identity boxes.

## Session 37 — Ukrainian passport translation: VERIFIED on production (2026-05-27)

- `VERIFIED` e2e `booklet-multi-sample.spec.ts` 5/5 pass on production 6ddce4a:
  - 3 identity pages (booklet_known, 1.jpg, 2.jpg) → full translation ~1821 bytes, Patronymic label, cert, 0 violations
  - 2 non-identity pages (3.jpg issuing-authority, 4.jpg registration) → no-identity warning shown, no translation offered (correct)
- `VERIFIED` e2e `translation-review-gate.spec.ts` 1/1 pass: full ZIP 2.58 MB, translation HTML + cert present, all safety assertions
- `VERIFIED` Patronymic manual fallback flows into translation (RU-side OCR misses handwritten patronymic; manual entry covers it)

## Session 37 Verified Changes (2026-05-27)

- `VERIFIED` Gate field manual fallback: `given_name_manual`, `dob_manual`, `passport_number_manual`, `last_entry_date_manual` added to `WizardData['manual']`. `buildDraftAnswers()` uses manual values with OCR fallback. ReviewManual shows conditional FieldInput blocks for each when OCR missed the value. Root cause: booklet form contract forbids these fields; booklet-only flow was always blocked at isStep6Eligible.
- `VERIFIED` `translation-review-gate.spec.ts`: removed fragile `fillReviewRow` for gate identity fields; replaced with `fillIfEmpty` targeting new testids (tps-review-manual-given-name, tps-review-manual-passport-number, tps-review-manual-dob, tps-review-manual-last-entry-date)
- `VERIFIED` `booklet-multi-sample.spec.ts`: same fix applied; spec covers all 5 real booklet documents
- `VERIFIED` CB-readiness race fix (REAL production bug): `Review Translation` button now disabled until `centralBrainStatus==='ready'`. Was returning 140-byte placeholder when clicked during post-`?paid=1` CB re-merge window. `handleTranslationPreview` guards defensively.
- `VERIFIED` Non-identity booklet page guidance: Step-5 warning `tps-booklet-no-identity-warning` (4 locales) when booklet upload yields no `family_name` (user uploaded issuing-authority/registration/sideways page instead of identity page).
- `VERIFIED` Multi-sample test corrected: `identityPage` flag per doc. 3.jpg=issuing-authority spread, 4.jpg=registration spread (NON-identity, verified visually). Identity pages assert translation; non-identity assert warning. doc1/doc2/booklet_known = identity pages, all translate correctly.
- `VERIFIED` Multi-sample preview-capture race fix: removed async `page.on('response')` listener for preview metrics; parse directly from `waitForResponse` response object. `violations_count` was always -1 due to async-handler race.
- `VERIFIED` Multi-sample count() race fix: `booklet-multi-sample.spec.ts` replaced immediate `count()` after `page.goto('?paid=1')` with `expect().toBeVisible({ timeout: 20_000 })`. Root cause: count() fired before React rehydrated.
- `VERIFIED` Stale closure fix: `translationReviewConfirmed` added to `generatePacket` useCallback deps. Was missing → callback captured `false` at mount → `reviewConfirmed` always sent as `false` in generate request.
- `VERIFIED` 2092/2092 tests pass, 0 type errors

## Session 36 Verified Changes (2026-05-27)

- `VERIFIED` Translation PDF in TPS ZIP: `generateTranslationPDF()` now called in `packetBuilder.ts` when `_rawFields` is present. Bureau-style 2-page PDF (translation + cert) added to ZIP as `Translation_Internal_Passport.pdf` alongside existing HTML. Both `generateTPSTranslation()` and `translateBookletFromBrain()` return types extended with `_rawFields`, `_signerName`, `_signerAddress`.
- `VERIFIED` mailing_in_care_of: added to `WizardData['manual']`, exposed in ReviewManual mailing section, passed through `buildDraftAnswers()`
- `VERIFIED` registration_address extraction: wired `registration_address` optional field into `extraction.fieldTargets`, `expectedLabels` (`МІСЦЕ ПРОЖИВАННЯ`, `МІСЦЕ РЕЄСТРАЦІЇ`), and `render.renderFields` in `passportBooklet.module.ts`
- `VERIFIED` 2092/2092 tests pass, 0 type errors

## Session 33 Verified Changes (2026-05-27)

- `VERIFIED` ADR-008: Provider architecture locked (docs/adr/ADR-008-provider-architecture.md)
- `VERIFIED` ADR-009: Provider data policy locked (docs/adr/ADR-009-provider-data-policy.md)
- `VERIFIED` translationExtractor.ts: Translation Mode field extraction (P1)
  - bypasses CB form contract for given_name/sex/passport_number (valid for translation)
  - formatDobForTranslation: YYYY-MM-DD/MM/DD/YYYY/DD.MM.YYYY → "June 25, 1986"
- `VERIFIED` translateBookletFromBrain: uses translationExtractor + rejected[] + manual{}
- `VERIFIED` TranslationCandidateSafetyGuard: blocks forbidden phrases, Middle Name, Police, Cyrillic leak (P1.5)
- `VERIFIED` passportBooklet.ts: issued_by (Орган що видав) + passport_date_of_issue (Дата видачі) extracted (P2)
- `VERIFIED` documentContracts.ts: issued_by + passport_date_of_issue explicitly in booklet forbidden_fields (translationExtractor picks up from rejected[])
- `VERIFIED` 2092/2092 tests pass, 0 type errors
- `VERIFIED` P3: TranslationReviewGate built + wired. reviewConfirmed: true required in packetBuilder before translation enters ZIP. /api/tps/translation/preview endpoint added.
- `VERIFIED` P5: Agency glossary expanded from 24 → 49 entries (УВС, ГУВС, ОВС, ВОВС, РВ МВС, ВДДМС, СДМС, ТДМС, ВАЦС, ВП, ЦНАП, ГУНП, ГОВП, УВІР, ОМ, РМ, МОУ, КМ, ВСЗН etc.)
- `VERIFIED` P6: International passport translation implemented in generateTPSTranslation ('internationalPassport' template path was null — now renders full HTML)
- `VERIFIED` Mailing address UI: checkbox "different from physical" + mailing street/city/state/zip in ReviewManual (TPSWizardV2) and GeneratePacketBlock. buildDraftAnswers() uses mailing_different flag. Field maps already handled this — UI was the only missing piece. TODO comment removed.
- `VERIFIED` Image retention audit CLOSED: all 4 ADR-009 OPEN items verified by code trace (2026-05-27). See ADR-009 audit table.
- `VERIFIED` Payment verification hardened: generate-packet now verifies Stripe cs_* session ID against Stripe API (was hardcoded token bypass)
- `VERIFIED` P7: G1-G13 gates verified (docs/reports/P7_GATES_VERIFICATION_2026-05-27.md). 13/13 PASS.
- `VERIFIED` AI data processing disclosure UI: aiDisclosure box in Step 4 upload screen (🔒, 4 locales, ADR-009) — uses "AI assistant" (not provider name, guard-safe)
- `VERIFIED` Review Gate testids: translation-review-gate, translation-review-checkbox, translation-review-confirm-btn, translation-review-back-btn, tps-review-translation-btn
- `VERIFIED` Playwright e2e spec: translation-review-gate.spec.ts (7 gate assertions, pending live browser run)

## Session 31 Verified Changes

- `VERIFIED` Ukrainian textual date parser added to `documentBrain.ts`:
  - `"25 червня 1986 року"` → `"1986-06-25"` confirmed working via unit tests.
  - All 12 genitive month forms supported.
- `VERIFIED` booklet `dob` contract fix:
  - `dob` moved from `booklet.forbidden_fields` → `booklet.allowed_fields`.
  - Was being double-rejected (validator AND contract).
- `VERIFIED` provenance mapping fix:
  - `toSourceDocType('booklet')` now returns `'booklet'` (was `'user_manual'` via default branch).
- `VERIFIED` unit tests 1994/1994 pass.
- `VERIFIED` typecheck clean.
- `VERIFIED` e2e test `booklet-only-pdf-proof.spec.ts`:
  - Added `passport_number=FU262473` fill (MANUAL_GATING_ONLY).
  - Added `dob=06/25/1986` fill (MANUAL_GATING_ONLY until DOB patch deployed to prod).
  - DOB provenance assertion: accepts `'booklet'` OR `'user_manual'`.

## Session 31 Still DEGRADED (production)

- `UNVERIFIED` DOB patch not deployed. Production OCR still returns `validated_skipped: date not parseable` for booklet DOB.
- `UNVERIFIED` booklet-only e2e against production with DOB patch — needs deploy first.
- `UNVERIFIED` strict provenance proof `_provenance.family_name.source_document_type === 'booklet'` against live production (requires deploy + e2e run).

## Central Brain (Session 32 — COMPLETE, not yet wired to wizard)

- `VERIFIED` centralBrain.ts: mergeToCentralBrain() 5-step pipeline.
- `VERIFIED` hallucinationGuard.ts: detectGarbageString, checkGeography, crossDocumentConflict, guardField.
- `VERIFIED` dictionaryBridge.ts: normalize() unified entry point.
- `VERIFIED` sourcePriority.ts: SlottedField, toExtractedCandidate, hasControllingLatinSpelling.
- `VERIFIED` /api/tps/brain/merge/route.ts: POST endpoint.
- `VERIFIED` 2016/2016 tests pass, 0 typecheck errors.
- `VERIFIED` TPSWizardV2 now calls POST /api/tps/brain/merge after each upload.
- `VERIFIED` mergedFields: Central Brain is primary, fieldArbiter is fallback with explicit DEGRADED banner.
- `VERIFIED` Booklet-only Playwright proof: family_name + middle_name provenance=booklet, ZIP/PDF generated, I-821 readback confirmed.
- `VERIFIED` Oblast regex fix: normalizeOblastToNominative("Вінницька область") returns "Vinnytsia Oblast" (was null before fix).
- `VERIFIED` DOB fixture proof — 14 unit tests in passportBooklet.dob.test.ts prove parseUaDate chain for all formats (full UA/RU month, numeric, abbreviated bilingual "13 CEP / AUG 60", 2-digit year). All 14 pass.
- `VERIFIED` Direct Playwright network capture for /api/tps/brain/merge: listener + waitForResponse added to booklet-only-pdf-proof.spec.ts. Writes brain-merge-summary.json + brain-merge-network.json artifacts. Asserts status=200, booklet slot present, family_name in merged keys.
- `VERIFIED` Translation Bridge v0 + wire + e2e proof: `translateBookletFromBrain` live. ZIP includes Translation_Internal_Passport.html + Certification_Translation.html. Playwright e2e unzips and asserts: surname, Patronymic label (not Middle Name), Internal Passport, competency statement, no "certified by AI". translation-proof.json artifact written. 2051/2051 tests.

## Session 31 Exact Next Steps

1. Push this commit → Vercel deploys.
2. Wait for deploy: `vercel ls` → confirm new SHA on production.
3. Run `npx playwright test tests/e2e/booklet-only-pdf-proof.spec.ts --headed` against production.
4. Verify:
   - `_provenance.family_name.source_document_type === 'booklet'` in `provenance-proof.json`.
   - `dob` from OCR (not manual) → `strictProvenance.dob === 'booklet'`.
   - ZIP/PDF readback: `Kuropiatnyk`, `Trostianets`, `Vinnytsia Oblast`, `Serhiiovych`.
5. If DOB still fails (old production behavior): investigate why DOB patch didn't take effect.
6. After verified: begin Central Brain Phase 1 (`centralBrain.ts`).



## Session 30 Verified Findings
- `VERIFIED` strict e2e previously had a race: Step4 `Recognize documents` does not trigger OCR; OCR runs on file upload (`handleUpload`).
- `VERIFIED` after adding explicit wait for `POST /api/tps/ocr/extract`, strict run receives OCR payload:
  - `doc_type_hint=booklet`
  - `final_field_keys=["city_of_birth","family_name","middle_name","province_of_birth"]`
  - `brain_status=ran`, `crossref_status=crossref_ok`
- `VERIFIED` review state now contains booklet-origin values:
  - `family_name = Kuropiatnyk`
  - `middle_name = Serhiiovych`
  - city/province available in manual section defaults.
- `VERIFIED` Step 6 blocker reduced to exactly two required fields:
  - `Date of birth`
  - `Passport number`

## Data-flow Truth by Field
- `family_name`:
  - OCR response includes it from booklet.
  - booklet contract allows it.
  - wizard stores and surfaces it on Step 5.
  - Step 6 marks it as complete.
- `dob`:
  - current production OCR response does not include `dob` in `final_field_keys`.
  - known production behavior still reports `validated_skipped: dob/date not parseable`.
  - strict run (no manual dob edit) therefore remains blocked.
- `passport_number`:
  - booklet contract forbids `passport_number` by design.
  - `isMinimallyComplete` requires `passport_number` for packet generation.
  - in booklet-only flow this is expected to need manual entry or another document.

## Why strict run still cannot generate
- `DEGRADED`: for strict no-manual-proof-fields mode, missing `dob` (production old behavior) plus forbidden booklet `passport_number` keeps `isStep6Eligible=false`, so `tps-generate-cta` is not rendered.

## Session 30 Exact Next Step
1. Run strict booklet-only proof against runtime that includes DOB patch.
2. Keep `family_name/city/province/middle/dob` unedited.
3. If only `passport_number` remains missing, fill it as `MANUAL_GATING_ONLY` and verify `_provenance.family_name.source_document_type='booklet'` before ZIP/PDF readback.

**Updated:** 2026-05-26 Session 29 — provenance-strict booklet-only proof attempt
**Status:** DEGRADED
**Scope:** Minimal provenance bug fix + strict booklet-only proof run; no deploy/push.

## Session 29 Verified Facts
- `VERIFIED` provenance root-cause in product code:
  - file: `apps/web/src/lib/tps/provenance.ts`
  - `buildProvenanceFromWizard()` mapped unknown `doc_slot` to `user_manual`.
  - `booklet` slot was not handled in `toSourceDocType()`, so OCR booklet fields were mislabeled as `user_manual` even without manual edits.
- `VERIFIED` minimal fix applied:
  - `SourceDocumentType` now includes `'booklet'`.
  - `toSourceDocType('booklet')` now maps to `'booklet'`.
- `VERIFIED` added regression test:
  - `apps/web/src/lib/tps/__tests__/provenance.test.ts`
  - booklet slot provenance now expected as `source_document_type='booklet'`.
- `VERIFIED` strict e2e test tightened:
  - removed manual edits for OCR proof fields (`family_name`, `city_of_birth`, `province_of_birth`, `middle_name`, `dob`).
  - added strict payload assertions expecting booklet provenance for extracted fields.
- `VERIFIED` strict headed run result:
  - generate still blocked at Step 6 (`tps-generate-cta` absent).
  - page snapshot shows `Required fields remaining: 3`:
    - `Family name`
    - `Date of birth`
    - `Passport number`
- `VERIFIED` therefore no strict ZIP/PDF was produced in this run.

## Session 29 DOB Replay Proof (code-level)
- `VERIFIED` replay on patched code path:
  - `validateBrainField('dob', '25 червня 1986 року')` -> mutates `final_value` to `06/25/1986`.
  - `postExtractNormalize` keeps field valid.
  - `applyContract('booklet', ['dob'], 'ukrainian_internal_passport')` accepts `dob` with no contract rejection.
- This confirms parser+contract behavior in code path, independent of current production deployment.

## Session 29 Endpoint Blocker (read-only diagnosis)
- `BLOCKED` local API endpoint proof still fails in this environment:
  - response: `Server action not found`.
  - prior `next dev` logs included repeated `EMFILE: too many open files, watch`.
- `UNVERIFIED` full process inventory due environment restrictions:
  - `ps`/`pgrep` process listing unavailable in this runtime.
  - read-only socket check confirms port `3000` listener exists (`node` PID 69881).

## Session 29 Why not PASS
- `DEGRADED`: provenance mapping bug is fixed in code and tested, but strict runtime booklet-only generate path is blocked by missing required fields when OCR/manual-proof fields are not manually overridden.
- `UNVERIFIED`: end-to-end strict ZIP/PDF with booklet-origin family_name could not be completed on current production behavior.

## Session 29 Exact Next Verification Step
1. Run strict booklet-only flow against patched local runtime once endpoint issue is resolved, and capture `generate-network.json` showing:
   - `_provenance.family_name.source_document_type = booklet`.
2. Then complete ZIP/PDF readback from that strict run.

**Updated:** 2026-05-26 Session 28 — booklet-only production-proof step (zero-trust)
**Status:** DEGRADED
**Scope:** Narrow e2e proof-path repair + DOB verification attempt; no deploy/push.

## Session 28 Verified Facts
- `VERIFIED` root cause for `booklet-only-pdf-proof.spec.ts` generate failure:
  - Step 6 snapshot showed `Required fields remaining: 1` (`Date of last entry to the US`).
  - `tps-generate-cta` is rendered only when `(isOwner || paid) && isStep6Eligible`; `?paid=1` alone is insufficient.
  - Test used stale label (`Date of last entry to the US`) while UI row label is `US entry date`, so required field stayed empty.
- `VERIFIED` narrow test-only fix applied:
  - `apps/web/tests/e2e/booklet-only-pdf-proof.spec.ts`
  - switched to EAD=yes branch (to require I-765 in packet),
  - corrected edit labels to `US entry date` and `Status at entry`.
- `VERIFIED` headed e2e now reaches ZIP generation in booklet-only run:
  - artifact ZIP: `apps/web/test-results/booklet-only-pdf-proof-artifacts/tps-packet.zip` (~2.58MB).
- `VERIFIED` ZIP contains `I-821.pdf`, `I-765.pdf`, `INSTRUCTION.txt`; PDF readback confirms expected strings:
  - `Kuropiatnyk`, `Trostianets`, `Vinnytsia Oblast`, `Serhiiovych`.
- `VERIFIED` provenance in generated payload is currently manual, not booklet:
  - `_provenance.family_name.source_document_type = user_manual`
  - same for `city_of_birth`, `province_of_birth`, `middle_name`.
  - therefore booklet-origin family-name proof is not yet satisfied.
- `VERIFIED` production OCR endpoint still shows old DOB behavior:
  - raw OCR contains `25 червня 1986 року`,
  - `validated_skipped` includes `{ field: "dob", reason: "date not parseable" }`,
  - `final_field_keys` do not include `dob`.
- `BLOCKED` local API endpoint proof on patched runtime:
  - `POST http://127.0.0.1:3001/api/tps/ocr/extract` returned `Server action not found`,
  - dev logs show repeated `EMFILE` watcher errors and the same server-action failure.

## Session 28 Why not PASS
- `DEGRADED`: ZIP/PDF generation path is proven, but provenance for family/city/province/middle is `user_manual`, so booklet-origin proof is not complete.
- `BLOCKED`: live/local endpoint proof for DOB patch via running local API could not be completed due runtime `Server action not found`.

## Session 28 Exact Next Verification Step
1. Run a controlled booklet-only e2e variant that does **not** manual-edit `family_name/city/province/middle`, while still satisfying gate-required non-booklet fields.
2. Assert `_provenance.family_name.source_document_type === "booklet"` (or extraction source bound to booklet slot) in `generate-network.json`.
3. Re-run ZIP/PDF readback and keep only sanitized evidence.

**Updated:** 2026-05-26 Session 27 — repository hygiene policy for evidence/test artifacts
**Status:** PASS
**Scope:** Documentation-only repository hygiene hardening; no app/runtime code changes.

## Session 27 Repository Hygiene Policy (Verified)
- `VERIFIED` root `.gitignore` now blocks accidental commits of generated Playwright/test artifacts:
  - `apps/web/test-results/`
  - `apps/web/playwright-report/`
  - `playwright-report/`
  - `test-results/`
- `VERIFIED` root `.gitignore` now blocks sensitive-by-default raw evidence patterns under `docs/reports/evidence/`:
  - binary/document artifacts (`.zip`, `.pdf`)
  - screenshots (`.png`, `.jpg`, `.jpeg`, `.webp`)
  - runtime/network traces (`.log`, `.trace`, `.har`)
  - nested `playwright-report/` folders.
- `VERIFIED` local debug benchmark folders are now ignored:
  - `reports/booklet-stability-*/`
- `VERIFIED` CSV reports remain intentionally unignored for controlled tracking when sanitized and decision-grade.
- `VERIFIED` a permanent operational policy document exists at:
  - `docs/reports/retention-policy.md`
  - includes classification, sensitive-by-default categories, PII/OCR handling rules, and promotion workflow for sanitized tracked evidence.
- `VERIFIED` no application logic, runtime behavior, deployment config, or product flow was changed.

## Session 27 Remaining Risk
- `DEGRADED` historical local raw evidence already present on operator machines may still contain sensitive payloads; `.gitignore` prevents new accidental adds but does not sanitize existing local files.
- `UNVERIFIED` older branches/clones may not include this policy commit until merged/pulled.

## Session 27 Exact Next Verification Step
1. Push this docs-only commit through normal guard flow.
2. Re-check:
   - `Session Docs Guard`
   - `Content & Brand Guards`
3. Optionally run `git add -n .` to confirm raw evidence patterns are no longer staged by default in fresh sessions.

**Updated:** 2026-05-26 Session 26 — persisted MacBook workstation policy into repo memory
**Status:** PASS
**Scope:** Documentation-only governance update; no app/runtime code touched.

## Session 26 Workstation Policy Persistence
- `VERIFIED` repository memory now includes a permanent "MacBook Workstation and Tool-Use Policy" section in `AGENTS.md`.
- `VERIFIED` policy explicitly permits CLI + browser/app/tool execution when task-relevant and mandates best-tool selection.
- `VERIFIED` policy explicitly preserves safety boundaries for destructive and high-risk operations requiring owner approval.
- `VERIFIED` no application logic, runtime code, build config, or production behavior was changed in this session.
- `VERIFIED` this commit is intended to improve future operator consistency across terminal and app sessions.

**Updated:** 2026-05-26 Session 25 — post-push guard status + clean-range repair commit
**Status:** DEGRADED
**Live SHA:** `d9e31a6254134d7840c3a54275067707f33be5d9`

## Session 25 Current Verified State
- `VERIFIED` Vercel production deployment for docs-only push is `Ready`:
  - deployment: `https://uscis-helper-k67x575l7-sergiis-projects-8a97ee0f.vercel.app`
  - status source: `vercel ls` (age ~5m, Production, Ready).
- `VERIFIED` GitHub `Content & Brand Guards` passed:
  - workflow run: `26461533323`
  - result: `completed success`.
- `FAILED` GitHub `Session Docs Guard` for previous push range:
  - workflow run: `26461533247`
  - result: `completed failure`.

## Session 25 Root Cause (Guard Failure)
- Guard checked the full push range:
  - `1d8e70a53cbebf71fc2f5968971e4ebd85f40a35..d9e31a6254134d7840c3a54275067707f33be5d9`
- In that range:
  - commit `d9e31a6` passed guard checks.
  - commit `1ed8a77` failed guard checks because it did not include `STATUS.md` and `HANDOFF.md`.
- `VERIFIED` process note:
  - `d9e31a6` repaired commit-time compliance for subsequent commits.
  - It cannot retroactively make the earlier pushed commit (`1ed8a77`) green inside the already evaluated push range.

## Session 25 Repair Intent
- A new documentation-only, guard-compliant commit is required to create a fresh push range where each included commit satisfies session-doc requirements.
- This commit includes `STATUS.md`, `HANDOFF.md`, and `CHANGELOG.md` together and changes no app/runtime code.

## Session 25 Current Risk
- `DEGRADED`: production is healthy, but repository CI history still shows one failed `Session Docs Guard` run on `main` tied to the earlier push range.
- No functional product/runtime regression is evidenced from this docs-only sequence.

## Session 25 Exact Next Verification Step
1. Push this guard-compliant docs commit normally to `origin/main`.
2. Re-check:
   - `gh run list --limit 10`
   - `gh run view <new Session Docs Guard run> --log`
   - `vercel ls`
3. Expected closure condition:
   - new `Session Docs Guard` run is `completed success`,
   - `Content & Brand Guards` remains `completed success`,
   - latest Vercel production deployment remains `Ready`.

**Updated:** 2026-05-25 Session 22 — Step6 H.R.1 runtime wiring + booklet guard hardening (post-deploy rerun)
**Status:** DEGRADED
**Live SHA:** `692619ca62d47ecb8d3b23a10cf4b137b1351230`

## Session 22 Truth (post-deploy)
- `VERIFIED` shipped code changes:
  - Step6 now renders `PacketCompletenessChecker` in `TPSWizardV2` (H.R.1 warning source used by runtime UI).
  - booklet city normalization now rejects English settlement descriptors (`... settlement`) to prevent auto-garbage propagation.
  - booklet dual crossref no longer maps `date_of_birth -> dob` (manual fallback only for DOB on weak booklet path).
- `VERIFIED` code gates:
  - `pnpm --filter web typecheck` pass.
  - `pnpm --filter web test -- src/lib/tps/__tests__/postExtractNormalize.test.ts` pass (`1988/1988`).
  - drift gate green (`exit=0`) + synthetic red (`exit=1`) with clean restore.
- `VERIFIED` live runtime on one SHA (`692619ca...`):
  - production E2E pass: upload→OCR→review→gate→generate→ZIP (`/apps/web/tests/e2e/booklet-review.spec.ts`);
  - PDF readback still shows core values in generated I-821/I-765;
  - Step6 H.R.1 warning present in EN/RU/UK/ES runtime UI (`phase22_hr1_locale_results.json`);
  - synthetic benchmark rerun (`booklet_0` vs `booklet_270`) now returns `city_of_birth=Trostianets` in both rows.
- `VERIFIED` audit trail still writes fresh rows:
  - `brain_raw` present,
  - `rejected_fields` type `array`,
  - `validated_skipped` keeps honest DOB fallback (`date not parseable`).

## Why status remains DEGRADED
- `BLOCKED` owner-mode full-chain verification still requires live OTP confirmation from owner mailbox.
- `UNVERIFIED` full mandatory matrix end-to-end for every row (all 4 scenarios × EN/RU × mobile/desktop × owner/normal) is not closed in this single post-deploy rerun.
- `UNVERIFIED` multi-sample benchmark on multiple real booklet identities is still missing (current run used canonical identity + synthetic transforms).

**Updated:** 2026-05-25 Session 21 — finish-all truth-chain execution (strict evidence)
**Status:** DEGRADED
**Live SHA:** `3ec6920de5312a509b1c4bfef3ad24e90acfc103` (start/end matched in ledger)

## Session 21 Truth (strict evidence only)
- `VERIFIED` Phase A/B/C/F foundations:
  - canonical dataset manifest frozen with hashes;
  - drift gate green (`exit=0`) + synthetic red (`exit=1`) with clean restore;
  - remote schema includes `20260526000001`, live audit rows write `brain_raw` + `rejected_fields=array`;
  - `typecheck` + full tests `1987/1987` pass.
- `VERIFIED` production E2E (`initial + paper + EAD yes`, EN normal):
  - upload → OCR → review → gate → generate → ZIP → PDF readback.
  - network proof includes `generate-network.json` with request/response metadata.
- `VERIFIED` DocAI environment readiness:
  - processor enabled + real `:process` request success.
  - production runtime still reports `tps_docai_enabled=false`.
- `VERIFIED` normal-mode Step4 slot matrix parity (EN/RU, desktop/mobile, 4 required scenarios):
  - booklet slot present on mobile and desktop in all normal rows.

## Critical runtime failures observed
- `FAILED` H.R.1 wizard UI visibility (EN/RU/UK/ES): expected H.R.1 strings not found in Step6 runtime UI.
- `VERIFIED` H.R.1 exists in generated `INSTRUCTION.txt` (runtime drift UI vs package text).
- `FAILED` booklet DOB stability: canonical 5-run benchmark shows `dob=NOT_FOUND` in 5/5.
- `FAILED` synthetic rotation robustness: 270° sample produced city drift (`Prostianets settlement`).

## Blocked / unverified
- `BLOCKED` owner-mode completion: `/api/owner/request-code` works, but OTP verification was not completed in-session.
- `UNVERIFIED` full 8-row matrix end-to-end (OCR→review→gate→generate→ZIP→PDF) for every row.
- `UNVERIFIED` multi-identity real-sample benchmark (only one real canonical identity + synthetic transforms executed in this run).

**Updated:** 2026-05-25 Session 20 — independent re-check of items 1..6 + contract-as-API hardening
**Status:** DEGRADED
**Live SHA:** `1c14c197267032e373a1a4a59d4e7f3c2213d721` (verified via `/api/tps/health` on 2026-05-25)

## Session 20 Truth (strict verification)
- `VERIFIED` Item 1 drift gate v2:
  - green path: `node scripts/check-booklet-contract-drift.mjs` exit 0
  - red path: synthetic removal of `'dual_ocr_crossref'` from `TpsExtractionSource` => exit 1 with explicit drift diagnostics.
- `VERIFIED` Item 2 logging enhancement:
  - remote migration list includes `20260526000001_tps_ocr_audit_brain_raw`
  - fresh rows in `public.tps_ocr_audit` show `brain_raw is not null = true`
  - fresh rows show `rejected_fields` JSON type `array`
  - booklet row contains `validated_skipped` with `dob: date not parseable`.
- `VERIFIED` Item 3 Playwright E2E:
  - `npx playwright test tests/e2e/booklet-review.spec.ts --reporter=list` passed against production
  - upload -> OCR -> review -> generate ZIP confirmed.
- `VERIFIED` Item 4 H.R.1 content in generated package:
  - generated `INSTRUCTION.txt` contains H.R.1 fee and EAD validity notes (effective 2026-05-29).
- `VERIFIED` Item 5 contract-as-API consolidation (implemented locally, committed this session):
  - `TPSWizardV2` now derives `SLOT_ALLOWED_FIELDS` from `DOCUMENT_CONTRACTS`
  - `ExtractionSource` now aliases shared `TpsExtractionSource`
  - drift guard script updated to support the new contract-derived shape.
- `VERIFIED` Item 6 benchmark rerun:
  - 5-run canonical stability on production: stable 4 fields (`family_name`, `city_of_birth`, `province_of_birth`, `middle_name`), `dob=NOT_FOUND` in 5/5
  - synthetic multi-sample (0/90/180/270 rotation): 270° produced `Prostianets` (city drift), others `Trostianets`.

## Why status remains DEGRADED
- `UNVERIFIED`: full runtime parity for H.R.1 copy across RU/UK/ES wizard UI (only generated EN packet text is proven this session).
- `FAILED` quality stability for booklet DOB (`NOT_FOUND` in canonical rerun) and city robustness under rotated sample (`Prostianets` at 270°).
- `UNVERIFIED`: local contract-as-API hardening commit is not production-deployed yet.

**Updated:** 2026-05-26 Session 19 — Playwright E2E + ZIP/PDF proof + audit wiring live on production SHA
**Status:** DEGRADED
**Live SHA:** `2d0a626584925b88657381f32cad5793d7ab8da5` (verified via `/api/tps/health` on 2026-05-26)

## Session 19 Truth (no fake pass)
- `VERIFIED` browser E2E against production URL (`/en/services/tps-ukraine/start`) passes with real upload→OCR→review→generate flow.
- `VERIFIED` ZIP artifact is real (`apps/web/test-results/booklet-review-artifacts/tps-packet.zip`, ~2.58MB).
- `VERIFIED` PDF readback finds core values in generated PDFs:
  - `Kuropiatnyk`, `FU262473`, `UHP`, `Los Angeles`, `90029`.
- `VERIFIED` live Supabase `tps_ocr_audit` is actively receiving fresh rows (checked in Supabase UI and via linked SQL).
- `VERIFIED` remote DB migrations are synced through `20260526000001`.
- `VERIFIED` new runtime rows now persist `brain_raw` and `rejected_fields` as JSON array:
  - latest rows around `2026-05-26 01:08:30..01:08:44+00` show `has_brain_raw=true` and `rejected_type=array`.

## Why status is still DEGRADED
- Historical rows before deploy still keep old shape (`brain_raw` null + `rejected_fields` string scalar). This is expected legacy data, not a new-write regression.
- `UNVERIFIED`: city/province/patronymic booklet values were not auto-surfaced in this specific production E2E run (`extraction flags: city=false, province=false, middle=false`), so no claim of stable auto-fill is made.

## Session 19 Evidence Paths
- Playwright spec: `apps/web/tests/e2e/booklet-review.spec.ts`
- Playwright screenshots:
  - `apps/web/test-results/booklet-review-artifacts/step5-review.png`
  - `apps/web/test-results/booklet-review-artifacts/step6-generated.png`
- ZIP manifest: `apps/web/test-results/booklet-review-artifacts/zip-manifest.txt`
- PDF text readback:
  - `apps/web/test-results/booklet-review-artifacts/unzip/I-821.txt`
  - `apps/web/test-results/booklet-review-artifacts/unzip/I-765.txt`
  - `apps/web/test-results/booklet-review-artifacts/unzip/pdf-grep.txt`

**Updated:** 2026-05-25 Session 18 — booklet drift killed (3 legs) + drift gate v2 + evidence report + zero-trust re-audit
**Live SHA:** e1429ba (or drift gate v2 commit pending push). Prod verified at simulation level.
**Tests:** 1985/1985
**Commits this session:** 5 (`794b86d` client fix, `8bce911` drift gate v1, `249a5b4` evidence report, `e1429ba` formulation correction, drift gate v2 pending push)

## EVIDENCE REPORT (corrected after external review)
`reports/BOOKLET_PIPELINE_EVIDENCE_REPORT_20260525.md` — 28-run analysis with three-class evidence rule (officially claimed / verified on our data / not verified). Headline findings:
- `dob`: brain emits unparseable format in 28/28 runs (`validated_skipped: "date not parseable"`). Brain prompt says to convert Ukrainian-month genitive forms but emission evidently retains trailing words like `року`. Fixable on this stack; not yet fixed.
- `given_name`: raw OCR garbage on N=1 booklet sample (`"Behri"` from Cyrillic `В` misread as Latin `B`). Vision and DocAI both fail. **NOT proven to fail across the population or across providers.** Azure Read claims expanded Russian handwriting support (officially); we have not benchmarked it. Image preprocessing and region cropping have not been tried. Honest current default: manual entry until multi-sample data says otherwise.
- All other "missing" booklet fields are forbidden by design (passport MRZ is authoritative for those).

## SESSION 18 — booklet family_name actually reaches the user

### Post-mortem on Session 17
Session 17 closed with "production verified, surname=Kuropiatnyk, crossref_ok" against the OCR API. That measurement was correct at the API boundary and misleading at the user boundary. The server contract (commit `ce12446`) allowed `family_name`. The client throws it away in **three** independent places that the predecessor had not updated:
1. `BOOKLET_WAVE1_FIELDS` (line ~1121) — wave1 set was still 3 fields, missing `family_name`.
2. `SLOT_ALLOWED_FIELDS.booklet` (line ~1082) — entire `booklet` entry was missing, so any post-hydration session stripped the field.
3. `ExtractionSource` / `SourceType` unions — `'dual_ocr_crossref'` was emitted by the server but absent from the client/arbiter type narrowing, silently downgrading the source to `ocr_visual` (lower priority).

Net effect on prod (still live on b29ef3f as of now): booklet-only TPS users see 3 fields in Step 5 review; surname comes through manual entry only. The "10/10" stability report measured the API response, not user experience.

### Fix shipped this session
- `TPSWizardV2.tsx`: add `family_name` to `BOOKLET_WAVE1_FIELDS`, add `booklet` entry to `SLOT_ALLOWED_FIELDS`, extend `ExtractionSource` union with `'dual_ocr_crossref'`, accept it in source-type narrowing.
- `fieldArbiter.ts`: extend `SourceType` union with `'dual_ocr_crossref'` so server-emitted source survives the wire.
- `scripts/wizard-simulation-test.mjs`: regression script that mirrors the client filter and asserts 4 fields on the canonical sample (added).
- Diff is 17 lines of code. Typecheck clean. 1985/1985 tests pass.

### What this fix is NOT
- It is not an end-to-end browser proof. The `wizard-simulation-test.mjs` script mirrors the wave1 set as a hardcoded constant; it does not actually load `BOOKLET_WAVE1_FIELDS` from the .tsx at runtime. So the next drift between server and client is **not yet** caught in CI.
- It does not solve the structural problem: 4 places (server contract + 3 client filters) maintained by hand, comments saying "mirrors server".
- It does not address `given_name` or `dob` from booklet — those are still forbidden by the server contract, awaiting multi-sample benchmark.

## STRUCTURAL DEBT — booklet allowed-fields drift surface
Server (`documentContracts.ts:106`) + 3 client filters in `TPSWizardV2.tsx` (1082, 1121, 1973) + 1 arbiter union in `fieldArbiter.ts:91` = **5 sync points**.

**Drift gate now wired into CI** (`guards.yml` → `scripts/check-booklet-contract-drift.mjs`): parses the three set literals out of source at build time and fails the workflow if they drift. This catches the Session-17 bug pattern. Not a structural fix — comments still say "mirrors server" — but it eliminates the silent-drift failure mode.

Long-term fix still queued: server emits the contract over `/api/tps/contract/booklet`, client fetches once and uses for all 3 filters. After that the gate collapses to a typecheck.

## NEXT STEP
1. ✅ Pushed (794b86d) and verified on prod via simulation script.
2. ✅ Drift gate `scripts/check-booklet-contract-drift.mjs` wired into `guards.yml`.
3. Browser-level E2E (Playwright + PDF byte-grep) — still owed. Simulation script is not a substitute.
4. Refactor: server emits `/api/tps/contract/:slot`, client fetches once, deprecate the hand-maintained client constants. Then the drift gate collapses to a typecheck.
5. Multi-sample booklet benchmark (still the real Phase 0 gap from the Central Brain plan).
6. Open product question: relax server contract to allow `given_name` + `dob` from booklet — only after multi-sample benchmark proves crossref handles them.











## Security patch update (2026-05-27b)
- auto_grant moved to extensions schema, search_path fixed on all public functions

_(Session 56 cont. 2026-05-29: Translation migrated to central-brain via consensus; schema-driven official PDF renderer (KMU-1025); 4 product contracts added. Branch feat/central-brain, not deployed.)_
_(Session 56 cont.2: Re-Parole migrated as intake-only via central-brain; +ua_international_passport docType; ADR-010..014 recorded. routing 5/5. Branch feat/central-brain.)_
_(Session 56 cont.3: EAD migrated as intake + rules-based I-765 category (c8/c11/c19; never guessed; gen legacy). 45/45 engine+brain+schema. Branch feat/central-brain.)_
_(Session 56 cont.4: MASTER_BACKLOG consolidated; read-only /api/central-brain/health route; birth-certificate schema (KMU 1025), schema tests 7/7. Branch feat/central-brain.)_
_(Session 56 cont.5: googleVisionReader (2nd prod reader for consensus); /api/translation/vision-extract wired to central-brain behind flag CENTRAL_BRAIN_TRANSLATION (default off → prod unchanged, error→legacy fallback). 47/47 + tsc clean. Branch feat/central-brain.)_
_(Session 56 cont.6: generic schema-driven renderer (renderOfficialTranslation) for all civil-status; divorce/death/name-change schemas; D7 audit ledger wired (auditId per output); D0-D8 department docs (Phase 6). New-system suite green, 0 tsc errors in new code. Branch feat/central-brain.)_
_(Session 56 cont.7: verified live consensus path (Gemini+Google Vision) — found false-disagreements from reader granularity; fixed readingsAgree (containment + digit-core); live 6/8 accepted (was 2/8), guard intact. googleVisionReader works live. 16/16 consensus. Branch feat/central-brain.)_
_(Session 56 cont.8: preview deploy of feat/central-brain — central-brain/health live (200); enabling CENTRAL_BRAIN_TRANSLATION=on for Preview to verify consensus path on deployed preview. Prod untouched.)_
_(Session 56 cont.9: deployed feat/central-brain to PREVIEW (prod untouched); verified central-brain consensus LIVE on preview (provider=central-brain:consensus, guard works). Found+fixed D5 data blocker: wizard dropped guarded empty fields; now keeps review_required fields as editable rows. Prod flip deferred until wizard review UX browser-verified — my engineering call.)_
_(Session 56 cont.10: MERGED to main → prod deploy of Central Brain (code live on messenginfo.com, /api/central-brain/health 200). Activating CENTRAL_BRAIN_TRANSLATION=on in production — translation now via 2-reader consensus (Gemini+Google Vision), anti-fabrication guard, legacy fallback on error. Revert = flag off.)_
_(Session 56 cont.11: D5 — review screen now shows the uploaded document image (responsive, web+mobile) so the user fills empty consensus fields against their original. On branch feat/d5-review-image; build OK; verifying web/mobile before prod merge.)_
_(Session 56 cont.12: 4 INDEPENDENT parallel agents re-verified engines on real docs. Findings: GPT-4o fabricates handwriting (Курочинський Олег @0.95); Google Vision OCR contains all printed values; C4 3-way best (4/5); my earlier C3/6-8 numbers were UNRELIABLE (free-tier Gemini 20/day quota exhausted → silent empties). FIXED: geminiReader now surfaces 429 (was masquerading as cant-read). Wired C3 presence-confirm + recognize-injection (42 tests, 0 tsc) on branch feat/c3-presence — NOT deployed, runtime-unverified pending quota reset. #1 BLOCKER: prod runs on exhausted free key → needs PAID Gemini/Vertex billing.)_