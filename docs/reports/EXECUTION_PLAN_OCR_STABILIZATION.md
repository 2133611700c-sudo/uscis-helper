# EXECUTION_PLAN — OCR Stabilization + Gemini Vision Arbiter

**Date:** 2026-05-27
**Purpose:** Capstone. Ends the 5-round provider debate. This is what we build, in order, grounded in the actual codebase. No fluff. Worst cases included.
**Status:** Plan. No runtime code changed yet. P0 can start immediately (no API key needed). P1 needs a Gemini paid key + multi-person fixtures.

---

## A. MAXIMALLY CRITICAL FINDINGS (what is STILL unaddressed after 5 rounds)

### 🔴 CRIT-1 — The fixtures are N=1. This breaks the entire validation premise.
Verified contents of `qa-shots/private/`:
```
1.jpg 2.jpg 3.jpg 4.jpg booklet_test_resized.jpg   ← all = ONE booklet (REDACTED)
Passport Sergii REDACTED.jpg, I94 Sergii REDACTED.jpg ← same person
*_rot90/180/270.jpg ← SYNTHETIC rotations of the same images
```
**Every fixture is one person — the owner.** STATUS.md already confessed this: *"only one real canonical identity + synthetic transforms."* Handwriting is per-person. Proving Gemini reads **Sergii's** "Сергійович" correctly proves **nothing** about any other user's handwriting. **WORST CASE: P1 passes on the owner's document, we flip the flag, and it fails on every real applicant.** This is the textbook self-deception and it is currently baked in. → **No "P1 success" claim is valid until ≥3 different people's booklets are tested.** Until then every result is labeled `N=1, DIRECTION ONLY, NOT VALIDATED`.

### 🔴 CRIT-2 — The Gemini 2.5 Flash price in the matrix is wrong (again).
The pasted matrix uses **$0.075 / $0.30**. That is **Flash-Lite / 2.0 Flash**, not 2.5 Flash. Verified twice from Google's own pricing: **Gemini 2.5 Flash = $0.30 in / $2.50 out per 1M tokens**. Per-field cost is ~$0.00025, not $0.000058 — understated ~4–5×. Economics still win (<0.3¢/doc), but a unit-economics model built on the wrong number is sand. **Pin the exact model ID + price before integration.**

### 🔴 CRIT-3 — The experiment is unfalsifiable without ground truth.
To say "accuracy improved" you need the **correct Cyrillic per field per fixture**, hand-verified. We have it for the owner's doc. For new people's docs, **Sergii must hand-transcribe truth first**. Without it, "Gemini returned Сергійович" is indistinguishable from a confident hallucination. No ground truth = no experiment, only vibes.

### 🔴 CRIT-4 — `review_required=true` must mean the field renders EMPTY, not pre-filled.
If a handwritten name comes back `review_required` but the UI **pre-fills Gemini's guess**, the user rubber-stamps a confident hallucination and review is theater. Law: handwritten identity fields are shown **blank/unconfirmed** until the user explicitly confirms or types. The candidate value may be offered as a suggestion, never as the default accepted value.

### 🟠 CRIT-5 — Latency regression risk (we just fixed a hang this session).
We removed rotation loops *today* because uploads **hung**. Six **serial** Gemini calls re-introduce 6–15s. → Calls must run **in parallel**, each with a **5s timeout**, total OCR budget **<15s**, and **Gemini failure → fall back to the OCR value + review_required, never block**. The pasted "max 6 calls" cap says nothing about serial-vs-parallel — that omission would recreate the hang.

### 🟠 CRIT-6 — readinessPolicy consolidation has a blast radius the plan understates.
The three lists differ (verified): `centralBrain.REQUIRED_FOR_GENERATE` requires `status_at_last_entry`; `mailReadyGate.REQUIRED_FIELDS` requires address/phone/email/marital_status; `isMinimallyComplete` requires `part7_reviewed`. **Blind union → the generate button never appears (over-block). Blind intersection → drop a check that catches real USCIS RFEs (under-block).** → It must be a **per-stage policy** (`required_for_merge` / `required_for_mail` / `recommended`), a conscious decision per field — not a flat merged list.

### 🟠 CRIT-7 — P1 behind a flag does NOT fix the live browser bug.
Flag default OFF = nothing changes for users. The "Сергійович/Prostianets wrong in browser" is fixed **only when the flag flips ON in production**, which is gated on CRIT-1 (multi-person validation). **This plan ships a test harness, not a user-visible fix.** Anyone who thinks the browser bug is closed by P1 is wrong.

### ⚪ CRIT-8 (meta) — 5 rounds of strategy, 0 lines of fix. Analysis paralysis is now itself the risk.
The architecture is decided. Every round since round 2 has reached the same answer. Continuing to debate providers is now more dangerous than executing. **Build P0 + P1, measure on real multi-person data, decide from numbers.**

---

## B. WHAT WE ALREADY HAVE (so P1 is not greenfield)

| Need | Already exists | Location |
|---|---|---|
| Provider abstraction | `googleVisionProvider`, `docAIProvider`, `processDocAI` | route.ts / providers |
| Exact insertion point | `runDualOcrCrossref()` call | `route.ts:227` (passport), `route.ts:484` (booklet) |
| Crop feasibility | bbox **normalized 0–1** (`OcrBoundingBox`) + `OcrPage.width/height` in px + `sharp` already imported | `lib/ocr/types.ts`, route.ts |
| Field location | `lineMatchesLabel()` finds label line + its bbox → crop around it | `passportBooklet.ts` |
| Feature-flag pattern | `process.env.DUAL_OCR_CROSSREF !== 'false'` | route.ts:227,484 |
| Cost/audit sink | `tps_ocr_audit` Supabase table via `ocrAudit.ts` | `lib/tps/ocrAudit.ts` |
| Candidate→decision→final | Central Brain + Review Gate | `centralBrain.ts`, wizard |

**Conclusion:** P1 = swap the *internals* of the existing booklet crossref (DeepSeek-on-text) for Gemini-on-image. The crop, flag, audit, and decision layers already exist. This is days, not weeks.

## C. WHAT IS NEEDED (the real gaps)

1. **3–5 DIFFERENT people's booklets** (BLOCKER for *validation*, not for *building*). Without this, P1 cannot be declared a success.
2. **Ground-truth JSON** per fixture (Sergii hand-transcribes correct values).
3. **Gemini paid API key** (`GEMINI_API_KEY`, paid tier — no free tier for PII).
4. **ADR-009 sign-off**: sending crops to Gemini = sending PII images to Google. Confirm paid-tier no-train + retention policy, same audit as existing providers.

---

## D. STRUCTURE — exactly how we do it, in order

### Phase 0 — One readiness policy (no API key, no fixtures, start NOW). ~1 day.
- New `lib/tps/readinessPolicy.ts`: one field list, each tagged `{ stage: 'merge' | 'mail' | 'recommended', conditional?: fn }`.
- Refactor `centralBrain` readiness, `mailReadyGate`, `isMinimallyComplete` to import it. Delete the three local literals.
- Test that **fails the build** if any other "required" literal exists or the lists diverge.
- **Why first:** fixes the "button appears/disappears" chaos *regardless* of OCR. Unsexy, highest certainty, zero external dependency.

### Phase 1 — Gemini vision arbiter, flag OFF. ~1–2 days (after key).
- New `lib/tps/ai/geminiVisionArbiter.ts` + crop util (`sharp.extract` from normalized bbox × page px).
- Wire into route.ts booklet case behind `TPS_GEMINI_VISION_ARBITER_ENABLED` (default `false`), replacing the DeepSeek-text crossref for handwritten fields. Vision/DocAI texts become **hints**, not the answer.
- **Per-field input:** identity-zone crop (no page model yet — see CRIT, send the whole identity spread, not a guessed pixel box) + field label + 2 OCR candidate texts + strict instruction *"do not guess; return can_read=false if unclear."*
- **Output:** strict JSON candidate `{field, value, can_read, confidence, model_tier, evidence_region, reason, review_required}`. `review_required=true` always for handwritten identity.
- **Guardrails (from CRIT-5):** calls parallel; 5s timeout each; max 6/doc; max 2 Pro escalations; Gemini fail → OCR value + review, never block.
- **Cost:** logged into `tps_ocr_audit` (extend schema: gemini_flash_calls, gemini_pro_calls, est_cost). No PII/image in logs.

### Phase 2 — Proof, honestly labeled.
- `docs/reports/GEMINI_VISION_ARBITER_PROOF.md`: before/after per field per fixture.
- **Labeled `N=1` until ≥3 different people exist (CRIT-1).**
- **Flag flips ON in prod ONLY if:** ≥3 distinct people, accuracy up vs baseline, **zero fabricated critical fields**, costs recorded, review enforced (CRIT-4). Owner approval required.

### Phase 3+ — only after P1 validated.
Certificate parsers (Gemini Flash structured JSON), provider router (Class A printed / Class B handwritten), then one-time benchmark of Azure/ABBYY/GPT/Claude/Mistral as escape hatches. Page-type detection folds in here.

---

## E. WORST-CASE TABLE

| Worst case | Trigger | Control |
|---|---|---|
| Ship on N=1, fails for real users | declare P1 success on owner's doc | ≥3 distinct people before flag ON |
| Confident hallucinated name accepted | UI pre-fills Gemini guess | review fields render EMPTY until confirmed |
| Upload hangs again | 6 serial Gemini calls | parallel + 5s timeout + fail→fallback |
| Generate button never appears | blind readiness union | per-stage readinessPolicy + divergence test |
| Cost blows up | full page → Pro | crop-only; Flash-first; max 2 Pro; cost logger |
| PII leak | image/raw text in logs | metadata + cost only; ADR-009 audit |
| Vendor lock-in / Gemini degrades | single runtime provider | Vision/DocAI stay; research-only fallbacks |
| Browser bug "still broken" surprise | flag OFF mistaken for fix | explicit: P1 = harness, not user fix |

---

## F. CORRECTED ROLE MATRIX (Flash price fixed)

| Layer | Provider | Verified tariff | Status |
|---|---|---|---|
| MRZ | local parser | $0 | active |
| Base OCR + layout/bbox | Google Vision + DocAI | $1.50/1k pages | active |
| Vision arbiter | Gemini 2.5 Flash → Pro on low-conf | **Flash $0.30 in / $2.50 out per 1M** (NOT $0.075/$0.30) | P1, flag OFF |
| Certificate parser | Gemini 2.5 Flash structured | ~0.25¢/doc | P5 |
| Text helper | DeepSeek (text only) | $0.14/$0.28 per 1M | active, demoted |
| Printed translation | Google Translation Hub basic + glossary | $0.15/page | P7 |
| Benchmark/fallback | Azure, ABBYY, GPT, Claude, Mistral | — | research-only |
| Excluded | AWS Textract | — | no Ukrainian |

Realistic per-document API cost at correct prices: **~0.3–0.6¢** (still 15–150× cheaper than any SaaS substitute, which can't do field extraction anyway).

---

## G. THE GO DECISION
Start **Phase 0 now** (no key, no fixtures needed). It removes the worst self-conflict (3 readiness gates) and is pure win. Start **Phase 1** the moment the Gemini key + multi-person fixtures arrive. Do not flip the flag in production until Phase 2 passes on ≥3 real people. Stop analyzing; execute and measure.
