/**
 * engine/presence.ts — C3 recognition (WINNER of the 4-config bench, 2026-05-29).
 * Gemini reads each field; Google Vision raw OCR CONFIRMS the value is physically
 * on the page (substring presence). Accept only confirmed values → high auto-fill
 * on printed docs (5–6/6) AND anti-fabrication on handwriting (a fabricated value
 * is not in the OCR → rejected → 0 accepted). Then D2 normalize (KMU-55/gazetteer/
 * patronymic/date/glossary), same as the consensus path.
 */
import { geminiReader, googleVisionFullText } from './models'
import { normalize, type EngineField, type EngineResult } from './orchestrator'
import type { ConsensusField } from './consensus'
import type { Sex } from '@uscis-helper/knowledge'
import { DOC_TYPES, openNameFields, printedFields } from './docTypes'
import type { ProseTranslator } from './translator'

const norm = (s: string) => (s ?? '').toLocaleLowerCase('uk').replace(/[^a-zа-яіїєґ0-9]/giu, '')

/** Is the LLM-read value actually present in the page's OCR text? */
export function isPresent(value: string, fullTextNorm: string): boolean {
  const v = norm(value)
  if (v.length < 3) return !!v && fullTextNorm.includes(v)
  return fullTextNorm.includes(v.slice(0, Math.min(10, v.length)))
}

export async function extractDocumentPresence(
  image: Buffer, mime: string, docTypeId: string,
  opts: { geminiApiKey: string; gvApiKey: string; proseTranslator?: ProseTranslator; geminiModel?: string },
): Promise<EngineResult> {
  const spec = DOC_TYPES[docTypeId]
  if (!spec) throw new Error(`unknown doc type: ${docTypeId}`)
  const keys = spec.fields.map((f) => f.key)
  const printed = new Set(printedFields(spec))
  const openNames = new Set(openNameFields(spec))

  const [gem, ft] = await Promise.all([
    geminiReader({ apiKey: opts.geminiApiKey, model: opts.geminiModel, docTypeEn: spec.title_en }).read(image, mime, keys),
    googleVisionFullText(image, opts.gvApiKey),
  ])
  const ftNorm = norm(ft)

  const sex: Sex = /ж|f/i.test(gem['sex']?.cyrillic ?? '') ? 'F' : 'M'
  const givenName = gem['given_name']?.cyrillic || (gem['child_full_name']?.cyrillic ?? '').split(/\s+/)[1]

  const fields: EngineField[] = spec.fields.map((spc) => {
    const g = gem[spc.key]
    const read = !!g?.can_read && !!g?.cyrillic
    const present = read && isPresent(g!.cyrillic, ftNorm)
    const cf: ConsensusField = present
      ? { field: spc.key, value: g!.cyrillic, can_read: true, confidence: 0.9,
          review_required: openNames.has(spc.key) || printed.has(spc.key),
          reason: 'gemini read + confirmed on page (OCR presence)', candidates: [] }
      : { field: spc.key, value: '', can_read: false, confidence: 0, review_required: true,
          reason: read ? 'gemini value NOT confirmed on page (guarded)' : 'gemini could not read', candidates: [] }
    const n = normalize(spc, cf, { sex, givenName })
    return { field: spc.key, cyrillic: cf.can_read ? cf.value : '', latin: n.latin,
      can_read: cf.can_read, review_required: n.review, source: n.source, candidates: [] }
  })

  if (opts.proseTranslator) {
    const locked = fields.filter((f) => f.latin && /name|number/.test(spec.fields.find((s) => s.key === f.field)?.kind ?? '')).map((f) => f.cyrillic)
    for (const f of fields) {
      if (f.can_read && !f.latin && f.source === 'needs-prose-translation') {
        f.latin = await opts.proseTranslator(f.cyrillic, locked); f.source = 'deepseek-prose'
      }
    }
  }

  return { doc_type_id: docTypeId, fields, models: ['gemini+google-vision-presence'],
    auto_accepted: fields.filter((f) => f.can_read && !f.review_required).length,
    needs_human: fields.filter((f) => f.review_required).length }
}
