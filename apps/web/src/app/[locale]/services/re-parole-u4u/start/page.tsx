/**
 * /[locale]/services/re-parole-u4u/start
 *
 * Stage-8: Re-Parole U4U wizard entry point.
 *
 * REGULATORY COPY VERIFIED 2026-05-04:
 *   - Form I-131 edition: 01/20/25
 *   - Paper: Part 2, Item 1.e — select even if inside the US
 *   - Paper top of form: handwrite "Ukraine RE-PAROLE"
 *   - Online (my.uscis.gov): Box 10.C
 *   - I-134A sponsor intake: PAUSED. I-131 Re-Parole: ACTIVE (case-by-case).
 *   - Source: uscis.gov/i-131 (USCIS last reviewed 03/30/2026), verified 2026-05-04
 *
 * This page renders the same WizardProvider + WizardShell + WizardController
 * stack used by /services/[slug]/wizard/page.tsx, scoped to re-parole-u4u.
 *
 * No Stripe. No USCIS submission. No legal advice.
 * Payment is in mock mode (Screen10 → setPaymentStatus('mock_paid')).
 * OCR is placeholder (Screen04/Screen05 show upload UI, no live OCR in Stage 8).
 */

import type { Metadata } from 'next'
import { WizardProvider } from '@/contexts/WizardContext'
import { WizardShell } from '@/components/wizard/WizardShell'
import { WizardController } from '@/components/wizard/WizardController'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return {
    title: 'Re-Parole U4U — Start Your Application | Messenginfo',
    description:
      'Guided self-help wizard to prepare your Form I-131 Re-Parole packet. ' +
      'Edition 01/20/25. You review, sign, and file yourself. Not legal advice.',
    metadataBase: new URL('https://messenginfo.com'),
    robots: { index: false, follow: false },
    alternates: {
      canonical: `https://messenginfo.com/${locale}/services/re-parole-u4u/start`,
    },
  }
}

export default async function ReParoleStartPage({ params }: Props) {
  // params needed to satisfy Next.js RSC signature (locale used by WizardProvider
  // via localStorage / URL; server side renders the shell only)
  const { locale: _locale } = await params

  return (
    <WizardProvider>
      <WizardShell slug="re-parole-u4u">
        <WizardController />
      </WizardShell>
    </WizardProvider>
  )
}
