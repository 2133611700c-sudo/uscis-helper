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
        // H&F-matched card shell: 14px radius, border, shadow, overflow-hidden
        'group flex h-full flex-col rounded-[14px] bg-white overflow-hidden',
        'border border-slate-200/80',
        'shadow-[0_2px_8px_rgba(0,0,0,0.06)]',
        // H&F-matched transitions: translateY(-5px) on hover, scale(.97) on active
        'transition-[transform,box-shadow] duration-300 ease-out',
        'hover:-translate-y-[5px] hover:shadow-[0_12px_32px_rgba(0,0,0,0.12)]',
        'active:scale-[0.97]',
        !card.image && 'min-h-[176px] md:min-h-[200px]',
        className,
      )}
    >
      {/* ─── Service image ─── */}
      {card.image && (
        // H&F .sph: 200px → 220px → 260px → 280px
        <div className="relative w-full h-[200px] sm:h-[220px] md:h-[240px] lg:h-[260px] shrink-0 overflow-hidden bg-slate-100">
          <Image
            src={card.image}
            alt={cardData.title}
            fill
            priority={card.sortOrder <= 4}
            className={cn(
              'object-cover object-center',
              // H&F: scale(1.07) on hover, 500ms ease
              'transition-transform duration-500 ease-in-out',
              'group-hover:scale-[1.07] group-active:scale-[1.04]',
            )}
            sizes="(min-width: 1280px) 560px, (min-width: 768px) 50vw, 100vw"
          />
          {/* Official source badge — overlaid bottom-left */}
          {card.hasOfficialSource && (
            <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/92 backdrop-blur-sm text-brand-700 shadow-sm border border-white/60">
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              {tb('officialSource')}
            </span>
          )}
        </div>
      )}

      {/* ─── Card content ─── */}
      <div className={cn(
        'flex flex-col gap-3 flex-1',
        card.image ? 'p-4 md:p-5' : 'p-5 md:p-6',
      )}>
        {/* Header: icon + badge — only for icon-only cards */}
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
          <h3 className="font-semibold text-base text-ink-900 leading-snug group-hover:text-brand-600 transition-colors duration-200">
            {cardData.title}
          </h3>
          <p className="text-sm text-ink-600 leading-relaxed line-clamp-3">
            {cardData.shortProblem}
          </p>
        </div>

        {/* Footer CTA */}
        <div className="mt-auto flex items-center justify-end pt-1">
          <span className="flex items-center gap-1 text-sm font-medium text-brand-600 transition-transform duration-200 group-hover:translate-x-1">
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  )
}
