/**
 * ruUaLanguageRouting.test.ts — Step-7 acceptance gate (owner 2026-06-27).
 * Fixed RU / UA / mixed vectors proving:
 *   - Russian text is NEVER romanized through the Ukrainian (KMU-55) table.
 *   - Ukrainian text is NEVER romanized through the Russian table.
 *   - shared-letter names on a CERT are flagged for review (mixed/ambiguous).
 *   - the raw Cyrillic is never mutated by routing.
 * Document jurisdiction (UA) and field-text language (RU/UA) are independent signals.
 */
import { describe, it, expect } from 'vitest'
import { romanizeNameForDocScript, toCanonicalValue, isNameSourceScriptAmbiguous } from '../transliterationPolicy'

const ON = { DOC_SCRIPT_ROUTING_ENABLED: '1' } as unknown as Record<string, string | undefined>

describe('Step-7: RU/UA per-field language routing (fixed vectors)', () => {
  it('Russian shared-letter names on a RU document → Russian table, NOT KMU-55', () => {
    // raw Cyrillic, current KMU-55 value (the wrong default), docScript='ru'
    expect(romanizeNameForDocScript('Сергей', 'Serhei', 'ru', ON)).toBe('Sergey')
    expect(romanizeNameForDocScript('Сергеевич', 'Serheevych', 'ru', ON)).toBe('Sergeyevich')
    expect(romanizeNameForDocScript('Андрей', 'Andrii', 'ru', ON)).toBe('Andrey')
  })

  it('Ukrainian-distinctive names are NEVER force-Russified, even on a RU-leaning doc', () => {
    // і is Ukrainian-only → routing must leave the KMU-55 value untouched
    const kmu = toCanonicalValue({ cyrillic: 'Сергій' } as any, 'name')
    expect(kmu).toBe('Serhii')
    expect(romanizeNameForDocScript('Сергій', kmu, 'ru', ON)).toBe(kmu) // unchanged
  })

  it('on a NON-ru document, routing is a no-op (UA stays KMU-55)', () => {
    expect(romanizeNameForDocScript('Сергей', 'Serhei', 'uk', ON)).toBe('Serhei')
    expect(romanizeNameForDocScript('Сергей', 'Serhei', 'unknown', ON)).toBe('Serhei')
  })

  it('shared-letter name on a CERT is ambiguous → review (not silently routed either way)', () => {
    expect(isNameSourceScriptAmbiguous('Сергей', { SOURCE_SCRIPT_REVIEW_ENABLED: '1' }, 'ua_birth_certificate')).toBe(true)
    // but on a UA-issued ID doc the document language resolves it → not ambiguous
    expect(isNameSourceScriptAmbiguous('Сергей', { SOURCE_SCRIPT_REVIEW_ENABLED: '1' }, 'ua_internal_passport_booklet')).toBe(false)
  })

  it('routing never mutates the raw Cyrillic input', () => {
    const raw = 'Сергеевич'
    romanizeNameForDocScript(raw, 'Serheevych', 'ru', ON)
    expect(raw).toBe('Сергеевич')
  })
})
