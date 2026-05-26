# AGENTS.md — Rules for all AI agents working on uscis-helper

## MANDATORY STARTUP PROTOCOL
Before any code change, read in this exact order when files/directories exist:
1. `STATUS.md`
2. `HANDOFF.md`
3. `SOURCE_OF_TRUTH.md`
4. `CHANGELOG.md`
5. `ops/agent-control/STATUS.md`
6. `ops/agent-control/reports/`
7. `ops/agent-control/tasks/`
8. `docs/`
9. `ADR/` and `docs/adr/`
10. `reports/`
11. `audit/`
12. any `CENTRAL_BRAIN_SPEC*` files

## MANDATORY SHUTDOWN PROTOCOL
After finishing work, always update:
1. `HANDOFF.md` — what changed, what was verified, what failed, exact next action
2. `STATUS.md` — current verified state, blockers, and verification truth
3. `CHANGELOG.md` — append-only chronological entry (never delete history)

For tasks related to OpenClaw, browser audits, synthetic tests, or production verification, write evidence reports under:
- `ops/agent-control/reports/`

## REPORTING CONTRACT
- No DONE claims without verified evidence.
- Use factual concise reports only.
- Allowed completion statuses: `PASS`, `FAIL`, `BLOCKED`, `DEGRADED`.
- If something is not verified, mark it `UNVERIFIED`.

## DO NOT
- Create a second dictionary/normalization module (`packages/knowledge` is canonical)
- Call Patronymic "Middle Name"
- Modernize historical Ukrainian authorities (Militsiya, УМВС, ДАІ)
- Use "Ministry of Interior" (correct: "Ministry of Internal Affairs")
- Re-litigate decisions marked Accepted in ADR docs
- Make claims without evidence (test results, build output, commit SHA, report paths)
- Overwrite historical context in `STATUS.md`, `HANDOFF.md`, `SOURCE_OF_TRUTH.md`, or `CHANGELOG.md` with boilerplate templates

## CANONICAL TRUTH
- Dictionary + normalization: `packages/knowledge/`
- TPS pipeline: `apps/web/src/lib/tps/`
- Translation engine: `apps/web/src/lib/translation/`
- See `SOURCE_OF_TRUTH.md` for full module map
