/**
 * wizardScopeAndDeadCode.test.ts
 *
 * Production-truth guard for the active translation wizard surface.
 *
 * Three invariants:
 *
 *   1. The legacy dead-code surface is GONE.
 *      TranslationWizard.tsx (singular), TranslationServiceExperience.tsx,
 *      and TranslationServicePanel.tsx must NOT exist. They previously
 *      carried "Birth Certificate" / "Свидетельство о рождении" /
 *      "Свідоцтво про народження" / "Certificado de Nacimiento" labels
 *      across 11 source languages — a quietly re-introducible footgun that
 *      contradicts the post-2026-05-09 module demotion (only the Ukrainian
 *      internal passport booklet is self-serve).
 *
 *   2. The active wizard (TranslateWizard.tsx) carries the explicit scope
 *      notice in EN/RU/UK/ES via `'h.scope_notice'`. The notice must name
 *      the supported document type ("internal passport booklet" / equivalent)
 *      AND the manual-review fallback in each locale.
 *
 *   3. The active wizard contains NO broad doc-type self-serve label —
 *      i.e. no naked "Birth Certificate" / "Свидетельство о рождении" /
 *      "Свідоцтво про народження" / "Certificado de Nacimiento" string
 *      anywhere in the active component (the only "passport" doctype
 *      labels we now allow are the ones we set in the previous cycle).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// __dirname = .../apps/web/src/components/services/translation/__tests__
// Translation dir is the parent of __tests__.
const TRANSLATION_DIR = path.resolve(__dirname, '..')
const ACTIVE_WIZARD = path.join(TRANSLATION_DIR, 'TranslateWizard.tsx')

// ── 1. Dead-code surface is GONE ─────────────────────────────────────────────

describe('legacy dead-code surface', () => {
  const deadFiles = [
    'TranslationWizard.tsx', // 2581 LOC, contained the old DOCS array with
                             // "Birth Certificate" labels in 11 languages.
    'TranslationServiceExperience.tsx', // wrapper that imported TranslationWizard.
    'TranslationServicePanel.tsx',      // imported `downloadTranslationTemplate`.
  ]

  for (const f of deadFiles) {
    it(`${f} must not exist (deleted as dead code)`, () => {
      const p = path.join(TRANSLATION_DIR, f)
      expect(fs.existsSync(p), `dead file still on disk: ${p}`).toBe(false)
    })
  }
})

// ── 2. Active wizard carries the explicit scope notice ──────────────────────

describe('TranslateWizard scope notice', () => {
  const src = fs.readFileSync(ACTIVE_WIZARD, 'utf-8')

  it('contains the data-testid="scope-notice" element on the upload screen', () => {
    expect(src).toMatch(/data-testid="scope-notice"/)
    expect(src).toMatch(/t\['h\.scope_notice'\]/)
  })

  it('declares h.scope_notice in all four locales', () => {
    // We require that every locale block (uk / ru / en / es) defines
    // 'h.scope_notice'. The simplest robust check: the key appears at least 4 times.
    const matches = src.match(/'h\.scope_notice'\s*:/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(4)
  })

  it('UK scope notice names the internal passport booklet AND manual review', () => {
    // Anchor on the UK locale block.
    const uk = extractLocaleBlock(src, 'uk')
    expect(uk).toMatch(/внутрішн(ій|ього) паспорт/i)
    expect(uk).toMatch(/ручн[а-яії]+ перевірк/i)
  })

  it('RU scope notice names the internal passport booklet AND manual review', () => {
    const ru = extractLocaleBlock(src, 'ru')
    expect(ru).toMatch(/внутренн(ий|его) паспорт/i)
    expect(ru).toMatch(/ручн[а-я]+ проверк/i)
  })

  it('EN scope notice names the internal passport booklet AND manual review', () => {
    const en = extractLocaleBlock(src, 'en')
    expect(en).toMatch(/internal passport booklet/i)
    expect(en).toMatch(/manual(ly)? review/i)
  })

  it('ES scope notice names the internal passport booklet AND manual review', () => {
    const es = extractLocaleBlock(src, 'es')
    expect(es).toMatch(/pasaporte interno/i)
    expect(es).toMatch(/revisi[oó]n manual|revisad[oa]s? manualmente/i)
  })
})

// ── 3. No broad doc-type self-serve labels remain in the active wizard ─────

describe('TranslateWizard no broad self-serve labels', () => {
  const src = fs.readFileSync(ACTIVE_WIZARD, 'utf-8')

  const forbidden: Array<[string, RegExp]> = [
    // Birth Certificate variants (the demoted module)
    ['Birth Certificate (en)',  /Birth Certificate/],
    ['Свидетельство о рождении (ru)',  /Свидетельство о рождении/],
    ['Свідоцтво про народження (uk)',  /Свідоцтво про народження/],
    ['Certificado de Nacimiento (es)', /Certificado de Nacimiento/],
    // Old marketing claims
    ['USCIS-accepted',          /USCIS-accepted/],
    ['USCIS accepted',          /\bUSCIS accepted\b/],
    ['certified by AI',         /certified by AI/],
    ['will be accepted by USCIS', /will be accepted by USCIS/],
    ['guaranteed acceptance',   /guaranteed acceptance/i],
    // "in minutes" / "за несколько минут" / "en minutos" general claim
    ['Translate your document in minutes', /Translate your document in minutes/],
    ['Переведите документ за несколько минут', /Переведите документ за несколько минут/],
    ['Traduzca su documento en minutos', /Traduzca su documento en minutos/],
    ['Перекладіть документ за кілька хвилин', /Перекладіть документ за кілька хвилин/],
  ]

  for (const [label, re] of forbidden) {
    it(`active wizard does not contain forbidden phrase: ${label}`, () => {
      expect(src, `forbidden phrase '${label}' found in active wizard`).not.toMatch(re)
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Helpers

/**
 * Extract a locale block from the T constant in TranslateWizard.tsx.
 * The format is:
 *
 *   const T: Record<Lang, ...> = {
 *     uk: { ... },
 *     ru: { ... },
 *     en: { ... },
 *     es: { ... },
 *   }
 *
 * We slice from `<locale>: {` to the matching closing `},`.
 */
function extractLocaleBlock(src: string, locale: 'uk' | 'ru' | 'en' | 'es'): string {
  const re = new RegExp(`\\b${locale}:\\s*\\{`)
  const m = re.exec(src)
  if (!m) throw new Error(`locale block not found: ${locale}`)
  const start = m.index + m[0].length
  // naive: walk forward counting braces
  let depth = 1
  let i = start
  while (i < src.length && depth > 0) {
    const ch = src[i]
    if (ch === '{') depth += 1
    else if (ch === '}') depth -= 1
    i += 1
  }
  return src.slice(start, i)
}
