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
        'group flex h-full min-h-[176px] md:min-h-[228px] flex-col gap-4 rounded-card bg-white border border-slate-100 p-5 md:p-6',
        'shadow-card hover:shadow-card-hover transition-[transform,box-shadow] duration-200',
        'hover:-translate-y-1 active:scale-[0.99]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <IconBadge icon={card.icon} size="md" />
        <RiskBadge risk={card.risk} />
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold text-ink-900 text-lg leading-snug group-hover:text-brand-600 transition-colors">
          {cardData.title}
        </h3>
        <p className="text-sm text-ink-600 leading-relaxed line-clamp-3">
          {cardData.shortProblem}
        </p>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
        {card.hasOfficialSource ? <SourceBadge className="self-start" /> : <span />}
        <span className="text-sm font-medium text-brand-600 transition-transform group-hover:translate-x-0.5">
          {t('action')}
        </span>
      </div>
    </Link>
  )
}
