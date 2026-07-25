# Codex review prompt — Federal Register delivery recovery

Review the current branch against issue #29, section A.

Focus on P0/P1 only:

- default scheduled delivery must not fail the whole monitor solely because Resend is unavailable;
- a hanging Resend request must be bounded by an abort timeout and reported as `degraded: timeout` in default mode;
- `EMAIL_STRICT=1` must still hard-fail for provider, network, configuration, and timeout failures;
- no secret, digest HTML, email subject, provider response body, thrown network message, or PII may reach logs;
- surrounding secret whitespace may be trimmed, but malformed internal whitespace must not be silently accepted;
- machine-readable status must distinguish sent, degraded, and skipped-no-alerts;
- Federal Register must explicitly remain fail-soft, while paid-failure daily reconciliation must explicitly fail closed and never log `sent` for a degraded result;
- tests must exercise missing key, trimmed key, provider rejection, strict mode, network failure, and hanging-request timeout;
- do not merge or deploy;
- flag any TypeScript/Vitest path-resolution or timer-leak problem;
- flag the current Session Docs Guard/history issue separately from runtime correctness.
