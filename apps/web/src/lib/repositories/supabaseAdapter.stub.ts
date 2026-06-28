/**
 * Supabase repository adapter — STUB ONLY (NOT wired, NOT connected).
 *
 * This file imports NO Supabase client. It exists to (a) prove the adapter SHAPE
 * conforms to the repository interfaces at compile time, and (b) fail loudly if
 * something tries to use a Supabase-backed repository before the owner wires it.
 *
 * To implement later: map each method to the tables/policies in
 * docs/architecture/SUPABASE_CONNECTION_PLAN.md. DO NOT RUN WITHOUT OWNER APPROVAL.
 */
import {
  type RepositoryBundle, type DocumentRepository, type ReviewRepository,
  type ConfirmationRepository, type TranslationRepository, type PdfArtifactRepository,
  type AuditEventRepository, type ManualReviewRepository, type ExtractionRunRepository,
  SupabaseNotConnectedError,
} from './types'

// async so the failure is a REJECTED promise (fail-closed), not a sync throw.
async function notConnected(m: string): Promise<never> { throw new SupabaseNotConnectedError(m) }

const documents: DocumentRepository = {
  getSession: () => notConnected('documents.getSession'),
  createSession: () => notConnected('documents.createSession'),
  updateSessionStatus: () => notConnected('documents.updateSessionStatus'),
  markExtracted: () => notConnected('documents.markExtracted'),
}
const review: ReviewRepository = {
  listFields: () => notConnected('review.listFields'),
  upsertFields: () => notConnected('review.upsertFields'),
  getField: () => notConnected('review.getField'),
}
const confirmation: ConfirmationRepository = {
  confirmField: () => notConnected('confirmation.confirmField'),
  correctField: () => notConnected('confirmation.correctField'),
}
const translation: TranslationRepository = {
  saveTranslatedValue: () => notConnected('translation.saveTranslatedValue'),
  getTranslatedValues: () => notConnected('translation.getTranslatedValues'),
}
const pdfArtifacts: PdfArtifactRepository = {
  saveArtifact: () => notConnected('pdfArtifacts.saveArtifact'),
  getArtifact: () => notConnected('pdfArtifacts.getArtifact'),
}
const audit: AuditEventRepository = {
  append: () => notConnected('audit.append'),
  list: () => notConnected('audit.list'),
}
const manualReview: ManualReviewRepository = {
  getLatestTicket: () => notConnected('manualReview.getLatestTicket'),
}
const extractionRuns: ExtractionRunRepository = {
  getRun: () => notConnected('extractionRuns.getRun'),
  countFields: () => notConnected('extractionRuns.countFields'),
}

/** A bundle whose every call throws SupabaseNotConnectedError (shape-conformant). */
export function createSupabaseRepositoriesStub(): RepositoryBundle {
  return { documents, review, confirmation, translation, pdfArtifacts, audit, manualReview, extractionRuns }
}
