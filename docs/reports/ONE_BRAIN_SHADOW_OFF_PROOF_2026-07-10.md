# One Brain Intake Shadow — OFF Proof (2026-07-10)

Wires `runIntakeShadow` into the Translation `vision-extract` route **behind
`ONE_BRAIN_INTAKE_SHADOW`, default OFF**. This document is the proof that OFF is a zero-cost,
zero-behaviour-change no-op.

## Flag
- Name: `ONE_BRAIN_INTAKE_SHADOW`
- Default: **OFF** — `isIntakeShadowEnabled(env)` returns `true` only for `env.ONE_BRAIN_INTAKE_SHADOW === '1'`
  (`lib/docintel/intake/shadowRunner.ts`). Missing/`0`/`false` ⇒ OFF.
- Enable target: **Vercel Preview only**, never Production.

## Placement (why OFF costs nothing)
The block sits in `apps/web/src/app/api/translation/vision-extract/route.ts` right after MIME/size
validation and **before** any Gemini/Vision call. The flag is checked **FIRST**:
```
if (isIntakeShadowEnabled()) {          // OFF ⇒ whole block skipped
  try {
    const shadowProviders = buildRealIntakeProviders()
    if (shadowProviders) {
      const firstBuf = ... rawFiles[0].arrayBuffer()   // only reached when ON
      await runIntakeShadow(firstBuf, shadowProviders, {service:'translation', ...}, {...})
    }
  } catch { /* shadow must NEVER affect the live response */ }
}
```
When OFF: no buffer read, no provider build, no model call, no added latency ⇒ no 504 risk.

## Proof (tests, no paid calls)
1. **Runtime OFF ⇒ ran:false, no provider called, no log** — `shadowRunner.test.ts`
   (`'flag OFF ⇒ ran:false, no provider called, no log'` + `'OFF by default'`).
2. **Route wiring is safe + zero-cost** — new `vision-extract/__tests__/intakeShadowWiring.test.ts`:
   - gated behind `isIntakeShadowEnabled()`;
   - wrapped in try/catch (never affects the response);
   - flag checked BEFORE `buildRealIntakeProviders()` and BEFORE `rawFiles[0].arrayBuffer()`
     (OFF ⇒ no arrayBuffer read);
   - `runIntakeShadow` appears exactly once (no unconditional call).
3. **Byte-identical response** — the block returns nothing into the response path; the live
   Translation result is produced by the existing `readDocument`/adapter path, untouched.

## Not claimed
- Not enabled anywhere by default. No flip. Not family-trusted. Handwriting still force-review.
- The ON path's accuracy is measured later in a Preview-only shadow window (N>=25/family).
