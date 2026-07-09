# BYPASS_COLLAPSE_PLAN — collapsing the One Brain bypasses (2026-07-09)

Owner plan #5. Discipline (owner law): shadow → parity → sign-off → flip, ONE bypass at a time.
Order: Translation first → Re-Parole/EAD → TPS legacy LAST. Never rip a live path out; replace it,
prove parity in shadow, then remove behind a flag.

## Inventory (audit 2026-07-09, file:line verified)
| # | Bypass | file:line | Cat | Status | Replacement |
|---|---|---|---|---|---|
| 1 | user docTypeId trusted as truth | `api/translation/vision-extract/route.ts:233` | B | LIVE | intake decision (One Brain) constrains; declared hint only compared |
| 2 | `auto:false` skips readDocument (0 fields) | TranslateWizard UI | B | LIVE | route all classes through readDocument + per-class review gate |
| 3 | TPS 7 legacy modules call OCR directly | `api/tps/ocr/extract/route.ts:447+` | A | LIVE | unify to readDocument adapter (TPS LAST) |
| 4 | `translation/extract` DeepSeek direct + own confidence rule | `api/translation/extract/route.ts:108-196` | B | LIVE | readDocument via text-extraction adapter; shared gates |
| 5 | DeepSeek prose review summary | `vision-extract/route.ts:44` | A | INTENTIONAL | ✓ prose-only per Constitution L4 — keep |
| 6 | diag routes bare OpenAI (no schema/gates) | `api/diag/recognize,classify` | A | GATED (404 prod) | ✓ diagnostic-only — keep gated |
| 7 | TPS legacy modules unpoliced (no class gates) | `api/tps/ocr/extract/route.ts:85-91 vs 447` | B | LIVE | wrap legacy calls with class-policy guards (with #3) |
| 8 | generate-pdf raw extracted_fields fallback | `api/translation/generate-pdf/route.ts:23` | C | BLOCKED* | verify finalPdfGate invariant enforced on ALL pdf routes |
| 9 | hardCaseAutoread route-level override | `components/.../hardCaseAutoread` | B | LIVE | move override into readDocument class policy |
| 10 | session flow persists raw extracted_fields | `api/translation/extract/route.ts:165` | C | LIVE | wrap in CanonicalDocument; gate render on canonical presence |

\* #8 appears guarded by `shouldBlockRawPdfFallback` + `assertDocumentReadyForFinalPdf` — verify enforcement.

## Collapse order (each: shadow marker → clean real-traffic window → owner sign-off → flip → remove)
1. **Translation** — #1 (docType-as-truth): the One Brain shadow (#3, LIVE OFF) already observes the
   correct type; flip = feed intake decision into routing behind `ONE_BRAIN_DECISION_*`. Then #10, #4.
2. **Re-Parole / EAD** — replicate.
3. **TPS legacy (#3, #7)** — LAST, collapse-plan, one module at a time.
Intentional/gated (#5, #6) stay. #8 = verify-only.

## Non-goals now
No behavior flip in this doc. Flips are owner-gated (#9 in the plan) after shadow evidence. This is the
map + order only.
