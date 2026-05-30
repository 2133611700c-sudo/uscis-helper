# Golden PDF & Visual Approval Protocol — birth_certificate (pilot)
**Date:** 2026-05-29 · **Mode:** Prompt 9 (pilot doc only) · **Branch:** official-docs

The single pilot document's PDF must pass BOTH a machine readback AND owner visual
approval before `active=true`. Readback is NOT a substitute for visual approval —
this pass proves why.

## Artifacts
- PDF: `docs/reports/artifacts/birth_certificate.pilot.pdf` (synthetic data — no PII)
- PNG: `docs/reports/artifacts/birth_certificate.pilot-1.png`
- Regenerate: `GEN_ARTIFACT=1 pnpm --filter web exec vitest run src/lib/translation/__tests__/birthCertificate.goldenVisual.test.ts` then `pdftoppm -png -r 110 …pilot.pdf …pilot`

## Machine checks — PASS (5/5)
- Required English labels present (BIRTH CERTIFICATE, Surname, **Patronymic**, Date of birth, Place of birth).
- Forbidden labels absent (**Middle Name**, Militia, Police).
- Overflow-length name does not crash and is not silently dropped.
- Missing required field → honest `[enter from document]` placeholder; not certifiable; no fabricated parent.

## Owner visual pass (zero-trust) — findings
| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | 🔴 **BLOCKER** | **Cyrillic series letters silently stripped.** Input `I-АМ 000001` rendered as `I- 000001`. Root cause: `renderOfficialTranslation` `safe()` = `replace(/[^\x00-\xFF]/g,'')` deleted anything > U+00FF — silent data loss. | ✅ **FIXED** — `renderValue.ts` `pdfSafe()`: per-Cyrillic-run KMU-55 transliteration + symbol map + visible `[?]` marker; never deletes. Series now renders `I-AM 000001` **and** is review-flagged. Two self-introduced regressions (lost apostrophe in `TRANSLATOR'S`, all-caps leak in act line) caught in a second visual pass and fixed via per-run transliteration. |
| 2 | 🟠 | Translator **Address line empty** on the certification (live wizard sends `addr:''`). | Open — wire address field into wizard, then promote signerAddress to a hard gate (P3). |
| 3 | 🟠 | **UNZR / RNOKPP** shown on a pre-2019-era synthetic doc; era-gating should suppress them. | Open — era-gate on documentDate in variant selection. |

## Verdict
Blocker #1 **resolved and re-rendered** (`birth_certificate.pilot-1.png` shows `I-AM`,
intact `TRANSLATOR'S`, correct-case act line). Machine golden tests passed earlier only
because they used Latin "AM" — the realistic Cyrillic series exposed the defect, exactly
why visual approval is mandatory and readback alone is insufficient. **birth_certificate
still requires OWNER visual approval + the two open 🟠 items before `active`.**

- [ ] Owner reviewed `birth_certificate.pilot-1.png` and approves the bureau layout
- [x] Blocker #1 (Cyrillic series transliteration) fixed and re-rendered
- [ ] Address line resolved (wizard collects signer address)
- [ ] UNZR/RNOKPP era-gated
