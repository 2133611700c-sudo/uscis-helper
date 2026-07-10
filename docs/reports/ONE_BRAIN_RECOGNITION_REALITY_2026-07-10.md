# One Brain — Recognition Reality (2026-07-10)

**Purpose:** separate two things the roadmap keeps merging into one word — **intake detection**
(what kind of document is this?) vs **field recognition** (what do the fields actually say?).
This is evidence-based, from a code audit of `main`. No new paid calls were made.

## The two systems (different subsystems, different state)

| System | What it does | On main (prod) today |
|---|---|---|
| **A. Field recognition** | declared docType → read field values → arbitrate → C3 writer | **LIVE in production** |
| **B. Intake self-detection** | raw image → self-detect type/language/country/page-side | **NOT wired** (foundation just landed via #4; shadow hook default OFF) |

Knowing *it is a birth certificate* (B) does **not** read the handwritten fields (A). They are
independent. B's "docType 100% on 21 docs" says nothing about A's field accuracy.

## A — Field recognition: what is LIVE on main

- Entry: `readDocument(image, mime, docTypeId)` — `apps/web/src/lib/docintel/documentFieldReader.ts`.
  Called by the Translation, TPS, EAD, Re-Parole routes for UA identity docs.
- Reader model: **`gemini-3.1-pro-preview`** primary (`modelMatrix.ts`); flash = availability
  fallback only, force-reviewed, never an acceptance number (ADR-018, CI-enforced).
- Arbitration: `canonical/core/arbitration.ts` — MRZ authority (0.99), critical-field gate,
  provider-conflict, Knowledge Brain D2 (default ON, conflict-safe, never silent overwrite).
- Single writer: `finalValue` written ONLY by `applyOcrFieldSafety` (C3).

### Auto-fill vs force-review (the safety contract)
- **Printed field:** candidate + confidence; auto-fill allowed only if confidence ≥ 0.95 AND no
  review signal AND doc-class permits; else review.
- **Handwritten field:** `review_required = true` **always**, before any confidence check
  (`documentFieldReader.ts` `isHandwritten(...)`). Never auto-final. Certificates (birth/marriage/
  divorce/death/name-change) declare every field `handwritten:true` → whole doc is human-reviewed.
- Fallback model on a non-Latin doc → all fields force-reviewed (`fallback_model_used`).

## Handwriting status (the real product gate)
- The GA LLM APIs **fabricate** on cursive; `gemini-2.5-flash` was caught reading a *different
  person* on a birth certificate (disqualified for certs). So handwritten fields are **draft-only,
  force-review**, never auto-final. This is a policy, not a solved-OCR claim.
- Key-free HTR (raxtemur) reads cursive better on native-res crops but **cannot abstain**
  (fabricates on blanks) and is **not wired** (host decision parked). So today, for the owner's
  hardest real docs (handwritten Soviet certs), the honest product answer is **"human must read
  this"** — and the pipeline correctly routes there.

## Field-recognition metrics — what EXISTS vs MISSING

**Exists (committed):**
- ADR-018 bench: `gemini-3.1-pro` = 19/22 identity fields on owner GT (2026-06-09).
- Model-disqualification adjudications (2.5-flash wrong-person) — committed in `modelMatrix.ts`.

**Missing (honest gaps):**
- No committed **printed-field value accuracy** number per family at N≥25 (the auto-fillable case).
- No committed **handwritten-field CER/exact** with a fixed GT battery at N≥25 (blocked: HTR host
  parked + GT battery <25/family).
- No committed **review false-negative** rate (a wrong value that slipped past review) at scale.

## Priority implication (blunt)
- docType detection (B) is the **easy** sub-problem and is now near-100% on a small pilot — do not
  keep polishing it.
- The product value is A: **printed-field auto-fill accuracy** (measurable, auto-fillable) and a
  **fast human-review UX for handwriting** (the honest deliverable). Put measurement budget there.
- The one thing that would move handwriting from "review-only" to "assisted-auto" is an HTR host
  decision — currently parked. That is the real fork, not more intake detection.

## Not claimed
Nothing here is new measurement. This report only reconciles what the code and committed reports
already show, so intake detection is never mistaken for field-recognition readiness.
