/**
 * engine/orchestrator.ts — the CHIEF ENGINEER (Central Brain).
 *
 * One entry point: extractDocument(image, docTypeId, readers).
 * Pipeline (controls every department):
 *   1. D1 readers (LLMs now, + Transkribus HTR when key) read independently.
 *   2. consensus + hallucination guard + open-name systematic-error guard.
 *   3. D2 normalize each accepted value by kind:
 *        name        → KMU-55 transliteration (patronymic → validate/reconstruct)
 *        place_city  → gazetteer snap (Простянець→Тростянець)
 *        place_oblast→ genitive→nominative + DMS English
 *        date        → kept as read (ISO if model gave it)
 *   4. Emit canonical fields with provenance + review flags. NEVER guesses.
 */

import { transliterateKMU55, snapCity, reconcilePatronymic, normalizeOblastToNominative, lookupSettlement, normalizeOblastRegistry, lookupAuthority, translateCivilRegistryTerm, type Sex } from '@uscis-helper/knowledge'
import { consensusRead, type NamedReader, type ConsensusField } from './consensus'
import { DOC_TYPES, printedFields, openNameFields, type DocFieldSpec } from './docTypes'
import { formatDateEn, translateAuthority } from './terminologist'

export interface EngineField {
  field: string
  cyrillic: string          // accepted Cyrillic value ('' if guarded)
  latin: string             // normalized English/Latin output ('' if none)
  can_read: boolean
  review_required: boolean
  source: string            // provenance: how the value was obtained
  candidates: ConsensusField['candidates']
}

export interface EngineResult {
  doc_type_id: string
  fields: EngineField[]
  models: string[]
  auto_accepted: number
  needs_human: number
}

function sexFromField(fields: Record<string, ConsensusField>): Sex {
  const s = (fields['sex']?.value ?? '').toLocaleLowerCase('uk')
  return /ж|f/.test(s) ? 'F' : 'M'
}

/** D2 normalization for one consensus field → Latin/English canonical value. */
export function normalize(spec: DocFieldSpec, cf: ConsensusField, ctx: { sex: Sex; givenName?: string; documentDate?: string }): { latin: string; source: string; review: boolean } {
  if (!cf.can_read || !cf.value) return { latin: '', source: cf.reason, review: true }
  const docDate = ctx.documentDate

  switch (spec.kind) {
    case 'name': {
      if (spec.key === 'patronymic') {
        const r = reconcilePatronymic(cf.value, ctx.givenName ?? '', ctx.sex)
        return { latin: r.value ? transliterateKMU55(r.value) : '', source: `patronymic:${r.source}`, review: r.review_required || cf.review_required }
      }
      return { latin: transliterateKMU55(cf.value), source: 'KMU-55', review: cf.review_required }
    }
    case 'place_city': {
      // D-GLOSSARY first: registry preserves the settlement TYPE (смт→urban-type
      // settlement) and era + provenance. Fall back to the gazetteer on a miss.
      const reg = lookupSettlement(cf.value, undefined, docDate)
      if (reg.matched) {
        const en = reg.settlementType ? `${reg.official_en} (${reg.settlementType})` : reg.official_en
        return { latin: en, source: `registry:settlement:${reg.source_url}`, review: reg.review_required || cf.review_required }
      }
      const m = snapCity(cf.value)
      return { latin: m.value ? transliterateKMU55(m.value) : '', source: m.reason, review: m.review_required || cf.review_required }
    }
    case 'place_oblast': {
      const reg = normalizeOblastRegistry(cf.value, docDate)
      if (reg.matched) return { latin: reg.official_en, source: `registry:oblast:${reg.source_url}`, review: reg.review_required || cf.review_required }
      const o = normalizeOblastToNominative(cf.value)
      return o ? { latin: o.transliterated, source: 'oblast→nominative+DMS', review: cf.review_required }
               : { latin: transliterateKMU55(cf.value), source: 'oblast:raw-translit', review: true }
    }
    case 'date': {
      const en = formatDateEn(cf.value)
      return en ? { latin: en, source: 'date→EN', review: cf.review_required }
                : { latin: '', source: 'date-unparseable', review: true }
    }
    case 'sex':
      return { latin: /ж|f/i.test(cf.value) ? 'Female' : 'Male', source: 'sex-map', review: cf.review_required }
    case 'text': {
      // D-GLOSSARY: authority → civil-registry term → passport authority, all
      // era-gated + with provenance. On a miss, leave latin empty for the optional
      // D3b prose translator (never silently drop — review_required stays true).
      const reg = lookupAuthority(cf.value, docDate)
      if (reg.matched) return { latin: reg.official_en, source: `registry:authority:${reg.source_url}`, review: reg.review_required || cf.review_required }
      const cr = translateCivilRegistryTerm(cf.value, docDate)
      if (cr.matched) return { latin: cr.official_en, source: `registry:civil_registry:${cr.source_url}`, review: cr.review_required || cf.review_required }
      const auth = translateAuthority(cf.value) // legacy fallback
      return auth ? { latin: auth, source: 'glossary', review: cf.review_required }
                  : { latin: '', source: 'needs-prose-translation', review: cf.review_required }
    }
    case 'number':
    default:
      return { latin: cf.value, source: spec.kind, review: cf.review_required }
  }
}

export async function extractDocument(
  image: Buffer,
  mime: string,
  docTypeId: string,
  readers: NamedReader[],
  opts: { agreeTol?: number; proseTranslator?: import('./translator').ProseTranslator } = {},
): Promise<EngineResult> {
  const spec = DOC_TYPES[docTypeId]
  if (!spec) throw new Error(`unknown doc type: ${docTypeId}`)

  const fieldKeys = spec.fields.map((f) => f.key)
  const consensus = await consensusRead(image, mime, fieldKeys, readers, {
    printedFields: printedFields(spec),
    openNameFields: openNameFields(spec),
    agreeTol: opts.agreeTol,
  })

  const sex = sexFromField(consensus.fields)
  const givenName =
    consensus.fields['given_name']?.value ||
    (consensus.fields['child_full_name']?.value ?? '').split(/\s+/)[1] // "Surname Given Patronymic"

  const fields: EngineField[] = spec.fields.map((spc) => {
    const cf = consensus.fields[spc.key]
    const n = normalize(spc, cf, { sex, givenName })
    return {
      field: spc.key,
      cyrillic: cf.can_read ? cf.value : '',
      latin: n.latin,
      can_read: cf.can_read,
      review_required: n.review,
      source: n.source,
      candidates: cf.candidates,
    }
  })

  // D3b — optional prose translation for free-text fields the glossary didn't
  // cover. Names/numbers are locked (passed as do-not-translate tokens).
  if (opts.proseTranslator) {
    const locked = fields.filter((f) => f.latin && /name|number/.test(spec.fields.find((s) => s.key === f.field)?.kind ?? '')).map((f) => f.cyrillic)
    for (const f of fields) {
      if (f.can_read && !f.latin && f.source === 'needs-prose-translation') {
        f.latin = await opts.proseTranslator(f.cyrillic, locked)
        f.source = 'deepseek-prose'
      }
    }
  }

  return {
    doc_type_id: docTypeId,
    fields,
    models: consensus.models,
    auto_accepted: fields.filter((f) => f.can_read && !f.review_required).length,
    needs_human: fields.filter((f) => f.review_required).length,
  }
}
