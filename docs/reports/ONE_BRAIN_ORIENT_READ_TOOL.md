STATUS: PASS
DATE: 2026-07-06
HEAD: 4955d85
WORKTREE: dirty (new tool + orientation refinements pending commit)
TOOL: apps/web/scripts/one-brain-orient-read.mts
SCOPE: document posture/orientation + handwritten Cyrillic read summary
PROVIDERS: gemini default, openai explicit fallback
REAL DOCS:
- birth_cert_handwritten_01.jpg
- military_id_p1_01.jpg
LIVE RESULTS:
- birth_cert_handwritten_01: orientation upright via content_orient cw=90; openai fallback returned ok:gpt-4.1:24998ms:12f; handwritten_fields=12; review_required=12
- military_id_p1_01: orientation upright via content_orient cw=90; openai fallback returned ok:gpt-4.1:6765ms:5f; handwritten_fields=5; review_required=5
GEMINI STATUS:
- gemini-2.5-pro returned HTTP 429 RESOURCE_EXHAUSTED on both live probes in this shell
PII:
- clean via node scripts/check-no-pii.mjs
TS:
- pnpm --dir apps/web exec tsc --noEmit passed
ORIENTATION_TESTS:
- pnpm --dir apps/web exec vitest run src/lib/docintel/orientation/__tests__/detectOrientation.test.ts passed
FINAL VERDICT: ONE_BRAIN_ORIENT_READ_TOOL_PASS
