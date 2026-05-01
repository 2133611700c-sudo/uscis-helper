import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { CheckCircle2, ArrowRight } from 'lucide-react'
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
        'group flex h-full flex-col rounded-[12px] bg-white border border-slate-100 overflow-hidden',
        'shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition-[transform,box-shadow] duration-200',
        'hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.14)] active:scale-[0.99]',
        !card.image && 'min-h-[176px] md:min-h-[200px]',
        className,
      )}
    >
      {/* Service image (when provided) */}
      {card.image && (
        <div className="relative w-full h-[150px] sm:h-[160px] shrink-0 bg-slate-100">
          <Image
            src={card.image}
            alt={cardData.title}
            fill
            className="object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="(min-width: 1280px) 300px, (min-width: 640px) 50vw, 100vw"
          />
          {/* Official source badge overlaid on image */}
          {card.hasOfficialSource && (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/90 backdrop-blur-sm text-brand-700 shadow-sm">
              <CheckCircle2 className="h-3 w-3" />
              {tb('officialSource')}
            </span>
          )}
        </div>
      )}

      {/* Card content */}
      <div className={cn('flex flex-col gap-3 flex-1', card.image ? 'p-4 md:p-5' : 'p-5 md:p-6')}>
        {/* Header: icon + official source badge (icon-only cards) */}
        {!card.image && (
          <div className="flex items-start justify-between gap-2">
            <IconBadge icon={card.icon} size="md" />
            {card.hasOfficialSource && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-700 shrink-0">
                <CheckCircle2 className="h-3 w-3" />
                {tb('officialSource')}
              </span>
            )}
          </div>
        )}

        {/* Title + description */}
        <div className="flex-1 space-y-1.5">
          <h3 className={cn(
            'font-semibold text-ink-900 leading-snug group-hover:text-brand-600 transition-colors',
            card.image ? 'text-base' : 'text-base'
          )}>
            {cardData.title}
          </h3>
          <p className="text-sm text-ink-600 leading-relaxed line-clamp-3">
            {cardData.shortProblem}
          </p>
        </div>

        {/* Footer CTA */}
        <div className="mt-auto flex items-center justify-end pt-1">
          <span className="flex items-center gap-1 text-sm font-medium text-brand-600 transition-transform group-hover:translate-x-0.5">
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  )
}
