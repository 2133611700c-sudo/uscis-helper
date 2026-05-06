import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { routing } from '@/i18n/routing'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const titles: Record<string, string> = {
    en: 'Pricing – Messenginfo',
    uk: 'Ціни – Messenginfo',
    ru: 'Цены – Messenginfo',
    es: 'Precios – Messenginfo',
  }
  const descs: Record<string, string> = {
    en: 'Simple, transparent pricing for immigration document preparation tools.',
    uk: 'Прозорі ціни на інструменти підготовки іміграційних документів.',
    ru: 'Прозрачные цены на инструменты подготовки иммиграционных документов.',
    es: 'Precios simples y transparentes para herramientas de preparación de documentos de inmigración.',
  }
  return {
    title: titles[locale] ?? titles.en,
    description: descs[locale] ?? descs.en,
  }
}

// ─── i18n strings ─────────────────────────────────────────────────────────────
const T = {
  en: {
    eyebrow: 'Pricing',
    title: 'Simple, transparent pricing',
    subtitle: 'No subscriptions. No hidden fees. Pay once per document or application.',
    disclaimer: 'Messenginfo is not a law firm. We provide self-help tools and information, not legal advice.',
    popular: 'Most popular',
    plans: [
      {
        name: 'Free',
        price: '$0',
        period: 'always free',
        description: 'Full access to all information resources, FAQ, official source library, and immigration updates.',
        cta: 'Get started',
        ctaHref: '/',
        highlight: false,
        items: [
          'Immigration FAQ & guides',
          'USCIS case status checker',
          'Official source library',
          'Re-Parole / TPS / EAD information',
          'Form field explainers',
        ],
        note: null,
      },
      {
        name: 'Translation Draft',
        price: '$15',
        period: 'per document',
        description: 'Generate a clean, USCIS-ready English translation draft from your passport, birth certificate, or other foreign document.',
        cta: 'Translate a document',
        ctaHref: '/services/translate-document',
        highlight: true,
        items: [
          '14 document types supported',
          'Passport, birth cert, marriage cert + more',
          'Downloadable HTML → Print as PDF',
          'Certification block (you sign yourself)',
          'Works for USCIS 8 CFR 103.2(b)(3)',
        ],
        note: 'You are the translator of record. Messenginfo does not certify translations.',
      },
      {
        name: 'Filing Packet',
        price: '$29',
        period: 'per application',
        description: 'Complete self-filing packet for Re-Parole (I-131). Includes all forms, instructions, document checklist, and I-912 fee waiver option.',
        cta: 'Start Re-Parole',
        ctaHref: '/services/re-parole-u4u',
        highlight: false,
        items: [
          'I-131 form preparation guide',
          'USCIS filing checklist',
          'Document package instructions',
          'I-912 fee waiver option',
          'Multilingual (EN / UK / RU / ES)',
        ],
        note: 'You file yourself. Messenginfo does not submit to USCIS on your behalf.',
      },
    ],
    faqTitle: 'Frequently asked questions',
    faqs: [
      {
        q: 'Is the payment secure?',
        a: 'Yes. Payments are processed by Stripe — a PCI-compliant payment processor. Messenginfo does not store your card details.',
      },
      {
        q: 'Do I get a refund if USCIS rejects my application?',
        a: 'No. Messenginfo provides self-help tools and information. Application outcomes depend on your individual situation and USCIS decisions. We do not guarantee any outcome.',
      },
      {
        q: 'Can I use the translation draft without hiring a professional translator?',
        a: 'Under 8 CFR 103.2(b)(3), USCIS accepts translations certified by any competent person — including you, the applicant, if you certify your competence. The download includes a certification block. This is your responsibility.',
      },
      {
        q: 'Is this legal advice?',
        a: 'No. Messenginfo is not a law firm and does not provide legal advice. For advice on your specific situation, consult a licensed immigration attorney.',
      },
    ],
  },
  uk: {
    eyebrow: 'Ціни',
    title: 'Прозорі ціни без сюрпризів',
    subtitle: 'Без підписок. Без прихованих зборів. Одна оплата за документ або заяву.',
    disclaimer: 'Messenginfo — не юридична фірма. Ми надаємо інструменти самодопомоги та інформацію, а не юридичні консультації.',
    popular: 'Найпопулярніший',
    plans: [
      {
        name: 'Безкоштовно',
        price: '$0',
        period: 'завжди безкоштовно',
        description: 'Повний доступ до всіх інформаційних ресурсів, FAQ, бібліотеки офіційних джерел та оновлень.',
        cta: 'Почати',
        ctaHref: '/',
        highlight: false,
        items: ['FAQ та посібники', 'Перевірка статусу справи USCIS', 'Бібліотека офіційних джерел', 'Інформація Re-Parole / TPS / EAD', 'Пояснення полів форм'],
        note: null,
      },
      {
        name: 'Чернетка перекладу',
        price: '$15',
        period: 'за документ',
        description: 'Сформуйте чистий English переклад вашого паспорта, свідоцтва про народження або іншого іноземного документа.',
        cta: 'Перекласти документ',
        ctaHref: '/services/translate-document',
        highlight: true,
        items: ['14 типів документів', 'Паспорт, свідоцтво, довідки та інше', 'Завантаження HTML → Друк як PDF', 'Блок підтвердження (ви підписуєте самі)', 'Відповідає USCIS 8 CFR 103.2(b)(3)'],
        note: 'Ви є перекладачем відповідно до запису. Messenginfo не засвідчує переклади.',
      },
      {
        name: 'Пакет для подачі',
        price: '$29',
        period: 'за заяву',
        description: 'Повний пакет для самостійної подачі Re-Parole (I-131). Включає форми, інструкції, чеклист документів та опцію відмови від оплати I-912.',
        cta: 'Почати Re-Parole',
        ctaHref: '/services/re-parole-u4u',
        highlight: false,
        items: ['Посібник із підготовки I-131', 'Чеклист подачі USCIS', 'Інструкції до пакету документів', 'Опція відмови від оплати I-912', '4 мови (EN / UK / RU / ES)'],
        note: 'Ви подаєте самостійно. Messenginfo не подає до USCIS від вашого імені.',
      },
    ],
    faqTitle: 'Часті питання',
    faqs: [
      { q: 'Чи безпечна оплата?', a: 'Так. Платежі обробляє Stripe — сертифікований PCI платіжний провайдер. Messenginfo не зберігає дані вашої картки.' },
      { q: 'Чи повернуть гроші, якщо USCIS відхилить заяву?', a: 'Ні. Messenginfo надає інструменти самодопомоги. Результат залежить від вашої ситуації та рішень USCIS. Ми не гарантуємо результат.' },
      { q: 'Чи можна використовувати чернетку перекладу без професійного перекладача?', a: 'Відповідно до 8 CFR 103.2(b)(3), USCIS приймає переклади, засвідчені будь-якою компетентною особою — включно з вами. У завантаженні є блок підтвердження.' },
      { q: 'Це юридична консультація?', a: 'Ні. Messenginfo — не юридична фірма і не надає юридичних консультацій.' },
    ],
  },
  ru: {
    eyebrow: 'Цены',
    title: 'Прозрачные цены без сюрпризов',
    subtitle: 'Без подписок. Без скрытых сборов. Разовая оплата за документ или заявление.',
    disclaimer: 'Messenginfo — не юридическая фирма. Мы предоставляем инструменты самопомощи и информацию, а не юридические консультации.',
    popular: 'Самый популярный',
    plans: [
      {
        name: 'Бесплатно',
        price: '$0',
        period: 'всегда бесплатно',
        description: 'Полный доступ ко всем информационным ресурсам, FAQ, библиотеке официальных источников и обновлениям.',
        cta: 'Начать',
        ctaHref: '/',
        highlight: false,
        items: ['FAQ и руководства', 'Проверка статуса дела USCIS', 'Библиотека официальных источников', 'Информация Re-Parole / TPS / EAD', 'Пояснения полей форм'],
        note: null,
      },
      {
        name: 'Черновик перевода',
        price: '$15',
        period: 'за документ',
        description: 'Создайте чистый английский перевод вашего паспорта, свидетельства о рождении или другого иностранного документа.',
        cta: 'Перевести документ',
        ctaHref: '/services/translate-document',
        highlight: true,
        items: ['14 типов документов', 'Паспорт, свидетельства, справки и др.', 'Загрузка HTML → Печать как PDF', 'Блок подтверждения (вы подписываете сами)', 'Соответствует USCIS 8 CFR 103.2(b)(3)'],
        note: 'Вы являетесь переводчиком согласно записи. Messenginfo не заверяет переводы.',
      },
      {
        name: 'Пакет для подачи',
        price: '$29',
        period: 'за заявление',
        description: 'Полный пакет для самостоятельной подачи Re-Parole (I-131). Включает формы, инструкции, чеклист документов и опцию отказа от оплаты I-912.',
        cta: 'Начать Re-Parole',
        ctaHref: '/services/re-parole-u4u',
        highlight: false,
        items: ['Руководство по подготовке I-131', 'Чеклист подачи USCIS', 'Инструкции к пакету документов', 'Опция отказа от оплаты I-912', '4 языка (EN / UK / RU / ES)'],
        note: 'Вы подаёте самостоятельно. Messenginfo не подаёт в USCIS от вашего имени.',
      },
    ],
    faqTitle: 'Часто задаваемые вопросы',
    faqs: [
      { q: 'Безопасна ли оплата?', a: 'Да. Платежи обрабатывает Stripe — PCI-сертифицированный платёжный провайдер. Messenginfo не хранит данные вашей карты.' },
      { q: 'Вернут ли деньги, если USCIS отклонит заявление?', a: 'Нет. Messenginfo предоставляет инструменты самопомощи. Результат зависит от вашей ситуации и решений USCIS. Мы не гарантируем результат.' },
      { q: 'Можно ли использовать черновик перевода без профессионального переводчика?', a: 'Согласно 8 CFR 103.2(b)(3), USCIS принимает переводы, заверенные любым компетентным лицом — включая вас. В загрузке есть блок подтверждения.' },
      { q: 'Это юридическая консультация?', a: 'Нет. Messenginfo — не юридическая фирма и не предоставляет юридические консультации.' },
    ],
  },
  es: {
    eyebrow: 'Precios',
    title: 'Precios simples y transparentes',
    subtitle: 'Sin suscripciones. Sin tarifas ocultas. Un solo pago por documento o solicitud.',
    disclaimer: 'Messenginfo no es un bufete de abogados. Proporcionamos herramientas de autoayuda e información, no asesoría legal.',
    popular: 'Más popular',
    plans: [
      {
        name: 'Gratis',
        price: '$0',
        period: 'siempre gratis',
        description: 'Acceso completo a todos los recursos informativos, preguntas frecuentes, biblioteca de fuentes oficiales y actualizaciones.',
        cta: 'Comenzar',
        ctaHref: '/',
        highlight: false,
        items: ['Preguntas frecuentes y guías', 'Verificador de estado de caso USCIS', 'Biblioteca de fuentes oficiales', 'Información Re-Parole / TPS / EAD', 'Explicaciones de campos de formularios'],
        note: null,
      },
      {
        name: 'Borrador de traducción',
        price: '$15',
        period: 'por documento',
        description: 'Genere un borrador de traducción al inglés de su pasaporte, acta de nacimiento u otro documento extranjero.',
        cta: 'Traducir documento',
        ctaHref: '/services/translate-document',
        highlight: true,
        items: ['14 tipos de documentos', 'Pasaporte, actas, certificados y más', 'Descarga HTML → Imprimir como PDF', 'Bloque de certificación (usted firma)', 'Compatible con USCIS 8 CFR 103.2(b)(3)'],
        note: 'Usted es el traductor de registro. Messenginfo no certifica traducciones.',
      },
      {
        name: 'Paquete de presentación',
        price: '$29',
        period: 'por solicitud',
        description: 'Paquete completo para la presentación propia de Re-Parole (I-131). Incluye formularios, instrucciones y lista de verificación.',
        cta: 'Iniciar Re-Parole',
        ctaHref: '/services/re-parole-u4u',
        highlight: false,
        items: ['Guía de preparación de I-131', 'Lista de verificación USCIS', 'Instrucciones del paquete de documentos', 'Opción de exención de tarifas I-912', '4 idiomas (EN / UK / RU / ES)'],
        note: 'Usted presenta por su cuenta. Messenginfo no presenta a USCIS en su nombre.',
      },
    ],
    faqTitle: 'Preguntas frecuentes',
    faqs: [
      { q: '¿Es seguro el pago?', a: 'Sí. Los pagos son procesados por Stripe, un procesador de pagos certificado PCI.' },
      { q: '¿Recibiré un reembolso si USCIS rechaza mi solicitud?', a: 'No. Messenginfo proporciona herramientas de autoayuda. Los resultados dependen de su situación y las decisiones de USCIS. No garantizamos ningún resultado.' },
      { q: '¿Puedo usar el borrador de traducción sin un traductor profesional?', a: 'Según 8 CFR 103.2(b)(3), USCIS acepta traducciones certificadas por cualquier persona competente, incluido usted.' },
      { q: '¿Esto es asesoría legal?', a: 'No. Messenginfo no es un bufete de abogados y no brinda asesoría legal.' },
    ],
  },
} as const

type Locale = keyof typeof T

export default async function PricingPage({ params }: Props) {
  const { locale } = await params
  const t = T[(locale as Locale)] ?? T.en

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
      {/* Header */}
      <div className="text-center mb-14">
        <p className="text-sm font-semibold text-[var(--primary)] uppercase tracking-widest mb-3">
          {t.eyebrow}
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-1)] mb-4">
          {t.title}
        </h1>
        <p className="text-[var(--text-2)] text-base sm:text-lg max-w-2xl mx-auto">
          {t.subtitle}
        </p>
      </div>

      {/* Pricing cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {t.plans.map((plan) => (
          <div
            key={plan.name}
            className={`relative rounded-2xl border p-6 flex flex-col ${
              plan.highlight
                ? 'border-[var(--primary)] bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/20'
                : 'border-[var(--border)] bg-[var(--surface-1)]'
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full">
                {t.popular}
              </span>
            )}

            <div className="mb-5">
              <p className={`text-sm font-semibold mb-1 ${plan.highlight ? 'text-white/80' : 'text-[var(--text-2)]'}`}>
                {plan.name}
              </p>
              <div className="flex items-end gap-1">
                <span className={`text-4xl font-extrabold ${plan.highlight ? 'text-white' : 'text-[var(--text-1)]'}`}>
                  {plan.price}
                </span>
                <span className={`text-sm mb-1 ${plan.highlight ? 'text-white/70' : 'text-[var(--text-2)]'}`}>
                  / {plan.period}
                </span>
              </div>
              <p className={`text-sm mt-3 leading-relaxed ${plan.highlight ? 'text-white/85' : 'text-[var(--text-2)]'}`}>
                {plan.description}
              </p>
            </div>

            <ul className="space-y-2 mb-6 flex-1">
              {plan.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${plan.highlight ? 'text-white' : 'text-[var(--primary)]'}`} />
                  <span className={plan.highlight ? 'text-white/90' : 'text-[var(--text-1)]'}>{item}</span>
                </li>
              ))}
            </ul>

            <Link
              href={`/${locale}${plan.ctaHref}`}
              className={`block text-center rounded-xl py-3 px-4 text-sm font-semibold transition-all ${
                plan.highlight
                  ? 'bg-white text-[var(--primary)] hover:bg-white/90'
                  : 'bg-[var(--primary)] text-white hover:opacity-90'
              }`}
            >
              {plan.cta} →
            </Link>

            {plan.note && (
              <p className={`text-xs mt-3 leading-relaxed ${plan.highlight ? 'text-white/60' : 'text-[var(--text-2)]'}`}>
                ⚠ {plan.note}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Disclaimer bar */}
      <div className="mb-16 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-4 flex gap-3 items-start">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
          {t.disclaimer}
        </p>
      </div>

      {/* FAQ */}
      <section>
        <h2 className="text-xl font-bold text-[var(--text-1)] mb-6">{t.faqTitle}</h2>
        <div className="space-y-5">
          {t.faqs.map((faq) => (
            <div key={faq.q} className="border border-[var(--border)] rounded-xl p-5 bg-[var(--surface-1)]">
              <p className="font-semibold text-[var(--text-1)] mb-2">{faq.q}</p>
              <p className="text-sm text-[var(--text-2)] leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
