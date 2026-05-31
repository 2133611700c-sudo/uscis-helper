# Live reader benchmark — sanitized summaries

Sanitized (PII-FREE) one-line-per-reader benchmark summaries produced by
`scripts/run-live-reader-benchmark.mjs` are written here as `<timestamp>.md` and
are committable.

The FULL per-field report (with field VALUES = PII) is written ONLY to
`qa-private/reports/<timestamp>.json`, which is gitignored (`qa-private/**`) and
must NEVER be committed. Real documents and hand-filled ground truth live under
`qa-private/real-docs/` and `qa-private/ground-truth/` (also gitignored).

Metric: `critical_wrong_count` (goal: the Core = 0). Coverage is secondary.
See `docs/architecture/ONE_BRAIN_DECISION.md`.
