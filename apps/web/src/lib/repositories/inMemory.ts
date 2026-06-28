/**
 * In-memory implementation of the repository bundle — local dev, unit tests, and
 * the mocked browser E2E. No Supabase, no network, no persistence beyond process.
 * raw values are immutable once set (confirm/correct never overwrite raw).
 */
import type {
  RepositoryBundle, DocumentRepository, ReviewRepository, ConfirmationRepository,
  TranslationRepository, PdfArtifactRepository, AuditEventRepository,
  ManualReviewRepository, ManualReviewTicket, ManualReviewCase, StorageRepository,
  CertificationRepository, CertificationRecordRow,
  OrderRepository, OrderRecord,
  ExtractionRunRepository, ExtractionRun,
  SessionRecord, FieldRecord, DocumentRecord, PdfArtifactRecord, AuditEventRecord,
} from './types'

const key = (sessionId: string, field: string) => `${sessionId}::${field}`

class InMemoryDocuments implements DocumentRepository {
  constructor(private sessions: Map<string, SessionRecord>, private docs: Map<string, DocumentRecord[]>) {}
  async getSession(id: string) { return this.sessions.get(id) ?? null }
  async createSession(rec: SessionRecord) { this.sessions.set(rec.sessionId, { ...rec }) }
  async updateSessionStatus(id: string, status: string, at: string) {
    const s = this.sessions.get(id); if (s) this.sessions.set(id, { ...s, status, updatedAt: at })
  }
  async markExtracted(id: string, docType: string, at: string) {
    const s = this.sessions.get(id); if (s) this.sessions.set(id, { ...s, status: 'extracted', docType, updatedAt: at })
  }
  async getLatestDocument(sessionId: string) {
    const list = this.docs.get(sessionId) ?? []
    if (!list.length) return null
    // newest by createdAt (ISO compares lexically)
    return { ...[...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] }
  }
  async createDocument(input: {
    sessionId: string; storageKey: string; originalName: string | null
    mimeType: string | null; fileSizeBytes: number | null; createdAt: string
  }) {
    const list = this.docs.get(input.sessionId) ?? []
    const rec: DocumentRecord = { id: `doc-${input.sessionId}-${list.length + 1}`, ...input }
    list.push({ ...rec }); this.docs.set(input.sessionId, list)
    return { ...rec }
  }
  async markUploaded(id: string, uploadedPages: number, at: string) {
    const s = this.sessions.get(id); if (s) this.sessions.set(id, { ...s, status: 'uploaded', uploadedPages, updatedAt: at })
  }
  async getDocument(sessionId: string, documentId: string) {
    const list = this.docs.get(sessionId) ?? []
    const d = list.find((x) => x.id === documentId)
    return d ? { ...d } : null
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
  constructor(private tickets: Map<string, ManualReviewTicket[]>, private cases: Map<string, ManualReviewCase>) {}
  async getLatestTicket(sessionId: string) {
    const list = this.tickets.get(sessionId) ?? []
    if (!list.length) return null
    // most recent by createdAt (string ISO compares lexically)
    return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]
  }
  async getCase(caseId: string) { const c = this.cases.get(caseId); return c ? { ...c } : null }
  async deleteCase(caseId: string) { this.cases.delete(caseId) }
}

class InMemoryStorage implements StorageRepository {
  constructor(private files: Map<string, Map<string, Uint8Array>>) {}
  private bucketMap(bucket: string) {
    let m = this.files.get(bucket); if (!m) { m = new Map(); this.files.set(bucket, m) }
    return m
  }
  async remove(bucket: string, keys: string[]) {
    const m = this.files.get(bucket); if (!m) return
    for (const k of keys) m.delete(k)
  }
  async createSignedUrl(bucket: string, key: string, expirySeconds: number) {
    // deterministic, network-free stand-in for a Supabase signed URL
    return `memory://${bucket}/${key}?expires_in=${expirySeconds}`
  }
  async upload(bucket: string, key: string, bytes: Uint8Array, _contentType: string, opts?: { upsert?: boolean }) {
    const m = this.bucketMap(bucket)
    if (m.has(key) && !opts?.upsert) throw new Error(`storage object already exists: ${bucket}/${key}`)
    m.set(key, bytes)
  }
  async download(bucket: string, key: string) {
    return this.files.get(bucket)?.get(key) ?? null
  }
}

class InMemoryCertification implements CertificationRepository {
  constructor(private records: Map<string, CertificationRecordRow>) {}
  async saveCertificationRecord(rec: CertificationRecordRow) { this.records.set(rec.sessionId, { ...rec }) }
  async getCertificationRecord(sessionId: string) { const r = this.records.get(sessionId); return r ? { ...r } : null }
}

class InMemoryOrders implements OrderRepository {
  constructor(
    private orders: Map<string, OrderRecord>,
    private events: { orderId: string; eventType: string; metadata: Record<string, string | number | boolean | null> }[],
  ) {}
  async getOrder(orderId: string) { const o = this.orders.get(orderId); return o ? { ...o } : null }
  async updateOrder(orderId: string, updates: Partial<Omit<OrderRecord, 'orderId'>>, at: string) {
    const o = this.orders.get(orderId); if (!o) return null
    const updated: OrderRecord = { ...o, ...updates, updatedAt: at }
    this.orders.set(orderId, updated); return { ...updated }
  }
  async appendEvent(orderId: string, eventType: string, metadata: Record<string, string | number | boolean | null>) {
    this.events.push({ orderId, eventType, metadata: { ...metadata } })
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
  async createRun(input: { sessionId: string; documentId: string; status: string; startedAt: string; retakeCount: number }) {
    const n = [...this.runs.values()].filter((r) => r.sessionId === input.sessionId).length + 1
    const id = `run-${input.sessionId}-${n}`
    this.runs.set(id, {
      id, sessionId: input.sessionId, status: input.status,
      retakeCount: input.retakeCount, startedAt: input.startedAt, createdAt: input.startedAt,
    })
    return { id }
  }
  async updateRun(runId: string | null, patch: Record<string, unknown>) {
    if (!runId) return
    const r = this.runs.get(runId); if (!r) return
    this.runs.set(runId, { ...r, ...(patch as Partial<ExtractionRun>) })
  }
}

/** Build a fresh in-memory bundle (isolated state per call → deterministic tests). */
export function createInMemoryRepositories(): RepositoryBundle {
  const sessions = new Map<string, SessionRecord>()
  const docs = new Map<string, DocumentRecord[]>()
  const fields = new Map<string, FieldRecord>()
  const translated = new Map<string, string>()
  const artifacts = new Map<string, PdfArtifactRecord>()
  const events: AuditEventRecord[] = []
  const tickets = new Map<string, ManualReviewTicket[]>()
  const cases = new Map<string, ManualReviewCase>()
  const storageFiles = new Map<string, Map<string, Uint8Array>>()
  const certifications = new Map<string, CertificationRecordRow>()
  const orders = new Map<string, OrderRecord>()
  const orderEvents: { orderId: string; eventType: string; metadata: Record<string, string | number | boolean | null> }[] = []
  const runs = new Map<string, ExtractionRun>()
  const corrections = new Map<string, number>()
  return {
    documents: new InMemoryDocuments(sessions, docs),
    review: new InMemoryReview(fields),
    confirmation: new InMemoryConfirmation(fields, corrections),
    translation: new InMemoryTranslation(translated),
    pdfArtifacts: new InMemoryPdf(artifacts),
    audit: new InMemoryAudit(events),
    manualReview: new InMemoryManualReview(tickets, cases),
    extractionRuns: new InMemoryExtractionRuns(runs, fields),
    storage: new InMemoryStorage(storageFiles),
    certification: new InMemoryCertification(certifications),
    orders: new InMemoryOrders(orders, orderEvents),
  }
}

/** Seed a manual-review case + its storage object — test/dev helper for the in-memory bundle. */
export function __seedManualReviewCase(
  bundle: RepositoryBundle, caseId: string, bucket: string, fileUrl: string | null,
): void {
  const mr = bundle.manualReview as unknown as { cases: Map<string, ManualReviewCase> }
  const st = bundle.storage as unknown as { files: Map<string, Map<string, Uint8Array>> }
  mr.cases.set(caseId, { id: caseId, fileUrl })
  if (fileUrl) { const m = st.files.get(bucket) ?? new Map<string, Uint8Array>(); m.set(fileUrl, new Uint8Array()); st.files.set(bucket, m) }
}

/** Seed an uploaded source document — test/dev helper for the in-memory bundle. */
export function __seedDocument(bundle: RepositoryBundle, doc: DocumentRecord): void {
  const d = bundle.documents as unknown as { docs: Map<string, DocumentRecord[]> }
  const list = d.docs.get(doc.sessionId) ?? []
  list.push({ ...doc }); d.docs.set(doc.sessionId, list)
}

/** Seed a legacy v3 order — test/dev helper for the in-memory bundle. */
export function __seedOrder(bundle: RepositoryBundle, order: OrderRecord): void {
  const o = bundle.orders as unknown as { orders: Map<string, OrderRecord> }
  o.orders.set(order.orderId, { ...order })
}
