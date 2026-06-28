/**
 * FULL birth-certificate vertical on IN-MEMORY infrastructure (no Supabase, no
 * Gemini, no network). Proves the DoD: the flow works end-to-end on mock infra —
 * session → mocked Gemini → boundary → split → normalize → persist → review states
 * → confirm/correct (raw preserved) → final-PDF gate (blocked→allowed) → artifact +
 * audit → reopen state. Fictional data only.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createInMemoryRepositories } from '../inMemory'
import type { FieldRecord, RepositoryBundle } from '../types'
import { sanitizeContractExtractionResponse } from '@/lib/contracts/contractExtractionBoundary'
import { applyContractSplitFlow, normalizeContractSplitFields } from '@/lib/contracts/contractFieldFlow'
import { annotateReviewFields, type AnnotatedReviewRow } from '@/lib/contracts/contractReviewState'
import { assertDocumentReadyForFinalPdf, type FinalPdfField } from '@/lib/contracts/finalPdfGate'

const SID = 'synthetic-vertical-1'
const AT = '2026-06-28T00:00:00Z'
const DOC = 'ua_birth_certificate'
const ENV = {
  UNIFIED_DOC_CONTRACT_ENABLED: '1', UNIFIED_DOC_CONTRACT_SPLIT_ENABLED: '1',
  UNIFIED_DOC_CONTRACT_NORMALIZE_ENABLED: '1', FINAL_PDF_CONFIRMATION_GATE_ENABLED: '1',
} as Record<string, string | undefined>

const MOCK_GEMINI = [
  { field: 'child_family_name', value: 'Soloviak', raw_cyrillic: "Солов'як", confirmed: true /* forged */ },
  { field: 'child_given_name', value: 'Andrii', raw_cyrillic: 'Андрій' },
  { field: 'child_patronymic', value: 'Bohdanovych', raw_cyrillic: 'Богданович' },
  { field: 'dob', value: '1990-01-15' },
  { field: 'certificate_series_number', value: 'II-BK 530174', raw_cyrillic: 'II-ВК 530174' },
  { field: 'issuing_authority', value: 'Lisove Registry Office, Vinnytsia Oblast', raw_cyrillic: 'Лісовий РАЦС, Вінницька область' },
  { field: 'act_record_number', value: '84' },
]

let repos: RepositoryBundle
beforeEach(() => { repos = createInMemoryRepositories() })

async function ingest(): Promise<void> {
  await repos.documents.createSession({ sessionId: SID, docType: DOC, status: 'reviewing', createdAt: AT, updatedAt: AT })
  await repos.audit.append({ sessionId: SID, eventType: 'extraction_started', at: AT })
  const sane = sanitizeContractExtractionResponse(MOCK_GEMINI, DOC)
  const fieldOut = sane.fields.map((f) => ({ field: f.field, value: f.value, raw_cyrillic: f.raw_cyrillic, confidence: 1, review_required: f.review_required, kind: 'text' as const }))
  const split = normalizeContractSplitFields(applyContractSplitFlow(fieldOut, DOC, ENV), ENV)
  const records: FieldRecord[] = split.map((f) => ({
    sessionId: SID, field: f.field, rawValue: f.raw_cyrillic ?? null, normalizedValue: f.value ?? null,
    reviewRequired: f.review_required ?? false, confirmed: false,
  }))
  await repos.review.upsertFields(SID, records)
  await repos.audit.append({ sessionId: SID, eventType: 'extraction_completed', at: AT })
}

async function pdfFields(): Promise<FinalPdfField[]> {
  return (await repos.review.listFields(SID)).map((f) => ({
    field: f.field, raw_value: f.rawValue, normalized_value: f.normalizedValue,
    review_required: f.reviewRequired, confirmed: f.confirmed,
  }))
}

describe('FULL vertical on in-memory infra', () => {
  it('ingest persists fields incl. split fields; forged confirmed stripped; raw Cyrillic kept', async () => {
    await ingest()
    const fields = await repos.review.listFields(SID)
    const keys = fields.map((f) => f.field)
    expect(keys).toContain('document_series')
    expect(keys).toContain('document_number')
    expect(fields.every((f) => f.confirmed === false)).toBe(true) // model could not confirm
    const surname = fields.find((f) => f.field === 'child_family_name')!
    expect(surname.rawValue).toBe("Солов'як")     // raw original script kept
    expect(surname.normalizedValue).toBe('Soloviak') // translated/normalized layer
  })

  it('review states computed; handwritten critical = candidate (pending)', async () => {
    await ingest()
    const rows: AnnotatedReviewRow[] = (await repos.review.listFields(SID)).map((f) => ({
      field: f.field, raw_value: f.rawValue, normalized_value: f.normalizedValue, review_required: f.reviewRequired, confirmed: f.confirmed,
    }))
    const annotated = annotateReviewFields(rows, ENV)
    expect(annotated.find((r) => r.field === 'child_family_name')!.contract_review_state).toBe('candidate')
  })

  it('PDF BLOCKED before confirmation; ALLOWED after confirming critical fields (raw preserved)', async () => {
    await ingest()
    const before = assertDocumentReadyForFinalPdf(await pdfFields(), DOC, ENV)
    expect(before.ready).toBe(false)
    await repos.audit.append({ sessionId: SID, eventType: 'final_pdf_blocked', at: AT, detail: { reasons: before.blockedReasons.join(',') } })

    // user confirms every critical field; one via correction
    await repos.confirmation.correctField(SID, 'child_family_name', 'Soloviak', AT)
    for (const f of await repos.review.listFields(SID)) {
      if (!f.confirmed && (f.normalizedValue ?? '').trim()) await repos.confirmation.confirmField(SID, f.field, AT)
    }
    // raw still preserved after confirm/correct
    expect((await repos.review.getField(SID, 'child_family_name'))?.rawValue).toBe("Солов'як")

    const after = assertDocumentReadyForFinalPdf(await pdfFields(), DOC, ENV)
    // any remaining critical field without a value still legitimately blocks; supply values
    if (!after.ready) {
      for (const f of await repos.review.listFields(SID)) {
        if (!(f.normalizedValue ?? '').trim()) await repos.confirmation.correctField(SID, f.field, 'N/A', AT)
      }
    }
    const final = assertDocumentReadyForFinalPdf(await pdfFields(), DOC, ENV)
    expect(final.ready).toBe(true)

    await repos.pdfArtifacts.saveArtifact({ sessionId: SID, kind: 'mirror', sha256: 'deadbeef', byteLength: 2509, createdAt: AT })
    await repos.documents.updateSessionStatus(SID, 'rendered', AT)
    await repos.audit.append({ sessionId: SID, eventType: 'final_pdf_generated', at: AT })
  })

  it('reopen: persisted confirmed state + artifact + PII-free audit survive', async () => {
    await ingest()
    await repos.confirmation.confirmField(SID, 'child_family_name', AT)
    await repos.pdfArtifacts.saveArtifact({ sessionId: SID, kind: 'mirror', sha256: 'abc', byteLength: 10, createdAt: AT })
    // "reopen" = read back from the same in-memory store
    expect((await repos.review.getField(SID, 'child_family_name'))?.confirmed).toBe(true)
    expect((await repos.pdfArtifacts.getArtifact(SID))?.sha256).toBe('abc')
    const events = await repos.audit.list(SID)
    expect(events.length).toBeGreaterThan(0)
    // audit detail carries no PII (only safe keys)
    for (const e of events) if (e.detail) for (const v of Object.values(e.detail)) expect(String(v)).not.toMatch(/Солов|530174|1990-01-15/)
  })
})
