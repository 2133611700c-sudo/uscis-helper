import { useTranslations } from 'next-intl'
import { Section } from '@/components/ui/Section'
import { DocumentCard } from '@/components/cards/DocumentCard'
import { documentCards } from '@/data/documentCards'

interface DocumentToolsSectionProps {
  locale: string
}

export function DocumentToolsSection({ locale }: DocumentToolsSectionProps) {
  const t = useTranslations('documentTools')

  return (
    <Section>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-ink-900">{t('title')}</h2>
        <p className="mt-3 text-ink-600 text-sm max-w-2xl mx-auto">{t('subtitle')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {documentCards.map((card) => (
          <DocumentCard key={card.id} card={card} locale={locale} />
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-ink-500 max-w-2xl mx-auto">
        {t('footnote')}
      </p>
    </Section>
  )
}
