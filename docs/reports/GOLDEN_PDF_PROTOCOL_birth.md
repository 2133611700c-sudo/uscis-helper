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
| # | Severity | Finding | Fix owner / next |
|---|---|---|---|
| 1 | 🔴 **BLOCKER** | **Cyrillic series letters silently stripped.** Input series `I-АМ 000001` renders as `I- 000001`. Root cause: `renderOfficialTranslation` `safe()` = `replace(/[^\x00-\xFF]/g,'')` deletes anything > U+00FF. This is **silent data loss** (violates the no-silent rule). | Transliterate series letters via KMU-55 (А→A, М→M) **upstream** before render; renderer must never silently drop. Tracked as `it.todo` in the golden visual test. |
| 2 | 🟠 | Translator **Address line empty** on the certification. Matches the review-gate finding — the live TranslateWizard does not collect signer address. | Wire an address field into the wizard, then promote signerAddress to a hard gate. |
| 3 | 🟠 | **UNZR / RNOKPP** rendered as placeholders on an 1814-era synthetic doc. These registry numbers did not exist pre-2019; era-gating should suppress them when documentDate precludes them. | Era-gate UNZR/RNOKPP on documentDate in the schema variant selection. |

## Verdict
**birth_certificate is NOT visually approved yet.** Blocker #1 (silent Cyrillic strip)
must be fixed before the pilot can go active. The machine golden tests passed because
they used Latin "AM"; the realistic Cyrillic series exposed the defect — exactly why
visual approval is mandatory. Owner sign-off checkbox below.

- [ ] Owner reviewed `birth_certificate.pilot-1.png` and approves the bureau layout
- [ ] Blocker #1 (Cyrillic series transliteration) fixed and re-rendered
- [ ] Address line resolved (wizard collects signer address)
