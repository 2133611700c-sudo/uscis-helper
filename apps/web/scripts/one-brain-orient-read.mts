#!/usr/bin/env node
/**
 * One Brain orientation + handwritten Cyrillic probe.
 *
 * Usage:
 *   pnpm --dir apps/web exec tsx scripts/one-brain-orient-read.mts \
 *     --file /path/to/doc.jpg --doc-type ua_birth_certificate
 *
 * The tool uses the existing shared spine:
 *   preprocessImage -> readDocument (orientation + posture + canonical fields)
 * and prints a compact posture/handwriting summary plus the handwritten fields.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

for (const f of ['.env.local', 'apps/web/.env.local']) {
  try {
    const txt = await readFile(path.join(ROOT, f), 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    // optional
  }
}

function getArg(name: string): string | null {
  const idx = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`))
  if (idx < 0) return null
  const arg = process.argv[idx]
  if (arg.includes('=')) return arg.split('=').slice(1).join('=')
  return process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--') ? process.argv[idx + 1] : null
}

function normalizeDocTypeId(value: string): { docTypeId: string; aliasUsed: string | null } {
  const raw = value.trim()
  const aliases: Record<string, string> = {
    // EYES-FIRST AUDIT FIX (2026-07-06): internal_passport_01.jpg is NOT the internal
    // passport booklet -- it is the PRINTED international (foreign-travel) passport
    // (bilingual UA/EN labels, MRZ, biometric-card layout). This was already discovered
    // and recorded in qa-private/ground-truth/internal_passport_01.json._meta back on
    // 2026-06-27 ("handwritten_actual": false) and gt-pipeline-bench.mjs already scores
    // it as 'ua_international_passport' -- this CLI's alias contradicted that established
    // truth. ua_internal_passport_booklet has ZERO real fixtures in this project (its GT
    // placeholders booklet_page_1..4.json are all ground_truth_status:"MISSING", no image
    // file exists) -- do not alias any real filename to it until a genuine booklet photo
    // is captured.
    internal_passport_01: 'ua_international_passport',
    birth_cert_handwritten_01: 'ua_birth_certificate',
    birth_cert_soviet_01: 'ua_birth_certificate',
    military_id_p1_01: 'ua_military_id',
    military_id_p2_01: 'ua_military_id',
    marriage_1939_kharkiv_borodavka: 'ua_marriage_certificate',
    marriage_apostille_vasylsiuk: 'ua_marriage_certificate',
  }
  const normalized = aliases[raw] ?? raw
  return { docTypeId: normalized, aliasUsed: normalized === raw ? null : `${raw}→${normalized}` }
}

const file = getArg('file') ?? process.env.ONE_BRAIN_FILE
const docTypeInput = getArg('doc-type') ?? process.env.ONE_BRAIN_DOC_TYPE
const jsonOutput = (getArg('json') ?? process.env.ONE_BRAIN_JSON ?? '') === '1'
const providerName = (getArg('provider') ?? process.env.ONE_BRAIN_PROVIDER ?? 'gemini').toLowerCase()
const model = getArg('model') ?? process.env.ONE_BRAIN_MODEL ?? undefined

if (!file || !docTypeInput) {
  console.error('Usage: tsx scripts/one-brain-orient-read.mts --file <image> --doc-type <docTypeId> [--provider gemini|openai] [--model <model>] [--json 1]')
  process.exit(1)
}

const { preprocessImage } = await import(path.join(ROOT, 'apps/web/src/lib/ocr/image-preprocess.ts'))
const { OpenAIVisionProvider } = await import(path.join(ROOT, 'apps/web/src/lib/docintel/providers/openaiVisionProvider.ts'))
const { orientAndReadDocument, formatOneBrainReadResult } = await import(path.join(ROOT, 'apps/web/src/lib/docintel/oneBrainTool.ts'))

const raw = await readFile(file)
const mimeType = path.extname(file).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg'
const pre = await preprocessImage(raw, mimeType)
const imageBuffer = pre.ok ? pre.buffer : raw
const finalMime = pre.ok ? pre.mimeType : mimeType
const { docTypeId, aliasUsed } = normalizeDocTypeId(docTypeInput)
const provider = providerName === 'openai'
  ? new OpenAIVisionProvider(model ? { model } : {})
  : undefined

if (aliasUsed) {
  console.info(`[doc_type_alias] ${aliasUsed}`)
}
if (providerName === 'openai' && !process.env.HANDWRITING_CROP_LLM) {
  process.env.HANDWRITING_CROP_LLM = 'openai'
}

const result = await orientAndReadDocument(imageBuffer, finalMime, docTypeId, {
  provider,
  product: 'translation',
  originalBuffer: raw,
})

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log(formatOneBrainReadResult(result))
}
