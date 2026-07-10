/**
 * detectDocumentType.ts — ONE BRAIN node: image-based document-TYPE auto-detection.
 *
 * THE GAP THIS CLOSES (owner 2026-07-08): the project had NO image-based doc-type detection — a
 * human had to declare the type (wizard selection); `/api/translation/classify` only ROUTES a
 * DECLARED type. This is the missing One Brain node #4 (intake → orient → DETECT-TYPE → read).
 *
 * DESIGN PRINCIPLE (grounded in this session's measured evidence): document type is identified by
 * the PRINTED header/structure ("СВІДОЦТВО ПРО НАРОДЖЕННЯ", "ПАСПОРТ", "I-94"…), and the vision
 * model reads PRINTED Cyrillic/Latin perfectly and stably (proven, unlike handwriting). So type
 * detection is a RELIABLE printed-text task — the right thing to automate. It never depends on
 * reading handwriting.
 *
 * HONESTY / FAIL-CLOSED: returns a confidence and, below a threshold or on any doubt, resolves to
 * `unknown` so the caller asks the human to confirm — the brain NEVER silently proceeds on a
 * guessed wrong type. Own architecture is core: the candidate set is the docintel registry
 * (single source of truth); the model only picks among known ids by their printed identity.
 */
import { DOCUMENT_TYPES } from './documentRegistry'

export interface DocTypeDetection {
  doc_type_id: string | 'unknown'
  confidence: number // 0..1
  printed_title_seen: string | null // the header text the model reports reading (evidence)
  candidates: Array<{ doc_type_id: string; confidence: number }>
  measured: boolean // false ⇒ provider unavailable / parse failure ⇒ unknown, fail-closed
}

/**
 * Printed-identity signatures for the known types. This is the ONE place the "what does each
 * type's printed header look like" knowledge lives — kept next to the registry ids it classifies
 * into so a new registry type forces a signature here (or it can never be auto-detected).
 * These describe the PRINTED identity only (never handwriting).
 */
export const DOC_TYPE_SIGNATURES: Record<string, string> = {
  ua_internal_passport_booklet: 'Ukrainian internal passport booklet — printed "ПАСПОРТ", Soviet/UA passport book identity page (often handwritten entries).',
  ua_international_passport: 'Ukrainian international passport — printed "ПАСПОРТ / PASSPORT", "УКРАЇНА / UKRAINE", a photo and a 2-line MRZ at the bottom.',
  ua_birth_certificate: 'Ukrainian birth certificate (modern) — printed header "СВІДОЦТВО ПРО НАРОДЖЕННЯ".',
  ua_birth_certificate_soviet: 'Soviet-era birth certificate — bilingual printed header "СВИДЕТЕЛЬСТВО О РОЖДЕНИИ / СВІДОЦТВО ПРО НАРОДЖЕННЯ", hand-filled entries.',
  ua_marriage_certificate: 'Ukrainian marriage certificate — printed header "СВІДОЦТВО ПРО ШЛЮБ" or "СВИДЕТЕЛЬСТВО О БРАКЕ".',
  ua_divorce_certificate: 'Ukrainian divorce certificate — printed header "СВІДОЦТВО ПРО РОЗІРВАННЯ ШЛЮБУ".',
  ua_death_certificate: 'Ukrainian death certificate — printed header "СВІДОЦТВО ПРО СМЕРТЬ".',
  ua_name_change_certificate: 'Ukrainian name-change certificate — printed header "СВІДОЦТВО ПРО ЗМІНУ ІМЕНІ".',
  ua_id_card: 'Ukrainian ID card — plastic ID-1 card, printed "УКРАЇНА / UKRAINE", photo, "ID".',
  ua_military_id: 'Ukrainian military ID — printed "ВІЙСЬКОВИЙ КВИТОК" military booklet identity page.',
  us_ead: 'US Employment Authorization Document (I-766) — plastic card printed "EMPLOYMENT AUTHORIZATION", "USCIS", category code.',
  us_i94: 'US Form I-94 Arrival/Departure Record — printed "I-94", "Admission (I-94) Number", "Department of Homeland Security".',
  us_i797: 'US Form I-797 Notice of Action — printed "I-797", "NOTICE OF ACTION", "U.S. Citizenship and Immigration Services".',
}

/** Below this, the detection is not trustworthy → resolve to `unknown` (ask the human). */
export const DOC_TYPE_MIN_CONFIDENCE = 0.65

export function docTypeDetectEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.DOC_TYPE_DETECT_ENABLED === '1'
}

/** The candidate list handed to the model — registry ids that have a signature, PII-free. */
export function knownTypeCatalog(): Array<{ id: string; signature: string }> {
  return Object.keys(DOCUMENT_TYPES)
    .filter((id) => DOC_TYPE_SIGNATURES[id])
    .map((id) => ({ id, signature: DOC_TYPE_SIGNATURES[id] }))
}

export function buildDocTypePrompt(): string {
  const list = knownTypeCatalog()
    .map((c, i) => `${i + 1}. ${c.id} — ${c.signature}`)
    .join('\n')
  return (
    'You are a document-TYPE classifier. Look ONLY at the PRINTED text, headers, layout and ' +
    'structure of this document image (ignore any handwritten fill-in values). Decide which ONE ' +
    'of the known types below it is, by its printed identity.\n\n' +
    `KNOWN TYPES:\n${list}\n\n` +
    'Return a STRICT JSON object: {"doc_type_id": "<one id from the list, or \'unknown\'>", ' +
    '"confidence": <0..1>, "printed_title_seen": "<the exact printed header/title text you read, ' +
    'or null>", "candidates": [{"doc_type_id":"<id>","confidence":<0..1>} ...top 3]}. ' +
    'If the printed header does not clearly match any known type, return doc_type_id "unknown" ' +
    'with your best candidates. Do NOT guess from handwriting. Base the decision on the printed ' +
    'header/structure only.'
  )
}

/**
 * Classify a document image into a known registry type by its printed identity.
 * `visionCall` is injected (the caller supplies the actual OpenAI/Gemini call) so this module has
 * no provider/key coupling and is unit-testable with a mock. Returns fail-closed `unknown` on any
 * provider failure or unparseable output — never a fabricated type.
 */
export async function classifyDocumentType(
  imageBuffer: Buffer,
  visionCall: (prompt: string, image: Buffer) => Promise<string | null>,
  opts: { minConfidence?: number } = {},
): Promise<DocTypeDetection> {
  const min = opts.minConfidence ?? DOC_TYPE_MIN_CONFIDENCE
  const fail: DocTypeDetection = { doc_type_id: 'unknown', confidence: 0, printed_title_seen: null, candidates: [], measured: false }
  let raw: string | null
  try {
    raw = await visionCall(buildDocTypePrompt(), imageBuffer)
  } catch {
    return fail
  }
  if (!raw) return fail
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '').trim())
  } catch {
    return fail
  }
  return normalizeDetection(parsed, min)
}

/** Pure normalizer: validate the model's JSON, enforce the known-id set + fail-closed threshold. */
export function normalizeDetection(parsed: unknown, minConfidence: number): DocTypeDetection {
  const known = new Set(Object.keys(DOC_TYPE_SIGNATURES))
  const p = (parsed ?? {}) as Record<string, unknown>
  const rawId = typeof p.doc_type_id === 'string' ? p.doc_type_id : 'unknown'
  const conf = typeof p.confidence === 'number' && p.confidence >= 0 && p.confidence <= 1 ? p.confidence : 0
  const title = typeof p.printed_title_seen === 'string' ? p.printed_title_seen : null
  const candidates = Array.isArray(p.candidates)
    ? p.candidates
        .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
        .map((c) => ({
          doc_type_id: typeof c.doc_type_id === 'string' ? c.doc_type_id : 'unknown',
          confidence: typeof c.confidence === 'number' ? c.confidence : 0,
        }))
        .filter((c) => known.has(c.doc_type_id))
        .slice(0, 3)
    : []
  // FAIL-CLOSED: unknown id, not in the registry, or below threshold ⇒ 'unknown' (ask the human).
  const trusted = known.has(rawId) && conf >= minConfidence
  return {
    doc_type_id: trusted ? rawId : 'unknown',
    confidence: conf,
    printed_title_seen: title,
    candidates,
    measured: true,
  }
}
