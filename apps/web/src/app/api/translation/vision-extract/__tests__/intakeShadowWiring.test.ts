/**
 * intakeShadowWiring.test.ts — source-level guard: the ONE_BRAIN_INTAKE_SHADOW hook in the
 * Translation vision-extract route must be (a) flag-gated by isIntakeShadowEnabled(), (b)
 * try/catch-wrapped so it can NEVER affect the response, and (c) the flag must be checked
 * BEFORE the image buffer is read, so OFF costs nothing (no buffer read, no provider build,
 * no latency ⇒ no 504 risk). Same node-env source-guard approach as the TPS shadow wiring test.
 *
 * The runtime OFF⇒ran:false, no-provider-called behaviour is proven separately in
 * lib/docintel/intake/__tests__/shadowRunner.test.ts.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'route.ts'), 'utf-8')

describe('Translation route — ONE_BRAIN_INTAKE_SHADOW wiring is safe + zero-cost when OFF', () => {
  it('the shadow block is gated behind isIntakeShadowEnabled()', () => {
    expect(SRC).toMatch(/if \(isIntakeShadowEnabled\(\)\)/)
  })

  it('the shadow block is wrapped in try/catch (never affects the response)', () => {
    const block = SRC.slice(SRC.indexOf('isIntakeShadowEnabled()'))
    expect(block).toMatch(/try \{[\s\S]{0,600}runIntakeShadow[\s\S]{0,600}\} catch/)
  })

  it('the flag is checked BEFORE the shadow buffer is read (OFF ⇒ no arrayBuffer, no cost)', () => {
    const flagIdx = SRC.indexOf('isIntakeShadowEnabled()')
    const buildIdx = SRC.indexOf('buildRealIntakeProviders()')
    const bufIdx = SRC.indexOf('rawFiles[0].arrayBuffer()')
    expect(flagIdx).toBeGreaterThan(-1)
    expect(buildIdx).toBeGreaterThan(flagIdx)
    expect(bufIdx).toBeGreaterThan(buildIdx)
  })

  it('runIntakeShadow is only called inside the guarded block (no unconditional call)', () => {
    const calls = SRC.match(/runIntakeShadow\(/g) ?? []
    expect(calls.length).toBe(1)
  })
})
