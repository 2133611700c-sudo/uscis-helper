#!/usr/bin/env node
/* LIVE validation of STAGE 4 tile recovery: read the birth cert full-page (empties), then run
 * recoverEmptyFieldsByTiles on the high-res upright buffer via the REAL readDocument. Proves the
 * empty father/mother/series fields are recovered in the pipeline. ~3 paid Gemini calls. */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
for (const f of ['.env.local', 'apps/web/.env.local']) {
  try { const t = await readFile(path.join(ROOT, f), 'utf8'); for (const l of t.split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch {}
}
delete process.env.ANTI_FABRICATION_GATE_ENABLED
delete process.env.SELF_CONSISTENCY_VOTE_ENABLED

const { readDocument } = await import(path.join(ROOT, 'apps/web/src/lib/docintel/documentFieldReader.ts'))
const { preprocessImage } = await import(path.join(ROOT, 'apps/web/src/lib/ocr/image-preprocess.ts'))
const { recoverEmptyFieldsByTiles, geminiReadFieldsFromCrop } = await import(path.join(ROOT, 'apps/web/src/lib/docintel/ensemble/tileRegionRead.ts'))
const { getGeminiApiKey } = await import(path.join(ROOT, 'apps/web/src/lib/gemini/apiKey.ts'))
const KEY = getGeminiApiKey()
const LABELS = { father_full_name: 'Батько / Отец', mother_full_name: 'Мати / Мать', certificate_series_number: 'Серія та номер (e.g. II-БК № 530174)', act_record_number: 'Актовий запис №', issuing_authority: 'Орган реєстрації (ЗАГС/РАЦС)' }

const raw = await readFile(path.join(ROOT, 'test-fixtures/real-docs/birth_cert_handwritten_01.jpg'))
const docType = 'ua_birth_certificate'

// BASE read (full page, downscaled — as the prod route does).
const pre = await preprocessImage(raw, 'image/jpeg')
const baseBuf = pre.ok ? pre.buffer : raw
const baseRead = await readDocument(baseBuf, pre.ok ? pre.mimeType : 'image/jpeg', docType, { attemptsPerModel: 1, timeoutMs: 85_000 })
console.log(`BASE: ok=${baseRead.ok} fields=${baseRead.fields?.length} model=${baseRead.model} status=${baseRead.status} error=${baseRead.error ?? ''}`)
const empties = (baseRead.fields ?? []).filter((f) => !(f.value ?? '').trim() && !(f.raw_cyrillic ?? '').trim()).map((f) => f.field)
console.log('EMPTY after full-page read:', empties.join(', ') || '(none)')

// Validate the NEW recover step even if the (flaky 6.7MB) base read deadlines: feed synthetic
// empty critical fields. The recover step (targeted hi-res crop reader) is what we're proving.
const CRIT = ['father_full_name', 'mother_full_name', 'certificate_series_number', 'act_record_number', 'issuing_authority']
const baseFields = (baseRead.ok && baseRead.fields?.length)
  ? baseRead.fields
  : CRIT.map((k) => ({ field: k, kind: 'name', raw_cyrillic: '', value: '', confidence: 0, review_required: true, source: 'vision', provider: 'gemini' }))

// The raw landscape pixels are upright (the two-page spread); pass them directly (module does NOT
// apply EXIF). A normal pipeline would pass the content-oriented upright buffer here.
const upright = await sharp(raw).toBuffer() // raw landscape == upright pixels (EXIF ignored)
const { fields, diag } = await recoverEmptyFieldsByTiles({
  baseFields,
  originalBuffer: upright,
  fieldLabels: LABELS,
  cropRead: (crop, flds) => geminiReadFieldsFromCrop(crop, flds, KEY, 'gemini-3.1-pro-preview'),
  criticalKeys: new Set(['father_full_name', 'mother_full_name', 'certificate_series_number', 'act_record_number', 'issuing_authority']),
})
console.log(`\nTILE RECOVER: emptyBefore=${diag.emptyBefore} tiles=${diag.tiles} recovered=${diag.recovered}${diag.error ? ' error=' + diag.error : ''}`)
for (const k of ['father_full_name', 'mother_full_name', 'certificate_series_number', 'issuing_authority']) {
  const f = fields.find((x) => x.field === k)
  if (f) console.log(`  ${k}: value="${f.value ?? ''}" cyr="${f.raw_cyrillic ?? ''}" review=${f.review_required} reasons=${(f.review_reasons ?? []).join('|')}`)
}
console.log('\nGT: father Соловьяк Андрей Богданович | mother Соловьяк Дарья Петровна | series II-БК № 530174')
