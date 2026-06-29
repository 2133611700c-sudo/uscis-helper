/**
 * ONE BRAIN — Fork Registry guard (STEP 0, Level 1).
 *
 * Keeps ONE_BRAIN_FORKS honest:
 *  - every record is well-formed (valid enums, owner, removal phase);
 *  - ids unique;
 *  - every entryPoint file actually exists (a removed/moved fork forces a status update — fails red);
 *  - all four products + the knowledge layer are represented;
 *  - the known forks the audit found are present (no silent dropping).
 *
 * GREEN at HEAD. Pure static check; no runtime.
 */
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { ONE_BRAIN_FORKS, forkEntryFile, type ForkRecord } from '../oneBrainForkRegistry'

const STATUSES = new Set(['PRIMARY', 'READER_ADAPTER', 'LEGACY_ADAPTER', 'SHADOW', 'BYPASS_FORBIDDEN'])
const PHASES = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'none'])
const PRODUCTS = new Set(['translation', 'tps', 'ead', 'reparole', 'knowledge'])
const APP_WEB = resolve(process.cwd()) // vitest cwd = apps/web

describe('one-brain fork registry — well-formed', () => {
  it('every record has valid enums + owner + non-empty entryPoint', () => {
    for (const r of ONE_BRAIN_FORKS) {
      expect(STATUSES.has(r.currentStatus), `${r.id} status`).toBe(true)
      expect(PHASES.has(r.removalPhase), `${r.id} phase`).toBe(true)
      expect(PRODUCTS.has(r.product), `${r.id} product`).toBe(true)
      expect(r.owner).toBe('one-brain-migration')
      expect(r.entryPoint).toMatch(/:\d+$/)
    }
  })

  it('fork ids are unique', () => {
    const ids = ONE_BRAIN_FORKS.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every fork entryPoint file exists (a removed fork must update its record)', () => {
    const missing: string[] = []
    for (const r of ONE_BRAIN_FORKS) {
      const f = resolve(APP_WEB, forkEntryFile(r))
      if (!existsSync(f)) missing.push(`${r.id} → ${forkEntryFile(r)}`)
    }
    expect(missing, `entryPoint file(s) gone — convert the fork's status, don't leave a stale record:\n  ${missing.join('\n  ')}`).toEqual([])
  })
})

describe('one-brain fork registry — coverage (no silent dropping)', () => {
  it('all four products + knowledge are represented', () => {
    const products = new Set(ONE_BRAIN_FORKS.map((r) => r.product))
    for (const p of ['translation', 'tps', 'ead', 'reparole', 'knowledge']) {
      expect(products.has(p as ForkRecord['product']), `product '${p}' must have at least one registered fork`).toBe(true)
    }
  })

  it('the audited forks are all registered', () => {
    const ids = new Set(ONE_BRAIN_FORKS.map((r) => r.id))
    for (const required of [
      'translation.vision-extract.core',
      'translation.ocr-from-storage.dark',
      'tps.legacy-modules',
      'tps.deepseek-brain',
      'tps.dual-ocr-crossref',
      'knowledge.brain',
      'knowledge.smart-normalize',
    ]) {
      expect(ids.has(required), `audited fork '${required}' missing from registry`).toBe(true)
    }
  })

  it('every non-PRIMARY fork has a target adapter + removal phase (a path to collapse)', () => {
    for (const r of ONE_BRAIN_FORKS) {
      if (r.currentStatus === 'PRIMARY') continue
      expect(r.targetAdapter, `${r.id} needs a targetAdapter`).toBeTruthy()
      expect(r.removalPhase, `${r.id} needs a removalPhase`).not.toBe('none')
    }
  })
})
