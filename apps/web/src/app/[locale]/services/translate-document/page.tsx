import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, FileText } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { Container } from '@/components/ui/Container'
import { IconBadge } from '@/components/ui/IconBadge'
import { TranslationServiceExperience } from '@/components/services/translation/TranslationServiceExperience'
import { TranslationSamplePreview } from '@/components/services/translation/TranslationSamplePreview'

interface Props {
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const messages = (await import(`../../../../../messages/${locale}.json`)).default
  const title = `${messages.translationService.title} | Messenginfo`
  const description = messages.translationService.subtitle

  return {
    title,
    description,
    metadataBase: new URL('https://messenginfo.com'),
    robots: { index: true, follow: true },
    alternates: {
      canonical: `https://messenginfo.com/${locale}/services/translate-document`,
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `https://messenginfo.com/${l}/services/translate-document`]),
      ),
    },
    openGraph: {
      title,
      description,
      url: `https://messenginfo.com/${locale}/services/translate-document`,
      locale: locale === 'uk' ? 'uk_UA' : locale === 'ru' ? 'ru_RU' : locale === 'es' ? 'es_ES' : 'en_US',
    },
  }
}

export default async function TranslateDocumentPage({ params }: Props) {
  const { locale } = await params
  const tServices = await getTranslations({ locale, namespace: 'services' })
  const tBreadcrumb = await getTranslations({ locale, namespace: 'translationService' })
  const messages = (await import(`../../../../../messages/${locale}.json`)).default

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: tBreadcrumb('home'), item: `https://messenginfo.com/${locale}` },
      { '@type': 'ListItem', position: 2, name: tServices('title'), item: `https://messenginfo.com/${locale}/services` },
      { '@type': 'ListItem', position: 3, name: tBreadcrumb('title'), item: `https://messenginfo.com/${locale}/services/translate-document` },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Breadcrumb */}
      <div className="border-b border-[var(--border)] bg-[var(--surface-2)]">
        <Container>
          <nav className="flex items-center gap-1.5 py-3 text-xs text-[var(--text-2)]" aria-label="Breadcrumb">
            <Link href={`/${locale}`} className="transition-colors hover:text-[var(--text-1)]">
              {tBreadcrumb('home')}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link href={`/${locale}/services`} className="transition-colors hover:text-[var(--text-1)]">
              {tServices('title')}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-[var(--text-1)]">{tBreadcrumb('title')}</span>
          </nav>
        </Container>
      </div>

      {/* Compact hero — always readable in light + dark */}
      <div className="border-b border-[var(--border)] bg-[var(--surface-1)]">
        <Container>
          <div className="py-5">
            <Link
              href={`/${locale}/services`}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-4 py-1.5 text-sm font-medium text-[var(--text-2)] transition-colors hover:text-[var(--text-1)]"
            >
              {tBreadcrumb('backToServices')}
            </Link>
            <div className="flex items-start gap-3">
              <IconBadge icon={FileText} size="lg" />
              <div className="space-y-2">
                <h1 className="text-2xl font-bold leading-tight text-[var(--text-1)] md:text-3xl">
                  {tBreadcrumb('title')}
                </h1>
                <p className="max-w-2xl text-sm leading-relaxed text-[var(--text-2)] md:text-base">
                  {tBreadcrumb('subtitle')}
                </p>
                <p className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 border border-amber-200">
                  {tBreadcrumb('draftOnlyBanner')}
                </p>
                {/* P0-11: Legal disclaimer — visible in hero, above fold */}
                <p className="text-xs text-[var(--text-3)] mt-1">
                  {locale === 'ru'
                    ? 'Messenginfo — не юридическая фирма. Мы помогаем подготовить шаблон перевода, но не оказываем юридических услуг.'
                    : locale === 'uk'
                    ? 'Messenginfo — не юридична фірма. Ми допомагаємо підготувати шаблон перекладу, але не надаємо юридичних послуг.'
                    : locale === 'es'
                    ? 'Messenginfo no es una firma legal. Ayudamos a preparar plantillas de traducción, no brindamos asesoría legal.'
                    : 'Messenginfo is not a law firm. We help prepare translation templates; we do not provide legal advice.'}
                </p>
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* Stage 13B: Sample output preview — show before wizard to build trust */}
      <div className="bg-[var(--surface-2)] pt-6 pb-0">
        <Container>
          <p className="text-xs font-bold text-[var(--text-2)] uppercase tracking-wider mb-3">
            {locale === 'uk' ? '👇 Ось як виглядає результат' : locale === 'ru' ? '👇 Вот как выглядит результат' : locale === 'es' ? '👇 Así luce el resultado' : '👇 This is what you get'}
          </p>
          <TranslationSamplePreview locale={locale} />
        </Container>
      </div>

      {/* Wizard — full width, proper bg */}
      <div className="bg-[var(--surface-2)] py-6">
        <Container>
          <TranslationServiceExperience messages={messages.translationService} />
        </Container>
      </div>
    </>
  )
}
