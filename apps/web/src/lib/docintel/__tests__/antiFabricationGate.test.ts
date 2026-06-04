import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  applyAntiFabricationGate,
  isIdentityCriticalField,
  ANTI_FABRICATION_REASONS,
  HANDWRITTEN_FABRICATION_RISK_CLASSES,
} from '../antiFabricationGate'
import { readDocument } from '../documentFieldReader'
import type { ExtractedDocField, VisionProvider, VisionReadResult } from '../types'

function field(p: Partial<ExtractedDocField> & Pick<ExtractedDocField, 'field'>): ExtractedDocField {
  return {
    kind: 'name', raw_cyrillic: null, value: 'X', confidence: 0.99,
    review_required: false, source: 'vision', provider: 'stub', ...p,
  }
}

describe('isIdentityCriticalField', () => {
  it('matches identity fields incl. role-grounded variants', () => {
    for (const f of ['family_name', 'given_name', 'child_patronymic', 'middle_name',
      'child_dob', 'date_of_birth', 'place_of_birth_city', 'place_city',
      'issuing_authority', 'father_full_name', 'spouse_1_full_name']) {
      expect(isIdentityCriticalField(f)).toBe(true)
    }
  })
  it('does NOT match non-identity fields', () => {
    for (const f of ['act_record_number', 'passport_number', 'series_number', 'date_of_issue']) {
      expect(isIdentityCriticalField(f)).toBe(false)
    }
  })
})

describe('trigger scope', () => {
  it('allowlist = handwritten birth classes only (excludes printed marriage + unknown)', () => {
    expect(HANDWRITTEN_FABRICATION_RISK_CLASSES.has('birth_certificate_handwritten')).toBe(true)
    expect(HANDWRITTEN_FABRICATION_RISK_CLASSES.has('birth_certificate_soviet_bilingual')).toBe(true)
    expect(HANDWRITTEN_FABRICATION_RISK_CLASSES.has('marriage_apostille')).toBe(false)
    expect(HANDWRITTEN_FABRICATION_RISK_CLASSES.has('unknown_document')).toBe(false)
    expect(HANDWRITTEN_FABRICATION_RISK_CLASSES.has('internal_passport_booklet')).toBe(false)
  })

  it('printed marriage_apostille (ua_marriage_certificate) is NOT forced', () => {
    const input = [field({ field: 'spouse_1_full_name', value: 'X', review_required: false })]
    expect(applyAntiFabricationGate(input, 'ua_marriage_certificate')).toEqual(input)
  })

  it('unknown_document is NOT forced', () => {
    const input = [field({ field: 'family_name', value: 'X', review_required: false })]
    expect(applyAntiFabricationGate(input, 'some_unmapped_doc_id')).toEqual(input)
  })
})

describe('applyAntiFabricationGate (pure)', () => {
  it('handwritten birth cert: forces review on identity, keeps value, adds reasons', () => {
    const out = applyAntiFabricationGate([
      field({ field: 'child_family_name', value: 'Kuropiatnyk', review_required: false }),
      field({ field: 'act_record_number', value: '87', review_required: false }),
    ], 'ua_birth_certificate')
    const name = out.find((f) => f.field === 'child_family_name')!
    expect(name.review_required).toBe(true)
    expect(name.value).toBe('Kuropiatnyk') // value unchanged
    expect(name.review_reasons).toEqual([...ANTI_FABRICATION_REASONS])
    const act = out.find((f) => f.field === 'act_record_number')!
    expect(act.review_required).toBe(false) // non-identity untouched
    expect(act.review_reasons).toBeUndefined()
  })

  it('model review_required=false on identity cannot survive the gate', () => {
    const out = applyAntiFabricationGate(
      [field({ field: 'child_given_name', value: 'Serhei', review_required: false })],
      'ua_birth_certificate',
    )
    expect(out[0].review_required).toBe(true)
  })

  it('non-hard-case (passport): fields untouched (MRZ identity not blanket-forced)', () => {
    const input = [
      field({ field: 'family_name', value: 'KUROPIATNYK', review_required: false }),
      field({ field: 'passport_number', value: 'FU262473', review_required: false }),
    ]
    const out = applyAntiFabricationGate(input, 'ua_international_passport')
    expect(out).toEqual(input)
  })

  it('never lowers an already-true flag', () => {
    const out = applyAntiFabricationGate(
      [field({ field: 'family_name', value: 'X', review_required: true })],
      'ua_birth_certificate',
    )
    expect(out[0].review_required).toBe(true)
  })
})

// ── gating + route coverage ───────────────────────────────────────────────
function stub(): VisionProvider {
  return {
    name: 'stub',
    async readFields(): Promise<VisionReadResult> {
      return {
        ok: true, model: 'stub', ms: 1,
        fields: [
          { field: 'child_family_name', cyrillic: 'Куропятник', can_read: true, confidence: 0.99, reason: '' },
          { field: 'act_record_number', cyrillic: '87', can_read: true, confidence: 0.99, reason: '' },
        ],
      }
    },
  }
}

describe('readDocument — ANTI_FABRICATION_GATE_ENABLED gating', () => {
  afterEach(() => { delete process.env.ANTI_FABRICATION_GATE_ENABLED })

  it('flag OFF: hard-case identity NOT force-reviewed (current behavior)', async () => {
    delete process.env.ANTI_FABRICATION_GATE_ENABLED
    const res = await readDocument(Buffer.from('x'), 'image/jpeg', 'ua_birth_certificate', { provider: stub() })
    const n = res.fields.find((f) => f.field === 'child_family_name')!
    expect(n.review_required).toBe(false)
    expect(n.review_reasons).toBeUndefined()
  })

  it('flag ON: hard-case identity forced to review with reasons', async () => {
    process.env.ANTI_FABRICATION_GATE_ENABLED = '1'
    const res = await readDocument(Buffer.from('x'), 'image/jpeg', 'ua_birth_certificate', { provider: stub() })
    const n = res.fields.find((f) => f.field === 'child_family_name')!
    expect(n.review_required).toBe(true)
    expect(n.review_reasons).toContain('handwritten_document')
    const act = res.fields.find((f) => f.field === 'act_record_number')!
    expect(act.review_required).toBe(false) // non-identity untouched
  })
})

describe('route coverage — all 4 products call readDocument (gate inherited)', () => {
  const WEB = path.join(__dirname, '../../../..') // → apps/web
  const routes = [
    'src/app/api/tps/ocr/extract/route.ts',
    'src/app/api/translation/vision-extract/route.ts',
    'src/app/api/reparole/ocr/extract/route.ts',
    'src/app/api/ead/ocr/extract/route.ts',
  ]
  for (const r of routes) {
    it(`${r} calls readDocument`, () => {
      const src = fs.readFileSync(path.join(WEB, r), 'utf8')
      expect(src).toMatch(/readDocument\s*\(/)
    })
  }
})
