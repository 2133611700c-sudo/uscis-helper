/**
 * engine/htr.ts — D1 HTR reader: Transkribus.
 *
 * VERIFIED LIVE 2026-05-29 (see docs/reports + memory transkribus-integration-state):
 *   - The Metagrapho "Processing API" (transkribus.eu/processing/v1) rejects our
 *     tokens (401). The WORKING path is the TrpServer REST API + the PyLaia
 *     recognition endpoint, authenticated with a password-grant token
 *     (client_id=processing-api-client, aud=TrpServer).
 *   - Flow: token → POST /uploads → PUT image → poll ingest job → POST
 *     /pylaia/{colId}/{modelId}/recognition?doLineDetection=true (body {docId,pageList})
 *     → poll job → GET /collections/{colId}/{docId}/fulldoc → transcript URL → PAGE XML.
 *   - EMPIRICAL RESULT: reads PRINTED Ukrainian docs (real content, with noise →
 *     usable after D2 cleanup). Does NOT read faded handwritten Soviet docs
 *     (garbage/empty) — those need human transcription. No engine fabricates here.
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

/** Wrap Transkribus as a consensus voter (best for PRINTED docs). */
export function transkribusReader(opts: { colId: number; modelId: number; reauth: () => Promise<string>; spec: DocTypeSpec }): NamedReader {
  const read: ModelReader = async (image) => {
    const { lines } = await transkribusTranscribe(image, { colId: opts.colId, modelId: opts.modelId, reauth: opts.reauth })
    return mapLinesToFields(lines, opts.spec)
  }
  return { name: `transkribus:${opts.modelId}`, read }
}
