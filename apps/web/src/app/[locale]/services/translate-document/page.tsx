import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, FileText } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { Container } from '@/components/ui/Container'
import { IconBadge } from '@/components/ui/IconBadge'
import { TranslationSamplePreview } from '@/components/services/translation/TranslationSamplePreview'

interface Props {
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const messages = (await import(`../../../../../messages/${locale}.json`)).default
  const title = `${messages.translationService.title} | Messenginfo`
  const description = messages.translationService.subtitle

  return {
    title,
    description,
    metadataBase: new URL('https://messenginfo.com'),
    robots: { index: true, follow: true },
    alternates: {
      canonical: `https://messenginfo.com/${locale}/services/translate-document`,
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `https://messenginfo.com/${l}/services/translate-document`]),
      ),
    },
    openGraph: {
      title,
      description,
      url: `https://messenginfo.com/${locale}/services/translate-document`,
      locale: locale === 'uk' ? 'uk_UA' : locale === 'ru' ? 'ru_RU' : locale === 'es' ? 'es_ES' : 'en_US',
    },
  }
}

export default async function TranslateDocumentPage({ params }: Props) {
  const { locale } = await params
  const tServices = await getTranslations({ locale, namespace: 'services' })
  const tBreadcrumb = await getTranslations({ locale, namespace: 'translationService' })
  const messages = (await import(`../../../../../messages/${locale}.json`)).default

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: tBreadcrumb('home'), item: `https://messenginfo.com/${locale}` },
      { '@type': 'ListItem', position: 2, name: tServices('title'), item: `https://messenginfo.com/${locale}/services` },
      { '@type': 'ListItem', position: 3, name: tBreadcrumb('title'), item: `https://messenginfo.com/${locale}/services/translate-document` },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Breadcrumb — hidden on mobile (Phase 12) */}
      <div className="border-b border-[var(--border)] bg-[var(--surface-2)] hidden md:block">
        <Container>
          <nav className="flex items-center gap-1.5 py-3 text-xs text-[var(--text-2)]" aria-label="Breadcrumb">
            <Link href={`/${locale}`} className="transition-colors hover:text-[var(--text-1)]">
              {tBreadcrumb('home')}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link href={`/${locale}/services`} className="transition-colors hover:text-[var(--text-1)]">
              {tServices('title')}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-[var(--text-1)]">{tBreadcrumb('title')}</span>
          </nav>
        </Container>
      </div>

      {/* Hero — Phase 4: primary CTA + trust pills */}
      <div className="border-b border-[var(--border)] bg-[var(--surface-1)]">
        <Container>
          <div className="py-6 md:py-8">
            <div className="flex items-start gap-3 mb-5">
              <IconBadge icon={FileText} size="lg" />
              <div className="space-y-2">
                <h1 className="text-2xl font-bold leading-tight text-[var(--text-1)] md:text-3xl">
                  {tBreadcrumb('title')}
                </h1>
                <p className="max-w-2xl text-sm leading-relaxed text-[var(--text-2)] md:text-base">
                  {tBreadcrumb('subtitle')}
                </p>
              </div>
            </div>

            {/* Trust pills */}
            <div className="flex flex-wrap gap-2 mb-5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-800">
                ✅ {locale === 'ru' ? 'Принимает USCIS' : locale === 'uk' ? 'Приймає USCIS' : locale === 'es' ? 'Aceptado por USCIS' : 'USCIS accepted'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                ✍️ {locale === 'ru' ? 'Цифровая подпись' : locale === 'uk' ? 'Цифровий підпис' : locale === 'es' ? 'Firma digital' : 'Digital signature'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800">
                📄 {locale === 'ru' ? 'Сертификация 8 CFR §103.2' : locale === 'uk' ? 'Сертифікація 8 CFR §103.2' : locale === 'es' ? 'Certificación 8 CFR §103.2' : '8 CFR §103.2 certified'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                ⚡ {locale === 'ru' ? '5–10 минут' : locale === 'uk' ? '5–10 хвилин' : locale === 'es' ? '5–10 minutos' : '5–10 minutes'}
              </span>
            </div>

            {/* Primary CTA */}
            <a
              href={`/${locale}/services/translate-document/start`}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-base font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[.98] transition-all"
            >
              {locale === 'ru' ? 'Начать перевод →' : locale === 'uk' ? 'Почати переклад →' : locale === 'es' ? 'Comenzar traducción →' : 'Start translation →'}
            </a>
          </div>
        </Container>
      </div>

      {/* How it works — 3 steps */}
      <div className="bg-[var(--surface-2)] py-8">
        <Container>
          <p className="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-4">
            {locale === 'ru' ? 'Как это работает' : locale === 'uk' ? 'Як це працює' : locale === 'es' ? 'Cómo funciona' : 'How it works'}
          </p>
          <div className="flex flex-col gap-4 mb-6">
            {[
              {
                num: '1',
                title: locale === 'ru' ? 'Загрузите документ' : locale === 'uk' ? 'Завантажте документ' : locale === 'es' ? 'Suba su documento' : 'Upload your document',
                desc: locale === 'ru' ? 'Сфотографируйте или загрузите файл. Принимаем JPG, PNG, PDF.' : locale === 'uk' ? 'Сфотографуйте або завантажте файл. Приймаємо JPG, PNG, PDF.' : locale === 'es' ? 'Tome una foto o suba el archivo. Aceptamos JPG, PNG, PDF.' : 'Take a photo or upload a file. We accept JPG, PNG, PDF.',
              },
              {
                num: '2',
                title: locale === 'ru' ? 'Выберите план и оплатите' : locale === 'uk' ? 'Оберіть план і оплатіть' : locale === 'es' ? 'Elija un plan y pague' : 'Choose a plan and pay',
                desc: locale === 'ru' ? 'Basic ($14.99), Plus ($19.99) или Premium ($29.99). Stripe — безопасная оплата.' : locale === 'uk' ? 'Basic ($14.99), Plus ($19.99) або Premium ($29.99). Stripe — безпечна оплата.' : locale === 'es' ? 'Basic ($14.99), Plus ($19.99) o Premium ($29.99). Stripe — pago seguro.' : 'Basic ($14.99), Plus ($19.99), or Premium ($29.99). Stripe — secure payment.',
              },
              {
                num: '3',
                title: locale === 'ru' ? 'Подпишите и скачайте PDF' : locale === 'uk' ? 'Підпишіть і завантажте PDF' : locale === 'es' ? 'Firme y descargue el PDF' : 'Sign and download PDF',
                desc: locale === 'ru' ? 'Нарисуйте подпись онлайн. Сертификация по 8 CFR §103.2(b)(3). PDF отправляется на email.' : locale === 'uk' ? 'Намалюйте підпис онлайн. Сертифікація за 8 CFR §103.2(b)(3). PDF надсилається на email.' : locale === 'es' ? 'Dibuje su firma en línea. Certificación según 8 CFR §103.2(b)(3). PDF enviado al correo.' : 'Draw your signature online. Certified under 8 CFR §103.2(b)(3). PDF sent to your email.',
              },
            ].map((step) => (
              <div key={step.num} className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {step.num}
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--text-1)] mb-0.5">{step.title}</p>
                  <p className="text-xs text-[var(--text-3)] leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <a
            href={`/${locale}/services/translate-document/start`}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-lg font-bold text-white shadow-md hover:bg-blue-700 active:scale-[.98] transition-all"
          >
            {locale === 'ru' ? 'Начать перевод →' : locale === 'uk' ? 'Почати переклад →' : locale === 'es' ? 'Comenzar traducción →' : 'Start translation →'}
          </a>
        </Container>
      </div>

      {/* Phase 9: Sample output preview — collapsed behind <details> at bottom */}
      <div className="bg-[var(--surface-1)] border-t border-[var(--border)] py-6">
        <Container>
          <details className="group">
            <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors select-none">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" className="transition-transform group-open:rotate-90">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              {locale === 'uk' ? '👁 Переглянути зразок перекладу' : locale === 'ru' ? '👁 Посмотреть образец перевода' : locale === 'es' ? '👁 Ver muestra de traducción' : '👁 View sample translation'}
            </summary>
            <div className="mt-4">
              <TranslationSamplePreview locale={locale} />
            </div>
          </details>
        </Container>
      </div>

      {/* Phase 11: Footer legal disclaimer */}
      <div className="border-t border-[var(--border)] bg-[var(--surface-2)] py-4">
        <Container>
          <p className="text-xs text-[var(--text-2)] leading-relaxed max-w-3xl">
            {locale === 'ru'
              ? 'Messenginfo — не юридическая фирма и не сертифицированное бюро переводов. Мы предоставляем шаблон-черновик перевода для самостоятельной подготовки документов. Шаблон не является юридической консультацией. Перед подачей в USCIS проверьте актуальные требования на uscis.gov. Используя сервис, вы принимаете полную ответственность за содержание и подпись перевода.'
              : locale === 'uk'
              ? 'Messenginfo — не юридична фірма і не сертифіковане бюро перекладів. Ми надаємо шаблон-чернетку перекладу для самостійної підготовки документів. Шаблон не є юридичною консультацією. Перед подачею до USCIS перевірте актуальні вимоги на uscis.gov. Використовуючи сервіс, ви приймаєте повну відповідальність за зміст і підпис перекладу.'
              : locale === 'es'
              ? 'Messenginfo no es una firma legal ni una agencia de traducción certificada. Proporcionamos plantillas de traducción en borrador. Esto no constituye asesoría legal. Verifique los requisitos actuales en uscis.gov antes de presentar su solicitud. Al usar el servicio, acepta total responsabilidad por el contenido y firma de la traducción.'
              : 'Messenginfo is not a law firm and does not provide professional translation services. We provide draft translation templates for self-preparation only. This is not legal advice. Verify current requirements at uscis.gov before filing. By using this service you accept full responsibility for the translation content and signature.'}
          </p>
        </Container>
      </div>
    </>
  )
}
