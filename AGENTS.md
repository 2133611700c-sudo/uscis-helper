# AGENTS.md — Rules for all AI agents working on uscis-helper

## MANDATORY STARTUP PROTOCOL
Before any code change, read in this exact order:
1. STATUS.md
2. HANDOFF.md  
3. SOURCE_OF_TRUTH.md
4. docs/adr/*.md (accepted decisions)

## MANDATORY SHUTDOWN PROTOCOL
After finishing work, update:
1. HANDOFF.md — what you did, evidence, next task
2. STATUS.md — if VERIFIED/OPEN items changed
3. CHANGELOG.md — append session entry

Enforcement: pre-commit + GitHub Actions require `STATUS.md`, `HANDOFF.md`, and `CHANGELOG.md` in every commit.
Before first local use: run `bash scripts/setup-git-hooks.sh`.

## DO NOT
- Create a second dictionary/normalization module (packages/knowledge is canonical)
- Call Patronymic "Middle Name"
- Modernize historical Ukrainian authorities (Militsiya, УМВС, ДАІ)
- Use "Ministry of Interior" (correct: "Ministry of Internal Affairs")
- Re-litigate decisions marked Accepted in docs/adr/
- Make claims without evidence (test results, build output, commit SHA)

## CANONICAL TRUTH
- Dictionary + normalization: `packages/knowledge/`
- TPS pipeline: `apps/web/src/lib/tps/`
- Translation engine: `apps/web/src/lib/translation/`
- See SOURCE_OF_TRUTH.md for full module map
