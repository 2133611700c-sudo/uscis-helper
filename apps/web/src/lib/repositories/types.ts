/**
 * Repository abstraction for the birth-certificate vertical (Supabase-independent).
 *
 * Domain/runtime code depends on THESE interfaces — never on a Supabase client.
 * Two implementations satisfy them:
 *   - InMemory* (this layer) — for local dev, tests, and the mocked browser E2E;
 *   - a future Supabase adapter (separate file, NOT wired by default) — see
 *     docs/architecture/SUPABASE_CONNECTION_PLAN.md.
 *
 * No Supabase types leak here. All fields are domain-level + PII lives only in the
 * values the caller passes (never logged by this layer).
 */

export type ReviewStateValue =
  | 'candidate' | 'confirmed' | 'missing' | 'unreadable' | 'not_applicable' | 'conflict'

export interface SessionRecord {
  sessionId: string
  docType: string
  status: string
  scopeTitle?: string | null
  paymentConfirmed?: boolean
  uploadedPages?: number | null
  createdAt: string
  updatedAt: string
}

export interface FieldRecord {
  sessionId: string
  field: string
  /** raw (original script, e.g. Cyrillic) — IMMUTABLE once set. */
  rawValue: string | null
  /** normalized/translated value (mutable via correction). */
  normalizedValue: string | null
  /** confirmed (human-verified) value; null until confirmed. */
  confirmedValue?: string | null
  reviewRequired: boolean
  confirmed: boolean
  confirmedAt?: string | null
  // ── optional DB-projection columns (carried through for the review UI) ──
  id?: string | null
  sourceLabel?: string | null
  sourceZone?: string | null
  languageLayer?: string | null
  confidence?: number | null
  evidenceType?: string | null
  bboxStatus?: string | null
  createdAt?: string | null
}

/** An uploaded source document (one row per upload). */
export interface DocumentRecord {
  id: string
  sessionId: string
  storageKey: string
  originalName: string | null
  mimeType: string | null
  fileSizeBytes: number | null
  createdAt: string
}

export interface PdfArtifactRecord {
  sessionId: string
  kind: 'mirror' | 'generic'
  sha256: string
  byteLength: number
  createdAt: string
}

export interface AuditEventRecord {
  sessionId: string
  eventType: string
  at: string
  /** PII-free detail only (field keys / states / categories). */
  detail?: Record<string, string | number | boolean | null>
}

// ── repository interfaces ──────────────────────────────────────────────────────

export interface DocumentRepository {
  getSession(sessionId: string): Promise<SessionRecord | null>
  createSession(rec: SessionRecord): Promise<void>
  updateSessionStatus(sessionId: string, status: string, at: string): Promise<void>
  /** Mark a session extracted: status='extracted' + docType. */
  markExtracted(sessionId: string, docType: string, at: string): Promise<void>
  /** Most-recently-uploaded source document for a session; null if none. */
  getLatestDocument(sessionId: string): Promise<DocumentRecord | null>
}

export interface ReviewRepository {
  listFields(sessionId: string): Promise<FieldRecord[]>
  upsertFields(sessionId: string, fields: FieldRecord[]): Promise<void>
  getField(sessionId: string, field: string): Promise<FieldRecord | null>
}

export interface ConfirmationRepository {
  /** Mark a field confirmed (raw preserved). Returns the updated record. */
  confirmField(sessionId: string, field: string, at: string): Promise<FieldRecord | null>
  /** Apply a user correction: updates normalized+confirmed, NEVER touches raw. */
  correctField(sessionId: string, field: string, newValue: string, at: string): Promise<FieldRecord | null>
  /** Append a versioned user-correction audit record (append-only). Returns id+version. */
  recordUserCorrection(sessionId: string, field: string, oldValue: string, newValue: string, reason: string, at: string): Promise<{ id: string | null; version: number }>
}

export interface TranslationRepository {
  saveTranslatedValue(sessionId: string, field: string, translated: string): Promise<void>
  getTranslatedValues(sessionId: string): Promise<Record<string, string>>
}

export interface PdfArtifactRepository {
  saveArtifact(rec: PdfArtifactRecord): Promise<void>
  getArtifact(sessionId: string): Promise<PdfArtifactRecord | null>
}

export interface AuditEventRepository {
  append(rec: AuditEventRecord): Promise<void>
  list(sessionId: string): Promise<AuditEventRecord[]>
}

export interface ManualReviewTicket {
  sessionId: string
  status: string
  priority: string | null
  createdAt: string
  updatedAt: string
}

/** A manual-review queue case (keyed by its own id, NOT a session id). */
export interface ManualReviewCase {
  id: string
  fileUrl: string | null
}

export interface ManualReviewRepository {
  /** Most recent ticket for a session (open first, else latest terminal); null if none. */
  getLatestTicket(sessionId: string): Promise<ManualReviewTicket | null>
  /** Fetch a queue case by its own id (for GDPR delete); null if already gone. */
  getCase(caseId: string): Promise<ManualReviewCase | null>
  /** Delete a queue case by id. Idempotent (already-gone is a no-op). */
  deleteCase(caseId: string): Promise<void>
}

/**
 * Object-storage abstraction (buckets + keys). Persistence-only; the caller owns
 * bucket names. No Supabase Storage types leak here.
 */
export interface StorageRepository {
  /** Remove objects from a bucket. Idempotent (missing keys ignored). */
  remove(bucket: string, keys: string[]): Promise<void>
  /** Time-limited signed read URL for an object; null if it cannot be produced. */
  createSignedUrl(bucket: string, key: string, expirySeconds: number): Promise<string | null>
}

/**
 * A signer's certification record (8 CFR §103.2(b)(3)). PII is present BY DESIGN
 * (the signer's own work product) and is never logged by this layer.
 */
export interface CertificationRecordRow {
  sessionId: string
  signerFullName: string
  signerAddress: string | null
  signerPhone: string | null
  signerEmail: string | null
  sourceLanguage: string
  targetLanguage: string
  languagePairConfirmed: boolean
  statement: string
  signatureTypedName: string
  certificationVersion: string
  signedAt: string
}

export interface CertificationRepository {
  /** Upsert the certification record for a session (one record per session). */
  saveCertificationRecord(rec: CertificationRecordRow): Promise<void>
  getCertificationRecord(sessionId: string): Promise<CertificationRecordRow | null>
}

export interface ExtractionRun {
  id: string
  sessionId: string
  status: string
  provider?: string | null
  confidence?: number | null
  warnings?: string[] | null
  imageQuality?: unknown
  retakeCount?: number | null
  errorMessage?: string | null
  startedAt?: string | null
  completedAt?: string | null
  createdAt?: string | null
}

export interface ExtractionRunRepository {
  getRun(sessionId: string, runId: string): Promise<ExtractionRun | null>
  countFields(sessionId: string): Promise<number>
}

export interface RepositoryBundle {
  documents: DocumentRepository
  review: ReviewRepository
  confirmation: ConfirmationRepository
  translation: TranslationRepository
  pdfArtifacts: PdfArtifactRepository
  audit: AuditEventRepository
  manualReview: ManualReviewRepository
  extractionRuns: ExtractionRunRepository
  storage: StorageRepository
  certification: CertificationRepository
}

/** Thrown by the Supabase adapter stub until the owner wires + approves it. */
export class SupabaseNotConnectedError extends Error {
  constructor(method: string) {
    super(`Supabase repository not connected (${method}). See docs/architecture/SUPABASE_CONNECTION_PLAN.md — DO NOT RUN WITHOUT OWNER APPROVAL.`)
    this.name = 'SupabaseNotConnectedError'
  }
}
