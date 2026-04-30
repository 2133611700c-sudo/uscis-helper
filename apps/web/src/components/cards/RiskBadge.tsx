import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { type RiskLevel } from '@/data/serviceCards'

interface RiskBadgeProps {
  risk: RiskLevel
  className?: string
}

const riskStyles: Record<RiskLevel, string> = {
  low: 'bg-risk-low-bg text-risk-low-fg',
  medium: 'bg-risk-mid-bg text-risk-mid-fg',
  high: 'bg-risk-high-bg text-risk-high-fg',
}

export function RiskBadge({ risk, className }: RiskBadgeProps) {
  const t = useTranslations('badges.risk')
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-badge text-xs font-medium',
        riskStyles[risk],
        className,
      )}
    >
      {t(risk)}
    </span>
  )
}
