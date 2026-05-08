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
  const descs: Record<string, string> = {
    uk: 'Перекладіть ваш документ (свідоцтво, паспорт, посвідчення) для USCIS. Підпишіть онлайн. PDF готовий за кілька хвилин.',
    ru: 'Переведите ваш документ (свидетельство, паспорт, удостоверение) для USCIS. Подпишите онлайн. PDF готов за несколько минут.',
    en: 'Translate your document (birth certificate, passport, ID) for USCIS. Sign online. PDF ready in minutes.',
    es: 'Traduzca su documento (certificado, pasaporte, ID) para USCIS. Firme en línea. PDF listo en minutos.',
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
