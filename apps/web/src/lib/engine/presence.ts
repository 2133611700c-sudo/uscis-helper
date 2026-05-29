/**
 * engine/presence.ts — C3 recognition (WINNER of the 4-config bench, 2026-05-29).
 * Gemini reads each field; Google Vision raw OCR CONFIRMS the value is physically
 * on the page (substring presence). Accept only confirmed values → high auto-fill
 * on printed docs (5–6/6) AND anti-fabrication on handwriting (a fabricated value
 * is not in the OCR → rejected → 0 accepted). Then D2 normalize (KMU-55/gazetteer/
 * patronymic/date/glossary), same as the consensus path.
 */
import { parseMrz } from '@uscis-helper/knowledge'
import { geminiReader, googleVisionFullText } from './models'
import { preprocessImage } from './preprocess'
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

  // D0 intake: clean the pixels before any model sees them (auto-orient, grayscale,
  // contrast-normalize, downscale). Fails open → original image on any error.
  const pre = await preprocessImage(image, mime)
  const img = pre.image
  const imgMime = pre.mime

  const [gem, ft] = await Promise.all([
    geminiReader({ apiKey: opts.geminiApiKey, model: opts.geminiModel ?? process.env.GEMINI_MODEL, docTypeEn: spec.title_en }).read(img, imgMime, keys),
    googleVisionFullText(img, opts.gvApiKey),
  ])
  const ftNorm = norm(ft)

  const sex: Sex = /ж|f/i.test(gem['sex']?.cyrillic ?? '') ? 'F' : 'M'
  const givenName = gem['given_name']?.cyrillic || (gem['child_full_name']?.cyrillic ?? '').split(/\s+/)[1]
  // Document era for glossary era-gating: latest 4-digit year seen across reads
  // (issue year for IDs, the single year on old certificates). Drives "do not
  // modernise a historical authority/place name".
  const years = (Object.values(gem).map((g) => g?.cyrillic ?? '').join(' ').match(/\b(?:19|20)\d{2}\b/g) ?? [])
  const documentDate = years.length ? String(Math.max(...years.map(Number))) : undefined

  const fields: EngineField[] = spec.fields.map((spc) => {
    const g = gem[spc.key]
    const read = !!g?.can_read && !!g?.cyrillic
    const present = read && isPresent(g!.cyrillic, ftNorm)
    // Google Vision OCR confirms PRINTED text reliably but garbles HANDWRITING.
    // So presence-confirm may only DISCARD machine-printed fields (where GV is a
    // trustworthy fabrication check). For handwritten fields GV cannot confirm —
    // discarding there would throw away the reader's correct handwriting reads
    // (proven 2026-05-29: gate kept only 1/7 correct reads on a handwritten cert).
    // Instead: keep the read, force human review (handwriting is never auto-final).
    const machinePrinted = spc.handwritten === false
    let cf: ConsensusField
    if (present) {
      cf = { field: spc.key, value: g!.cyrillic, can_read: true, confidence: 0.9,
        review_required: openNames.has(spc.key) || printed.has(spc.key),
        reason: 'gemini read + OCR-confirmed on page', candidates: [] }
    } else if (read && !machinePrinted) {
      cf = { field: spc.key, value: g!.cyrillic, can_read: true, confidence: 0.55,
        review_required: true,
        reason: 'gemini read handwriting; OCR could not confirm → human review required', candidates: [] }
    } else if (read && machinePrinted) {
      cf = { field: spc.key, value: '', can_read: false, confidence: 0, review_required: true,
        reason: 'printed field not found in OCR — guarded as possible fabrication', candidates: [] }
    } else {
      cf = { field: spc.key, value: '', can_read: false, confidence: 0, review_required: true,
        reason: 'gemini could not read', candidates: [] }
    }
    const n = normalize(spc, cf, { sex, givenName, documentDate })
    return { field: spc.key, cyrillic: cf.can_read ? cf.value : '', latin: n.latin,
      can_read: cf.can_read, review_required: n.review, source: n.source, candidates: [] }
  })

  // CONTROLLING LATIN (HARD RULE): for an international passport the MRZ is the
  // authoritative Latin spelling of the name/number/DOB — it must beat KMU-55
  // re-transliteration so the translation matches the client's EAD/I-94.
  if (docTypeId === 'ua_international_passport') {
    const mrz = parseMrz(ft)
    if (mrz.ok) {
      const override: Record<string, { v: string; review: boolean }> = {
        family_name: { v: mrz.surname, review: mrz.review_required },
        given_name: { v: mrz.given_names, review: mrz.review_required },
        passport_number: { v: mrz.passport_no, review: !mrz.checks.passport_no },
        date_of_birth: { v: mrz.date_of_birth ?? '', review: !mrz.checks.dob },
        nationality: { v: mrz.nationality, review: false },
        date_of_expiry: { v: mrz.expiry ?? '', review: !mrz.checks.expiry },
        sex: { v: mrz.sex === 'M' ? 'Male' : mrz.sex === 'F' ? 'Female' : '', review: !mrz.sex },
      }
      for (const f of fields) {
        const o = override[f.field]
        if (o && o.v) { f.latin = o.v; f.can_read = true; f.review_required = o.review; f.source = 'mrz:controlling-latin' }
      }
    }
  }

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
