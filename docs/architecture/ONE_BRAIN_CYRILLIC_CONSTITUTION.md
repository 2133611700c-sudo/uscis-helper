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

## Historical failure mode vs current invariant (do NOT conflate — Phase 2 merged)
**Historical failure (pre-Phase-2, FIXED):** `raw_cyrillic` was transliterated to Latin at the read loop and dropped
from the Core record before D2 saw it — so D2 (gazetteer / RU-vs-UA / patronymic / authority) operated on Latin and
its accuracy never reached the product.
**Current INVARIANT (must hold forever):** `raw_cyrillic` must never be dropped before D2/C3. It flows
`FieldCandidate → CanonicalField → D2 (on raw_cyrillic) → C3`. Any code path that transliterates-then-discards the
Cyrillic before D2 is a regression of this invariant, not a style choice.

## Owner-gated (the recurring blocker)
- Per-class model selection (gemini-2.5-pro DISQUALIFIED for birth certs — false confidence; flash-image correct) and
  any prod enablement of a dictionary layer require ground truth from DIFFERENT people + a measured OFF/ON delta.

---

# PART II — THE LAWS (owner-directed 2026-06-10; the rules the agent cannot drift past)

These turn the layer-scheme above into enforceable law. Where a clause is tagged **⚠ OWNER-CONFIRM**, the agent
proposed a resolution to a conflict between two owner rules; the owner may veto it.

## LAW 1 — TRANSLITERATION
- **UA visible source** → Ukrainian official / **KMU-55**: Сергій→Serhii, Сергійович→Serhiiovych, Леонідович→Leonidovych.
- **RU visible source** → **BGN/PCGN simplified**: Сергей→Sergey, Сергеевич→Sergeyevich, Леонидович→Leonidovich.
- **Ambiguous source** (no distinctive letter і/ї/є/ґ nor ы/э/ё/ъ): `review_required=true`, `final_value=null`.
  Document context MAY suggest a candidate; document context CANNOT final.
- Code: `transliterateKMU55` / `transliterateRussian` / `isNameSourceScriptAmbiguous` (`transliterationPolicy.ts`),
  gate in `documentFieldReader.ts`, behind `RU_TRANSLIT_ENABLED`. Source script controls; never harmonize across lines.

## LAW 2 — SOURCE OF TRUTH (precedence when sources conflict)
1. **MRZ / official-Latin field** controls the APPLICANT's own identity SPELLING/romanization where MRZ provides that field.
   "controls" = romanization authority for the applicant; it does NOT license filling an *illegible field on another
   document* from MRZ — there MRZ is candidate-only (LAW 4 / visual-evidence rule wins). (RULED 2026-06-10.)
2. **Visible source line** controls relatives / parents / spouses (as-written, per their line's script).
3. **`raw_cyrillic`** controls transliteration (never the model's own Latin).
4. **D2 dictionaries** suggest / validate (never final).
5. **User correction** is evidence C3 weighs — authority depends on field criticality (LAW 2#5 RULING below).
6. **C3** decides `final_value`.
7. If conflict remains → `final_value=null`.

### LAW 2#5 RULING — tiered user/certifier authority (owner, RULED 2026-06-10)
Two inputs look identical to C3 — (a) illegible-to-machine-but-legible-to-human (user types the true value) and
(b) illegible-to-everyone (user types whatever). On critical identity, (b) is a direct immigration-fraud vector, and
certified translation means the CERTIFIER attests "complete and accurate", not the applicant. So authority is tiered:

```
User confirmation = evidence weighted by C3. Authority depends on field criticality:

  Non-critical fields (issuing office, secondary witness, registration number):
    user_confirmed CAN finalize an otherwise-null field
      + provenance=user_confirmed
      + audit event (timestamp, session, IP)
      + PDF metadata flags the field
      + certification text acknowledges user-provided fields

  Critical identity fields (applicant DOB, surname, given name, document number, nationality):
    user_confirmed CANNOT finalize alone
    Path to finalize = certifier_override
      (authorized certifier confirms reading from the source document,
       takes attribution on the certification line,
       audit trail records certifier identity)

  Cross-document anchor (MRZ from passport, machine fields from EAD):
    ALWAYS overrides user_confirmed on critical identity fields
    Conflict between user_confirmed and anchor → block, escalate
    (passport says SERHII, user typed OLEKSANDR → block, NOT override)

  Transitional: certifier role = owner-only until a delegated certifier role is
  designed and approved (separate ADR-021). Owner-only is a launch mechanism,
  NOT permanent architecture — it is a throughput bottleneck at scale.
```

**OPEN SUB-QUESTION (agent-flagged, for ADR-021):** the critical-identity list above names the APPLICANT's own fields.
Do relatives/parents/spouses (father/mother on a birth cert) require `certifier_override`, or are they `user_confirmed`?
A wrong parent name is a weaker fraud vector but still a certified-accuracy defect. Not decided here.

This maps to USCIS-grade practice: the translator/certifier signs "complete and accurate" (8 CFR 103.2(b)(3)) — the
significant claim is the certifier's, not the client's. The user confirms they provided the original; the certifier
confirms they read it. The mirror PDF's TRANSLATOR'S CERTIFICATION block is where `certifier_override` attribution lands.

## LAW 3 — HANDWRITING
- A handwritten CRITICAL field cannot be silently final.
- If a stamp / fold / blur overlaps a name / patronymic / date → `review_required=true`, `final_value=null` unless C3 has
  strong independent evidence.
- **Reading a date correctly does NOT validate parent names. Each field has independent confidence.** (This is the parent-name bug.)
- Code: handwritten classes are `always_review`; `applyDateRoleGuard`; no cross-field confidence borrowing.

## LAW 4 — VISUAL EVIDENCE
- Label context determines field ROLE. Visual evidence determines field VALUE.
- Cross-document / cross-engine agreement raises CONFIDENCE and may surface a CANDIDATE — it never replaces visual
  evidence and never finalizes an illegible value. Code: `visualEvidenceRule.test.ts`.

## LAW 5 — PRIVACY (no real user PII anywhere)
- No real surname / given name / patronymic / date / document number in: tests, docs, logs, PRs, reports, screenshots,
  benchmark outputs. Use only synthetic **Іваненко / Иваненко / Ivanenko**. A real PII leak = RESULT FAIL, stop.

## LAW 6 — CRITICAL FIELDS (configured per doc type; code is the single source of truth)
- The per-doc-type critical list lives in CODE, not only in `.md` (`CRITICAL_FIELDS_CONTRACT.md` is the human mirror).
- **GAP (open):** `classifyCriticality` is currently a GENERIC substring match, not per-doc-type — md and code can drift.
  L0 task: make criticality per-`document_class` in code, with `CRITICAL_FIELDS_CONTRACT.md` generated from / checked against it.
- Birth cert: child full name, DOB, birth place, father, mother, registry No., issuing authority, issue date, series/No.
- Passport: surname, given name, DOB, sex, passport No., citizenship, issue/expiry (if used).
- EAD / I-94 / I-797: name, DOB, A-number / admission No., category / status, validity dates.

## LAW 7 — DeepSeek BOUNDARY
- DeepSeek translates **prose only, AFTER** identity fields are locked by C3.
- DeepSeek does NOT: receive raw identity candidates as authority · change identity fields · translate names · fix dates.
- Code today: invariant in `C3_USER_CORRECTION_CONTRACT.md:64` + ADR-018. **L0 task:** make it a CHECKABLE lint/test
  (DeepSeek output can never reach `final_value`), not only a comment.

## LAW 8 — AUDIT TRAIL (durable, minimal, no public PII)
- For every released translation, store a durable minimal record: document type, field names, source type, D2 decision,
  C3 decision, user-confirmation event, `final_present` yes/no, blocked reason, payment/release event — **no public PII** (Tier 0).
- Status: ADR-019 designed (Tier 0 default; Tier 0 ≠ legal evidence); **persistence NOT built** (L3 task).

---

# PART III — MATURITY MAP (L0–L4) & build order (owner 2026-06-10)

Rule: **do not build layer N+1 until N is ≥80% closed.** Building HTR (an L4 capability) on a thin L1 is the canonical early-safety error.

| Layer | What | Est. status | Open items |
|---|---|---|---|
| **L0** Safety primitives | finalValue, confirmedValueGuard, source-script gate, anchor cross-check | ~75% | criticality-per-doc-in-code (LAW 6), DeepSeek lint (LAW 7), gazetteer honest coverage |
| **L1** Operations | observability, kill-switch, 422, refund, runbook, rollback | **~45%** (repo-verified, NOT 10%) | refund policy + auto-ticket; guard-block **rate alert**; (opt) true kill-switch |
| **L2** Evidence | GT runner N≥30, per-class thresholds, wrong-person category, canary gate in CI | ~10% | runner code (agent) + **GT fixtures from ≥5 people/class (OWNER, encrypted, not in git)** |
| **L3** Legal/audit | audit persistence, retention, PII-at-rest, subpoena export, DPA | ~5% | persistence (ADR-019) + legal review |
| **L4** Continuous safety | adversarial suite, drift detection, quarterly review | 0% | not yet — after L1–L3 |

**Next session opens with L0/L1, not HTR.**

### HTR ROLLOUT THRESHOLD (defined NOW, before it is approached — owner 2026-06-10)
> HTR rollout is considered ONLY when handwriting-related field-failures exceed **15%** of total critical-field
> failures over a rolling **100-document** window, **AND** ADR-020 (HTR data-handling) is locked.

The number exists BEFORE we approach it, so "enough" is a threshold decision, not a retrospective self-justification.
15% / 100-doc are owner business numbers (adjustable by the owner, not the agent). This also creates a concrete L1
instrumentation requirement: we must COUNT handwriting-related critical-field failures per rolling window — which today
we do not (the telemetry gap that makes any HTR-priority claim unprovable right now).
