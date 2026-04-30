import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { ExternalLink, Library, ChevronRight } from 'lucide-react'
import { routing } from '@/i18n/routing'
import { serviceCards } from '@/data/serviceCards'
import { IconBadge } from '@/components/ui/IconBadge'
import { RiskBadge } from '@/components/cards/RiskBadge'
import { SourceBadge } from '@/components/cards/SourceBadge'
import { ServiceCard } from '@/components/cards/ServiceCard'
import { DisclaimerSection } from '@/components/home/DisclaimerSection'
import { CaseStatusChecker } from '@/components/home/CaseStatusChecker'
import { Container } from '@/components/ui/Container'
import { Section } from '@/components/ui/Section'

const SLUGS = [
  'parole-expires-soon',
  're-parole-u4u',
  'tps-ukraine',
  'ead-work-permit',
  'i-94',
  'uscis-case-status',
  'payment-problem',
  'biometrics',
  'rfe-denial',
  'translate-document',
  'form-draft-helper',
  'official-sources',
] as const

type Slug = (typeof SLUGS)[number]

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    SLUGS.map((slug) => ({ locale, slug })),
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!SLUGS.includes(slug as Slug)) return {}

  const t = await getTranslations({ locale, namespace: 'cards' })
  const cardData = t.raw(slug) as { title: string; shortProblem: string }

  const title = `${cardData.title} | Messenginfo`
  const description = cardData.shortProblem

  return {
    title,
    description,
    metadataBase: new URL('https://messenginfo.com'),
    alternates: {
      canonical: `https://messenginfo.com/${locale}/services/${slug}`,
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `https://messenginfo.com/${l}/services/${slug}`]),
      ),
    },
    openGraph: {
      title,
      description,
      url: `https://messenginfo.com/${locale}/services/${slug}`,
      locale: locale === 'uk' ? 'uk_UA' : locale === 'ru' ? 'ru_RU' : locale === 'es' ? 'es_ES' : 'en_US',
    },
  }
}

export default async function ServicePage({ params }: Props) {
  const { locale, slug } = await params

  if (!SLUGS.includes(slug as Slug)) notFound()

  const card = serviceCards.find((c) => c.slug === slug)
  if (!card) notFound()

  const tCards = await getTranslations({ locale, namespace: 'cards' })
  const tPages = await getTranslations({ locale, namespace: 'servicePages' })
  const tBreadcrumb = await getTranslations({ locale, namespace: 'services' })

  const cardData = tCards.raw(slug) as { title: string; shortProblem: string }
  const pageData = tPages.raw(slug) as {
    title: string
    subtitle: string
    whatHelps: string[]
    commonMistakes: string[]
    officialNote: string
    lastVerifiedLabel: string
  }

  const lastVerified = pageData.lastVerifiedLabel.replace('{date}', card.sourceLastVerified)

  // Related services: sortOrder neighbors (wrapping)
  const sorted = [...serviceCards].sort((a, b) => a.sortOrder - b.sortOrder)
  const idx = sorted.findIndex((c) => c.slug === slug)
  const related = [
    sorted[(idx - 1 + sorted.length) % sorted.length],
    sorted[(idx + 1) % sorted.length],
    sorted[(idx + 2) % sorted.length],
  ].filter((c) => c.slug !== slug).slice(0, 3)

  const isTranslate = slug === 'translate-document'
  const isCaseStatus = slug === 'uscis-case-status'

  // JSON-LD breadcrumb + service schema
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `https://messenginfo.com/${locale}` },
      { '@type': 'ListItem', position: 2, name: 'Services', item: `https://messenginfo.com/${locale}/services` },
      { '@type': 'ListItem', position: 3, name: cardData.title, item: `https://messenginfo.com/${locale}/services/${slug}` },
    ],
  }

  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: cardData.title,
    description: cardData.shortProblem,
    provider: { '@type': 'Organization', name: 'Messenginfo', url: 'https://messenginfo.com' },
    url: `https://messenginfo.com/${locale}/services/${slug}`,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />

      {/* Breadcrumb */}
      <div className="bg-slate-50 border-b border-slate-100">
        <Container>
          <nav className="py-3 flex items-center gap-1.5 text-xs text-ink-500" aria-label="Breadcrumb">
            <Link href={`/${locale}`} className="hover:text-ink-900 transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href={`/${locale}/services`} className="hover:text-ink-900 transition-colors">{tBreadcrumb('title')}</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-ink-900 font-medium">{cardData.title}</span>
          </nav>
        </Container>
      </div>

      {/* Hero */}
      <Section>
        <div className="max-w-3xl">
          <div className="flex items-start gap-4 mb-4">
            <IconBadge icon={card.icon} size="lg" />
            <div className="flex gap-2 flex-wrap pt-1">
              <RiskBadge risk={card.risk} />
              {card.hasOfficialSource && <SourceBadge />}
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-ink-900">{pageData.title}</h1>
          <p className="mt-3 text-lg text-ink-600">{pageData.subtitle}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={card.officialSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-5 py-2.5 rounded-btn transition-colors"
            >
              Open Official Source
              <ExternalLink className="w-4 h-4" />
            </a>
            <Link
              href={`/${locale}/services`}
              className="inline-flex items-center gap-2 border border-slate-200 text-ink-700 hover:bg-slate-50 text-sm font-medium px-5 py-2.5 rounded-btn transition-colors"
            >
              Back to Services
            </Link>
          </div>
        </div>
      </Section>

      {/* Case Status Checker for uscis-case-status page */}
      {isCaseStatus && (
        <div className="bg-slate-50 py-6">
          <Container>
            <div className="max-w-xl">
              <CaseStatusChecker />
            </div>
          </Container>
        </div>
      )}

      {/* Translate safe statement */}
      {isTranslate && (
        <div className="bg-amber-50 border-y border-amber-200">
          <Container>
            <div className="py-4 max-w-3xl">
              <p className="text-sm text-amber-800 font-medium">
                {/* safeStatement is static per spec */}
                USCIS generally requires a full English translation and translator certification for foreign-language documents submitted to USCIS. This page does not create a certified translation.
              </p>
            </div>
          </Container>
        </div>
      )}

      {/* What helps */}
      <Section className="bg-slate-50">
        <div className="max-w-3xl grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-bold text-ink-900 mb-4">What this helps with</h2>
            <ul className="space-y-3">
              {pageData.whatHelps.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink-900 mb-4">Common mistakes</h2>
            <ul className="space-y-3">
              {pageData.commonMistakes.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-risk-high-fg shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Official source callout */}
      <Section>
        <div className="max-w-3xl rounded-card border border-brand-100 bg-brand-50 p-5 flex items-start gap-4">
          <Library className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-ink-700">{pageData.officialNote}</p>
            <a
              href={card.officialSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors"
            >
              {card.officialSourceUrl}
              <ExternalLink className="w-3 h-3" />
            </a>
            <p className="mt-1.5 text-xs text-ink-500">{lastVerified}</p>
          </div>
        </div>
      </Section>

      {/* Related services */}
      {related.length > 0 && (
        <Section className="bg-slate-50">
          <h2 className="text-xl font-bold text-ink-900 mb-6">Related Services</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {related.map((relCard) => (
              <ServiceCard key={relCard.id} card={relCard} locale={locale} />
            ))}
          </div>
        </Section>
      )}

      <DisclaimerSection />
    </>
  )
}
