# HANDOFF.md
Last updated: 2026-05-24 06:30 UTC
Sessions: 9–13 consolidated + audit
Production SHA: 61898e5 (docs) / Runtime SHA: 6f73aa3

## CURRENT STATE
Client-mode TPS wizard works end-to-end with evidence.
Owner-mode blocked in automation (needs owner session).
Status: DEGRADED (not PASS until owner-mode proven).

## WHAT WORKS (proven)
- Init + EAD + Paper: full E2E → ZIP with I-821 + I-765
- 5 upload slots with OCR (all 200)
- Gate blocks missing required fields
- Signature for paper only
- Manual address city/state/zip fields
- OCR prefill in review fields
- Regex normalization for settlement types
- KMU-55 transliteration
- 1963 tests, 0 TS errors

## WHAT DOESN'T WORK
1. **last_entry_date for rereg** — gate requires it, no manual input in rereg path
2. **passport_expiration_date** — no manual fallback
3. **REREG+NOEAD** — minimal upload slots (no passport/I-94)
4. **Owner-mode** — not testable without owner session

## NEXT SESSION PRIORITIES
1. Fix last_entry_date for rereg (add manual input or make conditional)
2. Owner-mode test with real owner session
3. Add edge-case regex tests to CI test suite (not just inline node -e)
4. Consider passport_expiration_date manual fallback

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
