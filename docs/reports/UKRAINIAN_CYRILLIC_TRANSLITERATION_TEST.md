STATUS: RUNNER_BLOCKED
DATE: 2026-07-04
HEAD: c8578f1be334c5fb6fc91314e16d82dac1f6e2da
WORKTREE: dirty (pre-existing edits in `apps/web/src/lib/docintel/documentFieldReader.ts`, `apps/web/src/lib/docintel/ensemble/handwritingEnsembleShadow.ts`, `apps/web/src/lib/docintel/ensemble/__tests__/handwritingEnsembleShadow.test.ts`)
TOOL UNDER TEST: deterministic Ukrainian Cyrillic transliteration + script integrity
SOURCE OF TRUTH: `packages/knowledge/src/transliterate.ts`, `apps/web/src/lib/docintel/transliterationPolicy.ts`, `apps/web/src/lib/ocr/nameNormalizer.ts`, `packages/knowledge/src/__tests__/alphabetCompleteness.test.ts`, `packages/knowledge/src/__tests__/referenceValidation.test.ts`, `apps/web/src/lib/translation/__tests__/russianTransliterate.test.ts`
TESTED LETTERS: source coverage exists for the full UA/RU alphabets; runtime runner blocked, but direct-import spot checks covered the requested KMU-55 and Russian source-script cases
TESTED NAMES: 23/23 direct-import cases passed, including (`Іваненко`, `Петренко`, `Григорій`, `Ґалаґан`, `Євгеній`, `Юрій`, `Ярослав`, `Ілля`, `Наталія`, `Олексій`, `Сергій`, `Андрій`, `Людмила`, `Хмельницький`, `Щербак`)
TESTED PATRONYMICS: 8/8 direct-import cases passed (`Сергійович`, `Сергіївна`, `Миколайович`, `Миколаївна`, `Андрійович`, `Андріївна`, `Юрійович`, `Юріївна`)
SCRIPT INTEGRITY: PASS for mixed-script detection (`Cepгій`, `Iваненко`); clean Cyrillic remained untouched; no silent Latin/Cyrillic repair
RUSSIAN_VS_UKRAINIAN_FORMS: PASS by source routing and deterministic outputs; Russian `transliterateRussian()` and Ukrainian `transliterateKMU55()` stay distinct, and shared-letter Russian forms remain review-bound by detector policy rather than auto-harmonized
NO_MODEL_REWRITE: PASS; transliteration path is deterministic and model-free, and the policy doc explicitly says the LLM never transliterates names
PASS:
- Direct-import runtime checks: all requested Ukrainian name and patronymic cases matched expected Latin output
- Russian-as-written samples matched BGN/PCGN outputs
- `node scripts/check-no-pii.mjs` passed clean
- Correct package-scope `packages/knowledge` suite passed via pinned pnpm 10.33.2: `530 passed, 0 failed`
FAIL:
- `pnpm --filter web test` failed because the local `vitest` binary is absent from the current workspace install (`sh: vitest: command not found`)
- `npx vitest@4.1.5 run ...` failed to resolve `vitest/config` from `apps/web/vitest.config.ts`
- `pnpm --filter web run typecheck` failed because the local workspace install is incomplete (`next`, `@playwright/test`, `@types/node`, etc. missing from the current install)
GAPS:
- Full automated suite evidence is still missing until the workspace node_modules / runner install is repaired
- The existing mixed-script guard only flags mixed-script tokens; pure Cyrillic letter differences are intentionally preserved and handled by deterministic transliteration, not auto-repair
NEXT PATCH:
- Repair the workspace test toolchain and rerun `apps/web` transliteration-related tests under a working runner; knowledge-side scope is already green
FINAL VERDICT: TRANSLITERATION_SPOT_PASS / RUNNER_BLOCKED
