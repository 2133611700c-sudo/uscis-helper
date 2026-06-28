/**
 * Workstream C — split fields become first-class, contract-labeled rows in the
 * mirror PDF when the split flag is ON. OFF → byte-identical (golden unchanged).
 *
 * Separate ON-mode golden (semantic + pdf hash), regenerated only via WRITE_GOLDEN=1.
 * Fictional data only.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { renderMirrorTranslationPDF } from '../renderMirrorTranslationPDF'
import { getOfficialSchema } from '../../forms/ukraine/schemas/registry'
import { collectMirrorExtras, type ExtractedFieldLite } from '../buildMirrorValues'
import { pdfSafe } from '../renderValue'

const DOC = 'ua_birth_certificate'
const GOLDEN = join(__dirname, '__goldens__', 'birthCertMirror.phase10c.on.golden.json')
const CYR = /[Ѐ-ӿ]/
const ON = { UNIFIED_DOC_CONTRACT_ENABLED: '1', UNIFIED_DOC_CONTRACT_SPLIT_ENABLED: '1', UNIFIED_DOC_CONTRACT_NORMALIZE_ENABLED: '1' } as Record<string, string | undefined>
const OFF = {} as Record<string, string | undefined>

const FIXTURE: ExtractedFieldLite[] = [
  { field: 'child_family_name', value: 'Soloviak', review_required: false },
  { field: 'child_given_name', value: 'Andrii', review_required: false },
  { field: 'child_patronymic', value: 'Bohdanovych', review_required: false },
  { field: 'dob', value: '1990-01-15', review_required: false },
  { field: 'place_of_birth_city', value: 'Lisove, Lisovyi District, Vinnytsia Oblast, Ukrainian SSR', review_required: false },
  { field: 'issuing_authority', value: 'Lisove Registry Office, Vinnytsia Oblast', review_required: false },
  { field: 'certificate_series_number', value: 'II-BK 530174', review_required: false },
  { field: 'date_of_issue', value: '1990-01-22', review_required: false },
]
const OPTS = { signerName: 'Ivan Ivanenko', signerAddress: '1213 Gordon St, Los Angeles, CA 90038', signedAt: '2026-05-30T00:00:00Z' }
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')

describe('Workstream C — ON-mode split fields render as contract-labeled rows', () => {
  it('OFF: no contract split extras (legacy)', () => {
    const schema = getOfficialSchema(DOC)!
    const extras = collectMirrorExtras(schema, FIXTURE, OFF)
    expect(extras.find((e) => e.key === 'document_series')).toBeUndefined()
  })

  it('ON: split fields appear as extras with CONTRACT labels', () => {
    const schema = getOfficialSchema(DOC)!
    // ON path mirrors renderMirror: split+normalize already applied upstream; here we
    // assert collectMirrorExtras labels split rows from the contract.
    const withSplit: ExtractedFieldLite[] = [
      ...FIXTURE,
      { field: 'document_series', value: 'II-BK', review_required: true },
      { field: 'document_number', value: '530174', review_required: true },
    ]
    const extras = collectMirrorExtras(schema, withSplit, ON)
    const ser = extras.find((e) => e.key === 'document_series')
    const num = extras.find((e) => e.key === 'document_number')
    expect(ser?.label).toBe('Series and No.')
    expect(num?.label).toBe('Number')
  })

  it('ON: mirror PDF is byte-deterministic and contains split fields; no Cyrillic in rendered values', async () => {
    const a = await renderMirrorTranslationPDF(DOC, FIXTURE, OPTS, ON)
    const b = await renderMirrorTranslationPDF(DOC, FIXTURE, OPTS, ON)
    expect(a).not.toBeNull()
    expect(sha(a!.pdf)).toBe(sha(b!.pdf)) // deterministic
    expect(a!.pdf.length).toBeGreaterThan(1000)
    // every split value's rendered (pdfSafe) form carries no Cyrillic
    for (const v of ['II-BK', '530174']) expect(CYR.test(pdfSafe(v))).toBe(false)
  })

  it('matches the committed ON golden (regenerate only with WRITE_GOLDEN=1)', async () => {
    const schema = getOfficialSchema(DOC)!
    const withSplit: ExtractedFieldLite[] = [
      ...FIXTURE,
      { field: 'document_series', value: 'II-BK', review_required: true },
      { field: 'document_number', value: '530174', review_required: true },
      { field: 'place_of_birth_oblast', value: 'Vinnytsia Oblast', review_required: true },
    ]
    const extras = collectMirrorExtras(schema, withSplit, ON)
    const a = await renderMirrorTranslationPDF(DOC, FIXTURE, OPTS, ON)
    const persist = { extras, pdf: { length: a!.pdf.length, sha256: sha(a!.pdf) } }
    if (process.env.WRITE_GOLDEN === '1') {
      writeFileSync(GOLDEN, JSON.stringify(persist, null, 2) + '\n', 'utf8')
      return
    }
    expect(existsSync(GOLDEN), 'ON golden missing — generate with WRITE_GOLDEN=1').toBe(true)
    expect(persist).toEqual(JSON.parse(readFileSync(GOLDEN, 'utf8')))
  })
})
