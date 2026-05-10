/**
 * /[locale]/services/translate-document/start
 *
 * Translation wizard — v12 (integrated into site layout)
 *
 * The [locale]/layout.tsx already provides:
 *   - <Header /> — Logo / Services / Documents / FAQ / Sources /
 *                  Language switcher / Sign in / Check Status / Theme toggle
 *   - <Footer />
 *   - <MobileBottomBar />
 *   - <MiaFloatingWidget />
 *
 * This page just renders the client-side wizard component.
 * All v11 product logic preserved in TranslateWizard.tsx.
 * Back buttons on every wizard screen navigate to /{locale}/services/translate-document.
 *
 * Not indexed — wizard is a transactional flow, not a content page.
 */

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { TranslateWizard } from '@/components/services/translation/TranslateWizard'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const titles: Record<string, string> = {
    uk: 'Переклад документа — Messenginfo',
    ru: 'Перевод документа — Messenginfo',
    en: 'Document Translation — Messenginfo',
    es: 'Traducción de Documentos — Messenginfo',
  }
  // Honest scope after 2026-05-09 demotion: only ua_internal_passport_booklet
  // is fully self-serve. Other Ukrainian documents may be uploaded but route
  // to a team member for manual review. No "PDF ready in minutes" general claim.
  // No "USCIS-accepted" guarantee. No legal advice.
  const descs: Record<string, string> = {
    uk: 'Самостійний переклад українського внутрішнього паспорта для USCIS. Інші українські документи приймаються через ручну перевірку нашою командою. Не є юридичною консультацією.',
    ru: 'Самостоятельный перевод украинского внутреннего паспорта для USCIS. Другие украинские документы принимаются через ручную проверку нашей командой. Не является юридической консультацией.',
    en: 'Self-service translation for the Ukrainian internal passport booklet for USCIS purposes. Other Ukrainian documents are accepted through manual review by our team. Not legal advice.',
    es: 'Traducción autoservicio del pasaporte interno ucraniano para USCIS. Otros documentos ucranianos se procesan mediante revisión manual de nuestro equipo. No es asesoramiento legal.',
  }
  return {
    title: titles[locale] ?? titles.en,
    description: descs[locale] ?? descs.en,
    metadataBase: new URL('https://messenginfo.com'),
    robots: { index: false, follow: false },
    alternates: {
      canonical: `https://messenginfo.com/${locale}/services/translate-document/start`,
    },
  }
}

export default async function TranslateDocumentStartPage({ params }: Props) {
  // params consumed to satisfy Next.js RSC signature
  await params
  return (
    <Suspense>
      <TranslateWizard />
    </Suspense>
  )
}
