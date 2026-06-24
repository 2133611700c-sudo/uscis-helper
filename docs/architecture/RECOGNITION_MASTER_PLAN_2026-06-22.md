# Recognition Master Plan — How It Must Really Work + Be Built (2026-06-22)

Built AFTER reading the existing architecture (RULE #1) + reading the owner's real
documents myself + comparing Claude vs Gemini. Grounded, no copy-paste. Every "exists"
claim is proven against code/docs cited inline.

---

## PART 1 — WHAT ALREADY EXISTS (proven, cited — do NOT rebuild)

| Capability | Where | Status (proven) |
|---|---|---|
| Owner constitution D0–D6 | `docs/architecture/ONE_BRAIN_CYRILLIC_CONSTITUTION.md` | the canonical map; lists GAPS A–E |
| `decideField()` unified per-field decision | `docs/architecture/ONEBRAIN_DECIDE_FIELD_CONTRACT.md` | **DESIGN ONLY — not implemented** |
| Per-doc-class `handwritten` flags (defensive) | `documentRegistry.ts` (117 field specs) + `HANDWRITING_RULES_PER_DOCCLASS.md` | LIVE — but DEFENSIVE (forces review), not generative |
| Generic prompt builder | `geminiVisionProvider.buildPrompt(spec)` | LIVE — built from spec.fields; **NO per-doc-class reading rules** (only my R1 handwriting/date rules) |
| KMU-55 / Russian translit, gazetteer, oblast, patronymic, months, country | `packages/knowledge/` | LIVE |
| Dictionary auto-correct (closed-set snap) | `packages/knowledge/autocorrect.ts` | BUILT this session, flag OFF |
| Date-region high-res crop read | `docintel/ensemble/dateRegionRead.ts` | FIXED this session (boxes+Gemini crop+parse) |
| Consensus voting + auto-delivery + safety anchor | `selfConsistency`/`autoDeliveryConsensus`/`strongSourceAnchor` | BUILT, flags OFF; handwritten-date safety guard added |
| C3 critical-null gate | `documentSafety/applyOcrFieldSafety` | LIVE-ready, flag OFF; GAP D (layer) |

**The documented GAPS (constitution, confirmed by me this session):**
- GAP A: `raw_cyrillic` dropped after the read → D2/C3/audit see Latin only.
- GAP B/C: D2 fragmented + incomplete for names (no RU/UA decision on the name field).
- GAP D: C3 at the wrong layer; canonical record missing fields.
- **NEW gap I proved by reading the docs:** (1) NO per-document GENERATIVE reading
  instructions (the prompt doesn't tell the model the Soviet-cert date is a cursive WORD,
  червня=June, names may be Russian, etc.); (2) NO cross-document reconciliation (the
  passport MRZ date that settles every other doc is never used).

---

## PART 2 — HOW TOP DOCUMENT-AI TEAMS SOLVE THIS (best practice)

1. **Document-type-specific extraction schema + instructions** (Google DocAI custom
   processors, AWS Textract queries, Azure custom models): each doc type has its own field
   schema AND its own reading guidance. → we have the schema (registry), NOT the guidance.
2. **Field-level validation against formats/closed vocabularies** (a date is DD-MM-YYYY in
   range; an oblast is one of 24; a passport № matches a regex). → partly (autocorrect).
3. **Cross-field + CROSS-DOCUMENT consistency** — the single biggest accuracy lever in
   multi-doc KYC/identity pipelines: a high-confidence anchor (MRZ, barcode) propagates to
   resolve low-confidence reads of the SAME entity elsewhere. → **MISSING entirely.**
4. **Confidence calibration + targeted human-in-the-loop** — auto-deliver high-confidence,
   one-click confirm low-confidence; never silent-wrong. → built (consensus+gates).
5. **Region/crop extraction for dense or handwritten fields** — read each field's zoomed
   crop, not the downscaled page. → started (dates); generalize to all hard fields.
6. **Ensemble / self-consistency** — read K×, vote; disagreement → review. → built.
7. **Feedback loop** — human corrections become labeled data that tunes prompts/thresholds.
   → Auditor designed, not built.

---

## PART 3 — TARGET vs CURRENT (the gap to close)
| Dimension | Target (best practice) | Current | Action |
|---|---|---|---|
| Reading guidance | per-doc-class instructions in the prompt | generic prompt | **STAGE 1 (teach)** |
| Field validation | format + closed-vocab + plausibility | partial autocorrect | STAGE 2 |
| Cross-document | MRZ/anchor propagates to all docs | none | **STAGE 3 (biggest lever)** |
| Hard-field read | per-field high-res crop | only dates | STAGE 4 |
| raw_cyrillic | preserved end-to-end | dropped (GAP A) | STAGE 5 |
| Auto-fill / review | calibrated, safe | built, OFF | STAGE 6 (measure→flip) |

---

## PART 4 — THE BUILD PLAN (how it must really work)

**STAGE 1 — TEACH THE BRAIN: per-document reading instructions (THE teaching stage).**
This is where I encode HOW I read each document into rules the Gemini prompt + D2 use.
For EVERY document class, write a meticulous rule block (see PART 5). Inject it into
`buildPrompt(spec)` keyed by `spec.id`. Flag-gated, measured on the real docs.
→ Output: `packages/knowledge/src/docReadingRules.ts` (data) + prompt wiring + tests.

**STAGE 2 — Field validators per doc** (format/vocab/plausibility) wired into D2/validators.

**STAGE 3 — Cross-document reconciliation** (the biggest lever): a per-person "identity
ledger" — the MRZ-anchored passport date/name/place becomes the authority that resolves
ambiguous handwritten fields of that person's other documents.

**STAGE 4 — Generalize high-res crop read** from dates to names/patronymic/place.

**STAGE 5 — Fix GAP A** (carry raw_cyrillic end-to-end) so D2/C3 see Cyrillic.

**STAGE 6 — Measure on real docs + per-field flip** of auto-delivery once accuracy clears a bar.

**STAGE 7 — Test everything** (unit + the real-doc harness) at each stage; no regression.

---

## PART 5 — THE TEACHING ARTIFACT (per-document, per-field rules — the heart)

The brain is taught via a structured rule set, one block per document class, each field
carrying: how to read it, the script/language expectation, the format, the closed vocab,
the cross-checks, and the failure modes I observed. Example (grounded in my real reads):

### ua_birth_certificate (Soviet/vintage, handwritten)
- LANGUAGE: may be RUSSIAN (Soviet-era) — transcribe AS WRITTEN (Соловьяк/Андрей), do NOT
  Ukrainianize; flag RU/UA for the canonical-name policy, never silently convert.
- DATE OF BIRTH: usually SPELLED OUT in cursive WORDS ("двадцать пятого июня …"), NOT digits.
  Read the whole month WORD (червня/июня=June 06, липня/июля=July 07 — do NOT confuse adjacent
  months). Day may be a word ("двадцать пятого"=25) or ambiguous digit → low confidence.
- CROSS-DOC: if a passport/MRZ for the same person exists, its checksummed DOB is authoritative.
- PARENTS / CERT №: read father/mother full names + "II-БК № …" series.
- Place: "пгт/смт <name>, <raion> район, <oblast> область" → settlement designator + gazetteer.

### ua_international_passport (printed + MRZ)
- Latin is CONTROLLING: return the printed romanization EXACTLY (SERGII, not KMU-55 ANDRII).
- MRZ is the math anchor: parse YYMMDD + check digits; it WINS and validates DOB/sex/№.

### ua_military_id (handwritten, often rotated)
- Ukrainian forms (Андрій/Андрійович). Date = cursive word month + digit day. Series "СО ######".
  Rotated 90° common → orientation-tolerant.

### ua_marriage_certificate / ua_divorce_certificate
- Modern = printed (high accuracy); vintage = handwritten. Both spouses + act № + serial + RAGS office.

(…one block PER class, each field meticulous — this file is the spec; STAGE 1 turns it into code.)

---

## PART 6 — ORDER OF EXECUTION
1. STAGE 1 (teach: per-doc reading rules → prompt) — start here; measurable, highest near-term ROI.
2. STAGE 3 (cross-document reconciliation) — biggest single lever.
3. STAGE 4 (generalize crop read) + STAGE 2 (validators).
4. STAGE 5 (raw_cyrillic) + STAGE 6 (measure → flip) + STAGE 7 (test throughout).

Every stage: read the existing report first (RULE #1); flag-gated default OFF; prove
flag-OFF parity; measure on the real-doc harness; no prod flip without owner.
