# Codex rebuild request

Rebuild PR #30 from current `main` on branch `codex/supervisor-environment-rebuild-20260715` as one focused commit that includes:

- the existing `AGENTS.md` supervisor/executor additions from PR #30;
- the existing `docs/operations/CODEX_CLOUD_ENVIRONMENT.md` from PR #30;
- truthful updates to `STATUS.md`, `HANDOFF.md`, and `CHANGELOG.md` in the same commit so `scripts/guards/require-session-docs.sh --ci` passes for that commit.

Do not modify runtime code, production configuration, billing, secrets, databases, or deployment settings. Preserve current `main` behavior. Run the session-docs guard and repository-required checks. Open a replacement draft PR, then close PR #30 only after the replacement is green.
