# One Brain intake — LIVE MEASURED on the real Soviet birth certificate (2026-07-09)

Endpoint: `POST /api/diag/intake` (same intake brain the Translation shadow runs). Preview deploy,
`ONE_BRAIN_INTAKE_SHADOW` path. Input: the real handwritten Soviet birth certificate, **NO human hint**
(no docType, no language, no country, no orientation). OpenAI vision providers. HTTP 200, ~14s. PII-FREE
(only types/statuses; no field values).

## Ordered decision (the system self-detected everything)
| Node | Decision | Validates |
|---|---|---|
| preflight | isDocument=true, quality=ok, measured | #4b real preflight |
| orientation | rotationAppliedCw=0, fallback_measured | orientation node |
| language | primary=mixed, bilingual, printedTextPresent=true, **handwritingPresent=true** | **#4a** live signal |
| country | SU / soviet_legacy | country node |
| docType | **ua_birth_certificate_soviet, confidence 1.0** | classify (self, no hint) |
| pageSide | single | **#4c** page-side |
| route | civil_record_reader, **needsHTR=false**, needsHumanReview=true | **#1** (no HTR dep) |
| status | needs_review, reasonCodes=['handwriting_present'] | **#1** (handwriting reason, not provider_unavailable) |

## What this proves
The ordered One Brain funnel (preflight → orient → language → country → type → page-side → reader-route
→ review) runs correctly on the REAL document, fully incognito, every node `measured`. Handwriting is
detected live and drives review; HTR is NOT a dependency; the type is self-detected at confidence 1.0.

## Honest limits
- This is the intake DECISION (OpenAI), NOT field recognition. The recognition path (Gemini) currently
  returns 429 on this preview's Gemini key (rate/spend on that specific key) — separate from intake.
- N=1 (one document). Trust requires N>=25/family (#7/#8) — this is a live PILOT proof, not a trusted metric.
