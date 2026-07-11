/**
 * readerBridgeWiring.test.ts — source-guard for the Translation B→A decision-shadow wiring.
 * Proves at the route level: (1) the bridge decision is gated behind isReaderControlEnabled(),
 * (2) intake runs ONCE (single runIntakeShadow) and the bridge reuses its observation (no second
 * analyzeIntake), (7) the reader still uses the MANUAL docTypeId — the bridge never changes the
 * response. Runtime decision semantics are covered in intake/__tests__/readerBridge.test.ts.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'route.ts'), 'utf-8')

describe('Translation route — B→A decision-shadow wiring is safe + OFF by default', () => {
  it('the bridge decision is gated behind isReaderControlEnabled() (default OFF)', () => {
    expect(SRC).toMatch(/if \(isReaderControlEnabled\(\)\) \{[\s\S]{0,300}decideReaderDocType/)
  })

  it('intake runs ONCE — a single runIntakeShadow, reused by the bridge (no double intake)', () => {
    expect((SRC.match(/runIntakeShadow\(/g) ?? []).length).toBe(1)
    expect((SRC.match(/decideReaderDocType\(/g) ?? []).length).toBe(1)
    // the bridge consumes the captured observation, it does not call analyzeIntake itself
    expect(SRC).not.toMatch(/analyzeIntake\(/)
    expect(SRC).toMatch(/const obs = await runIntakeShadow\(/)
  })

  it('the whole block is inside try/catch (never affects the response)', () => {
    const block = SRC.slice(SRC.indexOf('isIntakeShadowEnabled() || isReaderControlEnabled()'))
    expect(block).toMatch(/try \{[\s\S]{0,900}decideReaderDocType[\s\S]{0,300}\} catch/)
  })

  it('the reader still uses the MANUAL docTypeId (bridge does not change the read)', () => {
    // every readDocument call passes docTypeId (manual), never a bridged/effective type
    expect(SRC).toMatch(/readDocument\([^)]*docTypeId/)
    expect(SRC).not.toMatch(/readDocument\([^)]*effectiveDocTypeId/)
  })
})
