/**
 * GET /api/translation/[sessionId]/extraction-status/[runId]
 *
 * Polling endpoint for async OCR extraction jobs.
 * Returns the current state of an extraction_runs row.
 *
 * Response shapes by status:
 *
 *   queued / processing:
 *     { ok: true, status: 'queued'|'processing', extraction_run_id, session_id }
 *
 *   completed:
 *     { ok: true, status: 'completed', extraction_run_id, session_id,
 *       provider, confidence, warnings, fields_count,
 *       next_step: '/review URL' }
 *
 *   retake_required:
 *     { ok: true, status: 'retake_required', extraction_run_id, session_id,
 *       user_message, retake_count, max_retakes, image_quality }
 *
 *   manual_review_required | failed:
 *     { ok: true, status: 'manual_review_required'|'failed', extraction_run_id,
 *       session_id, user_message }
 *
 * The UI should poll every 3 seconds until status is terminal
 * (completed | retake_required | manual_review_required | failed).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getRepositories } from '@/lib/repositories'

export const dynamic = 'force-dynamic'

const TERMINAL_STATUSES = ['completed', 'retake_required', 'manual_review_required', 'failed']
const MAX_RETAKES = 2

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; runId: string }> }
) {
  const { sessionId, runId } = await params

  if (!sessionId || !runId) {
    return NextResponse.json(
      { ok: false, error: 'sessionId and runId required' },
      { status: 400 }
    )
  }

  const repos = getRepositories()

  // Verify session exists (prevents leaking run data across sessions)
  const session = await repos.documents.getSession(sessionId)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 })
  }

  // Load extraction run — must belong to this session
  const run = await repos.extractionRuns.getRun(sessionId, runId)
  if (!run) {
    return NextResponse.json(
      { ok: false, error: 'Extraction run not found' },
      { status: 404 }
    )
  }

  const isTerminal = TERMINAL_STATUSES.includes(run.status)

  // Base response fields
  const base = {
    ok: true,
    extraction_run_id: run.id,
    session_id: run.sessionId,
    status: run.status,
    is_terminal: isTerminal,
    started_at: run.startedAt ?? null,
    completed_at: run.completedAt ?? null,
    created_at: run.createdAt ?? null,
  }

  // Status-specific extras
  if (run.status === 'completed') {
    const fieldsCount = await repos.extractionRuns.countFields(sessionId)
    return NextResponse.json({
      ...base,
      provider: run.provider,
      confidence: run.confidence,
      warnings: run.warnings ?? [],
      fields_count: fieldsCount ?? 0,
      next_step: `/en/services/translate-document/session/${sessionId}/review`,
    })
  }

  if (run.status === 'retake_required') {
    return NextResponse.json({
      ...base,
      user_message: run.errorMessage ?? 'Please retake the photo for better results.',
      retake_count: run.retakeCount ?? 0,
      max_retakes: MAX_RETAKES,
      image_quality: run.imageQuality,
    })
  }

  if (run.status === 'manual_review_required' || run.status === 'failed') {
    return NextResponse.json({
      ...base,
      user_message:
        run.errorMessage ??
        'Automatic extraction could not read your document. Please re-upload a clearer photo.',
    })
  }

  // queued or processing — return minimal polling response
  return NextResponse.json(base)
}
