# Bureau PDF — Cyrillic Fix QA & Safety Audit
**Commit checked:** bbf26ed (+ this commit's hardening) · **Branch:** official-docs · **Date:** 2026-05-29

Post-fix QA of the silent Cyrillic-strip blocker. Read-only audit — EXCEPT one
engineering deviation (justified below) and a class-level regression guard.

## status: **PASS** (with 1 deviation + tracked next-stage items)

## Artifacts
- `docs/reports/artifacts/birth_certificate.pilot.pdf` / `.png` (synthetic, no PII)

## Visual + readback verdict (PASS)
Readback of the committed PDF:
```
Surname: Shevchenko [CONFIRM]   Given name: Taras [CONFIRM]   Patronymic: Hryhorovych [CONFIRM]
Place of birth: Moryntsi (village) [CONFIRM]   Series and No.: I-AM 000001 [CONFIRM]
TRANSLATOR'S CERTIFICATION (8 CFR 103.2(b)(3))
```
- ✅ Series renders `I-AM`, not `I-` (was silent data loss).
- ✅ Document number `000001` visible.
- ✅ `Patronymic` present; `Middle Name` absent.
- ✅ Missing fields visible as `[enter from document]`; no fabrication.
- ✅ English apostrophe preserved (`TRANSLATOR'S`); act line correct-case (`KMU Resolution No. 1025`).
- ✅ `[CONFIRM]` appears only on review-required fields.

## Tests (PASS)
- renderValue 5/5 · birth goldenVisual (incl. `I-АМ→I-AM` series) · bureauTranslation golden · **noSilentStrip class guard** · full web suite green · tsc 0.

## Grep audit (the important finding)
Searched the whole repo for the silent-strip anti-pattern `replace(/[^\x00-\xFF]/g,'')`:
- `renderOfficialTranslation.ts` — already fixed (uses shared `pdfSafe`).
- **`renderMarriageCertificateTranslation.ts:18` — SECOND copy of the identical bug.**

### Deviation from "report-only / don't touch marriage" — and why
I did **not** just report it. Engineering judgment: the file has **0 importers**
(verified) — it is dead code, superseded by the generic schema-driven
`renderOfficialTranslation` that all 5 civil types (incl. marriage) render through.
Leaving a copy of a just-fixed data-loss bug in dead code is a landmine for whoever
re-wires marriage. Since it is unwired, consolidating its `safe` to the shared
`pdfSafe` is **zero runtime risk** and removes the duplication. This is a safety/DRY
fix, not a marriage feature — so it does not violate the marriage freeze.
**Recommendation:** delete `renderMarriageCertificateTranslation.ts` entirely (dead,
superseded) — owner decision.

### Hardening added (stronger than a report)
`noSilentStrip.guard.test.ts` — a class-level guard that fails CI if ANY production
PDF renderer reintroduces a silent non-ASCII strip. Prevents the whole bug class,
not just the two instances.

## Flag / activation audit (PASS)
- `BUREAU_PDF` is opt-in only (`process.env.BUREAU_PDF === 'on'`); no default-on. ✅
- birth_certificate **NOT active** (coverage generator: 0 active). ✅
- marriage/divorce/death/name-change untouched as products. ✅

## Remaining risks / next-stage (tracked, NOT done now)
| Risk | Control / next |
|---|---|
| 🟠 **`[CONFIRM]` inside the signed certified text.** Agreed real defect — a Review-Gate marker must NOT remain in the final certified PDF. | Next stage: strip `[CONFIRM]` after `reviewConfirmed`; render clean value + record "review confirmed by user" in the audit trail. Marker is pre-signature only. |
| 🟠 signerAddress still warning-only (live wizard sends `addr:''`). | P3: wizard collects address → API hard-block → E2E. |
| 🟠 UNZR/RNOKPP shown on pre-2019-era doc. | Era-gate on documentDate in variant selection. |
| 🟠 dead `renderMarriageCertificateTranslation.ts` retained. | Recommend deletion (owner decision). |

## next_action
Owner: review `birth_certificate.pilot.png`; run Preview E2E + merge #26 → #27.
Then rebase official-docs, re-run coverage generator. birth stays NOT active until
visual approval + the 🟠 items. No new document types; BUREAU_PDF stays OFF.
