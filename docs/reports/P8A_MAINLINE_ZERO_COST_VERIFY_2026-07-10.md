# P8-A Mainline Zero-Cost Verification (2026-07-10)

Result: `PASS` for merged-mainline truth and env separation. `BLOCKED` for live post-merge product proof in this report because no paid Preview smoke was run yet.

## Scope

This report verifies, without any paid provider calls:

1. PRs `#4`, `#6`, and `#8` are really merged.
2. `origin/main` really contains the One Brain intake foundation, the Translation shadow hook, and the Soviet birth-cert catalog fix.
3. The Translation shadow hook is default-OFF by code.
4. Vercel Preview/Production env separation is real for the new shadow path.
5. Open PR residuals `#7` and `#3` are recorded honestly.

## Method

- GitHub CLI: `gh pr view`, `gh pr diff`
- Git: `git log origin/main`, `git grep origin/main`
- Vercel CLI: `vercel env ls`, `vercel env pull`
- No Gemini, no OpenAI image calls, no full battery, no production env changes

## Verified Now

### 1. GitHub merge truth

- PR `#4` is `MERGED`: `one-brain: land intake foundation on mainline (foundation-only, no wiring)`.
- PR `#6` is `MERGED`: `one-brain: wire ONE_BRAIN_INTAKE_SHADOW into Translation route (default OFF)`.
- PR `#8` is `MERGED`: `fix(intake): docType catalog from signatures — Soviet birth cert was 'unknown' (found live)`.

`origin/main` commit tip confirms the landing order:

```text
9688b5a6 fix(intake): docType catalog from signatures (#8)
4809fbb5 one-brain: wire ONE_BRAIN_INTAKE_SHADOW into Translation route, default OFF (#6)
a33f465b one-brain: land intake foundation on mainline (#4)
```

### 2. Mainline code truth

`origin/main` contains the intake foundation and the Translation hook:

- `apps/web/src/lib/docintel/intake/*`
- `apps/web/src/app/api/diag/intake/route.ts`
- `apps/web/src/app/api/translation/vision-extract/route.ts`
- `apps/web/src/app/api/translation/vision-extract/__tests__/intakeShadowWiring.test.ts`
- `docs/reports/ONE_BRAIN_SHADOW_OFF_PROOF_2026-07-10.md`

Concrete grep hits on `origin/main`:

- `route.ts` imports `runIntakeShadow, isIntakeShadowEnabled`
- `route.ts` comments state Preview-only enable via `ONE_BRAIN_INTAKE_SHADOW=1`
- `detectDocumentType.ts` contains `ua_birth_certificate_soviet`
- `docReadingRules.ts` contains `ua_birth_certificate_soviet`
- `detectDocumentTypeCatalog.test.ts` asserts the live-regression case for `ua_birth_certificate_soviet`
- `canonicalRegistry.ts` records the Soviet birth certificate as `force_review`

### 3. Default-OFF hook truth

In `origin/main:apps/web/src/lib/docintel/intake/shadowRunner.ts`:

```ts
export function isIntakeShadowEnabled(env = process.env): boolean {
  return env.ONE_BRAIN_INTAKE_SHADOW === '1'
}
```

In `origin/main:apps/web/src/app/api/translation/vision-extract/__tests__/intakeShadowWiring.test.ts`:

- the block is gated by `isIntakeShadowEnabled()`
- it is wrapped in `try/catch`
- the flag check happens before `buildRealIntakeProviders()` and before `rawFiles[0].arrayBuffer()`
- `runIntakeShadow(...)` appears exactly once

Conclusion: with the flag OFF, the hook is a zero-cost no-op by code shape and tests.

### 4. Vercel env separation

Read-only Vercel checks found:

```text
Preview:
DIAG_ORIENT_ENABLED="1"
ONE_BRAIN_INTAKE_SHADOW="1"

Production:
INTERNAL_DIAG_TOKEN="..."
```

Interpretation:

- Preview really has the shadow flag enabled.
- Preview really has the orientation diagnostic flag enabled.
- Production does not contain either checked shadow/diag flag in the pulled env file.
- Production does contain `INTERNAL_DIAG_TOKEN`, which is the proper gate for internal diagnostics.

This is the correct safety posture for a controlled Preview-only smoke.

## Honest Residuals

### Live proof after merge

Not done in this report:

- no live Preview call to `/api/diag/intake`
- no live Translation upload with the known Soviet birth certificate
- no proof yet that the deployed Preview behavior after `#8` matches the expected `country=SU/soviet_legacy`, `docType=ua_birth_certificate_soviet`, `status=needs_review`

So the post-merge product proof remains `BLOCKED` here on a deliberately skipped paid-call smoke, not on missing code.

### PR `#7`

Current truth:

- title: `docs: One Brain recognition-reality — intake detection != field recognition`
- state: `OPEN`
- mergeable: `CONFLICTING`
- diff contents: `CHANGELOG.md`, `HANDOFF.md`, `STATUS.md`, `docs/reports/ONE_BRAIN_RECOGNITION_REALITY_2026-07-10.md`

Interpretation:

- It is docs-only in substance.
- It is not mergeable as-is.
- It needs a clean recreate/rebase on top of current `main`, not a blind merge command.

### PR `#3`

Current truth:

- title: `monitor: degrade email delivery instead of RED-failing on dead Resend key`
- state: `OPEN`
- mergeable: `CONFLICTING`
- it changes real runtime/CI behavior, not just docs

Interpretation:

- Do not auto-merge blindly.
- First decide the intended monitor policy: degrade-with-warning vs hard-fail-on-dead-email.

## Bottom Line

The old argument "the foundation is still only in a side branch" is no longer true.

As of this verification:

- One Brain intake foundation is on `main`.
- Translation shadow hook is on `main`.
- Soviet birth-cert catalog fix is on `main`.
- Preview is the right place for the next proof.
- What is still missing is not integration, but one tiny live smoke to prove deployed behavior after the merges.
