import { CaseStatusChecker } from './CaseStatusChecker'

interface HeroProps {
  locale: string
}

export function Hero({ locale }: HeroProps) {
  return (
    <div className="w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hero-bg.png"
        alt="Messenginfo — Immigration Information & Document Help"
        className="w-full block"
        style={{ display: 'block', width: '100%', height: 'auto' }}
        fetchPriority="high"
      />

      <div className="bg-[#0a1628] py-6 lg:py-8">
        <CaseStatusChecker />
      </div>
    </div>
  )
}
