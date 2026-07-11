/**
 * readerBridgeWiring.test.ts — source-guard for the Translation B→A CONTROLLED bridge wiring.
 * Proves at the route level: (1) the bridge decision is gated behind isReaderControlEnabled(),
 * (2) intake runs ONCE (single runIntakeShadow) and the bridge reuses its observation (no second
 * analyzeIntake), (3) the reader reads through `effectiveReaderDocTypeId`, which is INITIALISED to
 * the manual docTypeId (⇒ byte-identical when the flag is OFF) and only reassigned to the intake
 * type when the decision is safe + mapped. Runtime decision semantics: intake/__tests__/readerBridge.test.ts.
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
    // intent, not brittle char-counts: try opens, decideReaderDocType runs inside, catch closes
    expect(block).toMatch(/try \{/)
    expect(block).toContain('decideReaderDocType')
    expect(block).toMatch(/\} catch/)
    expect(block.indexOf('decideReaderDocType')).toBeGreaterThan(block.indexOf('try {'))
    expect(block.indexOf('} catch')).toBeGreaterThan(block.indexOf('decideReaderDocType'))
  })

  it('the reader reads through effectiveReaderDocTypeId, initialised to the manual type (OFF = byte-identical)', () => {
    // effective starts as the manual docTypeId ⇒ flag OFF is byte-identical; controlled+safe reassigns it
    expect(SRC).toMatch(/let effectiveReaderDocTypeId = docTypeId/)
    // only reassigned inside the controlled branch, guarded by a non-null bridged mapping (fail-closed)
    expect(SRC).toMatch(/if \(decision\.bridgedReaderDocTypeId\) effectiveReaderDocTypeId = decision\.bridgedReaderDocTypeId/)
    // both readDocument calls read through the effective type (never the raw manual docTypeId directly)
    expect((SRC.match(/readDocument\([^)]*effectiveReaderDocTypeId/g) ?? []).length).toBe(2)
    // the intake block itself still passes the MANUAL type to the decision (compares intake vs manual)
    expect(SRC).toMatch(/decideReaderDocType\(docTypeId, obs\)/)
  })
})
