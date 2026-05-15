/**
 * GET /api/tps/health
 *
 * Public TPS service-readiness probe. Returns the deploy SHA, the pinned
 * USCIS form editions + page counts + SHA256 (so external monitors can
 * detect form drift), and a boolean for whether the OCR provider is
 * configured in this environment.
 *
 * NO PII. NO database query. NO third-party call. Designed to be pinged
 * from uptime monitors at high frequency without cost.
 *
 * Note: a SEPARATE token-gated /api/health endpoint exists for full ops
 * health (DB / storage / env keys). This one is intentionally public —
 * it tells the world only what we have already disclosed on the landing
 * page (which USCIS editions we use). No surface for an attacker.
 */

import { NextResponse } from 'next/server'
import { PINNED_HASHES } from '@/lib/tps/formIntegrity'
import { SNAPSHOT_DATE } from '@/lib/tps/filingGuidance'
import { TPS_FORMS } from '@/lib/services/tps/config'

// Pulled from the single source at lib/services/tps/config.ts. The only
// constant local to this module is I-131 — it belongs to the Re-Parole
// service which has its own future config module.
const FORM_META = {
  i821: { edition: TPS_FORMS.i821.edition, pages: TPS_FORMS.i821.pages, filled: TPS_FORMS.i821.filled },
  i765: { edition: TPS_FORMS.i765.edition, pages: TPS_FORMS.i765.pages, filled: TPS_FORMS.i765.filled },
  i131: { edition: '01/20/25', pages: 14, filled: true },
  i912: { edition: TPS_FORMS.i912.edition, pages: TPS_FORMS.i912.pages, filled: TPS_FORMS.i912.filled },
} as const

const BUILD_TIME = new Date().toISOString()

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_BUILD_SHA ||
    'unknown'

  const ocrConfigured = Boolean(
    process.env.GOOGLE_CLOUD_VISION_API_KEY ||
      process.env.GOOGLE_VISION_API_KEY ||
      process.env.GOOGLE_CLOUD_VISION ||
      process.env.GOOGLE_VISION,
  )

  return NextResponse.json(
    {
      ok: true,
      service: 'messenginfo-uscis-helper',
      sha,
      build_time: BUILD_TIME,
      forms: {
        i821: {
          edition: FORM_META.i821.edition,
          pages: FORM_META.i821.pages,
          sha256: PINNED_HASHES['i-821.pdf'],
          filled: FORM_META.i821.filled,
        },
        i765: {
          edition: FORM_META.i765.edition,
          pages: FORM_META.i765.pages,
          sha256: PINNED_HASHES['i-765.pdf'],
          filled: FORM_META.i765.filled,
        },
        i131: {
          edition: FORM_META.i131.edition,
          pages: FORM_META.i131.pages,
          sha256: PINNED_HASHES['i-131.pdf'],
          filled: FORM_META.i131.filled,
        },
        i912: {
          edition: FORM_META.i912.edition,
          pages: FORM_META.i912.pages,
          sha256: PINNED_HASHES['i-912.pdf'],
          filled: FORM_META.i912.filled,
        },
      },
      snapshot_date: SNAPSHOT_DATE,
      ocr_provider: 'google_vision',
      ocr_configured: ocrConfigured,
    },
    {
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
