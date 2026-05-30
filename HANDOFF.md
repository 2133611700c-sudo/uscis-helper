# HANDOFF — Session 67 (2026-05-30)

## Session 67 — Normative-base inventory + glossary consolidation P1 (branch `refactor/consolidate-glossary-p1`, off main)

Owner asked to inventory the whole normative base, map responsibilities, then consolidate per the SoT mandate.

**Inventory:** `docs/architecture/NORMATIVE_BASE_INVENTORY.md` — every dictionary (canonical `packages/knowledge` vs parallel `apps/web/.../glossary` + `tps/dictionaryBridge`), every function (lookupAuthority/translateCivilRegistryTerm/transliterateKMU55/agencyGlossary/…), agents (ADR roles), documents (8 modules — all draft except passportBooklet active), the dependency map (TWO brains: engine→registry vs live modules→parallel glossary), and the phased P1–P5 consolidation plan with per-phase acceptance.

**P1 DONE:** deleted the byte-identical duplicate `glossary/civil_registry_terms.json`. Proven DEAD: `glossaryFiles:[...]` is declarative metadata only — no importer, no dynamic file loader; the live resolution is knowledge `translateCivilRegistryTerm`. Module tests 498 pass, full web pass, tsc 0, content-guard 0.

**NEXT (phased, each green):** P2 migrate `ukraine_agency_abbreviations.json` (57) into `registry.csv` + repoint `agencyGlossary` to registry; P3 `glossaryLoader` FULL_GLOSSARY → registry; P4 `dictionary.ts`/`dictionaryBridge` data → registry; P5 single `registryLookup` resolver for engine + modules.
# HANDOFF — Session 69 (2026-05-30)

**Update (garbage guard):** added `packages/knowledge/garbageGuard.ts` (shared) — rejects label-as-value/`„ Пріз`/punctuation/too-short; wired into Translation extract + TPS merge/hydration. Rotated booklet now → honest manual-entry, not garbage. garbageGuard 4/4. Report: docs/reports/LIVE_BOOKLET_RECOGNITION_FAILURE_ROOT_CAUSE.md. Remaining: orientation auto-rotate, source-evidence/payment block, TPS per-doc-session id.

## Session 69 — Live-fix part 1: Translation session isolation (branch `fix/live-session-isolation`, off main)

First (highest-value) cut of the critical live failure. ROOT CAUSE of the stale `Шуляк/Сергій/Проскурів`: the Translation wizard restored `extractedFields` from `sessionStorage tw:v2:draft` on EVERY mount (only skipped review/payment/success screens). A fresh visit therefore showed a previous session's fields as if recognized for the current upload. Fixed: the restore now early-returns unless `?paid=1` (Stripe round-trip). `handleFiles` already clears fields on a new upload. `sessionIsolation.test.ts` 2/2; full web pass; tsc 0; content-guard 0.

**🔴 REMAINING live-fix (next):** (1) TPS wizard `localStorage wizard:tps-ukraine:v2:state` same isolation; (2) orientation gate — rotate 0/90/180/270, score anchors (Прізвище/Ім'я/По батькові/Дата народження/Місце народження), block if low; (3) garbage guard — reject label-as-value (`„ Пріз`, punctuation-only, too-short); (4) source-evidence gate — no bbox/page_type/rotation → not shown as recognized; (5) hide payment/signature CTA when critical fields unsafe. Report to write: `docs/reports/LIVE_BOOKLET_RECOGNITION_FAILURE_ROOT_CAUSE.md`.

---

