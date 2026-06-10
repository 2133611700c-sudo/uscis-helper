# ONE BRAIN — Cyrillic Constitution (the single product schema)

Owner-authored constitution (2026-06-09), mapped node-by-node to the REAL code. This is the canonical
architecture for reading Cyrillic/Ukrainian documents. Stack: **Gemini** (reader), **Google Vision/MRZ** (technical
eye / raw signal), **DeepSeek** (prose only), deterministic **D2 dictionaries**, **C3** gate, **pdf-lib**, Auditor.
NO GPT/Claude/HTR.

Principle (why this matters): OCR/vision is a SEPARATE layer from translation. Cyrillic must NOT be turned into
English before the original is preserved AND the dictionaries have seen it. KMU-55 romanization is defined FROM the
Ukrainian Cyrillic — so **D2 must see `raw_cyrillic`, not already-transliterated Latin.**

---

## The Cyrillic data highway (code-grounded)

```
USER ─► D0 quality ─► D1 Gemini reads CYRILLIC ─► (Vision/MRZ raw signal)
        ─► RAW_CYRILLIC preserved ─► ONE SHARED CORE ─► D2 on raw_cyrillic ─► Canonical Field
        ─► C3 writes final_value|null ─► DeepSeek prose(locked) ─► D4 validators
        ─► D5 review ─► C3 re-run ─► D6 PDF reads final_value ONLY ─► Auditor
```

| # | Constitution node | Real code | Status |
|---|---|---|---|
| D0 | Image quality / reshoot | `ocr/image-preprocess` + `docintel/quality/documentImageQuality` (`QUALITY_GATE_ENABLED`) | CODE_READY_FLAG_OFF |
| D1 | Gemini reads Cyrillic (no model transliteration) | `geminiVisionProvider` → `VisionFieldRead.cyrillic`; default `gemini-3.1-pro-preview`→flash | LIVE (model choice GT-gated) |
| 4 | Vision/MRZ technical eye | `ocr/providers/google-vision`, `canonical/core/mrzAuthority` (MRZ Latin wins in arbitration) | LIVE in TPS/Reparole; translation Core uses docintel only |
| 5 | **RAW_CYRILLIC preserve** | `ExtractedDocField.raw_cyrillic` (set at `documentFieldReader.ts:76`) | **PARTIAL — see GAP A** |
| 6 | One Shared Core (the one door) | `documentFieldReader.ts` ("all 4 products inherit via this one door") + `arbitrateDocument` | LIVE (Core flags ON in prod) |
| 7 | D2 dictionaries / authority | **Door A:** `transliterationPolicy.toCanonicalValue` (city/oblast, on Cyrillic) · **Door B:** `documentFieldReader.ts:93` post-pass `reconcilePatronymicFields`+`resolveAuthorityFields` (`SMART_NORMALIZE_ENABLED`) · **+ my Phase-1** `knowledgeNormalize` at arbitration | **FRAGMENTED — see GAP B/C** |
| 8 | Canonical Field Record | `ExtractedDocField` → `FieldCandidate` → `CanonicalField` | **MISSING fields — GAP A/D** |
| 9 | C3 final gate | `documentSafety/applyOcrFieldSafety` (post-adapter, in routes) | code-ready, flag OFF; **wrong layer — GAP D** |
| 10 | DeepSeek prose (locked fields) | `lib/engine/translator` | LIVE (verify lock — GAP E) |
| 11 | D4 validators | route/generate-pdf validators (Cyrillic-leak, dates, numbers) | LIVE partial |
| 12 | D5 client review | `TranslateWizard` / review-state; reads value+suggested+reasons | LIVE (no crop yet) |
| 13 | C3 re-run after confirm | (contract) C3 re-runs on D5 confirmation | NOT BUILT (Phase 3) |
| 14 | D6 PDF reads final_value only | `generate-pdf` + `hasUnresolvedCriticalForOutput` | reads normalizedValue today — GAP D |
| 15 | Auditor / provenance log | (none) | NOT BUILT (Phase 4) |

---

## The exact GAPS (what blocks the constitution)

**GAP A — `raw_cyrillic` is dropped from the Core record.**
`documentFieldReader.ts:70` runs `toCanonicalValue` INSIDE the read loop → `ExtractedDocField.value` is already
KMU-55 **Latin** (raw_cyrillic kept alongside, `:76`). Then `docintelToCandidate` (`translationAdapter.ts:50`) sets
`FieldCandidate.value = KMU-55 Latin` and **drops raw_cyrillic** — it survives only in a side `cyrillicMap` used for
DISPLAY (`canonicalToFieldOut`). `FieldCandidate`/`CanonicalField` have **no** `rawCyrillic` field. So everything
downstream of the read loop (arbitration, my D2, C3, audit) sees Latin only.

**GAP B — D2 is at the right place for city/oblast, but incomplete there.**
`toCanonicalValue` DOES run dictionaries on Cyrillic for `place_city` (`normalizeCity`→`snapCity`) and `place_oblast`
(`normalizeProvince`) — correct. But for `name` it is just `transliterateKMU55(cy)` with **no RU/UA-spelling check,
no decision**; for `agency` just transliterate; patronymic/authority are a separate Door-B post-pass. And it returns a
bare string — no `KnowledgeDecision` (action/candidate/provenance/evidence).

**GAP C — three D2 layers / two flags (the fragmentation).**
(1) Door A in `toCanonicalValue` + (2) Door B post-pass in `documentFieldReader` (both `SMART_NORMALIZE_ENABLED`) +
(3) my Phase-1 `knowledgeNormalize` at `arbitrateDocument` (`KNOWLEDGE_BRAIN_ENABLED`, wrong layer = Latin). One
concept, three sites, two flags. The rebuild must collapse these to ONE.

**GAP D — no `final_value`; C3 at the wrong layer.**
`CanonicalField` has no `finalValue`; `normalizedValue` (Latin) is de-facto final. C3 (`applyOcrFieldSafety`) runs
AFTER the product adapter on Latin `FieldOut`, re-deriving criticality — it never sees `raw_cyrillic` or the D2
provenance. PDF reads `normalizedValue`. → downstream bypass risk.

**GAP E — DeepSeek field-lock unverified.** Prose translator must not touch names/dates/numbers/authorities; the lock
is asserted but not proven in code.

---

## The realization (ONE unified path — supersedes "thread rawCyrillic into a 3rd layer")

1. **D2 = ONE layer at the one door, on `raw_cyrillic`.** Upgrade `toCanonicalValue` (Door A) + the `documentFieldReader`
   post-pass (Door B) to emit the full `KnowledgeDecision {action, normalized_value, candidate_value, suggested_value,
   rule_id, reason_codes, provenance, evidence_strength}` — covering name (KMU-55 + RU/UA detection + gazetteer),
   place, oblast, patronymic, authority, MRZ-preserve. **Retire my arbitration-level `knowledgeNormalize` duplication.
   ONE flag.**
2. **Carry the original + the decision FORWARD.** Add `rawCyrillic` + the `KnowledgeDecision` fields to
   `FieldCandidate` → `CanonicalField` (stop dropping them; the side `cyrillicMap` becomes redundant). Now C3, D5, and
   the audit log all see the original Cyrillic and the rule that fired.
3. **`final_value` + C3 as the single writer.** Add `finalValue: string|null` (default null). C3 — moved to operate on
   the canonical record (with raw_cyrillic + D2 decision) — is the ONLY writer: `accept_final`→`finalValue=normalized`,
   else null; a D5 confirmation re-runs C3. PDF/D6 reads `finalValue` ONLY; critical null → block.
4. **Provenance/audit log** (Phase 4): booleans + rule_id + reason_codes, NO PII.

Build order (per ADR-017 binding contract): 2.0 reconcile D2 to one door on raw_cyrillic + carry forward → 2.x
Core-default per product → 3 explicit `final_value` + C3 final writer → 4 Knowledge canary (owner GT-gated) + audit log.

---

## Hard prohibitions (from the constitution + audits)

- Never lose `raw_cyrillic` before D2. Never treat KMU-55 in the adapter as final truth.
- D2 never writes `final_value`. Only C3 does (and re-runs after a human confirmation).
- DeepSeek never changes names/dates/numbers/authorities.
- PDF never reads `normalized_value` — only `final_value`.
- No critical field final without source/provenance.
- No per-product reading path (one door: `documentFieldReader`).

## The real problem, stated precisely
Cyrillic IS read and IS stored (`raw_cyrillic`), but it is transliterated to Latin at the read loop and then dropped
from the Core record — so D2 (gazetteer / RU-vs-UA / patronymic / authority) operates on Latin and its accuracy never
reaches the product. The first technical fix is GAP A+C: D2 on `raw_cyrillic` at the one door, carried forward.

## Owner-gated (the recurring blocker)
- Per-class model selection (gemini-2.5-pro DISQUALIFIED for birth certs — false confidence; flash-image correct) and
  any prod enablement of a dictionary layer require ground truth from DIFFERENT people + a measured OFF/ON delta.
