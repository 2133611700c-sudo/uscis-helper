import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { ArrowRight, BookOpen, CheckCircle } from 'lucide-react'
import { Container } from '@/components/ui/Container'
import { CaseStatusChecker } from './CaseStatusChecker'

interface HeroProps {
  locale: string
}

export function Hero({ locale }: HeroProps) {
  const t = useTranslations('hero')

  return (
    <div className="bg-gradient-to-b from-white via-slate-50 to-[#eef2ff] pt-10 pb-16">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,460px)] lg:items-center">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-ink-900 leading-[1.1]">
              {t('title')}
            </h1>
            <p className="mt-4 text-base sm:text-lg text-ink-600 leading-relaxed max-w-2xl mx-auto lg:mx-0">
              {t('subtitle')}
            </p>

            <div className="mt-6 flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3">
              <Link
                href={`/${locale}/services`}
                className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-medium px-6 py-3 rounded-btn transition-colors text-base"
              >
                <BookOpen className="w-4 h-4" />
                {t('ctaServices')}
              </Link>
              <Link
                href={`#sources`}
                className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-700 font-medium px-4 py-3 text-base transition-colors"
              >
                {t('ctaUpdates')}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2">
              {(t.raw('trustItems') as string[]).map((item: string, i: number) => (
                <span key={i} className="flex items-center gap-1.5 text-sm text-ink-500">
                  <CheckCircle className="w-4 h-4 text-brand-500 shrink-0" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="lg:justify-self-end">
            <CaseStatusChecker />
          </div>
        </div>
      </Container>
    </div>
  )
}
