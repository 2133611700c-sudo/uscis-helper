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
import { classifyToModule } from '../../../../lib/translation/modules/registry'

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

// ── 4. Doctype-picker + manual-review-info routing ─────────────────────────

describe('TranslateWizard doctype-picker routing', () => {
  const src = fs.readFileSync(ACTIVE_WIZARD, 'utf-8')

  it("Screen type includes 'doctype-picker' and 'manual-review-info'", () => {
    expect(src).toMatch(/'doctype-picker'/)
    expect(src).toMatch(/'manual-review-info'/)
  })

  it("handleUpload routes to 'doctype-picker', not 'detect'", () => {
    // The first goTo() call inside handleUpload must be 'doctype-picker'.
    const handleUpload = sliceBetween(src, '// ── Upload → doctype picker ──', '// ── Doctype picker')
    expect(handleUpload).toMatch(/goTo\('doctype-picker'\)/)
    expect(handleUpload).not.toMatch(/goTo\('detect'\)/)
    expect(handleUpload).not.toMatch(/goTo\('payment'\)/)
  })

  it("handlePickDocType routes 'other_ukrainian_document' → 'manual-review-info'", () => {
    const fn = sliceBetween(src, '// ── Doctype picker', '// ── Plan select')
    expect(fn).toMatch(/goTo\('manual-review-info'\)/)
    expect(fn).toMatch(/choice !== 'ua_internal_passport_booklet'/)
  })

  it("handlePickDocType routes 'ua_internal_passport_booklet' → 'detect' → 'payment'", () => {
    const fn = sliceBetween(src, '// ── Doctype picker', '// ── Plan select')
    expect(fn).toMatch(/goTo\('detect'\)/)
    expect(fn).toMatch(/goTo\('payment'\)/)
  })

  it("doctype-picker and manual-review-info screens render with stable testids", () => {
    expect(src).toMatch(/data-testid="doctype-picker"/)
    expect(src).toMatch(/data-testid="doctype-pick-passport"/)
    expect(src).toMatch(/data-testid="doctype-pick-other"/)
    expect(src).toMatch(/data-testid="manual-review-info"/)
    expect(src).toMatch(/data-testid="manual-review-email"/)
    expect(src).toMatch(/data-testid="manual-review-upload-different"/)
  })

  it("manual-review-info screen does not invoke Stripe/checkout / payment-screen / plan-selection logic", () => {
    // Slice the manual-review-info JSX block specifically.
    const block = sliceBetween(src, "screen === 'manual-review-info'", "screen === 'detect'")
    // Reject anything that would actually drive a payment flow.
    // (The literal word "payment" is allowed because mr.no_payment disclaimer
    //  contains it — what we forbid is the wiring that takes money.)
    expect(block).not.toMatch(/stripe/i)
    expect(block).not.toMatch(/\bcheckout\b/i)
    expect(block).not.toMatch(/setSelectedPlan/)
    expect(block).not.toMatch(/goTo\('payment'\)/)
    expect(block).not.toMatch(/goTo\('price'\)/)
    expect(block).not.toMatch(/handlePayment/)
    expect(block).not.toMatch(/\/api\/stripe/)
  })

  for (const locale of ['uk', 'ru', 'en', 'es'] as const) {
    it(`${locale} declares all dp.* and mr.* keys for picker + manual review`, () => {
      const block = extractLocaleBlock(src, locale)
      const required = [
        'dp.title',
        'dp.sub',
        'dp.passport',
        'dp.passport.hint',
        'dp.other',
        'dp.other.hint',
        'mr.title',
        'mr.body',
        'mr.email_us',
        'mr.upload_different',
        'mr.no_payment',
      ]
      for (const k of required) {
        expect(block, `${locale}: missing key '${k}'`).toMatch(
          new RegExp(`'${k.replace('.', '\\.')}'\\s*:`),
        )
      }
    })
  }

  it('UK manual-review-info body matches the production-truth copy (no instant-PDF promise)', () => {
    const block = extractLocaleBlock(src, 'uk')
    expect(block).toMatch(/може потребувати ручної перевірки нашою командою/)
    expect(block).toMatch(/Ми не вгадуємо/)
  })

  it('RU manual-review-info body matches the production-truth copy', () => {
    const block = extractLocaleBlock(src, 'ru')
    expect(block).toMatch(/может потребовать ручной проверки нашей командой/)
    expect(block).toMatch(/Мы не угадываем/)
  })

  it('EN manual-review-info body matches the production-truth copy', () => {
    const block = extractLocaleBlock(src, 'en')
    expect(block).toMatch(/manual review by our team/i)
    expect(block).toMatch(/We do not guess/i)
  })

  it('ES manual-review-info body matches the production-truth copy', () => {
    const block = extractLocaleBlock(src, 'es')
    expect(block).toMatch(/revisión manual por nuestro equipo/i)
    expect(block).toMatch(/No adivinamos/i)
  })
})

// ── 5. Classifier-driven routing matches wizard truth ──────────────────────

describe('classifyToModule self-serve eligibility (drives /api/translation/classify)', () => {
  it('ua_internal_passport_booklet @ confidence 1.0 → active + auto-PDF', () => {
    const m = classifyToModule('ua_internal_passport_booklet', 1.0)
    expect(m.documentType).toBe('ua_internal_passport_booklet')
    expect(m.status).toBe('active')
    expect(m.reviewPolicy.allowAutoPdf).toBe(true)
  })

  it('ua_birth_certificate routes to manual review (demoted module)', () => {
    const m = classifyToModule('ua_birth_certificate', 1.0)
    expect(m.documentType).toBe('manual_review_required')
    expect(m.reviewPolicy.allowAutoPdf).toBe(false)
  })

  it('ua_marriage_certificate routes to manual review', () => {
    const m = classifyToModule('ua_marriage_certificate', 1.0)
    expect(m.reviewPolicy.allowAutoPdf).toBe(false)
  })

  it('unknown documentType routes to manual review', () => {
    const m = classifyToModule('this_doc_does_not_exist', 1.0)
    expect(m.documentType).toBe('manual_review_required')
    expect(m.reviewPolicy.allowAutoPdf).toBe(false)
  })

  it('ua_internal_passport_booklet @ confidence 0.5 → manual review (low confidence)', () => {
    const m = classifyToModule('ua_internal_passport_booklet', 0.5)
    expect(m.documentType).toBe('manual_review_required')
    expect(m.reviewPolicy.allowAutoPdf).toBe(false)
  })
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
/**
 * Slice the source between two anchor strings (inclusive of start anchor,
 * exclusive of end anchor). Both anchors must exist in `src`.
 */
function sliceBetween(src: string, startAnchor: string, endAnchor: string): string {
  const i = src.indexOf(startAnchor)
  if (i < 0) throw new Error(`startAnchor not found: ${startAnchor}`)
  const j = src.indexOf(endAnchor, i)
  if (j < 0) throw new Error(`endAnchor not found: ${endAnchor}`)
  return src.slice(i, j)
}

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
