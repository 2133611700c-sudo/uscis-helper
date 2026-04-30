import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { IconBadge } from '@/components/ui/IconBadge'
import { RiskBadge } from './RiskBadge'
import { SourceBadge } from './SourceBadge'
import { type ServiceCard as ServiceCardType } from '@/data/serviceCards'

interface ServiceCardProps {
  card: ServiceCardType
  locale: string
  className?: string
}

export function ServiceCard({ card, locale, className }: ServiceCardProps) {
  const t = useTranslations('cards')
  const cardData = t.raw(card.id) as { title: string; shortProblem: string }

  return (
    <Link
      href={`/${locale}/services/${card.slug}`}
      data-service-card={card.id}
      className={cn(
        'group flex flex-col gap-3 rounded-card bg-white border border-slate-100 p-5',
        'shadow-card hover:shadow-card-hover transition-shadow duration-200',
        'hover:-translate-y-0.5 transition-transform',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <IconBadge icon={card.icon} size="md" />
        <RiskBadge risk={card.risk} />
      </div>
      <div>
        <h3 className="font-semibold text-ink-900 text-sm leading-snug group-hover:text-brand-600 transition-colors">
          {cardData.title}
        </h3>
        <p className="mt-1 text-xs text-ink-500 leading-relaxed line-clamp-2">
          {cardData.shortProblem}
        </p>
      </div>
      {card.hasOfficialSource && <SourceBadge className="self-start mt-auto" />}
    </Link>
  )
}
