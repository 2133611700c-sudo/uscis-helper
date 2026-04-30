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
      <TrendingTopicsBar locale={locale} />
      <Hero locale={locale} />
      <OfficialSourcesStrip />
      <ServiceCardGrid locale={locale} />
      <AskQuestionCTA locale={locale} />
      <HowWeHelpSection />
      <DocumentToolsSection locale={locale} />
      <TelegramStrip />
      <DisclaimerSection />
    </>
  )
}
