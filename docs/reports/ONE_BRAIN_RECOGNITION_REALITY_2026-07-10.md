# One Brain — Recognition Reality (2026-07-10)

**Purpose:** separate two things the roadmap keeps merging into one word — **intake detection**
(what kind of document is this?) vs **field recognition** (what do the fields actually say?).
This is evidence-based, from a code audit of `main`. No new paid calls were made for this report.

## The two systems (different subsystems, different state)

| System | What it does | On main (prod) today |
|---|---|---|
| **A. Field recognition** | declared docType → read field values → arbitrate → C3 writer | **LIVE in production** |
| **B. Intake self-detection** | raw image → self-detect type/language/country/page-side | **LIVE in Preview shadow/diag only; not trusted for production decisions** |

Knowing *it is a birth certificate* (B) does **not** read the handwritten fields (A). They are
independent. B's "docType 100% on a pilot" says nothing about A's field accuracy.

## A — Field recognition: what is LIVE on main

- Entry: `readDocument(image, mime, docTypeId)` — `apps/web/src/lib/docintel/documentFieldReader.ts`.
  Called by the Translation, TPS, EAD, Re-Parole routes for UA identity docs.
- Reader model: primary printed-field path lives in the current runtime matrix; availability
  fallbacks remain force-reviewed and are never acceptance numbers (ADR-018, CI-enforced).
- Arbitration: `canonical/core/arbitration.ts` — MRZ authority, critical-field gate,
  provider-conflict, Knowledge Brain D2 (default ON, conflict-safe, never silent overwrite).
- Single writer: `finalValue` written ONLY by `applyOcrFieldSafety` (C3).

### Auto-fill vs force-review (the safety contract)
- **Printed field:** candidate + confidence; auto-fill allowed only when the route and field class
  clear their review gates. Otherwise: review.
- **Handwritten field:** `review_required = true` **always** before any confidence claim.
  Certificates (birth/marriage/divorce/death/name-change) therefore remain human-reviewed.
- Fallback model on a non-Latin doc → all fields force-reviewed (`fallback_model_used`).

## Handwriting status (the real product gate)

- The direct LLM image-reader path is **not** acceptable as a handwritten primary. Handwriting is
  still **draft-only, force-review**, never auto-final.
- Key-free HTR research exists, but the host/runtime decision is still parked. So today, for the
  hardest real docs (handwritten Soviet certs), the honest product answer remains:
  **"human must review this"**.

## Field-recognition metrics — what EXISTS vs MISSING

**Exists (committed reality):**
- runtime safety contract for review-required handwritten output
- model disqualification evidence for unsafe handwritten behavior
- CI/build/unit proofs that the field-recognition code compiles and is wired

**Missing (honest gaps):**
- no committed **printed-field value accuracy** number per family at `N>=25`
- no committed **handwritten CER/exact** battery at `N>=25`
- no committed **review false-negative** rate at scale

## Priority implication

- Intake detection (B) is now on `main` and has live Preview proof. That integration job is no
  longer the blocker.
- The product value is still A: **printed-field auto-fill accuracy** plus a **fast human-review UX
  for handwriting**.
- The real fork from "review-only" to "assisted-auto" remains an HTR runtime decision, not more
  intake detection polish.

## Not claimed

This report does not claim new accuracy numbers. It only prevents future status reports from
mistaking intake detection readiness for field-recognition readiness.
