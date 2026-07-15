# Codex Cloud Environment — uscis-helper

Status: repository-side configuration contract. The environment itself must be created in Codex Settings for this repository.

## Repository

- Repository: `2133611700c-sudo/uscis-helper`
- Default branch: `main`
- Package manager: `pnpm@10.33.2` from the root `package.json`
- Governing instructions: root `AGENTS.md`

## Environment profile

Use the Codex universal image. Do not copy production secrets into the environment.

### Setup script

```bash
set -euo pipefail
corepack enable
corepack prepare pnpm@10.33.2 --activate
pnpm --version
pnpm install --frozen-lockfile
```

### Maintenance script

```bash
set -euo pipefail
corepack enable
corepack prepare pnpm@10.33.2 --activate
pnpm install --frozen-lockfile --prefer-offline
```

### Environment variables

No production environment variables are required for the baseline audit, unit tests, typecheck, or build. Add only synthetic/non-production variables required by a specific test and document them in the governing issue.

### Secrets

None by default. Production credentials, service-role keys, billing credentials, document samples, and owner PII must not be added. Use redacted GitHub Actions, Vercel, Supabase, and provider evidence instead.

### Internet access

Setup phase: enabled for dependency installation.

Agent phase: limited access only. Allow domains only when required by the active issue, normally:

- `github.com`
- `api.github.com`
- `raw.githubusercontent.com`
- `registry.npmjs.org`
- `vercel.com`
- `supabase.com`
- `developers.openai.com`
- `learn.chatgpt.com`
- official provider documentation domains explicitly required by the issue

Do not enable unrestricted access by default.

## First-run verification

Codex must post the result to the governing issue before editing runtime code:

```bash
set -euo pipefail
pwd
git status --short --branch
git rev-parse HEAD
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm --filter web typecheck
pnpm --filter web build
```

If a command fails, capture the exact redacted failure and try the next safe diagnostic path before declaring `BLOCKED`.

## Operating contract

1. Read root `AGENTS.md` and the source-of-truth documents in its startup order.
2. Work from a clean branch off current `main`.
3. One defect family per PR.
4. No production merge, deployment, environment change, billing action, secret rotation, or database mutation without explicit owner approval.
5. Do not log secrets, PII, document values, OCR text, email bodies, or raw provider responses.
6. A task is complete only after tests plus positive workflow/Preview/runtime proof.
7. Post evidence, branch/PR links, rollback, and unresolved owner actions to the governing issue for independent ChatGPT review.

## Supervisor loop

- Codex executes and reports evidence in GitHub.
- ChatGPT independently inspects issue comments, diffs, CI, Vercel/Supabase evidence, and requests corrections.
- No result is accepted solely because Codex or ChatGPT states it; the relevant behavior must be reproduced successfully.
