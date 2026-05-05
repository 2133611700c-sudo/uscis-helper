import { getLocale } from 'next-intl/server'
import { TrendingTopicsBar } from '@/components/home/TrendingTopicsBar'
import { Hero } from '@/components/home/Hero'
import { OfficialSourcesStrip } from '@/components/home/OfficialSourcesStrip'
import { ServiceCardGrid } from '@/components/home/ServiceCardGrid'
import { AskQuestionCTA } from '@/components/home/AskQuestionCTA'
import { HowWeHelpSection } from '@/components/home/HowWeHelpSection'
import { DocumentToolsSection } from '@/components/home/DocumentToolsSection'
import { TelegramStrip } from '@/components/home/TelegramStrip'
import { DisclaimerSection } from '@/components/home/DisclaimerSection'

export default async function HomePage() {
  const locale = await getLocale()

  return (
    <>
      <Hero locale={locale} />
      {/* Pin homepage body to light mode — dark toggle belongs to the wizard only.
          All ink-* and brand-* tokens are hardcoded light-mode values;
          without this wrapper they become invisible on the dark body bg. */}
      <div className="bg-white text-slate-900">
        <ServiceCardGrid locale={locale} />
        <TrendingTopicsBar locale={locale} />
        <OfficialSourcesStrip />
        <AskQuestionCTA locale={locale} />
        <HowWeHelpSection />
        <DocumentToolsSection />
        <TelegramStrip />
        <DisclaimerSection />
      </div>
    </>
  )
}
