/**
 * russianTransliterate.test.ts — source-script controls transliteration.
 *
 * A Soviet/bilingual document line in RUSSIAN must use a Russian system, NOT
 * KMU-55 (Ukrainian), and the same name in different source scripts must NOT be
 * harmonized. Synthetic example surnames only (privacy rule); Сергей/Сергій are
 * standalone words pinning the linguistic rule, not tied to any person.
 */
import { describe, it, expect } from 'vitest'
import { transliterateKMU55, transliterateRussian, detectNameScript } from '@uscis-helper/knowledge'

describe('transliterateRussian — Russian source → Russian output', () => {
  it('Сергей → Sergey (not Serhii)', () => {
    expect(transliterateRussian('Сергей')).toBe('Sergey')
  })
  it('Сергеевич → Sergeevich', () => {
    expect(transliterateRussian('Сергеевич')).toBe('Sergeevich')
  })
  it('Леонидович → Leonidovich (not Leonidovych)', () => {
    expect(transliterateRussian('Леонидович')).toBe('Leonidovich')
  })
  it('Наталья → Natalia', () => {
    expect(transliterateRussian('Наталья')).toBe('Natalia')
  })
  it('Степановна → Stepanovna', () => {
    expect(transliterateRussian('Степановна')).toBe('Stepanovna')
  })
  it('Иваненко → Ivanenko (synthetic surname)', () => {
    expect(transliterateRussian('Иваненко')).toBe('Ivanenko')
  })
})

describe('Ukrainian source still uses KMU-55 (no harmonization)', () => {
  it('Сергій → Serhii', () => {
    expect(transliterateKMU55('Сергій')).toBe('Serhii')
  })
  it('Сергійович → Serhiiovych', () => {
    expect(transliterateKMU55('Сергійович')).toBe('Serhiiovych')
  })
  it('Леонідович → Leonidovych (not Leonidovich)', () => {
    expect(transliterateKMU55('Леонідович')).toBe('Leonidovych')
  })
})

describe('the two systems must NOT cross (no silent normalization)', () => {
  it('Russian Сергей does not become the Ukrainian Serhii', () => {
    expect(transliterateRussian('Сергей')).not.toBe('Serhii')
  })
  it('Ukrainian Сергій does not become the Russian Sergey', () => {
    expect(transliterateKMU55('Сергій')).not.toBe('Sergey')
  })
})

describe('detectNameScript — by distinctive letters; ambiguous → review, not guess', () => {
  it('Ukrainian-only letters (і/ї/є/ґ) → ua', () => {
    expect(detectNameScript('Сергій')).toBe('ua')
    expect(detectNameScript('Наталія')).toBe('ua')
  })
  it('Russian-only letters (ы/э/ё/ъ) → ru', () => {
    expect(detectNameScript('Эдуард')).toBe('ru')
  })
  it('no distinctive letter → unknown (caller reviews, never guesses)', () => {
    expect(detectNameScript('Наталья')).toBe('unknown')   // ь/я are shared
    expect(detectNameScript('Сергеевна')).toBe('unknown')
  })
})
