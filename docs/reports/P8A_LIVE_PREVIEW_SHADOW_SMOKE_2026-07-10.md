# P8-A Live Preview Shadow Smoke (2026-07-10)

Result: `DEGRADED`.

`PASS`:

- merged mainline intake detection now works live on Preview for the known real Soviet birth certificate
- Preview shadow ON did not alter the live Translation response in the degraded state observed in this turn

`DEGRADED`:

- Preview ingress rejected larger payloads on this route family
- Translation did not complete a successful field-read during this turn because both Preview and Production hit `OCR_RATE_LIMITED`
- runtime shadow-log capture via `vercel logs` remained `UNVERIFIED`

## Scope

- Environment: Vercel Preview only for One Brain live proof
- Real document: `test-fixtures/real-docs/birth_cert_soviet_01.jpg`
- Production was used only as the parity baseline for `translation/vision-extract`
- No production env changes

## Deployment and environment proof

- Preview deployment: `https://uscis-helper-cotbsu32q-sergiis-projects-8a97ee0f.vercel.app`
- Preview deployment id: `dpl_Aiv1cTWuenyXKsAY6FnQn7rjn3oj`
- Preview target: `preview`
- Production baseline healthz: `sha=9688b5a`, which matches `origin/main` at `#8`

Previously verified via Vercel env pull:

- Preview: `ONE_BRAIN_INTAKE_SHADOW="1"`, `DIAG_ORIENT_ENABLED="1"`
- Production: neither checked shadow/diag var present

## Fixture handling

Original real file:

- `birth_cert_soviet_01.jpg`
- `4128x3096`
- `7,072,376` bytes

Observed route ingress behavior:

- original `7.07MB` upload → `413 FUNCTION_PAYLOAD_TOO_LARGE`
- same document recompressed to `2.8MB` (`q60`) → still `413` on Preview
- same document recompressed to `1.70MB` (`q40`) → still `413` on Preview
- same document recompressed to `1.25MB` (`q30`) → accepted on Preview

This is a platform/path ingress constraint observed live in Preview, not a One Brain classification bug.

## Live intake proof (`/api/diag/intake`)

Successful Preview call on the recompressed `q30` version of the same real Soviet birth certificate returned:

- `ok=true`
- model reported: `gpt-4.1`
- elapsed time: `14519ms`
- `country=SU`
- `issuingSystem=soviet_legacy`
- `family=civil_record`
- `docTypeId=ua_birth_certificate_soviet`
- `handwritingPresent=true`
- final intake status: `needs_review`
- review reasons: `handwriting_present`

PII-free trace summary included:

- `preflight`
- `orientation`
- `language`
- `country`
- `family`
- `type`
- `page_side`
- `reader_route`
- `review_policy`

### Stability note

On heavier recompression (`q20`, `q10`) the same document still classified as:

- `SU / soviet_legacy`
- `ua_birth_certificate_soviet`
- `handwritingPresent=true`
- `needs_review`

But the `page_side` detail varied (`front` at `q30`, `single` at `q20/q10`), so page-side should
not be overclaimed as stable under aggressive recompression.

## Translation response parity (`/api/translation/vision-extract`)

For the recompressed `q30` version of the same real document:

- Preview response:
  - `ok=false`
  - `status=provider_unavailable`
  - `error_code=OCR_RATE_LIMITED`
  - `retryable=true`
  - `review_required=true`
- Production response:
  - `ok=false`
  - `status=provider_unavailable`
  - `error_code=OCR_RATE_LIMITED`
  - `retryable=true`
  - `review_required=true`

Sanitized parity result:

- `same_sanitized_output=true`

Interpretation:

- the Preview shadow flag did not change the Translation response path in the degraded live state
- the route still fails honestly when the provider is busy
- this is a live parity proof for the failure path, not yet for a successful field-read path

## What this smoke proves

1. The merged mainline intake code after `#8` now works live on Preview for the known real Soviet birth certificate.
2. The expected One Brain decision is produced live:
   - `SU / soviet_legacy`
   - `ua_birth_certificate_soviet`
   - `handwritingPresent=true`
   - `needs_review`
3. With shadow ON in Preview, the Translation route remains response-parity-safe in the degraded live state.

## What this smoke does not prove

- It does **not** prove successful field recognition accuracy.
- It does **not** prove successful Translation response parity under a non-rate-limited provider window.
- It does **not** prove runtime shadow-log capture; `vercel logs` did not replay a usable `[one_brain_intake_shadow]` line during this turn.
- It does **not** justify any trust claim like `N>=25/family`.

## Recommended next step

Only one high-value follow-up remains:

- rerun the same Preview smoke during a non-rate-limited provider window, capture one successful
  `translation/vision-extract` response, and compare sanitized Preview vs Production output again

Until then, the honest state is:

- mainline integration: proven
- live intake decision on Preview: proven
- Translation parity in degraded state: proven
- successful field-read parity and accuracy: still `UNVERIFIED`
