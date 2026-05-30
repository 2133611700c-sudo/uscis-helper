# Risk Register by File
**Date:** 2026-05-30 · READ-ONLY. Grouped by severity.

## 🔴 CRITICAL — can produce a wrong legal document / stale data / paid wrong output / missing audit
| File | Risk | Fix direction |
|---|---|---|
| Two stacks: `tps/ocr/extract` + `centralBrain` vs `translation/vision-extract` + `engine/orchestrator` | Same document → different recognized fields between products → wrong/inconsistent USCIS data | ADR-016: one brain (B1 unify TPS onto Gemini-docintel + parity test) |
| `app/api/translation/generate-pdf/route.ts` | `translation_orders` + `translation_certification_audit` insert errors are LOGGED but route returns 200 → **certified PDF delivered with NO audit trail** | Block or return DEGRADED when `auditPersisted=false`; verify column/enum match |
| `lib/translation/pdf/templates/ukraine/renderOfficialTranslation.ts` | `[CONFIRM]` marker can render into a signed PDF (uncertain field on a "certified" doc) | Strip `[CONFIRM]` after `reviewConfirmed` (DONE on official-docs branch, NOT on live flat path); ensure bureau path stays OFF until landed |
| `packages/knowledge/src/gazetteer.ts` `snapCity` (threshold 0.34) | Silent geography replace (`Ярошенець→Trostianets`) — village→wrong place | Tighten threshold / gate behind registry; keep raw + review on distant match (AGENT_DOCUMENT_RULES rule 7) |

## 🟠 HIGH — divergent brain / unverified source / PII / signature/cert
| File | Risk | Fix |
|---|---|---|
| `lib/engine/orchestrator.ts` | most capable brain, NOT wired to TPS → TPS underperforms (paid product) | Wire into TPS (ADR-016 B1) |
| `lib/tps/centralBrain.ts` + `dictionaryBridge.ts` | parallel normalize → diverges from engine | Converge (ADR-016 B2/B3) |
| `app/api/tps/brain/merge` → `central_brain_audit` | table referenced but not found in `supabase/migrations` → possible prod/repo drift | Verify table exists in prod; add migration if missing |
| `docs/official-forms/ukraine/source-ledger.json` | military/diploma/pension URLs INVALID; КАТОТТГ not byte-verified | Owner official URLs + byte-verify (source verifier flags them) |
| `lib/engine/htr.ts` (Transkribus) | broken/unverified handwriting reader | NEEDS_OWNER creds or remove |
| `extracted_fields`/`user_corrections`/`audit_logs.metadata` | PII (names, addresses, raw OCR) stored; metadata jsonb unschemed | Confirm retention policy + no PII in logs |
| `lib/translation/glossary/*` (agency JSON + glossaryLoader) | parallel dictionaries vs registry | Consolidate (P2) |

## 🟡 MEDIUM — UX confusion / incomplete reset / draft
| File | Risk | Fix |
|---|---|---|
| `TPSWizardV2.tsx` `tps:legal-risk:v1` / `tps:attest:v1` | persist cross-document (no reset on new upload) → user pre-attests stale legal flags | Clear on new upload / per-documentSessionId |
| `TPSWizardV2.tsx` localStorage full-state restore | no per-`documentSessionId` → stale field contamination | Add documentSessionId scoping |
| `TranslateWizard.tsx` `tw:cs` from `?cs=` URL | Stripe checkout id in URL → info leak | history.replaceState / POST |
| `TranslateWizard.tsx` no Back / Start-over buttons | owner-reported UX gap | add navigation |
| `TranslateWizard.tsx` `SAMPLE_ROWS` | sample shown if extraction empty | ensure watermark; never into PDF |
| 5 packet endpoints + 2 legacy OCR endpoints | duplication / unclear ownership | consolidate (owner) |

## 🟢 LOW — docs / naming / dead tests
| File | Risk | Fix |
|---|---|---|
| `lib/engine/assembler.ts`, `knowledge/normalize.ts`, `renderMarriageCertificateTranslation.ts` | dead code | DELETE_LATER (after callers proven gone) |
| `docs/audit/` (140), `docs/research/` (92) | stale, contradict current code | KEEP as history; reports/ADR are live truth |
| Tests: `ocr-accuracy`, `passportBookletContract`, consensus mocks | false confidence (source-level / mocked, not live) | add live/E2E fixture parity test |
| 2 preprocessors, `tps/transliterate` dup | maintenance | MERGE |

## Counts
critical: 4 · high: 7 · medium: 6 · low: 4 areas. The single highest-leverage fix is
**ADR-016 (one brain)** — it removes the top critical + several high/medium at once.
