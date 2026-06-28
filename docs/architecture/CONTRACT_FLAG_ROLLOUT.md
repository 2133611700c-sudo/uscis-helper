# Unified Document Contract — Feature Flag Matrix & Rollout (Workstream G)

All flags **default OFF** → byte-identical legacy behavior (OFF golden `sha256 89611c7a…`).
Production stays OFF until staging E2E passes + owner sign-off.

## Matrix
| Flag | Default | Depends on | Affects | OFF behavior (rollback) | Coverage |
|---|---|---|---|---|---|
| `UNIFIED_DOC_CONTRACT_ENABLED` | OFF | — | KEY_ALIASES + buildMirrorValues source, mirror extra labels, review annotation (contract_review_state/evidence_only), raw→PDF closure (`shouldBlockRawPdfFallback`) | legacy literal maps + humanized labels; no annotation; raw fallback intact | phase3/phase4/annotate/contractReviewState tests |
| `UNIFIED_DOC_CONTRACT_SPLIT_ENABLED` | OFF | CONTRACT_ENABLED (for labels) | vision-extract split rows (Phase 6); mirror split rows (Workstream C) | no split fields; identity | phase5/phase6/phase10c tests |
| `UNIFIED_DOC_CONTRACT_NORMALIZE_ENABLED` | OFF | SPLIT_ENABLED | knowledge-normalize split fields (Phase 7) | split rows carry structural value only | phase7 tests |
| `FINAL_PDF_CONFIRMATION_GATE_ENABLED` | OFF | — (independent) | `assertDocumentReadyForFinalPdf` on generate-pdf + render | legacy gates only; not enforced | finalPdfGate negative battery + route invariant |
| `MIRROR_PDF_ENABLED` | (birth cert ON by default via MIRROR_READY set) | — | mirror vs generic PDF | generic certification PDF | existing mirror tests |

## Staging rollout order (enable on staging only, never prod without sign-off)
1. `UNIFIED_DOC_CONTRACT_ENABLED` (contract base: aliases/labels/annotation — proven byte-identical)
2. `UNIFIED_DOC_CONTRACT_SPLIT_ENABLED` (split fields)
3. `UNIFIED_DOC_CONTRACT_NORMALIZE_ENABLED` (normalize split via knowledge)
4. Review integration verified (split fields + states in UI)
5. `FINAL_PDF_CONFIRMATION_GATE_ENABLED` (confirmation boundary)
6. PDF rendering of split fields verified (ON golden)
7. Full DB-backed staging E2E (runbook) PASS
8. Staging enablement sign-off
9. Owner sign-off
10. Production rollout (flags flipped in Vercel project env)

## Rollback
Set any flag to `0` / unset → that layer reverts to legacy immediately (additive design;
no data migration to undo). Each flag is independently reversible.

## Metrics to watch (PII-free, Workstream H events)
`final_pdf_blocked` rate, `review_required` rate, `provider_model_mismatch`,
`schema_validation_failed`, `canonical_adapter_failed`, extraction latency.
