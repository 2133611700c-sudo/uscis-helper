# HANDOFF.md
Last updated: 2026-05-24 07:15 UTC
Sessions: 9–14 consolidated
Production SHA: pending deploy (session 14, commit 4)

## CURRENT STATE
Session 14: independent production audit (code + live browser) found and fixed two P0 bugs.
Client-mode TPS wizard works E2E for init+EAD and rereg+EAD paths.
Rereg+noEAD was broken (no passport/I-94 slots) — FIXED this session.
Owner-mode: paywall bypass only, no wizard drift (verified).
Status: DEGRADED → pending deploy to verify fix in production.

## WHAT WORKS (proven)
- Init + EAD + Paper: full E2E → ZIP with I-821 + I-765
- Rereg + EAD: upload slots correct (6 slots)
- 5 upload slots with OCR (all 200)
- Gate blocks missing required fields
- Signature for paper only
- Mobile and desktop: IDENTICAL slots and UI (verified at 390px)
- Booklet slot: present on mobile for ALL paths

## WHAT WAS FIXED (session 14)
- BUG-1: rereg+noEAD had only 3 upload slots → now 5 (passport + I-94 added)
- BUG-2: I-94 review rows (last_entry_date etc) hidden for rereg → now shown for all paths
- Bonus: a_number review row added for rereg+noEAD

## OPEN ISSUES
- noindex/nofollow on all pages — zero Google visibility (decision needed)
- passport_expiration_date: no manual fallback (P2)
- I-912 fee waiver: not pre-filled (P2)
- Owner-mode: not E2E proven in automation
- Manual address city/state/zip fields
- OCR prefill in review fields
- Regex normalization for settlement types
- KMU-55 transliteration
- 1963 tests, 0 TS errors

## WHAT DOESN'T WORK
1. **passport_expiration_date** — no manual fallback (P2, MRZ usually reliable)
2. **I-912 fee waiver** — not pre-filled (P2)
3. **noindex/nofollow** — blocking all SEO (decision needed)
4. **Owner-mode** — not testable without owner session

## NEXT SESSION PRIORITIES
1. Deploy session 14 hotfix and verify rereg+noEAD in production
2. Decide noindex/nofollow — remove if not intentional beta
3. Owner-mode test with real owner session
4. Consider passport_expiration_date manual fallback
5. I-912 fee waiver pre-fill

## KEY FILES
- Wizard: `apps/web/src/app/[locale]/services/tps-ukraine/start/TPSWizardV2.tsx`
- Gate: `apps/web/src/lib/tps/mailReadyGate.ts`
- Answers: `apps/web/src/lib/tps/answers.ts`
- Field maps: `apps/web/src/lib/tps/forms/i821FieldMap.ts`, `i765FieldMap.ts`
- PDF prefiller: `apps/web/src/lib/tps/pdfPrefiller.ts`
- OCR normalize: `apps/web/src/lib/tps/ocr/postExtractNormalize.ts`
- Dictionary: `packages/knowledge/src/dictionary.ts`
- Transliterate: `packages/knowledge/src/transliterate.ts`
- Evidence: `docs/reports/evidence/t3ps-final-release/browser-run-clean/`
- Lock: `docs/audit/T3PS_MASTER_RELEASE_LOCK_FINAL.yaml`

## EVIDENCE FILES
- `dual_proof_summary.json` — E2E proof: slots, OCR, gate, generate, ZIP
- `dual_proof_network.json` — all HTTP requests and statuses
- `dual_proof_zip_listing.txt` — ZIP contents: I-821 + I-765 + INSTRUCTION
- `dual-proof-pdf-pages/` — PNG renders of PDF pages
- `T3PS_MASTER_RELEASE_LOCK_FINAL.yaml` — gates PASS, zip_pdf PASS

## SESSION HISTORY (brief)
- **Session 9**: signature, booklet fix, regex fix, dictionary, tooltips, placeholders, OCR prefill
- **Session 10**: docs guard (pre-commit + CI), selector contract, step-5 preflight gate
- **Session 11**: runtime drift fix, false-readiness block, OCR diagnostics
- **Session 12**: dual-proof script, selector sync, owner/client mode probes
- **Session 13**: address city/state/zip manual fields, E2E closure with ZIP+PDF evidence
