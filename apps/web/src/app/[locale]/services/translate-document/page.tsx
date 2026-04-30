import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, FileText } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { Container } from '@/components/ui/Container'
import { Section } from '@/components/ui/Section'
import { IconBadge } from '@/components/ui/IconBadge'
import { TranslationServiceExperience } from '@/components/services/translation/TranslationServiceExperience'

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

      <div className="bg-slate-50 border-b border-slate-100">
        <Container>
          <nav className="flex items-center gap-1.5 py-3 text-xs text-ink-500" aria-label="Breadcrumb">
            <Link href={`/${locale}`} className="transition-colors hover:text-ink-900">
              {tBreadcrumb('home')}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link href={`/${locale}/services`} className="transition-colors hover:text-ink-900">
              {tServices('title')}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-ink-900">{tBreadcrumb('title')}</span>
          </nav>
        </Container>
      </div>

      <Section className="pb-8">
        <div className="max-w-4xl">
          <Link
            href={`/${locale}/services`}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-slate-50"
          >
            {tBreadcrumb('backToServices')}
          </Link>
          <div className="flex items-start gap-4">
            <IconBadge icon={FileText} size="lg" />
            <div className="space-y-3">
              <h1 className="text-4xl font-bold leading-[1.1] text-ink-900 md:text-5xl">
                {tBreadcrumb('title')}
              </h1>
              <p className="max-w-3xl text-base leading-relaxed text-ink-600 md:text-lg">
                {tBreadcrumb('subtitle')}
              </p>
              <p className="inline-flex rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800">
                {tBreadcrumb('draftOnlyBanner')}
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section className="bg-slate-50 pt-0">
        <TranslationServiceExperience messages={messages.translationService} />
      </Section>
    </>
  )
}
