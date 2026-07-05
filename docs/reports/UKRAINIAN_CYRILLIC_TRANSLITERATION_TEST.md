STATUS: PASS
DATE: 2026-07-04
HEAD: f7c8d21f4f64ff394d6d1b39b50b8d2284cbb108
WORKTREE: dirty (current changes include `apps/web/src/app/[locale]/disclaimer/page.tsx` and this report; prior pre-existing edits remain in `apps/web/src/lib/docintel/documentFieldReader.ts`, `apps/web/src/lib/docintel/ensemble/handwritingEnsembleShadow.ts`, `apps/web/src/lib/docintel/ensemble/__tests__/handwritingEnsembleShadow.test.ts`)
TOOL UNDER TEST: deterministic Ukrainian Cyrillic transliteration + script integrity
SOURCE OF TRUTH: `packages/knowledge/src/transliterate.ts`, `apps/web/src/lib/docintel/transliterationPolicy.ts`, `apps/web/src/lib/ocr/nameNormalizer.ts`, `packages/knowledge/src/__tests__/alphabetCompleteness.test.ts`, `packages/knowledge/src/__tests__/referenceValidation.test.ts`, `apps/web/src/lib/translation/__tests__/russianTransliterate.test.ts`
TESTED LETTERS: source coverage exists for the full UA/RU alphabets; direct-import spot checks covered the requested KMU-55 and Russian source-script cases; package-scope and web runner verification are now green
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
PASS:
- Direct-import runtime checks: all requested Ukrainian name and patronymic cases matched expected Latin output
- Russian-as-written samples matched BGN/PCGN outputs
- `node scripts/check-no-pii.mjs` passed clean
- `npm_config_cache=/private/tmp/npm-cache npx -y pnpm@10.33.2 --filter @uscis-helper/knowledge test` passed: `530 passed, 0 failed`
- `npm_config_cache=/private/tmp/npm-cache npx -y pnpm@10.33.2 --dir apps/web exec vitest run src/lib/ocr src/lib/translation` passed: `72` files, `1988 passed`, `2 skipped`
- `npm_config_cache=/private/tmp/npm-cache npx -y pnpm@10.33.2 --dir apps/web run build` passed
- `npm_config_cache=/private/tmp/npm-cache npx -y pnpm@10.33.2 --dir apps/web run typecheck` passed
FAIL:
- None in the current verification pass
GAPS:
- Historical runner-blocked state is preserved below for audit trail only
NEXT PATCH:
- None required for this transliteration audit
FINAL VERDICT: TRANSLITERATION_PASS

---
## RUNNER RESTORED — full-runner verification (2026-07-05, hand-over session)
- Runner heal path: `bash scripts/dev-doctor.sh` (declarative build allowlist in
  package.json → pnpm.onlyBuiltDependencies; no approve-builds prompt). No packages added,
  package.json deps/lockfile untouched.
- `pnpm --filter @uscis-helper/knowledge test` → PASS (incl. mrzTd1 keepalive 19/19)
- `pnpm --filter web exec vitest run src/lib/ocr src/lib/translation` →
  **72 files, 1988 passed / 0 failed** (russianTransliterate + transliteration policy suites included)
- `node scripts/check-no-pii.mjs` → clean (2006 tracked files)

FINAL VERDICT: TRANSLITERATION_PASS
