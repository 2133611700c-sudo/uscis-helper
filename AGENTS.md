# AGENTS.md — Rules for all AI agents working on uscis-helper

## MANDATORY STARTUP PROTOCOL
Before any code change, read in this exact order when files/directories exist:
0. `docs/audit/2026-06-13-DOCUMENT_CORE_AND_PROJECT_STATE_AUDIT.md` — consolidated, evidence-only audit of the brain/dictionary/arbitration/canonical pipeline + repo/PR/security/deploy state. Read FIRST; it lists what is verified, what is `UNVERIFIED`, and the current risk register.
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

## CHATGPT–CODEX SUPERVISOR / EXECUTOR PROTOCOL
- Codex is the hands-on executor. ChatGPT is the independent supervisor and verifier through the governing GitHub issue and PR review.
- Before editing, Codex must post a concise evidence inventory and branch plan to the governing issue.
- Do not accept issue text, email summaries, model claims, old reports, or prior PR descriptions as truth until primary evidence is inspected or the behavior is reproduced.
- Do not declare `BLOCKED` until every safe, available diagnostic path has been attempted and the exact redacted failure has been captured.
- One defect family per branch/PR. Never mix unrelated runtime, security, documentation, or environment changes.
- Completion requires all of: reproduced before-state, focused diff, narrow tests, repository-required typecheck/build/guards, positive workflow or Preview/runtime proof, rollback instructions, and unresolved owner actions.
- A green build alone is not runtime proof. Use browser/devtools, GitHub Actions logs, Vercel Preview/runtime logs, and provider dashboards when the task requires them.
- Post branch names, PR links, commands, test evidence, runtime evidence, and blockers back to the governing issue so ChatGPT can independently audit the result.
- When Codex code review is enabled, request `@codex review` on every non-trivial PR and resolve all P0/P1 findings before owner approval.
- Never merge, deploy production, change production environment variables, enable paid billing, rotate secrets, mutate production data, or weaken safety/review gates without explicit owner approval.

## REVIEW GUIDELINES
- Flag any P0/P1 correctness, security, privacy, billing, immigration-form, or production-safety regression.
- Reject claims without exact evidence: commit SHA, test command, workflow/deployment ID, or runtime reproduction.
- Reject logs or commits containing secrets, PII, document values, OCR text, email bodies, or raw provider responses.
- Verify that fail-open behavior cannot silently convert an unread document or provider failure into a successful final value.
- Verify that user-confirmed corrections, review gates, canonical values, and generated PDFs remain consistent end to end.

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

## MacBook Workstation and Tool-Use Policy
- Codex may use this MacBook as a full engineering workstation when task-relevant.
- Allowed tools and apps include Terminal/shell, Git, GitHub CLI, Vercel CLI, Node/npm/pnpm, Playwright, browser automation, Chrome, ChatGPT Atlas (if available), Safari, screenshots, logs, local files/project folders, browser devtools, and relevant installed developer tools.
- Use the best available tool for the job.
- Do not limit execution to terminal-only when browser or visual verification is required.
- Use browser/app verification for live UI flows, deployment checks, production behavior checks, and visual validation when needed.
- If any required app/tool is unavailable, blocked, unsigned-in, or requires manual authentication, return `BLOCKED` with the exact blocking reason.
- Dangerous actions still require explicit owner approval, including destructive actions, billing changes, paid ads changes, customer-facing/public messages, public posts, production secrets handling, domain/env/deployment deletion, force push, and bypassing repository guards.
- No DONE claim without evidence.
