/**
 * engine/htr.ts — D1 HTR reader: Transkribus.
 *
 * ⚠ ACCURACY STATUS (corrected 2026-05-29): NOT runtime-verified. NO transcript
 * has ever been produced by this code. Any prior "reads printed / garbage on
 * handwriting" claim was an OVERCLAIM — there is no test behind it. Evidence:
 *   - The owner's Transkribus account is Google-OAuth federated (NO password),
 *     so the `grant_type=password` (client_id=processing-api-client) flow that
 *     the metagrapho/Processing API needs cannot mint a token for us.
 *   - The browser ("webui") token we captured has audience [TrpServer], NOT the
 *     processing audience → the metagrapho Processing API returns 401.
 *   - The legacy TrpServer PyLaia trigger returned HTTP 500 (ClassCastException
 *     on DocumentSelectionDescriptor — wrong body shape). See /tmp/run.txt.
 *
 * CORRECT API (authoritative, from a working reference client + metagrapho docs):
 *   POST {BASE}/processes  body {config:{textRecognition:{htrId},lineDetection:{modelId}}, image:{base64}}
 *   → {processId}; GET {BASE}/processes/{id} → {status}; GET .../page → PAGE XML.
 *   BASE = https://transkribus.eu/processing/v1 (v2 same shape). Bearer token.
 *   This is base64-inline — NO upload/ingest dance. The legacy TrpServer path
 *   below is retained only for reference; the metagrapho path is the live one.
 *
 * To get REAL numbers: owner sets a readcoop password (Google-federated accounts
 * can add one) + has metagrapho credits → run apps/web/scripts/transkribus-bench.mjs.
 *
 * The line→field mapper (`mapLinesToFields`) is deterministic and unit-tested.
 */

import type { FieldRead, ModelReader, NamedReader } from './consensus'
import type { DocTypeSpec } from './docTypes'

const TOKEN_URL = 'https://account.readcoop.eu/auth/realms/readcoop/protocol/openid-connect/token'
const TRP = 'https://transkribus.eu/TrpServer/rest'

// ── line → field mapper (deterministic, tested) ──────────────────────────────

function norm(s: string): string {
  return (s ?? '').toLocaleLowerCase('uk').replace(/[«»"'`]/g, '').replace(/\s+/g, ' ').trim()
}
function valueAfterLabel(line: string, labels: string[]): string | null {
  const l = norm(line)
  for (const lab of labels) {
    const nl = norm(lab)
    const idx = l.indexOf(nl)
    if (idx >= 0) return line.slice(line.toLocaleLowerCase('uk').indexOf(nl) + nl.length).replace(/^[\s:.\-–—)]+/, '').trim()
  }
  return null
}
export function mapLinesToFields(lines: string[], spec: DocTypeSpec): Record<string, FieldRead> {
  const clean = lines.map((x) => x.trim()).filter(Boolean)
  const out: Record<string, FieldRead> = {}
  const used = new Set<number>()
  for (const f of spec.fields) {
    let value: string | null = null
    for (let i = 0; i < clean.length; i++) {
      if (used.has(i)) continue
      const after = valueAfterLabel(clean[i], f.label_uk)
      if (after === null) continue
      if (after) { value = after; used.add(i); break }
      for (let j = i + 1; j < clean.length; j++) { if (used.has(j)) continue; value = clean[j]; used.add(j); break }
      used.add(i); break
    }
    out[f.key] = value ? { cyrillic: value, can_read: true, confidence: 0.7 } : { cyrillic: '', can_read: false, confidence: 0 }
  }
  return out
}

// ── Transkribus TrpServer + PyLaia (VERIFIED working flow) ───────────────────

/** Password-grant token (client_id=processing-api-client). Short TTL → re-mint. */
export async function transkribusToken(username: string, password: string): Promise<string> {
  const body = new URLSearchParams({ grant_type: 'password', client_id: 'processing-api-client', username, password })
  const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body })
  if (!res.ok) throw new Error(`transkribus auth ${res.status}`)
  const j = await res.json()
  if (!j.access_token) throw new Error('transkribus: no access_token')
  return j.access_token
}

const auth = (t: string) => ({ authorization: `Bearer ${t}` })
const xmlVal = (xml: string, tag: string) => xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`))?.[1] ?? null

async function pollJob(token: string, jobId: string, deadlineMs: number, pollMs = 6000): Promise<string> {
  while (Date.now() < deadlineMs) {
    const r = await fetch(`${TRP}/jobs/${jobId}`, { headers: auth(token) })
    const j = await r.json().catch(() => ({} as any))
    const st = String(j.state ?? '').toUpperCase()
    if (st === 'FINISHED') return st
    if (st === 'FAILED' || st === 'CANCELED') throw new Error(`transkribus job ${st}`)
    await new Promise((r) => setTimeout(r, pollMs))
  }
  throw new Error('transkribus job timeout')
}

/**
 * Upload one image, run PyLaia recognition (with line detection) using
 * `modelId`, return the recognized text lines. `reauth()` returns a fresh token
 * (the processing token TTL is short — pass a minting closure for long jobs).
 */
export async function transkribusTranscribe(
  image: Buffer,
  opts: { colId: number; modelId: number; reauth: () => Promise<string>; title?: string; timeoutMs?: number },
): Promise<{ lines: string[] }> {
  const title = opts.title ?? `htr_${opts.modelId}_${image.length}`
  const deadline = Date.now() + (opts.timeoutMs ?? 180000)
  let token = await opts.reauth()

  // 1. init upload
  const up = await fetch(`${TRP}/uploads?collId=${opts.colId}`, {
    method: 'POST', headers: { ...auth(token), 'content-type': 'application/json' },
    body: JSON.stringify({ md: { title }, pageList: { pages: [{ fileName: 'p.jpg', pageNr: 1 }] } }),
  })
  const uploadId = xmlVal(await up.text(), 'uploadId')
  if (!uploadId) throw new Error('transkribus: no uploadId')

  // 2. PUT image bytes
  const fd = new FormData()
  fd.append('img', new Blob([new Uint8Array(image)], { type: 'image/jpeg' }), 'p.jpg')
  await fetch(`${TRP}/uploads/${uploadId}`, { method: 'PUT', headers: auth(token), body: fd as any })

  // 3. ingest creates the document → find its docId
  await new Promise((r) => setTimeout(r, 7000))
  token = await opts.reauth()
  const list = await (await fetch(`${TRP}/collections/${opts.colId}/list`, { headers: auth(token) })).json()
  const doc = (list as any[]).find((d) => d.title === title)
  if (!doc) throw new Error('transkribus: document not created')
  const docId = doc.docId

  // 4. pageId
  const fdoc = await (await fetch(`${TRP}/collections/${opts.colId}/${docId}/fulldoc`, { headers: auth(token) })).json()
  const pageId = fdoc.pageList.pages[0].pageId

  // 5. PyLaia recognition + line detection (VERIFIED endpoint + body shape)
  const job = await (await fetch(`${TRP}/pylaia/${opts.colId}/${opts.modelId}/recognition?doLineDetection=true`, {
    method: 'POST', headers: { ...auth(token), 'content-type': 'application/json' },
    body: JSON.stringify({ docId, pageList: { pages: [{ pageId, pageNr: 1 }] } }),
  })).text()
  const jobId = job.trim()
  if (!/^\d+$/.test(jobId)) throw new Error(`transkribus recognition not started: ${jobId.slice(0, 120)}`)

  // 6. poll (re-mint token each check — short TTL)
  while (Date.now() < deadline) {
    const t = await opts.reauth()
    const st = String((await (await fetch(`${TRP}/jobs/${jobId}`, { headers: auth(t) })).json().catch(() => ({}))).state ?? '').toUpperCase()
    if (st === 'FINISHED') break
    if (st === 'FAILED' || st === 'CANCELED') throw new Error(`transkribus recognition ${st}`)
    await new Promise((r) => setTimeout(r, 8000))
  }

  // 7. read transcript PAGE XML
  token = await opts.reauth()
  const fdoc2 = await (await fetch(`${TRP}/collections/${opts.colId}/${docId}/fulldoc`, { headers: auth(token) })).json()
  const tsUrl = fdoc2.pageList.pages[0]?.tsList?.transcripts?.[0]?.url
  if (!tsUrl) return { lines: [] }
  const xml = await (await fetch(tsUrl, { headers: auth(token) })).text()
  const lines = Array.from(xml.matchAll(/<Unicode>([\s\S]*?)<\/Unicode>/g))
    .map((m) => m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim())
    .filter(Boolean)
  return { lines }
}

/** Wrap Transkribus (legacy TrpServer) as a consensus voter. UNVERIFIED — see header. */
export function transkribusReader(opts: { colId: number; modelId: number; reauth: () => Promise<string>; spec: DocTypeSpec }): NamedReader {
  const read: ModelReader = async (image) => {
    const { lines } = await transkribusTranscribe(image, { colId: opts.colId, modelId: opts.modelId, reauth: opts.reauth })
    return mapLinesToFields(lines, opts.spec)
  }
  return { name: `transkribus:${opts.modelId}`, read }
}

// ── metagrapho / Processing API (base64-inline, the CORRECT path) ────────────

const META_BASE = 'https://transkribus.eu/processing/v1'

/**
 * Run one image through the metagrapho Processing API with a given HTR model and
 * return the recognized text lines (from PAGE XML). Single base64 POST + poll —
 * no TrpServer upload/ingest. `token` must carry the processing audience (minted
 * by client_id=processing-api-client; a webui/TrpServer token will 401 here).
 */
export async function metagraphoTranscribe(
  image: Buffer,
  opts: { htrId: number; lineDetectionId?: number; token: string; mime?: string; timeoutMs?: number; pollMs?: number },
): Promise<{ lines: string[]; processId: number }> {
  const deadline = Date.now() + (opts.timeoutMs ?? 180000)
  const headers = { authorization: `Bearer ${opts.token}`, 'content-type': 'application/json' }
  const config: Record<string, any> = { textRecognition: { htrId: opts.htrId } }
  if (opts.lineDetectionId) config.lineDetection = { modelId: opts.lineDetectionId }

  const start = await fetch(`${META_BASE}/processes`, {
    method: 'POST', headers,
    body: JSON.stringify({ config, image: { base64: image.toString('base64') } }),
  })
  if (!start.ok) throw new Error(`metagrapho ${start.status}${start.status === 401 ? ' WRONG_AUDIENCE_OR_EXPIRED' : ''}: ${(await start.text().catch(() => '')).slice(0, 200)}`)
  const processId = (await start.json())?.processId
  if (!processId) throw new Error('metagrapho: no processId')

  while (Date.now() < deadline) {
    const s = await (await fetch(`${META_BASE}/processes/${processId}`, { headers: { authorization: headers.authorization } })).json().catch(() => ({}))
    const st = String(s?.status ?? '').toUpperCase()
    if (st === 'FINISHED' || st === 'COMPLETED') break
    if (st === 'FAILED' || st === 'ERROR') throw new Error(`metagrapho process ${st}`)
    await new Promise((r) => setTimeout(r, opts.pollMs ?? 5000))
  }

  const xml = await (await fetch(`${META_BASE}/processes/${processId}/page`, { headers: { authorization: headers.authorization } })).text()
  const lines = Array.from(xml.matchAll(/<Unicode>([\s\S]*?)<\/Unicode>/g))
    .map((m) => m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim())
    .filter(Boolean)
  return { lines, processId }
}

/** Wrap the metagrapho Processing API as a consensus voter. */
export function metagraphoReader(opts: { htrId: number; lineDetectionId?: number; token: string; spec: DocTypeSpec }): NamedReader {
  const read: ModelReader = async (image) => {
    const { lines } = await metagraphoTranscribe(image, { htrId: opts.htrId, lineDetectionId: opts.lineDetectionId, token: opts.token })
    return mapLinesToFields(lines, opts.spec)
  }
  return { name: `metagrapho:${opts.htrId}`, read }
}
