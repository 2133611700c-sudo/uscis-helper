# STATUS.md
Last updated: 2026-05-24 07:15 UTC
Session: 14 (audit + hotfix)
Production SHA: pending deploy (session 14, commit 2)

## Product
Messenginfo = self-help immigration information, document translation, and USCIS draft-form generation platform.
Not a law firm. No legal advice. User reviews, signs, and files independently.

## Current production goal
Upload docs → OCR → normalization → TPSAnswers → I-765/I-821 PDF → review → clean export ZIP.
Manual input: phone, email, marital status, SSN, address. Everything else from documents.

## STATUS: DEGRADED
Client-mode E2E closed with evidence. Owner-mode not proven (blocked by access).

## VERIFIED (with physical evidence in repo)

### E2E Flow (session 13)
- [x] Production live: messenginfo.com, SHA cc319ce, healthz ok
- [x] Client E2E: step1→step6, generate-packet 200, ZIP downloaded
- [x] ZIP contents: I-821.pdf (1.8MB) + I-765.pdf (757KB) + INSTRUCTION.txt
- [x] PDF pages rendered to PNG: i821-page1.png, i765-page1.png, i821-part7.png
- [x] Evidence: docs/reports/evidence/t3ps-final-release/browser-run-clean/
- [x] 5 OCR slots: all returned 200 (passport, booklet, i94, i797_or_ead, dl)
- [x] Gate: passed with no errors after address fields fix
- [x] Selector contract: all data-testid anchors present in production DOM

### Wizard UX (sessions 9–10)
- [x] 6 steps, progress bar matches
- [x] Booklet upload slot: BOTH init AND rereg paths
- [x] 5 upload slots for init: passport, booklet, I-94, I-797/EAD, DL
- [x] 6 upload slots for rereg+EAD: tps_notice, booklet, passport, ead_old, i94, dl
- [x] Placeholders removed from manual fields
- [x] Tooltips: human language, 4 langs
- [x] EAD subtitle merged into [?] tooltip
- [x] Manual fields for us_address_city/state/zip added (session 13 fix)

### Signature (session 9)
- [x] Only for paper filing (hidden for online)
- [x] [?] = inline tooltip, not new tab
- [x] Screen mode without drawing = explicit error (4 langs)
- [x] /s/ NAME in PDF (readback test: 3 tests pass)
- [x] _signature_mode: paper | screen | online_myuscis

### Knowledge & Normalization (session 9)
- [x] Dictionary: 22 settlement types, CZO/MFA verified
- [x] KMU-55: Тростянець → Trostianets (CZO confirmed)
- [x] Regex: mandatory dot for с./м./сел./хут. (15 edge cases pass)
- [x] Empty result guard in postExtractNormalize
- [x] Province: genitive → nominative → English (25/25 oblasts)
- [x] pdfPrefiller: toWinAnsiSafe on ALL values

### Infrastructure (session 10)
- [x] Session docs guard: pre-commit hook + CI workflow
- [x] Stable data-testid selectors for automation
- [x] Step-5 preflight gate before Step-6
- [x] Per-slot OCR diagnostics
- [x] 0 TS errors, 1963 tests pass

## CLOSED CRITICAL BUGS
- [x] us_address_city/state/zip: manual inputs added (session 13). Was blocking users without DL.
- [x] Booklet slot missing in rereg: fixed (session 9). Was only in init branch.
- [x] Regex stripping city names: fixed (session 9). "Суми"→"уми" bug.
- [x] **REREG+NOEAD: no passport/I-94 slots** — fixed session 14. passport+I-94 were inside `if(ead)`.
- [x] **last_entry_date hidden in rereg review** — fixed session 14. I-94 rows now show for all paths.

## OPEN BUGS
- [ ] **noindex, nofollow**: all pages have `<meta name="robots" content="noindex, nofollow"/>`. Zero Google visibility. Decision pending: intentional beta or bug?
- [ ] **passport_expiration_date**: no manual fallback if OCR fails.
  - Impact: low (MRZ extraction reliable), but no recovery path
- [ ] **I-912 fee waiver form**: health reports `filled: false`. Paper+fee waiver users don't get pre-filled I-912.
- [ ] **Owner-mode**: not proven in automation (blocked by session access).

## DO NOT RE-LITIGATE
- Dictionary v1.2 is canonical (ADR-002)
- KMU-55 is the only transliteration standard
- Existing pipeline is correct; extend, do not rebuild
- смт abolished Jan 2024 but stays in dictionary for old documents
