# OCR Availability Monitor Fix — 2026-09-15

Status: **PASS (local contract tests); live scheduled proof pending merge**

## Incident

The hourly `OCR Availability Probe` repeatedly failed even though production
answered HTTP 200. The body was `ok:false`, `fields:[]`, `review_required:true`
without a typed provider error.

## Root cause

The route deliberately uses HTTP 200 for safe, expected no-read outcomes so the
client can ask for review or a better scan. The workflow only accepted
`HTTP 200 + ok:true`, so it treated the route's documented no-read contract as an
availability outage.

## Fix

- Added a standalone response classifier used by the workflow.
- Expected review outcomes (`no_fields`, zero-field `ok:*`,
  `needs_better_scan`, and `reshoot_required`) no longer page.
- Typed terminal billing/quota/budget errors still fail the workflow.
- Untyped provider failures, malformed JSON, non-200 transport failures, and
  unknown response shapes still fail the workflow.
- Corrected the workflow comment: there is one endpoint request, but the reader
  can perform multiple provider attempts.

## Verification

- `python3 scripts/monitoring/test_classify_ocr_probe.py`
- Synthetic classifier matrix covers healthy read, expected zero-field review,
  image-quality outcomes, typed transient and terminal errors, untyped provider
  failure, and transport failure.

No PII, production environment, provider configuration, or application runtime
behavior was changed.
