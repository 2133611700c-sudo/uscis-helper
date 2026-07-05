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

## ПРОСТЫЕ ПРАВИЛА СОВМЕСТНОЙ РАБОТЫ (для Codex и всех агентов, 2026-07-05)

1. **НЕ запускай `pnpm approve-builds`.** Никогда. Разрешения сборок уже прописаны в
   `package.json → pnpm.onlyBuiltDependencies`. Прерванный промпт ломает workspace.
2. **Сломался node_modules / vitest / sharp / next?** Одна команда:
   `bash scripts/dev-doctor.sh` — сама проверит и вылечит. Ничего другого не делай.
3. **Один коммитер за раз.** Если у другого агента есть незакоммиченные файлы — ты
   read-only. Передача роли только явным словом владельца.
4. **Не редактируй `.env.local` без нужды** — там живут ключи и флаги других сессий;
   append-only, ничего не удалять и не перезаписывать.
5. **Перед live-контролем правок кода** — перезапусти dev-сервер (kill + start); при
   сомнении `rm -rf apps/web/.next`. Горячая перезагрузка lib-модулей врёт.
6. **Слово «готово» = три подписи:** код есть · статус честный (класс из
   ONE_BRAIN_RUNTIME_TRUTH) · live-замер на реальном документе приложен.
7. **Зависимости ставятся ТОЛЬКО через `bash scripts/safe-install.sh`.** Сырой
   `pnpm install` сам откажет (preinstall-guard) при конкурентной установке или живом
   dev-сервере — это не баг, это предохранитель. Не обходить (SAFE_INSTALL=1 — только
   для самих скриптов). Сломалось — `bash scripts/dev-doctor.sh`, и ничего больше.
