import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconBadge } from '@/components/ui/IconBadge'
import { type ServiceCard as ServiceCardType } from '@/data/serviceCards'

interface ServiceCardProps {
  card: ServiceCardType
  locale: string
  className?: string
}

export function ServiceCard({ card, locale, className }: ServiceCardProps) {
  const t = useTranslations('cards')
  const tb = useTranslations('badges')
  const cardData = t.raw(card.id) as { title: string; shortProblem: string }

  return (
    <Link
      href={`/${locale}/services/${card.slug}`}
      data-service-card={card.id}
      className={cn(
        'group flex h-full min-h-[176px] md:min-h-[200px] flex-col gap-3 rounded-[12px] bg-white border border-slate-100 p-5 md:p-6',
        'shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition-[transform,box-shadow] duration-200',
        'hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] active:scale-[0.99]',
        className,
      )}
    >
      {/* Header: icon + official source badge */}
      <div className="flex items-start justify-between gap-2">
        <IconBadge icon={card.icon} size="md" />
        {card.hasOfficialSource && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-700 shrink-0">
            <CheckCircle2 className="h-3 w-3" />
            {tb('officialSource')}
          </span>
        )}
      </div>

      {/* Title + description */}
      <div className="flex-1 space-y-1.5">
        <h3 className="font-semibold text-ink-900 text-base leading-snug group-hover:text-brand-600 transition-colors">
          {cardData.title}
        </h3>
        <p className="text-sm text-ink-600 leading-relaxed line-clamp-3">
          {cardData.shortProblem}
        </p>
      </div>

      {/* Footer: checkmark CTA */}
      <div className="mt-auto flex items-center justify-end pt-1">
        <span className="flex items-center gap-1.5 text-sm font-medium text-brand-600 transition-transform group-hover:translate-x-0.5">
          <CheckCircle2 className="h-4 w-4" />
        </span>
      </div>
    </Link>
  )
}
