# One Brain intake scorecard — 21 real docs, no hints (2026-07-09, PII-free)

Ran the 21-doc real-doc-manifest through `/api/diag/intake` (OpenAI providers), no human hints.
| Metric | Result | Note |
|---|---|---|
| docType self-detected (mappable) | 19/19 = 100% | birth/marriage/passport/ead/i94 correct |
| country (SU/UA/US) | correct per row | |
| handwriting detection vs GT (v1 prompt) | 12/21 = 57% | over-flags printed passports (signature) as handwriting |
| errors | 0/21 | stable |

**Finding:** the v1 "any handwriting present" prompt over-triggers on printed passports (their signature).
GT semantics = the DATA fields are hand-filled (birth cert), not any mark. Fix: v2 prompt asks about
hand-written DATA fields, not signatures/stamps. Re-measure pending. Consequence of the FP: extra review
(safe, never auto-final), but imprecise. N=21 = pilot; still below N>=25/family for "trusted".
