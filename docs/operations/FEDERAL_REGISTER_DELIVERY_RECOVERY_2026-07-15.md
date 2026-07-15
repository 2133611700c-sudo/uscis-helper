# Federal Register digest delivery recovery — 2026-07-15

Status: implementation branch only; not merged and not deployed.

## Reproduced failure

The monitor step completes, while the digest step fails when Resend rejects delivery. The old code throws on every non-2xx response and prints the raw response body. A separate P1 review found that an unbounded hanging Resend request could still consume the full workflow timeout.

## Change

- delivery is fail-soft by default and returns a machine-readable `sent` or `degraded` result;
- each live caller declares its policy explicitly: Federal Register is fail-soft, while paid-failure daily reconciliation is fail-closed;
- a Resend request is aborted after a bounded timeout (15 seconds by default, safely clamped when overridden for tests/diagnostics);
- timeout is reported as `degraded` with reason `timeout` in default mode;
- `EMAIL_STRICT=1` preserves an explicit hard-fail mode, including timeout failures;
- surrounding `RESEND_API_KEY` whitespace is trimmed without logging the key;
- internal whitespace is rejected as invalid configuration;
- raw digest HTML, subject, secret values, provider response bodies, and network error text are not logged;
- workflow summary logs contain only status/reason/count metadata;
- unit coverage exercises missing key, trimming, provider rejection, strict mode, network failure, and a hanging-request timeout.
- reconciliation coverage proves strict invocation, confirmed-success logging, degraded fail-closed behavior, and no digest/subject leakage.

## Required verification before completion

1. Run the focused Vitest file and the repository-required test/typecheck/build/guards.
2. Rebuild the branch as a guard-compliant focused commit including truthful `STATUS.md`, `HANDOFF.md`, and `CHANGELOG.md` updates.
3. Run the workflow manually with the current secret configuration.
4. Confirm the monitoring step remains successful and a Resend rejection or timeout produces a green workflow with `delivery_status=degraded`.
5. Confirm the daily reconciliation workflow remains red when delivery fails; its code and workflow both enforce strict mode.
6. Replace/repair the Resend key separately; this code does not create or rotate credentials.

## Local verification

- focused delivery tests: 11/11 passed;
- full Vitest: 4356 passed, 24 skipped, 0 failed;
- TypeScript: 0 errors;
- Next production build: exit 0 (pre-existing warnings only);
- product guards and release-state guard: passed;
- post-commit CI and manual workflow runtime proof is recorded externally in PR #31 checks and its evidence comment; this pre-push report does not predict those results.

## Safety

No production environment, database, billing, secret, or deployment setting is changed by this branch.
