/**
 * Phase 4 — single label source (English PDF + Ukrainian review), flag-gated.
 *
 * Proves:
 *  - the contract's reviewLabelUk equals the legacy UKR_LABEL_BY_FIELD for every
 *    birth-cert read-side key (the wizard's third, independent label map folds in);
 *  - the contract's englishLabel equals the B-schema sourceLabelEn (PDF label source);
 *  - ukrLabelFor is identical OFF vs ON for every known key + unknown fallback;
 *  - renderOfficialTranslation produces a BYTE-IDENTICAL PDF OFF vs ON.
 *
 * Flag OFF is the default → no runtime behaviour change. Fictional data only.
 */
import { describe, it, expect } from 'vitest'
import {
  birthCertReviewLabels,
  fieldByOutputKey,
  birthCertSovietV1Contract as CONTRACT,
} from '../birthCertSovietV1Contract'
import { UKR_LABEL_BY_FIELD, ukrLabelFor } from '@/components/services/translation/translationFieldLabels'
import { renderOfficialTranslation, type FieldValue } from '@/lib/translation/pdf/templates/ukraine/renderOfficialTranslation'
import { getOfficialSchema } from '@/lib/translation/forms/ukraine/schemas/registry'

const OFF = {} as Record<string, string | undefined>
const ON = { UNIFIED_DOC_CONTRACT_ENABLED: '1' } as Record<string, string | undefined>

describe('Phase 4 — Ukrainian review label: contract == legacy', () => {
  it('every contract reviewLabelUk equals UKR_LABEL_BY_FIELD[readSideKey]', () => {
    const fromContract = birthCertReviewLabels()
    expect(Object.keys(fromContract).length).toBeGreaterThanOrEqual(12)
    for (const [readSideKey, label] of Object.entries(fromContract)) {
      expect(label, `reviewLabelUk for '${readSideKey}' must equal the legacy map`).toBe(UKR_LABEL_BY_FIELD[readSideKey])
    }
  })

  it('ukrLabelFor is identical OFF vs ON for every known key and an unknown fallback', () => {
    for (const key of [...Object.keys(UKR_LABEL_BY_FIELD), 'totally_unknown_key']) {
      expect(ukrLabelFor(key, ON), `label drift for '${key}'`).toBe(ukrLabelFor(key, OFF))
    }
  })
})

describe('Phase 4 — English PDF label: contract == B schema sourceLabelEn', () => {
  const schema = getOfficialSchema('ua_birth_certificate')!
  it('contract englishLabel (by outputKey) equals schema sourceLabelEn for every schema field', () => {
    for (const f of schema.fields) {
      const c = fieldByOutputKey(f.key)
      expect(c, `schema key '${f.key}' must be covered by the contract`).toBeDefined()
      expect(c?.englishLabel, `english label drift for '${f.key}'`).toBe(f.sourceLabelEn)
    }
  })
})

describe('Phase 4 — renderOfficialTranslation: BYTE-IDENTICAL OFF vs ON', () => {
  it('the rendered birth-cert mirror PDF is byte-for-byte identical OFF vs ON', async () => {
    const schema = getOfficialSchema('ua_birth_certificate')!
    // Fictional values keyed by official-schema key (no real PII).
    const fv = (value: string, review = false): FieldValue => ({ value, review, canRead: true })
    const values: Record<string, FieldValue> = {
      child_surname: fv('Ivanenko'),
      child_given_name: fv('Olha'),
      child_patronymic: fv('Petrivna', true),
      date_of_birth: fv('05/14/1990'),
      place_of_birth: fv('Vinnytsia'),
      act_record_number: fv('84'),
      place_of_registration: fv('Vinnytsia City Civil Registry Office'),
      series_number: fv('II-BK 530174'),
      date_of_issue: fv('05/22/1990'),
    }
    const opts = { signerName: 'Test Translator', signerAddress: '1 Test St', signedAt: '2020-01-02T00:00:00.000Z' }
    const off = await renderOfficialTranslation(schema, values, opts, OFF)
    const on = await renderOfficialTranslation(schema, values, opts, ON)
    expect(on.unresolved).toEqual(off.unresolved)
    expect(Buffer.compare(on.pdf, off.pdf), 'PDF bytes must be identical OFF vs ON').toBe(0)
  })
})

describe('Phase 4 — contract carries a review label for every read-side birth-cert field', () => {
  it('no contract field with a readSideKey + a legacy UK label is missing reviewLabelUk', () => {
    for (const f of CONTRACT) {
      if (f.readSideKey && UKR_LABEL_BY_FIELD[f.readSideKey]) {
        expect(f.reviewLabelUk, `${f.canonicalKey} (${f.readSideKey}) must carry reviewLabelUk`).toBeDefined()
      }
    }
  })
})
