/**
 * In-memory implementation of the repository bundle — local dev, unit tests, and
 * the mocked browser E2E. No Supabase, no network, no persistence beyond process.
 * raw values are immutable once set (confirm/correct never overwrite raw).
 */
import type {
  RepositoryBundle, DocumentRepository, ReviewRepository, ConfirmationRepository,
  TranslationRepository, PdfArtifactRepository, AuditEventRepository,
  ManualReviewRepository, ManualReviewTicket, ExtractionRunRepository, ExtractionRun,
  SessionRecord, FieldRecord, PdfArtifactRecord, AuditEventRecord,
} from './types'

const key = (sessionId: string, field: string) => `${sessionId}::${field}`

class InMemoryDocuments implements DocumentRepository {
  constructor(private sessions: Map<string, SessionRecord>) {}
  async getSession(id: string) { return this.sessions.get(id) ?? null }
  async createSession(rec: SessionRecord) { this.sessions.set(rec.sessionId, { ...rec }) }
  async updateSessionStatus(id: string, status: string, at: string) {
    const s = this.sessions.get(id); if (s) this.sessions.set(id, { ...s, status, updatedAt: at })
  }
  async markExtracted(id: string, docType: string, at: string) {
    const s = this.sessions.get(id); if (s) this.sessions.set(id, { ...s, status: 'extracted', docType, updatedAt: at })
  }
}

class InMemoryReview implements ReviewRepository {
  constructor(private fields: Map<string, FieldRecord>) {}
  async listFields(sessionId: string) {
    return [...this.fields.values()].filter((f) => f.sessionId === sessionId).map((f) => ({ ...f }))
  }
  async upsertFields(sessionId: string, fields: FieldRecord[]) {
    for (const f of fields) {
      const existing = this.fields.get(key(sessionId, f.field))
      // raw is immutable: keep the first-seen rawValue if already present.
      const rawValue = existing && existing.rawValue !== null ? existing.rawValue : f.rawValue
      this.fields.set(key(sessionId, f.field), { ...f, sessionId, rawValue })
    }
  }
  async getField(sessionId: string, field: string) { return this.fields.get(key(sessionId, field)) ?? null }
}

class InMemoryConfirmation implements ConfirmationRepository {
  constructor(private fields: Map<string, FieldRecord>, private corrections: Map<string, number>) {}
  async recordUserCorrection(sessionId: string, field: string, _old: string, _new: string, _reason: string, _at: string) {
    const k = key(sessionId, field)
    const version = (this.corrections.get(k) ?? 0) + 1
    this.corrections.set(k, version)
    return { id: `corr-${sessionId}-${field}-${version}`, version }
  }
  async confirmField(sessionId: string, field: string, at: string) {
    const f = this.fields.get(key(sessionId, field)); if (!f) return null
    const updated: FieldRecord = { ...f, confirmed: true, confirmedAt: at, reviewRequired: false, confirmedValue: f.normalizedValue ?? f.confirmedValue ?? null }
    this.fields.set(key(sessionId, field), updated); return { ...updated }
  }
  async correctField(sessionId: string, field: string, newValue: string, at: string) {
    const f = this.fields.get(key(sessionId, field)); if (!f) return null
    // raw NEVER changes; correction updates the normalized + confirmed layers.
    const updated: FieldRecord = { ...f, normalizedValue: newValue, confirmedValue: newValue, confirmed: true, confirmedAt: at, reviewRequired: false }
    this.fields.set(key(sessionId, field), updated); return { ...updated }
  }
}

class InMemoryTranslation implements TranslationRepository {
  constructor(private translated: Map<string, string>) {}
  async saveTranslatedValue(sessionId: string, field: string, value: string) { this.translated.set(key(sessionId, field), value) }
  async getTranslatedValues(sessionId: string) {
    const out: Record<string, string> = {}
    for (const [k, v] of this.translated) if (k.startsWith(`${sessionId}::`)) out[k.split('::')[1]] = v
    return out
  }
}

class InMemoryPdf implements PdfArtifactRepository {
  constructor(private artifacts: Map<string, PdfArtifactRecord>) {}
  async saveArtifact(rec: PdfArtifactRecord) { this.artifacts.set(rec.sessionId, { ...rec }) }
  async getArtifact(sessionId: string) { return this.artifacts.get(sessionId) ?? null }
}

class InMemoryAudit implements AuditEventRepository {
  constructor(private events: AuditEventRecord[]) {}
  async append(rec: AuditEventRecord) { this.events.push({ ...rec }) }
  async list(sessionId: string) { return this.events.filter((e) => e.sessionId === sessionId).map((e) => ({ ...e })) }
}

class InMemoryManualReview implements ManualReviewRepository {
  constructor(private tickets: Map<string, ManualReviewTicket[]>) {}
  async getLatestTicket(sessionId: string) {
    const list = this.tickets.get(sessionId) ?? []
    if (!list.length) return null
    // most recent by createdAt (string ISO compares lexically)
    return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]
  }
}

class InMemoryExtractionRuns implements ExtractionRunRepository {
  constructor(private runs: Map<string, ExtractionRun>, private fields: Map<string, FieldRecord>) {}
  async getRun(sessionId: string, runId: string) {
    const r = this.runs.get(runId)
    return r && r.sessionId === sessionId ? { ...r } : null
  }
  async countFields(sessionId: string) {
    return [...this.fields.values()].filter((f) => f.sessionId === sessionId).length
  }
}

/** Build a fresh in-memory bundle (isolated state per call → deterministic tests). */
export function createInMemoryRepositories(): RepositoryBundle {
  const sessions = new Map<string, SessionRecord>()
  const fields = new Map<string, FieldRecord>()
  const translated = new Map<string, string>()
  const artifacts = new Map<string, PdfArtifactRecord>()
  const events: AuditEventRecord[] = []
  const tickets = new Map<string, ManualReviewTicket[]>()
  const runs = new Map<string, ExtractionRun>()
  const corrections = new Map<string, number>()
  return {
    documents: new InMemoryDocuments(sessions),
    review: new InMemoryReview(fields),
    confirmation: new InMemoryConfirmation(fields, corrections),
    translation: new InMemoryTranslation(translated),
    pdfArtifacts: new InMemoryPdf(artifacts),
    audit: new InMemoryAudit(events),
    manualReview: new InMemoryManualReview(tickets),
    extractionRuns: new InMemoryExtractionRuns(runs, fields),
  }
}
