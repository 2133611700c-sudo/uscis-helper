import { useTranslations } from 'next-intl'
import { Section } from '@/components/ui/Section'
import { ServiceCard } from '@/components/cards/ServiceCard'
import { serviceCards } from '@/data/serviceCards'

interface ServiceCardGridProps {
  locale: string
}

export function ServiceCardGrid({ locale }: ServiceCardGridProps) {
  const t = useTranslations('services')

  return (
    <Section id="services">
      <div className="text-center mb-10">
        <h2 className="text-2xl md:text-3xl font-bold text-ink-900">{t('title')}</h2>
        <p className="mt-3 text-ink-600 text-base">{t('subtitle')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {serviceCards.map((card) => (
          <ServiceCard key={card.id} card={card} locale={locale} />
        ))}
      </div>
    </Section>
  )
}
